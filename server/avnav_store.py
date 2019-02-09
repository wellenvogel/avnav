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
  BASE_KEY_SKY = 'sky'
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
  class DataEntry:
    def __init__(self,value,source=None,priority=0):
      self.value=value
      self.timestamp=AVNUtil.utcnow()
      self.source=source
      self.priority=priority

  class AisDataEntry:
    def __init__(self,data):
      self.value=data
      self.timestamp = AVNUtil.utcnow()
      self.source=AVNDataEntry.SOURCE_KEY_AIS
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

  def __isExpired__(self,entry,now=None):
    if now is None:
      now=AVNUtil.utcnow()
    et = now - self.expiryTime
    return entry.timestamp < et
  def __isAisExpired__(self,aisEntry,now=None):
    if now is None:
      now=AVNUtil.utcnow()
    et=now - self.aisExpiryTime
    return aisEntry.timestamp < et

  def setValue(self,key,value,source=None,priority=0):
    """
    set a data value
    @param key: the key to be set
    @param value: either a string/number/boolean or a dict
                  if the value is a dict, all its keys will be added to the provided key and the values will be set
    @param source: optional a source key
    @return:
    """
    AVNLog.ld("AVNNavData set value key=%s", key, value)
    self.listLock.acquire()
    isDict=False
    dataValue=value
    try:
      keylist=['']
      if type(value) == dict:
        keylist=value.keys()
        isDict=True
      for kext in keylist:
        if isDict:
          key=key+'.'+kext
          dataValue=value[kext]
        if self.registeredKeys.get(key) is None:
          AVNLog.error("key %s is not registered in store" % key)
          raise Exception("key %s is not registered in store" % key)
        existing=self.list.get(key)
        doUpdate=True
        if existing is not None:
          if not self.__isExpired__(existing) and existing.priority > priority:
            doUpdate=False
        if doUpdate:
          self.list[key]=AVNStore.DataEntry(dataValue, priority=priority)
          sourceKey=AVNDataEntry.SOURCE_KEY_OTHER
          if key.startswith(AVNDataEntry.BASE_KEY_GPS):
            sourceKey=AVNDataEntry.SOURCE_KEY_GPS
          self.lastSources[AVNDataEntry.SOURCE_KEY_OTHER]=source
        else:
          AVNLog.debug("AVNavData: keeping existing entry for %s",key)
    except :
      self.listLock.release()
      raise
    self.listLock.release()

  def setAisValue(self,mmsi,data,source=None):
    """
    add an AIS entry
    @param mmsi:
    @param data:
    @return:
    """
    AVNLog.debug("AVNavData add ais %d:%s",mmsi,data)
    if self.ownMMSI != '' and mmsi is not None and self.ownMMSI == mmsi:
      AVNLog.debug("omitting own AIS message mmsi %s", self.ownMMSI)
      return
    key=AVNDataEntry.BASE_KEY_AIS+".%d"%mmsi
    now=AVNUtil.utcnow()
    self.listLock.acquire()
    existing=self.list.get(key)
    if existing is None:
      existing=AVNStore.AisDataEntry({'mmsi':mmsi})
      self.list[key]=existing
    if data.get('type') == '5' or data.get('type') == '24':
      #add new items to existing entry
      AVNLog.debug("merging AIS type 5/24 with existing message")
      for k in self.ais5mergeFields:
        v = data.get(k)
        if v is not None:
          existing.value[k] = v
          existing.timestamp=now
    else:
      AVNLog.debug("merging AIS with existing message")
      newData=data.copy()
      for k in self.ais5mergeFields:
        v = existing.value.get(k)
        if v is not None:
          newData[k] = v
      existing.value=newData
      existing.timestamp=now
    self.lastSources[AVNDataEntry.SOURCE_KEY_AIS]=source
    self.listLock.release()

  def getAisData(self):
    rt=[]
    keysToRemove=[]
    now=AVNUtil.utcnow()
    self.listLock.acquire()
    for key in self.list.keys():
      if key.startswith(AVNDataEntry.BASE_KEY_AIS):
        aisEntry=self.list[key]
        if self.__isAisExpired__(aisEntry,now):
          keysToRemove.append(key)
        else:
          rt.append(aisEntry)
    for rkey in keysToRemove:
      del self.list[rkey]
    self.listLock.release()
    return rt

  def getDataByPrefix(self,prefix,levels=None):
    """
    get all entries with a certain prefix
    the prefix must exactly be a part of the key until a . (but not including it)
    @param prefix: the prefix
    @param levels: the number of levels to be returned (default: all)
    @return: a dict with all entries, keys having the prefix removed
    """
    prefix=prefix+"."
    plen=len(prefix)
    rt={}
    self.listLock.acquire()
    now=AVNUtil.utcnow()
    keysToRemove=[]
    for key in self.list.keys():
      if not key.startswith(prefix):
        continue
      entry=self.list[key]
      if self.__isExpired__(entry,now):
        keysToRemove.append(key)
      else:
        nkey=key[plen:]
        rt[nkey]=entry.value
    for rkey in keysToRemove:
      del self.list[rkey]
    self.listLock.release()
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
      rt+="   (%03d:%s)%s=%s\n" % (idx,time.strftime("%Y/%m/%d-%H:%M:%S ",time.gmtime(self.list[k].timestamp)),k,self.list[k].value)
    self.listLock.release()  
    return rt
