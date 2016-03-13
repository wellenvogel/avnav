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

  def runSimpleScommand(self,command):
    self.sendRequest(command.upper())
    rt=self.receiveData()
    if rt.strip() != "OK":
      raise Exception("command %s returned an error: %s"%(command,rt.strip()))
    return True

  def runFreeCommand(self,command):
    self.sendRequest(command)
    return self.receiveData()

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



  def startScan(self):
    self.runSimpleScommand("scan")
  def scanResults(self):
    data=self.runFreeCommand("SCAN_RESULTS")
    return self.tableToDict(data)






if __name__=="__main__":
  print "starting... - wpa=%s,own=%s"%(sys.argv[1],sys.argv[2])
  w=WpaControl(sys.argv[1],sys.argv[2])
  w.open()
  mode=sys.argv[3]
  rq=sys.argv[4]
  if mode == "simple":
    if rq == "scan":
      w.startScan()
    if rq == "scan_results":
      print w.scanResults()
    print "simple command %s ok"%(rq)
  else:
    w.sendRequest(rq)
    rt=w.receiveData()
    print "received for %s:%s"%(sys.argv[3],rt)

