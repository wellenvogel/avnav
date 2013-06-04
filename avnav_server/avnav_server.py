#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
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
import sys
import os
import signal
import logging
import logging.handlers
import xml.sax as sax
import json
import time
from xml.sax._exceptions import SAXParseException
import threading
import datetime
import calendar
import traceback
import pprint
import socket
import SocketServer
import BaseHTTPServer
import SimpleHTTPServer
import posixpath
import urllib
import itertools
import optparse
import copy
import subprocess
import urlparse
import math
import re
import ctypes
import select
try:
  import create_overview
except:
  pass

VERSION="0.6.0"

hasSerial=False
hasGpsd=False
hasBluetooth=False
hasUdev=False
loggingInitialized=False
hasAisDecoder=False
allHandlers=[]
#should have a better solution then a global...
trackWriter=None
navxml="avnav.xml"



try:
  import serial
  hasSerial=True
except:
  pass

try:
  import gps
  hasGpsd=True
except:
  pass

try:
  import bluetooth
  hasBluetooth=True
except:
  pass

try:
  import pyudev
  hasUdev=True
except:
  pass

try:
  import ais
  hasAisDecoder=True
except:
  pass


#### constants ######################

NM=1852             #meters for a nautical mile


class Enum(set):
    def __getattr__(self, name):
        if name in self:
            return name
        raise AttributeError



class AVNLog():
  logger=logging.getLogger('avn')
  consoleHandler=None
  fhandler=None
  debugToFile=False
  
  #1st step init of logging - create a console handler
  #will be removed after parsing the cfg file
  @classmethod
  def initLoggingInitial(cls,level):
    try:
      numeric_level=level+0
    except:
      numeric_level = getattr(logging, level.upper(), None)
      if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % level)
    formatter=logging.Formatter("%(asctime)s-%(process)d-%(threadName)s-%(levelname)s-%(message)s")
    cls.consoleHandler=logging.StreamHandler()
    cls.consoleHandler.setFormatter(formatter)
    cls.logger.propagate=False
    cls.logger.addHandler(cls.consoleHandler)
    cls.logger.setLevel(numeric_level)
  
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
  def initLoggingSecond(cls,level,filename,debugToFile=False):
    numeric_level=cls.levelToNumeric(level)
    formatter=logging.Formatter("%(asctime)s-%(process)d-%(threadName)s-%(levelname)s-%(message)s")
    if not cls.consoleHandler is None :
      cls.consoleHandler.setLevel(numeric_level)
    cls.fhandler=logging.handlers.TimedRotatingFileHandler(filename=filename,when='midnight',backupCount=7,delay=True)
    cls.fhandler.setFormatter(formatter)
    cls.fhandler.setLevel(logging.INFO if not debugToFile else numeric_level)
    cls.logger.addHandler(cls.fhandler)
    cls.logger.setLevel(numeric_level)
    cls.debugToFile=debugToFile
  
  @classmethod
  def changeLogLevel(cls,level):
    try:
      numeric_level=cls.levelToNumeric(level)
      if not cls.logger.getEffectiveLevel() == numeric_level:
        cls.logger.setLevel(numeric_level)
      if not cls.consoleHandler is None:
        cls.consoleHandler.setLevel(numeric_level)
      if cls.debugToFile:
        cls.fhandler.setLevel(numeric_level)
      return True
    except:
      return False
  
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
    cls.logger.debug(' '.join(itertools.imap(repr,parms)))
  
  #some hack to get the current thread ID
  #basically the constant to search for was
  #__NR_gettid - __NR_SYSCALL_BASE+224
  #taken from http://blog.devork.be/2010/09/finding-linux-thread-id-from-within.html
  #this definitely only works on the raspberry - but on other systems the info is not that important...
  @classmethod
  def getThreadId(cls):
    try:
      SYS_gettid = 224
      libc = ctypes.cdll.LoadLibrary('libc.so.6')
      tid = libc.syscall(SYS_gettid)
      return str(tid)
    except:
      return "0"
    
    
  


class AVNUtil():
  
  NM=1852; #convert nm into m
  #convert a datetime UTC to a timestamp
  @classmethod
  def datetimeToTsUTC(cls,dt):
    if dt is None:
      return None
    #subtract the EPOCH
    td = (dt - datetime.datetime(1970,1,1, tzinfo=None))
    ts=((td.days*24*3600+td.seconds)*10**6 + td.microseconds)/1e6
    return ts
  
  #now timestamp in utc
  @classmethod
  def utcnow(cls):
    return cls.datetimeToTsUTC(datetime.datetime.utcnow())
  
  #check if a given position is within a bounding box
  #all in WGS84
  #ll parameters being tuples lat,lon
  #currently passing 180° is not handled...
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
  @classmethod
  def distance(cls,origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination
    radius = 6371 # km

    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) \
        * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = (radius * c * 1000)/float(cls.NM)
    return d
  
  #convert AIS data (and clone the data)
  #positions / 600000
  #speed/10
  #course/10
  @classmethod
  def convertAIS(cls,aisdata):
    rt=aisdata.copy()
    rt['lat']=float(aisdata['lat'])/600000
    rt['lon']=float(aisdata['lon'])/600000
    rt['speed']=float(aisdata['speed'])/10  
    rt['course']=float(aisdata['course'])/10  
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
  
  
  #find a feeder
  @classmethod
  def findFeeder(cls,feedername):
    if not feedername is None and feedername == '':
      feedername=None
    feeder=None
    for handler in allHandlers:
      if handler.getConfigName() == AVNGpsdFeeder.getConfigName():
        if not feedername is None:
          if handler.getName()==feedername:
            feeder=handler
            break
        else:
          feeder=handler
          break
    return feeder
  
  #return a regex to be used to check for NMEA data
  @classmethod
  def getNMEACheck(cls):
    return re.compile("[!$][A-Z][A-Z][A-Z][A-Z]")
  
  #run an external command and and log the output
  #param - the command as to be given to subprocess.Popen
  @classmethod
  def runCommand(cls,param,threadName=None):
    if not threadName is None:
      threading.current_thread().setName("[%s]%s"%(AVNLog.getThreadId(),threadName))
    cmd=subprocess.Popen(param,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,close_fds=True)
    while True:
      line=cmd.stdout.readline()
      if not line:
        break
      AVNLog.debug("[cmd]%s",line.strip())
    cmd.poll()
    return cmd.returncode
    
    
  

class AVNConfig(sax.handler.ContentHandler):
  def __init__(self,handlerList):
    self.handlerList=handlerList
    #global parameters
    self.parameters={
                     "debug":0,
                     "expiryTime":20, #time after which an entry is considered to be expired
                     }
    self.currentHandlerClass=None
    self.currentHandlerData=None
    self.handlerInstances=None
    sax.handler.ContentHandler.__init__(self)
    pass
  
  def readConfigAndCreateHandlers(self,filename):
    AVNLog.info("reading config %s",filename)
    if not os.path.exists(filename):
      AVNLog.error("unable to read config file %s",filename)
      return False
    try:
      self.currentHandlerData=None
      self.currentHandlerClass=None
      self.handlerInstances=[]
      parser=sax.parse(filename,self)
    except:
      AVNLog.error("error parsing cfg file %s : %s",filename,traceback.format_exc())
      return None
    return self.handlerInstances
    
  def startElement(self, name, attrs):
    if not self.currentHandlerClass is None:
      #we are at a child element
      #currently we ignore any deeper nesting
      childParamDefaults=self.currentHandlerClass.getConfigParam(name)
      if childParamDefaults is None:
        return
      childParam=AVNWorker.parseConfig(attrs,childParamDefaults)
      if self.currentHandlerData.get(name) is None:
        self.currentHandlerData[name]=[]
      self.currentHandlerData[name].append(childParam)
      AVNLog.ld("added sub to handlerdata",name,childParam)
      return
    for handler in self.handlerList:
      if name==handler.getConfigName():
        self.currentHandlerClass=handler
        self.currentHandlerData=handler.parseConfig(attrs, handler.getConfigParam(None))
        AVNLog.ld("handler config started for ",name,self.currentHandlerData)
        return
    AVNLog.warn("unknown XML element %s - ignoring",name)
    pass
  def endElement(self, name):
    if self.currentHandlerClass is None:
      return
    if not self.currentHandlerClass.getConfigName() == name:
      return #only create the handler when we are back at the handler level
    AVNLog.info("creating instance for %s with param %s",name,pprint.pformat(self.currentHandlerData))
    nextInstance=self.currentHandlerClass.createInstance(self.currentHandlerData)
    if not nextInstance is None:
      self.handlerInstances.append(nextInstance)
    else:
      AVNLog.warn("unable to create instance for handler %s",name)
    self.currentHandlerClass=None
    self.currentHandlerData=None   
    pass
  def characters(self, content): 
    pass

#a data entry
#data is the decoded string
class AVNDataEntry():
  EMPTY_CLASS="EMPTY"
  def __init__(self):
    self.key=self.createKey(self.EMPTY_CLASS,'')
    self.data={'class':self.EMPTY_CLASS,'time':None}
    self.timestamp=None
  
  #create a key from prefix and suffix
  @classmethod
  def createKey(cls,prefix,suffix):
    return prefix+"-"+suffix
    
  #create from the json decoded data
  #data must contain a class member and for TPV a type member
  @classmethod
  def fromData(cls,data):
    dcls=data.get('class');
    if dcls is None:
      AVNLog.debug("data %s does not contain a class - ignore",str(data))
      return None
    if dcls == 'TPV':
      tag=data.get('tag')
      if tag is None:
        AVNLog.debug("no tag for TPV in %s - ignore",str(data))
        return None
      rt=AVNDataEntry()
      rt.key=cls.createKey(dcls, tag)
      rt.data=data
      AVNLog.ld("data item created",rt)
      return rt
    if dcls == 'AIS':
      try:
        type=int(data.get('type'))
      except:
        AVNLog.ld("no type in AIS data",data)
        return None
      if not type in NMEAParser.knownAISTypes:
        AVNLog.debug("ignore type %d in AIS data %s",type,str(data))
        return None
      mmsi=data.get('mmsi')
      if mmsi is None:
        AVNLog.debug("AIS data without mmsi - ignore: %s",str(data))
        return None
      rt=AVNDataEntry()
      rt.key=cls.createKey(dcls, str(mmsi))
      rt.data=data
      AVNLog.ld("data item created",rt)
      return rt
        
    #we should not arrive here...
    AVNLog.debug("unknown class in %s - ignore",str(data))
    return None
    
  
  #decode from json
  @classmethod
  def fromJson(cls,jsondata):
    data=None
    try:
      data=json.loads(jsondata)
    except:
      AVNLog.debug("unable to parse json data %s : %s",jsondata,traceback.format_exc())
      return None
    return cls.fromData(data)
  
  def __str__(self):
    rt="AVNDataEntry: %s(ts=%f)=%s" % (self.key,(self.timestamp if self.timestamp is not None else 0),pprint.pformat(self.data))
    return rt
  def toJson(self):
    return json.dumps(self.data)
  

#the main List of navigational items received
class AVNNavData():
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI):
    self.list={}
    self.listLock=threading.Lock()
    self.expiryTime=expiryTime
    self.aisExpiryTime=aisExpiryTime
    self.ownMMSI=ownMMSI
  
  #add an entry to the list
  #do not add if there is already such an entry with newer timestamp
  #timestamps always relate to our system time - never directly to the GPS time!
  #this avoids confusion when we have to change the system time...
  #this is always done by the main thread!
  def addEntry(self,navEntry):
    if navEntry.timestamp is None:
      navEntry.timestamp=AVNUtil.utcnow()
    AVNLog.ld("AVNNavData add entry",navEntry)
    if navEntry.data['class'] == 'AIS':
      if self.ownMMSI != '' and self.ownMMSI == navEntry.data['mmsi']:
          AVNLog.debug("omitting own AIS message mmsi %s",self.ownMMSI)
          return
    self.listLock.acquire()
    if navEntry.key in self.list:
      #for AIS type 5/24 messages we merge them with an existing message
      #for others we merge back...
      if navEntry.data['class'] == 'AIS':
        if navEntry.data.get('type')=='5' or navEntry.data.get('type')=='24':
          AVNLog.debug("merging AIS type 5/24 with existing message")
          for k in NMEAParser.ais5mergeFields:
            v=navEntry.data.get(k)
            if v is not None:
              self.list[navEntry.key].data[k]=v
        else:
          AVNLog.debug("merging AIS with existing message")
          for k in NMEAParser.ais5mergeFields:
            v=self.list[navEntry.key].data.get(k)
            if v is not None:
              navEntry.data[k]=v
          self.list[navEntry.key]=navEntry
        #always replace here and merge back
        self.listLock.release()
        x=navEntry.key
        return
      else:
        if self.list[navEntry.key].timestamp > navEntry.timestamp:
          AVNLog.debug("not adding entry, older ts %s",str(navEntry))
          self.listLock.release()
          return
    self.list[navEntry.key]=navEntry
    
    AVNLog.debug("adding entry %s",str(navEntry))
    self.listLock.release()
  #check for an entry being expired
  #the list must already being locked!
  #returns the entry or None
  def __checkExpired__(self,entry,key):
    et=AVNUtil.utcnow()-self.expiryTime
    if entry.data['class']=='AIS':
      et=AVNUtil.utcnow()-self.aisExpiryTime
    if entry.timestamp < et:
      AVNLog.debug("remove expired entry %s, et=%s ",str(entry),str(et))
      del self.list[key]
      return None
    return entry
  #find an entry - return None if none found or expired...
  def getEntry(self,key):
    self.listLock.acquire()
    rt=self.list.get(key)
    rt=self.__checkExpired__(rt, key)
    self.listLock.release()
    return rt
  def getFilteredEntries(self,prefix,suffixlist):
    rt={}
    if len(suffixlist) == 0:
      #return all
      searchprefix=AVNDataEntry.createKey(prefix,'')
      prfxlen=len(searchprefix)
      self.listLock.acquire();
      for k in self.list.keys():
        e=self.list[k]
        if e.key[0:prfxlen]==searchprefix:
          rt[e.key]=e
      nrt={}
      for k in rt.keys():
        e=self.__checkExpired__(rt[k], k)
        if e is not None:
          nrt[k]=e
      self.listLock.release()
      return nrt
    for sfx in suffixlist:
      k=AVNDataEntry.createKey(prefix, sfx)
      entry=self.list.get(k)
      if entry is not None:
        rt[k]=entry
    return rt
  def getFilteredEntriesAsJson(self,prefix,suffixlist):
    rt=[]
    for e in self.getFilteredEntries(prefix, suffixlist).values():
      rt.append(e.data)
    AVNLog.ld("collected entries",rt)
    return json.dumps(rt)
  
  def getMergedEntries(self,prefix,suffixlist):
    fe=self.getFilteredEntries(prefix, suffixlist)
    rt=AVNDataEntry()
    rt.key=rt.createKey(prefix, '')
    for kf in fe:
      e=fe[kf]
      if rt.timestamp is None:
        rt.timestamp=e.timestamp
      newer=False
      if e.timestamp > rt.timestamp:
        newer=True
      k='class'
      if not k in rt.data or rt.data[k] == rt.EMPTY_CLASS:
        rt.data[k]=e.data[k]
      if e.data[k] != rt.data[k] and rt.data[k] != rt.EMPTY_CLASS:
        AVNLog.debug("mixing different classes in merge, ignore %s",str(e))
        continue
      for k in e.data.keys():
        if not (k in rt.data) or newer or rt.data.get(k) is None:
          rt.data[k] = e.data[k]
    AVNLog.ld("getMergedEntries",prefix,suffixlist,rt)
    return rt   
  
  #delete all entries from the list (e.g. when we have to set the time)
  def reset(self): 
    self.listLock.acquire()
    self.list.clear()
    self.listLock.release()
        
  
  def __str__(self):
    rt="AVNNavData \n";
    idx=0
    self.listLock.acquire()
    for k in self.list.keys():
      rt+="   (%03d:%s)%s=%s\n" % (idx,time.strftime("%Y/%m/%d-%H:%M:%S ",time.gmtime(self.list[k].timestamp)),self.list[k].key,self.list[k].data)
    self.listLock.release()  
    return rt


#a reader class to read from a serial port using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
#this class is not directly a worker that can be instantiated from the config
#instead it is used by worker classes to handle serial input
#it also contains our internal converting routines

class SerialReader():
  
  @classmethod
  def getConfigParam(cls):
    cfg={
               'port':None,
               'name':None,
               'timeout': 1,
               'baud': 4800,
               'minbaud':0, #if this is set to anything else, try autobauding between baud and minbaud
               'bytesize': 8,
               'parity': 'N',
               'stopbits': 1,
               'xonxoff': 0,
               'rtscts': 0,
               'numerrors': 20, #set this to 0 to avoid any check for NMEA data
               'autobaudtime': 5 #use that many seconds to read data for autobauding if no newline is found
               }
    return cfg
    
  #parameters:
  #param - the config dict
  #navdata - a nav data object (can be none if this reader doesn not directly write)
  #a write data method used to write a received line
  def __init__(self,param,navdata,writeData,infoHandler):
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial reader")
    self.param=param
    self.navdata=navdata
    self.nmeaParser=NMEAParser(navdata)
    self.writeData=writeData
    self.infoHandler=infoHandler
    if self.navdata is None and self.writeData is None:
      raise Exception("either navdata or writeData has to be set")
    self.startpattern=AVNUtil.getNMEACheck()
    self.doStop=False 
    self.setInfo("created",AVNWorker.Status.INACTIVE) 
  def getName(self):
    return "SerialReader-"+self.param['name']
   
  def stopHandler(self):
    self.doStop=True
   
  # a simple approach for autobauding
  # we try to read some data (~3 lines) and find a 0x0a in it
  # once we found this, we expect $ or ! and five capital letters afterwards
  # if not found we try the next lower baudrate
  
  def openDevice(self,baud,autobaud,init=False):
    self.buffer=''
    f=None
    try:
      pnum=int(self.param['port'])
    except:
      pnum=self.param['port']
    bytesize=int(self.param['bytesize'])
    parity=self.param['parity']
    stopbits=int(self.param['stopbits'])
    xonxoff=int(self.param['xonxoff'])
    rtscts=int(self.param['rtscts'])
    portname=self.param['port']
    timeout=float(self.param['timeout'])
    autobaudtime=float(self.param['autobaudtime'])
    name=self.getName()
    if init:
      AVNLog.info("openDevice for port %s, baudrate=%d, timeout=%f, autobaud=%s",
                  portname,baud,timeout,"true" if autobaud else "false")
      init=False
    else:
      AVNLog.debug("openDevice for port %s, baudrate=%d, timeout=%f , autobaud=%s",portname,baud,timeout,
                   "true" if autobaud else "false")
    lastTime=time.time()
    try:
      self.setInfo("opening %s at %d baud"%(portname,baud),AVNWorker.Status.STARTED)
      f=serial.Serial(pnum,timeout=timeout,baudrate=baud,bytesize=bytesize,parity=parity,stopbits=stopbits,xonxoff=xonxoff,rtscts=rtscts)
      self.setInfo("port open",AVNWorker.Status.STARTED)
      if autobaud:
        starttime=time.time()
        while time.time() <= (starttime + autobaudtime):
          bytes=f.read(300)
          if self.doStop:
            f.close()
            return None
          if len(bytes)==0:
            #if there is no data at all we simply take all the time we have...
            AVNLog.debug("unable to read data, retrying at %d",baud)
            continue
          data=bytes.decode('ascii',errors='ignore')
          curoffset=0
          while curoffset < (len(data)-5):
            pos=data.find('\n',curoffset)
            curoffset+=1
            if pos < 0:
              AVNLog.debug("no newline at baud %d in %s",baud,data)
              break
            curoffset=pos+1
            match=self.startpattern.search(data,curoffset)
            if not match:
              continue
            AVNLog.debug("assumed startpattern %s at baud %d in %s",match.group(0),baud,data)
            AVNLog.info("autobaud successfully finished at baud %d",baud)
            self.setInfo("NMEA data at %d baud"%(baud),AVNWorker.Status.STARTED)
            return f
        f.close()
        return None
      #hmm - seems that we have not been able to autobaud - return anyway
      return f
    except Exception:
      self.setInfo("unable to open port",AVNWorker.Status.ERROR)
      try:
        tf=traceback.format_exc(3).decode(errors='ignore')
      except:
        tf="unable to decode exception"
      AVNLog.debug("Exception on opening %s : %s",portname,tf)
      if f is not None:
        try:
          f.close()
        except:
          pass
        f=None
    return f  
  
  def readLine(self,serialDevice,timeout):
    #if not os.name=='posix':
    return serialDevice.readline(300)
    #some better readline for posix 
    #basically this needs more testing
    #at a first rough look this is not better then the single byte reading of pyserial itself
    #so we leave it out for now
    endtime=time.time()+timeout
    maxline=1024
    limit=4096
    while time.time() <= endtime:
      rt,sep,rest=self.buffer.partition('\n')
      if sep == '\n':
        #there is a line in the buffer
        self.buffer=rest
        return rt+'\n'
      ready,_,_ = select.select([serialDevice.fileno()],[],[], endtime-time.time())
      # If select was used with a timeout, and the timeout occurs, it
      # returns with empty lists -> thus abort read operation.
      # For timeout == 0 (non-blocking operation) also abort when there
      # is nothing to read.
      if not ready:
          break   # timeout
      buf = os.read(serialDevice.fileno(), maxline)
      # read should always return some data as select reported it was
      # ready to read when we get to this point.
      if not buf:
        # Disconnected devices, at least on Linux, show the
        # behavior that they are always ready to read immediately
        # but reading returns nothing.
        raise SerialException('device reports readiness to read but returned no data (device disconnected?)')
      self.buffer+=buf
      if len(self.buffer) > limit:
        self.buffer=''
        raise SerialException('no newline in buffer of %d bytes'%(limit))
    return None
      

   
  #the run method - just try forever  
  def run(self):
    threading.current_thread().setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    f=None
    init=True
    isOpen=False
    AVNLog.debug("started with param %s",",".join(str(i)+"="+str(self.param[i]) for i in self.param.keys()))
    self.setInfo("created",AVNWorker.Status.STARTED)
    while True and not self.doStop:
      name=self.getName()
      timeout=float(self.param['timeout'])
      portname=self.param['port']
      porttimeout=timeout*10
      baud=int(self.param['baud'])
      maxerrors=int(self.param['numerrors'])
      minbaud=int(self.param.get('minbaud') or baud)
      rates=(38400,19200,9600,4800)
      autobaud=False
      if minbaud != baud and minbaud != 0:
        autobaud=True
        if not baud in rates or not minbaud in rates:
          AVNLog.debug("minbaud/baud not in allowed rates %s","".join(str(f) for f in rates))
          autobaud=False
        if minbaud >= baud:
          AVNLog.debug("minbaud >= baud")
          autobaud=False
      if autobaud:
        baudidx=0
        while rates[baudidx] > baud:
          baudidx+=1
        while baudidx < len(rates) and rates[baudidx] >= minbaud and not self.doStop:
          f=self.openDevice(rates[baudidx],True,init)
          init=False
          baudidx+=1
          if not f is None:
            break
      else:
        f=self.openDevice(baud,False,init)
        init=False
      if self.doStop:
        AVNLog.info("handler stopped, leaving")
        self.setInfo("stopped",AVNWorker.Status.INACTIVE)
        try:
          f.close()
        except:
          pass
        return
      if f is None:  
        time.sleep(porttimeout/2)
        continue
      AVNLog.debug("%s opened, start receiving data",f.name)
      lastTime=time.time()
      numerrors=0
      hasNMEA=False
      while True and not self.doStop:
        bytes=0
        try:
          bytes=self.readLine(f,timeout)
        except Exception as e:
          AVNLog.debug("Exception %s in serial read, close and reopen %s",traceback.format_exc(),portname)
          try:
            f.close()
            isOpen=False
          except:
            pass
          break
        if not bytes is None and len(bytes)> 0:
          if not hasNMEA:
            self.setInfo("receiving",AVNWorker.Status.STARTED)
          if not isOpen:
            AVNLog.info("successfully opened %s",f.name)
            isOpen=True
          self.status=True
          data=bytes.decode('ascii',errors='ignore')
          if maxerrors > 0 or not hasNMEA:
            if not self.startpattern.match(data):
              if maxerrors>0:
                numerrors+=1
                if numerrors > maxerrors:
                  #hmm - seems that we do not see any NMEA data
                  AVNLog.debug("did not see any NMEA data for %d lines - close and reopen",maxerrors)
                  try:
                    f.close()
                  except:
                    pass
                  break;
                continue
            else:
              self.setInfo("receiving",AVNWorker.Status.NMEA)
              hasNMEA=True
              numerrors=0
          if len(data) < 5:
            AVNLog.debug("ignore short data %s",data)
          else:
            if not self.writeData is None:
              self.writeData(data)
            else:
              self.nmeaParser.parseData(data)
            lastTime=time.time()
        if (time.time() - lastTime) > porttimeout:
          self.setInfo("timeout",AVNWorker.Status.ERROR)
          f.close()
          if isOpen:
            AVNLog.info("reopen port %s - timeout elapsed",portname)
            isOpen=False
          else:
            AVNLog.debug("reopen port %s - timeout elapsed",portname)
          break
    AVNLog.info("stopping handler")
    self.setInfo("receiving",AVNWorker.Status.INACTIVE)
        
  def setInfo(self,txt,status):
    if not self.infoHandler is None:
      self.infoHandler.setInfo(self.getName(),txt,status)
        
 

#an NMEA parser
#parses some simple NMEA setences and uses ais from the gpsd project to parse AIS setences
#adds parsed data to a navdata struct

class NMEAParser():
  #AIS field translations
  aisFieldTranslations={'msgtype':'type'}
  #AIS fields merged from message type 5 into others
  ais5mergeFields=['imo_id','callsign','shipname','shiptype','destination']
  #AIS messages we store
  knownAISTypes=(1,2,3,5,18,19,24)
  
  def __init__(self,navdata):
    self.payloads = {'A':'', 'B':''}    #AIS paylod data
    self.navdata=navdata
  #------------------ some nmea data specific methods -------------------
  #add a valid dataset to nav data
  #timedate is a datetime object as returned by gpsTimeToTime
  #fill this additionally into the time part of data
  def addToNavData(self,data,timedate):
    if timedate is not None:
      t=timedate.isoformat()
      #seems that isoformat does not well harmonize with OpenLayers.Date
      #they expect at leas a timezone info
      #as we are at GMT we should have a "Z" at the end
      if not t[-1:]=="Z":
        t+="Z"
      data['time']=t
    de=AVNDataEntry.fromData(data)
    self.navdata.addEntry(de)
    
  #returns an datetime object containing the current gps time
  @classmethod
  def gpsTimeToTime(cls,gpstime,gpsdate=None):
    #we take day/month/year from our system and add everything else from the GPS
    gpsts=datetime.time(int(gpstime[0:2] or '0'),int(gpstime[2:4] or '0'),int(gpstime[4:6] or '0'),1000*int(gpstime[7:10] or '0'))
    AVNLog.ld("gpstime/gpsts",gpstime,gpsts)
    if gpsdate is None:
      curdt=datetime.datetime.utcnow()
      gpsdt=datetime.datetime.combine(curdt.date(),gpsts)
      AVNLog.ld("curts/gpsdt before corr",curdt,gpsdt)
      #now correct the time if we are just changing from one day to another
      #this assumes that our system time is not more then one day off...(???)
      if (curdt - gpsdt) > datetime.timedelta(hours=12) and curdt.time().hour < 12:
        #we are in the evening and the gps is already in the morning... (and we accidently put it to the past morning)
        #so we have to hurry up to the next day...
        gpsdt=datetime.datetime.combine(curdt+datetime.timedelta(1),gpsts)
      if (gpsdt - curdt) > datetime.timedelta(hours=12) and curdt.time().hour> 12:
        #now we are faster - the gps is still in the evening of the past day - but we assume it at the coming evening
        gpsdt=datetime.datetime.combine(curdt-datetime.timedelta(1),gpsts)
      AVNLog.ld("curts/gpsdt after corr",curdt,gpsdt)
    else:
      #gpsdate is in the form ddmmyy
      #within GPSdate we do not have the century, so make some best guess:
      #if the 2 digits are below 80, assume that we are in 2000++, otherwise in 1900++
      if len(gpsdate) != 6:
        raise Exception("invalid gpsdate %s"%(gpsdate))
      year=gpsdate[4:6]
      completeyear=0
      if int(year) < 80:
        completeyear=2000+int(year)
      else:
        completeyear=1900+int(year)
      date=datetime.date(completeyear,int(gpsdate[2:4]),int(gpsdate[0:2]))
      gpsdt=datetime.datetime.combine(date,gpsts)
      AVNLog.ld("gpsts computed",gpsdt)
    return gpsdt
  
  #parse the nmea psoition fields:
  #gggmm.dec,N  - 1-3 characters grad, mm 2 didgits minutes
  #direction N,S,E,W - S,W being negative
  @classmethod
  def nmeaPosToFloat(cls,pos,direction):
    posa=pos.split('.')
    if len(posa) < 2:
      AVNLog.ld("invalid pos format",pos)
      return None
    grd=posa[0][-10:-2]
    min=posa[0][-2:]
    min=min+"."+posa[1]
    rt=float(grd)+float(min)/60;
    if rt > 0 and (direction == 'S' or direction == 'W'):
      rt=-rt;
    AVNLog.ld("pos",pos,rt)
    return rt
   
  
 
  #parse a line of NMEA data and store it in the navdata array      
  def parseData(self,data):
    darray=data.split(",")
    if len(darray) < 1 or (darray[0][0:1] != "$" and darray[0][0:1] != '!') :
      AVNLog.debug("invalid nmea data (len<1) "+data+" - ignore")
      return
    if darray[0][0] == '!':
      if not hasAisDecoder:
        AVNLog.debug("cannot parse AIS data (no ais.py found)  %s",data)
        return
      AVNLog.debug("parse AIS data %s",data)
      self.ais_packet_scanner(data)
      return
    tag=darray[0][3:]
    rt={'class':'TPV','tag':tag}
    #currently we only take the time from RMC
    #as only with this one we have really a valid complete timestamp
    try:
      if tag=='GGA':
        rt['lat']=self.nmeaPosToFloat(darray[2],darray[3])
        rt['lon']=self.nmeaPosToFloat(darray[4],darray[5])
        rt['mode']=int(darray[6] or '0')
        self.addToNavData(rt, None)
        return
      if tag=='GLL':
        rt['mode']=1
        if len(darray > 6):
          rt['mode']= (0 if (darray[6] != 'A') else 2)
        rt['lat']=self.nmeaPosToFloat(darray[1],darray[2])
        rt['lon']=self.nmeaPosToFloat(darray[3],darray[4])
        self.addToNavData(rt, None)
        return
      if tag=='VTG':
        mode=darray[2]
        rt['track']=float(darray[1] or '0')
        if (mode == 'T'):
          #new mode
          rt['speed']=float(darray[5] or '0')*NM/3600
        else:
          rt['speed']=float(darray[3]or '0')*NM/3600
        self.addToNavData(rt, None)
        return
      if tag=='RMC':
        #$--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,xxxx,x.x,a*hh
        #this includes current date
        rt['mode']=( 0 if darray[2] != 'A' else 1)
        gpstime=darray[1]
        rt['lat']=self.nmeaPosToFloat(darray[3],darray[4])
        rt['lon']=self.nmeaPosToFloat(darray[5],darray[6])
        rt['speed']=float(darray[7] or '0')*NM/3600
        rt['track']=float(darray[8] or '0')
        gpsdate=darray[9]
        self.addToNavData(rt, self.gpsTimeToTime(gpstime, gpsdate))
        return
        
    except Exception:
        AVNLog.debug(" error parsing nmea data "+str(data)+"\n"+traceback.format_exc())
  
  #parse one line of AIS data 
  #taken from ais.py and adapted to our input handling     
  def ais_packet_scanner(self,line):
    "Get a span of AIVDM packets with contiguous fragment numbers."
    if not line.startswith("!"):
      AVNLog.debug("ignore unknown AIS data %s",line)
      return
    line = line.strip()
    # Strip off USCG metadata 
    line = re.sub(r"(?<=\*[0-9A-F][0-9A-F]),.*", "", line)
    # Compute CRC-16 checksum
    packet = line[1:-3]  # Strip leading !, trailing * and CRC
    csum = 0
    for c in packet:
        csum ^= ord(c)
    csum = "%02X" % csum
    # Ignore comments
    # Assemble fragments from single- and multi-line payloads
    fields = line.split(",")
    try:
        expect = fields[1]
        fragment = fields[2]
        channel = fields[4]
        if fragment == '1':
            self.payloads[channel] = ''
        self.payloads[channel] += fields[5]
        try:
            # This works because a mangled pad literal means
            # a malformed packet that will be caught by the CRC check. 
            pad = int(fields[6].split('*')[0])
        except ValueError:
            pad = 0
        crc = fields[6].split('*')[1].strip()
    except IndexError:
        AVNLog.debug("malformed line: %s\n",line.strip())
        return
    if csum != crc:
        AVNLog.debug("bad checksum %s, expecting %s: %s\n",crc, csum, line.strip())
        return
    if fragment < expect:
        AVNLog.debug("waiting for more fragments: %s",line.strip())
        return
    # Render assembled payload to packed bytes
    bits = ais.BitVector()
    bits.from_sixbit(self.payloads[channel], pad)
    self.parse_ais_messages(self.payloads[channel], bits)


  #basically taken from ais.py but changed to decode one message at a time
  def parse_ais_messages(self,raw,bits):
      "Generator code - read forever from source stream, parsing AIS messages."
      values = {}
      values['length'] = bits.bitlen
      # Without the following magic, we'd have a subtle problem near
      # certain variable-length messages: DSV reports would
      # sometimes have fewer fields than expected, because the
      # unpacker would never generate cooked tuples for the omitted
      # part of the message.  Presently a known issue for types 15
      # and 16 only.  (Would never affect variable-length messages in
      # which the last field type is 'string' or 'raw').
      bits.extend_to(168)
      # Magic recursive unpacking operation
      try:
          cooked = ais.aivdm_unpack(0, bits, 0, values, ais.aivdm_decode)
          # We now have a list of tuples containing unpacked fields
          # Collect some field groups into ISO8601 format
          for (offset, template, label, legend, formatter) in ais.field_groups:
              segment = cooked[offset:offset+len(template)]
              if map(lambda x: x[0], segment) == template:
                  group = ais.formatter(*map(lambda x: x[1], segment))
                  group = (label, group, 'string', legend, None)
                  cooked = cooked[:offset]+[group]+cooked[offset+len(template):]
          # Apply the postprocessor stage
          cooked = ais.postprocess(cooked)
          expected = ais.lengths.get(values['msgtype'], None)
          # Check length; has to be done after so we have the type field 
          bogon = False
          if expected is not None:
              if type(expected) == type(0):
                  expected_range = (expected, expected)
              else:
                  expected_range = expected
              actual = values['length']
              if not (actual >= expected_range[0] and actual <= expected_range[1]):
                  raise AISUnpackingException(0, "length", actual)
          # We're done, hand back a decoding
          #AVNLog.ld('decoded AIS data',cooked)
          self.storeAISdata(cooked)
      except:
          (exc_type, exc_value, exc_traceback) = sys.exc_info()
          AVNLog.debug("exception %s while decoding AIS data %s",exc_value,raw.strip())
  
  def storeAISdata(self,bitfield):
    rt={'class':'AIS'}
    storeData=False
    for bfe in bitfield:
      try:
        name=bfe[0].name
        tname=self.aisFieldTranslations.get(name)
        if tname is not None:
          name=tname
        val=str(bfe[1])
        rt[name]=val
      except:
        pass
    de=AVNDataEntry.fromData(rt)
    if de is not None:
      self.navdata.addEntry(de)
    
#a base class for all workers
#this provides some config functions and a common interfcace for handling them
class AVNWorker(threading.Thread):
  Status=Enum(['INACTIVE','STARTED','RUNNING','NMEA','ERROR'])
  def __init__(self,cfgparam):
    self.param=cfgparam
    self.status=False
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(self.getName())
    self.info={'main':"started"}
    self.status={'main':self.Status.STARTED}
  def getInfo(self):
    try:
      rt=self.info.copy();
      st=self.status.copy()
      rta=[]
      for k in rt.keys():
        try:
          elem={}
          elem['name']=k
          elem['info']=rt[k]
          elem['status']=st[k]
          rta.append(elem)
        except:
          pass
      return {'name':self.getName(),'items':rta}
    except:
      return {'name':self.getName(),'items':[],'error':"no info available"}
  def setInfo(self,name,info,status):
    self.info[name]=info
    self.status[name]=status
  def getParam(self):
    try:
      return self.param
    except:
      return {}
  def getParamValue(self,name,throw=False):
    rt=self.getParam().get(name)
    if rt is None:
      if throw:
        raise Exception("parameter %s not found in config %s"%(name,self.getConfigName()))
      else:
        return None
    return rt
  def getIntParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    try:
      return int(rt or 0)
    except Exception as e:
      if not throw:
        return 0
      else:
        raise e
      
  
  def getBoolParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return False
    else:
      return rt.upper()=='TRUE'
    
  def getStringParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return ""
    else:
      return str(rt)
  def getFloatParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    try:
      return float(rt or 0)
    except Exception as e:
      if not throw:
        return 0
      else:
        raise e
    
  
  #stop any child process (will be called by signal handler)
  def stopChildren(self):
    pass
  #should be overridden
  def getName(self):
    return "BaseWorker"
  
  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    raise Exception("getConfigName must be overridden by derived class")
  #return the default cfg values
  #if the parameter child is set, the parameter for a child node
  #must be returned, child nodes are added to the parameter dict
  #as an entry with childnodeName=[] - the child node configs being in the list
  @classmethod
  def getConfigParam(cls,child=None):
    raise Exception("getConfigParam must be overwritten")
  
  @classmethod
  def createInstance(cls,cfgparam):
    raise Exception("createInstance must be overwritten")
  #parse an config entry
  @classmethod
  def parseConfig(cls,attrs,default):
    sparam=copy.deepcopy(default)
    for k in sparam.keys():
      dv=sparam[k]
      v=attrs.get(k)
      if dv is None and v is None:
        raise Exception(cls.getConfigName()+": missing mandatory parameter "+k)
      if v is None:
        sparam[k]=dv
      else:
        sparam[k]=v
    return sparam
  
  def startInstance(self,navdata):
    self.navdata=navdata
    self.start()
    
  #we have 2 startup groups - one for the feeders and 2 for the rest
  #by default we start in groupd 2
  @classmethod
  def getStartupGroup(cls):
    return 2
    
 
  

#a dummy worker class to read some basic configurations
class AVNBaseConfig(AVNWorker):
  def __init__(self,param):
    self.param=param
  @classmethod
  def getConfigName(cls):
    return "AVNConfig"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'loglevel':logging.INFO,
            'logfile':"",
            'expiryTime': 30,
            'aisExpiryTime': 600,
            'ownMMSI':'',        #if set - do not store AIS messages with this MMSI
            'debugToLog': 'false',
            'maxtimeback':5,      #how many seconds we allow time to go back before we reset
            'settimecmd': '',     #if set, use this to set the system time
            'systimediff':5,      #how many seconds do we allow the system time to be away from us
            'settimeperiod': 3600 #how often do we set the system time
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNBaseConfig(cfgparam)
  def start(self):
    pass

#a writer for our track
class AVNTrackWriter(AVNWorker):
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.track=[]
    #param checks
    throw=True
    self.getIntParam('cleanup', throw)
    self.getFloatParam('mindistance', throw)
    self.getFloatParam('interval', throw)
    self.tracklock=threading.Lock()
  @classmethod
  def getConfigName(cls):
    return "AVNTrackWriter"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'interval':10, #write every 10 seconds
            'trackdir':"", #defaults to pdir/tracks
            'mindistance': 25, #only write if we at least moved this distance
            'cleanup': 25, #cleanup in hours
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNTrackWriter(cfgparam)
  
  #write out the line
  #timestamp is a datetime object
  def writeLine(self,filehandle,timestamp,data):
    ts=timestamp.isoformat();
    if not ts[-1:]=="Z":
        ts+="Z"
    str="%s,%f,%f,%f,%f\n"%(ts,data['lat'],data['lon'],(data.get('track') or 0),(data.get('speed') or 0))
    filehandle.write(str)
    filehandle.flush()
  def createFileName(self,dt):
    str=dt.strftime("%Y-%m-%d")+".avt"
    return str
  def cleanupTrack(self):
    numremoved=0
    cleanupTime=datetime.datetime.utcnow()-datetime.timedelta(hours=self.getIntParam('cleanup'))
    self.tracklock.acquire()
    while len(self.track) > 0:
      if self.track[0][0]<=cleanupTime:
        numremoved+=1
        self.track.pop(0)
      else:
        break
    self.tracklock.release()
    if numremoved > 0:
      AVNLog.debug("removed %d track entries older then %s",numremoved,cleanupTime.isoformat())
  
  #get the track as array of dicts
  #filter by maxnum and interval
  def getTrackFormatted(self,maxnum,interval):
    rt=[]
    curts=None
    intervaldt=datetime.timedelta(seconds=interval)
    self.tracklock.acquire()
    try:
      for tp in self.track:
        if curts is None or tp[0] > (curts + intervaldt):
          entry={
               'ts':AVNUtil.datetimeToTsUTC(tp[0]),
               'time':tp[0].isoformat(),
               'lat':tp[1],
               'lon':tp[2]}
          rt.append(entry)
          curts=tp[0]
    except:
      pass
    self.tracklock.release()
    return rt[-maxnum:]
    
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    f=None
    fname=None
    initial=True
    lastLat=None
    lastLon=None
    newFile=False
    loopCount=0
    while True:
      loopCount+=1
      currentTime=datetime.datetime.utcnow();
      
      trackdir=self.getStringParam("trackdir")
      if trackdir == "":
        trackdir=os.path.join(os.path.dirname(sys.argv[0]),'tracks')
      if initial:
        AVNLog.info("started with dir=%s,interval=%d, distance=%d",
                trackdir,
                self.getFloatParam("interval"),
                self.getFloatParam("mindistance"))
      try:
        if not os.path.isdir(trackdir):
          os.makedirs(trackdir, 0775)
        curfname=os.path.join(trackdir,self.createFileName(currentTime))
        if not curfname == fname:
          fname=curfname
          if not f is None:
            f.close()
          newFile=True         
          if initial:
            if os.path.exists(curfname):
              try:
                f=open(curfname,"r")
                self.setInfo('main', "reading old track data", AVNWorker.Status.STARTED)
                for line in f:
                  line=re.sub('#.*','',line)
                  #TODO: parse time
                  par=line.split(",")
                  if len(par) < 3:
                    continue
                  try:
                    newLat=float(par[1])
                    newLon=float(par[2])
                    if lastLat is None or lastLon is None: 
                      self.track.append((AVNUtil.gt(par[0]),newLat,newLon))
                      lastLat=newLat
                      latLon=newLon
                    else:
                      dist=AVNUtil.distance((lastLat,lastLon), (newLat,newLon))*AVNUtil.NM
                      if dist >= self.getFloatParam('distance'):
                        self.track.append((AVNUtil.gt(par[0]),lastLat,lastLon))
                        lastLat=newLat
                        latLon=newLon
                  except:
                    pass
                f.close()
              except:
                if not f is None:
                  try:
                    f.close()
                  except:
                    pass
            initial=False
        if newFile:
          f=open(curfname,"a")
          f.write("#anvnav Trackfile started/continued at %s\n"%(currentTime.isoformat()))
          f.flush()
          newFile=False
          self.setInfo('main', "writing to %s"%(curfname), AVNWorker.Status.NMEA)
        self.status=True
        if loopCount >= 10:
          self.cleanupTrack()
          loopCount=0
        gpsdata=self.navdata.getMergedEntries('TPV',[])
        lat=gpsdata.data.get('lat')
        lon=gpsdata.data.get('lon')
        if not lat is None and not lon is None:
          if lastLat is None or lastLon is None:
            AVNLog.ld("write track entry",gpsdata.data)
            self.writeLine(f,currentTime,gpsdata.data)
            self.track.append((currentTime,lat,lon))
          else:
            dist=AVNUtil.distance((lastLat,lastLon), (lat,lon))*AVNUtil.NM
            if dist >= self.getFloatParam('distance'):
              AVNLog.ld("write track entry",gpsdata.data)
              self.writeLine(f,currentTime,gpsdata.data)
              self.track.append((currentTime,lat,lon))
          lastLat=lat
          lastLon=lon
      except Exception as e:
        pass
      #TODO: compute more exact sleeptime
      time.sleep(self.getFloatParam("interval"))
      
  def getTrack(self):
    return self.track
        
          
          
    
    

#a worker to interface with gpsd
#as gpsd is not really able to handle dynamically assigned ports correctly, 
#we monitor first if the device file exists and only start gpsd once it is visible
#when it becomes visible, gpsd will be started (but not in background)
#when we receive no data from gpsd until timeout, we will kill it and enter device monitoring again
#this reader should only be used if we really have some very special devices that directly need 
#to communicate with gpsd
#data fetched here will not be available at any outgoing NMEA interface!
class AVNGpsd(AVNWorker):
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
  #should be overridden
  def getName(self):
    return "GPSDReader"
  
  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    return 'AVNGpsd'
  #return the default cfg values
  #if the parameter child is set, the parameter for a child node
  #must be returned, child nodes are added to the parameter dict
  #as an entry with childnodeName=[] - the child node configs being in the list
  @classmethod
  def getConfigParam(cls,child=None):
    if not child is None:
      return None
    return {
            'device':None,
            'baud': 4800, #the initial baudrate
            'gpsdcommand':'/usr/sbin/gpsd -b -n -N',
            'timeout': 40, #need this timeout to be able to sync on 38400
            'port': None, #port for communication with gpsd
            'nocheck': 'false', #do not check the device before
            }
  
  @classmethod
  def createInstance(cls,cfgparam):
    if not hasGpsd:
      AVNLog.warn("gpsd not available, ignore configured reader ")
      return None
    return AVNGpsd(cfgparam)
  
  def stopChildren(self):
    if not self.gpsdproc is None:
      print "stopping gpsd"
      self.gpsdproc.terminate()
  
  def run(self):
    deviceVisible=False
    reader=None
    self.gpsdproc=None
    init=True
    while True:
      device=self.getParamValue('device')
      port=self.getIntParam('port')
      baud=self.getIntParam('baud')
      gpsdcommand="%s -S %d %s" %(self.getStringParam('gpsdcommand'),port,device)
      gpsdcommandli=gpsdcommand.split()
      timeout=self.getFloatParam('timeout')
      noCheck=self.getBoolParam('nocheck')
      self.setName("[%s]%s-dev:%s-port:%d"%(AVNLog.getThreadId(),self.getName(),device,port))
      if init:
        AVNLog.info("started for %s with command %s, timeout %f",device,gpsdcommand,timeout)
        self.setInfo('main', "waiting for device %s"%(str(device)), AVNWorker.Status.STARTED)
        init=False
      if not ( os.path.exists(device) or noCheck):
        self.setInfo("device not visible")
        AVNLog.debug("device %s still not visible, continue waiting",device)
        time.sleep(timeout/2)
        continue
      else:
        if hasSerial and not noCheck:
          #we first try to open the device by our own to see if this is possible
          #for bluetooth the device is there but open will fail
          #so we would avoid starting gpsd...
          try:
            AVNLog.debug("try to open device %s",device)
            ts=serial.Serial(device,timeout=timeout,baudrate=baud)
            AVNLog.debug("device %s opened, try to read 1 byte",device)
            bytes=ts.read(1)
            ts.close()
            if len(bytes)<=0:
              raise Exception("unable to read data from device")
          except:
            AVNLog.debug("open device %s failed: %s",device,traceback.format_exc())
            time.sleep(timeout/2)
            continue
        AVNLog.info("device %s became visible, starting gpsd",device)
        self.setInfo('main', "starting gpsd with command"%(gpsdcommand), AVNWorker.Status.STARTED)
        try:
          self.gpsdproc=subprocess.Popen(gpsdcommandli, stdin=None, stdout=None, stderr=None,shell=False,universal_newlines=True,close_fds=True)
          reader=GpsdReader(self.navdata, port, "GPSDReader[Reader] %s at %d"%(device,port),self)
          reader.start()
          self.setInfo("gpsd started")
          self.setInfo('main', "gpsd running with command"%(gpsdcommand), AVNWorker.Status.STARTED)
        except:
          AVNLog.debug("unable to start gpsd with command %s: %s",gpsdcommand,traceback.format_exc())
          try:
            self.gpsdproc.wait()
          except:
            pass
          self.setInfo('main', "unable to start gpsd with command"%(gpsdcommand), AVNWorker.Status.STARTED)
          time.sleep(timeout/2)
          continue
        AVNLog.debug("started gpsd with pid %d",self.gpsdproc.pid)
        while True:
          if not reader.status:
            AVNLog.warn("gpsd reader thread stopped")
            break
          ctime=time.time()
          if reader.lasttime < (ctime-timeout):
            AVNLog.warn("gpsd reader timeout")
            break
          else:
            self.setInfo("receiving")
          #TODO: read out gpsd stdout/stderr
          time.sleep(2)
        #if we arrive here, something went wrong...
        self.setInfo('main',"gpsd stopped",AVNWorker.Status.ERROR)
        if not self.gpsdproc is None:
          try:
            self.gpsdproc.terminate()
          except: 
            pass
          #wait some time for the subproc to finish
          numwait=20 #2s
          retcode=None
          while numwait > 0:
            self.gpsdproc.poll()
            if not self.gpsdproc.returncode is None:
              numwait=0
              retcode=self.gpsdproc.returncode 
              break
            time.sleep(0.1)
            numwait-=1
          self.gpsdproc=None
          if retcode is None:
            AVNLog.error("unable to properly stop gpsd process, leave it running")
          else:
            AVNLog.info("gpsd stopped, waiting for reader thread")
            if reader is not None:
              try:
                reader.join(10)
                AVNLog.info("reader thread successfully stopped")
              except:
                AVNLog.error("unable to stop gpsd reader thread within 10s")
            reader=None  
        #end of loop - device available
        time.sleep(timeout/2)
          
        
      
#a reader thread for the gpsd reader
class GpsdReader(threading.Thread):
  def __init__(self, navdata,port,name,infoHandler):
    self.navdata=navdata
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(name)
    #the status shows if the gpsd reader still has data
    self.lasttime=time.time()
    self.status=True
    self.port=port
    self.infoHandler=infoHandler
  def run(self):
    infoName=self.name
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.name))
    self.lasttime=time.time()
    AVNLog.debug("gpsd reader thread started at port %d",self.port)
    self.infoHandler.setInfo(infoName,"started at port %d"%(self.port),AVNWorker.Status.STARTED)
    try:
      #try for 10s to open the gpsd port
      timeout=10
      connected=False
      time.sleep(1)
      while timeout > 0 and not connected:
        timeout-=1
        try:
          session=gps.gps(port=self.port)
          connected=True
        except:
          AVNLog.debug("gpsd reader open comm exception %s %s",traceback.format_exc(),("retrying" if timeout > 1 else ""))
          time.sleep(1)
      if not connected:
        raise Exception("unable to connect to gpsd within 10s")    
      session.stream(gps.WATCH_ENABLE)
      hasNMEA=False
      self.infoHandler.setInfo(infoName,"start receiving",AVNWorker.Status.STARTED)
      for report in session:
        AVNLog.debug("received gps data : %s",pprint.pformat(report))
        self.lasttime=time.time()
        #gpsd has an extremly broken interface - it has a dictwrapper that not really can act as a dict
        #so we have to copy over...
        ddata={}
        for k in report.keys():
          ddata[k]=report.get(k)
        entry=AVNDataEntry.fromData(ddata)
        if not entry is None:
          self.navdata.addEntry(entry)
          if not hasNMEA:
            self.infoHandler.setInfo(infoName,"receiving NMEA",AVNWorker.Status.NMEA)
            hasNMEA=True
    except:
      AVNLog.debug("gpsd reader exception %s",traceback.format_exc())
      pass
    AVNLog.debug("gpsd reader exited")
    self.status=False
    self.infoHandler.setInfo(infoName,"exited",AVNWorker.Status.INACTIVE)

#a Worker for feeding data trough gpsd (or directly to the navdata)
#it uses (if enabled) gpsd as a decoder by opening a local listener
#and piping data trough gpsd
#as an input there is the mehod addNMEALine that will add a line of NMEA data
class AVNGpsdFeeder(AVNGpsd):
  @classmethod
  def getConfigName(cls):
    return "AVNGpsdFeeder"
  
  @classmethod
  def getConfigParam(cls, child=None):
    return {'listenerPort':None, #our port that GPSD connects to
            'port':None,         #the GPSD port
            'maxList': 300,      #len of the input list
            'useGpsd': 'true',   #if set to false, we only have very limited support, listenerPort and port are ignored
            'feederSleep': 0.1,  #time in s the feeder will sleep if there is no data
            'gpsdcommand':'/usr/sbin/gpsd -b -n -N',
            'timeout': 40,       #??? do we still need this?
            'name': ''           #if there should be more then one reader we must set the name
            }
    
  
  @classmethod
  def createInstance(cls, cfgparam):
    
    return AVNGpsdFeeder(cfgparam)
  
  @classmethod
  def getStartupGroup(cls):
    return 1
  
  def __init__(self,cfgparam):
    AVNGpsd.__init__(self, cfgparam)
    self.listlock=threading.Lock()
    self.list=[]
    self.history=[]
    self.sequence=0
    self.maxlist=self.getIntParam('maxList', True)
    self.gpsdproc=None
    name=self.getStringParam('name')
    if not name is None and not name == "":
      self.setName(name)
    else:
      self.setName(self.getConfigName())
    if not hasGpsd and self.getBoolParam('useGpsd'):
      raise Exception("no gpsd installed, cannot run %s"%(cls.getConfigName()))
    
  def getName(self):
    return self.name
  
  def addNMEA(self,entry):
    rt=False
    ll=0
    hl=0
    if len(entry) < 5:
      AVNlog.debug("addNMEA: ignoring short data %s",entry)
      return False
    self.listlock.acquire()
    self.sequence+=1
    if len(self.list) >=self.maxlist:
      self.list.pop(0) #TODO: priorities?
    if len(self.history) >= self.maxlist:
      self.history.pop(0)
    self.list.append(entry)
    ll=len(self.list)
    self.history.append(entry)
    hl=len(self.history)
    rt=True
    self.listlock.release()
    AVNLog.debug("addNMEA listlen=%d history=%d data=%s",ll,hl,entry)
    return rt
  
  #fetch an entry from the feeder list
  def popListEntry(self):
    rt=None
    self.listlock.acquire()
    if len(self.list)>0:
      rt=self.list.pop(0)
    self.listlock.release()
    return rt
  #fetch entries from the history
  #only return entries with higher sequence
  #return a tuple (lastSequence,[listOfEntries])
  #when sequence == None or 0 - just fetch the topmost entries (maxEntries)
  def fetchFromHistory(self,sequence,maxEntries=10):
    seq=0
    list=[]
    if maxEntries< 0:
      maxEntries=0
    if sequence is None:
      sequence=0
    self.listlock.acquire()
    seq=self.sequence
    if sequence==0:
      sequence=seq-maxEntries
    if sequence < 0:
      sequence=0
    if seq > sequence:
      if (seq-sequence) > maxEntries:
        seq=sequence+maxEntries
      start=seq-sequence
      list=self.history[-start:]
    self.listlock.release()
    return (seq,list)
  
    
  #a thread to feed the gpsd socket
  def feed(self):
    threading.current_thread().setName("[%s]%s[gpsd feeder]"%(AVNLog.getThreadId(),self.getName()))
    infoName="gpsdFeeder"
    while True:
      try:
        listener=socket.socket()
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        lport=self.getIntParam('listenerPort')
        listener.bind(('localhost',lport))
        self.setInfo(infoName, "listening at port %d"%(lport), AVNWorker.Status.STARTED)
        listener.listen(1)
        AVNLog.info("feeder listening at port address %s",str(listener.getsockname()))
        while True:
          outsock,addr=listener.accept()
          self.setInfo(infoName, "gpsd connected from %s"%(str(addr)), AVNWorker.Status.RUNNING)
          AVNLog.info("feeder - gpsd connected from %s",str(addr))
          try:
            while True:
              data=self.popListEntry()
              if not data is None:
                outsock.sendall(data)
              else:
                time.sleep(self.getFloatParam('feederSleep'))
          except Exception as e:
            AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())
      except Exception as e:
        AVNLog.warn("feeder unable to open listener port(%s), retrying",traceback.format_exc())
      time.sleep(10)
  
  #a standalone feeder that uses our bultin methods
  
  def standaloneFeed(self):
    infoName="standaloneFeeder"
    threading.current_thread().setName("[%s]%s[standalone feed]"%(AVNLog.getThreadId(),self.getName()))
    AVNLog.info("standalone feeder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo(infoName, "running", AVNWorker.Status.RUNNING)
    while True:
      try:
        while True:
          data=self.popListEntry()
          if not data is None:
            nmeaParser.parseData(data)
          else:
            time.sleep(self.getFloatParam('feederSleep'))
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())
    
    
  #this is the main thread 
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    feeder=None
    if self.getBoolParam('useGpsd'):
      feeder=threading.Thread(target=self.feed)
    else:
      feeder=threading.Thread(target=self.standaloneFeed)
    feeder.daemon=True
    feeder.start()
    time.sleep(2) # give a chance to have the socket open...   
    while True:
      if self.getBoolParam('useGpsd'):
        port=self.getIntParam('port')
        device="tcp://localhost:%d"%(self.getIntParam('listenerPort'))
        gpsdcommand="%s -S %d %s" %(self.getStringParam('gpsdcommand'),port,device)
        gpsdcommandli=gpsdcommand.split()
        try:
          self.setInfo('main', "starting gpsd with command %s"%(gpsdcommand), AVNWorker.Status.STARTED)
          AVNLog.debug("starting gpsd with command %s, starting reader",gpsdcommand)
          self.gpsdproc=subprocess.Popen(gpsdcommandli, stdin=None, stdout=None, stderr=None,shell=False,universal_newlines=True,close_fds=True)
          
          reader=GpsdReader(self.navdata, port, "AVNGpsdFeeder[Reader] %s at %d"%(device,port),self)
          reader.start()
          self.setInfo('main', "gpsd running with command %s"%(gpsdcommand), AVNWorker.Status.STARTED)
        except:
          self.setInfo('main', "unable to start gpsd with command %s"%(gpsdcommand), AVNWorker.Status.ERROR)
          AVNLog.debug("unable to start gpsd with command %s: %s",gpsdcommand,traceback.format_exc())
          try:
            self.gpsdproc.wait()
          except:
            pass
          time.sleep(timeout/2)
          continue
        AVNLog.info("started gpsd with pid %d",self.gpsdproc.pid)
        self.setInfo('main', "gpsd running with command %s"%(gpsdcommand), AVNWorker.Status.RUNNING)
      while True:
        time.sleep(5)
        if not self.gpsdproc is None:
          self.gpsdproc.poll()
          if not self.gpsdproc.returncode is None:
            AVNLog.warn("gpsd terminated unexpectedly, retrying")
            break


#a base class for socket readers
#this should not directly be instantiated, instead classes doing socket reading
#should derive from this
#the derived class must have the setInfo,writeData methods
class SocketReader():
  def readSocket(self,sock,infoName,timeout=None):
    pattern=AVNUtil.getNMEACheck()
    peer="unknown"
    try:
      peer="%s:%d"%sock.getpeername()
    except:
      pass
    AVNLog.info("connection to %s established, start reading",peer)
    self.setInfo(infoName, "socket connected", AVNWorker.Status.RUNNING)
    buffer=""
    hasNMEA=False
    try:
      while True:
        data = sock.recv(1024)
        if len(data) == 0:
          AVNLog.info("connection lost")
          break
        buffer=buffer+data.decode(errors='ignore')
        lines=buffer.splitlines(True)
        if lines[-1][-1]=='\n':
          #last one ends with nl
          for l in lines:
            if pattern.match(l):
              self.writeData(l)
              if not hasNMEA:
                self.setInfo(infoName, "receiving", AVNWorker.Status.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",l)
          buffer=''
        else:
          for i in range(len(lines)-1):
            if pattern.match(lines[i]):
              self.writeData(lines[i])
              if not hasNMEA:
                self.setInfo(infoName, "receiving", AVNWorker.Status.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",lines[i])
          if len(lines) > 0:
            buffer=lines[-1]
        if len(buffer) > 4096:
          AVNLog.debug("no line feed in long data, stopping")
          break
      sock.close()
    except Exception as e:
      AVNLog.debug("exception while reading from socket: %s",traceback.format_exc())
      pass
    try:
      sock.close()
    except:
      pass
    AVNLog.info("disconnected from socket %s",peer)
    self.setInfo(infoName, "socket to %s disconnected"%(peer), AVNWorker.Status.ERROR)

 
#a Worker for reading bluetooth devices
#it uses a feeder to handle the received data
class AVNBlueToothReader(AVNWorker,SocketReader):
  @classmethod
  def getConfigName(cls):
    return "AVNBlueToothReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    rt={
        'maxDevices':5,
        'deviceList':'',  #is set (, separated) only connect to those devices
        'feederName':'',  #if set, use this feeder
    }
    return rt
  
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasBluetooth:
      raise Exception("no bluetooth installed, cannot run %s"%(cls.getConfigName()))
    return AVNBlueToothReader(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.writeData=None
    
  def getName(self):
    return "AVNBlueToothReader"
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feeder=AVNUtil.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam('feederName'))
    self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
   
  #return True if added
  def checkAndAddAddr(self,addr):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=1
        rt=True
    self.maplock.release()
    return rt
  
  def removeAddr(self,addr):
    self.maplock.acquire()
    try:
      self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
 
  #a thread to open a bluetooth socket and read from it until
  #disconnected
  def readBT(self,host,port):
    infoName="BTReader-%s"%(host)
    threading.current_thread().setName("[%s]%s[Reader %s]"%(AVNLog.getThreadId(),self.getName(),host))
    AVNLog.debug("started bluetooth reader thread for %s:%s",str(host),str(port))
    self.setInfo(infoName, "connecting", AVNWorker.Status.STARTED)
    try:
      sock=bluetooth.BluetoothSocket( bluetooth.RFCOMM )
      sock.connect((host, port))
      AVNLog.info("bluetooth connection to %s established",host)
      self.readSocket(sock,infoName)
      sock.close()
    except Exception as e:
      AVNLog.debug("exception fro bluetooth device: %s",traceback.format_exc())
      try:
        sock.close()
      except:
        pass
    AVNLog.info("disconnected from bluetooth device ")
    self.setInfo(infoName, "dicsonnected", AVNWorker.Status.INACTIVE)
    self.removeAddr(host)
              
  
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the socket open...   
    #now start an endless loop with BT discovery...
    self.setInfo('main', "discovering", AVNWorker.Status.RUNNING)
    while True:
      service_matches=[]
      try:
        AVNLog.debug("starting BT discovery")
        service_matches = bluetooth.find_service(uuid = bluetooth.SERIAL_PORT_CLASS)
      except Exception as e:
        AVNLog.debug("exception when querying BT services %s, retrying after 10s",traceback.format_exc())
      if len(service_matches) == 0:
        time.sleep(10)
        continue
      AVNLog.ld("found bluetooth devices",service_matches)
      filter=[]
      filterstr=self.getStringParam('devicelist')
      if not filterstr is None and not filterstr=='':
        filter=filterstr.split(',') 
      for match in service_matches:
        port = match["port"]
        name = match["name"]
        host = match["host"]
        found=False
        if len(filter) > 0:
          if host in filter:
            found=True
          else:
            AVNLog.debug("ignoring device %s as it is not in the list #%s#",host,filterstr)
        else:
          found=True
        if found and self.checkAndAddAddr(host):
          try:
            AVNLog.info("found new bluetooth device %s",host)
            handler=threading.Thread(target=self.readBT,args=(host,port))
            handler.daemon=True
            handler.start()
            #TDOD: what about join???
          except Exception as e:
            AVNLog.warn("unable to start BT handler %s",traceback.format_exc())
            self.removeAddr(host)
      time.sleep(10)
      
      
#a worker that will use udev to find serial devices
#based on the configuration it will open available devices and read data from them
class AVNUsbSerialReader(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUsbSerialReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      #get the default configuration for a serial reader
      rt=SerialReader.getConfigParam().copy()
      rt.update({
          'port': 0,        #we do not use this
          'name':'',
          'maxDevices':5,   #this includes preconfigured devices!
          'feederName':'',  #if set, use this feeder
          'allowUnknown':'true' #allow devices that are not configured
          })
      return rt
    if child == "UsbDevice":
      return cls.getSerialParam()
    return None
  #get the parameters for an usb device
  @classmethod
  def getSerialParam(cls):
    rt=SerialReader.getConfigParam().copy()
    rt.update({
        'port': 0,
        'name':'',    #will be set automatically
        'usbid':None, #an identifier of the USB device 
                      #.../1-1.3.1:1.0/ttyUSB2/tty/ttyUSB2 - identifier would be 1-1.3.1
               })
    return rt
  
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasUdev:
      raise Exception("no pyudev installed, cannot run %s"%(cls.getConfigName()))
    return AVNUsbSerialReader(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.writeData=None
    self.setName(self.getName())
    
  def getName(self):
    return "AVNUsbSerialReader"
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feeder=AVNUtil.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
    self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
   
  #return True if added
  def checkAndAddHandler(self,addr,handler,device):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=(handler,device)
        rt=True
    self.maplock.release()
    return rt
  
  def removeHandler(self,addr):
    rt=None
    self.maplock.acquire()
    try:
      rt=self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
    if rt is None:
      return None
    return rt[0]
    
  #param  a dict of usbid->device
  #returns a dict: usbid->start|stop|keep
  def getStartStopList(self,handlerlist):
    rt={}
    self.maplock.acquire()
    for h in handlerlist.keys():
      if h in self.addrmap:
        if handlerlist[h] != self.addrmap[h][1]:
          rt['h']='restart'
        else:
          rt[h]='keep'
      else:
        rt[h]='start'
    for h in self.addrmap.keys():
      if not h in rt:
        rt[h]='stop'
    self.maplock.release()
    return rt
  
  def usbIdFromPath(self,path):
    rt=re.sub('/ttyUSB.*','',path).split('/')[-1]
    return rt
  
  def getParamByUsbId(self,usbid):
    configuredDevices=self.param.get('UsbDevice')
    if configuredDevices is None:
      return None
    for dev in configuredDevices:
      if usbid==dev['usbid']:
        return dev
    return None
  
  def setParameterForSerial(self,param,usbid,device):
    rt=param.copy()
    rt.update({
               'name':"%s-%s"%(usbid,device),
               'port':device
               })
    return rt

  #a thread method to run a serial reader
  def serialRun(self,reader,addr):
    try:
      reader.run()
    except:
      pass
    AVNLog.debug("serial reader for %s finished",addr)
    self.removeHandler(addr)
  
  #param: a dict key being the usb id, value the device node
  def checkDevices(self,devicelist):
    startStop=self.getStartStopList(devicelist)
    for usbid in startStop:
      if startStop[usbid]=='start':
        AVNLog.debug("must start handler for %s at %s",usbid,devicelist[usbid])
        param=self.getParamByUsbId(usbid)
        type="anonymous"
        if param is None:
          if not self.getBoolParam('allowUnknown'):
            AVNLog.debug("unknown devices not allowed, skip start of %s at %s",usbid,devicelist[usbid])
            continue
          param=self.setParameterForSerial(self.getParam(),usbid,devicelist[usbid])
        else:
          type="known"
          param=self.setParameterForSerial(param, usbid, devicelist[usbid])
        reader=SerialReader(param, None, self.writeData, self)
        res=self.checkAndAddHandler(usbid, reader,devicelist[usbid])
        if not res:
            AVNLog.debug("max number of readers already reached, skip start of %s at %s",usbid,devicelist[usbid])
            continue
        readerThread=threading.Thread(target=self.serialRun,args=(reader,usbid))
        readerThread.daemon=True
        readerThread.start()
        AVNLog.info("started reader for %s device  %s at %s",type,usbid,devicelist[usbid])
      if startStop[usbid]=='stop' or startStop[usbid]=='restart':
        #really starting is left to the audit...
        self.stopHandler(usbid)
          
  def stopHandler(self,usbid):
    AVNLog.debug("must stop handler for %s",usbid)
    handler=self.removeHandler(usbid)
    if handler is None:
      #must have been a thread race... or another device
      return
    try:
      handler.stopHandler()
      AVNLog.info("stop handler for %s triggered",usbid)
    except:
      pass
    
        
  #start monitoring in separate thread
  #method will never return...
  def monitorDevices(self,context):
    self.setInfo('monitor', "running", AVNWorker.Status.RUNNING)
    threading.current_thread().setName("[%s]%s[monitor]"%(AVNLog.getThreadId(),self.getName()))
    AVNLog.info("start device monitoring")
    monitor = pyudev.Monitor.from_netlink(context)
    monitor.filter_by(subsystem='tty')
    AVNLog.info("start monitor loop")
    for deviceaction in monitor:
      action,device=deviceaction
      if action=='remove':
        usbid=self.usbIdFromPath(device.device_path)
        AVNLog.info("device removal detected %s",usbid)
        self.stopHandler(usbid)
      #any start handling we leave to the audit...
        
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    self.setInfo('main', "discovering", AVNWorker.Status.RUNNING)
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the feeder socket open...   
    #now start an endless loop with udev discovery...
    #any removal will be detected by the monitor (to be fast)
    #but we have an audit here anyway
    #the removal will be robust enough to deal with 2 parallel tries
    context=None
    init=True
    while True:
      currentDevices={}
      try:
        AVNLog.debug("starting udev discovery")
        if context is None:
          context=pyudev.Context()
        allDev=context.list_devices(subsystem='tty')
        for dev in allDev:
          if dev.parent is None or not dev.parent.subsystem == "usb-serial":
            continue
          usbid=self.usbIdFromPath(dev.device_path)
          AVNLog.debug("discovered usb serial tty device %s at %s (usbid=%s)",dev.device_node,str(dev),usbid)
          currentDevices[usbid]=dev.device_node
        self.checkDevices(currentDevices)
        if init:
          monitorThread=threading.Thread(target=self.monitorDevices,args=(context,))
          monitorThread.daemon=True
          monitorThread.start()
          init=False
      except Exception as e:
        AVNLog.debug("exception when querying usb serial devices %s, retrying after 10s",traceback.format_exc())
        context=None
      time.sleep(10)

#a worker to output data via a socket

class AVNSocketWriter(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNSocketWriter"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt={
          'port': None,      #local listener port
          'name':'',
          'maxDevices':5,   #max external connections
          'feederName':'',  #if set, use this feeder
          'filter': '',      #, separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters
          'address':''      #the local bind address
          };
      return rt
    return None
  
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNSocketWriter(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.setName(self.getName())
    
  def getName(self):
    return "AVNSocketWriter-%d"%(self.getIntParam('port'))
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feeder=AVNUtil.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
    self.feeder=feeder
    self.maplock=threading.Lock()
    self.addrmap={}
    AVNWorker.start(self) 
   
  #return True if added
  def checkAndAddHandler(self,addr,handler):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=handler
        rt=True
    self.maplock.release()
    return rt
  
  def removeHandler(self,addr):
    rt=None
    self.maplock.acquire()
    try:
      rt=self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
    if rt is None:
      return None
    return rt
  
  #check if the line matches a provided filter
  def checkFilter(self,line,filter):
    try:
      if filter is None:
        return True
      for f in filter:
        if f[0:1]=='$':
          if line[0:1]!='$':
            return False
          if f[1:4]==line[3:6]:
            return True
          return False
        if line.startswith(f):
          return True
    except:
      pass
    return False
  #the writer for a connected client
  def client(self,socket,addr):
    infoName="SocketWriter-%s"%(str(addr),)
    self.setName("[%s]%s-Writer %s"%(AVNLog.getThreadId(),self.getName(),str(addr)))
    self.setInfo(infoName,"sending data",AVNWorker.Status.RUNNING)
    filterstr=self.getStringParam('filter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    try:
      seq=0
      socket.sendall("avnav_server %s\r\n"%(VERSION))
      while True:
        seq,data=self.feeder.fetchFromHistory(seq,10)
        if len(data)>0:
          for line in data:
            if self.checkFilter(line, filter):
              socket.sendall(line)
        else:
          time.sleep(0.1)
        pass
    except Exception as e:
      AVNLog.info("exception in client connection %s",traceback.format_exc())
    AVNLog.info("client disconnected")
    socket.close()
    self.removeHandler(addr)        
        
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the feeder socket open...   
    #now start an endless loop with udev discovery...
    #any removal will be detected by the monitor (to be fast)
    #but we have an audit here anyway
    #the removal will be robust enough to deal with 2 parallel tries
    init=True
    listener=None
    while True:
      try:
        listener=socket.socket()
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind((self.getStringParam('address'),self.getIntParam('port')))
        listener.listen(1)
        AVNLog.info("listening at port address %s",str(listener.getsockname()))
        self.setInfo('main', "listening at %s"%(str(listener.getsockname()),), AVNWorker.Status.RUNNING)
        while True:
          outsock,addr=listener.accept()
          AVNLog.info("connect from %s",str(addr))
          allowAccept=self.checkAndAddHandler(addr,outsock)
          if allowAccept:
            clientHandler=threading.Thread(target=self.client,args=(outsock, addr))
            clientHandler.daemon=True
            clientHandler.start()
          else:
            try:
              outsock.close()
            except:
              pass
      except Exception as e:
        AVNLog.warn("exception on listener, retrying %s",traceback.format_exc())
        try:
          listener.close()
        except:
          pass
        break
          
  


#a Worker to directly read from a serial line using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
#if useFeeder is set, pipe the received data through our feeder
#this gives the chance to output them at NMEA output interfaces
class AVNSerialReader(AVNWorker):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSerialReader"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    cfg=SerialReader.getConfigParam()
    rt=cfg.copy()
    rt.update({
               'useFeeder':'false', #if set to true, pipe the data trough a feeder instead handling by its own
               'feederName':''      #if this one is set, we do not use the defaul feeder by this one
    })
    return rt
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasSerial:
      warn("serial readers configured but serial module not available, ignore them")
      return None
    rt=AVNSerialReader(cfgparam)
    return rt
    
  def __init__(self,param):
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial reader")
    self.writeData=None
    AVNWorker.__init__(self, param)
    
  
  def getName(self):
    return "SerialReader "+self.param['name']
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    if self.getBoolParam('useFeeder'):
      feedername=self.getStringParam('feederName')
      feeder=AVNUtil.findFeeder(feedername)
      if feeder is None:
        raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
      self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    reader=SerialReader(self.param, self.navdata if self.writeData is None else None, self.writeData,self) 
    reader.run()


#a Worker to read from a remote NMEA source via a socket
#can be used to chain avnav servers...
class AVNSocketReader(AVNWorker,SocketReader):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSocketReader"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    rt={
               'feederName':'',      #if this one is set, we do not use the defaul feeder by this one
               'host':None,
               'port':None,
               'timeout': 10,      #timeout for connect and waiting for data
               'minTime':0,        #if tthis is set, wait this time before reading new data (ms)
    }
    return rt
  @classmethod
  def createInstance(cls, cfgparam):
    if cfgparam.get('name') is None:
      cfgparam['name']="SocketReader"
    rt=AVNSocketReader(cfgparam)
    return rt
    
  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for socket reader")
    self.feederWrite=None
    AVNWorker.__init__(self, param)
    if param.get('name') is None:
      self.param['name']="SocketReader-%s-%d"%(self.param['host'],int(self.param['port']))
    
  
  def getName(self):
    return self.param['name']
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feedername=self.getStringParam('feederName')
    feeder=AVNUtil.findFeeder(feedername)
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
    self.feederWrite=feeder.addNMEA
    AVNWorker.start(self)
    
  def writeData(self,data):
    self.feederWrite(data)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s-%s:%d"%(AVNLog.getThreadId(),self.getName(),self.getStringParam('host'),self.getIntParam('port')))
    info="%s:%d"%(self.getStringParam('host'),self.getIntParam('port'))
    while True:
      try:
        self.setInfo('main',"trying to connect to %s"%(info,),AVNWorker.Status.INACTIVE)
        sock=socket.create_connection((self.getStringParam('host'),self.getIntParam('port')), self.getIntParam('timeout'))
        self.setInfo('main',"connected to %s"%(info,),AVNWorker.Status.RUNNING)
      except:
        AVNLog.info("exception while trying to connect to %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
        self.setInfo('main',"unable to connect to %s"%(info,),AVNWorker.Status.ERROR)
        time.sleep(2)
        continue
      AVNLog.info("successfully connected to %s:%d",self.getStringParam('host'),self.getIntParam('port'))
      try:
        self.readSocket(sock,'main')
      except:
        AVNLog.info("exception while reading from %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
      
        
        
                                        
  
  

#a HTTP server with threads for each request
class AVNHTTPServer(SocketServer.ThreadingMixIn,BaseHTTPServer.HTTPServer, AVNWorker):
  instances=0
  
  @classmethod
  def getConfigName(cls):
    return "AVNHttpServer"
  @classmethod
  def createInstance(cls, cfgparam):
    if cls.instances > 0:
      raise Exception("only one AVNHttpServer is allowed")
    cls.instances+=1
    return AVNHTTPServer(cfgparam,AVNHTTPHandler)
  @classmethod
  def getConfigParam(cls,child):
    if child == "Directory":
      return {
              "urlpath":None,
              "path":None
              }
    if child == "MimeType":
      return {
              'extension':None,
              'type':None
              }
    if not child is None:
      return None
    rt={
                     "basedir":".",
                     "navurl":"/viewer/avnav_navi.php", #those must be absolute with /
                     "index":"/viewer/avnav_viewer.html",
                     "chartbase": "maps", #this is the URL without leading /!
                     "httpPort":"8080",
                     "numThreads":"5",
                     "httpHost":""
        }
    return rt
  
  def __init__(self,cfgparam,RequestHandlerClass):
    self.basedir=cfgparam['basedir']
    if self.basedir==".":
      self.basedir=os.getcwd()
    pathmappings=None
    marray=cfgparam.get("Directory")
    if marray is not None:
      pathmappings={}
      for mapping in marray:
        pathmappings[mapping['urlpath']]=mapping['path']
    self.pathmappings=pathmappings
    self.navurl=cfgparam['navurl']
    self.overwrite_map=({
                              '.png': 'image/png'
                              })
    mtypes=cfgparam.get('MimeType')
    if mtypes is not None:
      for mtype in mtypes:
        self.overwrite_map[mtype['extension']]=mtype['type']
    server_address=(cfgparam['httpHost'],int(cfgparam['httpPort']))
    AVNWorker.__init__(self, cfgparam)
    BaseHTTPServer.HTTPServer.__init__(self, server_address, RequestHandlerClass, True)
  def getName(self):
    return "HTTPServer"
  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),"HTTPServer"))
    AVNLog.info("HTTP server "+self.server_name+", "+str(self.server_port)+" started at thread "+self.name)
    self.setInfo('main',"serving at port %s"%(str(self.server_port)),AVNWorker.Status.RUNNING)
    self.serve_forever()
    
  def handlePathmapping(self,path):
    if not self.pathmappings is None:
      for mk in self.pathmappings.keys():
        if path.find(mk) == 0:
          path=self.pathmappings[mk]+path[len(mk):]
          AVNLog.ld("remapped path to",path)
          return path
      path=os.path.join(self.basedir,path)
      return path
    else:
      return path
   

class AVNHTTPHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    self.id=None
    AVNLog.ld("receiver thread started",client_address)
    SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)
    
  def log_message(self, format, *args):
    if self.id is None:
      self.id=AVNLog.getThreadId()
      threading.current_thread().setName("[%s]HTTPHandler"%(self.id))
    AVNLog.debug(format,*args)
  def handlePathmapping(self,path):
    return self.server.handlePathmapping(path)
  
  #overwrite this from SimpleHTTPRequestHandler
  def send_head(self):
    path=self.translate_path(self.path)
    if path is None:
      return
    """Common code for GET and HEAD commands.

    This sends the response code and MIME headers.

    Return value is either a file object (which has to be copied
    to the outputfile by the caller unless the command was HEAD,
    and must be closed by the caller under all circumstances), or
    None, in which case the caller has nothing further to do.

    """
    
    f = None
    if os.path.isdir(path):
        if not self.path.endswith('/'):
            # redirect browser - doing basically what apache does
            self.send_response(301)
            self.send_header("Location", self.path + "/")
            self.end_headers()
            return None
        for index in "index.html", "index.htm":
            index = os.path.join(path, index)
            if os.path.exists(index):
                path = index
                break
        else:
            return self.list_directory(path)
    base, ext = posixpath.splitext(path)
    if ext in self.server.overwrite_map:
      ctype=self.server.overwrite_map[ext]
    else:
      ctype = self.guess_type(path)
    try:
        # Always read in binary mode. Opening files in text mode may cause
        # newline translations, making the actual size of the content
        # transmitted *less* than the content-length!
        f = open(path, 'rb')
    except IOError:
        self.send_error(404, "File not found")
        return None
    self.send_response(200)
    self.send_header("Content-type", ctype)
    fs = os.fstat(f.fileno())
    self.send_header("Content-Length", str(fs[6]))
    self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
    self.end_headers()
    return f
    
  #overwrite this from SimpleHTTPRequestHandler
  def translate_path(self, path):
      """Translate a /-separated PATH to the local filename syntax.

      Components that mean special things to the local file system
      (e.g. drive or directory names) are ignored.  (XXX They should
      probably be diagnosed.)

      """
      # abandon query parameters
      (path,sep,query) = path.partition('?')
      path = path.split('#',1)[0]
      path = posixpath.normpath(urllib.unquote(path))
      if path==self.server.navurl:
        self.handleNavRequest(path,query)
        return None
      if path=="" or path=="/":
        path=self.server.getStringParam('index')
        self.send_response(301)
        self.send_header("Location", path)
        self.end_headers()
        return None
      words = path.split('/')
      words = filter(None, words)
      path = ""
      for word in words:
          drive, word = os.path.splitdrive(word)
          head, word = os.path.split(word)
          if word in (".",".."): continue
          path = os.path.join(path, word)
      AVNLog.ld("request path/query",path,query)
      #pathmappings expect to have absolute pathes!
      return self.handlePathmapping(path)
  
  
  #return the first element of a request param if set
  
  def getRequestParam(self,param,name):
    pa=param.get(name)
    if pa is None:
      return None
    if len(pa) > 0:
      return pa[0]
    return None
      
  #handle a navigational query
  #request parameters:
  #request=gps&filter=TPV&bbox=54.531,13.014,54.799,13.255
  #request: gps,status,...
  #filter is a key of the map in the form prefix-suffix
  
  def handleNavRequest(self,path,query):
    requestParam=urlparse.parse_qs(query,True)
    requestType=requestParam.get('request')
    if requestType is None:
      requestType='gps'
    else:
      requestType=requestType[0]
    AVNLog.ld('navrequest',requestParam)
    try:
      rtj=None
      if requestType=='gps':
        rtj=self.handleGpsRequest(requestParam)
      if requestType=='ais':
        rtj=self.handleAISRequest(requestParam)
      if requestType=='track':
        rtj=self.handleTrackRequest(requestParam)
      if requestType=='status':
        rtj=self.handleStatusRequest(requestParam)
      if requestType=='debuglevel':
        rtj=self.handleDebugLevelRequest(requestParam)
      if requestType=='listCharts':
        rtj=self.handleListChartRequest(requestParam)
      if not rtj is None:
        self.send_response(200)
        if not requestParam.get('callback') is None:
          rtj="%s(%s);"%(requestParam.get('callback'),rtj)
          self.send_header("Content-type", "text/javascript")
        else:
          self.send_header("Content-type", "application/json")
        self.send_header("Content-Length", len(rtj))
        self.send_header("Last-Modified", self.date_time_string())
        self.end_headers()
        self.wfile.write(rtj)
        AVNLog.ld("request",path,requestType,query,rtj)
      else:
        raise Exception("empty response")
    except Exception as e:
          AVNLog.ld("unable to process request for ",path,query,traceback.format_exc())
          self.send_response(500);
          self.end_headers()
          return
  #return AIS targets
  #parameter: lat,lon,distance (in NM) - limit to this distance      
  def handleAISRequest(self,requestParam):
    rt=self.server.navdata.getFilteredEntries("AIS",[])
    lat=None
    lon=None
    dist=None
    try:
      lat=float(self.getRequestParam(requestParam, 'lat'))
      lon=float(self.getRequestParam(requestParam, 'lon'))
      dist=float(self.getRequestParam(requestParam, 'distance')) #distance in NM
    except:
      pass
    frt=[]
    if not lat is None and not lon is None and not dist is None:
      dest=(lat,lon)
      AVNLog.debug("limiting AIS to lat=%f,lon=%f,dist=%f",lat,lon,dist)
      for entry in rt.values():
        try:
          fentry=AVNUtil.convertAIS(entry.data)        
          mdist=AVNUtil.distance((fentry.get('lat'),fentry.get('lon')), dest)
          if mdist<=dist:
            fentry['distance']=mdist
            frt.append(fentry)
          else:
            AVNLog.debug("filtering out %s due to distance %f",str(fentry['mmsi']),mdist)
        except:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    else:
      for entry in rt.values():
        try:
          frt.append(AVNUtil.convertAIS(entry.data))
        except Exception as e:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    return json.dumps(frt)
  
  def handleGpsRequest(self,requestParam):
    rtv=self.server.navdata.getMergedEntries("TPV",[])
    return json.dumps(rtv.data)
  #query the current list of trackpoints
  #currently we only limit by maxnumber and interval (in s)
  def handleTrackRequest(self,requestParam):
    lat=None
    lon=None
    dist=None
    maxnum=60 #with default settings this is one hour
    interval=60
    try:
      maxnumstr=self.getRequestParam(requestParam, 'maxnum')
      if not maxnumstr is None:
        maxnum=int(maxnumstr)
      intervalstr=self.getRequestParam(requestParam, 'interval')
      if not intervalstr is None:
        interval=int(intervalstr)
    except:
      pass
    frt=[]
    if not trackWriter is None:
      frt=trackWriter.getTrackFormatted(maxnum,interval)
    return json.dumps(frt)
  def handleStatusRequest(self,requestParam):
    rt=[]
    for handler in allHandlers:
      entry={'configname':handler.getConfigName(),
             'config': handler.getParam(),
             'name':handler.getName(),
             'info':handler.getInfo()}
      rt.append(entry)       
    return json.dumps({'handler':rt})
  def handleDebugLevelRequest(self,requestParam):
    rt={'status':'ERROR','info':'missing parameter'}
    level=self.getRequestParam(requestParam,'level')
    if not level is None:
      crt=AVNLog.changeLogLevel(level)
      if crt:
        rt['status']='OK'
        rt['info']='set loglevel to '+str(level)
      else:
        rt['info']="invalid level "+str(level)
    return json.dumps(rt) 
  
  def handleListChartRequest(self,requestParam):
    chartbaseUrl=self.server.getStringParam('chartbase')
    rt={
        'status': 'ERROR',
        'info':'chart directory not found'}
    if chartbaseUrl is None:
      return json.dumps(rt)
    chartbaseDir=self.handlePathmapping(chartbaseUrl)
    if not os.path.isdir(chartbaseDir):
      rt['info']="chart directory %s not found"%(chartbaseDir)
      return json.dumps(rt)
    try:
      list = os.listdir(chartbaseDir)
    except os.error:
      rt['info']="unable to read chart directory %s"%(chartbaseDir)
      return json.dumps(rt)
    rt['status']='OK'
    rt['data']=[]
    list.sort(key=lambda a: a.lower())
    icon="avnav.jpg"
    AVNLog.debug("reading chartDir %s",chartbaseDir)
    for de in list:
      if de==".":
        continue
      if de=="..":
        continue
      dpath=os.path.join(chartbaseDir,de)
      if not os.path.isdir(dpath):
        continue
      if not os.path.isfile(os.path.join(dpath,navxml)):
        continue
      #TDOD: read title from avnav
      entry={
             'name':de,
             'url':"/"+chartbaseUrl+"/"+de
             }
      if os.path.exists(os.path.join(dpath,icon)):
        entry['icon']="/"+chartbaseUrl+"/"+icon
      AVNLog.ld("chartentry",entry)
      rt['data'].append(entry)
    num=len(rt['data'])
    rt['info']="read %d entries from %s"%(num,chartbaseDir)
    return json.dumps(rt)

#a worker to check the chart dirs
#and create avnav.xml...
class AVNChartHandler(AVNWorker):
  def __init__(self,param):
    self.param=param
    AVNWorker.__init__(self, param)
  @classmethod
  def getConfigName(cls):
    return "AVNChartHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'period': 30 #how long to sleep between 2 checks
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNChartHandler(cfgparam)
  def getName(self):
    return "AVNChartHandler"
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    server=None
    for h in allHandlers:
      if h.getConfigName()==AVNHTTPServer.getConfigName():
        server=h
        break
    if server is None:
      AVNLog.error("unable to find AVNHTTPServer")
      return
    AVNLog.info("charthandler started")
    while True:
      try:
        chartbase=server.getStringParam('chartbase')
        osdir=server.handlePathmapping(chartbase)
        if osdir is None or not os.path.isdir(osdir):
          AVNLog.error("unable to find a valid chart directory")
        else:
          for cd in os.listdir(osdir):
            chartdir=os.path.join(osdir,cd)
            if not os.path.isdir(chartdir):
              continue
            args=["","-i",chartdir]
            rt=create_overview.main(args)
            if rt == 0:
              AVNLog.info("created/updated %s in %s",navxml,chardir)
            if rt == 1:
              AVNLog.error("error creating/updating %s in %s",navxml,chartdir)
      except:
        AVNLog.error("error while trying to update charts %s",traceback.format_exc())
      time.sleep(self.getIntParam('period') or 10)   
    
      
def sighandler(signal,frame):
  global allHandlers
  for handler in allHandlers:
    try:
      handler.stopChildren()
    except:
      pass
  sys.exit(1)
        

def main(argv):
  global loggingInitialized,debugger,allHandlers,trackWriter
  debugger=sys.gettrace()
  workerlist=[AVNBaseConfig,AVNGpsdFeeder,AVNSerialReader,AVNGpsd,
              AVNHTTPServer,AVNTrackWriter,AVNBlueToothReader,AVNUsbSerialReader,
              AVNSocketWriter,AVNSocketReader,AVNChartHandler]
  cfgname=None
  usage="usage: %s [-q][-d][-p pidfile] [configfile] " % (argv[0])
  parser = optparse.OptionParser(
        usage = usage,
        version="1.0",
        description='av navserver')
  parser.add_option("-q", "--quiet", action="store_const", 
        const=100, default=logging.INFO, dest="verbose")
  parser.add_option("-d", "--debug", action="store_const", 
        const=logging.DEBUG, dest="verbose")
  parser.add_option("-p", "--pidfile", dest="pidfile", help="if set, write own pid to this file")
  (options, args) = parser.parse_args(argv[1:])
  if len(args) < 1:
    cfgname=os.path.join(os.path.dirname(argv[0]),"avnav_server.xml")
  else:
    cfgname=args[0]
  AVNLog.initLoggingInitial(options.verbose if not options.verbose is None else logging.INFO)
  cfg=AVNConfig(workerlist)
  allHandlers=cfg.readConfigAndCreateHandlers(cfgname)
  if allHandlers is None:
    AVNLog.error("unable to parse config file %s",cfgname)
    sys.exit(1)
  baseConfig=None
  for handler in allHandlers:
    if handler.getConfigName() == "AVNConfig":
      baseConfig=handler
    if handler.getConfigName() == "AVNTrackWriter":
      trackWriter=handler
  if baseConfig is None:
    #no entry for base config found - using defaults
    baseConfig=AVNBaseConfig(AVNBaseConfig.getConfigParam())
  navData=AVNNavData(float(baseConfig.param['expiryTime']),float(baseConfig.param['aisExpiryTime']),baseConfig.param['ownMMSI'])
  level=logging.INFO
  filename=os.path.join(os.path.dirname(argv[0]),"log","avnav.log")
  if not options.verbose is None:
    level=options.verbose
  else:    
    if not baseConfig.param.get("loglevel") is None:
      level=baseConfig.param.get("loglevel")
  AVNLog.ld("baseconfig",baseConfig.param)
  if not baseConfig.param.get("logfile") == "":
    filename=baseConfig.param.get("logfile")
  AVNLog.info("####start processing (logging to %s)####",filename)
  if not os.path.exists(os.path.dirname(filename)):
    os.makedirs(os.path.dirname(filename), 0777)
  AVNLog.initLoggingSecond(level, filename,baseConfig.getParam()['debugToLog'].upper()=='TRUE') 
  AVNLog.info("#### avnserver pid=%d start processing ####",os.getpid())
  if options.pidfile is not None:
    f=open(options.pidfile,"w")
    if f is not None:
      f.write(str(os.getpid())+"\n")
      f.close()
  #really start processing here - we start all handlers that have been configured
  signal.signal(signal.SIGINT, sighandler)
  signal.signal(signal.SIGTERM, sighandler)
  signal.signal(signal.SIGABRT, sighandler)
  try:
    for group in (1,2):
      for handler in allHandlers:
        try:
          if handler.getStartupGroup() == group:
            handler.startInstance(navData)
        except Exception:
          AVNLog.warn("unable to start handler : "+traceback.format_exc())
    AVNLog.info("All Handlers started")
    
    #---------------------------- main loop --------------------------------
    #check if we have a position and handle time updates
    hasFix=False
    lastsettime=0
    lastutc=datetime.datetime.utcnow();
    timeFalse=False
    
    while True:
      time.sleep(3)
      #query the data to get old entries being removed 
      curutc=datetime.datetime.utcnow();
      delta=curutc-lastutc;
      allowedBackTime=baseConfig.getIntParam('maxtimeback')
      if delta.total_seconds() < -allowedBackTime and allowedBackTime != 0:
        AVNLog.warn("time shift backward (%d seconds) detected, deleting all entries ",delta.total_seconds())
        navData.reset()
        hasFix=False
      lastutc=curutc
      curTPV=navData.getMergedEntries("TPV", [])
      if ( not curTPV.data.get('lat') is None) and (not curTPV.data.get('lon') is None):
        #we have some position
        if not hasFix:
          AVNLog.info("new GPS fix lat=%f lon=%f",curTPV.data.get('lat'),curTPV.data.get('lon'))
          hasFix=True
        #settime handling
        curTPVtime=curTPV.data.get('time')
        if not curTPVtime is None:
          try:
            AVNLog.debug("checking time diffs - new gpsts=%s",curTPVtime)
            curts=AVNUtil.gt(curTPVtime)
            AVNLog.debug("time diff check system utc %s - gps utc %s",curutc.isoformat(),curts.isoformat())
            allowedDiff=baseConfig.getIntParam('systimediff')
            settimecmd=baseConfig.getStringParam('settimecmd')
            settimeperiod=baseConfig.getIntParam('settimeperiod')
            if allowedDiff != 0 and settimecmd != "" and settimeperiod != 0:
            #check if the time is too far away and the period is reached
              if abs((curts-curutc).total_seconds()) > allowedDiff:
                timeFalse=True
                AVNLog.debug("UTC time diff detected system=%s, gps=%s",curutc.isoformat(),curts.isoformat())
                if lastsettime == 0 or (curutc-lastsettime).total_seconds() > settimeperiod:
                  AVNLog.warn("detected UTC time diff between system time %s and gps time %s, setting system time",
                              curutc.isoformat(),curts.isoformat())
                  #[MMDDhhmm[[CC]YY][.ss]]
                  newtime="%02d%02d%02d%02d%04d.%02d"%(curts.month,curts.day,curts.hour,curts.minute,curts.year,curts.second)
                  cmd=[settimecmd,newtime]
                  AVNLog.info("starting command %s"," ".join(cmd))
                  cmdThread=threading.Thread(target=AVNUtil.runCommand,args=(cmd,"setTime"))
                  cmdThread.start()
                  cmdThread.join(20)
                  if cmdThread.isAlive():
                    #AVNLog.error("unable to finish setting the system time within 40s")
                    pass
                  else:
                    pass
                  curutc=datetime.datetime.utcnow()
                  if abs((curts-curutc).total_seconds()) > allowedDiff:
                    AVNLog.error("unable to set system time, still above difference")
                  else:
                    AVNLog.info("setting system time succeeded")
                    lastsettime=curutc
                    timeFalse=False
              else:
                #time is OK now
                if timeFalse:
                  AVNLog.info("UTC system time is correct now")
                  timeFalse=False
            else:
              AVNLog.debug("no time check - disabled by parameter")
          except Exception as e:
              AVNLog.warn("exception when checking time diff %s",traceback.format_exc())          
      else:
        if hasFix:
          AVNLog.warn("lost GPS fix")
        hasFix=False
      #AVNLog.debug("entries for TPV: "+str(curTPV))
      curAIS=navData.getMergedEntries("AIS",[])
      #AVNLog.debug("entries for AIS: "+str(curAIS))  
  except Exception as e:
    AVNLog.error("Exception in main %s",traceback.format_exc())
    sighandler(None, None)
   
if __name__ == "__main__":
    main(sys.argv)
    
         
  
