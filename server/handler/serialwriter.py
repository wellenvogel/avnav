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

  @classmethod
  def getConfigParam(cls):
      rt=list(filter(lambda x: x.name != 'minbaud' ,SerialReader.getConfigParam()))
      ownParam=[
          WorkerParameter('feederName','', type=WorkerParameter.T_STRING,editable=False),
          WorkerParameter('combined', False, type=WorkerParameter.T_BOOLEAN,
                          description='if true, also start a reader'),
          WorkerParameter('readFilter','', type=WorkerParameter.T_FILTER,
                          condition={'combined':True}),
          WorkerParameter('blackList','',type=WorkerParameter.T_STRING,
                          description=', separated list of sources that we will not send out')
          ]
      return rt+ownParam
    
  #parameters:
  #param - the config dict
  #navdata - a nav data object (can be none if this reader does not directly write)
  #a write data method used to write a received line
  def __init__(self,param,writeData,infoHandler,sourceName):
    for p in ('port','name','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial writer")
    self.param=param
    self.infoHandler=infoHandler
    self.doStop=False
    self.writeData=writeData
    if self.writeData is None:
      raise Exception("writeData has to be set")
    feeder=AVNWorker.findFeeder(self.param.get('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.param.get('feederName') or "")
    self.feeder=feeder
    self.addrmap={}
    #the serial device
    self.device=None
    self.buffer=None
    self.sourceName=sourceName
    self.blackList=[]
    if param.get('blacklist') is not None:
      self.blackList =param.get('blacklist').split(',')
    self.blackList.append(sourceName)
    self.combinedStatus={}

   
  def stopHandler(self):
    self.doStop=True
    try:
      self.device.close()
    except:
      pass

  
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
    xonxoff=self.P_XONOFF.fromDict(self.param)
    rtscts=self.P_RTSCTS.fromDict(self.param)
    portname=self.param['port']
    timeout=float(self.param['timeout'])
    name=self.getName()
    isCombined = self.param.get('combined') or False
    modeStr='writer' if not isCombined else 'combined'
    if init:
      AVNLog.info("openDevice for port %s, baudrate=%d, timeout=%f",
                  portname,baud,timeout)
      init=False
    else:
      AVNLog.debug("openDevice for port %s, baudrate=%d, timeout=%f",portname,baud,timeout)
    lastTime=time.time()
    try:
      self.setInfoWithKey("writer","%s opening %s at %d baud"%(modeStr,portname,baud),WorkerStatus.STARTED)
      f=serial.Serial(pnum, timeout=timeout, baudrate=baud, bytesize=bytesize, parity=parity, stopbits=stopbits, xonxoff=xonxoff, rtscts=rtscts)
      self.setInfoWithKey("writer","%s port %s open at %d baud"%(modeStr,portname,baud),WorkerStatus.STARTED)
      return f
    except Exception:
      self.setInfoWithKey("writer","%s unable to open port %s"%(modeStr,portname),WorkerStatus.ERROR)
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
  
  def writeLine(self,serialDevice,data):

    return serialDevice.write(data.encode('ascii','ignore'))


  #the run method - just try forever  
  def run(self):
    threading.current_thread().setName("%s - %s"%(self.getName(),self.param['port']))
    self.device=None
    init=True
    isOpen=False
    AVNLog.debug("started with param %s",",".join(str(i)+"="+str(self.param[i]) for i in list(self.param.keys())))
    self.setInfoWithKey("writer","created",WorkerStatus.STARTED)
    startReader=self.param.get('combined')
    if startReader is not None and str(startReader).upper()=='TRUE':
      AVNLog.debug("starting reader")
      reader=threading.Thread(target=self.readMethod)
      reader.setDaemon(True)
      reader.start()
    while not self.doStop:
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
      self.device=self.openDevice(baud,False,init=init)
      init=False
      if self.doStop:
        AVNLog.info("handler stopped, leaving")
        self.setInfoWithKey("writer","stopped",WorkerStatus.INACTIVE)
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
          seq,data=self.feeder.fetchFromHistory(seq,10,includeSource=True,nmeafilter=filter)
          if len(data)>0:
            for line in data:
              if line.source in self.blackList:
                AVNLog.debug("ignore %s:%s due to blacklist",line.source,line.data)
              else:
                self.writeLine(self.device,line.data)
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
    self.setInfoWithKey("writer","stopped",WorkerStatus.INACTIVE)
    self.deleteInfo()

  #the read method for the combined reader/writer
  def readMethod(self):
    threading.current_thread().setName("%s-combinedReader"%self.getName())
    self.setInfoWithKey("reader","started",WorkerStatus.STARTED)
    AVNLog.info("started")
    filterstr=self.param.get('readFilter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    hasNmea=False
    source=self.sourceName
    while not self.doStop:
      try:
        if self.device is not None:
          bytes=self.device.readline(300)
          if self.doStop:
            AVNLog.info("Stopping reader of combined reader/writer %s",str(self.param['port']))
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
              self.setInfoWithKey("reader","receiving data",WorkerStatus.NMEA)
            if not self.writeData is None:
              self.writeData(data,source)
            else:
              AVNLog.debug("unable to write data")
        else:
          time.sleep(0.5)
      except:
        AVNLog.debug("exception on read in mixed reader/writer %s (port %s)",traceback.format_exc(),str(self.param['port']))
        time.sleep(0.5)
        hasNmea=False

    
        
  def _updateStatus(self):
    finalStatus = WorkerStatus.INACTIVE
    finalText = ''
    hasItems=False
    for k, v in self.combinedStatus.items():
      hasItems=True
      if v.status == WorkerStatus.ERROR:
        finalStatus = WorkerStatus.ERROR
      elif v.status == WorkerStatus.NMEA and finalStatus != WorkerStatus.ERROR:
        finalStatus = WorkerStatus.NMEA
      elif finalStatus == WorkerStatus.INACTIVE and v.status != WorkerStatus.INACTIVE:
        finalStatus = v.status
      finalText += "%s:[%s] %s " % (v.name, v.status, v.info)
    if not self.infoHandler is None:
      if hasItems:
        self.infoHandler.setInfo('main', finalText, finalStatus)
      else:
        self.infoHandler.deleteInfo('main')

  def setInfoWithKey(self,key,txt,status):
    self.combinedStatus[key]=WorkerStatus(key,status,txt)
    self._updateStatus()
  def deleteInfoWithKey(self,key):
    try:
      del self.combinedStatus[key]
    except:
      pass
    self._updateStatus()

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
    WorkerParameter.updateParamFor(rt, 'port', {'rangeOrList':slist})
    return rt

  def __init__(self,param):
    for p in ('port','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial writer")
    AVNWorker.__init__(self, param)
    self.writer=None

  def checkConfig(self, param):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_SERIAL,param.get('port'))

  def stop(self):
    try:
      self.writer.stopHandler()
    except:
      pass
    super().stop()

  #thread run method - just try forever  
  def run(self):
    while not self.shouldStop():
      self.setNameIfEmpty("%s-%s"%(self.getName(),str(self.getParamValue('port'))))
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_SERIAL,self.getParamValue('port'))
      try:
        self.writer=SerialWriter(self.param,self.writeData,self,self.getSourceName(self.getParamValue('port')))
        self.writer.run()
      except Exception as e:
        AVNLog.error("exception in serial writer: %s",traceback.format_exc())
        self.wait(2000)
      AVNLog.info("restarting serial writer")

  def updateConfig(self, param, child=None):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_SERIAL,param['port'])
    super().updateConfig(param, child)
    if self.writer is not None:
      self.writer.stopHandler()


avnav_handlerList.registerHandler(AVNSerialWriter)

