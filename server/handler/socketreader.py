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
from socketreaderbase import *
import avnav_handlerList



#a Worker to read from a remote NMEA source via a socket
#can be used to chain avnav servers...
class AVNSocketReader(AVNWorker,SocketReader):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSocketReader"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    rt={
               'feederName':'',      #if this one is set, we do not use the defaul feeder by this one
               'host':None,
               'port':None,
               'timeout': 10,      #timeout for connect and waiting for data
               'minTime':0,        #if tthis is set, wait this time before reading new data (ms)
    }
    return rt

  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for socket reader")
    self.feederWrite=None
    AVNWorker.__init__(self, param)


  def writeData(self,data,source):
    AVNWorker.writeData(self,data,source)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("%s-%s:%d"%(self.getThreadPrefix(),self.getStringParam('host'),self.getIntParam('port')))
    info="%s:%d"%(self.getStringParam('host'),self.getIntParam('port'))
    while True:
      try:
        self.setInfo('main',"trying to connect to %s"%(info,),AVNWorker.Status.INACTIVE)
        sock=socket.create_connection((self.getStringParam('host'),self.getIntParam('port')), self.getIntParam('timeout'))
        self.setInfo('main',"connected to %s"%(info,),AVNWorker.Status.RUNNING)
      except:
        AVNLog.info("exception while trying to connect to %s %s",info,traceback.format_exc())
        self.setInfo('main',"unable to connect to %s"%(info,),AVNWorker.Status.ERROR)
        time.sleep(2)
        continue
      AVNLog.info("successfully connected to %s",info)
      try:
        self.readSocket(sock,'main',self.getSourceName(info))
        time.sleep(2)
      except:
        AVNLog.info("exception while reading from %s %s",info,traceback.format_exc())
avnav_handlerList.registerHandler(AVNSocketReader)
        
        
                                        
