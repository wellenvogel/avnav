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
import traceback
import pprint

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
  


class AVNConfig(sax.handler.ContentHandler):
  #serial port: on windows a device (0...n - mapping to com1...com[n+1])
  #             on linux/osx - a device name
  #if a parameter has a None value it must be set
  serialParam={
               'port':None,
               'name':None,
               'timeout': 2
               }
  def __init__(self):
    self.parameters={
                     "basedir":".",
                     "navurl":"avnav_navi.php",
                     "httpPort":"8080",
                     "numThreads":"5",
                     "debug":0
                     }
    self.serialreader={}
    self.gpsdreader={}
    sax.handler.ContentHandler.__init__(self)
    pass
  
  def readConfig(self,filename):
    log("reading config "+filename)
    if not os.path.exists(filename):
      warn("unable to read config file "+filename)
      return False
    try:
      parser=sax.parse(filename,self)
    except SAXParseException as e:
      warn("error parsing cfg file "+filename+": "+str(e))
      return False
    return True
    
  def startElement(self, name, attrs):
    if name == "AVNServer":
      for key in self.parameters.keys():
        val=attrs.get(key)
        if val is not None:
          log("read attribute "+key+"="+val)
          #TODO: param checks
          self.parameters[key]=val
    if name == "AVNSerialReader":
      sparam={}
      for k in self.serialParam.keys():
        dv=self.serialParam[k]
        v=attrs.get(k)
        if dv is None and v is None:
          raise SAXParseException("missing mandatory parameter "+k)
        if v is None:
          sparam[k]=dv
        else:
          sparam[k]=v
      self.serialreader[sparam['name']]=sparam
    pass
  def endElement(self, name):   
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
      log("unable to parse json data "+jsondata)
      return None
    return cls.fromData(data)
  
  def __str__(self):
    rt="AVNDataEntry: %s=%s" % (self.key,pprint.pformat(self.data))
    return rt
  def toJson(self):
    return json.dumps(self.data)
  

#the main List of navigational items received
class AVNNavData():
  def __init__(self):
    self.list={}
    self.listLock=threading.Lock()
  #TODO: locking!
  def addEntry(self,navEntry):
    if navEntry.timestamp is None:
      navEntry.timestamp=time.time()
    ld("AVNNavData add entry",navEntry)
    self.listLock.acquire()
    self.list[navEntry.key]=navEntry
    self.listLock.release()
  def getEntry(self,key):
    self.listLock.acquire()
    rt=self.list.get(key)
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
      self.listLock.release()
      return rt
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
    for k in fe:
      e=fe[k]
      if not rt.timestamp:
        e.timestamp=rt.timestamp
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
        if not (k in rt.data) or newer :
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
  
class AVNSerialReader(threading.Thread):
  def __init__(self,param,navdata):
    self.param=param
    self.navdata=navdata
    self.status=False
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial reader")
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(self.getName())
  
  def getName(self):
    return "SerialReader "+self.param['name']
   
  #thread run method - just try forever  
  def run(self):
    f=None
    try:
      num=int(self.param['port'])
    except:
      num=self.param['port']
    timeout=float(self.param['timeout'])
    porttimeout=timeout*10
    name=self.getName()
    log(name+": serial reader started for "+str(num))
    while True:
      lastTime=time.time()
      try:
        f=serial.Serial(num,timeout=2)
      except Exception as e:
        log(name+"Exception on opening "+str(num)+" : "+str(e))
        if f is not None:
          f.close()
        time.sleep(porttimeout/2)
        continue
      log(name+"Port "+f.name+" opened")
      while True:
        bytes=f.readline()
        if len(bytes)> 0:
          self.status=True
          self.parseData(bytes)
          lastTime=time.time()
        if (time.time() - lastTime) > porttimeout:
          f.close()
          log(name+ "Reopen port "+(num)+" - timeout elapsed")
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
    if (curdt - gpsdt) > datetime.timedelta(0,12) and curdt.time().hour < 12:
      #we are in the evening and the gps is already in the morning... (and we accidently put it to the past morning)
      #so we have to hurry up to the next day...
      gpsdt=datetime.datetime.combine(curdt+datetime.timedelta(1),gpsts)
    if (gpsdt - curdt) > datetime.timedelta(0,12) and curdt.time().hour> 12:
      #now we are faster - the gps is still in the evening of the past day - but we assume it at the coming evening
      gpsdt=datetime.datetime.combine(curdt-datetime.timedelta(1),gpsts)
    ld("curts/gpsdt after corr",curdt,gpsdt)
    return gpsdt.isoformat()
  
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
        rt['time']=self.gpsTimeToTime(darray[1])
        rt['lat']=self.nmeaPosToFloat(darray[2],darray[3])
        rt['lon']=self.nmeaPosToFloat(darray[4],darray[5])
        rt['mode']=int(darray[6] or '0')
        self.navdata.addEntry(AVNDataEntry.fromData(rt))
        return
      if tag=='GLL':
        rt['mode']=1
        if len(darray > 6):
          rt['mode']= (0 if (darray[6] != 'A') else 2)
        rt['time']=self.gpsTimeToTime(darray[5])
        rt['lat']=self.nmeaPosToFloat(darray[1],darray[2])
        rt['lon']=self.nmeaPosToFloat(darray[3],darray[4])
        self.navdata.addEntry(AVNDataEntry.fromData(rt))
        return
      if tag=='VTG':
        mode=darray[2]
        rt['track']=float(darray[1] or '0')
        if (mode == 'T'):
          #new mode
          rt['speed']=float(darray[5] or '0')*NM/3600
        else:
          rt['speed']=float(darray[3]or '0')*NM/3600
        self.navdata.addEntry(AVNDataEntry.fromData(rt))
        return
    except Exception as e:
        warn(self.getName()+" error "+str(e)+" parsing nmea data "+str(data)+"\n"+traceback.format_exc())
        

def main(args):
  cfgname=None
  if len(args) < 2:
    cfgname=os.path.join(os.path.dirname(args[0]),"avnav_server.xml")
  else:
    cfgname=args[1]
  cfg=AVNConfig()
  allThreads=[]
  if not cfg.readConfig(cfgname):
    err("unable to parse config file "+cfgname)
  navData=AVNNavData()
  loglevel=int(cfg.parameters.get('debug') or '0')
  logging.basicConfig(level=logging.DEBUG if loglevel==2 else 
      (logging.ERROR if loglevel==0 else logging.INFO))
  if len(cfg.serialreader.keys()) > 0:
    if not hasSerial:
      warn("serial readers configured but serial module not available, ignore them")
    else:
      for sk in cfg.serialreader.keys():
        serialcfg=cfg.serialreader[sk]
        try:
          sthread=AVNSerialReader(serialcfg,navData)
          sthread.start()
          allThreads.append(sthread)
        except Exception as e:
          warn("unable to start serial reader: "+str(e))
  while True:
    time.sleep(3)
    log(str(navData))
    log("entries for TPV: "+str(navData.getMergedEntries("TPV", [])))  
 
if __name__ == "__main__":
    main(sys.argv)
    
         
  