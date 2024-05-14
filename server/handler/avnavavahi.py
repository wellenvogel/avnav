# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013-2021 Andreas Vogel andreas@wellenvogel.net
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
#  parts contributed by free-x https://github.com/free-x
#  parts contributed by Matt Hawkins http://www.raspberrypi-spy.co.uk/
#
###############################################################################
from math import floor

import time

import threading
from typing import Set, Any, Dict

import avnav_handlerList
from avnav_util import AVNLog, AVNUtil
from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus

#taken from https://github.com/carlosefr/mdns-publisher/tree/master/mpublisher
from httpserver import AVNHttpServer

hasDbus=False
Glib=None
try:
  import dbus.glib
  from dbus import DBusException
  hasDbus=True
  from gi.repository import GLib
except:
  pass


class ServiceDescription:
  def __init__(self,type,name,port):
    self.type=type
    self.name=name
    self.port=port
    self.currentName=name
    self.retryCount=0
    self.isRegistered=False
    self.group=None #if group is not None but isRegisterd is False we need to deregister
    self.oldKey=None

  def retry(self,maxtries):
    if self.retryCount >= maxtries:
      return False
    self.retryCount+=1
    self.currentName="%s-%d"%(self.name,self.retryCount)
    return True

  def reset(self):
    self.retryCount=0
    self.isRegistered=False
    self.currentName=self.name

  def getKey(self):
    return self.name+"."+self.type

  def equal(self, other) -> bool:
    if other is None:
      return False
    if self.name != other.name:
      return False
    if self.type != other.type:
      return False
    if self.port != other.port:
      return False
    return True
  def update(self,other):
    if other.port == self.port and other.type == self.type and other.name == self.name:
      return
    self.oldKey=self.getKey()
    self.name=other.name
    self.type=other.type
    self.port=other.port
    self.reset()

  def __str__(self):
    return "Avahi Service: %s:%d[%s], reg=%s"%(self.getKey(),self.port,self.currentName,self.isRegistered)


class FoundService:
  def __init__(self,type,name,intf,proto):
    self.type=type
    self.name=name
    self.intf=intf
    self.proto=proto
  def __hash__(self):
    return hash((self.type,self.name,self.intf,self.proto))

  def __str__(self):
    return "Service %s.%s at %s"%(self.type,self.name,self.intf)
  def __eq__(self, other):
    return self.type == other.type \
           and self.name == other.name \
           and self.intf == other.intf \
           and self.proto == other.proto


class AVNAvahi(AVNWorker):
  services: Dict[int, ServiceDescription]
  #https://github.com/lathiat/avahi/blob/master/avahi-python/avahi/__init__.py
  DBUS_NAME = "org.freedesktop.Avahi"
  DBUS_PATH_SERVER = "/"
  DBUS_INTERFACE_SERVER = DBUS_NAME + ".Server"
  DBUS_INTERFACE_SERVICE_BROWSER = DBUS_NAME + ".ServiceBrowser"
  DBUS_INTERFACE_ENTRY_GROUP = DBUS_NAME + ".EntryGroup"
  IF_UNSPEC = -1
  PROTO_UNSPEC =-1
  PROTO_INET = 0
  PROTO_INET6 = 1

  ENTRY_GROUP_UNCOMMITED, ENTRY_GROUP_REGISTERING, ENTRY_GROUP_ESTABLISHED, ENTRY_GROUP_COLLISION, ENTRY_GROUP_FAILURE = range(0, 5)
  SERVER_INVALID, SERVER_REGISTERING, SERVER_RUNNING, SERVER_COLLISION, SERVER_FAILURE = range(0, 5)

  S_TYPE='_http._tcp'
  S_TYPE_NMEA=AVNUtil.NMEA_SERVICE
  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  def __init__(self, cfgparam):
    super().__init__(cfgparam)
    self.port=8080
    self.type='_http._tcp'
    self.loop=None
    self.stateSequence=0
    self.server=None
    self.hostname=''
    self.serviceBrowser=None
    self.services= {}
    self.foundServices=set()
    self.externalServicesIndex=1 #-1 is reserved for internal
    self.lock=threading.Lock()

  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return super().getConfigParam(child)
    return [
      WorkerParameter('serviceName','avnav-server',
                      description='the name for the web service that will be visible in avahi/mdns'),
      WorkerParameter('maxRetries',20,
                      description='how many retries if the name is already existing',
                      type=WorkerParameter.T_NUMBER),
      WorkerParameter('timeout',10,
                      description="timeout when registering at  avahi",
                      type=WorkerParameter.T_FLOAT),
      WorkerParameter('heartBeatInterval',60,editable=False,type=WorkerParameter.T_FLOAT)
    ]

  @classmethod
  def getConfigParamCombined(cls, child=None):
    if child is not None:
      return super().getConfigParamCombined(child)
    return [cls.ENABLE_PARAM_DESCRIPTION]+cls.getConfigParam()

  @classmethod
  def preventMultiInstance(cls):
    return True

  def _newService(self, interface, protocol, name, stype, domain, flags):
    serviceEntry=FoundService(stype,name,interface,protocol)
    if serviceEntry in self.foundServices:
      return
    AVNLog.info("detected new service %s.%s at %i.%i",stype,name,interface,protocol)
    try:
      self.foundServices.add(serviceEntry)
    except Exception as e:
      AVNLog.error("unable to add service %s: %s",str(serviceEntry),e)

  def _removedService(self,interface, protocol, name, stype, domain, flags):
    serviceEntry = FoundService(stype, name, interface, protocol)
    if not serviceEntry in self.foundServices:
      return
    AVNLog.info("detected removed service %s.%s at %i.%i",stype,name,interface,protocol)
    try:
        self.foundServices.remove(serviceEntry)
    except Exception as e:
      AVNLog.error("unable to remove service %s: %s",name,str(e))

  def _nextIndex(self):
    with self.lock:
      self.externalServicesIndex+=1
      return self.externalServicesIndex

  def _stopLoop(self):
    if self.loop is not None:
      try:
        self.loop.quit()
      except Exception as x:
        AVNLog.error("unable to stop dbus event loop %s"%str(x))
      self.loop=None
  def _publish(self, description: ServiceDescription) -> object:
    if description.group is not None:
      try:
        description.group.Reset()
      except:
        pass
      try:
        description.group.Free()
      except:
        pass
      try:
        description.group=None
        if description.oldKey is not None:
          self.deleteInfo(description.oldKey)
        else:
          self.deleteInfo(description.getKey())
      except:
        pass
    if description.name is None or description.name == '':
      return False
    description.group = dbus.Interface(
      dbus.SystemBus().get_object(
        self.DBUS_NAME,
        self.server.EntryGroupNew()),
      self.DBUS_INTERFACE_ENTRY_GROUP)
    timeout=self.getFloatParam('timeout')
    retries=self.getIntParam('maxRetries')
    num=0
    retry=True
    self.setInfo(description.getKey(),"trying to register",WorkerStatus.STARTED)
    while retry:
      retry=False
      AVNLog.info("trying to register %s for %s",description.currentName,str(self.port))
      try:
        description.group.AddService(self.IF_UNSPEC,self.PROTO_INET,dbus.UInt32(0),
                    description.currentName,description.type,self.server.GetDomainName(),
                    self.server.GetHostNameFqdn(),description.port,'')
        description.group.Commit()
      except Exception as e:
        AVNLog.warn("unable to register avahi service %s, error: %s",description.currentName,str(e))
        if description.retry(retries):
          retry=True
        continue
      waitTime=timeout*10
      state=description.group.GetState()
      while state in [self.ENTRY_GROUP_REGISTERING,self.ENTRY_GROUP_UNCOMMITED] and waitTime > 0:
        waitTime-=1
        time.sleep(0.1)
        state=description.group.GetState()
      if state == self.ENTRY_GROUP_COLLISION:
        if not description.retry(retries):
          AVNLog.error("max retries reached for %s",description.name)
        else:
          retry=True
        continue
      if state != self.ENTRY_GROUP_ESTABLISHED:
        try:
          description.group.Reset()
        except:
          pass
        description.group=None
        self.setInfo(description.getKey(),"unable to register service, state=%s"%str(state),WorkerStatus.ERROR)
        return False
      description.isRegistered=True
      self.setInfo(description.getKey(),"registered",WorkerStatus.NMEA)
      self.hostname=self.server.GetHostNameFqdn()
      return True
    self.setInfo(description.getKey(),"unable to register service after retries",WorkerStatus.ERROR)
    return False

  def _deregister(self, description: ServiceDescription) -> object:
    if description.group is None:
      try:
        description.reset()
      except:
        pass
      return
    try:
      AVNLog.info("deregister %s",description)
      description.reset()
      description.group.Reset()
      description.group.Free()
      description.group=None
      self.deleteInfo(description.getKey())
    except Exception as e:
      AVNLog.error("unable to deregister: %s",str(e))
      self.setInfo(description.getKey(),"error in deregister %s"%str(e),WorkerStatus.ERROR)
  def _deregisterAll(self):
    for description in self.services.values():
      self._deregister(description)


  def _startServiceBrowser(self,doRaise=True):
    try:
      self.serviceBrowser=dbus.Interface(dbus.SystemBus().get_object(
        self.DBUS_NAME, self.server.ServiceBrowserNew(
          self.IF_UNSPEC,
          self.PROTO_INET, self.S_TYPE_NMEA,
          "local",
          dbus.UInt32(0))),
        self.DBUS_INTERFACE_SERVICE_BROWSER)
      return True
    except Exception as e:
      AVNLog.error("unable to start service Browser %s",str(e))
      if doRaise:
        raise
      return False


  def _serverStateChange(self,newState,p):
    AVNLog.info("Avahi server state change %s",str(newState))
    if newState == self.SERVER_RUNNING:
      self.stateSequence+=1


  def timeChanged(self):
    AVNLog.info("%s: time changed, re-register",self.getName())
    try:
      self._deregisterAll()
    except:
      pass
    self.stateSequence+=1

  def _dbusLoop(self):
    if self.loop is None:
      return
    try:
      self.loop.run()
    except KeyboardInterrupt:
      AVNLog.error("Keyboard interrupt in DBUS loop, shutting down")
      self.shutdownServer()

  def run(self):
    sequence=self.stateSequence
    if not hasDbus:
      raise Exception("no DBUS found, cannot register avahi")
    httpServer=self.findHandlerByName(AVNHttpServer.getConfigName())
    if httpServer is None:
      raise Exception("unable to find AVNHttpServer")
    self.setInfo('main','starting',WorkerStatus.STARTED)
    self.loop=None
    try:
      self.loop=GLib.MainLoop()
      loopThread=threading.Thread(target=self._dbusLoop,daemon=True,name="AVNAvahi DBUS loop")
      loopThread.start()
      bus = dbus.SystemBus()
      bus.add_signal_receiver(self._newService,
                              dbus_interface=self.DBUS_INTERFACE_SERVICE_BROWSER,
                              signal_name="ItemNew")
      bus.add_signal_receiver(self._removedService,
                              dbus_interface=self.DBUS_INTERFACE_SERVICE_BROWSER,
                              signal_name="ItemRemove")
      bus.add_signal_receiver(self._serverStateChange,
                              dbus_interface=self.DBUS_INTERFACE_SERVER,
                              signal_name="StateChanged")
      self.setInfo('main','get avahi interface',WorkerStatus.INACTIVE)
      self.server=None
      while self.server is None and not self.shouldStop():
        try:
          self.server=dbus.Interface(bus.get_object(self.DBUS_NAME, self.DBUS_PATH_SERVER),
                                     self.DBUS_INTERFACE_SERVER)
          #self.server.connect_to_signal("StateChanged",self._serverStateChange)
          self._startServiceBrowser()
        except Exception as e:
          self.setInfo('main','unable to get avahi interface %s'%str(e),WorkerStatus.ERROR)
          self.wait(3)
      hasError=False
      while not self.shouldStop():
        if self.stateSequence != sequence:
          sequence=self.stateSequence
          AVNLog.info("reregister all services")
          self.server=dbus.Interface(dbus.SystemBus().get_object(self.DBUS_NAME, self.DBUS_PATH_SERVER),
                                     self.DBUS_INTERFACE_SERVER)
          self._deregisterAll()
          if not self._startServiceBrowser(False):
            self.wait(3)
            sequence=-1
            continue

        #compute the entry for the web service
        #this can be delayed as the server_port is only set after the httpServer has started
        if hasattr(httpServer,'server_port'):
          webService=ServiceDescription(self.type,self.getParamValue('serviceName'),httpServer.server_port)
          existing=self.services.get(-1)
          if not webService.equal(existing):
            if existing is not None:
              existing.update(webService)
            else:
              self.services[-1]=webService
        if not hasError:
          self.setInfo('main','running',WorkerStatus.NMEA)
          for key,description in list(self.services.items()):
            if not description.isRegistered:
              try:
                self._publish(description)
              except Exception as e:
                self.setInfo(description.getKey(),"error: "+str(e),WorkerStatus.ERROR)
                description.isRegistered=False
            if description.name is None or description.name == '':
              with self.lock:
                try:
                  del self.services[key]
                except:
                  pass
        self.wait(1)
    except Exception as e:
      self._stopLoop()
      self._deregisterAll()
      raise
    self._stopLoop()
    self._deregisterAll()

  def registerService(self,index,type,name,port):
    '''
    register a service
    @param index: use None for the first registration, reuse the index for updates
    @param type: the type
    @param name: the name, use empty or None to delete it
    @param port: the port
    @return: the index for next calls
    '''
    if index is None:
      index=self._nextIndex()
    description=ServiceDescription(type,name,port)
    self.lock.acquire()
    try:
      existing=self.services.get(index)
      if existing is not None:
        existing.update(description)
      else:
        if name is not None and type is not None:
          self.services[index]=description
    finally:
      self.lock.release()
    return index

  def unregisterService(self,id):
    self.registerService(id,None,None,None)

  def listFoundServices(self,stype=None,includeOwn=False):
    '''
    return list of discovered services
    @param stype: if set, just return a simple list of service names for thsi type
                  otherwise return a list of (type,name)
    @param includeOwn: if set to True also include service we have registered
    @return:
    '''
    rt=set()
    for s in self.foundServices:
      if stype is None or s.type == stype:
        rt.add((s.type,s.name))
    if not includeOwn:
      for s in self.services.values():
        if s.currentName is not None:
          toremove=(s.type,s.currentName)
          if toremove in rt:
            rt.remove(toremove)
    if stype is None:
      return list(rt)
    else:
      return list(map(lambda a:a[1],rt))

  def resolveService(self,type,name,logError=False):
    '''
    resove a service (IPv4)
    @param type: the service type
    @param name: the service name
    @return: a tuple (hostname,ip,port) if found or None otherwise
    '''
    if self.server is None:
      return None
    try:
      res=self.server.ResolveService(self.IF_UNSPEC,
                                   self.PROTO_INET,name,type,"local",self.PROTO_INET,0)
      return (str(res[5]),str(res[7]),int(res[8]))
    except Exception as e:
      if logError:
        AVNLog.error("unable to resolve service %s.%s: %s",type,name,str(e))
      else:
        AVNLog.debug("unable to resolve service %s.%s: %s",type,name,str(e))
      return None

avnav_handlerList.registerHandler(AVNAvahi)
