#! /usr/bin/env python
import sys
import os
import socket
import select
import re

class WpaControl():
  maxReceive=4096
  def __init__(self,wpaAddr,ownAddr):
    self.wpaAddr=wpaAddr
    self.ownAddr=ownAddr
    self.socket=None
  def __del__(self):
    if self.socket is not None:
      self.close()
  def checkWpa(self):
    return os.path.exists(self.wpaAddr)
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
  def close(self):
    self.checkOpen()
    self.socket.close()
    os.unlink(self.ownAddr)
  def receiveData(self):
    self.checkOpen()
    ready = select.select([self.socket], [], [], 2)
    if ready[0]:
      data = self.socket.recv(self.maxReceive)
      return data
    raise Exception("no response from %s in 2s"%(self.wpaAddr))
  def sendRequest(self,request):
    self.checkOpen()
    self.socket.send(request)

  def runSimpleScommand(self,command,upper=True):
    if upper:
      self.sendRequest(command.upper())
    else:
      self.sendRequest(command)
    rt=self.receiveData()
    if rt.strip() != "OK":
      raise Exception("command '%s' returned an error: %s"%(command,rt.strip()))
    return True

  def runFreeCommand(self,command):
    self.sendRequest(command)
    return self.receiveData()

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


  def startScan(self):
    self.runSimpleScommand("scan")
  def scanResults(self):
    data=self.runFreeCommand("SCAN_RESULTS")
    return self.tableToDict(data)
  def status(self):
    data=self.runFreeCommand("STATUS_VERBOSE")
    return self.linesToDict(data)
  def listNetworks(self):
    data=self.runFreeCommand("LIST_NETWORKS")
    return self.tableToDict(data)
  def addNetwork(self):
    data=self.runFreeCommand("ADD_NETWORK")
    if data.strip() == "FAIL":
      raise Exception("unable to add network: "+data.strip())
    return data.strip()
  '''configure a network (number as string), param being a dict
  '''
  def configureNetwork(self,id,param):
    for k in param.keys():
      self.runSimpleScommand("SET_NETWORK %s %s \"%s\""%(id,k,param[k]),False)
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
        break
    if id is None:
      id=self.addNetwork()
    else:
      self.disableNetwork(id)
    self.configureNetwork(id,param)
    self.enableNetwork(id)
    return id




if __name__=="__main__":
  print "starting... - wpa=%s,own=%s"%(sys.argv[1],sys.argv[2])
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
      print w.scanResults()
    if rq == "status":
      ok=True
      print w.status()
    if rq == "list_networks":
      ok=True
      print w.listNetworks()
    if rq == "add_network":
      ok=True
      print w.addNetwork()
    if rq== "configure_network":
      ok=True
      p={}
      for i in range(6,len(sys.argv)):
        (n,v)=sys.argv[i].split("=")
        print "param "+n+"="+v
        p[n]=v
      w.configureNetwork(sys.argv[5],p)
    if rq =="remove_network":
      ok=True
      w.removeNetwork(sys.argv[5])
    if rq== "connect":
      ok=True
      p={}
      for i in range(5,len(sys.argv)):
        (n,v)=sys.argv[i].split("=")
        print "param "+n+"="+v
        p[n]=v
      print w.connect(p)
    if ok:
      print "simple command %s ok"%(rq)
    else:
      raise Exception("unknown command "+rq)
  else:
    w.sendRequest(rq)
    rt=w.receiveData()
    print "received for %s:%s"%(sys.argv[3],rt)

