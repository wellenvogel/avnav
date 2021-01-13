#!/usr/bin/env python3

#testprog for serial writing

import serial
import sys
import time


def err(txt):
  print("ERROR: %s"%txt)
  sys.exit(1)
  
def sendSerial(file,port,sleeptime,baudout=4800):
  firstTry=True
  fout=None
  f=None
  try:
    port=int(port)
  except:
    pass  
  try:
    f=open(file,"rb")
    fout=serial.Serial(port,timeout=2,baudrate=baudout)
  except:
    print("Exception on opening: %s"%str(sys.exc_info()[0]))
    err("unable to open port %s"%str(port))
    
  print("Port %s opened"%fout.name)
  while True:
    try:
      bytes=f.readline()
      if len(bytes)> 0:
        print(bytes)
        fout.write(bytes)
        time.sleep(sleeptime)
      else:
        raise Exception("EOF on "+file)
    except:
      print("Exception on r/w: %s"%str(sys.exc_info()[0]))
        
  

if __name__ == "__main__":
  if len(sys.argv) < 4:
    print("usage: %s device|port filename sleeptime [baud]")
    sys.exit(1)
  baud=4800
  if len(sys.argv)> 4:
    baud=int(sys.argv[4])  
  sendSerial(sys.argv[2],sys.argv[1],float(sys.argv[3]),baud)  
