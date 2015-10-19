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
from threading import Thread

import time
import socket
import threading

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_nmea import *
from avnav_socketreaderbase import *


#a worker to output data via a socket

class AVNSocketWriter(AVNWorker,SocketReader):
  @classmethod
  def getConfigName(cls):
    return "AVNSocketWriter"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt={
          'port': None,       #local listener port
          'name':'',
          'maxDevices':5,     #max external connections
          'feederName':'',    #if set, use this feeder
          'filter': '',       #, separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters
          'address':'',       #the local bind address
          'read': True,       #allow for reading data
          'readerFilter':'',
          'minTime':50         #if this is set, wait this time before reading new data (ms)
          };
      return rt
    return None
  
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNSocketWriter(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.setName(self.getName())
    self.readFilter=None
    
  def getName(self):
    return "AVNSocketWriter-%d"%(self.getIntParam('port'))
  
  #make some checks when we have to start
  #we cannot do this on init as we potentially have to find the feeder...
  def start(self):
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam("feederName") or "")
    self.feeder=feeder
    self.feederWrite=feeder.addNMEA
    self.maplock=threading.Lock()
    self.addrmap={}
    AVNWorker.start(self) 
   
  #return True if added
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
  def client(self,socket,addr):
    infoName="SocketWriter-%s"%(unicode(addr),)
    self.setName("[%s]%s-Writer %s"%(AVNLog.getThreadId(),self.getName(),unicode(addr)))
    self.setInfo(infoName,"sending data",AVNWorker.Status.RUNNING)
    if self.getBoolParam('read',False):
      clientHandler=threading.Thread(target=self.clientRead,args=(socket, addr))
      clientHandler.daemon=True
      clientHandler.start()
    filterstr=self.getStringParam('filter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    try:
      seq=0
      socket.sendall("avnav_server %s\r\n"%(VERSION))
      while True:
        seq,data=self.feeder.fetchFromHistory(seq,10)
        if len(data)>0:
          for line in data:
            if NMEAParser.checkFilter(line, filter):
              socket.sendall(line)
        else:
          time.sleep(0.1)
        pass
    except Exception as e:
      AVNLog.info("exception in client connection %s",traceback.format_exc())
    AVNLog.info("client disconnected")
    socket.close()
    self.removeHandler(addr)
    self.deleteInfo(infoName)

  def clientRead(self,socket,addr):
    infoName="SocketReader-%s"%(unicode(addr),)
    threading.currentThread().setName("SocketWriter-Reader-%s"%unicode(addr))
    #on each newly connected socket we recompute the filter
    filterstr=self.getStringParam('readerFilter')
    filter=None
    if filterstr != "":
      filter=filterstr.split(',')
    self.readFilter=filter
    self.readSocket(socket,infoName)
    self.deleteInfo(infoName)

  #if we have writing enabled...
  def writeData(self,data):
    doFeed=True
    if self.readFilter is not None:
      if not NMEAParser.checkFilter(data,self.readFilter):
        doFeed=False
        AVNLog.debug("ingoring line %s due to filter",data)
    if doFeed:
      self.feederWrite(data)
    if (self.getIntParam('minTime')):
      time.sleep(float(self.getIntParam('minTime'))/1000)
        
  #this is the main thread - listener
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the feeder socket open...   
    #now start an endless loop with udev discovery...
    #any removal will be detected by the monitor (to be fast)
    #but we have an audit here anyway
    #the removal will be robust enough to deal with 2 parallel tries
    init=True
    listener=None
    while True:
      try:
        listener=socket.socket()
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        listener.bind((self.getStringParam('address'),self.getIntParam('port')))
        listener.listen(1)
        AVNLog.info("listening at port address %s",unicode(listener.getsockname()))
        self.setInfo('main', "listening at %s"%(unicode(listener.getsockname()),), AVNWorker.Status.RUNNING)
        while True:
          outsock,addr=listener.accept()
          AVNLog.info("connect from %s",unicode(addr))
          allowAccept=self.checkAndAddHandler(addr,outsock)
          if allowAccept:
            clientHandler=threading.Thread(target=self.client,args=(outsock, addr))
            clientHandler.daemon=True
            clientHandler.start()
          else:
            try:
              outsock.close()
            except:
              pass
      except Exception as e:
        AVNLog.warn("exception on listener, retrying %s",traceback.format_exc())
        try:
          listener.close()
        except:
          pass
        break
          
  
