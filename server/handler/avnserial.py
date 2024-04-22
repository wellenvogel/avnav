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
from avnqueue import AVNQueue

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
  BAUDRATES=[921600,460800,230400,115200,57600,38400,19200,9600,4800]
  P_XONOFF=WorkerParameter('xonxoff', False,type=WorkerParameter.T_BOOLEAN)
  P_RTSCTS=WorkerParameter('rtscts',False,type=WorkerParameter.T_BOOLEAN)
  P_FILTER=AVNWorker.FILTER_PARAM
  P_PORT=WorkerParameter('port',None,type=WorkerParameter.T_SELECT,rangeOrList=[])
  P_TIMEOUT=WorkerParameter('timeout', 2,type=WorkerParameter.T_FLOAT,
                            description="serial receive timeout in s, after 10*timeout port will be reopened")
  P_BAUD=WorkerParameter('baud',4800,type=WorkerParameter.T_SELECT,rangeOrList=BAUDRATES,valuetype=WorkerParameter.T_NUMBER)
  P_MINBAUD=WorkerParameter('minbaud',0,type=WorkerParameter.T_SELECT,rangeOrList=BAUDRATES+[0],
                            description='if this is set to anything else then 0, try autobauding between baud and minbaud',
                            valuetype=WorkerParameter.T_NUMBER)
  P_BYTESIZE=WorkerParameter('bytesize', 8,type=WorkerParameter.T_SELECT,rangeOrList=[5,6,7,8],valuetype=WorkerParameter.T_NUMBER)
  P_PARITY=WorkerParameter('parity','N',type=WorkerParameter.T_SELECT,rangeOrList=['N','E','O','M','S'])
  P_STOPBITS=WorkerParameter('stopbits', 1,type=WorkerParameter.T_SELECT,rangeOrList=[1,1.5,2],valuetype=WorkerParameter.T_FLOAT)
  P_NUMERRORS=WorkerParameter('numerrors',20,type=WorkerParameter.T_NUMBER,
                              description='reopen port after that many errors, set this to 0 to avoid any check for NMEA data')
  P_AUTOTIME=WorkerParameter('autobaudtime', 5,type=WorkerParameter.T_FLOAT,
                             description='use that many seconds to read data for autobauding if no newline is found')
  @classmethod
  def getConfigParam(cls):
    cfg=[
               cls.P_PORT,
               AVNWorker.PRIORITY_PARAM_DESCRIPTION,
               cls.P_TIMEOUT,
               cls.P_BAUD,
               cls.P_MINBAUD,
               cls.P_BYTESIZE,
               cls.P_PARITY,
               cls.P_STOPBITS,
               cls.P_XONOFF,
               cls.P_RTSCTS,
               cls.P_NUMERRORS,
               cls.P_AUTOTIME,
               cls.P_FILTER
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
  def __init__(self,param,queue:AVNQueue,infoHandler: InfoHandler,sourceName):
    for p in (self.P_PORT,self.P_TIMEOUT):
      p.fromDict(param,rangeOrListCheck=False)
    self.param=param
    self.queue=queue
    self.infoHandler=TrackingInfoHandler(infoHandler)
    self.sourceName=sourceName
    self.startpattern=AVNUtil.getNMEACheck()
    self.doStop=False
    self.device=None
    self.lock=threading.Condition()
  def getName(self):
    return "SerialReader-"+self.P_PORT.fromDict(self.param,rangeOrListCheck=False)
   
  def stopHandler(self):
    self.doStop=True
    try:
      if self.device is not None:
        self.device.close()
    except Exception as e:
      AVNLog.debug("unable to close serial device: %s",str(e))
    try:
      with self.lock:
        self.lock.notifyAll()
    except Exception as e:
      AVNLog.debug("unable to stop serial reader: %s",str(e))
   
  # a simple approach for autobauding
  # we try to read some data (~3 lines) and find a 0x0a in it
  # once we found this, we expect $ or ! and five capital letters afterwards
  # if not found we try the next lower baudrate
  
  def openDevice(self,iname,baud,autobaud,init=False):
    self.buffer=''
    self.device=None
    bytesize=self.P_BYTESIZE.fromDict(self.param)
    parity=self.P_PARITY.fromDict(self.param)
    stopbits=self.P_STOPBITS.fromDict(self.param)
    xonxoff=self.P_XONOFF.fromDict(self.param)
    rtscts=self.P_RTSCTS.fromDict(self.param)
    portname=self.P_PORT.fromDict(self.param,rangeOrListCheck=False)
    timeout=self.P_TIMEOUT.fromDict(self.param)
    autobaudtime=self.P_AUTOTIME.fromDict(self.param)
    if init:
      AVNLog.info("openDevice for port %s, baudrate=%d, timeout=%f, autobaud=%s",
                  portname,baud,timeout,"true" if autobaud else "false")
    else:
      AVNLog.debug("openDevice for port %s, baudrate=%d, timeout=%f , autobaud=%s",portname,baud,timeout,
                   "true" if autobaud else "false")
    lastTime=time.monotonic()
    try:
      self.infoHandler.setInfo(iname,"opening at %d baud"%(baud),WorkerStatus.STARTED)
      self.device=serial.Serial(portname, timeout=timeout, baudrate=baud, bytesize=bytesize, parity=parity, stopbits=stopbits, xonxoff=xonxoff, rtscts=rtscts)
      self.infoHandler.setInfo(iname,"port open at %d baud"%baud,WorkerStatus.STARTED)
      if autobaud:
        starttime=time.monotonic()
        while time.monotonic() <= (starttime + autobaudtime):
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
            self.infoHandler.setInfo(iname,"receiving at %d baud"%(baud),WorkerStatus.NMEA)
            return self.device
        self.device.close()
        return None
      #hmm - seems that we have not been able to autobaud - return anyway
      return self.device
    except Exception:
      self.infoHandler.setInfo(iname,"unable to open port",WorkerStatus.ERROR)
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
    INAME = 'device'
    threading.current_thread().setName("%s" % self.getName())
    self.device = None
    init = True
    isOpen = False
    AVNLog.debug("started with param %s", ",".join(str(i) + "=" + str(self.param[i]) for i in list(self.param.keys())))
    self.infoHandler.setInfo(INAME, "created", WorkerStatus.STARTED)
    filterstr = self.P_FILTER.fromDict(self.param)
    filter = None
    if filterstr != "":
      filter = filterstr.split(',')
    try:
      while not self.doStop:
        portname = self.P_PORT.fromDict(self.param,rangeOrListCheck=False)
        timeout = self.P_TIMEOUT.fromDict(self.param)
        porttimeout = timeout * 10
        baud = self.P_BAUD.fromDict(self.param)
        maxerrors = self.P_NUMERRORS.fromDict(self.param)
        minbaud = self.P_MINBAUD.fromDict(self.param) or baud
        priority = AVNWorker.PRIORITY_PARAM_DESCRIPTION.fromDict(self.param)
        rates = self.BAUDRATES
        autobaud = False
        if minbaud != baud and minbaud != 0:
          autobaud = True
          if not baud in rates or not minbaud in rates:
            AVNLog.debug("minbaud/baud not in allowed rates %s", "".join(str(f) for f in rates))
            autobaud = False
          if minbaud >= baud:
            AVNLog.debug("minbaud >= baud")
            autobaud = False
        if autobaud:
          baudidx = 0
          while rates[baudidx] > baud:
            baudidx += 1
          while baudidx < len(rates) and rates[baudidx] >= minbaud and not self.doStop:
            f = self.openDevice(INAME,rates[baudidx], True, init)
            init = False
            baudidx += 1
            if not f is None:
              break
        else:
          self.openDevice(INAME,baud, False, init)
          init = False
        if self.doStop:
          AVNLog.info("handler stopped, leaving")
          self.infoHandler.setInfo(INAME, "reader stopped for %s" % portname, WorkerStatus.INACTIVE)
          try:
            self.device.close()
          except:
            pass
          break
        if self.device is None:
          with self.lock:
            self.lock.wait(min(porttimeout / 2, 5))
          continue
        AVNLog.debug("%s opened, start receiving data", self.device.name)
        lastTime = time.monotonic()
        numerrors = 0
        hasNMEA = False
        MAXLEN = 500
        buffer = b''
        nmeaSum = MovingSum()
        def nmeaInfo():
          if nmeaSum.shouldUpdate():
            self.infoHandler.setInfo('reader',
                                     'receiving %d/s' % nmeaSum.avg(),
                                     WorkerStatus.NMEA if nmeaSum.val() > 0 else WorkerStatus.RUNNING)
        while not self.doStop:
          nmeaSum.add(0)
          nmeaInfo()
          bytes = b''
          try:
            bytes = self.readLine(self.device, timeout)
            if len(buffer) > 0:
              bytes = buffer + bytes
              buffer = ''
            if len(bytes) > 0 and bytes.find(b"\n") < 0:
              if len(bytes) < MAXLEN:
                buffer = bytes
                continue
              raise Exception("no newline in serial data")
          except Exception as e:
            AVNLog.debug("Exception %s in serial read, close and reopen %s", traceback.format_exc(), portname)
            try:
              self.device.close()
              isOpen = False
            except:
              pass
            break
          if not bytes is None and len(bytes) > 0:
            if not isOpen:
              AVNLog.info("successfully opened %s", self.device.name)
              isOpen = True
            self.status = True
            data = bytes.decode('ascii', 'ignore').translate(NMEAParser.STRIPCHARS)
            if maxerrors > 0 or not hasNMEA:
              if not self.startpattern.match(data):
                if maxerrors > 0:
                  numerrors += 1
                  if numerrors > maxerrors:
                    # hmm - seems that we do not see any NMEA data
                    AVNLog.debug("did not see any NMEA data for %d lines - close and reopen", maxerrors)
                    try:
                      self.device.close()
                    except:
                      pass
                    break
                  continue
              else:
                pass
            if len(data) < 5:
              AVNLog.debug("ignore short data %s", data)
            else:
              numerrors = 0
              lastTime = time.monotonic()
              if not NMEAParser.checkFilter(data, filter):
                continue
              nmeaSum.add(1)
              self.queue.addNMEA(data, source=self.sourceName, sourcePriority=priority)
          if (time.monotonic() - lastTime) > porttimeout:
            self.infoHandler.setInfo(INAME,"timeout", WorkerStatus.ERROR)
            self.device.close()
            self.device = None
            if isOpen:
              AVNLog.info("reopen port %s - timeout elapsed", portname)
              isOpen = False
            else:
              AVNLog.debug("reopen port %s - timeout elapsed", portname)
            break

    except:
      AVNLog.info("exception in receiver %s" % traceback.format_exc())
    AVNLog.info("stopping handler")
    self.infoHandler.setInfo(INAME,"stopped", WorkerStatus.INACTIVE)

#a Worker to directly read from a serial line using pyserial
#on windows use an int for the port - e.g. use 4 for COM5
#on linux use the device name for the port
#if no data is received within timeout *10 the port is closed and reopened
#this gives the chance to handle dynamically assigned ports with no issues
#this gives the chance to output them at NMEA output interfaces
class AVNSerialReader(AVNWorker):

  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    return SerialReader.getConfigParam()
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
    WorkerParameter.updateParamFor(rt, SerialReader.P_PORT.name, {'rangeOrList':slist})
    return rt

  @classmethod
  def canEdit(cls):
    return True
  @classmethod
  def canDeleteHandler(cls):
    return True

  def __init__(self,param):
    self.reader=None
    AVNWorker.__init__(self, param)


  def checkConfig(self, param):
    if SerialReader.P_PORT.name in param:
      self.checkUsedResource(UsedResource.T_SERIAL,SerialReader.P_PORT.fromDict(param,rangeOrListCheck=False))

  #thread run method - just try forever  
  def run(self):
    for p in (SerialReader.P_PORT,SerialReader.P_TIMEOUT):
      self.getWParam(p)
    while not self.shouldStop():
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_SERIAL,self.getWParam(SerialReader.P_PORT))
      try:
        self.reader=SerialReader(self.param, self.queue,self,self.getSourceName(self.getWParam(SerialReader.P_PORT)))
        self.reader.run()
      except Exception as e:
        AVNLog.error("exception in serial reader %s",traceback.format_exc())


  def updateConfig(self, param,child=None):
    if SerialReader.P_PORT.name in param:
      self.checkUsedResource(UsedResource.T_SERIAL, param[SerialReader.P_PORT.name])
    super().updateConfig(param)
    if self.reader is not None:
      self.reader.stopHandler()

  def stop(self):
    super().stop()
    try:
      self.reader.stopHandler()
    except:
      pass


avnav_handlerList.registerHandler(AVNSerialReader)

