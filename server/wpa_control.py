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

import sys
import os
import socket
import select
import re
import threading
import datetime

class CacheEntry(object):
  #age in seconds
  age=2000
  def __init__(self,key,data):
    self.key=key
    self.data=data
    self.time=datetime.datetime.utcnow() #info only
    self.pending=self.time #started last update
  #return the cached value if still valid
  #otherwise return None and set the pending flag
  def getValue(self):
    now=datetime.datetime.utcnow()
    if now >= self.pending+datetime.timedelta(milliseconds=self.age):
      #retry the query every 2*age
      self.pending=now
      return None
    return self.data
  def setValue(self,data):
    self.time=datetime.datetime.utcnow()
    self.data=data
    self.pending=self.time

class WpaControl(object):
  maxReceive=4096
  def __init__(self,wpaAddr,ownAddr):
    self.wpaAddr=wpaAddr
    self.ownAddr=ownAddr
    self.socket=None
    self.lock=threading.Lock()
    self.cacheLock=threading.Lock()
    #a dict of CacheEntry
    self.cache={}
  def __del__(self):
    if self.socket is not None:
      self.close()
  def checkWpa(self):
    return os.path.exists(self.wpaAddr)
  #open - not thread safe
  def open(self):
    if not self.checkWpa():
      raise Exception("wpa control socket %s does not exist"%(self.wpaAddr))
    if os.path.exists(self.ownAddr):
      os.unlink(self.ownAddr)
    self.socket=socket.socket(socket.AF_UNIX,socket.SOCK_DGRAM)
    self.socket.bind(self.ownAddr)
    self.socket.connect(self.wpaAddr)
    self.socket.setblocking(0)
    return socket
  def checkOpen(self):
    if self.socket is None:
      raise Exception("socket to %s not open"%(self.wpaAddr))
  def close(self, throw=True):
    if throw:
      self.checkOpen()
    else:
      if self.socket is None:
        return
    try:
      self.socket.shutdown(socket.SHUT_RDWR)
      self.socket.close()
    except:
      pass
    try:
      os.unlink(self.ownAddr)
    except:
      pass
    self.socket=None
  def receiveData(self):
    self.checkOpen()
    ready = select.select([self.socket], [], [], 2)
    if ready[0]:
      data = self.socket.recv(self.maxReceive)
      return data.decode('utf-8')
    self.close(False)
    raise Exception("no response from %s in 2s"%(self.wpaAddr))
  def sendRequest(self,request):
    self.checkOpen()
    try:
      self.socket.send(request.encode('utf-8'))
    except:
      self.close(False)
      raise

  def runSimpleScommand(self,command,upper=True):
    rt=None
    if upper:
      rt=self.runFreeCommand(command.upper())
    else:
      rt=self.runFreeCommand(command)
    if rt.strip() != "OK":
      raise Exception("command '%s' returned an error: %s"%(command,rt.strip()))
    return True

  def runFreeCommand(self,command):
    self.lock.acquire()
    rt=None
    try:
      self.sendRequest(command)
      rt=self.receiveData()
    except:
      self.lock.release()
      raise
    self.lock.release()
    return rt
  '''get a cached value
     if None is returned really start the operation
     and store the cached value later'''
  def getCachedValue(self,key):
    self.cacheLock.acquire()
    rt=self.cache.get(key)
    if rt is None:
      ne=CacheEntry(key,[])
      self.cache[key]=ne
    else:
      rt=rt.getValue()
    self.cacheLock.release()
    return rt

  def cacheValue(self,key,data):
    self.cacheLock.acquire()
    ce=self.cache.get(key)
    if ce is None:
      ce=CacheEntry(key,data)
      self.cache[key]=ce
    else:
      ce.setValue(data)
    self.cacheLock.release()

  ''' convert some response that contains a table
      into an arry of dict
      e.g. scan_result
      '''
  def tableToDict(self,table):
    if not type(table) is list:
      table=table.splitlines()
    rt=[]
    if len(table) == 0:
      return rt
    headings=re.split(" */ *",table[0])
    for i in range(1,len(table)):
      val=table[i]
      lvalues=val.split("\t")
      ldict={}
      for j in range(0,len(lvalues)):
        ldict[headings[j]]=lvalues[j]
      rt.append(ldict)
    return rt
  ''' convert a response that has name=value pairs into a dict
  '''
  def linesToDict(self,data):
    if not type(data) is list:
      data=data.splitlines()
    rt={}
    for l in data:
      (n,v)=re.split(" *= *",l,1)
      if n is not None and v is not None:
        rt[n]=v.strip()
    return rt

  '''run a command that returns some data
     with caching'''
  def commandWithCache(self,command,cache_key=None):
    if cache_key is None:
      cache_key=command
    data=self.getCachedValue(cache_key)
    if data is None:
      data=self.runFreeCommand(command)
      self.cacheValue(cache_key,data)
    return data

  def startScan(self):
    self.runSimpleScommand("scan")
  def scanResults(self):
    data=self.commandWithCache("SCAN_RESULTS")
    return self.tableToDict(data)
  def status(self):
    data=self.commandWithCache("STATUS_VERBOSE")
    return self.linesToDict(data)
  def saveConfig(self):
    self.runSimpleScommand("SAVE_CONFIG")
    return True
  def listNetworks(self):
    data=self.commandWithCache("LIST_NETWORKS")
    rt=self.tableToDict(data)
    for net in rt:
      id=net.get('network id')
      try:
        if id is not None:
          id_str=self.commandWithCache("GET_NETWORK %s id_str"%(id))
          if id_str is not None:
            id_str=id_str.rstrip()
            if id_str != 'FAIL':
              net['id_str']=id_str.replace('"','')
      except:
        pass
    return rt
  def addNetwork(self):
    data=self.runFreeCommand("ADD_NETWORK")
    if data.strip() == "FAIL":
      raise Exception("unable to add network: "+data.strip())
    return data.strip()
  '''configure a network (number as string), param being a dict
  '''
  unquotedParam=['key_mgmt']
  def configureNetwork(self,id,param):
    for k in list(param.keys()):
      if param[k] is not None:
        if not k in self.unquotedParam:
          self.runSimpleScommand("SET_NETWORK %s %s \"%s\""%(id,k,param[k]),False)
        else:
          self.runSimpleScommand("SET_NETWORK %s %s %s" % (id, k, param[k]), False)
    return id
  def enableNetwork(self,id):
    self.runSimpleScommand("ENABLE_NETWORK %s"%(id),False)
    return id
  def disableNetwork(self,id):
    self.runSimpleScommand("DISABLE_NETWORK %s"%(id),False)
    return id
  def removeNetwork(self,id):
    self.runSimpleScommand("REMOVE_NETWORK %s"%(id),False)
    return id
  def getIdFromSsid(self,ssid):
    known=self.getKnownSsids()
    id=known.get(ssid)
    if id is None:
      raise Exception("ssid %s is not known"%(ssid))
    return id.get('network id')
  def enableNetworkSsid(self,ssid):
    self.enableNetwork(self.getIdFromSsid(ssid))
  def disableNetworkSsid(self,ssid):
    self.disableNetwork(self.getIdFromSsid(ssid))
  def removeNetworkSsid(self,ssid):
    self.removeNetwork(self.getIdFromSsid(ssid))

  ''' add a new network, set the parameter and enable it
      if a network with the same ssid already exists reconfigure this one
  '''
  def connect(self,param):
    if param.get('ssid') is None:
      raise Exception("missing parameter ssid for connect")
    ssid=param.get('ssid')
    availableNetworks=self.listNetworks()
    id=None
    for nw in availableNetworks:
      if nw.get('ssid') is not None and nw.get('ssid') == ssid:
        id=nw.get('network id')
      else:
        flags=nw.get('flags')
        if flags.find("CURRENT") >= 0:
          #disable any previously used network
          self.disableNetwork(nw.get('network id'))
    newnet=False
    if id is None:
      id=self.addNetwork()
      newnet=True
    else:
      self.disableNetwork(id)
    try:
      self.configureNetwork(id,param)
      self.enableNetwork(id)
    except Exception as e:
      if newnet:
        self.removeNetwork(id)
      raise
    return id
  ''' get a dict of known ssids, param being the network id
  '''
  def getKnownSsids(self):
    known=self.listNetworks()
    knownIds={}
    for k in known:
      ssid=k.get('ssid')
      id=k.get('network id')
      if ssid is not None and id is not None:
        knownIds[ssid]=k
    return knownIds
  ''' provide scan results with an info whether a network (based on ssid) is known
      in this case the network id will be set
  '''
  def scanResultWithInfo(self):
    known=self.getKnownSsids()
    sawIds={}
    scans=self.scanResults()
    for scan in scans:
      ssid=scan.get('ssid')
      if ssid is not None:
        sawIds[ssid]=True
        id=known.get(ssid)
        if id is not None:
          self.updateEntryFromNetwork(scan,id)
        else:
          scan['is known']=False
    for k in known:
      if k not in sawIds:
        scans.append(self.updateEntryFromNetwork({'ssid':k,'signal level':'-1'},known[k]))
    return scans

  def updateEntryFromNetwork(self,scan,id):
    scan['network id']=id.get('network id')
    scan['is known']=True
    scan['network flags']=id.get('flags')
    scan['id_str']=id.get('id_str')
    return scan




def isInt(st):
  try:
    v=int(st)
    return True
  except:
    return False

if __name__=="__main__":
  print("starting... - wpa=%s,own=%s"%(sys.argv[1],sys.argv[2]))
  w=WpaControl(sys.argv[1],sys.argv[2])
  w.open()
  mode=sys.argv[3]
  rq=sys.argv[4]
  if mode == "simple":
    ok=False
    if rq == "scan":
      ok=True
      w.startScan()
    if rq == "scan_results":
      ok=True
      print(w.scanResults())
    if rq=="scan_info":
      ok=True
      print(w.scanResultWithInfo())
    if rq == "status":
      ok=True
      print(w.status())
    if rq == "save":
      ok=True
      w.saveConfig()
    if rq == "list_networks":
      ok=True
      print(w.listNetworks())
    if rq == "add_network":
      ok=True
      print(w.addNetwork())
    if rq== "configure_network":
      ok=True
      p={}
      for i in range(6,len(sys.argv)):
        (n,v)=sys.argv[i].split("=")
        print("param "+n+"="+v)
        p[n]=v
      w.configureNetwork(sys.argv[5],p)
    if rq =="remove_network":
      ok=True
      if (isInt(sys.argv[5])):
        w.removeNetwork(sys.argv[5])
      else:
        w.removeNetworkSsid(sys.argv[5])
    if rq =="disable_network":
      ok=True
      if (isInt(sys.argv[5])):
        w.disableNetwork(sys.argv[5])
      else:
        w.disableNetworkSsid(sys.argv[5])
    if rq =="enable_network":
      ok=True
      if (isInt(sys.argv[5])):
        w.enableNetwork(sys.argv[5])
      else:
        w.enableNetworkSsid(sys.argv[5])
    if rq== "connect":
      ok=True
      p={}
      for i in range(5,len(sys.argv)):
        (n,v)=sys.argv[i].split("=")
        print("param "+n+"="+v)
        p[n]=v
      print(w.connect(p))
    if ok:
      print("simple command %s ok"%(rq))
    else:
      raise Exception("unknown command "+rq)
  else:
    w.sendRequest(rq)
    rt=w.receiveData()
    print("received for %s:%s"%(sys.argv[3],rt))

