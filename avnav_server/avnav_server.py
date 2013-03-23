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
import logging
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

hasSerial=False
loggingInitialized=False

try:
  import serial
  hasSerial=True
except:
  pass


#### constants ######################

NM=1852 #meters for a nautical mile

def ld(*parms):
  if not loggingInitialized:
    return
  logging.debug(' '.join(itertools.imap(repr,parms)))

def warn(txt):
  if not loggingInitialized:
    print "WARNING:"+time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt
    return
  logging.warning(time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt)
def log(txt):
  if not loggingInitialized:
    print "INFO:"+time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt
    return
  logging.info(time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt)
def err(txt):
  if not loggingInitialized:
    print "ERROR:"+time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt
    return
  print "ERROR: "+txt
  exit(1)
  


class AVNUtil():
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
    log("reading config "+filename)
    if not os.path.exists(filename):
      warn("unable to read config file "+filename)
      return False
    try:
      self.currentHandlerData=None
      self.currentHandlerClass=None
      self.handlerInstances=[]
      parser=sax.parse(filename,self)
    except:
      warn("error parsing cfg file "+filename+": "+traceback.format_exc())
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
      ld("added sub to handlerdata",name,childParam)
      return
    for handler in self.handlerList:
      if name==handler.getConfigName():
        self.currentHandlerClass=handler
        self.currentHandlerData=AVNWorker.parseConfig(attrs, handler.getConfigParam(None))
        ld("handler config started for ",name,self.currentHandlerData)
        return
    warn("unknown XML element "+name+" - ignoring")
    pass
  def endElement(self, name):
    if self.currentHandlerClass is None:
      return
    if not self.currentHandlerClass.getConfigName() == name:
      return #only create the handler when we are back at the handler level
    log("creating instance for "+name+" with param "+pprint.pformat(self.currentHandlerData))
    nextInstance=self.currentHandlerClass.createInstance(self.currentHandlerData)
    if not nextInstance is None:
      self.handlerInstances.append(nextInstance)
    else:
      warn("unable to create instance for handler "+name)
    self.currentHandlerClass=None
    self.currentHandlerData=None   
    pass
  def characters(self, content): 
    pass

#a data entry
#data is the decoded string
class AVNDataEntry():
  knownClasses=("TPV")
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
      log("data "+str(data)+" does not contain a class - ignore")
      return None
    if not dcls in cls.knownClasses:
      log("unknown class in "+str(data)+" - ignore")
      return None
    if dcls == 'TPV':
      tag=data.get('tag')
      if tag is None:
        log("no tag for TPV in "+str(data)+" - ignore")
        return None
      rt=AVNDataEntry()
      rt.key=cls.createKey(dcls, tag)
      rt.data=data
      ld("data item created",rt)
      return rt
    #we should not arrive here...
    return None
  
  #decode from json
  @classmethod
  def fromJson(cls,jsondata):
    data=None
    try:
      data=json.loads(jsondata)
    except:
      log("unable to parse json data "+jsondata+": "+traceback.format_exc())
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
    ld("AVNNavData add entry",navEntry)
    self.listLock.acquire()
    if navEntry.key in self.list:
      if self.list[navEntry.key].timestamp > navEntry.timestamp:
        log("not adding entry, older ts"+str(navEntry))
        self.listLock.release()
        return
    self.list[navEntry.key]=navEntry
    log("adding entry"+str(navEntry))
    self.listLock.release()
  #check for an entry being expired
  #the list must already being locked!
  #returns the entry or None
  def __checkExpired__(self,entry,key):
    et=AVNUtil.utcnow()-self.expiryTime
    if entry.timestamp < et:
      log("remove expired entry "+str(entry)+", et="+str(et))
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
    return json.dumps(self.getFilteredEntries(prefix, suffixlist))
  
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
        warn("mixing different classes in merge, ignore"+str(e))
        continue
      for k in e.data.keys():
        if not (k in rt.data) or newer or rt.data.get(k) is None:
          rt.data[k] = e.data[k]
    ld("getMergedEntries",prefix,suffixlist,rt)
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
    log(name+": serial reader started for "+portname)
    while True:
      lastTime=time.time()
      try:
        f=serial.Serial(pnum,timeout=timeout,baudrate=baud,bytesize=bytesize,parity=parity,stopbits=stopbits,xonxoff=xonxoff,rtscts=rtscts)
      except Exception:
        try:
          tf=traceback.format_exc(3).decode(errors='ignore')
        except:
          tf="unable to decode exception"
        log(name+"Exception on opening "+portname+" : "+tf)
        if f is not None:
          try:
            f.close()
          except:
            pass
        time.sleep(porttimeout/2)
        continue
      log(name+"Port "+f.name+" opened")
      while True:
        bytes=0
        try:
          bytes=f.readline()
        except:
          log(name+"Exception in serial read, close and reopen "+portname)
          try:
            f.close()
          except:
            pass
          break
        if len(bytes)> 0:
          self.status=True
          self.parseData(bytes.decode('ascii',errors='ignore'))
          lastTime=time.time()
        if (time.time() - lastTime) > porttimeout:
          f.close()
          log(name+ "Reopen port "+portname+" - timeout elapsed")
          break
  
  #returns an iso 8601 timestring
  @classmethod
  def gpsTimeToTime(cls,gpstime):
    #we take day/month/year from our system and add everything else from the GPS
    gpsts=datetime.time(int(gpstime[0:2] or '0'),int(gpstime[2:4] or '0'),int(gpstime[4:6] or '0'),1000*int(gpstime[7:10] or '0'))
    ld("gpstime/gpsts",gpstime,gpsts)
    curdt=datetime.datetime.utcnow()
    gpsdt=datetime.datetime.combine(curdt.date(),gpsts)
    ld("curts/gpsdt before corr",curdt,gpsdt)
    #now correct the time if we are just chaning from one day to another
    #this assumes that our system time is not more then one day off...(???)
    if (curdt - gpsdt) > datetime.timedelta(hours=12) and curdt.time().hour < 12:
      #we are in the evening and the gps is already in the morning... (and we accidently put it to the past morning)
      #so we have to hurry up to the next day...
      gpsdt=datetime.datetime.combine(curdt+datetime.timedelta(1),gpsts)
    if (gpsdt - curdt) > datetime.timedelta(hours=12) and curdt.time().hour> 12:
      #now we are faster - the gps is still in the evening of the past day - but we assume it at the coming evening
      gpsdt=datetime.datetime.combine(curdt-datetime.timedelta(1),gpsts)
    ld("curts/gpsdt after corr",curdt,gpsdt)
    
    return gpsdt
  
  #parse the nmea psoition fields:
  #gggmm.dec,N  - 1-3 characters grad, mm 2 didgits minutes
  #direction N,S,E,W - S,W being negative
  @classmethod
  def nmeaPosToFloat(cls,pos,direction):
    posa=pos.split('.')
    if len(posa) < 2:
      ld("invalid pos format",pos)
      return None
    grd=posa[0][-10:-2]
    min=posa[0][-2:]
    min=min+"."+posa[1]
    rt=float(grd)+float(min)/60;
    if rt > 0 and (direction == 'S' or direction == 'W'):
      rt=-rt;
    ld("pos",pos,rt)
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
      warn(self.getName()+": invalid nmea data (len<1) "+data+" - ignore")
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
        warn(self.getName()+" error parsing nmea data "+str(data)+"\n"+traceback.format_exc())

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
    if child == "AVNHttpServerDirectory":
      return {
              "urlpath":None,
              "path":None
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
    marray=cfgparam.get("AVNHttpServerDirectory")
    if marray is not None:
      pathmappings={}
      for mapping in marray:
        pathmappings[mapping['urlpath']]=mapping['path']
    self.pathmappings=pathmappings
    self.navurl=cfgparam['navurl']
    self.overwrite_map=({
                              '.png': 'image/png'
                              })
    server_address=(cfgparam['httpHost'],int(cfgparam['httpPort']))
    AVNWorker.__init__(self, cfgparam)
    BaseHTTPServer.HTTPServer.__init__(self, server_address, RequestHandlerClass, True)
  def getName(self):
    return "HTTPServer"
  
  def run(self):
    log("HTTP server "+self.server_name+", "+str(self.server_port)+" started at thread "+self.name)
    self.serve_forever()
   

class AVNHTTPHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    ld("receiver thread started",client_address)
    SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)
    
  def log_message(self, format, *args):
    log("[%s]%s" % (threading.current_thread().name,format%args))
  
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
      ld("request path/query",path,query)
      #pathmappings expect to have absolute pathes!
      if not self.server.pathmappings is None:
        for mk in self.server.pathmappings.keys():
          if path.find(mk) == 0:
            path=self.server.pathmappings[mk]+path[len(mk):]
            ld("remapped path to",path)
            return path
      path=os.path.join(self.server.basedir,path)
      return path
      
  #handle a navigational query
  #query could be: filter=TPV&bbox=54.531,13.014,54.799,13.255
  #filter is a key of the map in the form prefix-suffix
  def handleNavRequest(self,path,query):
    try:
      rtv=self.server.navdata.getMergedEntries("TPV",[])
      rt=json.dumps(rtv.data)
    except Exception as e:
      ld("unable to process request for ",path,query)
      self.send_response(500);
      self.end_headers()
      return
    self.send_response(200)
    self.send_header("Content-type", "application/json")
    self.send_header("Content-Length", len(rt))
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    self.wfile.write(rt)
    ld("request",path,query,rt)

      

        

def main(argv):
  global loggingInitialized
  cfgname=None
  usage="usage: %s <options> outdir indir|infile..." % (argv[0])
  parser = optparse.OptionParser(
        usage = usage,
        version="1.0",
        description='av navserver')
  parser.add_option("-q", "--quiet", action="store_const", 
        const=0, default=1, dest="verbose")
  parser.add_option("-d", "--debug", action="store_const", 
        const=2, dest="verbose")
  parser.add_option("-p", "--pidfile", dest="pidfile", help="if set, write own pid to this file")
  (options, args) = parser.parse_args(argv[1:])
  if len(args) < 1:
    cfgname=os.path.join(os.path.dirname(argv[0]),"avnav_server.xml")
  else:
    cfgname=args[0]
  cfg=AVNConfig([AVNSerialReader,AVNHTTPServer])
  allHandlers=cfg.readConfigAndCreateHandlers(cfgname)
  if allHandlers is None:
    err("unable to parse config file "+cfgname)
    sys.exit(1)
  navData=AVNNavData(float(cfg.parameters['expiryTime']))
  loglevel=int(cfg.parameters.get('debug') or '0')
  if options.verbose is not None:
    loglevel=options.verbose
  logging.basicConfig(level=logging.DEBUG if loglevel==2 else 
      (logging.ERROR if loglevel==0 else logging.INFO))
  loggingInitialized=True
  if options.pidfile is not None:
    f=open(options.pidfile,"w")
    if f is not None:
      f.write(str(os.getpid())+"\n")
      f.close()
  for handler in allHandlers:
    try:
      handler.startInstance(navData)
    except Exception:
      warn("unable to start handler : "+traceback.format_exc())
  log("All Handlers started")
  while True:
    time.sleep(3)
    log(str(navData))
    log("entries for TPV: "+str(navData.getMergedEntries("TPV", [])))  
 
if __name__ == "__main__":
    main(sys.argv)
    
         
  