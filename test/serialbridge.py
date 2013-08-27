#testprog for serial reading

import serial
import sys
import time

TIMEOUT=30 #reopen after this time
def err(txt):
  print "ERROR: "+txt
  exit(1)
  
def readSerial(num,numout,baud=4800,baudout=4800):
  firstTry=True
  f=None
  fout=None
  
  while True:
    lastTime=time.time()
    try:
      f=serial.Serial(num,timeout=2,baudrate=baud)
      fout=serial.Serial(numout,timeout=2,baudrate=baudout)
    except:
      print "Exception on opening: "+str(sys.exc_info()[0])
      if firstTry:
        err("unable to open port "+str(num))
      else:
        print("unable to open port "+str(num))
        if f is not None:
          f.close()
        if fout is not None:
          fout.close()
        time.sleep(10)
        continue
    print "Port "+f.name+", "+fout.name+" opened"
    firstTry=False
    while True:
      try:
        bytes=f.readline()
        if len(bytes)> 0:
          print bytes
          fout.write(bytes)
          lastTime=time.time()
      except:
        print "Exception on r/w: "+str(sys.exc_info()[0])
        lastTime=0
      if (time.time() - lastTime) > TIMEOUT:
        f.close()
        fout.close()
        print "Reopen port - timeout elapsed"
        break
        
  

if __name__ == "__main__":
  readSerial(int(sys.argv[1]),int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4]))  