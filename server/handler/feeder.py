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

from avnav_worker import *
hasSerial=False

try:
  import avnserial
  hasSerial=True
except:
  pass


import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode
    self.sourcePriority=sourcePriority
    self.timestamp=time.monotonic()



#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNFeeder(AVNWorker):
  P_MAXLIST=WorkerParameter('maxList',default=300,type=WorkerParameter.T_NUMBER,
                            description='number of nmea records to be queued',
                            rangeOrList=[10,3000])
  P_SLEEP=WorkerParameter('feederSleep',default=0.5,type=WorkerParameter.T_FLOAT,
                          editable=False)
  P_NAME=WorkerParameter('name',default='feeder',type=WorkerParameter.T_STRING,
                         editable=False)
  P_FILTER=WorkerParameter('decoderFilter',default='',type=WorkerParameter.T_STRING,
                           description='an NMEA filter for the decoder')
  P_AGE=WorkerParameter('maxAge',default=3,type=WorkerParameter.T_FLOAT,
                        description='max age(s) of an NMEA item in the queue before it gets dropped',
                        rangeOrList=[1,1000])
  P_ALL=[P_MAXLIST,P_SLEEP,P_NAME,P_FILTER,P_AGE]
  @classmethod
  def getConfigParam(cls, child=None):
    return cls.P_ALL

  @classmethod
  def canEdit(cls):
    return True

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
    self.history=[]
    #sequence semantics:
    #the last entry in the list has the sequence stored here
    #the first entry has self.sequence-len(self.history)+1
    #so if there is one entry in the list
    #current sequence and first sequence are identical
    self.sequence=1
    self.readConfig()

  def _firstSequence(self):
    '''
    get the first sequence
    only call when the list is locked
    @return:
    '''
    return self.sequence-len(self.history)+1
  def updateConfig(self, param, child=None):
    rt=super().updateConfig(param, child)
    self.readConfig()
    return rt

  def readConfig(self):
    self.maxlist = self.P_MAXLIST.fromDict(self.param)
    self.waitTime= self.P_SLEEP.fromDict(self.param)
    self.maxAge= self.P_AGE.fromDict(self.param)
    filterstr = self.P_FILTER.fromDict(self.param)
    self.nmeaFilter = filterstr.split(",")

  def stop(self):
    super().stop()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()



  def addNMEA(self, entry,source=None,addCheckSum=False,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    """
    add an NMEA record to our internal queue
    @param entry: the record
    @param source: the source where the record comes from
    @param addCheckSum: add the NMEA checksum
    @return:
    """
    rt=False
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
    nentry=NmeaEntry(entry,source,omitDecode,sourcePriority)
    with self.listlock:
      self.sequence+=1
      if len(self.history) >= self.maxlist:
        self.history.pop(0)
      self.history.append(nentry)
      hl=len(self.history)
      rt=True
      self.listlock.notify_all()
    AVNLog.debug("addNMEA history=%d data=%s",hl,entry)
    return rt

  def wakeUp(self):
    super().wakeUp()
    with self.listlock:
      self.listlock.notifyAll()

  #fetch entries from the history
  #only return entries with higher sequence
  #return a tuple (lastSequence,[listOfEntries])
  #when sequence == None or 0 - just fetch the topmost entries (maxEntries)
  def fetchFromHistory(self,sequence,maxEntries=10,
                       includeSource=False,
                       waitTime=0.1,
                       nmeafilter=None,
                       returnError=False,
                       maxAge=None):
    '''
    fetch data from the queue
    @param sequence: the last read sequence
    @param maxEntries: the max number of entries we read
    @param includeSource: include the meta information with the entries
    @param waitTime: time to wait (in s) if no data is available
    @param nmeafilter: an nmeafilter (list) to only filter messages matching
    @param returnError: return an error flag
    @param maxAge: max age (in s) of the messages, defaults to the configured maxAge
    @return:
    '''
    seq=0
    rtlist=[]

    if maxAge is None:
      maxAge=self.maxAge
    if waitTime <=0:
      waitTime=0.1
    if maxEntries< 0:
      maxEntries=0
    if sequence is None:
      sequence=0
    now=time.monotonic()
    stop = now + waitTime
    numErrors=0
    with self.listlock:
      if sequence <= 0:
        #if a new connection is opened - always wait for a new entry before sending out
        #sequence = 0 or sequence = None is a new connection
        #self.sequence starts at 1
        sequence=self.sequence+1
      else:
        #we expect at least the next sequence from what we had
        sequence+=1
      try:
        while len(rtlist) < 1:
          seq=self.sequence
          if seq >= sequence:
            # we now try to get entries from the starting sequence to the topmost
            # but not more then maxEntries
            # and not older then maxAge
            startSequence=self._firstSequence()
            if (sequence >= startSequence):
              #good we still have our expected sequence in the queue
              startPoint=sequence-startSequence
            else:
              #our requested sequence is not in the list any more
              numErrors=startSequence-sequence
              startPoint=0
            allowedAge=time.monotonic()-maxAge #maybe better related to return point
            while self.history[startPoint].timestamp < allowedAge and startPoint < len(self.history):
              numErrors+=1
              startPoint+=1
            if startPoint < len(self.history):
              #something to return
              numrt=len(self.history)-startPoint
              if numrt > maxEntries:
                numrt=maxEntries
              seq=startSequence+startPoint+numrt-1
              rtlist=self.history[startPoint:startPoint+numrt]
              break
          if len(rtlist) < 1:
            wait = stop - time.monotonic()
            if wait <= 0:
              break
            self.listlock.wait(wait)
      except:
        pass
    if len(rtlist) < 1:
      if returnError:
        return (numErrors,seq,rtlist)
      return (seq,rtlist)
    if includeSource:
      if nmeafilter is None:
        if returnError:
          return (numErrors,seq,rtlist)
        return (seq,rtlist)
      rl=[el for el in rtlist if NMEAParser.checkFilter(el.data,nmeafilter)]
      if returnError:
        return (numErrors,seq,rl)
      return (seq,rl)
    else:
      rt=[]
      for le in rtlist:
        if NMEAParser.checkFilter(le.data,nmeafilter):
          rt.append(le.data)
      if returnError:
        return (numErrors,seq,rt)
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
          (numErrors,sequence,nmeaList)=self.fetchFromHistory(sequence,
                                                    nmeafilter=self.nmeaFilter,
                                                    includeSource=True,
                                                    waitTime=self.waitTime,
                                                    returnError=True)
          if numErrors > 0:
            AVNLog.error("decoder lost %d records",numErrors)
          for data in nmeaList:
            if not data is None and not data.omitDecode:
              if nmeaParser.parseData(data.data,source=data.source,sourcePriority=data.sourcePriority):
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
