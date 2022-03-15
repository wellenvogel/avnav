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
#a dummy worker class to read some basic configurations
import datetime
import socket
import struct
import threading
import time
import traceback

import avnav_handlerList
from avnav_store import AVNStore
from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
from avnav_util import AVNLog, AVNUtil


class TimeSource(object):
  SOURCE_GPS="gps"
  SOURCE_NTP="ntp"
  def __init__(self,name,fetchFunction):
    self.lastSet=0
    self.lastValid=0
    self.externalTs=None
    self.name=name
    self.fetchFunction=fetchFunction

  def equal(self,other):
    if other is None:
      return False
    return self.name == other.name
  def isValid(self):
    return self.externalTs is not None
  def fetch(self):
    wasValid=self.externalTs is not None
    self.externalTs=None
    externalTs=self.fetchFunction()
    timestamp=time.time()
    self.externalTs=externalTs
    self.lastSet=timestamp
    if externalTs is not None:
      if not wasValid:
        AVNLog.info("new %s time: %s",self.name,self.formatTs(externalTs))
      self.lastValid=timestamp
    else:
      if wasValid:
        AVNLog.info("lost %s time",self.name)
    return self.externalTs
  def getCurrent(self):
    return self.externalTs
  def resetTime(self,timestamp):
    self.lastSet=timestamp
    self.lastValid=timestamp
    self.externalTs=None
  @classmethod
  def formatTs(cls,ts):
    if ts is None:
      return "<none>"
    return datetime.datetime.utcfromtimestamp(ts).isoformat()


def getNTPTime(host = "pool.ntp.org"):
  port = 123
  buf = 1024
  address = (host,port)
  msg = '\x1b' + 47 * '\0'

  # reference time (in seconds since 1900-01-01 00:00:00)
  TIME1970 = 2208988800 # 1970-01-01 00:00:00
  try:
    # connect to server
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as client:
      client.settimeout(5)
      client.sendto(msg.encode('utf-8'), address)
      msg, address = client.recvfrom( buf )
      t = struct.unpack( "!12I", msg )[10]
      t -= TIME1970
      return t
  except:
    return

class AVNBaseConfig(AVNWorker):
  PARAM_NTP= WorkerParameter('ntphost', 'pool.ntp.org',type=WorkerParameter.T_STRING,
                             description='ntp server to check if no time is received from gps (set to empty to disable ntp)')
  PARAM_SWITCHTIME=WorkerParameter('switchtime',60,type=WorkerParameter.T_NUMBER,
                                   description="time (sec) to wait before switching from gps time to ntp time and back")
  def __init__(self,param):
    AVNWorker.__init__(self,param)
    self.param=param
    self.version=None
    self.startupError=None
    self.configInfo=None
  @classmethod
  def getConfigName(cls):
    return "AVNConfig"

  @classmethod
  def autoInstantiate(cls):
    return True
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return [
            WorkerParameter('expiryTime',30,type=WorkerParameter.T_FLOAT,
                            description="expiry in seconds for NMEA data"),
            WorkerParameter('aisExpiryTime',1200,type=WorkerParameter.T_FLOAT,
                            description="expiry time in seconds for AIS data"),
            WorkerParameter('ownMMSI','',type=WorkerParameter.T_NUMBER,
                            description='if set - do not store AIS messages with this MMSI'),
            WorkerParameter('debugToLog', False,type=WorkerParameter.T_BOOLEAN,editable=False),
            WorkerParameter('maxtimeback',5,type=WorkerParameter.T_FLOAT,
                            description='how many seconds we allow time to go back before we reset'),
            WorkerParameter('settimecmd','',editable=False,description='if set, use this to set the system time'),
            WorkerParameter('systimediff',5,type=WorkerParameter.T_FLOAT,
                            description='how many seconds do we allow the system time to be away from gps/ntp'),
            WorkerParameter('settimeperiod', 3600,type=WorkerParameter.T_FLOAT,
                            description='minimal interval (sec) for setting the system time'),
            cls.PARAM_NTP,
            cls.PARAM_SWITCHTIME
    ]
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def canEdit(cls):
    return True

  def updateConfig(self, param, child=None):
    super().updateConfig(param, child)
    if self.navdata is not None:
      self.navdata.updateBaseConfig(
        self.getFloatParam('expiryTime'),
        self.getFloatParam('aisExpiryTime'),
        self.getParamValue('ownMMSI')
      )

  def startInstance(self, navdata):
    if self.startupError is not None:
      self.setInfo("startup",self.startupError,WorkerStatus.ERROR)
    if self.configInfo is not None:
      self.setInfo("config",self.configInfo,WorkerStatus.STARTED)
    super().startInstance(navdata)


  def fetchGpsTime(self):
    try:
      lat=self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS+".lat")
      lon = self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS + ".lon")
      curGpsTime=self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS + ".time")
      if (lat is None or lon is None or curGpsTime is None):
        return None
      dt=AVNUtil.gt(curGpsTime)
      timestamp = dt.replace(tzinfo=datetime.timezone.utc).timestamp()
      return timestamp
    except Exception as e:
      AVNLog.error("Exception when getting curGpsData: %s",traceback.format_exc())
      return None

  def fetchNtpTime(self):
    host=AVNBaseConfig.PARAM_NTP.fromDict(self.param)
    if host is None or host == '':
      return
    ts=getNTPTime(host)
    return ts

  TIME_CHILD="settime"
  SYSTIME_CHILD="systemtime"
  GPSPOS_CHILD="position"
  GPSTIME_CHILD="gpstime"
  def run(self):
    self.setInfo('main','running',WorkerStatus.NMEA)
    self.setInfo(self.TIME_CHILD,'disabled',WorkerStatus.INACTIVE)
    self.setInfo(self.GPSPOS_CHILD,'no valid position',WorkerStatus.ERROR)
    hasFix=False
    lastchecktime=0
    gpsTime=TimeSource(TimeSource.SOURCE_GPS,self.fetchGpsTime)
    ntpTime=TimeSource(TimeSource.SOURCE_NTP,self.fetchNtpTime)
    lastSource=None # type: TimeSource
    lastutc=time.time()
    startupTime=lastutc
    timeFalse=False
    while not self.shouldStop():
      settimeperiod=self.getIntParam('settimeperiod')
      switchtime=self.PARAM_SWITCHTIME.fromDict(self.param)
      self.wait(1)
      #query the data to get old entries being removed
      curutc=time.time()
      self.setInfo(self.SYSTIME_CHILD,"UTC: %s"%datetime.datetime.utcfromtimestamp(curutc).isoformat(),WorkerStatus.RUNNING)
      delta=curutc-lastutc
      allowedBackTime=self.getIntParam('maxtimeback')
      if delta < -allowedBackTime and allowedBackTime != 0:
        AVNLog.warn("time shift backward (%d seconds) detected, deleting all entries ",delta)
        self.navdata.reset()
        #if the time is shifting all condition waits must
        #be notified...
        for h in AVNWorker.allHandlers:
          try:
            h.timeChanged()
          except:
            pass
          try:
            h.wakeUp()
          except:
            pass
        hasFix=False
      lastutc=curutc
      lat=None
      lon=None
      try:
        lat=self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS+".lat")
        lon = self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS + ".lon")
      except Exception as e:
        AVNLog.error("Exception when getting curGpsData: %s",traceback.format_exc())
      if ( lat is not None) and (lon is not None):
        #we have some position
        if not hasFix:
          AVNLog.info("new GPS fix lat=%f lon=%f",lat,lon)
          hasFix=True
        self.setInfo(self.GPSPOS_CHILD,"GPS fix lat=%f lon=%f"%(lat,lon),WorkerStatus.NMEA)
      else:
        self.setInfo(self.GPSPOS_CHILD,'no valid position',WorkerStatus.ERROR)
        if hasFix:
          AVNLog.warn("lost GPS fix")
        hasFix=False
      try:
        allowedDiff=self.getIntParam('systimediff')
        settimecmd=self.getStringParam('settimecmd')
        if allowedDiff != 0 and settimecmd != "":
          currentStatus=self.status.get(self.TIME_CHILD)
          if not currentStatus or currentStatus.status == WorkerStatus.INACTIVE:
            self.setInfo(self.TIME_CHILD,"checking",WorkerStatus.RUNNING)
          checkSource=None
          if gpsTime.fetch():
            self.setInfo(self.GPSTIME_CHILD,
                         "UTC: %s"%datetime.datetime.utcfromtimestamp(gpsTime.getCurrent()).isoformat(),WorkerStatus.NMEA)
            #valid GPS time
            if gpsTime.equal(lastSource):
              if timeFalse:
                if curutc > (lastchecktime + switchtime):
                  checkSource=gpsTime
              else:
                if curutc > (lastchecktime + settimeperiod):
                  checkSource=gpsTime
            else:
              #last source was not GPS
              #immediately use the GPS
              checkSource=gpsTime
          else:
            self.setInfo(self.GPSTIME_CHILD,"no valid time",WorkerStatus.ERROR)
            #no valid GPS time
            if gpsTime.equal(lastSource):
              #change source
              #wait at min switchtime after last check AND switschtime after GPS is going invalid
              #this should help if the GPS becomes invalid for some time
              if curutc > (lastchecktime + switchtime) and curutc > (gpsTime.lastValid + switchtime):
                if ntpTime.fetch():
                  checkSource=ntpTime
            else:
              #we are still on NTP or lastSource was None (startup)
              if timeFalse:
                if curutc > (lastchecktime + switchtime):
                  if ntpTime.fetch():
                    checkSource=ntpTime
              else:
                #startup without gps or repeated ntp
                if curutc > (lastchecktime + settimeperiod) and curutc > (startupTime + switchtime):
                  if ntpTime.fetch():
                    checkSource=ntpTime
          if checkSource is not None:
            now=time.time()
            AVNLog.debug("checking time from %s(%s) against local %s",checkSource.name,
                         TimeSource.formatTs(checkSource.getCurrent()),
                         TimeSource.formatTs(now)
                         )
            lastSource=checkSource
            lastchecktime=now
            if abs(now - checkSource.getCurrent()) > allowedDiff:
              timeFalse=True
              AVNLog.warn("UTC time diff detected system=%s, %s=%s, lastcheck=%s, setting system time",
                          TimeSource.formatTs(now),
                          checkSource.name,
                          TimeSource.formatTs(checkSource.externalTs),
                          TimeSource.formatTs(lastchecktime))
              curts=datetime.datetime.utcfromtimestamp(checkSource.getCurrent())
              newtime="%02d%02d%02d%02d%04d.%02d"%(curts.month,curts.day,curts.hour,curts.minute,curts.year,curts.second)
              cmd=[settimecmd,newtime]
              self.setInfo(self.TIME_CHILD,
                           "setting UTC to %s from %s"%(curts.isoformat(),checkSource.name),
                           WorkerStatus.STARTED)
              AVNLog.info("starting command %s"," ".join(cmd))
              cmdThread=threading.Thread(target=AVNUtil.runCommand,args=(cmd,"setTime"))
              cmdThread.start()
              cmdThread.join(20)
              curutc=time.time()
              newdiff=abs((curutc-checkSource.getCurrent()))
              if newdiff > (allowedDiff*2):
                AVNLog.error("unable to set system time to %s, %d still above difference",newtime,newdiff)
                self.setInfo(self.TIME_CHILD,
                             "unable to set system time to UTC %s from %s at UTC %s"%
                             (curts.isoformat(),checkSource.name,datetime.datetime.utcfromtimestamp(curutc).isoformat()),
                             WorkerStatus.ERROR)
              else:
                self.setInfo(self.TIME_CHILD,
                             "last setting UTC to %s from %s"%(curts.isoformat(),checkSource.name),
                             WorkerStatus.NMEA)
                AVNLog.info("setting system time to %s succeeded",newtime)
                timeFalse=False
              lastchecktime=curutc
              startupTime=0
              gpsTime.resetTime(curutc)
              ntpTime.resetTime(curutc)
              for h in AVNWorker.allHandlers:
                try:
                  h.timeChanged()
                except:
                  pass
                try:
                  h.wakeUp()
                except:
                  pass
            else:
              self.setInfo(self.TIME_CHILD,"Last check ok at UTC: %s from %s"%(
                datetime.datetime.utcfromtimestamp(checkSource.getCurrent()).isoformat(),
                checkSource.name
              ),WorkerStatus.NMEA)
        else:
          self.setInfo(self.TIME_CHILD,"disabled",WorkerStatus.INACTIVE)
      except Exception as e:
        self.setInfo("main","Exception in main loop %s",str(e))
        self.wait(10)

  def setVersion(self,version):
    self.version=version
  def getVersion(self):
    return self.version
  def setStartupError(self,error):
    self.startupError=error
  def setConfigInfo(self,info):
    self.configInfo=info

avnav_handlerList.registerHandler(AVNBaseConfig)
