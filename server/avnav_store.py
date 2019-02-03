#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013,2019 Andreas Vogel andreas@wellenvogel.net
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

import json
import threading
import pprint
import time
import traceback
from avnav_util import *

#a data entry
#data is the decoded dict
#for AIS the key is BASE_KEY_AIS.<mmsi>
class AVNDataEntry():
  SOURCE_KEY_AIS='AIS'
  SOURCE_KEY_GPS='GPS'
  SOURCE_KEY_OTHER='OTHER'
  BASE_KEY_GPS='gps'
  BASE_KEY_AIS='ais'
  #AIS messages we store
  knownAISTypes=(1,2,3,5,18,19,24)
  def __init__(self,key,data,timestamp=None,isAis=False):
    self.key=key  # type: str
    self.data=data # type: dict
    if timestamp is not None:
      self.timestamp=timestamp # type: timestamp
    else:
      self.timestamp=AVNUtil.utcnow()
    self.source=None # type: str
    self._isAis=isAis # type: bool
    self._sourceKey=self.SOURCE_KEY_AIS if isAis else self.SOURCE_KEY_OTHER # type: str
    if self.key.startswith(self.BASE_KEY_GPS) and not self.isAis():
      self.source=self.SOURCE_KEY_GPS
    self._priority=0 #set a priority to allow for higher prio to overwrite

  def __unicode__(self):
    rt="AVNDataEntry: %s(ts=%s)=%s" % (self.key,(self.timestamp if self.timestamp is not None else 0),pprint.pformat(self.data))
    return rt
  def toJson(self):
    rt={
      'key':self.key,
      'source':self.source,
      'timestamp':self.timestamp,
      'data':self.data,
      'isAis':self._isAis
    }
    return json.dumps(self.data)
  def setSource(self,source):
    self.source=source
  def isAis(self):
    return self._isAis
  def getSourceKey(self):
    return self._sourceKey
  def setPriority(self,priority=0):
    """
    set the priority of an entry
    @param priority: the priority, 0 being lowest (default)
    @type priority: int
    @return:
    """
    self._priority=priority

  def getPriority(self):
    return self._priority
  

#the main List of navigational items received
class AVNStore():
  #fields we merge
  ais5mergeFields=['imo_id','callsign','shipname','shiptype','destination']
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI):
    self.list={}
    self.listLock=threading.Lock()
    self.expiryTime=expiryTime
    self.aisExpiryTime=aisExpiryTime
    self.ownMMSI=ownMMSI
    self.prefixCounter={} #contains the number of entries for TPV, AIS,...
    self.lastSources={} #contains the last source for each class
    # a description of the already registered keys
    # TODO: prevent data without registered key
    self.registeredKeys={} # type: dict
    self.keySources={}


  
  #add an entry to the list
  #do not add if there is already such an entry with newer timestamp
  #timestamps always relate to our system time - never directly to the GPS time!
  #this avoids confusion when we have to change the system time...
  #this is always done by the main thread!
  def addEntry(self,navEntry):
    """

    @param navEntry: the entry to be added
    @type  navEntry: AVNDataEntry
    @return:
    """
    AVNLog.ld("AVNNavData add entry",navEntry)
    if navEntry.isAis():
      mmsi=None
      try:
        mmsi=str(navEntry.data['mmsi'])
      except:
        pass
      if self.ownMMSI != '' and mmsi is not None and self.ownMMSI == mmsi:
          AVNLog.debug("omitting own AIS message mmsi %s",self.ownMMSI)
          return
    else:
      if self.registeredKeys.get(navEntry.key) is None:
        AVNLog.error("key %s is not registered in store" % navEntry.key)
        raise Exception("key %s is not registered in store" % navEntry.key)
    self.listLock.acquire()
    key=navEntry.key
    if key in self.list:
      #for AIS type 5/24 messages we merge them with an existing message
      #for others we merge back...
      if navEntry.isAis():
        if navEntry.data.get('type')=='5' or navEntry.data.get('type')=='24':
          AVNLog.debug("merging AIS type 5/24 with existing message")
          for k in self.ais5mergeFields:
            v=navEntry.data.get(k)
            if v is not None:
              self.list[navEntry.key].data[k]=v
          if self.list[navEntry.key].timestamp < navEntry.timestamp:
            self.list[navEntry.key].timestamp = navEntry.timestamp
        else:
          AVNLog.debug("merging AIS with existing message")
          for k in self.ais5mergeFields:
            v=self.list[navEntry.key].data.get(k)
            if v is not None:
              navEntry.data[k]=v
          self.list[navEntry.key]=navEntry
        #always replace here and merge back
        self.lastSources[navEntry.getSourceKey()]=navEntry.source
        self.listLock.release()
        return
      else:
        if self.list[key].timestamp > navEntry.timestamp or self.list[key].priority > navEntry.getPriority():
          AVNLog.debug("not adding entry, older ts %s/lower priority",unicode(navEntry))
          self.listLock.release()
          return
    self.list[key]=navEntry
    self.lastSources[navEntry.getSourceKey()]=navEntry.source
    AVNLog.debug("adding entry %s",unicode(navEntry))
    self.listLock.release()
  #check for an entry being expired
  #the list must already being locked!
  #returns the entry or None
  def __checkExpired__(self,entry,key=None):
    if entry is None:
      return None
    if key is None:
      key=entry.key
    et=AVNUtil.utcnow()-self.expiryTime
    if entry.isAis():
      et=AVNUtil.utcnow()-self.aisExpiryTime
    if entry.timestamp < et:
      AVNLog.debug("remove expired entry %s, et=%s ",unicode(entry),unicode(et))
      del self.list[key]
      return None
    return entry
  #find an entry - return None if none found or expired...
  def getEntry(self,key):
    self.listLock.acquire()
    rt=self.list.get(key)
    rt=self.__checkExpired__(rt, key)
    self.listLock.release()
    return rt
  def getFilteredEntries(self,prefix,suffixlist):
    rt={}
    if len(suffixlist) == 0:
      #return all
      searchprefix=prefix
      self.listLock.acquire()
      for k in self.list.keys():
        e=self.list[k]
        if e.key.startswith(searchprefix):
          rt[e.key]=e
      nrt={}
      for k in rt.keys():
        e=self.__checkExpired__(rt[k], k)
        if e is not None:
          nrt[k]=e
      #update the number of entries for this prefix for fast status queries
      ocv=len(rt.keys())
      self.prefixCounter[prefix]=ocv
      AVNLog.debug("NavData: count for %s=%d"%(prefix,ocv))
      self.listLock.release()
      return nrt
    for sfx in suffixlist:
      k=prefix+"."+sfx
      entry=self.list.get(k)
      entry=self.__checkExpired__(entry)
      if entry is not None:
        rt[k]=entry
    return rt
  def getFilteredEntriesAsJson(self,prefix,suffixlist):
    rt=[]
    for e in self.getFilteredEntries(prefix, suffixlist).values():
      rt.append(e.data)
    AVNLog.ld("collected entries",rt)
    return json.dumps(rt)
  
  def getMergedEntries(self,prefix,suffixlist,isAis=False):
    fe=self.getFilteredEntries(prefix, suffixlist)
    rt=AVNDataEntry(prefix,{},isAis=isAis)
    rt.key=prefix
    for kf in fe:
      e=fe[kf]
      if e.isAis() != isAis:
        continue
      if rt.timestamp is None:
        rt.timestamp=e.timestamp
      newer=False
      if e.timestamp > rt.timestamp:
        newer=True
      for k in e.data.keys():
        if not (k in rt.data) or newer or rt.data.get(k) is None:
          rt.data[k] = e.data[k]
    AVNLog.ld("getMergedEntries",prefix,suffixlist,rt)
    return rt   
  
  #delete all entries from the list (e.g. when we have to set the time)
  def reset(self): 
    self.listLock.acquire()
    self.list.clear()
    self.listLock.release()

  def getCounter(self,prefix):
    cv=self.prefixCounter.get(prefix)
    if cv is None:
      cv=0
    return cv
  def getLastSource(self,cls):
    rt=self.lastSources.get(cls)
    if rt is None:
      rt=""
    return rt

  def registerKey(self,key,keyDescription,source=None):
    """
    register a new key description
    raise an exception if there is already a key with the same name or a prefix of it
    @param key:
    @param keyDescription:
    @return:
    """
    for existing in self.registeredKeys.keys():
      if existing == key or key.startswith(existing):
        raise Exception("key %s already registered from %s:%s"%(key,existing,self.registeredKeys[existing]))
    self.registeredKeys[key]=keyDescription
    self.keySources[key]=source


  
  def __unicode__(self):
    rt="%s \n"%self.__class__.__name__
    idx=0
    self.listLock.acquire()
    for k in self.list.keys():
      rt+="   (%03d:%s)%s=%s\n" % (idx,time.strftime("%Y/%m/%d-%H:%M:%S ",time.gmtime(self.list[k].timestamp)),self.list[k].key,self.list[k].data)
    self.listLock.release()  
    return rt
