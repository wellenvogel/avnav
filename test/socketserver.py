#! /usr/bin/env python 
#testprog for serial reading

import sys
from threading import Thread
import time
import socket
import re


def err(txt):
  print "ERROR: "+txt
  exit(1)

class Reader:
  def __init__(self,sock):
    self.sock=sock
  def readfunction(self):
    print "reader started"
    while True:
      try:
        data=self.sock.recv(1)
        if data=='':
          raise "EOF"
      except:
        self.sock.shutdown(socket.SHUT_RDWR)
        print "reader stopped"
        return

def sendSock(file,sock,sleeptime):
  f=None
  try:
    f=open(file,"r")
  except:
    err("Exception on opening: "+str(sys.exc_info()[0]))
    
  print "start sending %s"%(file)
  sfail=0
  reader=Reader(sock)
  rthread=Thread(target=reader.readfunction)
  rthread.setDaemon(True)
  rthread.start()
  while True:
    lbytes=[]
    try:
      try:
        lbytes=f.readline()
        lbytes=re.sub('[\n\r]','',lbytes)
      except:
        print "Exception on r: "+str(sys.exc_info()[0])
      doSend=False
      try:
        if lbytes is not None and len(lbytes)> 0:
          doSend=True
      except:
        pass
      if doSend:
        try:
            print lbytes
            if sock.sendall(lbytes+"\r\n") is not None:
              raise "Exception in sendall"
            sfail=0
        except:
            print "Exception on send: "+str(sys.exc_info()[0])
            sfail+=1
            if sfail > 10:
                raise "Exception on write, error counter exceeded"
        time.sleep(sleeptime)
      else:
        raise "EOF on "+file
    except:
      print "Exception on r/w: "+str(sys.exc_info()[0])
      try:
        sock.close()
      except:
        pass
      break
        

def listen(port,sfile,sleeptime):
  listener=socket.socket()
  listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  listener.bind(("0.0.0.0",port))
  print "Listening at %s:%d"%listener.getsockname()
  listener.listen(1)
  while True:
    client=listener.accept()
    print "Client connected %s:%d"%client[0].getpeername()
    sendSock(sfile,client[0],sleeptime)
  

if __name__ == "__main__":
  listen(int(sys.argv[1]),sys.argv[2],float(sys.argv[3]))  
