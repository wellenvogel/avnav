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
import glob
import itertools
import urllib.parse

import ctypes
import logging
import logging.handlers
import os
import re
import subprocess
import sys
import time
import traceback

import datetime
import math
import threading
from math import copysign

class Enum(set):
    def __getattr__(self, name):
        if name in self:
            return name
        raise AttributeError

class AvNavFormatter(logging.Formatter):

  def format(self, record):
    record.avthread=AVNLog.getThreadId()
    return super().format(record)


class LogFilter(logging.Filter):
  def __init__(self, filter):
    super().__init__()
    self.filterText=filter
    self.filterre=re.compile(filter,re.I)
  def filter(self, record):
    if (self.filterre.search(record.msg)):
      return True
    if (self.filterre.search(record.threadName)):
      return True
    for arg in record.args:
      if (self.filterre.search(str(arg))):
        return True
    return False

class AVNLog(object):
  logger=logging.getLogger('avn')
  consoleHandler=None
  fhandler=None
  debugToFile=False
  logDir=None
  SYS_gettid = 224
  hasNativeTid=False
  tempSequence=0
  configuredLevel=0
  consoleOff=False

  @classmethod
  def getSyscallId(cls):
    if hasattr(threading,'get_native_id'):
      cls.hasNativeTid=True
      #newer python versions
      return
    if sys.platform == 'win32':
      return
    try:
      lines=subprocess.check_output("echo SYS_gettid | cc -include sys/syscall.h -E - ",shell=True)
      id=None
      for line in lines.splitlines():
        line=line.decode('utf-8',errors='ignore')
        line=line.rstrip()
        line=re.sub('#.*','',line)
        if re.match('^ *$',line):
          continue
        id=eval(line)
        if type(id) is int:
          cls.SYS_gettid=id
          break
    except:
      pass

  
  #1st step init of logging - create a console handler
  #will be removed after parsing the cfg file
  @classmethod
  def initLoggingInitial(cls,level):
    cls.getSyscallId()
    try:
      numeric_level=level+0
    except:
      numeric_level = getattr(logging, level.upper(), None)
      if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % level)
    formatter=AvNavFormatter("%(asctime)s-%(process)d-%(avthread)s-%(threadName)s-%(levelname)s-%(message)s")
    cls.consoleHandler=logging.StreamHandler()
    cls.consoleHandler.setFormatter(formatter)
    cls.logger.propagate=False
    cls.logger.addHandler(cls.consoleHandler)
    cls.logger.setLevel(numeric_level)
    cls.filter=None
    cls.configuredLevel=numeric_level
  
  @classmethod
  def levelToNumeric(cls,level):
    try:
      numeric_level=int(level)+0
    except:
      numeric_level = getattr(logging, level.upper(), None)
      if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % level)
    return numeric_level
    
  @classmethod
  def initLoggingSecond(cls,level,filename,debugToFile=False,consoleOff=False):
    numeric_level=level
    formatter=AvNavFormatter("%(asctime)s-%(process)d-%(avthread)s-%(threadName)s-%(levelname)s-%(message)s")
    cls.consoleOff=consoleOff
    if not cls.consoleHandler is None :
      cls.consoleHandler.setLevel(numeric_level if not consoleOff else logging.CRITICAL+1)
    version="2.7"
    try:
      version=sys.version.split(" ")[0][0:3]
    except:
      pass
    oldFiles=glob.glob("%s.[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]"%filename)
    for of in oldFiles:
      os.remove(of)
    if version != '2.6':
      #log files: 10M, 10 old files -> 110MB
      cls.fhandler=logging.handlers.RotatingFileHandler(filename=filename,maxBytes=10*1024*1024,backupCount=10,delay=True)
      cls.fhandler.setFormatter(formatter)
      flevel=numeric_level
      if flevel < logging.DEBUG and not debugToFile:
          flevel=logging.INFO
      cls.fhandler.setLevel(flevel)
      cls.fhandler.doRollover()
      cls.logger.addHandler(cls.fhandler)
    cls.logger.setLevel(numeric_level)
    cls.debugToFile=debugToFile
    cls.logDir=os.path.dirname(filename)
    cls.configuredLevel=numeric_level

  @classmethod
  def setLogLevel(cls,level):
    if cls.consoleHandler and not cls.consoleOff:
        cls.consoleHandler.setLevel(level)
    if cls.fhandler:
        flevel = level
        if flevel < logging.DEBUG and not cls.debugToFile:
            flevel = logging.INFO
        cls.fhandler.setLevel(flevel)
    cls.logger.setLevel(level)

  @classmethod
  def resetRun(cls,sequence,timeout):
    start=time.time()
    while sequence == cls.tempSequence:
      time.sleep(0.5)
      now=time.time()
      if sequence != cls.tempSequence:
        return
      if now < start or now >= (start+timeout):
        cls.logger.info("resetting loglevel to %s",str(cls.configuredLevel))
        cls.logger.setLevel(cls.configuredLevel)
        cls.setFilter(None)
        if not cls.consoleHandler is None:
          cls.consoleHandler.setLevel(cls.configuredLevel)
        if cls.debugToFile:
          if cls.fhandler is not None:
            cls.fhandler.setLevel(cls.configuredLevel)
        return

  @classmethod
  def getCurrentLevelAndFilter(cls):
    return (logging.getLevelName(cls.logger.getEffectiveLevel()),cls.filter.filterText if cls.filter is not None else '')
  @classmethod
  def startResetThread(cls,timeout):
    cls.tempSequence+=1
    sequence=cls.tempSequence
    thread=threading.Thread(target=cls.resetRun,args=(sequence,timeout))
    thread.setDaemon(True)
    thread.start()


  @classmethod
  def changeLogLevelAndFilter(cls,level,filter,timeout=None):
    try:
      numeric_level=cls.levelToNumeric(level)
      oldlevel=None
      if not cls.logger.getEffectiveLevel() == numeric_level:
        oldlevel = cls.logger.getEffectiveLevel()
        cls.logger.setLevel(numeric_level)
      if not cls.consoleHandler is None:
        cls.consoleHandler.setLevel(numeric_level)
      if cls.debugToFile:
        if cls.fhandler is not None:
          cls.fhandler.setLevel(numeric_level)
        pass
      cls.setFilter(filter)
      if timeout is not None:
        cls.startResetThread(timeout)
      return True
    except:
      return False
  @classmethod
  def setFilter(cls,filter):
    oldFilter=cls.filter
    if cls.filter is not None:
      cls.consoleHandler.removeFilter(cls.filter)
      if cls.fhandler is not None:
        cls.fhandler.removeFilter(cls.filter)
      cls.filter=None
    if filter is None:
      return oldFilter
    cls.filter=LogFilter(filter)
    cls.consoleHandler.addFilter(cls.filter)
    if cls.fhandler is not None:
      cls.fhandler.addFilter(cls.filter)
    return oldFilter

  @classmethod
  def debug(cls,str,*args,**kwargs):
    cls.logger.debug(str,*args,**kwargs)
  @classmethod
  def warn(cls,str,*args,**kwargs):
    cls.logger.warn(str,*args,**kwargs)
  @classmethod
  def info(cls,str,*args,**kwargs):
    cls.logger.info(str,*args,**kwargs)
  @classmethod
  def error(cls,str,*args,**kwargs):
    cls.logger.error(str,*args,**kwargs)
  @classmethod
  def ld(cls,*parms):
    cls.logger.debug(' '.join(map(repr,parms)))
  @classmethod
  def getLogDir(cls):
    return cls.logDir
  
  #some hack to get the current thread ID
  #basically the constant to search for was
  #__NR_gettid - __NR_SYSCALL_BASE+224
  #taken from http://blog.devork.be/2010/09/finding-linux-thread-id-from-within.html
  #this definitely only works on the raspberry - but on other systems the info is not that important...
  @classmethod
  def getThreadId(cls):
    try:
      if cls.hasNativeTid:
        return str(threading.get_native_id())
    except:
      pass
    if sys.platform == 'win32':
      return "0"
    try:
      libc = ctypes.cdll.LoadLibrary('libc.so.6')
      tid = libc.syscall(cls.SYS_gettid)
      return str(tid)
    except:
      return "0"



class AVNUtil(object):
  NAVXML="avnav.xml"
  NM=1852.0 #convert nm into m
  R=6371000 #earth radius in m
  NMEA_SERVICE="_nmea-0183._tcp" #avahi service for NMEA
  #convert a datetime UTC to a timestamp in seconds
  @classmethod
  def datetimeToTsUTC(cls,dt):
    if dt is None:
      return None
    #subtract the EPOCH
    td = (dt - datetime.datetime(1970,1,1, tzinfo=None))
    ts=((td.days*24*3600+td.seconds)*10**6 + td.microseconds)/1e6
    return ts

  #timedelta total_seconds that is not available in 2.6
  @classmethod
  def total_seconds(cls,td):
    return (td.microseconds + (td.seconds+td.days*24*3600)*10**6)/10**6
  
  #now timestamp in utc
  @classmethod
  def utcnow(cls):
    return cls.datetimeToTsUTC(datetime.datetime.utcnow())
  
  #check if a given position is within a bounding box
  #all in WGS84
  #ll parameters being tuples lat,lon
  #currently passing 180 is not handled...
  #lowerleft: smaller lat,lot
  @classmethod
  def inBox(cls,pos,lowerleft,upperright):
    if pos[0] < lowerleft[0]:
      return False
    if pos[1] < lowerleft[1]:
      return False
    if pos[0] > upperright[1]:
      return False
    if pos[1] > upperright[1]:
      return False
    return True
  
  # Haversine formula example in Python
  # Author: Wayne Dyck
  #distance in M
  @classmethod
  def distanceM(cls,origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination

    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) \
        * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = (cls.R * c )
    return d
  @classmethod
  def distanceRhumbLineM(cls,origin,destination):
    lat1, lon1 = origin
    lat2, lon2 = destination
    lat1r = math.radians(lat1)
    lat2r = math.radians(lat2)
    dlatr=lat2r-lat1r
    dlonr=math.radians(math.fabs(lon2-lon1))

    #if dLon over 180° take shorter rhumb line across the anti-meridian:
    if (math.fabs(dlonr) > math.pi):
      dlonr = -(2 * math.pi - dlonr) if dlonr > 0 else (2 * math.pi + dlonr)

    # on Mercator projection, longitude distances shrink
    # by latitude
    # q is the 'stretch factor'
    # q becomes ill - conditioned along E - W line(0 / 0)
    # use empirical tolerance to avoid it(note ε is too small)
    dcorr = math.log(math.tan(lat2r / 2 + math.pi / 4) / math.tan(lat1r / 2 + math.pi / 4))
    q = dlatr / dcorr if math.fabs(dcorr) > 10e-12 else  math.cos(lat1r)

    #distance is pythagoras on 'stretched' Mercator projection, √(Δφ² + q²·Δλ²)
    d = math.sqrt(dlatr * dlatr + q * q * dlonr * dlonr)  # angular distance in radians
    d = d * cls.R
    return d

  #distance in NM
  @classmethod
  def distance(cls,origin,destination):
    rt=cls.distanceM(origin,destination)
    return rt/float(cls.NM)

  #XTE - originally from Dirk HH, crosschecked against
  #http://www.movable-type.co.uk/scripts/latlong.html
  #points are always tuples lat,lon
  @classmethod
  def calcXTE(cls,Pp, startWp, endWp):
    d13 = cls.distanceM(startWp,Pp)
    w13 = cls.calcBearing(startWp,Pp)
    w12 = cls.calcBearing(startWp,endWp)
    return math.asin(math.sin(d13/cls.R)*math.sin(math.radians(w13)-math.radians(w12))) * cls.R

  @classmethod
  def calcXTERumbLine(cls,Pp,startWp,endWp):
    dstFromBrg = cls.calcBearingRhumbLine(endWp,startWp)
    dstCurBrg = cls.calcBearingRhumbLine(endWp,Pp)
    dstCurDst = cls.distanceRhumbLineM(endWp,Pp)
    alpha = dstFromBrg - dstCurBrg
    return dstCurDst * math.sin(math.radians(alpha))

  #bearing from one point the next originally by DirkHH
  #http://www.movable-type.co.uk/scripts/latlong.html
  @classmethod
  def calcBearing(cls,curP,endP):
    clat,clon=curP
    elat,elon=endP
    y = math.sin(math.radians(elon)-math.radians(clon)) * math.cos(math.radians(elat))
    x = math.cos(math.radians(clat))*math.sin(math.radians(elat)) - \
        math.sin(math.radians(clat))*math.cos(math.radians(elat))*math.cos(math.radians(elon)-math.radians(clon))
    return ((math.atan2(y, x)*180/math.pi)+360)%360.0

  @classmethod
  def calcBearingRhumbLine(cls,curP,endP):
    clat,clon=curP
    elat,elon=endP
    clatr=math.radians(clat)
    elatr=math.radians(elat)
    dlonr=math.radians(elon-clon)
    # if dLon over 180° take shorter rhumb line across the anti-meridian:
    if math.fabs(dlonr) > math.pi:
      dlonr = -(2 * math.pi - dlonr) if dlonr > 0 else (2 * math.pi + dlonr)

    corr=math.log(math.tan(elatr / 2 + math.pi / 4) / math.tan(clatr / 2 + math.pi / 4))
    brg=math.atan2(dlonr, corr)
    brg=math.degrees(brg)
    return (brg+360)%360.0


  @classmethod
  def deg2rad(cls,v):
    if v is None:
      return v
    return v*math.pi/180.0

  @classmethod
  def rad2deg(cls,value):
    '''
    format rad to deg, additionally mapping angles < 0 to 360-angle
    @param value:
    @return:
    '''
    if value is None:
      return None
    rt=value*180/math.pi
    if rt < 0:
      rt=360+rt
    return rt

  ais_converters = {
    "mmsi": int,
    "imo_id": int,
    "shiptype": int,
    "type": int,
    "epfd": int,
    "status": int,
    "month": int, # ETA
    "day": int, # ETA
    "hour": int, # ETA
    "minute": int, # ETA
    "second": int, # timestamp
    "maneuver": int,
    "accuracy": int,
    "lat": lambda v: float(v) / 600000,
    "lon": lambda v: float(v) / 600000,
    "speed": lambda v: float(v) / 10 * AVNUtil.NM / 3600,
    "course": lambda v: float(v) / 10,
    "heading": int,
    "turn": lambda v: round(copysign((float(v) / 4.733) ** 2, float(v)))
    if abs(float(v)) < 128
    else None,
    "draught": lambda v: float(v) / 10,
    "to_bow": int,  # A
    "to_stern": int,  # B
    "to_port": int,  # C
    "to_starboard": int,  # D
  }

  @classmethod
  def convertAIS(cls, aisdata):
    "convert ais raw values to real values"
    rt = aisdata.copy()

    for k, f in cls.ais_converters.items():
      if k not in rt:  # only convert data that's actually present
        continue
      try:
        rt[k] = f(rt[k])
      except:
        rt[k] = None  # explicitly map invalid data to none

    try:
      rt["beam"] = rt["to_port"] + rt["to_starboard"]
      rt["length"] = rt["to_bow"] + rt["to_stern"]
    except: pass

    try:
        #if rt["type"] in (5,24):
        if "lat" not in rt:
            del rt["type"] # remove to keep
    except: pass

    return rt
  
  #parse an ISO8601 t8ime string
  #see http://stackoverflow.com/questions/127803/how-to-parse-iso-formatted-date-in-python
  #a bit limited to what we write into track files or what GPSD sends us
  #returns a datetime object
  @classmethod
  def gt(cls,dt_str):
    dt, delim, us= dt_str.partition(".")
    if delim is None or delim == '':
      dt=dt.rstrip("Z")
    dt= datetime.datetime.strptime(dt, "%Y-%m-%dT%H:%M:%S")
    if not us is None and us != "":
      us= int(us.rstrip("Z"), 10)
    else:
      us=0
    return dt + datetime.timedelta(microseconds=us)
  
  #return a regex to be used to check for NMEA data
  @classmethod
  def getNMEACheck(cls):
    return re.compile("[!$][A-Z][A-Z][A-Z][A-Z]")
  
  #run an external command and and log the output
  #param - the command as to be given to subprocess.Popen
  @classmethod
  def runCommand(cls,param,threadName=None,timeout=None):
    try:
        cmd=subprocess.Popen(param,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,close_fds=True)
        reader=threading.Thread(target=cls.cmdOut,args= [cmd.stdout],daemon=True)
        if threadName is not None:
          reader.setName(threadName or '')
        reader.start()
        start=time.monotonic()
        while True:
          rt=cmd.poll()
          if rt is not None:
            return rt
          time.sleep(0.1)
          if timeout is None:
            continue
          if (start+timeout) < time.monotonic():
            AVNLog.error("timeout %f reached for command %s",timeout," ".join(param))
            cmd.kill()
            time.sleep(0.1)
            cmd.poll()
            return -255
    except Exception as e:
        AVNLog.error("unable to start command %s:%s"," ".join(param),str(e))
        return -255

  @classmethod
  def cmdOut(cls,stream):
    AVNLog.debug("cmd reading started")
    while True:
      line=stream.readline()
      if not line:
        break
      AVNLog.debug("[cmd]%s",line.strip())
    AVNLog.debug("cmd reading finished")


  @classmethod
  def getHttpRequestParam(cls,requestparam,name,mantadory=False):
    rt = requestparam.get(name)
    if rt is None:
      if mantadory:
        raise Exception("missing parameter %s"%name)
      return None
    if isinstance(rt, list):
      return rt[0]
    return rt

  @classmethod
  def getHttpRequestFlag(cls, requestparam, name,default=False, mantadory=False):
    flagString=cls.getHttpRequestParam(requestparam,name,mantadory)
    if flagString is None:
      return default
    return flagString.lower() == 'true'

  @classmethod
  def getReturnData(cls,error=None,**kwargs):
    if error is not None:
      rt= {'status':error}
    else:
      rt={'status':'OK'}
    for k in list(kwargs.keys()):
      if kwargs[k] is not None:
        rt[k]=kwargs[k]
    return rt

  @classmethod
  def replaceParam(cls,instr,param):
    if instr is None:
      return instr
    if param is None:
      return instr
    for k in list(param.keys()):
      instr=instr.replace("$"+k,param.get(k))
    return instr

  @classmethod
  def prependBase(cls,path,base):
    if path is None:
      return path
    if os.path.isabs(path):
      return path
    if base is None:
      return path
    if path.startswith(base):
      return path
    return os.path.join(base,path)

  @classmethod
  def getDirWithDefault(cls,parameters,name,defaultSub,belowData=True):
    value=parameters.get(name)
    if value is not None:
      if not isinstance(value,str):
        value=str(value,errors='ignore')


  @classmethod
  def clean_filename(cls,filename):
    replace=['/',os.path.sep]
    if filename is None:
      return None
    for r in replace:
      filename = filename.replace(r, '_')
    return filename

  @classmethod
  def getBool(cls,v,default=False):
    if v is None:
      return default
    if type(v) is str:
      return v.upper() == 'TRUE'
    return v


class ChartFile(object):
  def wakeUp(self):
    pass
  def getScheme(self):
    return None
  def close(self):
    pass
  def open(self):
    pass
  def changeScheme(self,schema,createOverview=True):
    raise Exception("not supported")
  def getChangeCount(self):
    return 0
  def getOriginalScheme(self):
    '''
    just return a schema if the user did not set it but it was found in the chart
    @return:
    '''
    return None
  def getAvnavXml(self,upzoom=None):
    return None


class AVNDownload(object):
  def __init__(self, filename, size=None, stream=None, mimeType=None,lastBytes=None):
    self.filename = filename
    self.size = size
    self.originalSize=self.size
    self.stream = stream
    self.mimeType = mimeType
    self.lastBytes=lastBytes
    if self.lastBytes is not None:
      self.lastBytes=int(self.lastBytes)

  def getSize(self):
    if self.size is None:
      self.size=os.path.getsize(self.filename)
      self.originalSize=self.size
      if self.lastBytes is not None and self.lastBytes < self.size:
        self.size=self.lastBytes
    return self.size

  def getStream(self):
    if self.stream is None:
      self.stream=open(self.filename, 'rb')
      if self.lastBytes is not None:
        if self.originalSize is None:
          self.getSize()
        seekv=self.originalSize-self.lastBytes
        if seekv > 0:
          self.stream.seek(seekv)
    return self.stream

  def getMimeType(self, handler=None):
    if self.mimeType is not None:
      return self.mimeType
    if handler is None:
      return "application/octet-stream"
    return handler.guess_type(self.filename)

  @classmethod
  def fileToAttach(cls,filename):
    #see https://stackoverflow.com/questions/93551/how-to-encode-the-filename-parameter-of-content-disposition-header-in-http
    return 'filename="%s"; filename*=utf-8\'\'%s'%(filename,urllib.parse.quote(filename))


class MovingSum:
  def __init__(self,num=10):
    self._values=list(itertools.repeat(0,num))
    self._num=num
    self._sum=0
    self._last=None
    self._idx=0
    self._lastUpdate=None

  def clear(self):
    self._sum=0
    self._idx=0
    for i in range(0,self._num):
      self._values[i]=0
  def num(self):
    return self._num
  def val(self):
    return self._sum
  def avg(self):
    if self._num <= 0:
      return 0
    return self._sum/self._num
  def add(self,v=0):
    now=int(time.monotonic())
    if self._last is None:
      self._last=now
    diff=now-self._last
    self._last=now
    rt=False
    if diff  > 0:
      rt=True
      if diff > self._num:
        #fast empty
        self.clear()
      else:
        while diff > 0:
          #fill intermediate seconds with 0
          self._idx+=1
          diff-=1
          if self._idx >= self._num:
            self._idx=0
          self._sum-=self._values[self._idx]
          self._values[self._idx]=0
      self._values[self._idx]=v
      self._sum+=v
    else:
      self._values[self._idx]+=v
      self._sum+=v
    return rt

  def shouldUpdate(self,iv=1):
    now=int(time.monotonic())
    if self._lastUpdate is None or (now-self._lastUpdate) >= iv:
      self._lastUpdate=now
      self.add(0)
      return True
    return False



if __name__ == '__main__':
  testsets = [
    {
      "name": 'q1',
      "waypoints": [
        {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
        {"lon": 13.468166666666667, "lat": 54.11538104291324, "name": "WP 2"}
      ],
      "testpoints": [
        [54.111, 13.469],
        [54.11216666666667, 13.463666666666667],
        [54.10666666666667, 13.471333333333334],
        [54.10433333333334, 13.469],
        [54.117666666666665, 13.474],
        [54.112, 13.4665],
        [54.10816666666667, 13.464833333333333],
        [54.11183333333334, 13.466333333333333],
        [54.11533333333333, 13.468166666666667]
      ]
    },
    {
      "name": 'q2',
      "waypoints": [
        {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
        {"lon": 13.472969266821604, "lat": 54.105126060954404, "name": "WP 2"}
      ],
      "testpoints": [
        [54.108333333333334, 13.469666666666667],
        [54.105666666666664, 13.466333333333333],
        [54.107, 13.468],
        [54.10583333333334, 13.478833333333334],
        [54.102333333333334, 13.474],
        [54.112, 13.464333333333334],
        [54.106833333333334, 13.460833333333333]
      ]
    },
    {
      "name": 'q3',
      "waypoints": [
        {"lon": 13.46481754474968, "lat": 54.10810325512469, "name": "WP 1"},
        {"lon": 13.458224892739876, "lat": 54.10384632131624, "name": "WP 2"}
      ],
      "testpoints": [
        [54.105333333333334, 13.463333333333333],
        [54.106833333333334, 13.460166666666666],
        [54.10166666666667, 13.459166666666667],
        [54.1045, 13.452166666666667],
        [54.108666666666664, 13.47],
        [54.111, 13.464],
        [54.106, 13.461500000000001]
      ]
    },
    {
      "name": 'q4',
      "waypoints": [
        {"lon": 13.464728465190955, "lat": 54.10854720253275, "name": "WP 1"},
        {"lon": 13.458937624792682, "lat": 54.11408311247243, "name": "WP 2"}
      ],
      "testpoints": [
        [54.11066666666667, 13.458833333333333],
        [54.11233333333333, 13.464],
        [54.114666666666665, 13.453333333333333],
        [54.11683333333333, 13.4595],
        [54.10583333333334, 13.463666666666667],
        [54.107166666666664, 13.472833333333334],
        [54.1115, 13.461666666666666]
      ]
    },
    {
      "name": 'cross',
      "waypoints": [
        {"lon": 13.464728465190955, "lat": 54.10854720253275, "name": "WP 1"},
        {"lon": 13.470786574851976, "lat": 54.103924671947794, "name": "WP 2"}
      ],
      "testpoints": [
        [54.1085, 13.4755]
      ]
    },
    {
      "name": 'long50',
      "waypoints": [
        {"lon": 14.14261292205835, "lat": 55.35112111609973, "name": "WP 1"},
        {"lon": 13.470786574851976, "lat": 54.103924671947794, "name": "WP 2"}
      ],
      "testpoints": [
        [54.4455, 13.608],
        [54.6215, 12.981666666666667]
      ],
      "percent": 10
    }
  ]
  for ts in testsets:
    print("Testset %s" % (ts['name']))
    p1 = [ts['waypoints'][0]['lat'], ts['waypoints'][0]['lon']]
    p2 = [ts['waypoints'][1]['lat'], ts['waypoints'][1]['lon']]
    print("Points: %s , %s" % (str(p1), str(p2)))
    dst = AVNUtil.distanceM(p1, p2)
    dstRl = AVNUtil.distanceRhumbLineM(p1, p2)
    print("dst=%f, dstRL=%f" % (dst, dstRl))
    brg = AVNUtil.calcBearing(p1, p2)
    brgRl = AVNUtil.calcBearingRhumbLine(p1, p2)
    print("brg=%f, brgRl=%f" % (brg, brgRl))
    tps = ts['testpoints']
    for tp in tps:
      xte=AVNUtil.calcXTE(tp,p1,p2)
      xteRl=AVNUtil.calcXTERumbLine(tp,p1,p2)
      print("latlon=%f,%f xte=%f, xteRl=%f"%(tp[0],tp[1],xte,xteRl))
