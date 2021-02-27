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

class InfoHandler(object):
  def __init__(self,name,parent):
    self.name=name
    self.parent=parent
    self.childId="%s:%s"%(CHILD_NAME,name)
  def setInfo(self,item,text,status):
    self.parent.setInfo(self.name,text,status,self.childId)
  def deleteInfo(self,item):
    self.parent.deleteInfo(self.name)

class UsbSerialHandler(InfoHandler):
  T_IGNORE='ignore'
  T_READER='reader'
  T_WRITER='writer'
  T_EXTERNAL='external'
  T_COMBINED='combined'
  ALL_TYPES=[T_IGNORE,T_READER,T_WRITER,T_EXTERNAL,T_COMBINED]
  ALL_INTERNAL_TYPES=[T_IGNORE,T_READER,T_WRITER,T_COMBINED]
  def __init__(self, name, parent,device,param):
    super().__init__(name, parent)
    self.param=param
    self.type=param['type']
    self.serialHandler=None
    self.stop=False
    self.device=device

  def run(self):
    if self.device is not None and self.type != self.T_IGNORE:
      sourceName=self.param.get('name',"%s-%s" % (self.parent.getName(), self.name))
      if self.type == self.T_WRITER or self.type == self.T_COMBINED:
        self.serialHandler = SerialWriter(self.param, self.parent.writeData, self, sourceName)
        if self.type == self.T_COMBINED:
          self.serialHandler.param["combined"] = True
      else:
        self.serialHandler = SerialReader(self.param, self.parent.writeData, self, sourceName)
        self.serialHandler.run()
    else:
      if self.device is None:
        self.setInfo(None,"%s: not available"%self.device,WorkerStatus.INACTIVE)
      else:
        self.setInfo(None, '%s: ignored' % self.device, WorkerStatus.INACTIVE)
      while (not self.stop):
        time.sleep(0.2)
      self.deleteInfo(None)

  def stopHandler(self):
    self.stop=True
    if self.serialHandler:
      self.serialHandler.stopHandler()

  def mustCheckLimit(self):
    if self.device is None:
      return False
    return self.type in [self.T_COMBINED,self.T_WRITER,self.T_READER]

class ExternalHandler(UsbSerialHandler):
  def __init__(self, name, parent, device, param):
    super().__init__(name, parent, device, param)
    self.callback=param['callback']
    self.childId=None #no editing possible

  def run(self):
    handlername = self.param.get('handlername', 'external')
    try:
      self.callback(self.device)
      self.setInfo(None, '%s: handled by %s' % (self.device,handlername), WorkerStatus.INACTIVE)
    except Exception as e:
      self.setInfo(None,'%s: error in handler %s: %s'%(self.device,handlername,str(e)),WorkerStatus.ERROR)
    while( not self.stop):
      time.sleep(0.2)
    self.deleteInfo(None)

class ExternalRegistration(object):
  def __init__(self,usibid,name,callback):
    self.name=name
    self.usbid=usibid
    self.callback=callback

#a worker that will use udev to find serial devices
#based on the configuration it will open available devices and read data from them
class AVNUsbSerialReader(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUsbSerialReader"
  
  @classmethod
  def getConfigParam(cls, child=None, forEdit=False):
    if child is None:
      #get the default configuration for a serial reader
      rt=list(filter(lambda p: p.name != 'port',SerialReader.getConfigParam()))
      ownParameters=[
          WorkerParameter('maxDevices',5,type=WorkerParameter.T_NUMBER,
                          description='max number of USB devices, this includes preconfigured devices!'),
          WorkerParameter('feederName','',type=WorkerParameter.T_STRING,editable=False),
          WorkerParameter('allowUnknown',True,type=WorkerParameter.T_BOOLEAN,
                          description='allow devices that are not configured')
          ]
      return rt+ownParameters
    if child == CHILD_NAME:
      if not forEdit:
        return {} #accept all values here and do not apply defaults
      return cls.getSerialParam()
    return None
  #get the parameters for an usb device
  @classmethod
  def getSerialParam(cls):
    rt=list(filter(lambda p:p.name != 'port',SerialWriter.getConfigParam()))
    ownParam=[
        WorkerParameter('usbid',None,type=WorkerParameter.T_STRING,editable=False,
                        description='an identifier of the USB device\n.../1-1.3.1:1.0/ttyUSB2/tty/ttyUSB2 - identifier would be 1-1.3.1'),
        WorkerParameter('type', 'reader',type=WorkerParameter.T_SELECT,rangeOrList=UsbSerialHandler.ALL_INTERNAL_TYPES)
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



  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.externalHandlers={}
    #do some late cfg checking here
    configuredDevices=self.param.get(CHILD_NAME,[])
    for device in configuredDevices:
      usbid=device.get('usbid')
      if usbid is None:
        raise Exception("missing parameter usbid for configured device %s"%CHILD_NAME)
      deviceConfig=self.getParamByUsbId(usbid)
      if deviceConfig.get('type') == UsbSerialHandler.T_EXTERNAL:
        continue
      for p in self.getSerialParam():
        if deviceConfig.get(p.name) is None:
          raise Exception("missing mandatory parameter %s for %s usbid=%s"%(p.name,CHILD_NAME,usbid))

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

  def updateConfig(self, param, child=None):
    if child is None:
      return super().updateConfig(param)
    if not ':' in child:
      raise Exception("invalid child id, missing :")
    (tag,usbid)=child.split(':',1)
    if tag != CHILD_NAME:
      raise Exception("invalid child id, wrong tag %s"%tag)
    self.maplock.acquire()
    handler=None
    try:
      handler=self.addrmap.get(usbid)
    finally:
      self.maplock.release()
    if handler is not None:
      #currently active device
      if isinstance(handler,ExternalHandler):
        raise Exception("cannot modify device %s, externally handled"%usbid)
    config=self.getParamByUsbId(usbid)
    if config is None and handler is None:
      raise Exception("cannot configure device %s, not existing and not active"%usbid)
    checked = self.checkConfig(param, child)
    if config is not None:
      childIndex=config.get('childIndex')
      if childIndex is None:
        #external device
        raise Exception("cannot configure externally managed device %s"%usbid)
    else:
      childIndex=-1 #add new child
      config={'type':handler.type,'usbid':usbid}
      config.update(checked)
      checked=config
    for k,v in checked.items():
      childIndex=self.changeChildConfig(tag,childIndex,k,v,delayWriteOut=True)
    self.writeConfigChanges()
    if handler is not None:
      self.stopHandler(usbid)

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
    except:
      self.maplock.release()
      raise
    self.maplock.release()
    if old is not None:
      AVNLog.error("AVNUsbSerialReader: external handler for %s already registered: %s"%(usbid,old.name))
      raise Exception("handler for %s already registered: %s"%(usbid,old.name))
    #potentially we had the device already open - close it now
    self.stopHandler(usbid)

  #return True if added
  def checkAndAddHandler(self,handler):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if handler.mustCheckLimit():
      numActive=0
      for entry in list(self.addrmap.values()):
        if not entry.mustCheckLimit():
          continue
        numActive+=1
      if numActive >= maxd:
        self.maplock.release()
        return rt
    if not handler.name in self.addrmap:
      self.addrmap[handler.name]=handler
      rt=True
    self.maplock.release()
    return rt
  
  def removeHandler(self,addr,handler=None):
    rt=None
    self.maplock.acquire()
    try:
      if handler is not None:
        #if we are called from a handler - only remove exactly this handler
        old=self.addrmap.get(addr)
        if old is not None and old != handler:
          self.maplock.release()
          return
      rt=self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
    return rt
    
  #param  a dict of usbid->device
  #returns a dict: usbid->start|stop|keep
  def getStartStopList(self,handlerlist):
    rt={}
    self.maplock.acquire()
    for h in list(handlerlist.keys()):
      if h in self.addrmap:
        if handlerlist[h] != self.addrmap[h].device:
          rt['h']='restart'
        else:
          rt[h]='keep'
      else:
        rt[h]='start'
    for h in list(self.addrmap.keys()):
      if not h in rt:
        rt[h]='stop'
    self.maplock.release()
    return rt
  
  def usbIdFromPath(self,path):
    rt=re.sub('/ttyUSB.*','',path).split('/')[-1]
    return rt
  
  def getParamByUsbId(self,usbid):
    externalHandler=self.externalHandlers.get(usbid)
    if externalHandler is not None:
      return {
        'type':'external',
        'callback':externalHandler.callback,
        'handlername':externalHandler.name
      }
    configuredDevices=self.param.get(CHILD_NAME)
    if configuredDevices is None:
      return None
    childIndex=0
    for dev in configuredDevices:
      if usbid==dev.get('usbid'):
        dev['childIndex']=childIndex
        config=WorkerParameter.filterByList(self.getSerialParam(),self.param,addDefaults=True)
        config.update(dev)
        return config
      childIndex+=1
    return None
  
  def setParameterForSerial(self,param,usbid,device):
    rt=param.copy()
    rt.update({
               'name':"%s-%s"%(usbid,device),
               'port':device
               })
    return rt

  #a thread method to run a serial reader/writer
  def serialRun(self,handler,addr):
    try:
      handler.run()
    except:
      AVNLog.info("serial handler stopped with %s",(traceback.format_exc(),))
    AVNLog.debug("serial handler for %s finished",addr)
    self.removeHandler(addr,handler)
    self.deleteInfo(handler.getName())
  
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
        param=self.getParamByUsbId(usbid)
        type="anonymous"
        if param is None:
          if not self.getBoolParam('allowUnknown'):
            AVNLog.debug("unknown devices not allowed, skip start of %s at %s",usbid,devicelist[usbid])
            continue
          param=self.setParameterForSerial(
            WorkerParameter.filterByList(self.getSerialParam(),self.getParam(),addDefaults=True),
            usbid,devicelist[usbid])
        else:
          type="known"
          param=self.setParameterForSerial(param, usbid, devicelist[usbid])
        handlertype="reader"
        if param.get('type') is not None:
          handlertype=param.get('type')
        else:
          param['type']=handlertype
        if handlertype == 'external':
          handler=ExternalHandler(usbid,self,devicelist[usbid],param)
        else:
          handler=UsbSerialHandler(usbid,self,devicelist[usbid],param)
        res=self.checkAndAddHandler(handler)
        if not res:
            AVNLog.debug("max number of readers already reached, skip start of %s at %s",usbid,devicelist[usbid])
            continue
        handlerThread=threading.Thread(target=self.serialRun,args=(handler,usbid))
        handlerThread.daemon=True
        handlerThread.start()
        AVNLog.info("started %s for %s device  %s at %s",handlertype,type,usbid,devicelist[usbid])
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
    
        
  #start monitoring in separate thread
  #method will never return...
  def monitorDevices(self,context):
    self.setInfo('monitor', "running", WorkerStatus.RUNNING)
    threading.current_thread().setName("%s[monitor]"%(self.getThreadPrefix()))
    AVNLog.info("start device monitoring")
    while True:
      try:
        monitor = pyudev.Monitor.from_netlink(context)
        monitor.filter_by(subsystem='tty')
        AVNLog.info("start monitor loop")
        for deviceaction in monitor:
          action,device=deviceaction
          if action=='remove':
            usbid=self.usbIdFromPath(device.device_path)
            AVNLog.info("device removal detected %s",usbid)
            self.stopHandler(usbid)
      except:
        AVNLog.error("error in usb monitor loop: ",traceback.format_exc(1))
        time.sleep(2)
          #any start handling we leave to the audit...
        
  #this is the main thread - this executes the polling
  def run(self):
    self.setInfo('main', "discovering", WorkerStatus.RUNNING)
    self.setName("%s-polling"%(self.getThreadPrefix()))
    self.wait(5) # give a chance to have the feeder socket open...
    #now start an endless loop with udev discovery...
    #any removal will be detected by the monitor (to be fast)
    #but we have an audit here anyway
    #the removal will be robust enough to deal with 2 parallel tries
    context=None
    init=True
    while True:
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
          monitorThread=threading.Thread(target=self.monitorDevices,args=(context,))
          monitorThread.daemon=True
          monitorThread.start()
          init=False
      except Exception as e:
        AVNLog.debug("exception when querying usb serial devices %s, retrying after 10s",traceback.format_exc())
        context=None
      time.sleep(10)

avnav_handlerList.registerHandler(AVNUsbSerialReader)
