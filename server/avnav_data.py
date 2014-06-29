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
__author__="Andreas"
__date__ ="$29.06.2014 21:23:34$"

import json
import threading
import pprint
from avnav_util import *

#a data entry
#data is the decoded string
class AVNDataEntry():
  EMPTY_CLASS="EMPTY"
  #AIS messages we store
  knownAISTypes=(1,2,3,5,18,19,24)
  def __init__(self):
    self.key=self.createKey(self.EMPTY_CLASS,'')
    self.data={'class':self.EMPTY_CLASS,'time':None}
    self.timestamp=None
  
  #create a key from prefix and suffix
  @classmethod
  def createKey(cls,prefix,suffix):
    return prefix+"-"+suffix
    
  #create from the json decoded data
  #data must contain a class member and for TPV a type member
  @classmethod
  def fromData(cls,data):
    dcls=data.get('class');
    if dcls is None:
      AVNLog.debug("data %s does not contain a class - ignore",str(data))
      return None
    if dcls == 'TPV':
      tag=data.get('tag')
      if tag is None:
        AVNLog.debug("no tag for TPV in %s - ignore",str(data))
        return None
      rt=AVNDataEntry()
      rt.key=cls.createKey(dcls, tag)
      rt.data=data
      AVNLog.ld("data item created",rt)
      return rt
    if dcls == 'AIS':
      try:
        type=int(data.get('type'))
      except:
        AVNLog.ld("no type in AIS data",data)
        return None
      if not type in cls.knownAISTypes:
        AVNLog.debug("ignore type %d in AIS data %s",type,str(data))
        return None
      mmsi=data.get('mmsi')
      if mmsi is None:
        AVNLog.debug("AIS data without mmsi - ignore: %s",str(data))
        return None
      rt=AVNDataEntry()
      rt.key=cls.createKey(dcls, str(mmsi))
      rt.data=data
      AVNLog.ld("data item created",rt)
      return rt
        
    #we should not arrive here...
    AVNLog.debug("unknown class in %s - ignore",str(data))
    return None
    
  
  #decode from json
  @classmethod
  def fromJson(cls,jsondata):
    data=None
    try:
      data=json.loads(jsondata)
    except:
      AVNLog.debug("unable to parse json data %s : %s",jsondata,traceback.format_exc())
      return None
    return cls.fromData(data)
  
  def __str__(self):
    rt="AVNDataEntry: %s(ts=%f)=%s" % (self.key,(self.timestamp if self.timestamp is not None else 0),pprint.pformat(self.data))
    return rt
  def toJson(self):
    return json.dumps(self.data)
  

#the main List of navigational items received
class AVNNavData():
  #fields we merge
  ais5mergeFields=['imo_id','callsign','shipname','shiptype','destination']
  def __init__(self,expiryTime,aisExpiryTime,ownMMSI):
    self.list={}
    self.listLock=threading.Lock()
    self.expiryTime=expiryTime
    self.aisExpiryTime=aisExpiryTime
    self.ownMMSI=ownMMSI
  
  #add an entry to the list
  #do not add if there is already such an entry with newer timestamp
  #timestamps always relate to our system time - never directly to the GPS time!
  #this avoids confusion when we have to change the system time...
  #this is always done by the main thread!
  def addEntry(self,navEntry):
    if navEntry.timestamp is None:
      navEntry.timestamp=AVNUtil.utcnow()
    AVNLog.ld("AVNNavData add entry",navEntry)
    if navEntry.data['class'] == 'AIS':
      if self.ownMMSI != '' and self.ownMMSI == navEntry.data['mmsi']:
          AVNLog.debug("omitting own AIS message mmsi %s",self.ownMMSI)
          return
    self.listLock.acquire()
    if navEntry.key in self.list:
      #for AIS type 5/24 messages we merge them with an existing message
      #for others we merge back...
      if navEntry.data['class'] == 'AIS':
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
        self.listLock.release()
        x=navEntry.key
        return
      else:
        if self.list[navEntry.key].timestamp > navEntry.timestamp:
          AVNLog.debug("not adding entry, older ts %s",str(navEntry))
          self.listLock.release()
          return
    self.list[navEntry.key]=navEntry
    
    AVNLog.debug("adding entry %s",str(navEntry))
    self.listLock.release()
  #check for an entry being expired
  #the list must already being locked!
  #returns the entry or None
  def __checkExpired__(self,entry,key):
    et=AVNUtil.utcnow()-self.expiryTime
    if entry.data['class']=='AIS':
      et=AVNUtil.utcnow()-self.aisExpiryTime
    if entry.timestamp < et:
      AVNLog.debug("remove expired entry %s, et=%s ",str(entry),str(et))
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
      searchprefix=AVNDataEntry.createKey(prefix,'')
      prfxlen=len(searchprefix)
      self.listLock.acquire();
      for k in self.list.keys():
        e=self.list[k]
        if e.key[0:prfxlen]==searchprefix:
          rt[e.key]=e
      nrt={}
      for k in rt.keys():
        e=self.__checkExpired__(rt[k], k)
        if e is not None:
          nrt[k]=e
      self.listLock.release()
      return nrt
    for sfx in suffixlist:
      k=AVNDataEntry.createKey(prefix, sfx)
      entry=self.list.get(k)
      if entry is not None:
        rt[k]=entry
    return rt
  def getFilteredEntriesAsJson(self,prefix,suffixlist):
    rt=[]
    for e in self.getFilteredEntries(prefix, suffixlist).values():
      rt.append(e.data)
    AVNLog.ld("collected entries",rt)
    return json.dumps(rt)
  
  def getMergedEntries(self,prefix,suffixlist):
    fe=self.getFilteredEntries(prefix, suffixlist)
    rt=AVNDataEntry()
    rt.key=rt.createKey(prefix, '')
    for kf in fe:
      e=fe[kf]
      if rt.timestamp is None:
        rt.timestamp=e.timestamp
      newer=False
      if e.timestamp > rt.timestamp:
        newer=True
      k='class'
      if not k in rt.data or rt.data[k] == rt.EMPTY_CLASS:
        rt.data[k]=e.data[k]
      if e.data[k] != rt.data[k] and rt.data[k] != rt.EMPTY_CLASS:
        AVNLog.debug("mixing different classes in merge, ignore %s",str(e))
        continue
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
        
  
  def __str__(self):
    rt="AVNNavData \n";
    idx=0
    self.listLock.acquire()
    for k in self.list.keys():
      rt+="   (%03d:%s)%s=%s\n" % (idx,time.strftime("%Y/%m/%d-%H:%M:%S ",time.gmtime(self.list[k].timestamp)),self.list[k].key,self.list[k].data)
    self.listLock.release()  
    return rt
