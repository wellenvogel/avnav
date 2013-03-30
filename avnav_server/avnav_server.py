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

hasSerial=False
hasGpsd=False
loggingInitialized=False
allHandlers=[]
#should have a better solution then a global...
trackWriter=None



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


#### constants ######################

NM=1852 #meters for a nautical mile


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
    formatter=logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
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
    formatter=logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
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
  @classmethod
  def convertAIS(cls,aisdata):
    rt=aisdata.copy()
    rt['lat']=float(aisdata['lat'])/600000
    rt['lon']=float(aisdata['lon'])/600000
    rt['speed']=float(aisdata['speed'])/10
    return rt
  
  #parse an ISO8601 t8ime string
  #see http://stackoverflow.com/questions/127803/how-to-parse-iso-formatted-date-in-python
  #a bit limited to what we write into track files
  @classmethod
  def gt(cls,dt_str):
    dt, _, us= dt_str.partition(".")
    dt= datetime.datetime.strptime(dt, "%Y-%m-%dT%H:%M:%S")
    us= int(us.rstrip("Z"), 10)
    return dt + datetime.timedelta(microseconds=us)

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
      AVNLog.warn("unable to read config file %s",filename)
      return False
    try:
      self.currentHandlerData=None
      self.currentHandlerClass=None
      self.handlerInstances=[]
      parser=sax.parse(filename,self)
    except:
      AVNLog.warn("error parsing cfg file %s : %s",filename,traceback.format_exc())
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
        self.currentHandlerData=AVNWorker.parseConfig(attrs, handler.getConfigParam(None))
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
      #currently we only store position reports
      #see http://gpsd.berlios.de/AIVDM.html
      knownAISTypes=(1,2,3,5,18,19)
      try:
        type=int(data.get('type'))
      except:
        AVNLog.ld("no type in AIS data",data)
        return None
      if not type in knownAISTypes:
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
  def __init__(self,expiryTime):
    self.list={}
    self.listLock=threading.Lock()
    self.expiryTime=expiryTime
  
  #add an entry to the list
  #do not add if there is already such an entry with newer timestamp
  def addEntry(self,navEntry):
    if navEntry.timestamp is None:
      navEntry.timestamp=AVNUtil.utcnow()
    AVNLog.ld("AVNNavData add entry",navEntry)
    self.listLock.acquire()
    if navEntry.key in self.list:
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
              
        
  
  def __str__(self):
    rt="AVNNavData \n";
    idx=0
    self.listLock.acquire()
    for k in self.list.keys():
      rt+="   (%03d:%s)%s=%s\n" % (idx,time.strftime("%Y/%m/%d-%H:%M:%S ",time.gmtime(self.list[k].timestamp)),self.list[k].key,self.list[k].data)
    self.listLock.release()  
    return rt
  
#a base class for all workers
#this provides some config functions and a common interfcace for handling them
class AVNWorker(threading.Thread):
  def __init__(self,cfgparam):
    self.param=cfgparam
    self.status=False
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(self.getName())
    self.info="started"
  def getInfo(self):
    try:
      return self.info
    except:
      return "no info available"
  def setInfo(self,info):
    self.info=info
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
    if rt is None:
      return None
    else:
      return int(rt)
  
  def getBoolParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return None
    else:
      return rt.upper()=='TRUE'
    
  def getStringParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return None
    else:
      return str(rt)
  def getFloatParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return None
    else:
      return float(rt)
    
  
  #stop any child process (will be called by signal handler)
  def stopChildren(self):
    pass
  #should be overridden
  def getName(self):
    return "BaseWorker"
  
  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    raise Exception("getConfigClass must be overridden by derived class")
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
        raise SAXParseException(cls.getConfigName()+": missing mandatory parameter "+k)
      if v is None:
        sparam[k]=dv
      else:
        sparam[k]=v
    return sparam
  
  def startInstance(self,navdata):
    self.navdata=navdata
    self.start()

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
            'debugToLog': 'false'
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
      AVNLog.debug("%s: removed %d track entries older then %s",self.getName(),numremoved,cleanupTime.isoformat())
  
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
    f=None
    fname=None
    initial=True
    lastLat=None
    lastLon=None
    newFile=False
    while True:
      currentTime=datetime.datetime.utcnow();
      
      trackdir=self.getStringParam("trackdir")
      if trackdir == "":
        trackdir=os.path.join(os.path.dirname(sys.argv[0]),'tracks')
      if initial:
        AVNLog.info("%s started with dir=%s,interval=%d, distance=%d",
                self.getName(),
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
                self.info="reading"
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
        self.status=True
        self.info="writing"
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
      name="GPSDReader %s at %d"%(device,port)
      if init:
        AVNLog.info("%s: started for %s with command %s, timeout %f",name,device,gpsdcommand,timeout)
        init=False
      if not ( os.path.exists(device) or noCheck):
        self.setInfo("device not visible")
        AVNLog.debug("%s: device %s still not visible, continue waiting",name,device)
        time.sleep(timeout/2)
        continue
      else:
        if hasSerial and not noCheck:
          #we first try to open the device by our own to see if this is possible
          #for bluetooth the device is there but open will fail
          #so we would avoid starting gpsd...
          try:
            AVNLog.debug("%s: try to open device %s",name,device)
            ts=serial.Serial(device,timeout=timeout,baudrate=baud)
            AVNLog.debug("%s: device %s opened, try to read 1 byte",name,device)
            bytes=ts.read(1)
            ts.close()
            if len(bytes)<=0:
              raise Exception("unable to read data from device")
          except:
            AVNLog.debug("%s: open device %s failed: %s",name,device,traceback.format_exc())
            time.sleep(timeout/2)
            continue
        AVNLog.info("device %s became visible, starting gpsd",device)
        try:
          self.gpsdproc=subprocess.Popen(gpsdcommandli, stdin=None, stdout=None, stderr=None,shell=False,universal_newlines=True)
          reader=GpsdReader(self.navdata, port, "GPSDReader[Reader] %s at %d"%(device,port))
          reader.start()
          self.setInfo("gpsd started")
        except:
          AVNLog.debug("%s: unable to start gpsd with command %s: %s",name,gpsdcommand,traceback.format_exc())
          try:
            self.gpsdproc.wait()
          except:
            pass
          time.sleep(timeout/2)
          continue
        AVNLog.debug("%s: started gpsd with pid %d",name,self.gpsdproc.pid)
        while True:
          if not reader.status:
            AVNLog.warn("%s: gpsd reader thread stopped",name)
            break
          ctime=time.time()
          if reader.lasttime < (ctime-timeout):
            AVNLog.warn("%s: gpsd reader timeout",name)
            break
          else:
            self.setInfo("receiving")
          #TODO: read out gpsd stdout/stderr
          time.sleep(2)
        #if we arrive here, something went wrong...
        self.setInfo("gpsd stopped")
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
            AVNLog.error("%s: unable to properly stop gpsd process, leave it running",name)
          else:
            AVNLog.info("%s: gpsd stopped, waiting for reader thread",name)
            if reader is not None:
              try:
                reader.join(10)
                AVNLog.info("%s: reader thread successfully stopped",name)
              except:
                AVNLog.error("%s: unable to stop gpsd reader thread within 10s",name)
            reader=None  
        #end of loop - device available
        time.sleep(timeout/2)
          
        
      
#a reader thread for the gpsd reader
class GpsdReader(threading.Thread):
  def __init__(self, navdata,port,name):
    self.navdata=navdata
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(name)
    #the status shows if the gpsd reader still has data
    self.lasttime=time.time()
    self.status=True
    self.port=port
  def run(self):
    self.lasttime=time.time()
    AVNLog.debug("%s: gpsd reader thread started at port %d",self.name,self.port)
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
          AVNLog.debug("%s: gpsd reader open comm exception %s %s",self.name,traceback.format_exc(),("retrying" if timeout > 1 else ""))
          time.sleep(1)
      if not connected:
        raise Exception("%s: unable to connect to gpsd within 10s",self.name)    
      session.stream(gps.WATCH_ENABLE)
      for report in session:
        AVNLog.debug("%s: received gps data : %s",self.name,pprint.pformat(report))
        self.lasttime=time.time()
        #gpsd has an extremly broken interface - it has a dictwrapper that not really can act as a dict
        #so we have to copy over...
        ddata={}
        for k in report.keys():
          ddata[k]=report.get(k)
        entry=AVNDataEntry.fromData(ddata)
        if not entry is None:
          self.navdata.addEntry(entry)
    except:
      AVNLog.debug("%s: gpsd reader exception %s",self.name,traceback.format_exc())
      pass
    AVNLog.debug("%s: gpsd reader exited",self.name)
    self.status=False
 

#a Worker to directly read from a serial line using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
class AVNSerialReader(AVNWorker):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSerialReader"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    cfg={
               'port':None,
               'name':None,
               'timeout': 2,
               'baud': 4800,
               'bytesize': 8,
               'parity': 'N',
               'stopbits': 1,
               'xonxoff': 0,
               'rtscts': 0
               }
    return cfg
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
    AVNWorker.__init__(self, param)
  
  def getName(self):
    return "SerialReader "+self.param['name']
   
  #thread run method - just try forever  
  def run(self):
    f=None
    init=True
    isOpen=False
    while True:
      try:
        pnum=int(self.param['port'])
      except:
        pnum=self.param['port']
      baud=int(self.param['baud'])
      bytesize=int(self.param['bytesize'])
      parity=self.param['parity']
      stopbits=int(self.param['stopbits'])
      xonxoff=int(self.param['xonxoff'])
      rtscts=int(self.param['rtscts'])
      portname=self.param['port']
      timeout=float(self.param['timeout'])
      porttimeout=timeout*10
      name=self.getName()
      if init:
        AVNLog.info("%s: serial reader started for port %s, baudrate=%d, timeout=%f",name,portname,baud,timeout)
        init=False
      lastTime=time.time()
      try:
        f=serial.Serial(pnum,timeout=timeout,baudrate=baud,bytesize=bytesize,parity=parity,stopbits=stopbits,xonxoff=xonxoff,rtscts=rtscts)
        self.setInfo("port open")
      except Exception:
        self.setInfo("unable to open port")
        try:
          tf=traceback.format_exc(3).decode(errors='ignore')
        except:
          tf="unable to decode exception"
        AVNLog.debug("%s: Exception on opening %s : %s",name,portname,tf)
        if f is not None:
          try:
            f.close()
          except:
            pass
        time.sleep(porttimeout/2)
        continue
      AVNLog.debug("%s: %s opened",name,f.name)
      while True:
        bytes=0
        try:
          bytes=f.readline()
        except:
          AVNLog.debug("%s: Exception in serial read, close and reopen %s",name,portname)
          try:
            f.close()
            isOpen=False
          except:
            pass
          break
        if len(bytes)> 0:
          self.setInfo("receiving")
          if not isOpen:
            AVNLog.info("successfully opened %s",f.name)
            isOpen=True
          self.status=True
          self.parseData(bytes.decode('ascii',errors='ignore'))
          lastTime=time.time()
        if (time.time() - lastTime) > porttimeout:
          self.setInfo("timeout")
          f.close()
          if isOpen:
            AVNLog.info("%s: reopen port %s - timeout elapsed",name,portname)
            isOpen=False
          break
  
  #returns an iso 8601 timestring
  @classmethod
  def gpsTimeToTime(cls,gpstime):
    #we take day/month/year from our system and add everything else from the GPS
    gpsts=datetime.time(int(gpstime[0:2] or '0'),int(gpstime[2:4] or '0'),int(gpstime[4:6] or '0'),1000*int(gpstime[7:10] or '0'))
    AVNLog.ld("gpstime/gpsts",gpstime,gpsts)
    curdt=datetime.datetime.utcnow()
    gpsdt=datetime.datetime.combine(curdt.date(),gpsts)
    AVNLog.ld("curts/gpsdt before corr",curdt,gpsdt)
    #now correct the time if we are just chaning from one day to another
    #this assumes that our system time is not more then one day off...(???)
    if (curdt - gpsdt) > datetime.timedelta(hours=12) and curdt.time().hour < 12:
      #we are in the evening and the gps is already in the morning... (and we accidently put it to the past morning)
      #so we have to hurry up to the next day...
      gpsdt=datetime.datetime.combine(curdt+datetime.timedelta(1),gpsts)
    if (gpsdt - curdt) > datetime.timedelta(hours=12) and curdt.time().hour> 12:
      #now we are faster - the gps is still in the evening of the past day - but we assume it at the coming evening
      gpsdt=datetime.datetime.combine(curdt-datetime.timedelta(1),gpsts)
    AVNLog.ld("curts/gpsdt after corr",curdt,gpsdt)
    
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
    de.timestamp=AVNUtil.datetimeToTsUTC(timedate)
    self.navdata.addEntry(de)
  #parse a line of NMEA data and store it in the navdata array      
  def parseData(self,data):
    darray=data.split(",")
    if len(darray) < 1 or darray[0][0:1] != "$":
      AVNLog.debug(self.getName()+": invalid nmea data (len<1) "+data+" - ignore")
      return
    tag=darray[0][3:]
    rt={'class':'TPV','tag':tag}
    try:
      if tag=='GGA':
        rt['lat']=self.nmeaPosToFloat(darray[2],darray[3])
        rt['lon']=self.nmeaPosToFloat(darray[4],darray[5])
        rt['mode']=int(darray[6] or '0')
        self.addToNavData(rt, self.gpsTimeToTime(darray[1]))
        return
      if tag=='GLL':
        rt['mode']=1
        if len(darray > 6):
          rt['mode']= (0 if (darray[6] != 'A') else 2)
        rt['lat']=self.nmeaPosToFloat(darray[1],darray[2])
        rt['lon']=self.nmeaPosToFloat(darray[3],darray[4])
        self.addToNavData(rt, self.gpsTimeToTime(darray[5]))
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
    except Exception:
        AVNLog.debug(self.getName()+" error parsing nmea data "+str(data)+"\n"+traceback.format_exc())

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
                     "navurl":"avnav_navi.php",
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
    AVNLog.info("HTTP server "+self.server_name+", "+str(self.server_port)+" started at thread "+self.name)
    self.serve_forever()
   

class AVNHTTPHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    AVNLog.ld("receiver thread started",client_address)
    SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)
    
  def log_message(self, format, *args):
    AVNLog.debug("[%s]%s",threading.current_thread().name,format%args)
  
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
      if not self.server.pathmappings is None:
        for mk in self.server.pathmappings.keys():
          if path.find(mk) == 0:
            path=self.server.pathmappings[mk]+path[len(mk):]
            AVNLog.ld("remapped path to",path)
            return path
      path=os.path.join(self.server.basedir,path)
      return path
    
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
      if not rtj is None:
        self.send_response(200)
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
        fentry=AVNUtil.convertAIS(entry.data)
        mdist=AVNUtil.distance((fentry.get('lat'),fentry.get('lon')), dest)
        if mdist<=dist:
          fentry['distance']=mdist
          frt.append(fentry)
        else:
          AVNLog.debug("filtering out %s due to distance %f",str(fentry['mmsi']),mdist)
    else:
      for entry in rt.values():
        frt.append(AVNUtil.convertAIS(entry.data))
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
      if not maxnum is None:
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
      
def sighandler(signal,frame):
  global allHandlers
  for handler in allHandlers:
    handler.stopChildren()
  sys.exit(1)
        

def main(argv):
  global loggingInitialized,debugger,allHandlers,trackWriter
  debugger=sys.gettrace()
  workerlist=[AVNBaseConfig,AVNSerialReader,AVNGpsd,AVNHTTPServer,AVNTrackWriter]
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
  navData=AVNNavData(float(baseConfig.param['expiryTime']))
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
    for handler in allHandlers:
      try:
        handler.startInstance(navData)
      except Exception:
        AVNLog.warn("unable to start handler : "+traceback.format_exc())
    AVNLog.info("All Handlers started")
    hasFix=False
    while True:
      time.sleep(3)
      #query the data to get old entries being removed 
      curTPV=navData.getMergedEntries("TPV", [])
      if ( not curTPV.data.get('lat') is None) and (not curTPV.data.get('lon') is None):
        #we have some position
        if not hasFix:
          AVNLog.info("new GPS fix lat=%f lon=%f",curTPV.data.get('lat'),curTPV.data.get('lon'))
          hasFix=True
      else:
        if hasFix:
          AVNLog.warn("lost GPS fix")
        hasFix=False
      #AVNLog.debug("entries for TPV: "+str(curTPV))
      curAIS=navData.getMergedEntries("AIS",[])
      #AVNLog.debug("entries for AIS: "+str(curAIS))  
  except:
    sighandler(None, None)
   
if __name__ == "__main__":
    main(sys.argv)
    
         
  