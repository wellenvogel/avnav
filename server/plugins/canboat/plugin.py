# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021,2019,2024 Andreas Vogel andreas@wellenvogel.net
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

#-----------------------------------------------------------------------------
# Hint:
# this plugin uses a couple of internal functions of AvNav and therefore
# you should not use this as an example for own plugins
# Those internal functions can change at any point in time without notice.
#-----------------------------------------------------------------------------

import datetime
import json
import socket
import sys
import threading
import time
import traceback

from avnav_api import AVNApi
from avnav_worker import WorkerParameter
from avnav_nmea import Key,NMEAParser

class Status:
  def __init__(self,base,source):
    self.base=base
    self.source=source
  def toState(self,api):
    lat=api.getSingleValue(NMEAParser.K_LAT.getKey(),True)
    lon=api.getSingleValue(NMEAParser.K_LON.getKey(),True)
    tm=api.getSingleValue(NMEAParser.K_TIME.getKey(),True)
    hasPos=(lat is not None and lon is not None and lat.source==self.source and lon.source==self.source )
    hasTime=(tm is not None and tm.source==self.source)
    if not hasPos and not hasTime:
      api.setStatus("RUNNING",self.base)
    else:
      txt=self.base
      if hasTime:
        txt+=", validTime"
      if hasPos:
        txt+=", validPosition"
      api.setStatus("NMEA",txt)


class Plugin(object):
  NM = 1852.0
  #PGNS used to set the time
  DEFAULT_PGNS='126992,129029'
  P_PORT=WorkerParameter('port',description='canbus json port',default=2598,type=WorkerParameter.T_NUMBER)
  P_HOST=WorkerParameter('host',description='canbus json host (default: localhost)',default='localhost')
  P_SENDRMC=WorkerParameter('autoSendRMC',description='time in seconds with no RMC to start sending it,0: off',
      default=0,type= WorkerParameter.T_NUMBER)
  P_SRC=WorkerParameter('sourceName',description='source name to be set for the generated records (defaults to plugin name)',
    default='')
  P_IV=WorkerParameter('timeInterval',description='time in seconds to store time received via n2k (also used as interval for auto send RMC, 0 to disable)',
                       default= 0.5,type=WorkerParameter.T_FLOAT)
  P_TIPGNS=WorkerParameter('timePGNs',description='PGNs used to set time',
                      default=DEFAULT_PGNS)
  P_READPOS=WorkerParameter('readPos',description='read position from 129025 and cog/sog from 129026',
                            default=True, type=WorkerParameter.T_BOOLEAN)
  P_PRIORITY=WorkerParameter('priority', description='priority of for the channel',
                             default=40,
                             type=WorkerParameter.T_NUMBER)
  PATHES=[
    NMEAParser.K_TIME,
    NMEAParser.K_SOG,
    NMEAParser.K_COG,
    NMEAParser.K_LON,
    NMEAParser.K_LAT
  ]
  CONFIG=[
        P_PORT,
        P_HOST,
        P_SENDRMC,
        P_READPOS,
        P_SRC,
        P_IV,
        P_TIPGNS,
        P_PRIORITY
        ]
  CONFIGLIST=list(map(lambda v:v.__dict__,CONFIG))
  @classmethod
  def pluginInfo(cls):
    """
    the description for the module
    @return: a dict with the content described below
            parts:
               * description (mandatory)
               * data: list of keys to be stored (optional)
                 * path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
                 * description
    """
    return {
      'description': 'a plugin that reads some PGNS from canboat. Currently supported: 126992:SystemTime. You need to set allowKeyOverwrite=true',
      'version': '1.0',
      'config': cls.CONFIGLIST,
      'data': list(map(lambda k: {'path':k.getKey(),'description':k.description },cls.PATHES))
    }

  def __init__(self,api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    self.api = api # type: AVNApi
    self.api.registerRestart(self.stop)
    self.api.registerEditableParameters(self.CONFIGLIST,self.changeConfig)
    self.changeSequence=0
    self.socket=None
    self.lastRmc=time.monotonic()
    self.status=None

  def rmcWatcher(self,sequence, source):
    while sequence == self.changeSequence:
      seq=0
      seq,data=self.api.fetchFromQueue(seq,10,includeSource=True,filter='$RMC')
      if len(data) > 0:
        for d in data:
          if d.source != source:
            self.lastRmc=time.monotonic()
            break


  def changeConfig(self,newValues):
    self.api.saveConfigValues(newValues)
    self.changeSequence+=1
    try:
      self.socket.close()
    except:
      pass

  def stop(self):
    self.changeSequence+=1
    try:
      self.socket.close()
    except:
      pass

  def run(self):
    while not self.api.shouldStopMainThread():
      self._runInternal()
  def _getConfig(self,cfg:WorkerParameter):
    v=self.api.getConfigValue(cfg.name,cfg.default)
    return cfg.checkValue(v,False)
  def _getField(self,msg,name,sub=None):
    fields=msg.get("fields")
    if fields is None:
      return
    rt=fields.get(name)
    if sub is None or rt is None:
      return rt
    if isinstance(rt,dict):
      return rt.get(sub)
    return rt
  def _runInternal(self):
    sequence=self.changeSequence
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    port=2598
    sock=None
    host=self._getConfig(self.P_HOST)
    timeInterval=0.5
    try:
      port=self._getConfig(self.P_PORT)
      timeInterval=self._getConfig(self.P_IV)
    except:
      self.api.log("exception while reading config values %s",traceback.format_exc())
      raise
    autoSendRMC=self._getConfig(self.P_SENDRMC)
    handledPGNs=self._getConfig(self.P_TIPGNS).split(',')
    readPos=self._getConfig(self.P_READPOS)
    if len(handledPGNs) < 1 and not readPos:
      self.api.log("no pgns to be handled, stopping plugin")
      self.api.setStatus("INACTIVE", "no pgns to be handled")
      return
    handledPGNs=[int(p) for p in handledPGNs]
    self.api.log("started with host=%s,port %d, autoSendRMC=%d"%(host,port,autoSendRMC))
    source=self._getConfig(self.P_SRC)
    rmcWatcher=threading.Thread(target=self.rmcWatcher,args=[sequence,source],daemon=True)
    rmcWatcher.start()
    priority=self._getConfig(self.P_PRIORITY)
    errorReported=False
    self.api.setStatus("STARTED", "connecting to n2kd at %s:%d"%(host,port))
    while sequence == self.changeSequence:
      try:
        self.socket = socket.create_connection((host, port),timeout=20)
        self.status=Status("connected to n2kd at %s:%d" %(host,port),source)
        self.status.toState(self.api)
        self.socket.settimeout(1)
        buffer=""
        lastTimeSet=time.monotonic()
        while sequence == self.changeSequence:
          try:
            data = self.socket.recv(1024)
            if len(data) == 0:
              raise Exception("connection to n2kd lost")
            buffer = buffer + data.decode('ascii', 'ignore')
          except socket.timeout:
            pass
          lines = buffer.splitlines(True)
          if len(lines) == 0:
            self.status.toState(self.api)
            continue
          if lines[-1][-1] == '\n':
            buffer=""
          else:
            if len(lines) > 0:
              buffer=lines.pop(-1)
            else:
              buffer=""
          for l in lines:
            try:
              msg=json.loads(l)
              errorReported=False
              #{"timestamp":"2016-02-28-20:32:48.226","prio":3,"src":27,"dst":255,"pgn":126992,"description":"System Time","fields":{"SID":117,"Source":"GPS","Date":"2016.02.28", "Time": "19:57:46.05000"}}
              pgn=msg.get('pgn')
              if pgn in handledPGNs:
                #currently we can decode messages that have a Date and Time field set
                now = time.monotonic()
                if now >= (lastTimeSet + timeInterval) and timeInterval > 0:
                  lastTimeSet=now
                  cdate=self._getField(msg,'Date','value')
                  ctime=self._getField(msg,'Time','value')
                  dt=None
                  if cdate is not None and ctime is not None:
                    dt=datetime.datetime(year=1970,month=1,day=1)
                    dt+=datetime.timedelta(days=cdate,milliseconds=ctime/10)
                  if dt is not None:
                    self.api.addData(NMEAParser.K_TIME.getKey(), self.formatTime(dt),source=source, sourcePriority=priority)
                  if autoSendRMC > 0:
                      if self.lastRmc is None or self.lastRmc < (now - autoSendRMC):
                        lat=self.api.getSingleValue("gps.lat")
                        lon=self.api.getSingleValue("gps.lon")
                        if lat is not None and lon is not None:
                          speed=self.api.getSingleValue("gps.speed")
                          cog=self.api.getSingleValue("gps.track")
                          self.api.debug("generating RMC lat=%f,lon=%f,ts=%s",lat,lon,dt.isoformat())
                          # $--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,xxxx,x.x,a*hh
                          fixutc="%02d%02d%02d.%02d"%(dt.hour,dt.minute,dt.second,dt.microsecond/1000)
                          (latstr,NS)=self.nmeaFloatToPos(lat,True)
                          (lonstr,EW)=self.nmeaFloatToPos(lon,False)
                          speedstr="" if speed is None else "%.2f"%(speed*3600/self.NM)
                          year="%04d"%dt.year
                          datestr="%02d%02d%s"%(dt.day,dt.month,year[-2:])
                          cogstr="" if cog is None else "%.2f"%cog
                          record="$GPRMC,%s,A,%s,%s,%s,%s,%s,%s,%s,,,A"%(fixutc,latstr,NS,lonstr,EW,speedstr,cogstr,datestr)
                          self.api.addNMEA(record,addCheckSum=True, source=source)

              if readPos:
                if pgn == 129025: #pos
                  clat=self.api.getSingleValue(NMEAParser.K_LAT.getKey(),includeInfo=True)
                  clon=self.api.getSingleValue(NMEAParser.K_LON.getKey(),includeInfo=True)
                  if clon is None or clon.source == source or clat is None or clat.source == source:
                    lon=self._getField(msg,'Longitude')
                    lat=self._getField(msg,'Latitude')
                    if lon is not None and lat is not None:
                      self.api.addData(NMEAParser.K_LON.getKey(),lon,source=source,sourcePriority=priority)
                      self.api.addData(NMEAParser.K_LAT.getKey(),lat,source=source,sourcePriority=priority)
                if pgn == 129026: #sog/cog
                  csog=self.api.getSingleValue(NMEAParser.K_SOG.getKey(),includeInfo=True)
                  ccog=self.api.getSingleValue(NMEAParser.K_COG.getKey(),includeInfo=True)
                  if csog is None or csog.source == source or ccog is None or ccog.source == source:
                    ref=self._getField(msg,"COG Reference")
                    if ref is not None and ref.get('value') == 0:
                      cog=self._getField(msg,'COG')
                      sog=self._getField(msg,'SOG')
                      if sog is not None and cog is not None:
                        self.api.addData(NMEAParser.K_SOG.getKey(),sog,source=source,sourcePriority=priority)
                        self.api.addData(NMEAParser.K_COG.getKey(),cog,source=source,sourcePriority=priority)
              #add other decoders here
            except:
              self.api.log("unable to decode json %s:%s"%(l,traceback.format_exc()))
            self.status.toState(self.api)
          if len(buffer) > 4096:
            raise Exception("no line feed in long data, stopping")
      except Exception as e:
        if not errorReported:
          self.api.setStatus("ERROR","connecting to n2kd %s:%d: %s"%(host,port,str(e)))
          errorReported=True
        if sock is not None:
          try:
            sock.close()
          except:
            pass
          sock=None
        self.api.setStatus("STARTED", "connecting to n2kd at %s:%d" % (host, port))
        if sequence != self.changeSequence:
          return
        time.sleep(2)

  def formatTime(self,ts):
    t = ts.isoformat()
    # seems that isoformat does not well harmonize with OpenLayers.Date
    # they expect at leas a timezone info
    # as we are at GMT we should have a "Z" at the end
    if not t[-1:] == "Z":
      t += "Z"
    return t

  def nmeaFloatToPos(self,pos,isLat):
    '''return a tuple (string,direction) from a position'''
    if pos is None:
      return ("","")
    dir='N' if isLat else 'E'
    if pos < 0:
      dir = 'S' if isLat else 'W'
      pos=-pos
    deg = int(pos)
    min = 60*pos - 60 * deg
    if isLat:
      rt="%02d%05.2f"%(deg,min)
    else:
      rt = "%03d%05.2f" % (deg, min)
    return(rt,dir)







