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
from avnav_util import MovingSum


#a Worker to read from a remote NMEA source via a socket
#can be used to chain avnav servers...
class AVNSocketReader(AVNWorker,SocketReader):
  
  @classmethod
  def getConfigName(cls):
    return "AVNSocketReader"

  P_WRITE_OUT = WorkerParameter('writeOut', False, type=WorkerParameter.T_BOOLEAN,
                                description="if set also write data on this connection")
  P_WRITE_FILTER = WorkerParameter('writeFilter', '', type=WorkerParameter.T_FILTER,
                                   condition={P_WRITE_OUT.name: True})
  P_BLACKLIST = AVNWorker.BLACKLIST_PARAM.copy(condition={P_WRITE_OUT.name: True})
  P_MINTIME=WorkerParameter('minTime',0,type=WorkerParameter.T_FLOAT,
                            description='if this is set, wait this time before reading new data (ms)')
  P_HOST=WorkerParameter('host',None)
  P_PORT=WorkerParameter('port',None,type=WorkerParameter.T_NUMBER)
  P_TIMEOUT=WorkerParameter('timeout',10,type=WorkerParameter.T_FLOAT,
                            description='timeout in sec for connecting and waiting for data, close connection if no data within 5*timeout')
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt=[
               cls.PRIORITY_PARAM_DESCRIPTION,
               cls.P_HOST,
               cls.P_PORT,
               cls.P_TIMEOUT,
               cls.P_MINTIME,
               cls.FILTER_PARAM,
               cls.P_WRITE_OUT,
               cls.P_WRITE_FILTER.copy(condition={cls.P_WRITE_OUT.name:True}),
               cls.P_BLACKLIST.copy(condition={cls.P_WRITE_OUT.name:True}),
               cls.REPLY_RECEIVED.copy(condition={cls.P_WRITE_OUT.name:True}),
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


  def updateConfig(self, param,child=None):
    super().updateConfig(param)
    try:
      self.socket.shutdown(socket.SHUT_RDWR)
      self.socket.close()
    except Exception as e:
      pass

  def stop(self):
    super().stop()
    try:
      self.socket.shutdown(socket.SHUT_RDWR)
      self.socket.close()
    except:
      pass
     
  #thread run method - just try forever  
  def run(self):
    for p in (self.P_PORT,self.P_HOST):
      self.getWParam(p)
    INAME='main'
    self.version = self.navdata.getSingleValue(AVNStore.KEY_VERSION)
    errorReported=False
    self.setNameIfEmpty("%s-%s:%d" % (self.getName(), self.getStringParam('host'), self.getIntParam('port')))
    lastInfo = None
    while not self.shouldStop():
      info = "%s:%d" % (self.getWParam(self.P_HOST), self.getWParam(self.P_PORT))
      try:
        if info != lastInfo:
          self.setInfo(INAME,"trying to connect to %s"%(info,),WorkerStatus.INACTIVE)
          lastInfo=info
        self.socket=socket.create_connection((self.P_HOST.fromDict(self.param),self.P_PORT.fromDict(self.param)),self.P_TIMEOUT.fromDict(self.param))
        self.setInfo(INAME,"connected to %s"%(info,),WorkerStatus.RUNNING)
      except:
        if not errorReported:
          AVNLog.info("exception while trying to connect to %s %s",info,traceback.format_exc())
          errorReported=True
        self.setInfo(INAME,"unable to connect to %s"%(info,),WorkerStatus.ERROR)
        self.wait(2)
        continue
      AVNLog.info("successfully connected to %s",info)
      try:
        self.setInfo(INAME,"connected to %s"%info, WorkerStatus.NMEA)
        errorReported=False
        timeout=self.P_TIMEOUT.fromDict(self.param)
        if timeout != 0:
          timeout = timeout *5
        else:
          timeout=None
        connection = SocketReader(self.socket, self.queue, SubInfoHandler(self,INAME),
                                  shouldStop=self.shouldStop,
                                  sourcePriority=self.PRIORITY_PARAM_DESCRIPTION.fromDict(self.param),
                                  stripLeading=SocketReader.P_STRIP_LEADING.fromDict(self.param))
        sourceName=self.getSourceName(info)
        if self.P_WRITE_OUT.fromDict(self.param):
          clientHandler = threading.Thread(
            target=self._writer,
            args=(connection,sourceName),
            name="%s-writer" % (self.getName())
          )
          clientHandler.daemon = True
          clientHandler.start()
        connection.readSocket(sourceName,
                              filter=self.FILTER_PARAM.fromDict(self.param),
                              timeout=timeout,
                              minTime=self.P_MINTIME.fromDict(self.param))
        self.wait(2)
      except:
        AVNLog.info("exception while reading from %s %s",info,traceback.format_exc())

  def _writer(self, socketConnection,sourceName):
    blacklist=self.getWParam(self.P_BLACKLIST)
    if not self.getWParam(self.REPLY_RECEIVED):
      blacklist+=","+sourceName
    socketConnection.writeSocket(self.P_WRITE_FILTER.fromDict(self.param),
                                 self.version,
                                 blacklist=blacklist)

avnav_handlerList.registerHandler(AVNSocketReader)
        
        
                                        
