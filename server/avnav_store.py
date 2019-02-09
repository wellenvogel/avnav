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


#the main List of navigational items received
class AVNStore():
  SOURCE_KEY_AIS = 'AIS'
  SOURCE_KEY_GPS = 'GPS'
  SOURCE_KEY_OTHER = 'OTHER'
  BASE_KEY_GPS = 'gps'
  BASE_KEY_AIS = 'ais'
  BASE_KEY_SKY = 'sky'
  # AIS messages we store
  knownAISTypes = (1, 2, 3, 5, 18, 19, 24)
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
      self.source=AVNStore.SOURCE_KEY_AIS
  #fields we merge
  ais5mergeFields=['imo_id','callsign','shipname','shiptype','destination']
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI):
    self.list={}
    self.aisList={}
    self.listLock=threading.Lock()
    self.aisLock = threading.Lock()
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
          listKey=key+'.'+kext
          dataValue=value[kext]
        else:
          listKey=key
        if self.registeredKeys.get(listKey) is None:
          AVNLog.error("key %s is not registered in store" % listKey)
          raise Exception("key %s is not registered in store" % listKey)
        existing=self.list.get(listKey)
        doUpdate=True
        if existing is not None:
          if not self.__isExpired__(existing) and existing.priority > priority:
            doUpdate=False
        if doUpdate:
          self.list[listKey]=AVNStore.DataEntry(dataValue, priority=priority)
          sourceKey=AVNStore.SOURCE_KEY_OTHER
          if key.startswith(AVNStore.BASE_KEY_GPS):
            sourceKey=AVNStore.SOURCE_KEY_GPS
          self.lastSources[sourceKey]=source
        else:
          AVNLog.debug("AVNavData: keeping existing entry for %s",key)
    except :
      self.listLock.release()
      AVNLog.error("exception in writing data: %",traceback.format_exc())
      raise
    self.listLock.release()

  def setAisValue(self,mmsi,data,source=None):
    """
    add an AIS entry
    @param mmsi:
    @param data:
    @return:
    """
    AVNLog.debug("AVNavData add ais %s",mmsi)
    if self.ownMMSI != '' and mmsi is not None and self.ownMMSI == mmsi:
      AVNLog.debug("omitting own AIS message mmsi %s", self.ownMMSI)
      return
    key=AVNStore.BASE_KEY_AIS+"."+mmsi
    now=AVNUtil.utcnow()
    self.aisLock.acquire()
    existing=self.aisList.get(key)
    if existing is None:
      existing=AVNStore.AisDataEntry({'mmsi':mmsi})
      self.aisList[key]=existing
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
    self.lastSources[AVNStore.SOURCE_KEY_AIS]=source
    self.aisLock.release()


  def getAisData(self):
    rt=[]
    keysToRemove=[]
    now=AVNUtil.utcnow()
    self.aisLock.acquire()
    try:
      for key in self.aisList.keys():
        aisEntry=self.aisList[key]
        if self.__isAisExpired__(aisEntry,now):
          keysToRemove.append(key)
        else:
          rt.append(aisEntry.value)
      for rkey in keysToRemove:
        del self.aisList[rkey]
    except:
      AVNLog.error("error when reading AIS data %s",traceback.format_exc())
      self.aisLock.release()
      raise
    self.aisLock.release()
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
    self.aisList.clear()
    self.listLock.release()

  def getAisCounter(self):
    return len(self.aisList)


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
