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
import traceback

import time

from avnqueue import AVNQueue, Fetcher
from avnserial import *
import avnav_handlerList
from avnav_nmea import NMEAParser
from avnav_util import AVNLog
from avnav_worker import AVNWorker

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
  P_COMBINED=WorkerParameter('combined', False, type=WorkerParameter.T_BOOLEAN,
                             description='if true, also start a reader')
  P_READFILTER=WorkerParameter('readFilter','', type=WorkerParameter.T_FILTER,
                               condition={P_COMBINED.name:True})
  P_BLACKLIST=AVNWorker.BLACKLIST_PARAM.copy(condition={P_COMBINED.name:True})
  P_REPLY_RECEIVED=AVNWorker.REPLY_RECEIVED.copy(condition={P_COMBINED.name:True})
  @classmethod
  def getConfigParam(cls):
      rt=list(filter(lambda x: x.name != 'minbaud' ,SerialReader.getConfigParam()))
      ownParam=[
          cls.P_COMBINED,
          cls.P_READFILTER,
          cls.P_BLACKLIST,
          cls.P_REPLY_RECEIVED
          ]
      return rt+ownParam

  def _getSubSourceName(self):
    return "Serial-{0}".format(self.P_PORT.fromDict(self.param,rangeOrListCheck=False))

  def getName(self):
    return "SerialWriter-{0}".format(self.P_PORT.fromDict(self.param,rangeOrListCheck=False))

  #parameters:
  #param - the config dict
  #navdata - a nav data object (can be none if this reader does not directly write)
  #a write data method used to write a received line
  def __init__(self, param, queue: AVNQueue, infoHandler: InfoHandler, sourceName):
    super().__init__(param, queue, infoHandler, sourceName)
    self._fetcher=Fetcher(queue,infoHandler,
                          nmeaFilter=self.P_FILTER.fromDict(param),
                          blackList=self.P_BLACKLIST.fromDict(param),
                          sumKey='out',
                          ownsubsource=self._getSubSourceName() if not self.P_REPLY_RECEIVED.fromDict(param) else None)

    self.addrmap={}
    #the serial device
    self.buffer=None
   
  def stopHandler(self):
    self.doStop=True
    try:
      self.device.close()
    except:
      pass
    try:
      with self.lock:
        self.lock.notifyAll()
    except:
      pass

  
  def openDevice(self,iname,baud,autobaud,init=False):
    INAME=iname
    self.buffer=''
    f=None
    bytesize=self.P_BYTESIZE.fromDict(self.param)
    parity=self.P_PARITY.fromDict(self.param)
    stopbits=self.P_STOPBITS.fromDict(self.param)
    xonxoff=self.P_XONOFF.fromDict(self.param)
    rtscts=self.P_RTSCTS.fromDict(self.param)
    portname=self.P_PORT.fromDict(self.param,rangeOrListCheck=False)
    timeout=self.P_TIMEOUT.fromDict(self.param)
    isCombined = self.P_COMBINED.fromDict(self.param)
    modeStr='writer' if not isCombined else 'combined'
    if init:
      AVNLog.info("openDevice for port %s, baudrate=%d, timeout=%f",
                  str(portname),baud,timeout)
      init=False
    else:
      AVNLog.debug("openDevice for port %s, baudrate=%d, timeout=%f",portname,baud,timeout)
    try:
      self.infoHandler.setInfo(INAME,"%s opening %s at %d baud"%(modeStr,portname,baud),WorkerStatus.STARTED)
      f=serial.Serial(portname, timeout=timeout, baudrate=baud, bytesize=bytesize, parity=parity, stopbits=stopbits, xonxoff=xonxoff, rtscts=rtscts)
      self.infoHandler.setInfo(INAME,"%s port %s open at %d baud"%(modeStr,portname,baud),WorkerStatus.NMEA)
      return f
    except Exception:
      self.infoHandler.setInfo(INAME,"%s unable to open port %s"%(modeStr,portname),WorkerStatus.ERROR)
      try:
        tf=traceback.format_exc(3)
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

  #the run method - just try forever  
  def run(self):
    INAME='device'
    self._fetcher.updateParam(nmeaFilter=self.P_FILTER.fromDict(self.param),
                              blackList=self.P_BLACKLIST.fromDict(self.param),
                              ownsubsource=self._getSubSourceName() if not self.P_REPLY_RECEIVED.fromDict(self.param) else '')
    self._fetcher.reset()
    threading.current_thread().setName("%s - %s"%(self.getName(),self.param['port']))
    self.device=None
    init=True
    isOpen=False
    AVNLog.debug("started with param %s",",".join(str(i)+"="+str(self.param[i]) for i in list(self.param.keys())))
    self.infoHandler.setInfo(INAME,"created",WorkerStatus.STARTED)
    startReader=self.P_COMBINED.fromDict(self.param)
    if startReader:
      AVNLog.debug("starting reader")
      reader=threading.Thread(target=self.readMethod)
      reader.setDaemon(True)
      reader.start()
    while not self.doStop:
      self._fetcher.reset()
      timeout=self.P_TIMEOUT.fromDict(self.param)
      portname=self.P_PORT.fromDict(self.param,rangeOrListCheck=False)
      porttimeout=timeout*10
      baud=self.P_BAUD.fromDict(self.param)
      self.device=self.openDevice(INAME,baud,False,init=init)
      init=False
      if self.doStop:
        AVNLog.info("handler stopped, leaving")
        self.infoHandler.setInfo(INAME,"stopped",WorkerStatus.INACTIVE)
        self._fetcher.reset()
        try:
          self.device.close()
          self.device=None
        except:
          pass
        return
      if self.device is None:
        try:
          with self.lock:
            self.lock.wait(porttimeout/2)
        except:
          pass
        continue
      AVNLog.debug("%s opened, start sending data",self.device.name)
      while True and not self.doStop:
        try:
          data=self._fetcher.fetch()
          self._fetcher.report()
          if len(data)>0:
            for line in data:
              self.device.write(line.encode('ascii','ignore'))
        except Exception as e:
          AVNLog.debug("Exception %s in serial write, close and reopen %s",traceback.format_exc(),portname)
          try:
            self.device.close()
            self.device=None
            if not self.doStop:
              try:
                with self.lock:
                  self.lock.wait(porttimeout/2)
              except:
                pass
          except:
            pass
          break

    AVNLog.info("stopping handler")
    self.infoHandler.setInfo(INAME,"stopped",WorkerStatus.INACTIVE)

  #the read method for the combined reader/writer
  def readMethod(self):
    threading.current_thread().setName("%s-combinedReader"%self.getName())
    nmeaSum=MovingSum()
    INAME="in"
    self.infoHandler.setInfo(INAME,"started",WorkerStatus.STARTED)
    AVNLog.info("started")
    filterstr=self.P_READFILTER.fromDict(self.param)
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    source=self.sourceName
    priority=AVNWorker.PRIORITY_PARAM_DESCRIPTION.fromDict(self.param)
    while not self.doStop:
      try:
        if self.device is not None:
          if nmeaSum.shouldUpdate():
            self.infoHandler.setInfo(INAME,
                                     "%.4g/s"%nmeaSum.avg(),
                                     WorkerStatus.NMEA if nmeaSum.val()>0 else WorkerStatus.INACTIVE)
          bytes=self.device.readline(300)
          if self.doStop:
            AVNLog.info("Stopping reader of combined reader/writer %s",str(self.param['port']))
            self.infoHandler.deleteInfo(INAME)
            return
          if bytes is None or len(bytes)==0:
            #if there is no data at all we simply take all the time we have...
            AVNLog.debug("unable to read data, retrying ")
            with self.lock:
              self.lock.wait(0.1)
            continue
          data=bytes.decode('ascii','ignore')
          if len(data) < 5:
            AVNLog.debug("ignore short data %s",data)
          else:
            if not NMEAParser.checkFilter(data,filter):
              AVNLog.debug("ignore line %s due to not matching filter",data)
              continue
            nmeaSum.add(1)
            self.queue.addNMEA(data,source=source,sourcePriority=priority,subsource=self._getSubSourceName())
        else:
          with self.lock:
            self.lock.wait(0.5)
      except:
        AVNLog.debug("exception on read in mixed reader/writer %s (port %s)",traceback.format_exc(),str(self.param['port']))
        with self.lock:
          self.lock.wait(0.5)
        nmeaSum.clear()

    
        

#a Worker to directly write to a serial line using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
class AVNSerialWriter(AVNWorker):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSerialWriter"
  
  @classmethod
  def getConfigParam(cls, child=None):
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

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True

  @classmethod
  def getEditableParameters(cls, makeCopy=True,id=None):
    rt= super().getEditableParameters(True,id=id)
    slist = SerialReader.listSerialPorts()
    slist = UsedResource.filterListByUsed(UsedResource.T_SERIAL, slist,
                                          cls.findUsersOf(UsedResource.T_SERIAL, ownId=id))
    WorkerParameter.updateParamFor(rt, SerialWriter.P_PORT.name, {'rangeOrList':slist})
    return rt

  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.writer=None

  def checkConfig(self, param):
    if SerialWriter.P_PORT.name in param:
      self.checkUsedResource(UsedResource.T_SERIAL,SerialWriter.P_PORT.fromDict(param, rangeOrListCheck=False))

  def stop(self):
    try:
      self.writer.stopHandler()
    except:
      pass
    super().stop()

  #thread run method - just try forever  
  def run(self):
    for p in (SerialWriter.P_PORT,SerialWriter.P_TIMEOUT):
      self.getWParam(p)
    while not self.shouldStop():
      self.setNameIfEmpty("%s-%s"%(self.getName(),str(self.getWParam(SerialWriter.P_PORT))))
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_SERIAL,self.getParamValue('port'))
      try:
        self.writer=SerialWriter(self.param,self.queue,self,self.getSourceName(self.getWParam(SerialWriter.P_PORT)))
        self.writer.run()
      except Exception as e:
        AVNLog.error("exception in serial writer: %s",traceback.format_exc())
        self.wait(2000)
      AVNLog.info("restarting serial writer")

  def updateConfig(self, param, child=None):
    if SerialWriter.P_PORT.name in param:
      self.checkUsedResource(UsedResource.T_SERIAL,SerialWriter.P_PORT.fromDict(param,rangeOrListCheck=False))
    super().updateConfig(param, child)
    if self.writer is not None:
      self.writer.stopHandler()


avnav_handlerList.registerHandler(AVNSerialWriter)

