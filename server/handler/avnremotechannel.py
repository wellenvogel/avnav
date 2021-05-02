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
  def __init__(self,enabled=True):
    self.connections=[]
    self.lock=threading.Lock()
    self.enabled=enabled
  def send_message(self,message,sender=None):
    if not self.enabled:
      return
    connections=None
    with self.lock:
      connections=self.connections.copy()
    for c in connections:
      if sender is None or sender != c:
        c.send_message(message)
  def add_connection(self,handler):
    newCon=OurWebSocketHandler(handler,self)
    with self.lock:
      self.connections.append(newCon)
    return newCon
  def on_message(self,message,sender):
    self.send_message(message,sender)
  def remove_connection(self,connection):
    with self.lock:
      self.connections.remove(connection)
  def clear(self):
    connections=None
    with self.lock:
      connections=self.connections
      self.connections.clear()
    for c in self.connections:
      c.close()
  def setEnabled(self,enabled):
    self.enabled=enabled


class AVNRemoteChannelHandler(AVNWorker):
  NUM_CHANNELS=5
  NAME_PREFIX="channel-"
  def __init__(self, cfgparam):
    super().__init__(cfgparam)
    self.configSequence=1
    self.channels={}
    self.socket=None
    enabled=self.ENABLE_PARAM_DESCRIPTION.fromDict(cfgparam)
    for i in range(0,self.NUM_CHANNELS):
      self.channels[self.NAME_PREFIX+str(i)]=Channel(enabled)

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
      self.channels[self.NAME_PREFIX+str(i)].setEnabled(enabled)
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


  NAME_D="channel name"
  PORT_PARAM=WorkerParameter('port',34668,type=WorkerParameter.T_NUMBER,
                             description="udp port to listen for events for the main channel, use 0 for none")
  HOST_PARAM=WorkerParameter('host',"127.0.0.1",type=WorkerParameter.T_STRING,
                            description="bind address for port, use 0.0.0.0 for external access")
  @classmethod
  def getConfigParam(cls, child=None):
    return [
      WorkerParameter(cls.NAME_PREFIX+'0','main',description=cls.NAME_D),
      WorkerParameter(cls.NAME_PREFIX+'1','channel1',description=cls.NAME_D),
      WorkerParameter(cls.NAME_PREFIX+'2','channel2',description=cls.NAME_D),
      WorkerParameter(cls.NAME_PREFIX+'3','channel3',description=cls.NAME_D),
      WorkerParameter(cls.NAME_PREFIX+'4','channel4',description=cls.NAME_D),
      cls.PORT_PARAM,
      cls.HOST_PARAM
    ]

  @classmethod
  def preventMultiInstance(cls):
    return True

  def checkConfig(self, param):
    if self.PORT_PARAM.name in param:
      self.checkUsedResource(UsedResource.T_UDP,self.PORT_PARAM.fromDict(param))

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
            channel=self.channels.get(self.NAME_PREFIX+'0')
            if channel:
              AVNLog.debug("sending channel message: %s",data)
              channel.send_message(data)
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
    for i in range(0,self.NUM_CHANNELS):
      name=self.NAME_PREFIX+str(i)
      if path == name:
        AVNLog.info("added channel connection for %s",path)
        return self.channels[path].add_connection(handler)
    return None

avnav_handlerList.registerHandler(AVNRemoteChannelHandler)


