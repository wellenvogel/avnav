#convert a text file into a file with equal length lines
import sys
import os

def findLineLength(fname):
  fh=open(fname,"r")
  mlen=0
  numlines=0
  for line in fh:
    numlines=numlines+1
    if len(line)> mlen:
      mlen=len(line)
  fh.close()
  return (mlen,numlines)

def copyFile(inf,outf,len):
  fi=open(inf,"r")
  fo=open(outf,"wb")
  for line in fi:
    nl=line.strip('\n').ljust(len)
    fo.write(nl+'\n')
  fi.close()
  fo.close()
  
if len(sys.argv) != 2:
  print "usage: %s infile" %(sys.argv[0],)
  sys.exit(1)
if not os.path.exists(sys.argv[1]):
  print "%s does not exist" % (sys.argv[1],)
  sys.exit(1)
mlen,num=findLineLength(sys.argv[1])
print "Line length: %d(+1), num: %d" % (mlen,num)
ofn=sys.argv[1]+".fxl"
print "creating file %s" %(ofn,)
copyFile(sys.argv[1],ofn,mlen)
  
    