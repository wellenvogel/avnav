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

  AIS_AGE_KEY='age'

  KEY_VERSION= BASE_KEY_GPS+".version"

  # AIS messages we store
  knownAISTypes = (1, 2, 3, 5, 18, 19, 24)
  class DataEntry(object):
    def __init__(self,value,source=None,priority=0,keepAlways=False,record=None,timestamp=None):
      self.value=value
      if timestamp is None:
        self.timestamp=time.monotonic()
      else:
        self.timestamp=timestamp
      self.source=source
      self.priority=priority
      self.keepAlways=keepAlways
      self.record=record

  class AisDataEntry(object):
    def __init__(self,data,priority=0,timestamp=None):
      self.value=data
      self.timestamp = timestamp if timestamp is not None else time.monotonic()
      self.priority=priority
    def add(self,name,value,timestamp=None):
      if self.value.get(name) == value:
        return False
      self.timestamp = timestamp if timestamp is not None else time.monotonic()
      self.value[name]=value
      return True
    def getMmsi(self):
      if not type(self.value) is dict:
        return None
      return self.value.get('mmsi')

  CHANGE_COUNTER = ['alarm', 'leg', 'route','config']
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI,useAisAge):
    self.__list={}
    self.__aisList={}
    self.__listLock=threading.Lock()
    self.__aisLock = threading.Lock()
    self.__expiryTime=expiryTime
    self.__aisExpiryTime=aisExpiryTime
    self.__ownMMSI=ownMMSI
    self.__useAisAge=useAisAge
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
    self.registerKey(self.KEY_VERSION,"server version")

  def __isExpired(self, entry, now=None):
    if entry.keepAlways:
      return False
    if now is None:
      now=time.monotonic()
    et = now - self.__expiryTime
    return entry.timestamp < et
  def __isAisExpired(self, aisEntry, now=None):
    if now is None:
      now=time.monotonic()
    et=now - self.__aisExpiryTime
    return aisEntry.timestamp < et

  def getExpiryPeriod(self):
    return self.__expiryTime
  def getAisExpiryPeriod(self):
    return self.__aisExpiryTime
  def updateBaseConfig(self,expiry,aisExpiry,ownMMSI,useAisAge):
    self.__expiryTime=expiry
    self.__aisExpiryTime=aisExpiry
    self.__ownMMSI=ownMMSI
    self.__useAisAge=useAisAge

  def updateChangeCounter(self,name):
    if not name in self.CHANGE_COUNTER:
      return False
    AVNLog.ld("AVNNavData update change %s", name)
    listKey=self.BASE_KEY_GPS+".update"+name
    self.__listLock.acquire()
    try:
      entry = self.__list.get(listKey)
      if entry is None:
        entry=AVNStore.DataEntry(time.monotonic(),keepAlways=True)
        self.__list[listKey]=entry
      else:
        entry.value+=1
    except:
      pass
    self.__listLock.release()
    return True

  def setValue(self,key,value,source=None,priority=0,record=None,keepAlways=False,timestamp=None):
    """
    set a data value
    @param key: the key to be set
    @param value: either a string/number/boolean or a dict
                  if the value is a dict, all its keys will be added to the provided key and the values will be set
    @param source: optional a source key
    @:param timestamp: steady time point
    @return:
    """
    AVNLog.ld("AVNNavData set value ", key, str(value))
    with self.__listLock:
      isDict=False
      dataValue=value
      try:
        keylist=['']
        if type(value) == dict:
          keylist=list(value.keys())
          isDict=True
        hasUpdate=False
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
            hasUpdate=True
            self.__list[listKey]=AVNStore.DataEntry(dataValue, keepAlways=keepAlways,priority=priority,source=source)
          else:
            AVNLog.debug("AVNavData: keeping existing entry for %s",listKey)
        return hasUpdate
      except :
        AVNLog.error("exception in writing data: %",traceback.format_exc())
        raise

  def setAisValue(self,mmsi,data,source=None,priority=0,timestamp=None):
    """
    add an AIS entry
    @param mmsi:
    @param data:
    @:param timestamp monotonic time stamp
    @return:
    """
    AVNLog.debug("AVNavData add ais %s(%s)",mmsi,data.get('type')or "?")
    if self.__ownMMSI != '' and mmsi is not None and self.__ownMMSI == mmsi:
      AVNLog.debug("omitting own AIS message mmsi %s", self.__ownMMSI)
      return
    key=AVNStore.BASE_KEY_AIS+"."+str(mmsi)
    now=time.monotonic()
    with self.__aisLock:
      existing=self.__aisList.get(key)
      if existing is None:
        existing=AVNStore.AisDataEntry({'mmsi':mmsi},priority,timestamp=timestamp)
        self.__aisList[key]=existing
      elif existing.priority > priority:
        AVNLog.debug("ignore ais for %s due to higher prio %d",mmsi,existing.priority)
        return
      if all(k in data for k in ("lat","lon")): # use timestamp is bound to dynamic data
        existing.timestamp = now if timestamp is None else timestamp
        if self.__useAisAge and "second" in data:
          sec=data.get("second",60) # 60=timestamp not available
          if 0<=sec<60: # use timestamp from ais seconds
            delay = (now%60-sec)%60 # delay of message (up to 59s)
            existing.timestamp -= delay # shift timestamp back
      else:
        del data["type"] # do not update type from static data
      existing.value.update(data) # update existing data with new data
      self.__lastAisSource=source

  def addAisItem(self,mmsi,values,source,priority,timestamp=None):
    if self.__ownMMSI != '' and mmsi is not None and self.__ownMMSI == mmsi:
      AVNLog.debug("omitting own AIS message mmsi %s", self.__ownMMSI)
      return
    key=AVNStore.BASE_KEY_AIS+"."+str(mmsi)
    with self.__aisLock:
      existing=self.__aisList.get(key)
      if existing is None:
        existing=AVNStore.AisDataEntry({'mmsi':mmsi},priority,timestamp=timestamp)
        self.__aisList[key]=existing
      else:
        if existing.priority > priority:
          AVNLog.debug("ignore ais for %s due to higher prio %d",mmsi,existing.priority)
          return
      for name,value in values.items():
        existing.add(name,value,timestamp=timestamp)
      self.__lastAisSource=source


  def getAisData(self, asDict=False):
    rt=[] if not asDict else {}
    keysToRemove=[]
    now=time.monotonic()
    self.__aisLock.acquire()
    try:
      for key in list(self.__aisList.keys()):
        aisEntry=self.__aisList[key]
        if self.__isAisExpired(aisEntry, now) or aisEntry.getMmsi() == self.__ownMMSI:
          keysToRemove.append(key)
        else:
          val=aisEntry.value.copy()
          val[self.AIS_AGE_KEY]=now-aisEntry.timestamp
          if asDict:
            rt[key] = val
          else:
            rt.append(val)
      for rkey in keysToRemove:
        del self.__aisList[rkey]
    except:
      AVNLog.error("error when reading AIS data %s",traceback.format_exc())
      self.__aisLock.release()
      raise
    self.__aisLock.release()
    return rt

  def getSingleValue(self,key,includeInfo=False):
    rt=None
    with self.__listLock:
      rt=self.__list.get(key)
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
      rt=self.getAisData(True)
      return rt
    prefix=prefix+"."
    plen=len(prefix)
    rt={}
    with self.__listLock:
      try:
        now=time.monotonic()
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
                nextV=current[keyparts[i]]
                if not type(nextV) == dict:
                  #AVNLog.error("inconsistent data , found normal value and dict with key %s"%(".".join(keyparts[0:i])))
                  current[keyparts[i]]={'value':nextV}
                  current=current[keyparts[i]]
                else:
                  current=nextV
              if type(current) == dict:
                current[keyparts[-1]]=entry.value
            else:
              rt[nkey]=entry.value
        for rkey in keysToRemove:
          del self.__list[rkey]
      except:
        AVNLog.error("error getting value with prefix %s: %s"%(prefix,traceback.format_exc()))
        raise
      return rt

  #delete all entries from the list (e.g. when we have to set the time)
  def reset(self):
      with self.__listLock:
          keysToRemove=[]
          for k,v in self.__list.items():
            if not v.keepAlways:
                keysToRemove.append(k)
          for k in keysToRemove:
            try:
                del self.__list[k]
            except:
                pass
          self.__aisList.clear()

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

  def isKeyRegistered(self,key,source=None):
    '''
    check if a key is registered
    @param key:
    @param source: if not None: only return True if registered by different source
    @return:
    '''
    try:
      self.__checkAlreadyExists(key)
    except:
      #we come here if it already exists
      if source is None:
        return True
      existingSource = self.__keySources.get(key)
      return existingSource != source
    return False

  def __checkAlreadyExists(self,key):
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

  def registerKey(self,key,keyDescription,source=None,allowOverwrite=False):
    """
    register a new key description
    raise an exception if there is already a key with the same name or a prefix of it
    @param key:
    @param keyDescription:
    @return:
    """
    self.__checkKey(key)
    if source is not None and self.__keySources.get(key) == source:
      AVNLog.ld("key re-registration - ignore - for %s, source %s",key,source)
      return
    if not allowOverwrite:
      self.__checkAlreadyExists(key)
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
