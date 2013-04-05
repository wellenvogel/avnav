#testprog for serial reading

import serial
import sys
import time

TIMEOUT=30 #reopen after this time
def err(txt):
  print "ERROR: "+txt
  exit(1)
  
def readSerial(num):
  firstTry=True
  f=None
  while True:
    lastTime=time.time()
    try:
      f=serial.Serial(num,timeout=2)
    except:
      print "Exception on opening: "+str(sys.exc_info()[0])
      if firstTry:
        err("unable to open port "+str(num))
      else:
        print("unable to open port "+str(num))
        if f is not None:
          f.close()
        time.sleep(10)
        continue
    print "Port "+f.name+" opened"
    firstTry=False
    while True:
      try:
        bytes=f.readline()
        if len(bytes)> 0:
          print bytes
          lastTime=time.time()
      except:
        lastTime=0
      if (time.time() - lastTime) > TIMEOUT:
        f.close()
        print "Reopen port - timeout elapsed"
        break
        
  

if __name__ == "__main__":
  readSerial(int(sys.argv[1]))  