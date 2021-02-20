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
from socketreaderbase import *

import avnav_handlerList
from avnav_nmea import *
from avnav_worker import *


#a Worker to read from a remote NMEA source via a socket
#can be used to chain avnav servers...
class AVNSocketReader(AVNWorker,SocketReader):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSocketReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt=[
               WorkerParameter('feederName','',editable=False),
               WorkerParameter('host',None),
               WorkerParameter('port',None,type=WorkerParameter.T_NUMBER),
               WorkerParameter('timeout',10,type=WorkerParameter.T_FLOAT,
                               description='timeout in sec for connecting and waiting for data'),
               WorkerParameter('minTime',0,type=WorkerParameter.T_FLOAT,
                               description='if this is set, wait this time before reading new data (ms)'),
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
        raise Exception("missing "+p+" parameter for socket reader")
    self.feederWrite=None
    self.socket=None
    AVNWorker.__init__(self, param)


  def updateConfig(self, param,child=None):
    super().updateConfig(param)
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

  def writeData(self,data,source):
    AVNWorker.writeData(self,data,source)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000)
     
  #thread run method - just try forever  
  def run(self):
    errorReported=False
    while not self.shouldStop():
      self.setName("%s-%s:%d" % (self.getThreadPrefix(), self.getStringParam('host'), self.getIntParam('port')))
      info = "%s:%d" % (self.getStringParam('host'), self.getIntParam('port'))
      try:
        self.setInfo('main',"trying to connect to %s"%(info,),WorkerStatus.INACTIVE)
        self.socket=socket.create_connection((self.getStringParam('host'),self.getIntParam('port')), self.getIntParam('timeout'))
        self.setInfo('main',"connected to %s"%(info,),WorkerStatus.RUNNING)
      except:
        if not errorReported:
          AVNLog.info("exception while trying to connect to %s %s",info,traceback.format_exc())
          errorReported=True
        self.setInfo('main',"unable to connect to %s"%(info,),WorkerStatus.ERROR)
        self.wait(2)
        continue
      AVNLog.info("successfully connected to %s",info)
      try:
        errorReported=False
        self.readSocket(self.socket,'main',self.getSourceName(info),self.getParamValue('filter'))
        self.wait(2)
      except:
        AVNLog.info("exception while reading from %s %s",info,traceback.format_exc())
avnav_handlerList.registerHandler(AVNSocketReader)
        
        
                                        
