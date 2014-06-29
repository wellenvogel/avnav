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

import time
from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
hasSerial=False

try:
  import serial
  hasSerial=True
except:
  pass

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
          data=bytes.decode('ascii','ignore')
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
        tf=traceback.format_exc(3).decode('ascii','ignore')
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
          data=bytes.decode('ascii','ignore')
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
    self.setInfo("stopped",AVNWorker.Status.INACTIVE)
    self.deleteInfo()
    
        
  def setInfo(self,txt,status):
    if not self.infoHandler is None:
      self.infoHandler.setInfo(self.getName(),txt,status)
  def deleteInfo(self):
    if not self.infoHandler is None:
      self.infoHandler.deleteInfo(self.getName())
 

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
      AVNLog.warn("serial readers configured but serial module not available, ignore them")
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
      feeder=self.findFeeder(feedername)
      if feeder is None:
        raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
      self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    reader=SerialReader(self.param, self.navdata if self.writeData is None else None, self.writeData,self) 
    reader.run()


