#! /usr/bin/env python3
#serve a file with lines on a socket with sleep between lines

import sys
import threading
from threading import Thread
import time
import socket
import re
import traceback


def err(txt):
  print("ERROR: %s"%txt)
  sys.exit(1)

class Reader:
  def __init__(self,sock):
    self.sock=sock
  def readfunction(self):
    print("reader started")
    while True:
      try:
        data=self.sock.recv(1)
        if data==b'':
          raise Exception("EOF")
      except:
        print("reader stopped")
        return

def sendSock(file,sock,sleeptime,rmcMode):
  f=None
  try:
    f=open(file,"rb")
  except:
    err("Exception on opening: "+traceback.format_exc())
    
  print("start sending %s"%(file))
  sfail=0
  reader=Reader(sock)
  rthread=Thread(target=reader.readfunction)
  rthread.setDaemon(True)
  rthread.start()
  lastSent=None
  lastTs=None
  while True:
    lbytes=[]
    try:
      try:
        lbytes=f.readline()
      except:
        print("Exception on r: "+traceback.format_exc())
        f=open(file,"rb")
        print("reopen file")
      doSend=False
      try:
        if lbytes is not None and len(lbytes)> 0:
          doSend=True
      except:
        pass
      if doSend:
        try:
            print(re.sub(b'[\n\r]',b'',lbytes))
            if sock.sendall(lbytes) is not None:
              raise Exception("Exception in sendall")
            sfail=0
        except:
            print("Exception on send: "+traceback.format_exc())
            sfail+=1
            if sfail > 10:
                raise Exception("Exception on write, error counter exceeded")
        if rmcMode:
          if len(lbytes) > 6 and lbytes[3:6] == b'RMC':
            ts=0
            fields=lbytes.split(b',')
            if len(fields) >= 2:
              tstr=fields[1][0:6]
              if len(tstr) != 6:
                print("unexpected ts %s"%tstr)
              else:
                try:
                  ts=int(tstr[0:2])*3600+int(tstr[2:4])*60+int(tstr[4:6])
                except:
                  ts=0
              if ts == 0 and lastTs is not None:
                ts=lastTs+sleeptime
              now=time.time()
              if lastSent is not None and lastTs is not None:
                diff=ts-lastTs
                #print("###diff: %f"%diff)
                if diff > 0:
                  nextSend=lastSent+diff
                  if now < nextSend:
                    wt=nextSend-now
                    if wt > 10:
                      print("##wait expected %d, used 10"%wt)
                      wt=10
                    time.sleep(wt)
              lastSent=now
              lastTs=ts
        else:
          time.sleep(sleeptime)
      else:
        raise Exception("EOF on "+file)
    except:
      print("Exception on r/w: "+traceback.format_exc())
      try:
        sock.shutdown(socket.SHUT_RDWR)
        sock.close()
      except Exception as e:
        print("close Exception: %s"%str(e))
        pass
      break
        

def listen(port,sfile,sleeptime,rmcMode=False):
  if rmcMode:
    print("Running in RMC mode")
  listener=socket.socket()
  listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  listener.bind(("0.0.0.0",port))
  print("Listening at %s:%d"%listener.getsockname())
  listener.listen(1)
  while True:
    client=listener.accept()
    print("Client connected %s:%d"%client[0].getpeername())
    writer=threading.Thread(target=sendSock,args=(sfile,client[0],sleeptime,rmcMode))
    writer.setDaemon(True)
    writer.start()
    #sendSock(sfile,client[0],sleeptime)
  

if __name__ == "__main__":
  start=1
  rmcMode=False
  while start < len(sys.argv) and sys.argv[start][0] == '-':
    if sys.argv[start] == '-r':
      rmcMode=True
    else:
      print("invalid option %s"%sys.argv[start],file=sys.stderr)
      sys.exit(1)
    start+=1
  listen(int(sys.argv[start]),sys.argv[start+1],float(sys.argv[start+2]),rmcMode=rmcMode)
