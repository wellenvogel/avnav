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

hasBluetooth=False

try:
  import bluetooth
  hasBluetooth=True
except:
  pass
from socketreaderbase import *
import avnav_handlerList

#a Worker for reading bluetooth devices
#it uses a feeder to handle the received data
class AVNBlueToothReader(AVNWorker,SocketReader):
  @classmethod
  def getConfigName(cls):
    return "AVNBlueToothReader"
  
  @classmethod
  def getConfigParam(cls, child=None):
    rt={
        'maxDevices':5,
        'deviceList':'',  #is set (, separated) only connect to those devices
        'feederName':'',  #if set, use this feeder
    }
    return rt
  
  @classmethod
  def createInstance(cls, cfgparam):
    if not hasBluetooth:
      raise Exception("no bluetooth installed, cannot run %s"%(cls.getConfigName()))
    return AVNBlueToothReader(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.maplock=threading.Lock()
    self.addrmap={}
    self.writeData=None
    
  def getName(self):
    return "AVNBlueToothReader"
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have tp find the feeder...
  def start(self):
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam('feederName'))
    self.writeData=feeder.addNMEA
    AVNWorker.start(self) 
   
  #return True if added
  def checkAndAddAddr(self,addr):
    rt=False
    maxd=self.getIntParam('maxDevices')
    self.maplock.acquire()
    if len(self.addrmap) < maxd:
      if not addr in self.addrmap:
        self.addrmap[addr]=1
        rt=True
    self.maplock.release()
    return rt
  
  def removeAddr(self,addr):
    self.maplock.acquire()
    try:
      self.addrmap.pop(addr)
    except:
      pass
    self.maplock.release()
 
  #a thread to open a bluetooth socket and read from it until
  #disconnected
  def readBT(self,host,port):
    infoName="BTReader-%s"%(host)
    threading.current_thread().setName("[%s]%s[Reader %s]"%(AVNLog.getThreadId(),self.getName(),host))
    AVNLog.debug("started bluetooth reader thread for %s:%s",unicode(host),unicode(port))
    self.setInfo(infoName, "connecting", AVNWorker.Status.STARTED)
    try:
      sock=bluetooth.BluetoothSocket( bluetooth.RFCOMM )
      sock.connect((host, port))
      AVNLog.info("bluetooth connection to %s established",host)
      self.readSocket(sock,infoName)
      sock.close()
    except Exception as e:
      AVNLog.debug("exception fro bluetooth device: %s",traceback.format_exc())
      try:
        sock.close()
      except:
        pass
    AVNLog.info("disconnected from bluetooth device ")
    self.setInfo(infoName, "dicsonnected", AVNWorker.Status.INACTIVE)
    self.removeAddr(host)
    self.deleteInfo(infoName)
              
  
  #this is the main thread - this executes the bluetooth polling
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    time.sleep(2) # give a chance to have the socket open...   
    #now start an endless loop with BT discovery...
    self.setInfo('main', "discovering", AVNWorker.Status.RUNNING)
    while True:
      service_matches=[]
      try:
        AVNLog.debug("starting BT discovery")
        service_matches = bluetooth.find_service(uuid = bluetooth.SERIAL_PORT_CLASS)
      except Exception as e:
        AVNLog.debug("exception when querying BT services %s, retrying after 10s",traceback.format_exc())
      if len(service_matches) == 0:
        time.sleep(10)
        continue
      AVNLog.ld("found bluetooth devices",service_matches)
      filter=[]
      filterstr=self.getStringParam('devicelist')
      if not filterstr is None and not filterstr=='':
        filter=filterstr.split(',') 
      for match in service_matches:
        port = match["port"]
        name = match["name"]
        host = match["host"]
        found=False
        if len(filter) > 0:
          if host in filter:
            found=True
          else:
            AVNLog.debug("ignoring device %s as it is not in the list #%s#",host,filterstr)
        else:
          found=True
        if found and self.checkAndAddAddr(host):
          try:
            AVNLog.info("found new bluetooth device %s",host)
            handler=threading.Thread(target=self.readBT,args=(host,port))
            handler.daemon=True
            handler.start()
            #TDOD: what about join???
          except Exception as e:
            AVNLog.warn("unable to start BT handler %s",traceback.format_exc())
            self.removeAddr(host)
      time.sleep(10)
avnav_handlerList.registerHandler(AVNBlueToothReader)
      