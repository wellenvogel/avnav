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
import socket
import threading

import avnav_handlerList
from avnav_util import AVNLog
from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus, UsedResource
from httpserver import WebSocketHandler

class OurWebSocketHandler(WebSocketHandler):
  def __init__(self, handler,channel):
    super().__init__(handler)
    self.channel=channel
  def on_ws_message(self, message):
    self.channel.on_message(message,self)
  def on_ws_closed(self):
    self.channel.remove_connection(self)
  def close(self):
    self.handler.close_ws()


class Channel(object):
  def __init__(self,id,statusCallback,enabled=True):
    self.connections=[]
    self.lock=threading.Lock()
    self.enabled=enabled
    self.id=id
    self.statusCallback=statusCallback
    self.numMessages=0
    self._setStatus()
  def _setStatus(self):
    cl=0
    with self.lock:
      cl=len(self.connections)
    st=WorkerStatus.INACTIVE
    if self.enabled:
      st=WorkerStatus.NMEA if cl > 0 else WorkerStatus.RUNNING
    m='enabled' if self.enabled else 'disabled'
    self.statusCallback(self.id,"%s %d connections"%(m,cl),st)

  def send_message(self,message,sender=None):
    if not self.enabled:
      return
    connections=None
    with self.lock:
      connections=self.connections.copy()
      self.numMessages+=1
    for c in connections:
      if sender is None or sender != c:
        c.send_message(message)
  def add_connection(self,handler):
    newCon=OurWebSocketHandler(handler,self)
    with self.lock:
      self.connections.append(newCon)
    self._setStatus()
    return newCon
  def on_message(self,message,sender):
    self.send_message(message,sender)
  def remove_connection(self,connection):
    with self.lock:
      self.connections.remove(connection)
    self._setStatus()
  def clear(self):
    connections=None
    with self.lock:
      connections=self.connections
      self.connections.clear()
    for c in connections:
      c.close()
    self._setStatus()
  def setEnabled(self,enabled):
    self.enabled=enabled
    self._setStatus()


class AVNRemoteChannelHandler(AVNWorker):
  NUM_CHANNELS=5
  NAME_PREFIX="channel-"
  def __init__(self, cfgparam):
    super().__init__(cfgparam)
    self.configSequence=1
    self.channels=[]
    self.socket=None
    enabled=self.ENABLE_PARAM_DESCRIPTION.fromDict(cfgparam)
    for i in range(0,self.NUM_CHANNELS):
      self.channels.append(Channel(str(i),self.setInfo,enabled))

  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  def updateConfig(self, param, child=None):
    rt=super().updateConfig(param, child)
    enabled=self.ENABLE_PARAM_DESCRIPTION.fromDict(self.param)
    for i in range(0,self.NUM_CHANNELS):
      self.channels[i].setEnabled(enabled)
    self.configSequence+=1
    try:
      self.socket.close()
    except Exception as e:
      pass

  def stop(self):
    super().stop()
    try:
      self.socket.close()
    except:
      pass


  PORT_PARAM=WorkerParameter('port',34668,type=WorkerParameter.T_NUMBER,
                             description="udp port to listen for events for the main channel, use 0 for none")
  HOST_PARAM=WorkerParameter('host',"127.0.0.1",type=WorkerParameter.T_STRING,
                            description="bind address for port, use 0.0.0.0 for external access")
  @classmethod
  def getConfigParam(cls, child=None):
    return [
      cls.PORT_PARAM,
      cls.HOST_PARAM
    ]

  @classmethod
  def preventMultiInstance(cls):
    return True

  def checkConfig(self, param):
    if self.PORT_PARAM.name in param:
      self.checkUsedResource(UsedResource.T_UDP,self.PORT_PARAM.fromDict(param))

  def sendMessage(self,message,channel=0):
    if channel < 0 or channel >= self.NUM_CHANNELS:
      raise Exception("invalid channel %d"%str(channel))
    channelHandler=self.channels[channel]
    AVNLog.debug("sending channel %d message: %s",channel,message)
    channelHandler.send_message(message)

  def run(self):
    self.setInfo('main','started',WorkerStatus.STARTED)
    while not self.shouldStop():
      sequence=self.configSequence
      port=self.PORT_PARAM.fromDict(self.param)
      host=self.HOST_PARAM.fromDict(self.param)
      if port > 0:
        self.freeAllUsedResources()
        self.claimUsedResource(UsedResource.T_UDP,self.PORT_PARAM.fromDict(self.param))
        try:
          self.socket=socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
          self.socket.bind((host,port))
          self.setInfo('udp',"listening on port %d, host=%s"%(port,host),WorkerStatus.NMEA)
        except Exception as e:
          self.setInfo('udp',"unable to open port %s:%d : %s"%(host,port,e),WorkerStatus.ERROR)
          if not self.shouldStop():
            self.wait(5)
          continue
        self.socket.settimeout(1)
        while self.socket.fileno() >= 0 and not self.shouldStop() and self.configSequence == sequence:
          try:
            try:
              data = self.socket.recv(1024)
            except socket.timeout:
              continue
            data=data.decode('utf-8','ignore')
            data=data.strip()
            self.sendMessage(data)
          except Exception as e:
            self.setInfo('udp',"read exception %s"%e,WorkerStatus.ERROR)
            if not self.shouldStop():
              self.wait(2)
              try:
                self.socket.close()
              except:
                pass
              continue
        try:
          self.socket.close()
        except:
          pass
        self.deleteInfo('udp')


  PREFIX='/remotechannels'
  def getHandledCommands(self):
    return {
      'websocket':self.PREFIX
    }

  def handleApiRequest(self, type, command, requestparam, **kwargs):
    if type != 'websocket':
      raise Exception("can only handle websocket requests")
    handler=kwargs.get('handler')
    if handler is None:
      raise Exception("need the request handler for websocket requests")
    path=command[len(self.PREFIX):]
    if not path.startswith('/'):
      raise Exception("unknown channel")
    path=path[1:]
    chnum=int(path)
    if chnum < 0 or chnum >= self.NUM_CHANNELS:
      raise Exception("invalid channel %d"%chnum)
    AVNLog.info("added channel connection for %s",path)
    return self.channels[chnum].add_connection(handler)

avnav_handlerList.registerHandler(AVNRemoteChannelHandler)


