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
from avnav_util import MovingSum
import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY,subsource=None):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode
    self.sourcePriority=sourcePriority
    self.timestamp=time.monotonic()
    self.subsource=subsource



#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNQueue(AVNWorker):
  P_MAXLIST=WorkerParameter('maxList',default=300,type=WorkerParameter.T_NUMBER,
                            description='number of nmea records to be queued',
                            rangeOrList=[10,3000])
  P_SLEEP=WorkerParameter('feederSleep',default=0.5,type=WorkerParameter.T_FLOAT,
                          editable=False)
  P_NAME=WorkerParameter('name',default='main',type=WorkerParameter.T_STRING,
                         editable=False)
  P_AGE=WorkerParameter('maxAge',default=3,type=WorkerParameter.T_FLOAT,
                        description='max age(s) of an NMEA item in the queue before it gets dropped',
                        rangeOrList=[1,1000])
  P_ALL=[P_MAXLIST,P_SLEEP,P_NAME,P_AGE]
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

  def stop(self):
    super().stop()
    self.listlock.acquire()
    try:
      self.listlock.notifyAll()
    finally:
      self.listlock.release()



  def addNMEA(self, entry,source=None,addCheckSum=False,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY,subsource=None):
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
    nentry=NmeaEntry(entry,source,omitDecode,sourcePriority,subsource=subsource)
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
                       blackList=None,
                       returnError=False,
                       maxAge=None,
                       omitsubsource=None):
    '''
    fetch data from the queue
    @param sequence: the last read sequence
    @param maxEntries: the max number of entries we read
    @param includeSource: include the meta information with the entries
    @param waitTime: time to wait (in s) if no data is available
    @param nmeafilter: an nmeafilter (list) to only filter messages matching
    @param blackList: a list of source names to be omitted
    @param returnError: return an error flag
    @param maxAge: max age (in s) of the messages, defaults to the configured maxAge
    @param omitsubsource: if set do not fetch records from this subsource
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
    def shouldInclude(item: NmeaEntry):
      if omitsubsource is not None and item.subsource is not None and item.subsource == omitsubsource:
        return False
      if nmeafilter is not None:
        if not NMEAParser.checkFilter(item.data,nmeafilter):
          return False
      if blackList is not None:
        if item.source in blackList:
          return False
      return True
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
            while startPoint < len(self.history) and self.history[startPoint].timestamp < allowedAge:
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
            #if we did not find anything
            #we start the next time at the topmost sequence+1
            sequence=self.sequence+1
            seq=sequence #we return this if nothing found
          if len(rtlist) < 1:
            wait = stop - time.monotonic()
            if wait <= 0:
              break
            self.listlock.wait(wait)
      except Exception as e:
        pass
    if len(rtlist) < 1:
      if returnError:
        return (numErrors,seq,rtlist)
      return (seq,rtlist)
    if includeSource:
      if nmeafilter is None and blackList is None:
        if returnError:
          return (numErrors,seq,rtlist)
        return (seq,rtlist)
      rl=[el for el in rtlist if shouldInclude(el)]
      if returnError:
        return (numErrors,seq,rl)
      return (seq,rl)
    else:
      rt=[]
      for le in rtlist:
        if shouldInclude(le):
          rt.append(le.data)
      if returnError:
        return (numErrors,seq,rt)
      return (seq,rt)

  #a standalone feeder that uses our bultin methods
  
  def run(self):
    AVNLog.info("feeder started")
    self.setInfo('main', "running", WorkerStatus.RUNNING)
    sequence=None
    while not self.shouldStop():
      while True:
        self.wait(1)


avnav_handlerList.registerHandler(AVNQueue)

class Fetcher:
  def _split(self,param):
    if param is None:
      return None
    rt=[el for el in param.split(",") if el != ""]
    if len(rt) < 1:
      return None
    return rt

  def __init__(self,queue:AVNQueue,
               infoHandler:InfoHandler,
               maxEntries=10,
               includeSource=False,
               waitTime=0.1,
               nmeaFilter=None,
               blackList=None,
               maxAge=None,
               returnErrors=False,
               sumKey='received',
               errorKey='skipped',
               ownsubsource=None):
    self._queue=queue
    self._info=infoHandler
    self._maxEntries=maxEntries
    self._includeSource=includeSource
    self._waitTime=waitTime
    self._nmeaFilter=self._split(nmeaFilter)
    self._blackList=self._split(blackList)
    self._maxAge=maxAge if maxAge is not None else queue.maxAge
    self._returnErrors=returnErrors
    self._sequence=None
    self._sumKey=sumKey
    if sumKey is not None:
      self._nmeaSum=MovingSum()
    self._errorKey=errorKey
    if errorKey is not None:
      self._nmeaErrors=MovingSum()
    self._ownsubsource=ownsubsource

  def __del__(self):
    if self._sumKey is not None:
      self._info.deleteInfo(self._sumKey)
    if self._errorKey is not None:
      self._info.deleteInfo(self._errorKey)

  def updateParam(self,
                  maxEntries=None,
                  includeSource=None,
                  waitTime=None,
                  nmeaFilter=None,
                  blackList=None,
                  maxAge=None,
                  returnErrors=None,
                  ):
    if maxEntries is not None:
      self._maxEntries=maxEntries
    if includeSource is not None:
      self._includeSource=includeSource
    if waitTime is not None:
      self._waitTime=waitTime
    if nmeaFilter is not None:
      self._nmeaFilter=self._split(nmeaFilter)
    if maxAge is not None:
      self._maxAge=maxAge
    if returnErrors is not None:
      self._returnErrors=returnErrors
    if blackList is not None:
      self._blackList=self._split(blackList)

  def fetch(self,maxEntries=None,
                       waitTime=None,
                       maxAge=None):
    (numErrors,self._sequence,nmeaList)=self._queue.fetchFromHistory(
      sequence=self._sequence,
      includeSource=self._includeSource,
      waitTime=self._waitTime if waitTime is None else waitTime,
      maxAge=self._maxAge if maxAge is None else maxAge,
      nmeafilter=self._nmeaFilter,
      blackList=self._blackList,
      returnError=True,
      maxEntries=self._maxEntries if maxEntries is None else maxEntries,
      omitsubsource=self._ownsubsource
      )
    if self._nmeaErrors is not None:
      self._nmeaErrors.add(numErrors)
    if self._nmeaSum is not None:
      self._nmeaSum.add(len(nmeaList))
    if self._returnErrors:
      return numErrors,nmeaList
    else:
      return nmeaList

  def reset(self):
    self._sequence=None
    if self._nmeaSum is not None:
      self._nmeaSum.clear()
    if self._nmeaErrors is not None:
      self._nmeaErrors.clear()

  def reportSum(self,txt=''):
    if self._nmeaSum is None:
      return
    if self._nmeaSum.shouldUpdate():
      self._info.setInfo(self._sumKey,
                  "%s %.4g/s"%(txt,self._nmeaSum.avg()),
                  WorkerStatus.NMEA if self._nmeaSum.val()>0 else WorkerStatus.INACTIVE)
  def reportErr(self,txt=''):
    if self._nmeaErrors is None:
      return
    if self._nmeaErrors.shouldUpdate():
      self._info.setInfo(self._errorKey,
                  "%s %d errors/10s"%(txt,self._nmeaErrors.val()),
                  WorkerStatus.ERROR if self._nmeaErrors.val()>0 else WorkerStatus.INACTIVE)
  def report(self):
    self.reportErr()
    self.reportSum()