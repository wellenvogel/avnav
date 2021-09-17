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
  
  @classmethod
  def getConfigName(cls):
    return "AVNUdpReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt=[
               WorkerParameter('feederName','',editable=False),
               WorkerParameter('host','127.0.0.1',description="address to listen on, use 0.0.0.0 to allow external access"),
               WorkerParameter('port',None,type=WorkerParameter.T_NUMBER,
                               description="the local listener port"),
               WorkerParameter('minTime',0,type=WorkerParameter.T_FLOAT,
                               description='wait this time before reading new data (ms)'),
               WorkerParameter('filter','',type=WorkerParameter.T_FILTER)
    ]
    return rt

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True

  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for udp reader")
    self.feederWrite=None
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

  def writeData(self,data,source=None,addCheckSum=False):
    AVNWorker.writeData(self,data,source)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000)


  def checkConfig(self, param):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_UDP,param.get('port'))

  #thread run method - just try forever
  def run(self):
    while not self.shouldStop():
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_UDP,self.getParamValue('port'))
      self.setNameIfEmpty("%s-%s:%d" % (self.getName(), self.getStringParam('host'), self.getIntParam('port')))
      info="unknown"
      try:
        info = "%s:%d" % (self.getStringParam('host'), self.getIntParam('port'))
        self.setInfo('main',"trying udp listen at %s"%(info,),WorkerStatus.INACTIVE)
        self.socket=socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.socket.bind((self.getStringParam('host'), self.getIntParam('port')))
        self.setInfo('main',"listening at %s"%(info,),WorkerStatus.RUNNING)
      except:
        AVNLog.info("exception while trying to listen at %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
        self.setInfo('main',"unable to listen at %s"%(info,),WorkerStatus.ERROR)
        if self.shouldStop():
          break
        self.wait(2)
        continue
      AVNLog.info("successfully listening at %s",info)
      try:
        reader=SocketReader(self.socket,self.writeData,None,self.setInfo,shouldStop=self.shouldStop)
        reader.readSocket('main',self.getSourceName(info),self.getParamValue('filter'))
      except:
        AVNLog.info("exception while reading data from %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
avnav_handlerList.registerHandler(AVNUdpReader)

        
        
                                        
