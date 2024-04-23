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
from serialwriter import *
from avnserial import *
import avnav_handlerList
hasUdev=False
try:
  import pyudev
  hasUdev=True
except:
  pass

CHILD_NAME='UsbDevice'

class USBInfoHandler(TrackingInfoHandler):
  def __init__(self, name, parent: InfoHandler):
    super().__init__(parent)
    self.name=name
    self.childId="%s:%s"%(CHILD_NAME,name)
    self.parent=parent
  def setInfo(self, name, info, status, childId=None, canDelete=False, timeout=None):
    super().setInfo(name, info, status, self.childId, canDelete, timeout)
  def refreshInfo(self, name, timeout=None):
    super().refreshInfo(name, timeout)
  def deleteInfo(self,name):
    super().deleteInfo(name)

class UsbSerialHandler(USBInfoHandler):
  T_IGNORE='ignore'
  T_READER='reader'
  T_WRITER='writer'
  T_EXTERNAL='external'
  T_COMBINED='combined'
  T_UNKNOWN='unknown'
  ALL_TYPES=[T_IGNORE,T_READER,T_WRITER,T_EXTERNAL,T_COMBINED]
  ALL_INTERNAL_TYPES=[T_IGNORE,T_READER,T_WRITER,T_COMBINED]
  def __init__(self, name, infoHandler:InfoHandler,queue:AVNQueue,param):
    super().__init__(name, infoHandler)
    self.queue=queue
    self.param=param.copy()
    self.type=param['type']
    self.serialHandler=None
    self.stop=False
    self.isRunning=True
    self.lock=threading.Condition()

  def getDevice(self):
    return self.param.get('port')
  def run(self):
    if self.stop:
      self.isRunning=False
      return
    try:
      device=self.getDevice()
      INAME=self.name
      sourceName=self.param['name']
      displayName=""
      if sourceName != self.param.get('defaultName'):
        displayName="({0}) ".format(sourceName)
      if device is not None and self.type != self.T_IGNORE:
        self.setInfo(INAME,"%s%s running %s"%(device,displayName,self.type),WorkerStatus.STARTED,
                     canDelete=self.param.get('childIndex',-1) >= 0)
        if self.type == self.T_WRITER or self.type == self.T_COMBINED:
          self.param[SerialWriter.P_COMBINED.name]=self.type == self.T_COMBINED
          self.serialHandler = SerialWriter(self.param, self.queue, SubInfoHandler(self,INAME,track=False), sourceName)
        else:
          self.serialHandler = SerialReader(self.param, self.queue, SubInfoHandler(self,INAME,track=False), sourceName)
        self.serialHandler.run()
      else:
        if device is None:
          self.setInfo(INAME,"%sconfigured but not available"%(displayName),WorkerStatus.INACTIVE,canDelete=True)
        else:
          if self.type == self.T_IGNORE:
            self.setInfo(INAME, '%s%s configured to be ignored' % (device,displayName), WorkerStatus.INACTIVE,canDelete=True)
          else:
            self.setInfo(INAME, '%s%s not configured(forbidden)' %(device,displayName), WorkerStatus.INACTIVE)
        while (not self.stop):
          with self.lock:
            self.lock.wait(0.2)
    finally:
      self.cleanup()
      self.isRunning=False

  def stopHandler(self):
    self.stop=True
    if self.serialHandler:
      self.serialHandler.stopHandler()
    with self.lock:
      self.lock.notifyAll()
    start=time.monotonic()
    while (time.monotonic() < (start+0.2)):
      if not self.isRunning:
        return
      with self.lock:
        self.lock.wait(0.05)

  def mustCheckLimit(self):
    if self.param.get('port') is None:
      return False
    return self.type in [self.T_COMBINED,self.T_WRITER,self.T_READER]

class ExternalHandler(UsbSerialHandler):
  def __init__(self, name, infoHandler:InfoHandler,queue:AVNQueue, param):
    super().__init__(name, infoHandler, queue, param)
    self.callback=param['callback']
    self.childId=None #no editing possible

  def run(self):
    device = self.param.get('port')
    handlername = self.param.get('handlername', 'external')
    try:
      self.callback(device)
      self.setInfo(None, '%s %s: handled by %s' % (self.name,device,handlername), WorkerStatus.INACTIVE)
    except Exception as e:
      self.setInfo(None,'%s %s: error in handler %s: %s'%(self.name,device,handlername,str(e)),WorkerStatus.ERROR)
    while( not self.stop):
      time.sleep(0.2)
    self.cleanup()

class ExternalRegistration(object):
  def __init__(self,usibid,name,callback):
    self.name=name
    self.usbid=usibid
    self.callback=callback

if hasUdev:
  class Observer(pyudev.MonitorObserver):
  
  
    def __init__(self,infoHandler, monitor, event_handler=None, callback=None, *args, **kwargs):
      super().__init__(monitor, event_handler, callback, *args, **kwargs)
      self.infoHandler=infoHandler
  
    def run(self):
      self.infoHandler.setInfo("monitor","running",WorkerStatus.NMEA)
      try:
        super().run()
      except:
        pass
      self.infoHandler.deleteInfo('monitor')


#a worker that will use udev to find serial devices
#based on the configuration it will open available devices and read data from them
class AVNUsbSerialReader(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUsbSerialReader"
  P_MAXDEVICES=WorkerParameter('maxDevices',5,type=WorkerParameter.T_NUMBER,
                               description='max number of USB devices, this includes preconfigured devices!')
  P_UNKNOWN=WorkerParameter('allowUnknown',True,type=WorkerParameter.T_BOOLEAN,
                            description='allow devices that are not configured')
  P_USBDEVICE=WorkerParameter('usbid',None,type=WorkerParameter.T_STRING,editable=False,
                              description='an identifier of the USB device\n.../1-1.3.1:1.0/ttyUSB2/tty/ttyUSB2 - identifier would be 1-1.3.1')
  P_DTYPE=WorkerParameter('type', 'reader',type=WorkerParameter.T_SELECT,rangeOrList=UsbSerialHandler.ALL_INTERNAL_TYPES,
                          description="the type of this serial channel: reader or writer or combined (both reader and writer)\nor ignored to not use it at all")
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      #get the default configuration for a serial reader
      rt=list(filter(lambda p: p.name != 'port',SerialReader.getConfigParam()))
      ownParameters=[
          cls.P_MAXDEVICES,
          cls.P_UNKNOWN
          ]
      return rt+ownParameters
    if child == CHILD_NAME:
      return {} #accept all values here and do not apply defaults
    return None

  #get the parameters for an usb device
  @classmethod
  def getSerialParam(cls):
    rt=list(filter(lambda p:p.name != SerialWriter.P_PORT.name and p.name != SerialWriter.P_COMBINED.name,SerialWriter.getConfigParam()))
    rt = rt+ list(filter(lambda p: p.name == SerialReader.P_MINBAUD.name, SerialReader.getConfigParam()))
    ownParam=[
        cls.P_USBDEVICE,
        cls.P_DTYPE,
        AVNWorker.NAME_PARAMETER
        ]
    return rt+ownParam
  
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasUdev:
      raise Exception("no pyudev installed, cannot run %s"%(cls.getConfigName()))
    cls.checkSingleInstance()
    return AVNUsbSerialReader(cfgparam)

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.externalHandlers={}
    self.monitor=None
    #do some late cfg checking here
    configuredDevices=self.param.get(CHILD_NAME,[])
    for device in configuredDevices:
      WorkerParameter.checkValuesFor(self.getSerialParam(),device,self.param)


  def getParam(self, child=None,filtered=False):
    if child is None:
      return super().getParam(child,filtered=filtered)
    if not ':' in child:
      raise Exception("invalid child id, missing :")
    (tag, usbid) = child.split(':', 1)
    if tag != CHILD_NAME:
      raise Exception("invalid child id, wrong tag %s" % tag)
    handler=self.addrmap.get(usbid)
    if handler is None:
      raise Exception("child %s not found"%child)
    if filtered:
      return WorkerParameter.filterByList(self.getSerialParam(),handler.param)
    return handler.param

  def getDefaultChildName(self,usbid):
    return "{0}-{1}".format(self.getName(),usbid)

  def getEditableChildParameters(self, child):
    if not child.startswith(CHILD_NAME+":"):
      raise Exception("unknown child type %s"%child)
    (tag,usbid)=child.split(':',1)
    rt=WorkerParameter.filterEditables(self.getSerialParam(),makeCopy=True)
    for p in rt:
      if p.name == SerialWriter.P_READFILTER.name:
        p.condition={self.P_DTYPE.name: UsbSerialHandler.T_COMBINED}
      if p.name == SerialReader.P_MINBAUD.name:
        p.condition={self.P_DTYPE.name:UsbSerialHandler.T_READER}
      if p.name ==  SerialWriter.P_BLACKLIST.name:
        p.condition=[{self.P_DTYPE.name: UsbSerialHandler.T_WRITER},{self.P_DTYPE.name:UsbSerialHandler.T_COMBINED}]
      if p.name == SerialWriter.P_REPLY_RECEIVED.name:
        p.condition=[{self.P_DTYPE.name:UsbSerialHandler.T_COMBINED}]
      if p.name == self.NAME_PARAMETER.name:
        p.default=self.getDefaultChildName(usbid)
    return rt

  def canDeleteChild(self, child):
    return True

  def _findHandlerForChild(self,child,external=False):
    if not ':' in child:
      raise Exception("invalid child id, missing :")
    (tag,usbid)=child.split(':',1)
    if tag != CHILD_NAME:
      raise Exception("invalid child id, wrong tag %s"%tag)
    handler=self.addrmap.get(usbid)
    if handler is None:
      raise Exception("child %s is not available"%child)
    if isinstance(handler,ExternalHandler) and not external:
        raise Exception("cannot modify device %s, externally handled"%usbid)
    return (usbid,handler)

  def updateConfig(self, param, child=None):
    if child is None:
      hasChanged=super().updateConfig(param)
      if hasChanged:
        self._stopHandlers()
      return
    (usbid,handler)=self._findHandlerForChild(child)
    param['usbid']=usbid
    checked = WorkerParameter.checkValuesFor(self.getSerialParam(),param,handler.param)
    self.maplock.acquire()
    try:
      config = self.getParamByUsbId(usbid, None)  # we just want the new childIndex as this could have changed
      if config is None:
        raise Exception("cannot configure device %s, not existing and not active" % usbid)
      childIndex=config.get('childIndex')
      if childIndex is None:
        #external device
        raise Exception("cannot configure externally managed device %s"%usbid)
      for k,v in checked.items():
        childIndex=self.changeChildConfig(CHILD_NAME,childIndex,k,v,delayWriteOut=True)
    finally:
      self.maplock.release()
    self.writeConfigChanges()
    self.stopHandler(usbid)

  def deleteChild(self, child):
    (usbid,handler)=self._findHandlerForChild(child)
    self.maplock.acquire()
    mustWrite=False
    try:
      config = self.getParamByUsbId(usbid, None)  # we just want the new childIndex as this could have changed
      if config is None:
        raise Exception("cannot configure device %s, not existing and not active" % usbid)
      childIndex = config.get('childIndex')
      if childIndex is None:
        # external device
        raise Exception("cannot configure externally managed device %s" % usbid)
      if childIndex >= 0:
        self.removeChildConfig(CHILD_NAME,childIndex,delayWriteOut=True)
        mustWrite=True
    finally:
      self.maplock.release()
    if mustWrite:
      self.writeConfigChanges()
    self.stopHandler(usbid)

  def getUsedResources(self, type=None):
    if type != UsedResource.T_SERIAL and type != UsedResource.T_USB and type is not None:
      return []
    rt=[]
    self.maplock.acquire()
    try:
      for k,v in self.addrmap.items():
        dev=v.getDevice()
        if dev is not None and v.param.get('type') != UsbSerialHandler.T_IGNORE:
          if type is None or type == UsedResource.T_SERIAL:
            rt.append(UsedResource(UsedResource.T_SERIAL,self.id,dev))
          if type is None or type == UsedResource.T_USB:
            rt.append(UsedResource(UsedResource.T_USB,self.id,k))
    finally:
      self.maplock.release()
    return rt

  def registerExternalHandler(self,usbid,name,callback):
    AVNLog.info("AVNUsbSerialReader: register external handler %s for %s",name,usbid)
    old=None
    self.maplock.acquire()
    try:
      old=self.externalHandlers.get(usbid)
      if old is None:
        self.externalHandlers[usbid]=ExternalRegistration(usbid,name,callback)
      else:
        if old.name == name:
          #update
          old.callback=callback
          old=None
    finally:
      self.maplock.release()
    if old is not None:
      AVNLog.error("AVNUsbSerialReader: external handler for %s already registered: %s"%(usbid,old.name))
      raise Exception("handler for %s already registered: %s"%(usbid,old.name))
    #potentially we had the device already open - close it now
    self.stopHandler(usbid)

  def deregisterExternalHandlers(self,name,usbid=None):
    AVNLog.info("AVNUsbSerialReader: deregister external handler %s ", name)
    self.maplock.acquire()
    deletes=[]
    try:
      for k,v in self.externalHandlers.items():
        if v.get('name') == name and usbid is None or usbid == k:
          deletes.append(k)
      for d in deletes:
        del self.externalHandlers[d]
    finally:
      self.maplock.release()
    for d in deletes:
      self.stopHandler(d)

  #return True if added
  def checkAndAddHandler(self,handler):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    try:
      if handler.mustCheckLimit():
        numActive=0
        for entry in list(self.addrmap.values()):
          if not entry.mustCheckLimit():
            continue
          numActive+=1
        if numActive >= maxd:
          return rt
      if not handler.name in self.addrmap:
        self.addrmap[handler.name]=handler
        return True
    finally:
      self.maplock.release()
    return rt
  
  def removeHandler(self,addr,handler=None):
    rt=None
    with self.maplock:
      if handler is not None:
        #if we are called from a handler - only remove exactly this handler
        old=self.addrmap.get(addr)
        if old is not None and old != handler:
          return
      rt=self.addrmap.get(addr)
      if rt is not None:
        self.addrmap.pop(addr)
    return rt
    
  #param  a dict of usbid->device
  #returns a dict: usbid->start|stop|keep
  def getStartStopList(self,handlerlist):
    rt={}
    self.maplock.acquire()
    try:
      for h in list(handlerlist.keys()):
        if h in self.addrmap:
          if handlerlist[h] != self.addrmap[h].getDevice():
            rt['h']='restart'
          else:
            rt[h]='keep'
        else:
          rt[h]='start'
      for h in list(self.addrmap.keys()):
        if not h in rt:
          rt[h]='stop'
    finally:
      self.maplock.release()
    return rt
  
  def usbIdFromPath(self,path):
    rt=path.split('/')
    idx=len(rt) -1
    while idx > 0:
      if not rt[idx].startswith('tty'):
        return rt[idx]
      idx-=1
    return rt[-1]
  
  def getParamByUsbId(self,usbid,device,allowUnknown=False):
    externalHandler=self.externalHandlers.get(usbid)
    if externalHandler is not None:
      return {
        'type':UsbSerialHandler.T_EXTERNAL,
        'callback':externalHandler.callback,
        'handlername':externalHandler.name,
        'port':device
      }
    configuredDevices=self.param.get(CHILD_NAME)
    defaultName=self.getDefaultChildName(usbid)
    config=None
    if configuredDevices is not None:
      childIndex=0
      for dev in configuredDevices:
        if usbid==dev.get('usbid'):
          dev['childIndex']=childIndex
          config=WorkerParameter.filterByList(self.getSerialParam(),self.param,addDefaults=True)
          config.update(dev)
          if config.get('type') is None:
            config[type]=UsbSerialHandler.T_READER
          break
        childIndex+=1
    if config is None:
      config=WorkerParameter.filterByList(self.getSerialParam(),self.param,addDefaults=True)
      config['usbid']=usbid
      config['type']=UsbSerialHandler.T_READER if allowUnknown else UsbSerialHandler.T_UNKNOWN
      config['childIndex']=-1
    config['port']=device
    if config.get('name') is None or config.get('name') == '':
      config['name']=defaultName
    config['defaultName']=defaultName
    return config

  #a thread method to run a serial reader/writer
  def serialRun(self,handler,addr):
    try:
      handler.run()
    except:
      AVNLog.info("serial handler stopped with %s",(traceback.format_exc(),))
    AVNLog.debug("serial handler for %s finished",addr)
    self.removeHandler(addr,handler)
    handler.cleanup()
  
  #param: a dict key being the usb id, value the device node
  def checkDevices(self,devicelist):
    startStop=self.getStartStopList(devicelist)
    for usbid in startStop:
      if startStop[usbid]=='start':
        old=self.addrmap.get(usbid)
        if old is not None:
          #the handler is still/already there
          #do nothing - potentially we handle it in the next round
          continue
        AVNLog.debug("must start handler for %s at %s",usbid,devicelist[usbid])
        param=self.getParamByUsbId(usbid,devicelist[usbid],self.P_UNKNOWN.fromDict(self.param))
        if param['type'] == 'external':
          handler=ExternalHandler(usbid,self,self.queue,param)
        else:
          handler=UsbSerialHandler(usbid,self,self.queue,param)
        res=self.checkAndAddHandler(handler)
        if not res:
            AVNLog.debug("max number of readers already reached, skip start of %s at %s",usbid,devicelist[usbid])
            continue
        handlerThread=threading.Thread(target=self.serialRun,args=(handler,usbid))
        handlerThread.daemon=True
        handlerThread.start()
        AVNLog.info("started %s for device  %s at %s",param['type'],usbid,devicelist[usbid])
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
    

  def monitorAction(self,action,device):
    if action == 'remove':
      usbid = self.usbIdFromPath(device.device_path)
      AVNLog.info("device removal detected %s", usbid)
      self.stopHandler(usbid)

        
  #this is the main thread - this executes the polling
  def run(self):
    self.setInfo('main', "discovering", WorkerStatus.RUNNING)
    self.setNameIfEmpty("%s-polling"%(self.getName()))
    self.wait(5) # give a chance to have the feeder socket open...
    #now start an endless loop with udev discovery...
    #any removal will be detected by the monitor (to be fast)
    #but we have an audit here anyway
    #the removal will be robust enough to deal with 2 parallel tries
    context=None
    init=True
    while not self.shouldStop():
      currentDevices={}
      try:
        AVNLog.debug("starting udev discovery")
        if context is None:
          context=pyudev.Context()
        allDev=context.list_devices(subsystem='tty')
        for dev in allDev:
          if dev.parent is None or not (dev.parent.subsystem == "usb-serial" or dev.parent.subsystem == "usb"):
            continue
          usbid=self.usbIdFromPath(dev.device_path)
          AVNLog.debug("discovered usb serial tty device %s at %s (usbid=%s)",dev.device_node,str(dev),usbid)
          currentDevices[usbid]=dev.device_node
        configuredDevices=self.param.get(CHILD_NAME)
        if configuredDevices is not None:
          for cfg in configuredDevices:
            usbid=cfg.get('usbid')
            if usbid is not None and not usbid in currentDevices:
              currentDevices[usbid]=None
        self.checkDevices(currentDevices)
        if init:
          if self.monitor is not None:
            try:
              self.monitor.stop()
            except:
              pass
          monitor = pyudev.Monitor.from_netlink(context)
          monitor.filter_by(subsystem='tty')
          self.monitor=Observer(self,monitor,self.monitorAction)
          self.monitor.start()
          init=False
      except Exception as e:
        AVNLog.debug("exception when querying usb serial devices %s, retrying after 10s",traceback.format_exc())

      self.wait(10)
    try:
      self.monitor.stop()
    except:
      pass

  def _stopHandlers(self):
    usbids=[]+list(self.addrmap.keys())
    for id in usbids:
      self.stopHandler(id)

  def stop(self):
    super().stop()
    self._stopHandlers()


avnav_handlerList.registerHandler(AVNUsbSerialReader)
