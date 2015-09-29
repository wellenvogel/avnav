#!/usr/bin/env python
__author__ = 'andreas'

import sys
import subprocess
import datetime

def getTs():
  return datetime.datetime.now().strftime('%Y/%m/%d-%H:%M:%S')

assert len(sys.argv)>2,"invalid call"
logname=sys.argv[1]
logfile=open(logname,"w")
if logfile is None:
  raise Exception("unable to open logile "+logname)
args=[sys.executable,"-u"]+sys.argv[2:]
proc=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
print "##RUN: started"
logfile.write(getTs()+": started with args "+" ".join(args)+"\n")
for line in proc.stdout:
  sys.stdout.write("##LOG("+getTs()+"): "+line)
  sys.stdout.flush()
  logfile.write(getTs()+": "+line)
  logfile.flush()
