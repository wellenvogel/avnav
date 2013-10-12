#! /usr/bin/env python 
#testprog for serial reading

import sys
import time
import socket
import re
from test.test_traceback import TracebackCases
import traceback
sys.path.append("../server")
from avnav_server import  *

MAXBUFFER=200

class Ndata:
  def __init__(self):
    self.entry=None
    pass
  def addEntry(self,entry):
    self.entry=entry

def err(txt):
  print "ERROR: "+txt
  exit(1)
  
 
#ratio describes how many times faster we go (i.e. ratio=2 means 2 gps seconds in one second)  
def sendSock(file,sock,ratio):
  f=None
  try:
    f=open(file,"r")
  except:
    err("Exception on opening: "+str(sys.exc_info()[0]))
  navdata=Ndata()
  parser=NMEAParser(navdata)  
  print "start sending %s"%(file)
  curtime=None
  lasttime=None
  lastwrite=None
  buffer=[]
  while True:
    hasTimestamp=False
    try:
      lbytes=f.readline()
      if len(lbytes) <= 0:
        raise "EOF"
      lbytes=re.sub('[\n\r]','',lbytes)
      try:
        if lbytes[0:1] == "$":
          navdata.entry=None
          data=parser.parseData(lbytes)
          if navdata.entry is not None:
            ntime=navdata.entry.data.get('time')
            if ntime is not None:
              curtime=AVNUtil.gt(ntime)
              hasTimestamp=True
      except:
        print "Exception in data decode %s"%(traceback.format_exc(),)
        pass
      buffer.append(lbytes)
      if not hasTimestamp:
        if len(buffer) >= MAXBUFFER:
          print "buffer overflow - dropping %d lines\n" % (len(buffer),)
          buffer=[]
        continue
      #if we have a new time set, check if can already write - otherwise wait
      waittime=0
      if lasttime is not None:
        doWait=True
        while doWait:
          gpsdiff=curtime-lasttime
          realdiff=((datetime.datetime.utcnow()-lastwrite) if lastwrite is not None else datetime.timedelta()) 
          if gpsdiff  >(realdiff*ratio):
            time.sleep(0.1)
            continue
          doWait=False
      #now write out what we have
      lasttime=curtime
      for bline in buffer:
        print bline
        sock.sendall(bline+"\r\n")
      buffer=[]
      lastwrite=datetime.datetime.utcnow()
    except:
      print "Exception on r/w: %s" %(traceback.format_exc(),)
      try:
        sock.close()
      except:
        pass
      break
        

def listen(port,sfile,ratio):
  listener=socket.socket()
  listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  listener.bind(("0.0.0.0",port))
  print "Listening at %s:%d"%listener.getsockname()
  listener.listen(1)
  while True:
    client=listener.accept()
    print "Client connected %s:%d"%client[0].getpeername()
    sendSock(sfile,client[0],ratio)
  

if __name__ == "__main__":
  if len(sys.argv) < 3:
    print "usage %s: port file [ratio]" %(sys.argv[0],)
    sys.exit(1)
  if len(sys.argv) > 3:
    listen(int(sys.argv[1]),sys.argv[2],int(sys.argv[3]))
  else:
    listen(int(sys.argv[1]),sys.argv[2],1)  
