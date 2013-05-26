#testprog for serial reading

import sys
import time
import socket
import re


def err(txt):
  print "ERROR: "+txt
  exit(1)
  
def sendSock(file,sock,sleeptime):
  f=None
  try:
    f=open(file,"r")
  except:
    err("Exception on opening: "+str(sys.exc_info()[0]))
    
  print "start sending %s"%(file)
  while True:
    try:
      lbytes=f.readline()
      lbytes=re.sub('[\n\r]','',lbytes)
      if len(lbytes)> 0:
        print lbytes
        sock.sendall(lbytes+"\r\n")
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