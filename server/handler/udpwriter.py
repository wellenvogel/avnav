# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
# Copyright (c) 2019 free-x <oroitburd@gmail.com>
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
import avnav_handlerList
from avnqueue import Fetcher
from socketbase import *


#a worker to output data via a UDP socket

class AVNUdpWriter(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUdpWriter"
  P_HOST=WorkerParameter('host','localhost',description="target host for udp packages")
  P_PORT=WorkerParameter('port',2000,type=WorkerParameter.T_NUMBER,
                         description='port for udp packages')
  P_BROADCAST=WorkerParameter('broadcast', True,type=WorkerParameter.T_BOOLEAN,
                              description="send broadcast packages")
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      rt=[
          cls.P_HOST,
          cls.P_PORT,
          cls.P_BROADCAST,
          cls.FILTER_PARAM,
          cls.BLACKLIST_PARAM
         ]
      return rt
    return None

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True

  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.socket=None
    self._fetcher=None

  def updateConfig(self, param, child=None):
    super().updateConfig(param, child)
    if self._fetcher is not None:
      self._fetcher.updateParam(
        nmeaFilter=self.FILTER_PARAM.fromDict(self.param),
        blackList=self.BLACKLIST_PARAM.fromDict(self.param)
      )
    try:
      self.socket.close()
    except:
      pass


  def stop(self):
    super().stop()
    try:
      self.socket.close()
    except:
      pass


  def run(self):
    self._fetcher=Fetcher(self.queue,self,
                          nmeaFilter=self.FILTER_PARAM.fromDict(self.param),
                          blackList=self.BLACKLIST_PARAM.fromDict(self.param)
                          )
    self.setNameIfEmpty("%s-%s:%s" % (self.getName(), self.P_HOST.fromDict(self.param),self.P_PORT.fromDict(self.param)))
    while not self.shouldStop():
      try:
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if self.P_BROADCAST.fromDict(self.param):
          self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        addr=self.P_HOST.fromDict(self.param)
        port=self.P_PORT.fromDict(self.param)
        self.setInfo('main',"sending to %s:%d" % (str(addr),port),WorkerStatus.NMEA)
        while not self.shouldStop() and self.socket.fileno() >= 0:
          data=self._fetcher.fetch()
          self._fetcher.report()
          if len(data) > 0:
            for line in data:
                self.socket.sendto(line.encode('ascii',errors='ignore'),(addr,port))
        self.socket.shutdown(socket.SHUT_RDWR)
        self.socket.close()
      except Exception as e:
        self._fetcher.reset()
        self.setInfo('main', "error sending to %s:%s %s" %
                     (self.P_PORT.fromDict(self.param), str(self.P_PORT.fromDict(self.param)),str(e)), WorkerStatus.ERROR)
        AVNLog.error("error in udp writer: %s",traceback.format_exc())
        if self.shouldStop():
          return
        self.wait(2)

avnav_handlerList.registerHandler(AVNUdpWriter)
