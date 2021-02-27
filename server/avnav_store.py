# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021,2019 Andreas Vogel andreas@wellenvogel.net
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

from avnav_util import *


#the main List of navigational items received
class AVNStore(object):
  BASE_KEY_GPS = 'gps'
  BASE_KEY_AIS = 'ais'
  BASE_KEY_SKY = 'sky'
  KEY_LAST_RECORD = 'internal.last' #we remember when we received the last kind of NMEA record
  # AIS messages we store
  knownAISTypes = (1, 2, 3, 5, 18, 19, 24)
  class DataEntry(object):
    def __init__(self,value,source=None,priority=0,keepAlways=False):
      self.value=value
      self.timestamp=AVNUtil.utcnow()
      self.source=source
      self.priority=priority
      self.keepAlways=keepAlways

  class AisDataEntry(object):
    def __init__(self,data):
      self.value=data
      self.timestamp = AVNUtil.utcnow()
  #fields we merge
  ais5mergeFields=['imo_id','callsign','shipname','shiptype','destination']
  CHANGE_COUNTER = ['alarm', 'leg', 'route']
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI):
    self.__list={}
    self.__aisList={}
    self.__listLock=threading.Lock()
    self.__aisLock = threading.Lock()
    self.__expiryTime=expiryTime
    self.__aisExpiryTime=aisExpiryTime
    self.__ownMMSI=ownMMSI
    self.__prefixCounter={} #contains the number of entries for TPV, AIS,...
    # a description of the already registered keys
    self.__registeredKeys={} # type: dict
    # for wildcard keys we speed up by storing keys we already found
    self.__approvedKeys=set()
    # store for the wildcard keys
    self.__wildcardKeys={}
    # all the key sources
    self.__keySources={}
    self.__lastAisSource=None
    self.__registerInternalKeys()
    for ck in self.CHANGE_COUNTER:
      self.updateChangeCounter(ck)

  def __registerInternalKeys(self):
    self.registerKey(self.BASE_KEY_AIS+".count","AIS count",self.__class__.__name__)
    self.registerKey(self.BASE_KEY_AIS+".entities.*","AIS entities",self.__class__.__name__)
    self.registerKey(self.KEY_LAST_RECORD+".*","timestamp of last received record",self.__class__.__name__)

  def __isExpired(self, entry, now=None):
    if entry.keepAlways:
      return False
    if now is None:
      now=AVNUtil.utcnow()
    et = now - self.__expiryTime
    return entry.timestamp < et
  def __isAisExpired(self, aisEntry, now=None):
    if now is None:
      now=AVNUtil.utcnow()
    et=now - self.__aisExpiryTime
    return aisEntry.timestamp < et

  def getExpiryPeriod(self):
    return self.__expiryTime

  def updateChangeCounter(self,name):
    if not name in self.CHANGE_COUNTER:
      return False
    AVNLog.ld("AVNNavData update change %s", name)
    listKey=self.BASE_KEY_GPS+".update"+name
    self.__listLock.acquire()
    try:
      entry = self.__list.get(listKey)
      if entry is None:
        entry=AVNStore.DataEntry(AVNUtil.utcnow(),keepAlways=True)
        self.__list[listKey]=entry
      else:
        entry.value+=1
    except:
      pass
    self.__listLock.release()
    return True

  def setValue(self,key,value,source=None,priority=0):
    """
    set a data value
    @param key: the key to be set
    @param value: either a string/number/boolean or a dict
                  if the value is a dict, all its keys will be added to the provided key and the values will be set
    @param source: optional a source key
    @return:
    """
    AVNLog.ld("AVNNavData set value key=%s", key, str(value))
    self.__listLock.acquire()
    isDict=False
    dataValue=value
    try:
      keylist=['']
      if type(value) == dict:
        keylist=list(value.keys())
        isDict=True
      for kext in keylist:
        if isDict:
          listKey=key+'.'+kext
          dataValue=value[kext]
        else:
          listKey=key
        if not self.__allowedKey(listKey):
          AVNLog.error("key %s is not registered in store" , listKey)
          raise Exception("key %s is not registered in store" % (listKey))
        existing=self.__list.get(listKey)
        doUpdate=True
        if existing is not None:
          if not self.__isExpired(existing) and existing.priority > priority:
            doUpdate=False
        if doUpdate:
          self.__list[listKey]=AVNStore.DataEntry(dataValue, priority=priority,source=source)
        else:
          AVNLog.debug("AVNavData: keeping existing entry for %s",listKey)
    except :
      self.__listLock.release()
      AVNLog.error("exception in writing data: %",traceback.format_exc())
      raise
    self.__listLock.release()

  def setReceivedRecord(self,record,source=None):
    if len(record) > 3:
      record=record[-3:]
    now=AVNUtil.utcnow()
    self.setValue(self.KEY_LAST_RECORD+"."+record,now,source)

  def setAisValue(self,mmsi,data,source=None):
    """
    add an AIS entry
    @param mmsi:
    @param data:
    @return:
    """
    AVNLog.debug("AVNavData add ais %s",mmsi)
    if self.__ownMMSI != '' and mmsi is not None and self.__ownMMSI == mmsi:
      AVNLog.debug("omitting own AIS message mmsi %s", self.__ownMMSI)
      return
    key=AVNStore.BASE_KEY_AIS+"."+mmsi
    now=AVNUtil.utcnow()
    self.__aisLock.acquire()
    existing=self.__aisList.get(key)
    if existing is None:
      existing=AVNStore.AisDataEntry({'mmsi':mmsi})
      self.__aisList[key]=existing
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
    self.__lastAisSource=source
    self.__aisLock.release()


  def getAisData(self, asDict=False,copyElements=False):
    rt=[] if not asDict else {}
    keysToRemove=[]
    now=AVNUtil.utcnow()
    self.__aisLock.acquire()
    try:
      for key in list(self.__aisList.keys()):
        aisEntry=self.__aisList[key]
        if self.__isAisExpired(aisEntry, now):
          keysToRemove.append(key)
        else:
          if asDict:
            if copyElements:
              rt[key] = aisEntry.value.copy()
            else:
              rt[key]=aisEntry.value
          else:
            if copyElements:
              rt.append(aisEntry.value.copy())
            else:
              rt.append(aisEntry.value)
      for rkey in keysToRemove:
        del self.__aisList[rkey]
    except:
      AVNLog.error("error when reading AIS data %s",traceback.format_exc())
      self.__aisLock.release()
      raise
    self.__aisLock.release()
    return rt

  def getSingleValue(self,key,includeInfo=False):
    self.__listLock.acquire()
    rt=self.__list.get(key)
    self.__listLock.release()
    if rt is None:
      return None
    if self.__isExpired(rt):
      return None
    if type(rt.value) == dict:
      return None
    if includeInfo:
      return rt
    return rt.value

  def getDataByPrefix(self,prefix,levels=None):
    """
    get all entries with a certain prefix
    the prefix must exactly be a part of the key until a . (but not including it)
    @param prefix: the prefix
    @param levels: the number of levels to be returned (default: all)
    @return: a dict with all entries, keys having the prefix removed
    """
    if prefix == self.BASE_KEY_AIS:
      rt=self.getAisData(True,copyElements=True)
      return rt
    prefix=prefix+"."
    plen=len(prefix)
    rt={}
    self.__listLock.acquire()
    try:
      now=AVNUtil.utcnow()
      keysToRemove=[]
      for key in list(self.__list.keys()):
        if not key.startswith(prefix):
          continue
        entry=self.__list[key]
        if self.__isExpired(entry, now):
          keysToRemove.append(key)
        else:
          nkey=key[plen:]
          if nkey.find(".") >= 0:
            nkey=re.sub('\.*$','',nkey)
          if nkey.find(".") >= 0:
            #compound key
            keyparts=nkey.split(".")
            numparts=len(keyparts)
            current=rt
            for i in range(0,numparts-1):
              if current.get(keyparts[i]) is None:
                current[keyparts[i]]={}
              current=current[keyparts[i]]
              if not type(current) == dict:
                AVNLog.error("inconsistent data , found normal value and dict with key %s"%(".".join(keyparts[0:i])))
                break
            if type(current) == dict:
              current[keyparts[-1]]=entry.value
          else:
            rt[nkey]=entry.value
      for rkey in keysToRemove:
        del self.__list[rkey]
    except:
      self.__listLock.release()
      AVNLog.error("error getting value with prefix %s: %s"%(prefix,traceback.format_exc()))
      raise
    self.__listLock.release()
    return rt

  #delete all entries from the list (e.g. when we have to set the time)
  def reset(self): 
    self.__listLock.acquire()
    self.__list.clear()
    self.__aisList.clear()
    self.__listLock.release()

  def getAisCounter(self):
    return len(self.__aisList)


  def getLastSource(self,key):
    rt=self.__list.get(key)
    if rt is None:
      return ""
    return rt.source
  def getLastAisSource(self):
    return self.__lastAisSource
  KEY_PATTERN='^[a-zA-Z0-9_.*]*$'
  def __checkKey(self, key):
    if re.match(self.KEY_PATTERN,key) is None:
      raise Exception("key %s does not match pattern %s"%(key,self.KEY_PATTERN))
  def __isWildCard(self, key):
    return key.find('*') >= 0
  @classmethod
  def wildCardMatch(cls,key, wildcardKey):
    keyParts=key.split('.')
    wildCardParts=wildcardKey.split('.')
    if len(keyParts) < len(wildCardParts):
      return False
    if len(wildCardParts) < len(keyParts):
      for x in range(0, len(wildCardParts)):
        if keyParts[x] != wildCardParts[x] and wildCardParts[x] != '*':
          return False
      if wildCardParts[-1] == '*':
        return True
      return False
    for x in range(0,len(keyParts)):
      if keyParts[x] != wildCardParts[x] and wildCardParts[x] != '*':
        return False
    return True

  def __allowedKey(self,key):
    """
    check if a key is allowed
    fill the approved keys if a new wildcard match has been found
    @param key:
    @return: True if ok, False otherwise
    """
    if key in self.__registeredKeys:
      return True
    if key in self.__approvedKeys:
      return True
    for wildcard in list(self.__wildcardKeys.keys()):
      if self.wildCardMatch(key, wildcard):
        self.__approvedKeys.add(key)
        return True
    return False

  def isKeyRegistered(self,key):
    return self.__allowedKey(key)

  def registerKey(self,key,keyDescription,source=None):
    """
    register a new key description
    raise an exception if there is already a key with the same name or a prefix of it
    @param key:
    @param keyDescription:
    @return:
    """
    self.__checkKey(key)
    for existing in list(self.__registeredKeys.keys()):
      if existing == key or key.startswith(existing):
        raise Exception("key %s already registered from %s:%s" % (key,existing,self.__registeredKeys[existing]))
    for existing in list(self.__wildcardKeys.keys()):
      if self.wildCardMatch(key, existing):
        raise Exception("key %s matches wildcard from %s:%s" % (key, existing, self.__wildcardKeys[existing]))
    if self.__isWildCard(key):
      for existing in list(self.__registeredKeys.keys()):
        if self.wildCardMatch(existing, key):
          raise Exception("wildcard key %s matches existing from %s:%s" % (key, existing, self.__registeredKeys[existing]))
    self.__keySources[key]=source
    if self.__isWildCard(key):
      self.__wildcardKeys[key]=keyDescription
    else:
      self.__registeredKeys[key] = keyDescription

  def getRegisteredKeys(self):
    return self.__registeredKeys.copy().update(self.__wildcardKeys)



  
  def __str__(self):
    rt="%s \n"%self.__class__.__name__
    idx=0
    self.__listLock.acquire()
    for k in list(self.__list.keys()):
      rt+="   (%03d:%s)%s=%s\n" % (idx, time.strftime("%Y/%m/%d-%H:%M:%S ", time.gmtime(self.__list[k].timestamp)), k, self.__list[k].value)
    self.__listLock.release()
    return rt
