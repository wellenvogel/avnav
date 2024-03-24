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

from socketbase import *

import avnav_handlerList
from avnav_nmea import *
from avnav_worker import *


#a Worker to read  NMEA source from a udp socket
class AVNUdpReader(AVNWorker):
  P_LADDR=WorkerParameter('host','127.0.0.1',description="address to listen on, use 0.0.0.0 to allow external access")
  P_PORT=WorkerParameter('port',None,type=WorkerParameter.T_NUMBER,
                         description="the local listener port")
  P_MINTIME=WorkerParameter('minTime',0,type=WorkerParameter.T_FLOAT,
                            description='wait this time before reading new data (ms)')
  
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt=[
               cls.PRIORITY_PARAM_DESCRIPTION,
               cls.P_LADDR,
               cls.P_PORT,
               cls.P_MINTIME,
               cls.FILTER_PARAM,
               SocketReader.P_STRIP_LEADING
    ]
    return rt

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True

  def __init__(self,param):
    self.socket=None
    AVNWorker.__init__(self, param)

  def updateConfig(self, param, child=None):
    super().updateConfig(param, child)
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

  def checkConfig(self, param):
    if self.P_PORT.name in param:
      self.checkUsedResource(UsedResource.T_UDP,self.P_PORT.fromDict(param))

  #thread run method - just try forever
  def run(self):
    for p in (self.P_PORT, self.P_LADDR):
      self.getWParam(p)
    INAME='main'
    while not self.shouldStop():
      host=self.getWParam(self.P_LADDR)
      port=self.getWParam(self.P_PORT)
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_UDP,self.getParamValue('port'))
      self.setNameIfEmpty("%s-%s:%d" % (self.getName(), host, port))
      info="unknown"
      try:
        info = "%s:%d" % (host,port)
        self.setInfo(INAME,"trying udp listen at %s"%(info,),WorkerStatus.INACTIVE)
        self.socket=socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((host, port))
        self.setInfo(INAME,"listening at %s"%(info,),WorkerStatus.RUNNING)
      except:
        AVNLog.info("exception while trying to listen at %s:%d %s",host,port,traceback.format_exc())
        self.setInfo(INAME,"unable to listen at %s"%(info,),WorkerStatus.ERROR)
        if self.shouldStop():
          break
        self.wait(2)
        continue
      AVNLog.info("successfully listening at %s",info)
      try:
        reader=SocketReader(self.socket,self.queue,
                            self,
                            shouldStop=self.shouldStop,
                            stripLeading=SocketReader.P_STRIP_LEADING.fromDict(self.param),
                            sourcePriority=self.PRIORITY_PARAM_DESCRIPTION.fromDict(self.param))
        reader.readSocket(self.getSourceName(info),
                          filter=self.FILTER_PARAM.fromDict(self.param),
                          minTime=self.P_MINTIME.fromDict(self.param))
      except:
        AVNLog.info("exception while reading data from %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
avnav_handlerList.registerHandler(AVNUdpReader)

        
        
                                        
