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
import time

import threading

import avnav_handlerList
from avnav_util import AVNLog
from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus

#taken from https://github.com/carlosefr/mdns-publisher/tree/master/mpublisher

hasDbus=False
Glib=None
try:
  import pydbus as dbus
  hasDbus=True
  from gi.repository import GLib
except:
  pass


class AVNAvahi(AVNWorker):
  #https://github.com/lathiat/avahi/blob/master/avahi-python/avahi/__init__.py
  DBUS_NAME = "org.freedesktop.Avahi"
  DBUS_PATH_SERVER = "/"
  DBUS_INTERFACE_SERVER = DBUS_NAME + ".Server"
  IF_UNSPEC = -1
  PROTO_UNSPEC =-1
  PROTO_INET =0
  ENTRY_GROUP_UNCOMMITED, ENTRY_GROUP_REGISTERING, ENTRY_GROUP_ESTABLISHED, ENTRY_GROUP_COLLISION, ENTRY_GROUP_FAILURE = range(0, 5)
  SERVER_INVALID, SERVER_REGISTERING, SERVER_RUNNING, SERVER_COLLISION, SERVER_FAILURE = range(0, 5)

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
    self.serviceName=None
    self.registeredName=None
    self.loop=None
    self.stateSequence=0
    self.nameSuffixCount=None
    self.server=None
    self.group=None

  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return super().getConfigParam(child)
    return [
      WorkerParameter('serviceName','avnav',
                      description='the name that will be visible in avahi/mdns'),
      WorkerParameter('maxRetries',20,
                      description='how many retries if the name is already existing',
                      type=WorkerParameter.T_NUMBER),
      WorkerParameter('timeout',10,
                      description="timeout when registering at  avahi",
                      type=WorkerParameter.T_FLOAT)
    ]
  @classmethod
  def preventMultiInstance(cls):
    return True


  def _stopLoop(self):
    if self.loop is not None:
      try:
        self.loop.quit()
      except Exception as x:
        AVNLog.error("unable to stop dbus event loop %s"%str(x))
      self.loop=None
  def _publish(self):
    if self.group is None:
      bus=dbus.SystemBus()
      gr=self.server.EntryGroupNew()
      self.group=bus.get(self.DBUS_NAME,gr)

    timeout=self.getFloatParam('timeout')
    retries=self.getIntParam('maxRetries')
    num=0
    try:
      self.group.Reset()
    except:
      pass
    while num < retries:
      name=self.serviceName
      if self.nameSuffixCount is not None:
        name=name+"-%d"%self.nameSuffixCount
      AVNLog.info("trying to register %s for %s",name,str(self.port))
      self.group.AddService(self.IF_UNSPEC,self.PROTO_UNSPEC,0,
                    name,'_http._tcp',self.server.GetDomainName(),
                    self.server.GetHostNameFqdn(),self.port,'')
      self.group.Commit()
      waitTime=timeout*10
      state=self.group.GetState()
      while state in [self.ENTRY_GROUP_REGISTERING,self.ENTRY_GROUP_UNCOMMITED] and waitTime > 0:
        waitTime-=1
        time.sleep(0.1)
        state=self.group.GetState()
      if state == self.ENTRY_GROUP_COLLISION:
        if self.nameSuffixCount is None:
          self.nameSuffixCount=1
        else:
          self.nameSuffixCount+=1
        num+=1
        continue
      if state != self.ENTRY_GROUP_ESTABLISHED:
        try:
          self.group.Reset()
        except:
          pass
        self.group=None
        raise Exception("unable to register service, state=%s"%str(state))
      self.registeredName=name
      return True
    raise Exception("unable to register after retries")

  def _deregister(self):
    if self.group is None:
      return
    try:
      self.group.Reset()
    except Exception as e:
      AVNLog.error("unable to deregister: %s",str(e))
  def _serverStateChange(self,newState,p):
    AVNLog.info("Avahi server state change %s",str(newState))
    if newState == self.SERVER_RUNNING:
      self.stateSequence+=1
      self.group=None
  def run(self):
    if not hasDbus:
      raise Exception("no DBUS found, cannot register avahi")
    lastName=None
    lastPort=None
    httpServer=self.findHandlerByName('AVNHttpServer')
    if httpServer is None:
      raise Exception("unable to find AVNHTTPServer")
    self.setInfo('main','starting',WorkerStatus.STARTED)
    self.loop=None
    try:
      self.loop=GLib.MainLoop()
      loopThread=threading.Thread(target=self.loop.run,daemon=True,name="AVNAvahi DBUS loop")
      loopThread.start()
      bus = dbus.SystemBus()
      self.setInfo('main','get avahi interface',WorkerStatus.INACTIVE)
      self.group=None
      while self.group is None and not self.shouldStop():
        try:
          self.server=bus.get(self.DBUS_NAME, self.DBUS_PATH_SERVER)
          self.server.onStateChanged=self._serverStateChange
          gr=self.server.EntryGroupNew()
          self.group=bus.get(self.DBUS_NAME,gr)
        except Exception as e:
          self.setInfo('main','unable to get avahi interface %s'%str(e),WorkerStatus.ERROR)
      lastSequence=self.stateSequence
      hasError=False
      while not self.shouldStop():
        self.serviceName=self.getParamValue('serviceName')
        self.port=httpServer.server_port
        if self.serviceName != lastName or self.port != lastPort or lastSequence != self.stateSequence:
          if not hasError:
            self.setInfo('main','register name=%s, port=%s'%(self.serviceName,str(self.port)),WorkerStatus.RUNNING)
          if self.registeredName is not None:
            self._deregister()
            self.registeredName=None
          lastSequence=self.stateSequence
          try:
            if self.serviceName != lastName:
              self.nameSuffixCount=None
            self._publish()
            lastName=self.serviceName
            lastPort=self.port
            self.setInfo('main',"registered %s for %s, port %s"
                         %(self.registeredName,self.serviceName,str(self.port)),WorkerStatus.NMEA)
            hasError=False
          except Exception as e:
            hasError=True
            self.setInfo('main','unable to register: %s'%str(e),WorkerStatus.ERROR)
        self.wait(1)
    except Exception as e:
      self._stopLoop()
      self._deregister()
      raise
    self._stopLoop()
    self._deregister()

avnav_handlerList.registerHandler(AVNAvahi)
