#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#
#  Permission is hereby granted, free of charge, to any person obtaining a
#  copy of this software and associated documentation files (the "Software"),
#  to deal in the Software without restriction, including without limitation
#  the rights to use, copy, modify, merge, publish, distribute, sublicense,
#  and/or sell copies of the Software, and to permit persons to whom the
#  Software is furnished to do so, subject to the following conditions:
#
#  The above copyright notice and this permission notice shall be included
#  in all copies or substantial portions of the Software.
#
#  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
#  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
#  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################

import time
import subprocess
import threading
import os
import datetime
import glob
import sys
import traceback
import gzip

from avnav_util import *
from avnav_worker import *
from avnav_nmea import *
from avnav_trackwriter import *

#a writer for our track
class AVNNmeaLogger(AVNWorker):
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.trackdir=None
  @classmethod
  def getConfigName(cls):
    return "AVNNmeaLogger"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'trackdir':"", #defaults to dir of trackwriter
            'feederName':'',  #if set, use this feeder
            'maxfiles':"100", #max number of log files
            'filter':"$RMC,$DBT,$DBP", #nmea output filter
            'interval':'5' #interval in seconds

    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNNmeaLogger(cfgparam)
  def getName(self):
    return "NmeaLogger"
  #write out the line
  #timestamp is a datetime object
  def writeLine(self,filehandle,data):
    filehandle.write(data)
    filehandle.flush()
  def createFileName(self,dt):
    str=unicode(dt.strftime("%Y-%m-%d")+".nmea")
    return str
    
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    trackdir=self.getStringParam("trackdir")
    filterstr=self.getStringParam("filter")
    if filterstr is None or filterstr == "":
      AVNLog.warn("no filter for NMEA logger, exiting logger")
      return
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam("feederName") or "")
    self.feeder=feeder
    filter=filterstr.split(",")
    if trackdir == "":
      trackwriter=self.findHandlerByName(AVNTrackWriter.getConfigName())
      if trackwriter is not None:
        trackdir=trackwriter.getTrackDir()
      if trackdir is None or trackdir == "":
        trackdir=unicode(os.path.join(os.path.dirname(sys.argv[0]),'tracks'))
    else:
      trackdir=os.path.expanduser(trackdir)
    self.trackdir=trackdir
    interval=self.getIntParam('interval')
    maxfiles=100
    try:
      mf=self.getIntParam('maxfiles')
      if mf > 0:
        maxfiles=mf
    except:
      pass
    self.maxfiles=maxfiles
    AVNLog.info("starting logger with maxfiles = %d, filter=%s, interval=%ds",maxfiles,filterstr,interval)
    fname=None
    f=None
    lastcleanup=None
    seq=0
    last={}
    initial=True
    while True:
      currentTime=datetime.datetime.utcnow()
      try:
        if not os.path.isdir(self.trackdir):
          os.makedirs(self.trackdir, 0775)
        curfname=os.path.join(self.trackdir,self.createFileName(currentTime))
        #we have to consider time shift backward
        if lastcleanup is None or (currentTime > lastcleanup+datetime.timedelta(seconds=60)) or (currentTime < lastcleanup-datetime.timedelta(seconds=5)):
          self.cleanup(curfname)
          lastcleanup=currentTime
          #force reopen file
          fname=None
        if not curfname == fname:
          if fname is not None or initial:
            AVNLog.info("new nmea logfile %s",curfname)
          initial=False
          fname=curfname
          if not f is None:
            f.close()
          newFile=True
          last={}
        if newFile:
          zfname=curfname+".gz"
          f=open(curfname,"a")
          if os.path.isfile(zfname):
            #we must uncompress first
            AVNLog.info("decompressing existing nmea log %s",zfname)
            try:
              zf=gzip.open(zfname,"rb")
              while True:
                buf=zf.read(100000)
                if buf is None or len(buf) == 0:
                  break
                f.write(buf)
              zf.close()
            except:
              AVNLog.error("unable to read old compressed log %s: %s",zfname,traceback.format_exc())
            try:
              os.unlink(zfname)
            except:
              pass
          newFile=False
          self.setInfo('main', "writing to %s"%(curfname,), AVNWorker.Status.NMEA)
        seq,data=self.feeder.fetchFromHistory(seq,10)
        if len(data)>0:
          for line in data:
            if NMEAParser.checkFilter(line, filter):
              now=datetime.datetime.utcnow()
              key=line[0:6]
              prev=last.get(key)
              if prev is not None:
                diff=now-prev
                if diff.seconds < interval:
                  continue
              last[key]=now
              self.writeLine(f,line)
        else:
          time.sleep(0.1)
      except Exception as e:
        AVNLog.error("exception in nmea logger: %s",traceback.format_exc());
        time.sleep(1)

  def cleanup(self,currentname):
    currentTime=datetime.datetime.utcnow()
    files=[]
    for f in os.listdir(self.trackdir):
      if not f.endswith(".nmea") and not f.endswith(".nmea.gz"):
        continue
      path=os.path.join(self.trackdir,f)
      if not os.path.isfile(path):
        continue
      files.append(path)
      if path == currentname:
        continue
      if path.endswith(".nmea"):
        AVNLog.info("compressing nmea log %s",path)
        zfname=path+".gz"
        try:
          lf=open(path,"rb")
          zf=gzip.open(zfname,"wb")
          while True:
            buf=lf.read(100000)
            if buf is None or len(buf) == 0:
              break
            zf.write(buf)
          zf.close()
          lf.close()
          os.unlink(path)
        except:
          AVNLog.error("exception while compressing log file %s: %s",path,traceback.format_exc())
    AVNLog.debug("cleanup, found %d files",len(files))
    if len(files) > self.maxfiles:
      files.sort(key=lambda x: os.path.getmtime(x))
      todelete=files[0:len(files)-self.maxfiles]
      for tdel in todelete:
        AVNLog.info("cleanup, deleting nmea log %s",tdel)
        try:
          os.unlink(tdel)
        except:
          AVNLog.error("unable to delete file %s: %s",tdel, traceback.format_exc())

      

