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


#a worker to output data via a socket

class AVNSocketWriter(AVNWorker,SocketReader):
  @classmethod
  def getConfigName(cls):
    return "AVNSocketWriter"

  AVAHI_ENABLED=WorkerParameter('avahiEnabled',False,description='If set make this port available via Mdns (Bonjour/Avahi)',type=WorkerParameter.T_BOOLEAN)
  AVAHI_NAME=WorkerParameter('avahiName','avnav-server',description='Name for this connection when anncounced via Mdns (Bonjour/Avahi)',
                             condition={AVAHI_ENABLED.name:True})
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt=[
          WorkerParameter('port',None,type=WorkerParameter.T_NUMBER,
                          description='local listener port'),
          WorkerParameter('maxDevices',5,type=WorkerParameter.T_NUMBER,
                          description='max external connections'),
          WorkerParameter('feederName','',editable=False),
          WorkerParameter('filter','',type=WorkerParameter.T_FILTER,
                          description=', separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters'),
          WorkerParameter('address','0.0.0.0',type=WorkerParameter.T_STRING,
                          description='the local bind address (0.0.0.0 for external access)'),
          WorkerParameter('read',True,type=WorkerParameter.T_BOOLEAN,
                          description='allow for also reading data from connected devices'),
          WorkerParameter('readerFilter','',type=WorkerParameter.T_FILTER,
                          description='NMEA filter for incoming data',
                          condition={'read':True}),
          WorkerParameter('minTime',50,type=WorkerParameter.T_FLOAT,
                          description='if this is set, wait this time before reading new data (ms)'),
          WorkerParameter('blackList','',description=', separated list of sources we do not send out'),
          cls.AVAHI_ENABLED,
          cls.AVAHI_NAME
          ]
      return rt
    return None

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDeleteHandler(cls):
    return True
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.blackList=[]
    self.listener=None
    self.addrmap = {}
    self.maplock = threading.Lock()
    self.startSequence=0

  def startInstance(self, navdata):
    self.startSequence+=1
    #make some checks when we have to start
    #we cannot do this on init as we potentially have to find the feeder...
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam("feederName") or "")
    self.feeder=feeder
    self.feederWrite=feeder.addNMEA
    self.version='development'
    baseConfig=self.findHandlerByName('AVNConfig')
    if baseConfig:
      self.version=baseConfig.getVersion()
    super().startInstance(navdata)


  def sequenceChanged(self,seq):
    '''
    used by client threads to check for restart
    @param seq:
    @return:
    '''
    return self.startSequence != seq

  def updateConfig(self, param,child=None):
    super().updateConfig(param)
    self._closeSockets()


  def checkAndAddHandler(self,addr,handler):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=handler
        rt=True
    self.maplock.release()
    return rt
  
  def removeHandler(self,addr):
    rt=None
    self.maplock.acquire()
    try:
      rt=self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
    if rt is None:
      return None
    return rt
  

  #the writer for a connected client
  def client(self, socketConnection, addr, startSequence):
    infoName="SocketWriter-%s"%(str(addr),)
    self.setInfo(infoName,"sending data",WorkerStatus.RUNNING)
    if self.getBoolParam('read',False):
      clientHandler=threading.Thread(
        target=self.clientRead,
        args=(socketConnection, addr, startSequence),
        name="%s-clientread-%s"%(self.getName(),str(addr))
      )
      clientHandler.daemon=True
      clientHandler.start()
    filterstr=self.getStringParam('filter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    try:
      seq=0
      socketConnection.sendall(("avnav_server %s\r\n" % (self.version)).encode('utf-8'))
      while not self.sequenceChanged(startSequence) and socketConnection.fileno() >= 0:
        hasSend=False
        seq,data=self.feeder.fetchFromHistory(seq,10,nmeafilter=filter,includeSource=True)
        if len(data)>0:
          for line in data:
            if line.source in self.blackList:
              AVNLog.debug("ignore %s:%s due to blacklist",line.source,line.data)
            else:
              socketConnection.sendall(line.data.encode('ascii', errors='ignore'))
              hasSend=True
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
    self.removeHandler(addr)
    self.deleteInfo(infoName)

  def clientRead(self,socket,addr,startSequence):
    infoName="SocketReader-%s"%(str(addr),)
    threading.currentThread().setName("%s-Reader-%s"%(self.getName(),str(addr)))
    #on each newly connected socket we recompute the filter
    filterstr=self.getStringParam('readerFilter')
    self.readSocket(socket,infoName,self.getSourceName(),filterstr)
    self.deleteInfo(infoName)

  #if we have reading enabled...
  def writeData(self,data,source=None):
    self.feederWrite(data,source)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000)


  def _closeSockets(self):
    AVNLog.info("closing all sockets")
    self.startSequence+=1
    try:
      self.listener.shutdown(socket.SHUT_RDWR)
    except Exception as e:
      AVNLog.error("unable to shutdown listener: %s",str(e))
    try:
      self.listener.close()
    except Exception as e:
      AVNLog.error("unable to close listener: %s",str(e))
    self.maplock.acquire()
    try:
      for k,v in self.addrmap.items():
        try:
          v.shutdown(socket.SHUT_RDWR)
          v.close()
        except:
          pass
    finally:
      self.maplock.release()

  def stop(self):
    super().stop()
    self._closeSockets()

  def getResourceFromName(self,avahiName):
    if avahiName is None or avahiName == '':
      return None
    return avahiName+"."+AVNUtil.NMEA_SERVICE
  def checkConfig(self, param):
    if 'port' in param:
      self.checkUsedResource(UsedResource.T_TCP,param.get('port'))
    if ( self.AVAHI_ENABLED.name in param and self.AVAHI_ENABLED.fromDict(param,True)) or \
        ( self.AVAHI_ENABLED.name not in param and self.AVAHI_ENABLED.fromDict(self.param,True)):
      avahiName=None
      if self.AVAHI_NAME.name in param:
        avahiName=self.AVAHI_NAME.fromDict(param)
      else:
        avahiName=self.AVAHI_NAME.fromDict(self.param)
      if avahiName is None or avahiName == '':
        raise ValueError("%s cannot be empty with %s enabled"%(self.AVAHI_NAME.name,self.AVAHI_ENABLED.name))
      self.checkUsedResource(UsedResource.T_SERVICE,self.getResourceFromName(avahiName))

  def registerAvahi(self):
    avahi=self.findHandlerByName(AVNAvahi.getConfigName())
    if avahi is None:
      return
    if self.AVAHI_ENABLED.fromDict(self.param):
      serviceName=self.AVAHI_NAME.fromDict(self.param)
      if serviceName is not None and avahi is not None:
        try:
          avahi.registerService(self.getId(),AVNUtil.NMEA_SERVICE,serviceName,self.getIntParam('port'))
        except:
          pass

  #this is the main thread - listener
  def run(self):
    self.wait(2)
    init=True
    self.listener=None
    avahi=self.findHandlerByName(AVNAvahi.getConfigName())
    while not self.shouldStop():
      self.freeAllUsedResources()
      self.claimUsedResource(UsedResource.T_TCP,self.getParamValue('port'))
      if avahi is not None:
        avahi.unregisterService(self.getId())
      if self.AVAHI_ENABLED.fromDict(self.param):
        self.claimUsedResource(UsedResource.T_SERVICE,self.getResourceFromName(self.AVAHI_NAME.fromDict(self.param)))
      self.setNameIfEmpty("%s-%s"%(self.getName(),str(self.getParamValue('port'))))
      self.blackList = self.getStringParam('blackList').split(',')
      self.blackList.append(self.getSourceName())
      try:
        try:
          self.listener=socket.socket()
          self.listener.settimeout(0.5)
          self.listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
          self.listener.bind((self.getStringParam('address'),self.getIntParam('port')))
          self.listener.listen(1)
          AVNLog.info("listening at port address %s",str(self.listener.getsockname()))
          self.setInfo('main', "listening at %s"%(str(self.listener.getsockname()),), WorkerStatus.RUNNING)
        except Exception as e:
          self.setInfo('main','unable to create listener at port %s:%s'
                       %(str(self.getIntParam('port')),str(e)),WorkerStatus.ERROR)
          raise
        while not self.shouldStop() and self.listener.fileno() >= 0:
          self.registerAvahi() #we redo this all the time as potentially the avahi handler has stopped/restarted
          try:
            outsock,addr=self.listener.accept()
          except socket.timeout:
            continue
          AVNLog.info("connect from %s",str(addr))
          outsock.settimeout(None)
          allowAccept=self.checkAndAddHandler(addr,outsock)
          if allowAccept:
            clientHandler=threading.Thread(
              target=self.client,
              args=(outsock, addr,self.startSequence),
              name=("%s-client-%s"%(self.getName(),str(addr)))
            )
            clientHandler.daemon=True
            clientHandler.start()
          else:
            AVNLog.error("connection from %s not allowed", str(addr))
            try:
              outsock.shutdown(socket.SHUT_RDWR)
              outsock.close()
            except:
              pass
      except Exception as e:
        AVNLog.warn("exception on listener, retrying %s",traceback.format_exc())
        try:
          self.listener.close()
        except:
          pass
        if self.shouldStop():
          break
        self.wait(5)
    AVNLog.info("main stopped")
    if avahi is not None:
      avahi.registerService(self.getId(),None,None,None)
avnav_handlerList.registerHandler(AVNSocketWriter)
  
