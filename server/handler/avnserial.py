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

import time
from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
hasSerial=False

try:
  import serial
  import serial.tools.list_ports
  hasSerial=True
except:
  pass

import avnav_handlerList
#a reader class to read from a serial port using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
#this class is not directly a worker that can be instantiated from the config
#instead it is used by worker classes to handle serial input
#it also contains our internal converting routines

class SerialReader(object):
  BAUDRATES=[460800,230400,115200,57600,38400,19200,9600,4800]
  P_XONOFF=WorkerParameter('xonxoff', False,type=WorkerParameter.T_BOOLEAN)
  P_RTSCTS=WorkerParameter('rtscts',False,type=WorkerParameter.T_BOOLEAN)
  @classmethod
  def getConfigParam(cls):
    cfg=[
               WorkerParameter('port',None,type=WorkerParameter.T_SELECT,rangeOrList=[]),
               WorkerParameter('timeout', 2,type=WorkerParameter.T_FLOAT,
                               description="serial receive timeout in s, after 10*timeout port will be reopened"),
               WorkerParameter('baud',4800,type=WorkerParameter.T_SELECT,rangeOrList=cls.BAUDRATES),
               WorkerParameter('minbaud',0,type=WorkerParameter.T_SELECT,rangeOrList=cls.BAUDRATES+[0],
                              description='if this is set to anything else then 0, try autobauding between baud and minbaud'),
               WorkerParameter('bytesize', 8,type=WorkerParameter.T_SELECT,rangeOrList=[5,6,7,8]),
               WorkerParameter('parity','N',type=WorkerParameter.T_SELECT,rangeOrList=['N','E','O','M','S']),
               WorkerParameter('stopbits', 1,type=WorkerParameter.T_SELECT,rangeOrList=[1,1.5,2]),
               cls.P_XONOFF,
               cls.P_RTSCTS,
               WorkerParameter('numerrors',20,type=WorkerParameter.T_NUMBER,
                               description='reopen port after that many errors, set this to 0 to avoid any check for NMEA data'),
               WorkerParameter('autobaudtime', 5,type=WorkerParameter.T_FLOAT,
                               description='use that many seconds to read data for autobauding if no newline is found'),
               WorkerParameter('filter',"",type=WorkerParameter.T_FILTER)
               ]
    return cfg

  @classmethod
  def listSerialPorts(cls):
    if not hasSerial:
      return []
    ports=serial.tools.list_ports.comports()
    rt=[]
    for p in ports:
      rt.append(p.device)
    return rt

    
  #parameters:
  #param - the config dict
  #navdata - a nav data object (can be none if this reader doesn not directly write)
  #a write data method used to write a received line
  def __init__(self,param,writeData,infoHandler,sourceName):
    for p in ('port','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial reader")
    self.param=param
    self.writeData=writeData
    self.infoHandler=infoHandler
    self.sourceName=sourceName
    if self.writeData is None:
      raise Exception("writeData has to be set")
    self.startpattern=AVNUtil.getNMEACheck()
    self.doStop=False 
    self.setInfo("created",WorkerStatus.INACTIVE)
    self.device=None
  def getName(self):
    return "SerialReader-"+self.param['name']
   
  def stopHandler(self):
    self.doStop=True
    try:
      if self.device is not None:
        self.device.close()
    except Exception as e:
      AVNLog.debug("unable to close serial device: %s",str(e))
   
  # a simple approach for autobauding
  # we try to read some data (~3 lines) and find a 0x0a in it
  # once we found this, we expect $ or ! and five capital letters afterwards
  # if not found we try the next lower baudrate
  
  def openDevice(self,baud,autobaud,init=False):
    self.buffer=''
    self.device=None
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
      self.setInfo("reader opening at %d baud"%(baud),WorkerStatus.STARTED)
      self.device=serial.Serial(pnum, timeout=timeout, baudrate=baud, bytesize=bytesize, parity=parity, stopbits=stopbits, xonxoff=xonxoff, rtscts=rtscts)
      self.setInfo("reader port open at %d baud"%baud,WorkerStatus.STARTED)
      if autobaud:
        starttime=time.time()
        while time.time() <= (starttime + autobaudtime):
          bytes=self.device.read(300)
          if self.doStop:
            try:
              self.device.close()
            except:
              pass
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
            self.setInfo("reader receiving at %d baud"%(baud),WorkerStatus.STARTED)
            return self.device
        self.device.close()
        return None
      #hmm - seems that we have not been able to autobaud - return anyway
      return self.device
    except Exception:
      self.setInfo("unable to open port",WorkerStatus.ERROR)
      try:
        tf=traceback.format_exc(3)
      except:
        tf="unable to decode exception"
      AVNLog.debug("Exception on opening %s : %s",portname,tf)
      if self.device is not None:
        try:
          self.device.close()
        except:
          pass
        self.device=None
    return self.device
  
  def readLine(self,serialDevice,timeout):
    #if not os.name=='posix':
    return serialDevice.readline(300)


  #the run method - just try forever  
  def run(self):
    threading.current_thread().setName("%s"%self.getName())
    self.device=None
    init=True
    isOpen=False
    AVNLog.debug("started with param %s",",".join(str(i)+"="+str(self.param[i]) for i in list(self.param.keys())))
    self.setInfo("created",WorkerStatus.STARTED)
    filterstr=self.param.get('filter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    try:
      while not self.doStop:
       name=self.getName()
       timeout=float(self.param['timeout'])
       portname=self.param['port']
       porttimeout=timeout*10
       baud=int(self.param['baud'])
       maxerrors=int(self.param['numerrors'])
       minbaud=int(self.param.get('minbaud') or baud)
       rates=self.BAUDRATES
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
         self.openDevice(baud,False,init)
         init=False
       if self.doStop:
         AVNLog.info("handler stopped, leaving")
         self.setInfo("reader stopped for %s"%portname,WorkerStatus.INACTIVE)
         try:
           self.device.close()
         except:
           pass
         break
       if self.device is None:
         time.sleep(min(porttimeout/2,5))
         continue
       AVNLog.debug("%s opened, start receiving data",self.device.name)
       lastTime=time.time()
       numerrors=0
       hasNMEA=False
       MAXLEN=500
       buffer=b''
       while not self.doStop:
         bytes=b''
         try:
           bytes=self.readLine(self.device,timeout)
           if len(buffer) > 0:
             bytes=buffer+bytes
             buffer=''
           if  len(bytes) > 0 and bytes.find(b"\n") <0:
             if len(bytes) < MAXLEN:
               continue
             raise Exception("no newline in serial data")
         except Exception as e:
           AVNLog.debug("Exception %s in serial read, close and reopen %s",traceback.format_exc(),portname)
           try:
             self.device.close()
             isOpen=False
           except:
             pass
           break
         if not bytes is None and len(bytes)> 0:
           if not hasNMEA:
             self.setInfo("reader receiving %s at %d baud"%(portname,self.device.baudrate),WorkerStatus.STARTED)
           if not isOpen:
             AVNLog.info("successfully opened %s",self.device.name)
             isOpen=True
           self.status=True
           data=bytes.decode('ascii','ignore').translate(NMEAParser.STRIPCHARS)
           if maxerrors > 0 or not hasNMEA:
             if not self.startpattern.match(data):
               if maxerrors>0:
                 numerrors+=1
                 if numerrors > maxerrors:
                   #hmm - seems that we do not see any NMEA data
                   AVNLog.debug("did not see any NMEA data for %d lines - close and reopen",maxerrors)
                   try:
                     self.device.close()
                   except:
                     pass
                   break
                 continue
             else:
               pass
           if len(data) < 5:
             AVNLog.debug("ignore short data %s",data)
           else:
             numerrors=0
             lastTime=time.time()
             if not NMEAParser.checkFilter(data,filter):
               continue
             if not hasNMEA:
               self.setInfo("reader receiving NMEA %s at %d baud"%(portname,self.device.baudrate),WorkerStatus.NMEA)
             hasNMEA=True
             if not self.writeData is None:
               self.writeData(data,source=self.sourceName)
             else:
               AVNLog.debug("unable to write data")

         if (time.time() - lastTime) > porttimeout:
           self.setInfo("timeout",WorkerStatus.ERROR)
           self.device.close()
           self.device=None
           if isOpen:
             AVNLog.info("reopen port %s - timeout elapsed",portname)
             isOpen=False
           else:
             AVNLog.debug("reopen port %s - timeout elapsed",portname)
           break

    except:
      AVNLog.info("exception in receiver %s"%traceback.format_exc())
    AVNLog.info("stopping handler")
    self.setInfo("stopped",WorkerStatus.INACTIVE)
    self.deleteInfo()
    
        
  def setInfo(self,txt,status):
    if not self.infoHandler is None:
      self.infoHandler.setInfo('main',"%s:%s"%(self.param['port'],txt),status)
  def deleteInfo(self):
    if not self.infoHandler is None:
      self.infoHandler.deleteInfo('main')
 

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
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    cfg=SerialReader.getConfigParam()
    ownCfg=[
               WorkerParameter('feederName','',type=WorkerParameter.T_STRING,
                              description='if this one is set, we do not use the defaul feeder by this one',
                              editable=False)
    ]
    return cfg+ownCfg
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasSerial:
      AVNLog.warn("serial readers configured but serial module not available, ignore them")
      return None
    rt=AVNSerialReader(cfgparam)
    return rt

  @classmethod
  def getEditableParameters(cls, makeCopy=True,id=None):
    rt= super().getEditableParameters(True,id=id)
    slist=SerialReader.listSerialPorts()
    slist=UsedResource.filterListByUsed(UsedResource.T_SERIAL,slist,
                                        cls.findUsersOf(UsedResource.T_SERIAL,ownId=id))
    WorkerParameter.updateParamFor(rt, 'port', {'rangeOrList':slist})
    return rt

  @classmethod
  def canEdit(cls):
    return True
  @classmethod
  def canDeleteHandler(cls):
    return True

  def __init__(self,param):
    for p in ('port','timeout'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for serial reader")
    self.writeData=None
    self.reader=None
    AVNWorker.__init__(self, param)


  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def startInstance(self,navdata):
    feedername=self.getStringParam('feederName')
    feeder=self.findFeeder(feedername)
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
    self.writeData=feeder.addNMEA
    super().startInstance(navdata)

  def checkConfig(self, param):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_SERIAL,param.get('port'))

  #thread run method - just try forever  
  def run(self):
    while not self.shouldStop():
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_SERIAL,self.getParamValue('port'))
      try:
        self.reader=SerialReader(self.param, self.writeData,self,self.getSourceName(self.getParamValue('port')))
        self.reader.run()
      except Exception as e:
        AVNLog.error("exception in serial reader %s",traceback.format_exc())


  def updateConfig(self, param,child=None):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_SERIAL,param['port'])
    super().updateConfig(param)
    self.reader.stopHandler()

  def stop(self):
    super().stop()
    try:
      self.reader.stopHandler()
    except:
      pass


avnav_handlerList.registerHandler(AVNSerialReader)

