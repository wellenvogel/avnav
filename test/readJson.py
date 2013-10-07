#a script to read out our json data
#and write them to a file
#readJson.py url interval filebase
#will write to the file:
#timestamp jsonData
#filenames: filebase-xxx.tst
#xxx - gps,ais,trk

import os
import sys
import time
import urllib2

types={
       'gps':('request=gps',1),
       'ais':('request=ais',10),
       'trk':('request=track',10)}

files={}
namebase="json"
count=0

def log(txt):
  print "log:%s" %(txt,)

def appendDataToFile(data,file):
  fh=files.get(file)
  if fh is None:
    fname=namebase+"-"+file+".tst"
    fh=open(fname,"w")
    files[file]=fh
    log("opened file "+fname)
  ts=int(round(time.time()))
  line="%d %s\n"%(ts,data)
  fh.write(line)
  fh.flush()

def getJson(url):
  h=urllib2.urlopen(url)
  data=h.read()
  return data
  
  
def getAll(urlbase):
  global count
  count=count+1
  for type in types.keys():
    ext=types[type][0]
    iv=types[type][1]
    if ( count % iv) == 0:
      url=urlbase+"?"+ext
      data=getJson(url)
      appendDataToFile(data, type)
  

def run(url,interval):
  if interval is 0:
    interval=1
  while True:
    getAll(url)
    time.sleep(interval)

if __name__ == "__main__":
  if len(sys.argv) < 3:
    print "usage: %s url interval" % (sys.argv[0],)
    sys.exit(1)
  if len(sys.argv) > 3 and sys.argv[3] is not None:
    namebase=sys.argv[3]
  run(sys.argv[1],int(sys.argv[2] or 0))
    