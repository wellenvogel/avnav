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
    if version != '2.6':
      cls.fhandler=logging.handlers.TimedRotatingFileHandler(filename=filename,when='midnight',backupCount=7,delay=True)
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

  #distance in NM
  @classmethod
  def distance(cls,origin,destination):
    rt=cls.distanceM(origin,destination);
    return rt/float(cls.NM);

  #XTE - originally from Dirk HH, crosschecked against
  #http://www.movable-type.co.uk/scripts/latlong.html
  #points are always tuples lat,lon
  @classmethod
  def calcXTE(cls,Pp, startWp, endWp):
    d13 = cls.distanceM(startWp,Pp);
    w13 = cls.calcBearing(startWp,Pp)
    w12 = cls.calcBearing(startWp,endWp)
    return math.asin(math.sin(d13/cls.R)*math.sin(math.radians(w13)-math.radians(w12))) * cls.R

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

  #convert AIS data (and clone the data)
  #positions / 600000
  #speed/10
  #course/10
  @classmethod
  def convertAIS(cls,aisdata):
    rt=aisdata.copy()
    rt['lat']=float(aisdata.get('lat') or 0)/600000
    rt['lon']=float(aisdata.get('lon') or 0)/600000
    rt['speed']=(float(aisdata.get('speed') or 0)/10) * cls.NM/3600;
    rt['course']=float(aisdata.get('course') or 0)/10
    rt['mmsi']=str(aisdata['mmsi'])
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
  def runCommand(cls,param,threadName=None):
    if not threadName is None:
      threading.current_thread().setName("%s"%threadName or '')
    try:
        cmd=subprocess.Popen(param,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,close_fds=True)
        while True:
            line=cmd.stdout.readline()
            if not line:
                break
            AVNLog.debug("[cmd]%s",line.strip())
        cmd.poll()
        return cmd.returncode
    except Exception as e:
        AVNLog.error("unable to start command %s:%s"," ".join(param),str(e))
        return -255


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