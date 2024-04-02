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
  SOURCE_GPS="gpstime"
  SOURCE_NTP="ntptime"
  def __init__(self,name,fetchFunction,statusFunction):
    self.lastSet=None
    self.lastValid=None
    self.externalTs=None
    self.name=name
    self.fetchFunction=fetchFunction
    self.statusFunction=statusFunction
    statusFunction(self.name,"not checked",WorkerStatus.INACTIVE)

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
    timestamp=time.monotonic()
    self.externalTs=externalTs
    self.lastSet=timestamp
    if externalTs is not None:
      self.statusFunction(self.name,"time %s"%self.formatTs(externalTs),WorkerStatus.NMEA)
      if not wasValid:
        AVNLog.info("new %s time: %s",self.name,self.formatTs(externalTs))
      self.lastValid=timestamp
    else:
      self.statusFunction(self.name,"no valid time",WorkerStatus.ERROR)
      if wasValid:
        AVNLog.info("lost %s time",self.name)
    return self.externalTs
  def getCurrent(self):
    return self.externalTs

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
  P_SETTIME_CMD=WorkerParameter('settimecmd','',editable=False,description='if set, use this to set the system time')
  P_EXPIRY_TIME=WorkerParameter('expiryTime',30,type=WorkerParameter.T_FLOAT,
                                description="expiry in seconds for NMEA data")
  P_AIS_EXPIRYTIME=WorkerParameter('aisExpiryTime',1200,type=WorkerParameter.T_FLOAT,
                                   description="expiry time in seconds for AIS data")
  P_AISAGE=WorkerParameter('useAisAge',True,type=WorkerParameter.T_BOOLEAN,
                                   description="use the AIS message age")
  P_OWNMMSI=WorkerParameter('ownMMSI','',type=WorkerParameter.T_STRING,
                            description='if set - do not store AIS messages with this MMSI')
  P_DEBUGTOLOG=WorkerParameter('debugToLog', False,type=WorkerParameter.T_BOOLEAN,editable=False)
  P_MAXTIMEBACK=WorkerParameter('maxtimeback',5,type=WorkerParameter.T_FLOAT,
                                description='how many seconds we allow time to go back before we reset (2...)')
  P_SETTIME=WorkerParameter('settime',True,type=WorkerParameter.T_BOOLEAN,
                            description="set the system time if either gps or ntp time is available",
                            condition={P_SETTIME_CMD.name:'!'})
  P_SYSTIMEDIFF=WorkerParameter('systimediff',5,type=WorkerParameter.T_FLOAT,
                                description='how many seconds do we allow the system time to be away from gps/ntp before we set',
                                condition={P_SETTIME_CMD.name:'!'},
                                rangeOrList=[2,1800])
  P_SETTIME_PERIOD=WorkerParameter('settimeperiod', 3600,type=WorkerParameter.T_FLOAT,
                                   description='minimal interval (sec) for setting the system time',
                                   condition={P_SETTIME_CMD.name:'!',P_SETTIME.name:True})
  P_SWITCHTIME=WorkerParameter('switchtime', 60, type=WorkerParameter.T_NUMBER,
                               description="time (sec) to wait before switching from gps time to ntp time and back",
                               condition={P_SETTIME_CMD.name:'!',P_SETTIME.name:True})
  P_NTP= WorkerParameter('ntphost', 'pool.ntp.org', type=WorkerParameter.T_STRING,
                         description='ntp server to check if no time is received from gps (set to empty to disable ntp)',
                         condition={P_SETTIME_CMD.name:'!',P_SETTIME.name:True})
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
            cls.P_EXPIRY_TIME,
            cls.P_AIS_EXPIRYTIME,
            cls.P_AISAGE,
            cls.P_OWNMMSI,
            cls.P_DEBUGTOLOG,
            cls.P_MAXTIMEBACK,
            cls.P_SETTIME,
            cls.P_SETTIME_CMD,
            cls.P_SYSTIMEDIFF,
            cls.P_SETTIME_PERIOD,
            cls.P_NTP,
            cls.P_SWITCHTIME
    ]

  @classmethod
  def getConfigParamCombined(cls, child=None):
    return cls.getConfigParam(child)

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
        expiry=self.getWParam(self.P_EXPIRY_TIME),
        aisExpiry=self.getWParam(self.P_AIS_EXPIRYTIME),
        ownMMSI=self.getWParam(self.P_OWNMMSI),
        useAisAge=self.getWParam(self.P_AISAGE)
      )

  def startInstance(self, navdata):
    if self.startupError is not None:
      self.setInfo("startup",self.startupError,WorkerStatus.ERROR)
    if self.configInfo is not None:
      self.setInfo("config",self.configInfo,WorkerStatus.STARTED)
    super().startInstance(navdata)


  def fetchGpsTime(self):
    try:
      curGpsTime=self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS + ".time")
      if curGpsTime is None:
        return None
      dt=AVNUtil.gt(curGpsTime)
      timestamp = dt.replace(tzinfo=datetime.timezone.utc).timestamp()
      return timestamp
    except Exception as e:
      AVNLog.error("Exception when getting curGpsData: %s",traceback.format_exc())
      return None

  def fetchNtpTime(self):
    host=AVNBaseConfig.P_NTP.fromDict(self.param)
    if host is None or host == '':
      return
    ts=getNTPTime(host)
    return ts

  TIME_CHILD="settime"
  SYSTIME_CHILD="systemtime"
  GPSPOS_CHILD="position"
  NEXT_CHILD="timecheck"
  def diffMonotonicOk(self,delta):
    allowedBackTime=self.P_MAXTIMEBACK.fromDict(self.param)
    if allowedBackTime < 2:
      allowedBackTime=2
    return abs(delta) < allowedBackTime

  def _shouldCheck(self,lastchecktime,offset):
    if lastchecktime is None:
      return True
    return time.monotonic() >= (lastchecktime+offset)

  def run(self):
    self.setInfo(self.TIME_CHILD,'disabled',WorkerStatus.INACTIVE)
    self.setInfo(self.GPSPOS_CHILD,'no valid position',WorkerStatus.ERROR)
    hasFix=False
    lastchecktime=None
    gpsTime=TimeSource(TimeSource.SOURCE_GPS,self.fetchGpsTime,self.setInfo)
    ntpTime=TimeSource(TimeSource.SOURCE_NTP,self.fetchNtpTime,self.setInfo)
    lastSource=gpsTime
    startutc=time.time()
    startupTime=time.monotonic()
    diffToMonotonic=startutc-startupTime
    AVNLog.debug("monotonic diff startup %f",diffToMonotonic)
    lastGpsOk=False
    while not self.shouldStop():
      settimeperiod=self.P_SETTIME_PERIOD.fromDict(self.param)
      switchtime=self.P_SWITCHTIME.fromDict(self.param)
      self.wait(1)
      self.setInfo('main','running',WorkerStatus.NMEA)
      #query the data to get old entries being removed
      curutc=time.time()
      curmonotonic=time.monotonic()
      self.setInfo(self.SYSTIME_CHILD,"UTC: %s"%datetime.datetime.utcfromtimestamp(curutc).isoformat(),WorkerStatus.RUNNING)
      newDiffToMonotonic=curutc-curmonotonic
      delta =  newDiffToMonotonic-diffToMonotonic
      diffToMonotonic=newDiffToMonotonic
      if not self.diffMonotonicOk(delta):
        AVNLog.warn("time shift (%d seconds) detected",delta)
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
        allowedDiff=self.P_SYSTIMEDIFF.fromDict(self.param)
        settimecmd=self.P_SETTIME_CMD.fromDict(self.param)
        setTimeEnabled=self.P_SETTIME.fromDict(self.param)
        if allowedDiff != 0 and settimecmd != "" and setTimeEnabled:
          currentStatus=self.status.get(self.TIME_CHILD)
          if not currentStatus or currentStatus.status == WorkerStatus.INACTIVE:
            self.setInfo(self.TIME_CHILD,"checking",WorkerStatus.RUNNING)
          checkSource=None
          gpsOk=gpsTime.fetch()
          #compute next check time
          nextCheck=None
          if gpsOk:
            if not lastGpsOk and lastchecktime is not None:
              lastchecktime=curmonotonic
            lastGpsOk=True
            checkSource=gpsTime
            #1 startup - do it once now
            if lastchecktime is None:
              nextCheck=curmonotonic-1
            else:
              if gpsTime.equal(lastSource):
                nextCheck=lastchecktime+settimeperiod
              else:
                nextCheck=lastchecktime+switchtime
          else:
            if lastGpsOk:
              lastchecktime=curmonotonic
            lastGpsOk=False
            if lastchecktime is None:
              #wait to check NTP on startup
              nextCheck=startupTime+switchtime
            else:
              if ntpTime.equal(lastSource):
                nextCheck=lastchecktime+settimeperiod
              else:
                nextCheck=lastchecktime+switchtime
            if nextCheck <= curmonotonic:
              if ntpTime.fetch():
                checkSource=ntpTime
              else:
                #try again to fetch NTP after switchtime
                nextCheck=curmonotonic+switchtime
                lastchecktime=curmonotonic
          diff=nextCheck-curmonotonic
          if diff < 0:
            diff=0
          self.setInfo(self.NEXT_CHILD,"in %d seconds"%diff,WorkerStatus.NMEA)

          if checkSource is not None and nextCheck <= curmonotonic:
            now=time.time()
            AVNLog.debug("checking time from %s(%s) against local %s",checkSource.name,
                         TimeSource.formatTs(checkSource.getCurrent()),
                         TimeSource.formatTs(now)
                         )
            lastSource=checkSource
            lastchecktime=curmonotonic
            if abs(now - checkSource.getCurrent()) > allowedDiff:
              AVNLog.warn("UTC time diff detected system=%s, %s=%s,setting system time",
                          TimeSource.formatTs(now),
                          checkSource.name,
                          TimeSource.formatTs(checkSource.externalTs))
              curts=datetime.datetime.utcfromtimestamp(checkSource.getCurrent())
              newtime="%02d%02d%02d%02d%04d.%02d"%(curts.month,curts.day,curts.hour,curts.minute,curts.year,curts.second)
              cmd=[settimecmd,newtime]
              self.setInfo(self.TIME_CHILD,
                           "setting UTC to %s from %s"%(curts.isoformat(),checkSource.name),
                           WorkerStatus.STARTED)
              AVNLog.info("starting command %s"," ".join(cmd))
              #we will check the expected diff of the system time
              #against the monotonic time source
              #this way it does not matter how long the settime cmd really runs
              #after setting the time
              checkmonotonic=time.monotonic()
              expectedMonotonicDiff=checkSource.getCurrent()-checkmonotonic
              AVNUtil.runCommand(cmd,threadName="setTime",timeout=30)
              curutc=time.time()
              currentMonotonicDiff=curutc-checkmonotonic
              newdiff=abs(expectedMonotonicDiff-currentMonotonicDiff)
              if newdiff > (allowedDiff*2):
                AVNLog.error("unable to set system time to %s , %d still above difference",newtime,newdiff)
                self.setInfo(self.TIME_CHILD,
                             "unable to set system time to UTC %s (%s) from %s at UTC %s"%
                             (curts.isoformat()," ".join(cmd),checkSource.name,datetime.datetime.utcfromtimestamp(curutc).isoformat()),
                             WorkerStatus.ERROR)
              else:
                self.setInfo(self.TIME_CHILD,
                             "last setting UTC to %s from %s"%(curts.isoformat(),checkSource.name),
                             WorkerStatus.NMEA)
                AVNLog.info("setting system time to %s succeeded",newtime)
              lastchecktime=curmonotonic
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
