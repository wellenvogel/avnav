#testprog for serial reading

import serial
import sys
import time


def err(txt):
  print "ERROR: "+txt
  exit(1)
  
def sendSerial(file,numout,sleeptime,baudout=4800):
  firstTry=True
  fout=None
  f=None

  try:
    f=open(file,"r")
    fout=serial.Serial(numout,timeout=2,baudrate=baudout)
  except:
    print "Exception on opening: "+str(sys.exc_info()[0])
    err("unable to open port "+str(num))
    
  print "Port "+fout.name+" opened"
  while True:
    try:
      bytes=f.readline()
      if len(bytes)> 0:
        print bytes
        fout.write(bytes)
        time.sleep(sleeptime)
      else:
        raise "EOF on "+file
    except:
      print "Exception on r/w: "+str(sys.exc_info()[0])
        
  

if __name__ == "__main__":
  sendSerial(sys.argv[1],int(sys.argv[2]),float(sys.argv[3]),int(sys.argv[4]))  