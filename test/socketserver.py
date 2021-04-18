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

def sendSock(file,sock,sleeptime):
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
        

def listen(port,sfile,sleeptime):
  listener=socket.socket()
  listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
  listener.bind(("0.0.0.0",port))
  print("Listening at %s:%d"%listener.getsockname())
  listener.listen(1)
  while True:
    client=listener.accept()
    print("Client connected %s:%d"%client[0].getpeername())
    writer=threading.Thread(target=sendSock,args=(sfile,client[0],sleeptime))
    writer.setDaemon(True)
    writer.start()
    #sendSock(sfile,client[0],sleeptime)
  

if __name__ == "__main__":
  listen(int(sys.argv[1]),sys.argv[2],float(sys.argv[3]))  
