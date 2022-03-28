# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py
###############################################################################
import datetime
import json
import operator
import os
import re
import sys
import threading
import time
import traceback
import urllib.request
import urllib.parse
import uuid
from functools import reduce
import base64
import json
import hmac
import hashlib

from alarmhandler import AVNAlarmHandler, AlarmConfig
from avnav_nmea import NMEAParser
from avnrouter import AVNRouter, WpData

hasWebsockets=False
try:
  import websocket
  hasWebsockets=True
except:
  pass


from avnav_util import AVNLog, AVNUtil
from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
from avnuserapps import AVNUserAppHandler
from charthandler import AVNChartHandler
from pluginhandler import AVNPluginHandler
import avnav_handlerList

#from https://stackoverflow.com/questions/68274543/python-manually-create-jwt-token-without-library
def base64url_encode(input: bytes):
  return base64.urlsafe_b64encode(input).decode('utf-8').replace('=','')
def jwt(user,  api_sec):

  segments = []

  header = {"typ": "JWT", "alg": "HS256"}
  payload = {"id": user}

  json_header = json.dumps(header, separators=(",",":")).encode()
  json_payload = json.dumps(payload, separators=(",",":")).encode()

  segments.append(base64url_encode(json_header))
  segments.append(base64url_encode(json_payload))

  signing_input = ".".join(segments).encode()
  key = api_sec.encode()
  signature = hmac.new(key, signing_input, hashlib.sha256).digest()

  segments.append(base64url_encode(signature))

  encoded_string = ".".join(segments)

  return encoded_string


def timeToTs(tm):
  if tm is None:
    return None
  dt=AVNUtil.gt(tm)
  return AVNUtil.datetimeToTsUTC(dt)

class AE(object):
  def __init__(self,path,converter=None):
    self.path=path
    self.converter=converter
  def getValue(self,data):
    value=data
    if type(value) is dict:
      value=value.get('value')
    if value is None:
      return value
    if self.converter is not None:
      return self.converter(value)
    else:
      return value

  def getTimestamp(self,data):
    if not type(data) is dict:
      return None
    ts=data.get('timestamp')
    return timeToTs(ts)

def saveGetItem(data,key):
  if not type(data) is dict:
    return None
  return data.get(key)
def convertAisShipType(value):
  return saveGetItem(value,'id')
def convertAisClass(value):
  if value == "A":
    return 1
  if value == "B":
    return 18
  return value
def convertAisLon(value):
  return saveGetItem(value,'longitude')
def convertAisLat(value):
  return saveGetItem(value,'latitude')

AISPATHMAP={
  'mmsi':AE('mmsi'),
  'shipname':AE('name'),
  'speed':AE('navigation.speedOverGround'),
  'course':AE('navigation.courseOverGroundTrue',converter=AVNUtil.rad2deg),
  'callsign':AE('communication.callsignVhf'),
  'shiptype': AE('design.aisShipType',converter=convertAisShipType),
  'lon': AE('navigation.position',converter=convertAisLon),
  'lat': AE('navigation.position',converter=convertAisLat),
  'destination': AE('navigation.destination'),
  'type': AE('sensors.ais.class',converter=convertAisClass)
}

class Config(object):
  def __init__(self,param):
    self.skHost=AVNSignalKHandler.P_HOST.fromDict(param)
    self.port=AVNSignalKHandler.P_PORT.fromDict(param)
    self.period=AVNSignalKHandler.P_PERIOD.fromDict(param)/1000
    self.chartQueryPeriod=AVNSignalKHandler.P_CHARTPERIOD.fromDict(param) if AVNSignalKHandler.P_CHARTS.fromDict(param) else 0
    self.priority=AVNSignalKHandler.PRIORITY_PARAM_DESCRIPTION.fromDict(param)
    self.proxyMode=AVNSignalKHandler.P_CHARTPROXYMODE.fromDict(param)
    self.decode=AVNSignalKHandler.P_DIRECT.fromDict(param)
    self.aisFetchPeriod=AVNSignalKHandler.P_AISPERIOD.fromDict(param) if AVNSignalKHandler.P_AIS.fromDict(param) else 0
    self.user=AVNSignalKHandler.P_USERNAME.fromDict(param)
    self.password=AVNSignalKHandler.P_PASSWORD.fromDict(param)
    self.write=AVNSignalKHandler.P_WRITE.fromDict(param)
    self.notify=AVNSignalKHandler.P_WRITE.fromDict(param) and AVNSignalKHandler.P_NOTIFY.fromDict(param)
    self.sendWp=AVNSignalKHandler.P_WRITE.fromDict(param) and AVNSignalKHandler.P_SENDWP.fromDict(param)
    self.skSource='avnav-'+AVNSignalKHandler.P_UUID.fromDict(param)
    self.isLocal= (self.skHost == 'localhost' or self.skHost == '127.0.0.1')
    self.wsRetry=AVNSignalKHandler.P_WEBSOCKETRETRY.fromDict(param)

class MappingEntry(object):
  def __init__(self,localPath,converter=None,priority=0):
    self.localPath=localPath
    self.converter=converter
    self.priority=priority

class InfoSetter(object):
  def __init__(self,name,writer):
    self.name=name
    self.writer=writer

  def setInfo(self,info,status):
    self.writer.setInfo(self.name,info,status)
  def deleteInfo(self):
    self.writer.deleteInfo(self.name)

class WebSocketHandler(object):
  def __init__(self,infoSetter:InfoSetter,url:str,messageCallback):
    self.infoSetter=infoSetter
    self.url=url
    self.__messageCallback=messageCallback
    self.__webSocket=None
    self.__firstWebsocketMessage=False
    self.__connected=False
    self.__timeOffset=None
    self.__error=None
    self.__lock=threading.Lock()
  def getUrlForLog(self):
    return re.sub('\\?.*','',self.url)
  def open(self):
    self.infoSetter.setInfo('connecting at %s'%self.getUrlForLog(),WorkerStatus.STARTED)
    with self.__lock:
      if self.__webSocket is not None:
        try:
          self.__webSocket.close()
          self.__webSocket=None
        except:
          pass
      self.__connected=False
      self.__timeOffset=None
      try:
        self.__webSocket=websocket.WebSocketApp(self.url,
                                          on_error=self.__webSocketError,
                                          on_message=self.__webSocketMessage,
                                          on_close=self.__webSocketClose,
                                          on_open=self.__webSocketOpen)
        AVNLog.info("websocket %s created at %s",self.infoSetter.name,self.getUrlForLog())
        webSocketThread=threading.Thread(name="signalk-websocket-%s"%self.infoSetter.name,target=self.__webSocketRun)
        webSocketThread.setDaemon(True)
        webSocketThread.start()
      except Exception as e:
        try:
          self.__webSocket.close()
        except:
          pass
        self.__webSocket=None
        self.infoSetter.setInfo("unable to connect to %s:%s"%(self.getUrlForLog(),str(e)),WorkerStatus.ERROR)
        return False
    return True

  def __webSocketRun(self):
    AVNLog.info("websocket receiver %s started",self.infoSetter.name)
    self.__webSocket.run_forever()
    AVNLog.info("websocket receiver %s finished",self.infoSetter.name)

  def __webSocketOpen(self,*args):
    self.infoSetter.setInfo('connected',WorkerStatus.NMEA)
    self.__firstWebsocketMessage=True
    self.__connected=True

  #there is a change in the websocket client somewhere between
  #0.44 and 0.55 - the newer versions omit the ws parameter
  def getWSParam(self,*args):
    if len(args) > 1:
      return args[1]
    if len(args) > 0:
      return args[0]

  def __webSocketError(self,*args):
    error=self.getWSParam(*args)
    self.__error=error
    AVNLog.error("error on websocket connection %s: %s",self.infoSetter.name, error)
    try:
      self.infoSetter.setInfo("error on websocket connection %s: %s" % (self.getUrlForLog(), error), WorkerStatus.ERROR)
      self.__webSocket.close()
    except:
      pass
    self.__webSocket=None
    self.__connected=False

  def __webSocketClose(self,*args):
    AVNLog.info("websocket connection %s closed",self.infoSetter.name)
    self.__connected=False
    try:
      self.infoSetter.setInfo( "connection closed at %s" % self.getUrlForLog(), WorkerStatus.ERROR)
    except:
      pass
    self.__webSocket=None

  def __webSocketMessage(self,*args):
    message=self.getWSParam(*args)
    AVNLog.debug("received on%s: %s",self.infoSetter.name,message)
    try:
      data=json.loads(message)
      if self.__firstWebsocketMessage:
        self.__firstWebsocketMessage=False
        timestamp=data.get('timestamp')
        if timestamp is not None:
          skTimeStamp=timeToTs(timestamp)
          localTimeStamp=time.time()
          self.__timeOffset= skTimeStamp - localTimeStamp
        else:
          self.__timeOffset=None
      self.infoSetter.setInfo( "connected at %s, timeOffset=%.0fs" % (self.getUrlForLog(), self.__timeOffset or 0), WorkerStatus.NMEA)
      self.__messageCallback(data)
    except:
      AVNLog.error("error decoding %s:%s",message,traceback.format_exc())
      try:
        self.__webSocket.close()
      except:
        pass
      self.__webSocket=None
      self.__connected=False

  def close(self):
    with self.__lock:
      if self.__webSocket is None:
        return
      try:
        self.__webSocket.close()
      except:
        pass
      self.__webSocket=None
      self.__connected=False

  def send(self,data):
    sock=None
    with self.__lock:
      if not self.__connected:
        return False
      if self.__webSocket is None:
        return False
      sock=self.__webSocket
    sock.send(data)
    return True

  def isConnected(self):
    return self.__connected
  def getTimeOffset(self):
    return self.__timeOffset
  def getError(self):
    return self.__error

def getItem(item,key):
  if item is None:
    return None
  if key is None:
    return None
  return item.get(key)
def getFromDict(dataDict, keystr):
  mapList=keystr.split(".")
  return reduce(getItem, mapList, dataDict)

class AlarmQueueEntry(object):
  def __init__(self,alarm,on):
    self.alarm=alarm
    self.on=on
    self.actionStarted=None
  def setStart(self,now=None):
    self.actionStarted=now if now is not None else time.time()
  def shouldDo(self,retryTime):
    if self.actionStarted is None:
      return True
    if retryTime > self.actionStarted:
      return True
    return False


class AVNSignalKHandler(AVNWorker):
  P_MIGRATED=WorkerParameter('migrated',type=WorkerParameter.T_BOOLEAN,editable=False,default=False)
  P_PORT= WorkerParameter('port',type=WorkerParameter.T_NUMBER,default=3000,
                          description='set to signalk port')
  P_HOST= WorkerParameter('host',type=WorkerParameter.T_STRING, default='localhost',
                          description="set to signalk host")
  P_PERIOD=WorkerParameter('period',type=WorkerParameter.T_NUMBER,default=1000,
                           description='query time in ms')
  P_CHARTS=WorkerParameter('fetchCharts',type=WorkerParameter.T_BOOLEAN,default=True,
                           description='read charts from signalK')
  P_CHARTPERIOD=WorkerParameter('chartQueryPeriod',type=WorkerParameter.T_NUMBER,default=10,
                                description="query period(s) for SignalK charts",
                                condition={P_CHARTS.name:True})
  P_CHARTPROXYMODE=WorkerParameter('chartProxyMode',type=WorkerParameter.T_SELECT,default='sameHost',
                                   description='proxy tile requests: never,always,sameHost',
                                   rangeOrList=['never','always','sameHost'],
                                   condition={P_CHARTS.name:True})
  P_USEWEBSOCKETS=WorkerParameter('useWebsockets',type=WorkerParameter.T_BOOLEAN,default=True,
                                  description='use websockets if the package is available')
  P_DIRECT=WorkerParameter('decodeData',type=WorkerParameter.T_BOOLEAN,default=False,
                           description='directly use the signalK data for Navigation')
  P_AIS=WorkerParameter('fetchAis',type=WorkerParameter.T_BOOLEAN,default=False,
                        description='fetch AIS data from signalK')
  P_AISPERIOD=WorkerParameter('aisQueryPeriod',type=WorkerParameter.T_NUMBER,default=10,
                              description="query period for AIS (in s)",
                              condition={P_AIS.name:True})
  P_WRITE=WorkerParameter('sendData',type=WorkerParameter.T_BOOLEAN,default=False,
                          description='send data to signalk. This includes waypoint info and notifications')
  P_USERNAME=WorkerParameter('userName',type=WorkerParameter.T_STRING,default='admin',
                             description='the user name to be used for SignalK. Remark: This user must have write permissions!',
                             condition={P_WRITE.name:True})
  P_PASSWORD=WorkerParameter('password',type=WorkerParameter.T_STRING,default='',
                             description='the password for the SignalK server. You can leave this empty '+
                             'for a local access if signalK is installed in the default location',
                             condition={P_WRITE.name:True})
  P_SENDWP=WorkerParameter('sendWp',type=WorkerParameter.T_BOOLEAN,default=True,
                           description='send current waypoint routing data',
                           condition={P_WRITE.name:True})
  P_NOTIFY=WorkerParameter('notifications',type=WorkerParameter.T_BOOLEAN,default=True,
                           description='send and receive notifications',
                           condition={P_WRITE.name:True})
  P_WEBSOCKETRETRY=WorkerParameter('websocketRetry',type=WorkerParameter.T_NUMBER,default=20,
                                   description="retry period (s) for websocket channels to reopen")
  P_UUID=WorkerParameter('uuid',type=WorkerParameter.T_STRING,editable=False,default='avnav')
  P_ALARMRETRY=WorkerParameter('alarmRetry',type=WorkerParameter.T_NUMBER,default=10,
                               editable=False)

  I_AIS='ais'
  I_CHARTS='charts'
  I_WEBSOCKET="websocket"
  I_MAIN='main'
  I_AUTH='authentication'
  I_WRITE='write'
  I_SOURCE='source'
  I_ALARM='alarms'

  @classmethod
  def getConfigParam(cls, child=None):
    return [cls.P_DIRECT,cls.P_AIS,cls.PRIORITY_PARAM_DESCRIPTION.copy(default=NMEAParser.DEFAULT_SOURCE_PRIORITY-10),cls.P_PORT,cls.P_HOST,
            cls.P_AISPERIOD,cls.P_PERIOD,cls.P_CHARTS,cls.P_CHARTPERIOD,cls.P_CHARTPROXYMODE,cls.P_USEWEBSOCKETS, cls.P_MIGRATED,
            cls.P_WRITE,cls.P_USERNAME,cls.P_PASSWORD,cls.P_SENDWP,cls.P_NOTIFY,cls.P_WEBSOCKETRETRY,cls.P_UUID,cls.P_ALARMRETRY]

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return True

  def updateConfig(self, param, child=None):
    rt=super().updateConfig(param, child)
    self.configSequence+=1
    return rt

  USERAPP_NAME="signalk"
  PREFIX='/signalk'
  CHARTPREFIX='charts'

  def registerDeregisterApp(self,register):
    addonhandler=AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
    if addonhandler:
      if not register:
        addonhandler.unregisterAddOn(self.USERAPP_NAME)
        return
      addonhandler.registerAddOn(self.USERAPP_NAME,)

  def stop(self):
    super().stop()
    self.configSequence+=1
  def __init__(self, cfgparam):
    super().__init__(cfgparam)
    self.configSequence=0
    self.sourceName='signalk'
    self.config=None
    self.webSocket=None
    self.writeSocket=None
    self.firstWebsocketMessage=False
    #compute a time offset from our time to the SK time
    #from the first Websocket message
    self.timeOffset=None
    self.selfMap={}
    self.alarmhandler=None
    #we have 2 lists of alarms that are "outstanding", i.e. the action has not yet being reported back
    self.skActivateAlarms={}
    self.skDeactivateAlarms={}
    self.__alarmCondition=threading.Condition()
    self.ownWpAvailable=False #set if there is own WP data in SK



  def migrateConfig(self):
    pluginName='builtin-signalk'
    pluginHandler=self.findHandlerByName(AVNPluginHandler.getConfigName())
    updates={}
    alreadyMigrated=self.P_MIGRATED.fromDict(self.param)
    if self.P_UUID.fromDict(self.param) == self.P_UUID.default:
      updates[self.P_UUID.name]=str(uuid.uuid4())
    if pluginHandler and not alreadyMigrated:
      updates[self.P_MIGRATED.name]=True
      pluginParam=pluginHandler.param.get(pluginName)
      if pluginParam is not None and type(pluginParam) is list:
        pluginParam=pluginParam[0]
        if type(pluginParam) is dict and not self.P_MIGRATED.fromDict(pluginParam):
          pluginHandler.changeChildConfigDict(pluginName,{self.P_MIGRATED.name:True})
          for p in self.getConfigParam():
            if p.name == self.ENABLE_PARAM_DESCRIPTION.name:
              continue
            if p.name == self.P_MIGRATED.name:
              continue
            ov=pluginParam.get(p.name)
            if ov is not None:
              own=self.param.get(p.name)
              if ov != own:
                updates[p.name]=ov
    for p in self.getConfigParam():
      newParam=updates.get(p.name)
      if newParam is None:
        continue
      try:
        updates[p.name]=p.checkValue(updates[p.name],True)
      except:
        del updates[p.name]
    if len(list(updates.keys())) < 1:
      return
    AVNLog.info("migrating signalk config: %s",",".join(list(map(lambda v: str(v[0])+":"+str(v[1]),updates.items()))))
    super().changeMultiConfig(updates)

  def createMappings(self):
    selfMappings={}
    for k in NMEAParser.GPS_DATA:
      sk=k.signalK
      if sk is not None:
        if type(sk) is not list:
          sk=[sk]
        priority=10
        for skKey in sk:
          priority=priority-1
          if priority< 0:
            priority=0
          selfMappings[skKey]=MappingEntry(k.getKey(),k.signalKConversion,self.config.priority*10+priority)
    self.selfMap=selfMappings

  def closeWebSockets(self):
    for sock in [self.webSocket,self.writeSocket]:
      if sock is not None:
        try:
          sock.close()
        except:
          pass
    self.webSocket=None
    self.writeSocket=None

  CHARTHANDLER_PREFIX="signalk"
  def run(self):
    self.navdata.registerKey(self.PATH+".*",'signalK',self.sourceName)
    self.migrateConfig()
    self.alarmhandler=self.findHandlerByName(AVNAlarmHandler.getConfigName())
    charthandler = self.findHandlerByName(AVNChartHandler.getConfigName())
    if charthandler is not None:
      charthandler.registerExternalProvider(self.CHARTHANDLER_PREFIX,self.listCharts)
    while not self.shouldStop():
      self.sourceName=self.getParamValue('name') or 'signalk'
      if self.alarmhandler is not None:
        self.alarmhandler.registerHandler(self)
      self._runI()
      self.deleteInfo(self.I_CHARTS)
      self.deleteInfo(self.I_AIS)
      addonhandler=AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
      if self.alarmhandler is not None:
        self.alarmhandler.deregisterHandler(self)
      if addonhandler:
        addonhandler.unregisterAddOn(self.USERAPP_NAME)
      self.closeWebSockets()
    if charthandler is not None:
      charthandler.registerExternalProvider(self.CHARTHANDLER_PREFIX,None)

  def timeChanged(self):
    with self.__alarmCondition:
      self.skActivateAlarms={}
      self.skDeactivateAlarms={}
    self.configSequence+=1
    self.wakeUp()

  PATH="gps.signalk"

  def decodeSelf(self,path,value):
    mapping=self.selfMap.get(path)
    if mapping is None:
      return
    if mapping.converter is not None:
      value=mapping.converter(value)
    AVNLog.debug("setting %s:%s from SK %s",mapping.localPath,str(value),path)
    self.navdata.setValue(mapping.localPath,value,source=self.sourceName,priority=mapping.priority)

  def setValue(self,path,value):
    self.navdata.setValue(self.PATH+"."+path,value,source=self.sourceName,priority=self.config.priority*10)
    if self.config.decode:
      if not type(value) is dict:
        self.decodeSelf(path,value)
      else:
        for k,v in value.items():
          self.decodeSelf(path+"."+k,v)

  def fetchAisData(self,baseUrl):
    url=baseUrl+'vessels/'
    response=None
    try:
      response=urllib.request.urlopen(url)
      if response is None:
        self.setInfo(self.I_AIS,'no response from %s'%url,WorkerStatus.ERROR)
        return
      data=json.loads(response.read())
      numTargets=0
      now=AVNUtil.utcnow()
      oldest=now-self.navdata.getAisExpiryPeriod()
      for vessel,values in data.items():
        if vessel.find('mmsi') < 0:
          continue
        mmsi=values.get('mmsi')
        if mmsi is None or mmsi=='':
          continue
        aisdata={'mmsi':mmsi}
        newestTs=None
        for k,e in AISPATHMAP.items():
          av=getFromDict(values,e.path)
          if av is None:
            continue
          ts=e.getTimestamp(av)
          if ts is not None:
            if self.timeOffset is not None:
              ts+=self.timeOffset
            if newestTs is None or ts > newestTs:
              newestTs=ts
          value=e.getValue(av)
          if value is not None:
            aisdata[k]=value
        if newestTs is not None and newestTs < oldest:
          AVNLog.debug("ignore ais mmsi=%s - to old",mmsi)
          continue
        numTargets+=1
        AVNLog.debug("adding ais data for %s",mmsi)
        self.navdata.addAisItem(mmsi,aisdata,self.sourceName,self.config.priority*10,now=newestTs)
      self.setInfo(self.I_AIS,'read %d targets'%numTargets,WorkerStatus.NMEA)
    except Exception as ex:
      self.setInfo(self.I_AIS,'error reading ais data from %s:%s'%(url,str(ex)),WorkerStatus.ERROR)

  def sendAlarms(self):
    sequence=self.configSequence
    while(sequence == self.configSequence):
      try:
        if self.config.notify:
          alarms=[]
          now=time.time()
          retry=now - self.P_ALARMRETRY.fromDict(self.param)
          with self.__alarmCondition:
            for k,v in self.skDeactivateAlarms.items():
              if v.shouldDo(retry):
                v.setStart(now)
                alarms.append(v)
            for k,v in self.skActivateAlarms.items():
              if v.shouldDo(retry):
                v.setStart()
                alarms.append(v)
          for alarm in alarms:
            if alarm.on:
              self.sendAlarm(alarm.alarm)
            else:
              self.sendNotificationOff(alarm.alarm)
          self.setInfo(self.I_ALARM,"active",WorkerStatus.NMEA)
        else:
          self.setInfo(self.I_ALARM,"disabled",WorkerStatus.INACTIVE)
      except Exception as e:
        self.setInfo(self.I_ALARM,"error in alarm sender %s"%str(e),WorkerStatus.ERROR)
      with self.__alarmCondition:
        self.__alarmCondition.wait(5)



  def _runI(self):
    sequence=self.configSequence
    self.config=Config(self.param)
    self.createMappings()
    if self.config.aisFetchPeriod == 0:
      self.setInfo(self.I_AIS,'disabled',WorkerStatus.INACTIVE)

    if self.config.chartQueryPeriod == 0:
      self.setInfo(self.I_CHARTS,'disabled',WorkerStatus.INACTIVE)
    if self.config.write:
      self.setInfo(self.I_SOURCE,self.config.skSource,WorkerStatus.NMEA)
    else:
      self.setInfo(self.I_SOURCE,self.config.skSource,WorkerStatus.INACTIVE)

    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    AVNLog.info("started with host %s port %d, period %d"
                 %(self.config.skHost,self.config.port,self.config.period))
    baseUrl="http://%s:%d/signalk"%(self.config.skHost,self.config.port)

    addonhandler=AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
    if addonhandler:
      if self.config.skHost == "localhost":
        addonhandler.registerAddOn(self.USERAPP_NAME,"http://$HOST:%s"%self.config.port,"signalk.svg")
      else:
        addonhandler.registerAddOn(self.USERAPP_NAME,"http://%s:%s" %
                                              (self.config.skHost,self.config.port), "images/signalk.svg")
    router=None
    if self.config.write:
      router=self.findHandlerByName(AVNRouter.getConfigName())
    errorReported=False
    sendAlarmThread=threading.Thread(target=self.sendAlarms,daemon=True,name="SKSendAlarms")
    sendAlarmThread.start()
    self.setInfo(self.I_MAIN,"connecting at %s" % baseUrl,WorkerStatus.STARTED)
    while sequence == self.configSequence:
      expiryPeriod=self.navdata.getExpiryPeriod()
      apiUrl=None
      websocketUrl=None
      self.closeWebSockets()
      while apiUrl is None :
        if sequence != self.configSequence:
          return
        self.connected=False
        responseData=None
        try:
          response=urllib.request.urlopen(baseUrl)
          if response is None:
            raise Exception("no response on %s"%baseUrl)
          responseData=json.loads(response.read())
          if responseData is None:
            raise Exception("no response on %s"%baseUrl)
          #{"endpoints":{"v1":{"version":"1.20.0","signalk-http":"http://localhost:3000/signalk/v1/api/","signalk-ws":"ws://localhost:3000/signalk/v1/stream","signalk-tcp":"tcp://localhost:8375"}},"server":{"id":"signalk-server-node","version":"1.20.0"}}
          endpoints = responseData.get('endpoints')
          if endpoints is None:
            raise Exception("no endpoints in response to %s"%baseUrl)
          for k in list(endpoints.keys()):
            ep=endpoints[k]
            if apiUrl is None:
              apiUrl=ep.get('signalk-http')
              if apiUrl is not None:
                errorReported=False
            if websocketUrl is None:
              websocketUrl=ep.get("signalk-ws")
        except:
          if not errorReported:
            self.setInfo(self.I_MAIN, "unable to connect at %s" % baseUrl,WorkerStatus.ERROR)
            AVNLog.info("unable to connect at url %s: %s" ,baseUrl, sys.exc_info()[0])
            errorReported=True
          self.wait(1)
          continue
        if apiUrl is None:
          self.wait(1)
        else:
          AVNLog.info("found api url %s",apiUrl)
      selfUrl=apiUrl+"vessels/self"
      self.connected = True
      useWebsockets = self.P_USEWEBSOCKETS.fromDict(self.param) and hasWebsockets and websocketUrl is not None
      if useWebsockets:
        if self.config.period < expiryPeriod:
          self.config.period=expiryPeriod
        AVNLog.info("using websockets at %s, querying with period %d", websocketUrl,self.config.period)
      else:
        self.setInfo(self.I_WEBSOCKET,'disabled',WorkerStatus.INACTIVE)
      try:
        lastChartQuery=0
        lastQuery=0
        lastWebsocket=0
        lastWriteSocket=0
        first=True # when we newly connect, just query everything once
        token=None
        errorReported=False
        lastAisFetch=0
        while self.connected and self.configSequence == sequence:
          now = time.time()
          #handle time shift backward
          if lastChartQuery > now:
            lastChartQuery=0
          if lastQuery > now:
            lastQuery=0
          if lastAisFetch > now:
            lastAisFetch=0
          if lastWebsocket > now:
            lastWebsocket=0
          if lastWriteSocket > now:
            lastWriteSocket=0
          if useWebsockets:
            if self.webSocket is None or not self.webSocket.isConnected():
              if (now-lastWebsocket) > self.config.wsRetry:
                if self.webSocket is None:
                  self.webSocket=WebSocketHandler(InfoSetter(self.I_WEBSOCKET,self),
                                                  websocketUrl,self.webSocketMessage)
                self.webSocket.open()
                lastWebsocket=now
          if self.config.write:
            if not useWebsockets:
              self.setInfo(self.I_WRITE,"websockets disabled",WorkerStatus.INACTIVE)
            else:
              if token is None or self.writeSocket is None or not self.webSocket.isConnected():
                if (now - lastWriteSocket) > self.config.wsRetry:
                  lastWriteSocket=now
                  if token is None:
                    token=self.getAuthentication(apiUrl)
                  if token is None:
                    self.setInfo(self.I_WRITE,"unable to get token",WorkerStatus.ERROR)
                  else:
                    url=websocketUrl+"?subscribe=none&token="+urllib.parse.quote(token)
                    if self.writeSocket is not None:
                      self.writeSocket.close()
                    self.writeSocket=WebSocketHandler(InfoSetter(self.I_WRITE,self),url,
                                                      self.writeChannelMessage)
                    self.writeSocket.open()

            if self.config.sendWp and self.writeSocket is not None and self.writeSocket.isConnected():
              self.sendCurrentLeg(router)
          if (now - lastQuery) > self.config.period or first:
            first=False
            lastQuery=now
            response=None
            try:
              response=urllib.request.urlopen(selfUrl)
              if response is None:
                self.skCharts = []
                self.setInfo(self.I_CHARTS,"unable to fetch from %s: None"%selfUrl,WorkerStatus.ERROR)
                if not errorReported:
                  AVNLog.error("unable to fetch from %s: None", selfUrl)
                  errorReported=True
            except Exception as e:
              self.skCharts=[]
              self.setInfo(self.I_CHARTS,"unable to fetch from %s: %s"%(selfUrl,str(e)),WorkerStatus.ERROR)
              if not errorReported:
                AVNLog.error("unable to fetch from %s:%s",selfUrl,str(e))
                errorReported=True
            if response is not None:
              errorReported=False
              if not first:
                self.setInfo(self.I_MAIN, "connected at %s" % apiUrl,WorkerStatus.NMEA)
              data=json.loads(response.read())
              AVNLog.debug("read: %s",json.dumps(data))
              self.storeData(data,None,self.config.priority)
              name=data.get('name')
              if name is not None:
                self.setValue("name",name)
          else:
            pass
          if self.config.chartQueryPeriod > 0 and lastChartQuery < (now - self.config.chartQueryPeriod):
            lastChartQuery=now
            try:
              self.queryCharts(apiUrl,self.config.port)
            except Exception as e:
              self.skCharts=[]
              AVNLog.debug("exception while reading chartlist %s",traceback.format_exc())
          if self.config.aisFetchPeriod > 0 and lastAisFetch < (now - self.config.aisFetchPeriod):
            try:
              self.fetchAisData(apiUrl)
            except Exception as e:
              self.setInfo(self.I_AIS,'error in fetch %s'%str(e),WorkerStatus.ERROR)
            lastAisFetch=now
          sleepTime=1 if self.config.period > 1 else self.config.period
          self.wait(sleepTime)
        self.closeWebSockets()

      except:
        AVNLog.error("error when fetching from signalk %s: %s",apiUrl,traceback.format_exc())
        self.setInfo(self.I_MAIN,"error when fetching from signalk %s"%(apiUrl),WorkerStatus.ERROR)
        self.connected=False
        if sequence != self.configSequence:
          return
        self.wait(5)

  def checkOutdated(self,timestampStr):
    if timestampStr is None:
      return False
    timeStamp=timeToTs(timestampStr)
    expiryPeriod=self.navdata.getExpiryPeriod()
    oldest=time.time()-expiryPeriod
    if self.timeOffset is not None:
      oldest+=self.timeOffset
    if timeStamp < oldest:
      return True
    return False

  def enqueueAlarmMessage(self,name,on):
    with self.__alarmCondition:
      alarms=None
      if on:
        alarms=self.skActivateAlarms
      else:
        alarms=self.skDeactivateAlarms
      existing=alarms.get(name)
      if existing:
        return
      else:
        alarms[name]=AlarmQueueEntry(name,on)
      self.__alarmCondition.notifyAll()

  def acknowledgeAlarm(self,name,on):
    with self.__alarmCondition:
      alarms=self.skActivateAlarms if on else self.skDeactivateAlarms
      if alarms.get(name):
        try:
          del alarms[name]
        except:
          pass
        return True
      return False

  def hasOpenAlarm(self,name,on):
    with self.__alarmCondition:
      alarms=self.skActivateAlarms if on else self.skDeactivateAlarms
      return alarms.get(name) is not None

  def handleNotification(self, path, value,source):
    if not self.config.notify:
      return
    ownAlarm=self.getSKAlarm(path)
    if ownAlarm is None:
      return
    if source is None:
      return
    if self.alarmhandler is None:
      return
    self.acknowledgeAlarm(ownAlarm, value is not None)
    running=self.alarmhandler.isAlarmActive(ownAlarm)
    if self.isOwnSource(source):
      if running and value is None:
        #seems that the last active did not reach SK
        self.enqueueAlarmMessage(ownAlarm,True)
      if not running and value is not None:
        self.enqueueAlarmMessage(ownAlarm,False)
      return
    setKey=ownAlarm+":"+source
    if value is None:
      #maybe race - we are just waiting for the ack of our activate
      if self.hasOpenAlarm(ownAlarm,True):
        return
      if running:
        self.alarmhandler.stopAlarm(ownAlarm,caller=self)
        return
    else:
      #we have enqueued an alarm off and are still waiting
      if self.hasOpenAlarm(ownAlarm,False):
        return
      if not running:
        category=None
        if type(value) is dict:
          state=value.get('state')
          if state == 'emergency':
            category=AlarmConfig.C_CRITICAL
          if state == 'normal':
            category=AlarmConfig.C_INFO
        self.alarmhandler.startAlarm(ownAlarm,caller=self,info=setKey,defaultCategory=category)

  def webSocketMessage(self,data):
    to=self.webSocket.getTimeOffset()
    if to is not None:
      self.timeOffset=to
    try:
      updates=data.get('updates')
      if updates is None:
        return
      for update in updates:
        values=update.get('values')
        timestamp=update.get('timestamp')
        source=update.get('$source')
        if values is None:
          continue
        if self.checkOutdated(timestamp):
          AVNLog.debug("ignore outdated delta, ts=%s",timestamp)
          continue
        for item in values:
          value=item.get('value')
          path=item.get('path')
          if  path is not None:
            if path.startswith("notifications"):
              self.handleNotification(path, value,source)
            else:
              if value is not None:
                self.setValue(path,value)
    except:
      AVNLog.error("error decoding %s:%s",str(data),traceback.format_exc())
      try:
        self.webSocket.close()
      except:
        pass
      self.webSocket=None
      self.connected=False
  def writeChannelMessage(self,data):
    pass
  def buildUpdateRequest(self,values):
    uvalues=[]
    for k,v in values.items():
      uvalues.append({
        'path':k,
        'value':v
      })
    update={
      'source':{
        'label':'avnav',
        'talker':self.config.skSource,
        'type':'avnav'
      },
      '$source':self.config.skSource,
      'values':uvalues
    }
    rt={
      'context':'vessels.self',
      'updates':[update]
    }
    return rt

  def getLegData(self,wpData: WpData):
    PRFX='navigation.courseGreatCircle'
    rt={
      PRFX+'.nextPoint.position':{
        'latitude':wpData.lat,
        'longitude':wpData.lon,
      } if wpData.validData else None,
      PRFX+'.previousPoint.position':{
        'latitude':wpData.fromLat,
        'longitude':wpData.fromLon,
      } if (wpData.fromLat is not None and wpData.fromLon is not None) else None,
      PRFX+'.nextPoint.distance':wpData.distance,
      PRFX+'.nextPoint.bearingTrue':AVNUtil.deg2rad(wpData.dstBearing),
      PRFX+'.crossTrackError':wpData.xte,
      PRFX+'.nextPoint.arrivalCircle':wpData.approachDistance,
      PRFX+'.bearingTrackTrue':AVNUtil.deg2rad(wpData.bearing)
    }
    return rt
  def sendCurrentLeg(self,router : AVNRouter):
    try:
      if router is None:
        return
      wpData=router.getWpData()
      if not wpData.validData and not self.ownWpAvailable:
        return
      self.ownWpAvailable=wpData.validData
      update=self.buildUpdateRequest(self.getLegData(wpData))
      self.writeSocket.send(json.dumps(update))

    except Exception as e:
      AVNLog.debug("error sending current leg %",str(e))

  def isOwnSource(self,src):
    if src is None:
      return False
    return src.endswith('.'+self.config.skSource)
  def checkOwnItems(self,node,prefix):
    if not '$source' in node and not 'values' in node:
      return
    own=None
    value=None
    if self.isOwnSource(node.get('$source'))  and 'value' in node:
      own=True
      value=node.get('value')
    elif 'values' in node:
      values=node['values']
      for k,v in values.items():
        if self.isOwnSource(k):
          own=True
          value=v.get('value')
          break
    if not own:
      return
    wpData=self.getLegData(WpData())
    for k,v in wpData.items():
      if k == prefix and value is not None:
        self.ownWpAvailable=True
        break

  ALARMS={
    'mob': {
      'path':'mob',
      'state':'emergency',
      'method':['visual','sound'],
      'message':'man overboard'
    }
  }
  NPRFX='notifications.'
  def getSKAlarm(self,skpath):
    for k,v in self.ALARMS.items():
      if (self.NPRFX+v['path']) == skpath:
        return k
    if not skpath.startswith(self.NPRFX):
      return None
    return "sk:"+skpath[len(self.NPRFX):]
  def sendAlarm(self,alarm):
    data=self.ALARMS.get(alarm)
    if not data:
      return False
    if self.writeSocket is None or not self.writeSocket.isConnected():
      return False
    skdata=data.copy()
    del skdata['path']
    update=self.buildUpdateRequest({
      self.NPRFX+data['path']:skdata
    })
    self.writeSocket.send(json.dumps(update))
    return True

  def sendNotificationOff(self,alarm):
    if self.writeSocket is None or not self.writeSocket.isConnected():
      return False
    update=None
    data=self.ALARMS.get(alarm)
    if data:
      update=self.buildUpdateRequest({
        self.NPRFX+data['path']:None
      })
    else:
      if alarm.startswith('sk:'):
        alarm=alarm[3:]
        update=self.buildUpdateRequest({
          self.NPRFX+alarm:None
        })
    self.writeSocket.send(json.dumps(update))
    return True

  def handleAlarm(self,name,on,info):
    if not self.ENABLE_PARAM_DESCRIPTION.fromDict(self.param) or not self.config.notify:
      return
    if on:
      if info is None:
        #own alarm created by AvNav
        self.enqueueAlarmMessage(name,True)
    else:
      self.enqueueAlarmMessage(name,False)


  def queryCharts(self,apiUrl,port):
    charturl = apiUrl + "resources/charts"
    try:
      chartlistResponse = urllib.request.urlopen(charturl)
    except Exception as e:
      self.setInfo(self.I_CHARTS,'unable to read charts: %s'%str(e),WorkerStatus.ERROR)
      self.skCharts=[]
      raise
    if chartlistResponse is None:
      self.setInfo(self.I_CHARTS,'no charts',WorkerStatus.STARTED)
      self.skCharts = []
      return
    chartlist = json.loads(chartlistResponse.read())
    newList = []
    baseUrl = self.PREFIX+"/"+self.CHARTPREFIX+"/"
    for chart in list(chartlist.values()):
      name = chart.get('identifier')
      if name is None:
        continue
      url = baseUrl + urllib.parse.quote(name)
      bounds=chart.get('bounds')
      #bounds is upperLeftLon,upperLeftLat,lowerRightLon,lowerRightLat
      #          minlon,      maxlat,      maxlon,       minlat
      if bounds is None:
        bounds=[-180,85,180,-85]
      if bounds[1] < bounds[3]:
        #it seems that the plugin does not really provide the BB correctly...
        tmp=bounds[3]
        bounds[3]=bounds[1]
        bounds[1]=tmp
      chartInfo = {
        'name': name,
        'url': url,
        'charturl': url,
        'sequence': self.configSequence,
        'canDelete': False,
        'icon': "images/signalk.svg",
        'upzoom': True,
        'internal': {
          'url': "http://%s:%d" % (self.config.skHost, port) + chart.get('tilemapUrl'),
          'minlon': bounds[0],
          'maxlat': bounds[1],
          'maxlon': bounds[2],
          'minlat': bounds[3],
          'format': chart.get('format') or 'png',
          'bounds': chart.get('bounds'),
          'minzoom': chart.get('minzoom'),
          'maxzoom': chart.get('maxzoom')
        }
      }
      newList.append(chartInfo)
    self.skCharts = newList
    self.setInfo(self.I_CHARTS,'read %d charts'%len(newList),WorkerStatus.NMEA)
  def storeData(self,node,prefix,priority):
    if prefix is None and 'notifications' in node:
      item = node.get('notifications')
      if item is not None:
        for k,v in item.items():
          self.handleNotification('notifications.'+k, v.get('value'),v.get('$source'))
    try:
      self.checkOwnItems(node,prefix)
    except Exception as e:
      AVNLog.debug("exception checking own items %s",traceback.format_exc())
    if 'value' in node:
      if self.checkOutdated(node.get('timestamp')):
        AVNLog.debug('ignore outdated value %s',prefix)
        return
      self.setValue(prefix, node.get('value'))
      return
    for key, item in list(node.items()):

      if isinstance(item,dict):
        newPrefix=prefix
        if newPrefix is None:
          newPrefix=key
        else:
          newPrefix=newPrefix+"."+key
        self.storeData(item,newPrefix,priority)

  def getLocalToken(self,user):
    allowedTypes=['readwrite','admin']
    cfgPath=os.path.join(os.path.expanduser('~'),'.signalk','security.json')
    AVNLog.debug("trying to get token for %s in %s",user,cfgPath)
    if not os.path.exists(cfgPath):
      raise Exception("signalK security config %s not found"%cfgPath)
    with open(cfgPath,'r') as ch:
       secData=json.load(ch)
       if not 'secretKey' in secData:
         raise Exception("secretKey not found in %s"%cfgPath)
       secretKey=secData.get('secretKey')
       users=secData.get('users')
       if users is None:
         raise Exception("no users list found in %s"%cfgPath)
       if type(users) is not list:
         raise Exception("invalid type of users list in %s"%cfgPath)
       found=False
       for us in users:
         if us.get('name') == user:
           found = True
           if us.get('type') not in allowedTypes:
             raise Exception("user %s has no write permissions"%user)
           break
       if not found:
         raise Exception("user %s not found in %s"%(user,cfgPath))
       token=jwt(user,secretKey)
       AVNLog.debug("created token %s for user %s",token,user)
       return token

  def getAuthentication(self,baseUrl):
    isLocal= self.config.isLocal
    lString='locally' if isLocal else 'on host %s'%self.config.skHost
    user=self.config.user
    if self.config.password == '' and not isLocal:
      self.setInfo(self.I_AUTH,"must provide a password for non local auth",WorkerStatus.ERROR)
      return
    if self.config.password == '':
      #trying local
      try:
        token=self.getLocalToken(user)
        if token is not None:
          self.setInfo(self.I_AUTH,"successfully authenticated locally %s"%user,WorkerStatus.NMEA)
          return token
        self.setInfo(self.I_AUTH,"unable to get local token for %s"%user,WorkerStatus.ERROR)
        return
      except Exception as ex:
        self.setInfo(self.I_AUTH,"error when trying to get local auth for %s:%s"%(user,str(ex)),WorkerStatus.ERROR)
        return
    self.setInfo(self.I_AUTH,"trying to authenticate %s %s"%(user,lString),WorkerStatus.STARTED)
    if baseUrl.endswith('/'):
      baseUrl=baseUrl[0:-1]
    if baseUrl.endswith('/api'):
      baseUrl=baseUrl[0:-4]
    url=baseUrl+'/auth/login'
    try:
      req = urllib.request.Request(url,method='POST')
      req.add_header('Content-Type', 'application/json')
      body={'username':user,'password':self.config.password}
      jsondata = json.dumps(body)
      jsondataasbytes = jsondata.encode('utf-8')   # needs to be bytes
      req.add_header('Content-Length', str(len(jsondataasbytes)))
      response = urllib.request.urlopen(req, jsondataasbytes)
      data=response.read()
      decoded=json.loads(data)
      token=decoded.get('token')
      if token is not None:
        self.setInfo(self.I_AUTH,"successfully retrieved token for %s"%user,WorkerStatus.NMEA)
        return token
      raise Exception(decoded.get('message') or 'unknown result')
    except Exception as e:
      self.setInfo(self.I_AUTH,"unable to login %s : %s"%(user,str(e)),WorkerStatus.ERROR)


  def listCharts(self,hostip):
    AVNLog.debug("listCharts %s"%hostip)
    if not self.connected:
      AVNLog.debug("not yet connected")
      return []
    try:
      rt=[]
      items=self.skCharts+[]
      for item in items:
        cp=item.copy()
        del cp['internal']
        rt.append(cp)
      return rt
    except:
      AVNLog.debug("unable to list charts: %s"%traceback.format_exc())
      return []

  def getHandledCommands(self):
    return {'path': self.PREFIX+"/"+self.CHARTPREFIX}

  def handleApiRequest(self, type, command, requestparam, **kwargs):
    handler = kwargs.get('handler')
    if type == 'path':
      prefix=self.PREFIX+"/"+self.CHARTPREFIX
      if not command.startswith(prefix+"/"):
        raise Exception("unknown path %s"%command)
      path=command[len(prefix)+1:]
      return self.handleChartRequest(path,handler)
    raise Exception("unable to handle user request %s"%(type))

  AVNAV_XML="""<?xml version="1.0" encoding="UTF-8" ?>
  <TileMapService version="1.0.0" >
   <Title>%(title)s</Title>
   <TileMaps>
     <TileMap 
       title="%(title)s" 
       href="%(url)s"
       minzoom="%(minzoom)s"
       maxzoom="%(maxzoom)s"
       projection="EPSG:4326">
             <BoundingBox minlon="%(minlon)f" minlat="%(minlat)f" maxlon="%(maxlon)f" maxlat="%(maxlat)f" title="layer"/>
       <TileFormat width="256" height="256" mime-type="x-%(format)s" extension="%(format)s" />
    </TileMap>       
   </TileMaps>
 </TileMapService>

  """
  def handleChartRequest(self,url,handler):
    '''
    handle api requests
    @param url:
    @param handler:
    @return:
    '''

    parr=url.split("/")
    if len(parr) < 2:
      raise Exception("invalid chart url %s"%url)
    chartName = parr[0]
    chart=None
    for chartinfo in self.skCharts:
      if chartinfo.get('name')==chartName:
        chart=chartinfo
        break
    if chart is None:
      raise Exception("chart %s not found"%chartName)
    if parr[1] == "sequence":
      sData={'status':'OK','sequence':self.configSequence}
      handler.sendNavResponse(json.dumps(sData))
      return
    if parr[1] == "avnav.xml":
      requestHost = handler.headers.get('host')
      requestHostAddr = requestHost.split(':')[0]
      url='tiles'
      doProxy=False
      if self.config.proxyMode=='always' or ( self.config.proxyMode=='sameHost' and not self.config.isLocal):
        doProxy=True
      if not doProxy:
        #no proxying, direct access to sk for charts
        url=chart['internal']['url'].replace('localhost',requestHostAddr)
      param=chart['internal'].copy()
      param.update({
        'title':chart['name'],
        'url':url,
      })
      data=self.AVNAV_XML%param
      handler.send_response(200)
      handler.send_header("Content-type", "text/xml")
      handler.send_header("Content-Length", len(data))
      handler.send_header("Last-Modified", handler.date_time_string())
      handler.end_headers()
      handler.wfile.write(data.encode('utf-8'))
      return True
    if parr[1] == "sequence":
      return {'status':'OK','sequence':0}
    if len(parr) < 5:
      raise Exception("invalid request to chart %s: %s" % (chartName, url))
    replaceV={'z':parr[2],
              'x':parr[3],
              'y':re.sub("\..*","",parr[4])}
    skurl=chart['internal']['url']
    for k in list(replaceV.keys()):
      skurl=skurl.replace("{"+k+"}",replaceV[k])
    try:
      tile = urllib.request.urlopen(skurl)
      if tile is None:
        return None
      tileData = tile.read()
    except:
      AVNLog.debug("unable to read tile from sk %s:%s"%(url,traceback.format_exc()))
      return
    handler.send_response(200)
    handler.send_header("Content-type", "image/%s"%chart['internal']['format'])
    handler.send_header("Content-Length", len(tileData))
    handler.send_header("Last-Modified", handler.date_time_string())
    handler.end_headers()
    handler.wfile.write(tileData)
    return True

avnav_handlerList.registerHandler(AVNSignalKHandler)






