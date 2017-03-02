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

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_socketreaderbase import *
import avnav_handlerList



#a Worker to read  NMEA source from a udp socket
class AVNUdpReader(AVNWorker, SocketReader):
  
  @classmethod
  def getConfigName(cls):
    return "AVNUdpReader"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    rt={
               'feederName':'',      #if this one is set, we do not use the defaul feeder by this one
               'host':'127.0.0.1',
               'port':None,
               'minTime':0,        #if tthis is set, wait this time before reading new data (ms)
    }
    return rt
  @classmethod
  def createInstance(cls, cfgparam):
    if cfgparam.get('name') is None:
      cfgparam['name']="UdpReader"
    rt=AVNUdpReader(cfgparam)
    return rt
    
  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for udp reader")
    self.feederWrite=None
    AVNWorker.__init__(self, param)
    if param.get('name') is None:
      self.param['name']="UdpReader-%s-%d"%(self.param['host'],int(self.param['port']))
    
  
  def getName(self):
    return self.param['name']
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feedername=self.getStringParam('feederName')
    feeder=self.findFeeder(feedername)
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),feedername or "")
    self.feederWrite=feeder.addNMEA
    AVNWorker.start(self)
    
  def writeData(self,data):
    self.feederWrite(data)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s-%s:%d"%(AVNLog.getThreadId(),self.getName(),self.getStringParam('host'),self.getIntParam('port')))
    info="%s:%d"%(self.getStringParam('host'),self.getIntParam('port'))
    while True:
      try:
        self.setInfo('main',"trying udp listen at %s"%(info,),AVNWorker.Status.INACTIVE)
        sock=socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.bind((self.getStringParam('host'), self.getIntParam('port')))
        self.setInfo('main',"listening at %s"%(info,),AVNWorker.Status.RUNNING)
      except:
        AVNLog.info("exception while trying to listen at %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
        self.setInfo('main',"unable to listen at %s"%(info,),AVNWorker.Status.ERROR)
        time.sleep(2)
        continue
      AVNLog.info("successfully listening at %s:%d",self.getStringParam('host'),self.getIntParam('port'))
      try:
        self.readSocket(sock,'main',info="UDP: "+info)
      except:
        AVNLog.info("exception while reading data from %s:%d %s",self.getStringParam('host'),self.getIntParam('port'),traceback.format_exc())
avnav_handlerList.registerHandler(AVNUdpReader)

        
        
                                        
