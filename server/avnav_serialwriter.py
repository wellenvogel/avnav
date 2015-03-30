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
from avnav_serial import *
hasSerial=False

try:
  import serial
  hasSerial=True
except:
  pass

#a writer class to write to a serial port using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#this class is not directly a worker that can be instantiated from the config
#instead it is used by worker classes to handle serial output
#basically the configuration is the same like for the reader
#except that autobaud settings are ignored

class SerialWriter(SerialReader):

  @classmethod
  def getConfigParam(cls):
      rt=SerialReader.getConfigParam().copy();
      rt.update({
          'feederName':'',  #if set, use this feeder
          'combined' : False, #if true, also start a reader
          'readFilter':''   #filterstring for reading
          })
      return rt
    
  #parameters:
  #param - the config dict
  #navdata - a nav data object (can be none if this reader doesn not directly write)
  #a write data method used to write a received line
  def __init__(self,param,navdata,writeData,infoHandler):
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial writer")
    self.param=param
    self.infoHandler=infoHandler
    self.doStop=False
    self.navdata=navdata
    self.writeData=writeData
    if self.navdata is None and self.writeData is None:
      raise Exception("either navdata or writeData has to be set")
    feeder=AVNWorker.findFeeder(self.param.get('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.param.get('feederName') or "")
    self.feeder=feeder
    self.maplock=threading.Lock()
    self.addrmap={}
    #the serial device
    self.device=None
  def getName(self):
    if self.param.get('combined') is not None and unicode(self.param.get('combined')).upper()=="TRUE":
      return "SerialReaderWriter-"+self.param['name']
    return "SerialWriter-"+self.param['name']
   
  def stopHandler(self):
    self.doStop=True

  
  def openDevice(self,baud,init=False):
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
    name=self.getName()
    if init:
      AVNLog.info("openDevice for port %s, baudrate=%d, timeout=%f",
                  portname,baud,timeout)
      init=False
    else:
      AVNLog.debug("openDevice for port %s, baudrate=%d, timeout=%f",portname,baud,timeout)
    lastTime=time.time()
    try:
      self.setInfoWithKey("writer","opening %s at %d baud"%(portname,baud),AVNWorker.Status.STARTED)
      f=serial.Serial(pnum,timeout=timeout,baudrate=baud,bytesize=bytesize,parity=parity,stopbits=stopbits,xonxoff=xonxoff,rtscts=rtscts)
      self.setInfoWithKey("writer","port open",AVNWorker.Status.STARTED)
      return f
    except Exception:
      self.setInfoWithKey("writer","unable to open port",AVNWorker.Status.ERROR)
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
  
  def writeLine(self,serialDevice,data):
    #if not os.name=='posix':
    return serialDevice.write(data)

   
  #the run method - just try forever  
  def run(self):
    threading.current_thread().setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    self.device=None
    init=True
    isOpen=False
    AVNLog.debug("started with param %s",",".join(unicode(i)+"="+unicode(self.param[i]) for i in self.param.keys()))
    self.setInfoWithKey("writer","created",AVNWorker.Status.STARTED)
    startReader=self.param.get('combined')
    if startReader is not None and unicode(startReader).upper()=='TRUE':
      AVNLog.debug("starting reader")
      reader=threading.Thread(target=self.readMethod)
      reader.setDaemon(True)
      reader.start()
    while True and not self.doStop:
      name=self.getName()
      timeout=float(self.param['timeout'])
      portname=self.param['port']
      porttimeout=timeout*10
      baud=int(self.param['baud'])
      maxerrors=int(self.param['numerrors'])
      filterstr=self.param.get('filter')
      filter=None
      if filterstr != "":
        filter=filterstr.split(',')
      self.device=self.openDevice(baud,init)
      init=False
      if self.doStop:
        AVNLog.info("handler stopped, leaving")
        self.setInfoWithKey("writer","stopped",AVNWorker.Status.INACTIVE)
        try:
          self.device.close()
          self.device=None
        except:
          pass
        return
      if self.device is None:
        time.sleep(porttimeout/2)
        continue
      AVNLog.debug("%s opened, start sending data",self.device.name)
      lastTime=time.time()
      numerrors=0
      seq=0
      while True and not self.doStop:
        bytes=0
        try:
          seq,data=self.feeder.fetchFromHistory(seq,10)
          if len(data)>0:
            for line in data:
              if NMEAParser.checkFilter(line, filter):
                self.writeLine(self.device,line)
          else:
            time.sleep(0.1)
        except Exception as e:
          AVNLog.debug("Exception %s in serial write, close and reopen %s",traceback.format_exc(),portname)
          try:
            self.device.close()
            self.device=None
            isOpen=False
            seq=0
          except:
            pass
          break

    AVNLog.info("stopping handler")
    self.setInfoWithKey("writer","stopped",AVNWorker.Status.INACTIVE)
    self.deleteInfo()

  #the read method for the combined reader/writer
  def readMethod(self):
    threading.current_thread().setName("[%s]%s-combinedReader"%(AVNLog.getThreadId(),self.getName()))
    self.setInfoWithKey("reader","started",AVNWorker.Status.STARTED)
    AVNLog.info("started")
    filterstr=self.param.get('readFilter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    hasNmea=False
    while True and not self.doStop:
      try:
        if self.device is not None:
          bytes=self.device.readline(300)
          if self.doStop:
            AVNLog.info("Stopping reader of combined reader/writer %s",unicode(self.param['port']))
            self.deleteInfoWithKey("reader")
            return
          if bytes is None or len(bytes)==0:
            #if there is no data at all we simply take all the time we have...
            AVNLog.debug("unable to read data, retrying ")
            time.sleep(0.1)
            continue
          data=bytes.decode('ascii','ignore')
          if len(data) < 5:
            AVNLog.debug("ignore short data %s",data)
          else:
            if not NMEAParser.checkFilter(data,filter):
              AVNLog.debug("ignore line %s due to not matching filter",data)
              continue
            if not hasNmea:
              self.setInfoWithKey("reader","receiving data",AVNWorker.Status.NMEA)
            if not self.writeData is None:
              self.writeData(data)
            else:
              self.nmeaParser.parseData(data)
        else:
          time.sleep(0.5)
      except:
        AVNLog.debug("exception on read in mixed reader/writer %s (port %s)",traceback.format_exc(),unicode(self.param['port']))
        time.sleep(0.5)
        hasNmea=False

    
        
  def setInfo(self,txt,status):
    if not self.infoHandler is None:
      self.infoHandler.setInfo(self.getName(),txt,status)
  def deleteInfo(self):
    if not self.infoHandler is None:
      self.infoHandler.deleteInfo(self.getName())
  def setInfoWithKey(self,key,txt,status):
    if not self.infoHandler is None:
      self.infoHandler.setInfo(self.getName()+"-"+key,txt,status)
  def deleteInfoWithKey(self,key):
    if not self.infoHandler is None:
      self.infoHandler.deleteInfo(self.getName()+"-"+key)

#a Worker to directly read from a serial line using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
#if useFeeder is set, pipe the received data through our feeder
#this gives the chance to output them at NMEA output interfaces
class AVNSerialWriter(AVNWorker):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSerialWriter"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    cfg=SerialWriter.getConfigParam()
    rt=cfg.copy()
    return rt
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasSerial:
      AVNLog.warn("serial writers configured but serial module not available, ignore them")
      return None
    rt=AVNSerialWriter(cfgparam)
    return rt
    
  def __init__(self,param):
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial writer")
    self.writeData=None
    AVNWorker.__init__(self, param)
    
  
  def getName(self):
    return "SerialWriter "+self.param['name']
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    AVNWorker.start(self) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    writer=SerialWriter(self.param,self.navdata if self.writeData is None else None, self.writeData,self)
    writer.run()


