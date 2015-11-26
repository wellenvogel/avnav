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
import subprocess
import threading
import os
import socket

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_serial import *
hasSerial=False

try:
  import serial
  hasSerial=True
except:
  pass

hasGpsd=False
try:
  import gps
  hasGpsd=True
except:
  pass

#a worker to interface with gpsd
#as gpsd is not really able to handle dynamically assigned ports correctly, 
#we monitor first if the device file exists and only start gpsd once it is visible
#when it becomes visible, gpsd will be started (but not in background)
#when we receive no data from gpsd until timeout, we will kill it and enter device monitoring again
#this reader should only be used if we really have some very special devices that directly need 
#to communicate with gpsd
#data fetched here will not be available at any outgoing NMEA interface!
class AVNGpsd(AVNWorker):
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
  #should be overridden
  def getName(self):
    return "GPSDReader"
  
  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    return 'AVNGpsd'
  #return the default cfg values
  #if the parameter child is set, the parameter for a child node
  #must be returned, child nodes are added to the parameter dict
  #as an entry with childnodeName=[] - the child node configs being in the list
  @classmethod
  def getConfigParam(cls,child=None):
    if not child is None:
      return None
    return {
            'device':None,
            'baud': 4800, #the initial baudrate
            'gpsdcommand':'/usr/sbin/gpsd -b -n -N',
            'timeout': 40, #need this timeout to be able to sync on 38400
            'port': None, #port for communication with gpsd
            'nocheck': 'false', #do not check the device before
            }
  
  @classmethod
  def createInstance(cls,cfgparam):
    if not hasGpsd:
      AVNLog.warn("gpsd not available, ignore configured reader ")
      return None
    return AVNGpsd(cfgparam)
  
  def stopChildren(self):
    if not self.gpsdproc is None:
      print "stopping gpsd"
      self.gpsdproc.terminate()
  
  def run(self):
    deviceVisible=False
    reader=None
    self.gpsdproc=None
    init=True
    while True:
      device=self.getParamValue('device')
      port=self.getIntParam('port')
      baud=self.getIntParam('baud')
      gpsdcommand="%s -S %d %s" %(self.getStringParam('gpsdcommand'),port,device)
      gpsdcommandli=gpsdcommand.split()
      timeout=self.getFloatParam('timeout')
      noCheck=self.getBoolParam('nocheck')
      self.setName("[%s]%s-dev:%s-port:%d"%(AVNLog.getThreadId(),self.getName(),device,port))
      if init:
        AVNLog.info("started for %s with command %s, timeout %f",device,gpsdcommand,timeout)
        self.setInfo('main', "waiting for device %s"%(unicode(device)), AVNWorker.Status.STARTED)
        init=False
      if not ( os.path.exists(device) or noCheck):
        self.setInfo('main',"device not visible",AVNWorker.Status.INACTIVE)
        AVNLog.debug("device %s still not visible, continue waiting",device)
        time.sleep(timeout/2)
        continue
      else:
        if hasSerial and not noCheck:
          #we first try to open the device by our own to see if this is possible
          #for bluetooth the device is there but open will fail
          #so we would avoid starting gpsd...
          try:
            AVNLog.debug("try to open device %s",device)
            ts=serial.Serial(device,timeout=timeout,baudrate=baud)
            AVNLog.debug("device %s opened, try to read 1 byte",device)
            bytes=ts.read(1)
            ts.close()
            if len(bytes)<=0:
              raise Exception("unable to read data from device")
          except:
            AVNLog.debug("open device %s failed: %s",device,traceback.format_exc())
            time.sleep(timeout/2)
            continue
        AVNLog.info("device %s became visible, starting gpsd",device)
        self.setInfo('main', "starting gpsd with command"%(gpsdcommand), AVNWorker.Status.STARTED)
        try:
          self.gpsdproc=subprocess.Popen(gpsdcommandli, stdin=None, stdout=None, stderr=None,shell=False,universal_newlines=True,close_fds=True)
          reader=GpsdReader(self.navdata, port, "GPSDReader[Reader] %s at %d"%(device,port),self)
          reader.start()
          self.setInfo('main', "gpsd running with command"%(gpsdcommand), AVNWorker.Status.STARTED)
        except:
          AVNLog.debug("unable to start gpsd with command %s: %s",gpsdcommand,traceback.format_exc())
          try:
            self.gpsdproc.wait()
          except:
            pass
          self.setInfo('main', "unable to start gpsd with command"%(gpsdcommand), AVNWorker.Status.STARTED)
          time.sleep(timeout/2)
          continue
        AVNLog.debug("started gpsd with pid %d",self.gpsdproc.pid)
        while True:
          if not reader.status:
            AVNLog.warn("gpsd reader thread stopped")
            break
          ctime=time.time()
          if reader.lasttime < (ctime-timeout):
            AVNLog.warn("gpsd reader timeout")
            break
          else:
            self.setInfo('main',"receiving",AVNWorker.Status.RUNNING)
          #TODO: read out gpsd stdout/stderr
          time.sleep(2)
        #if we arrive here, something went wrong...
        self.setInfo('main',"gpsd stopped",AVNWorker.Status.ERROR)
        if not self.gpsdproc is None:
          try:
            self.gpsdproc.terminate()
          except: 
            pass
          #wait some time for the subproc to finish
          numwait=20 #2s
          retcode=None
          while numwait > 0:
            self.gpsdproc.poll()
            if not self.gpsdproc.returncode is None:
              numwait=0
              retcode=self.gpsdproc.returncode 
              break
            time.sleep(0.1)
            numwait-=1
          self.gpsdproc=None
          if retcode is None:
            AVNLog.error("unable to properly stop gpsd process, leave it running")
          else:
            AVNLog.info("gpsd stopped, waiting for reader thread")
            if reader is not None:
              try:
                reader.join(10)
                AVNLog.info("reader thread successfully stopped")
              except:
                AVNLog.error("unable to stop gpsd reader thread within 10s")
            reader=None  
        #end of loop - device available
        time.sleep(timeout/2)
          
        
      
#a reader thread for the gpsd reader
class GpsdReader(threading.Thread):
  def __init__(self, navdata,port,name,infoHandler,errorHandler=None):
    self.navdata=navdata
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(name)
    #the status shows if the gpsd reader still has data
    self.lasttime=time.time()
    self.status=True
    self.port=port
    self.infoHandler=infoHandler
    self.errorHandler=errorHandler
  def run(self):
    infoName=self.name
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.name))
    self.lasttime=time.time()
    AVNLog.debug("gpsd reader thread started at port %d",self.port)
    self.infoHandler.setInfo(infoName,"started at port %d"%(self.port),AVNWorker.Status.STARTED)
    try:
      #try for 10s to open the gpsd port
      timeout=10
      connected=False
      time.sleep(1)
      while timeout > 0 and not connected:
        timeout-=1
        try:
          session=gps.gps(port=self.port)
          connected=True
        except:
          AVNLog.debug("gpsd reader open comm exception %s %s",traceback.format_exc(),("retrying" if timeout > 1 else ""))
          time.sleep(1)
      if not connected:
        raise Exception("unable to connect to gpsd within 10s")    
      session.stream(gps.WATCH_ENABLE)
      hasNMEA=False
      self.infoHandler.setInfo(infoName,"start receiving",AVNWorker.Status.STARTED)
      for report in session:
        AVNLog.debug("received gps data : %s",pprint.pformat(report))
        self.lasttime=time.time()
        #gpsd has an extremly broken interface - it has a dictwrapper that not really can act as a dict
        #so we have to copy over...
        ddata={}
        for k in report.keys():
          ddata[k]=report.get(k)
        ddata['source']="gpsd"
        entry=AVNDataEntry.fromData(ddata)
        if not entry is None:
          self.navdata.addEntry(entry)
          if not hasNMEA:
            self.infoHandler.setInfo(infoName,"receiving NMEA",AVNWorker.Status.NMEA)
            hasNMEA=True
    except:
      AVNLog.debug("gpsd reader exception %s",traceback.format_exc())
      pass
    AVNLog.debug("gpsd reader exited")
    self.status=False
    self.infoHandler.setInfo(infoName,"exited",AVNWorker.Status.INACTIVE)
    if self.errorHandler is not None:
      self.errorHandler()


        
    
    


#a Worker for feeding data trough gpsd (or directly to the navdata)
#it uses (if enabled) gpsd as a decoder by opening a local listener
#and piping data trough gpsd
#as an input there is the mehod addNMEALine that will add a line of NMEA data
class AVNGpsdFeeder(AVNGpsd):
  @classmethod
  def getConfigName(cls):
    return "AVNGpsdFeeder"
  
  @classmethod
  def getConfigParam(cls, child=None):
    return {'listenerPort':None, #our port that GPSD connects to
            'port':None,         #the GPSD port
            'maxList': 300,      #len of the input list
            'useGpsd': 'true',   #if set to false, we only have very limited support, listenerPort and port are ignored
            'feederSleep': 0.1,  #time in s the feeder will sleep if there is no data
            'gpsdcommand':'/usr/sbin/gpsd -b -n -N',
            'timeout': 40,       #??? do we still need this?
            'name': ''           #if there should be more then one reader we must set the name
            }
    
  @classmethod
  def createInstance(cls, cfgparam):
    
    return AVNGpsdFeeder(cfgparam)
  
  @classmethod
  def getStartupGroup(cls):
    return 1
  
  def __init__(self,cfgparam):
    AVNGpsd.__init__(self, cfgparam)
    self.type=AVNWorker.Type.FEEDER;
    self.listlock=threading.Lock()
    self.list=[]
    self.history=[]
    self.sequence=0
    self.maxlist=self.getIntParam('maxList', True)
    self.gpsdproc=None
    self.gpsdsocket=None
    name=self.getStringParam('name')
    if not name is None and not name == "":
      self.setName(name)
    else:
      self.setName(self.getConfigName())
    if not hasGpsd and self.getBoolParam('useGpsd'):
      raise Exception("no gpsd installed, cannot run %s"%(cls.getConfigName()))
    
  def getName(self):
    return self.name
  
  def addNMEA(self, entry):
    rt=False
    ll=0
    hl=0
    if len(entry) < 5:
      AVNLog.debug("addNMEA: ignoring short data %s",entry)
      return False
    self.listlock.acquire()
    self.sequence+=1
    if len(self.list) >=self.maxlist:
      self.list.pop(0) #TODO: priorities?
    if len(self.history) >= self.maxlist:
      self.history.pop(0)
    self.list.append(entry)
    ll=len(self.list)
    self.history.append(entry)
    hl=len(self.history)
    rt=True
    self.listlock.release()
    AVNLog.debug("addNMEA listlen=%d history=%d data=%s",ll,hl,entry)
    return rt
  
  #fetch an entry from the feeder list
  def popListEntry(self):
    rt=None
    self.listlock.acquire()
    if len(self.list)>0:
      rt=self.list.pop(0)
    self.listlock.release()
    return rt
  #fetch entries from the history
  #only return entries with higher sequence
  #return a tuple (lastSequence,[listOfEntries])
  #when sequence == None or 0 - just fetch the topmost entries (maxEntries)
  def fetchFromHistory(self,sequence,maxEntries=10):
    seq=0
    list=[]
    if maxEntries< 0:
      maxEntries=0
    if sequence is None:
      sequence=0
    self.listlock.acquire()
    seq=self.sequence
    if sequence==0:
      sequence=seq-maxEntries
    if sequence < 0:
      sequence=0
    if seq > sequence:
      if (seq-sequence) > maxEntries:
        seq=sequence+maxEntries
      start=seq-sequence
      list=self.history[-start:]
    self.listlock.release()
    return (seq,list)
  
    
  #a thread to feed the gpsd socket
  def feed(self):
    threading.current_thread().setName("[%s]%s[gpsd feeder]"%(AVNLog.getThreadId(),self.getName()))
    infoName="gpsdFeeder"
    while True:
      try:
        listener=socket.socket()
        listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        lport=self.getIntParam('listenerPort')
        listener.bind(('localhost',lport))
        self.setInfo(infoName, "listening at port %d"%(lport), AVNWorker.Status.STARTED)
        listener.listen(1)
        AVNLog.info("feeder listening at port address %s",unicode(listener.getsockname()))
        while True:
          self.gpsdsocket=None
          self.gpsdsocket,addr=listener.accept()
          self.setInfo(infoName, "gpsd connected from %s"%(unicode(addr)), AVNWorker.Status.RUNNING)
          AVNLog.info("feeder - gpsd connected from %s",unicode(addr))
          try:
            while True:
              data=self.popListEntry()
              if not data is None:
                self.gpsdsocket.sendall(data)
              else:
                time.sleep(self.getFloatParam('feederSleep'))
          except Exception as e:
            AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())
      except Exception as e:
        AVNLog.warn("feeder unable to open listener port(%s), retrying",traceback.format_exc())
      time.sleep(10)
  
  #handler any errors in the gpsd chain and try to restart it
  def gpsdError(self):
    AVNLog.info("gspd error handler")
    try:
      if self.gpsdsocket is not None:
        self.gpsdsocket.close()
    except:
      pass
    try:
      if self.gpsdproc is not None:
        self.gpsdproc.kill()
    except:
      pass
  
  #a standalone feeder that uses our bultin methods
  
  def standaloneFeed(self):
    infoName="standaloneFeeder"
    threading.current_thread().setName("[%s]%s[standalone feed]"%(AVNLog.getThreadId(),self.getName()))
    AVNLog.info("standalone feeder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo(infoName, "running", AVNWorker.Status.RUNNING)
    hasNmea=False
    while True:
      try:
        while True:
          data=self.popListEntry()
          if not data is None:
            if nmeaParser.parseData(data):
              if not hasNmea:
                self.setInfo(infoName,"feeding NMEA",AVNWorker.Status.NMEA)
          else:
            time.sleep(self.getFloatParam('feederSleep'))
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())
    
    
  #this is the main thread 
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    feeder=None
    if self.getBoolParam('useGpsd'):
      feeder=threading.Thread(target=self.feed)
    else:
      feeder=threading.Thread(target=self.standaloneFeed)
    feeder.daemon=True
    feeder.start()
    time.sleep(2) # give a chance to have the socket open...   
    while True:
      if self.getBoolParam('useGpsd'):
        port=self.getIntParam('port')
        device="tcp://localhost:%d"%(self.getIntParam('listenerPort'))
        gpsdcommand="%s -S %d %s" %(self.getStringParam('gpsdcommand'),port,device)
        gpsdcommandli=gpsdcommand.split()
        try:
          self.setInfo('main', "starting gpsd with command %s"%(gpsdcommand), AVNWorker.Status.STARTED)
          AVNLog.debug("starting gpsd with command %s, starting reader",gpsdcommand)
          self.gpsdproc=subprocess.Popen(gpsdcommandli, stdin=None, stdout=None, stderr=None,shell=False,universal_newlines=True,close_fds=True)
          
          reader=GpsdReader(self.navdata, port, "AVNGpsdFeeder[Reader] %s at %d"%(device,port),self,self.gpsdError)
          reader.start()
          self.setInfo('main', "gpsd running with command %s"%(gpsdcommand), AVNWorker.Status.STARTED)
        except:
          self.setInfo('main', "unable to start gpsd with command %s"%(gpsdcommand), AVNWorker.Status.ERROR)
          AVNLog.debug("unable to start gpsd with command %s: %s",gpsdcommand,traceback.format_exc())
          try:
            self.gpsdproc.wait()
          except:
            pass
          time.sleep(self.getIntParam('timeout')/2)
          continue
        AVNLog.info("started gpsd with pid %d",self.gpsdproc.pid)
        self.setInfo('main', "gpsd running with command %s"%(gpsdcommand), AVNWorker.Status.RUNNING)
      while True:
        time.sleep(5)
        if not self.gpsdproc is None:
          self.gpsdproc.poll()
          if not self.gpsdproc.returncode is None:
            AVNLog.warn("gpsd terminated unexpectedly, retrying")
            break
