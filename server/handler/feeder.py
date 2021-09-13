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
import traceback

import serial
import socket
import os
import time

from avnserial import *
from avnav_worker import *
hasSerial=False

try:
  import avnserial
  hasSerial=True
except:
  pass


import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode


#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNFeeder(AVNWorker):
  
  @classmethod
  def getConfigParam(cls, child=None):
    return {'maxList': 300,      #len of the input list
            'feederSleep': 0.5,  #time in s the feeder will sleep if there is no data
            'name': '',           #if there should be more then one reader we must set the name
            'decoderFilter':''   #a filter experession for the decoder
            }

  @classmethod
  def getStartupGroup(cls):
    return 1

  @classmethod
  def autoInstantiate(cls):
    return True

  def __init__(self,cfgparam):
    super().__init__(cfgparam)
    self.type=AVNWorker.Type.FEEDER
    self.listlock=threading.Condition()
    self.list=[]
    self.history=[]
    self.sequence=1
    self.readConfig()

  def readConfig(self):
    self.maxlist = self.getIntParam('maxList', True)
    self.waitTime = self.getFloatParam('feederSleep')
    filterstr = self.getStringParam('decoderFilter') or ''
    self.nmeaFilter = filterstr.split(",")

  def stop(self):
    super().stop()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()



  def addNMEA(self, entry,source=None,addCheckSum=False,omitDecode=False):
    """
    add an NMEA record to our internal queue
    @param entry: the record
    @param source: the source where the record comes from
    @param addCheckSum: add the NMEA checksum
    @return:
    """
    rt=False
    ll=0
    hl=0
    if len(entry) < 5:
      AVNLog.debug("addNMEA: ignoring short data %s",entry)
      return False
    if addCheckSum:
      entry= entry.replace("\r","").replace("\n","")
      entry+= "*" + NMEAParser.nmeaChecksum(entry) + "\r\n"
    else:
      if not entry[-2:]=="\r\n":
        entry=entry+"\r\n"
    self.listlock.acquire()
    self.sequence+=1
    if len(self.list) >=self.maxlist:
      self.list.pop(0) #TODO: priorities?
    if len(self.history) >= self.maxlist:
      self.history.pop(0)
    self.list.append(NmeaEntry(entry,source,omitDecode))
    ll=len(self.list)
    self.history.append(NmeaEntry(entry,source,omitDecode))
    hl=len(self.history)
    rt=True
    self.listlock.notify_all()
    self.listlock.release()
    AVNLog.debug("addNMEA listlen=%d history=%d data=%s",ll,hl,entry)
    return rt

  def wakeUp(self):
    super().wakeUp()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()

  #fetch entries from the history
  #only return entries with higher sequence
  #return a tuple (lastSequence,[listOfEntries])
  #when sequence == None or 0 - just fetch the topmost entries (maxEntries)
  def fetchFromHistory(self,sequence,maxEntries=10,includeSource=False,waitTime=0.1,nmeafilter=None):
    seq=0
    list=[]
    if waitTime <=0:
      waitTime=0.1
    if maxEntries< 0:
      maxEntries=0
    if sequence is None:
      sequence=0
    stop = time.time() + waitTime
    self.listlock.acquire()
    if sequence <= 0:
      #if a new connection is opened - always wait for a new entry before sending out
      #sequence = 0 or sequence = None is a new connection
      #self.sequence starts at 1
      sequence=self.sequence
    try:
      while len(list) < 1:
        seq=self.sequence
        if seq > sequence:
          if (seq-sequence) > maxEntries:
            seq=sequence+maxEntries
          start=seq-sequence
          list=self.history[-start:]
        if len(list) < 1:
          wait = stop - time.time()
          if wait <= 0:
            break
          self.listlock.wait(wait)
    except:
      pass
    self.listlock.release()
    if len(list) < 1:
      return (seq,list)
    if includeSource:
      if nmeafilter is None:
        return (seq,list)
      return (seq,[el for el in list if NMEAParser.checkFilter(el.data,nmeafilter)])
    else:
      rt=[]
      for le in list:
        if NMEAParser.checkFilter(le.data,nmeafilter):
          rt.append(le.data)
      return (seq,rt)

  #a standalone feeder that uses our bultin methods
  
  def run(self):
    AVNLog.info("standalone feeder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo('main', "running", WorkerStatus.RUNNING)
    hasNmea=False
    sequence=None
    while not self.shouldStop():
      try:
        while True:
          (sequence,nmeaList)=self.fetchFromHistory(sequence,
                                                    nmeafilter=self.nmeaFilter,
                                                    includeSource=True,
                                                    waitTime=self.waitTime)
          for data in nmeaList:
            if not data is None and not data.omitDecode:
              if nmeaParser.parseData(data.data,source=data.source):
                if not hasNmea:
                  self.setInfo('main',"feeding NMEA",WorkerStatus.NMEA)
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())


class AVNGpsdFeeder(AVNFeeder):
  '''
  legacy config support with AVNGpsdFeeder
  '''

  @classmethod
  def autoInstantiate(cls):
    return False


avnav_handlerList.registerHandler(AVNGpsdFeeder)
avnav_handlerList.registerHandler(AVNFeeder)
