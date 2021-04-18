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

from avnavavahi import AVNAvahi
from socketreaderbase import *

import avnav_handlerList
from avnav_nmea import *
from avnav_worker import *


#a Worker to read from a remote NMEA source via a socket
#can be used to chain avnav servers...
class AVNIpServiceReader(AVNWorker,SocketReader):

  @classmethod
  def getServiceType(cls):
    raise NotImplemented("getServiceType must be implemented")
  @classmethod
  def _listServices(cls):
    avahi=cls.findHandlerByName(AVNAvahi.getConfigName())
    if avahi is None:
      return []
    return avahi.listFoundServices(stype=cls.getServiceType())

  P_SERVICE_NAME=WorkerParameter('serviceName', None,
                                 description="the name of the service to use",
                                 type=WorkerParameter.T_SELECT,
                                 rangeOrList=None)
  P_WRITE_OUT=WorkerParameter('writeOut', False, type=WorkerParameter.T_BOOLEAN,
                              description="if set also write data on this connection")
  P_WRITE_FILTER=WorkerParameter('writeFilter', '', type=WorkerParameter.T_FILTER,
                                 condition={P_WRITE_OUT.name: True})
  P_BLACKLIST=WorkerParameter('blackList', '',
                              description=', separated list of sources we do not send out',
                              condition={P_WRITE_OUT.name:True})
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = [
      WorkerParameter('feederName', '', editable=False),
      cls.P_SERVICE_NAME,
      WorkerParameter('timeout', 10, type=WorkerParameter.T_FLOAT,
                      description='timeout in sec for connecting and waiting for data, close connection if no data within 5*timeout'),
      WorkerParameter('minTime', 0, type=WorkerParameter.T_FLOAT,
                      description='if this is set, wait this time before reading new data (ms)'),
      WorkerParameter('filter', '', type=WorkerParameter.T_FILTER),
      cls.P_WRITE_OUT,
      cls.P_WRITE_FILTER,
      cls.P_BLACKLIST
    ]
    cls.P_SERVICE_NAME.rangeOrList=cls._listServices
    return rt

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True


  def __init__(self,param):
    self.feederWrite=None
    self.socket=None
    self.version='unknown'
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

  def writeData(self, data, source=None, **kwargs):
    AVNWorker.writeData(self,data,source)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000)

  def _writer(self, socketConnection):
    infoName="writer"
    self.setInfo(infoName,"sending data",WorkerStatus.RUNNING)
    filterstr=self.P_WRITE_FILTER.fromDict(self.param)
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    blacklist=self.P_BLACKLIST.fromDict(self.param).split(',')
    try:
      seq=0
      socketConnection.sendall(("avnav_server %s\r\n" % (self.version)).encode('utf-8'))
      while socketConnection.fileno() >= 0:
        hasSend=False
        seq,data=self.feeder.fetchFromHistory(seq,10,nmeafilter=filter,includeSource=True)
        if len(data)>0:
          for line in data:
            if line.source in blacklist:
              AVNLog.debug("ignore %s:%s due to blacklist",line.source,line.data)
            else:
              socketConnection.sendall(line.data.encode('ascii', errors='ignore'))
              hasSend=True
              self.setInfo(infoName,"sending data",WorkerStatus.NMEA)
        if not hasSend:
          #just throw an exception if the reader potentially closed the socket
          socketConnection.getpeername()
    except Exception as e:
      AVNLog.info("exception in client connection %s",traceback.format_exc())
    AVNLog.info("client disconnected or stop received")
    try:
      socketConnection.shutdown(socket.SHUT_RDWR)
      socketConnection.close()
    except Exception as e:
      AVNLog.error("error closing socket %s",str(e))
    self.deleteInfo(infoName)

  #thread run method - just try forever  
  def run(self):
    self.version='development'
    baseConfig=self.findHandlerByName('AVNConfig')
    if baseConfig:
      self.version=baseConfig.getVersion()
    errorReported=False
    lastInfo = None
    while not self.shouldStop():
      avahi=self.findHandlerByName(AVNAvahi.getConfigName())
      if avahi is None:
        raise Exception("no avahi handler found")
      serviceName=self.P_SERVICE_NAME.fromDict(self.param,rangeOrListCheck=False)
      self.setInfo('main',"resolving %s.%s"%(self.getServiceType(),serviceName),WorkerStatus.STARTED)
      resolved=avahi.resolveService(self.getServiceType(),serviceName)
      if resolved is None:
        self.setInfo('main',"unable to resolve %s.%s"%(self.getServiceType(),serviceName),WorkerStatus.ERROR)
        if (self.shouldStop()):
          break
        self.wait(3000)
        continue
      host=resolved[1]
      port=resolved[2]
      self.setNameIfEmpty("%s-%s:%d" % (self.getName(), host,port))
      info = "%s:%d" % (host,port)
      try:
        if info != lastInfo:
          self.setInfo('main',"trying to connect to %s"%(info,),WorkerStatus.INACTIVE)
          lastInfo=info
        self.socket=socket.create_connection((host,port), self.getFloatParam('timeout'))
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
        timeout=self.getFloatParam('timeout')
        if timeout != 0:
          timeout = timeout *5
        else:
          timeout=None
        if self.P_WRITE_OUT.fromDict(self.param):
          clientHandler=threading.Thread(
            target=self._writer,
            args=(self.socket,),
            name="%s-writer"%(self.getName())
          )
          clientHandler.daemon=True
          clientHandler.start()
        self.readSocket(self.socket,'main',self.getSourceName(info),self.getParamValue('filter'),timeout=timeout)
        self.wait(2)
      except:
        AVNLog.info("exception while reading from %s %s",info,traceback.format_exc())

class NMEA0183ServiceReader(AVNIpServiceReader):
  @classmethod
  def getServiceType(cls):
    return AVNUtil.NMEA_SERVICE

avnav_handlerList.registerHandler(NMEA0183ServiceReader)
        
        
                                        
