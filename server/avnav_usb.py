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
import socket
import threading
import re

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_serial import *
from avnav_serialwriter import *
import avnav_handlerList
hasUdev=False
try:
  import pyudev
  hasUdev=True
except:
  pass


class DummyHandler():
  def __init__(self):
    self.stop=False
  def run(self):
    while( not self.stop):
      time.sleep(0.2)
  def stopHandler(self):
    self.stop=True


#a worker that will use udev to find serial devices
#based on the configuration it will open available devices and read data from them
class AVNUsbSerialReader(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUsbSerialReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      #get the default configuration for a serial reader
      rt=SerialReader.getConfigParam().copy()
      rt.update({
          'port': 0,        #we do not use this
          'name':'',
          'maxDevices':5,   #this includes preconfigured devices!
          'feederName':'',  #if set, use this feeder
          'allowUnknown':'true' #allow devices that are not configured
          })
      return rt
    if child == "UsbDevice":
      return cls.getSerialParam()
    return None
  #get the parameters for an usb device
  @classmethod
  def getSerialParam(cls):
    rt=SerialWriter.getConfigParam().copy()
    rt.update({
        'port': 0,
        'name':'',    #will be set automatically
        'usbid':None, #an identifier of the USB device 
                      #.../1-1.3.1:1.0/ttyUSB2/tty/ttyUSB2 - identifier would be 1-1.3.1
        'type': 'reader',
               })
    return rt
  
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasUdev:
      raise Exception("no pyudev installed, cannot run %s"%(cls.getConfigName()))
    cls.checkSingleInstance()
    return AVNUsbSerialReader(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.writeData=None
    self.setName(self.getName())
    
  def getName(self):
    return "AVNUsbSerialReader"
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam('feederName') or "")
    self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
   
  #return True if added
  def checkAndAddHandler(self,addr,handler,device):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=(handler,device)
        rt=True
    self.maplock.release()
    return rt
  
  def removeHandler(self,addr):
    rt=None
    self.maplock.acquire()
    try:
      rt=self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
    if rt is None:
      return None
    return rt[0]
    
  #param  a dict of usbid->device
  #returns a dict: usbid->start|stop|keep
  def getStartStopList(self,handlerlist):
    rt={}
    self.maplock.acquire()
    for h in handlerlist.keys():
      if h in self.addrmap:
        if handlerlist[h] != self.addrmap[h][1]:
          rt['h']='restart'
        else:
          rt[h]='keep'
      else:
        rt[h]='start'
    for h in self.addrmap.keys():
      if not h in rt:
        rt[h]='stop'
    self.maplock.release()
    return rt
  
  def usbIdFromPath(self,path):
    rt=re.sub('/ttyUSB.*','',path).split('/')[-1]
    return rt
  
  def getParamByUsbId(self,usbid):
    configuredDevices=self.param.get('UsbDevice')
    if configuredDevices is None:
      return None
    for dev in configuredDevices:
      if usbid==dev['usbid']:
        return dev
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
    self.removeHandler(addr)
    self.deleteInfo(handler.getName())
  
  #param: a dict key being the usb id, value the device node
  def checkDevices(self,devicelist):
    startStop=self.getStartStopList(devicelist)
    for usbid in startStop:
      if startStop[usbid]=='start':
        AVNLog.debug("must start handler for %s at %s",usbid,devicelist[usbid])
        param=self.getParamByUsbId(usbid)
        type="anonymous"
        if param is None:
          if not self.getBoolParam('allowUnknown'):
            AVNLog.debug("unknown devices not allowed, skip start of %s at %s",usbid,devicelist[usbid])
            continue
          param=self.setParameterForSerial(self.getParam(),usbid,devicelist[usbid])
        else:
          type="known"
          param=self.setParameterForSerial(param, usbid, devicelist[usbid])
        handlertype="reader"
        if param.get('type') is not None:
          handlertype=param.get('type')
        if handlertype == 'writer' or handlertype == "combined":
          handler=SerialWriter(param,None,self.writeData,self)
          if handlertype == "combined":
            handler.param["combined"]=True
        else:
          if handlertype == 'reader':
            handler=SerialReader(param, None, self.writeData, self)
          else:
            AVNLog.info("ignore device %s : type %s",usbid,handlertype)
            handler=DummyHandler()
        res=self.checkAndAddHandler(usbid, handler,devicelist[usbid])
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
    self.setInfo('monitor', "running", AVNWorker.Status.RUNNING)
    threading.current_thread().setName("[%s]%s[monitor]"%(AVNLog.getThreadId(),self.getName()))
    AVNLog.info("start device monitoring")
    monitor = pyudev.Monitor.from_netlink(context)
    monitor.filter_by(subsystem='tty')
    AVNLog.info("start monitor loop")
    for deviceaction in monitor:
      action,device=deviceaction
      if action=='remove':
        usbid=self.usbIdFromPath(device.device_path)
        AVNLog.info("device removal detected %s",usbid)
        self.stopHandler(usbid)
      #any start handling we leave to the audit...
        
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    self.setInfo('main', "discovering", AVNWorker.Status.RUNNING)
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the feeder socket open...   
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
          AVNLog.debug("discovered usb serial tty device %s at %s (usbid=%s)",dev.device_node,unicode(dev),usbid)
          currentDevices[usbid]=dev.device_node
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
  #overloaded info method
  def getInfo(self):
    try:
      rt=self.info.copy();
      st=self.status.copy()
      rta=[]
      keys=sorted(rt.keys(),key=lambda x: re.sub("^[^-]*[-]","-",x))
      for k in keys:
        try:
          elem={}
          elem['name']=k
          elem['info']=rt[k]
          elem['status']=st[k]
          rta.append(elem)
        except:
          pass
      return {'name':self.getName(),'items':rta}
    except:
      return {'name':self.getName(),'items':[],'error':"no info available"}
avnav_handlerList.registerHandler(AVNUsbSerialReader)
