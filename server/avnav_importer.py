#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2015 Andreas Vogel andreas@wellenvogel.net
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
###############################################################################
import os

import time
import traceback
from avnav_httpserver import AVNHTTPServer
from avnav_util import *
from avnav_worker import *


#a converter to read our known chart formats and convert them to gemf
#charts are read from the .../data/import directory
#currently supported:
#    xxx.mbtiles - directly in the import directory - will be converted to xxx.gemf
#    yyy         - subdirectory below import - will use our chartconvert and will be converted to yyy.gemf
# when deleting files via the gui corresponding files at import are deleted too
# intermediate files are written to the ...import/yyy/work directory
class AVNImporter(AVNWorker):
  
  @classmethod
  def getConfigName(cls):
    return "AVNImporter"
  
  @classmethod
  def getConfigParam(cls,child):
    if not child is None:
      return None
    rt={

      'importDir':'import', #directory below our data dir
      'workDir': 'work',    #directory in each xxx subdirectory
      'waittime': 30,       #time to wait in seconds before a conversion is started after detecting a change (and no further change)
      'knowExtensions': 'kap' #extensions for gdal conversion
    }
    return rt
  @classmethod
  def createInstance(cls, cfgparam):
    rt=AVNImporter(cfgparam)
    return rt
    
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.importDir=None
    self.lastTimeStamps={}    #a dictionary of timestamps - key is the directory/filename, value the last read timestamp
    self.candidateTimes={}    #dictionary with candidates for conversion - same layout as lastTimeStamps
    self.runningConversions={} #dictionary of current running conversions (key is the filename/dirname)
    self.waittime=self.getIntParam('waittime',True)
    self.chartbase=None
    self.extensions=self.getStringParam('knownExtension').split(',')
    self.importDir=self.getStringParam('importDir')


    
  
  def getName(self):
    return "Importer "
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have to find the feeder...
  def start(self):
    httpserver=self.findHandlerByName(AVNHTTPServer.getConfigName())
    if httpserver is None:
      raise Exception("unable to find the httpserver")
    self.chartbase=httpserver.getChartBaseDir()
    if self.chartbase is None or not os.path.isdir(self.chartbase):
      AVNLog.error("chartbase directory not found, stopping converter")
      return
    if not os.path.isdir(self.importDir):
      AVNLog.info("creating import dir %s",self.importDir)
      try:
        os.makedirs(self.importDir)
      except Exception:
        AVNLog.error("unable to create import directory %s:%s, stopping importer",self.importDir,traceback.format_exc())
        return
    AVNLog.info("starting importer with directory %s",self.importDir)
    AVNWorker.start(self) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    while True:
      AVNLog.debug("mainloop")
      if len(self.runningConversions.keys()) == 0:
        currentTimes=self.readImportDir()
        currentTime=time.time()
        for k in currentTimes.keys():
          if len(self.runningConversions.keys()) > 0:
            AVNLog.debug("conversion already running, skip searching")
            break
          currentFileTime=currentTimes.get(k)
          lastTime=self.lastTimeStamps.get(k)
          startConversion=False
          currentlyRunning=self.runningConversions.get(k)
          if currentlyRunning:
            AVNLog.debug("conversion for %s currently running, skip",k)
            continue
          if (lastTime is None or currentFileTime > lastTime):
            AVNLog.debug("detected newer time for %s",k)
            candidate=self.candidateTimes.get(k)
            if (candidate is None or candidate != currentFileTime):
              self.candidateTimes[k]=currentFileTime
            else:
              if ((candidate+self.waittime) < currentTime):
                AVNLog.debug("detected file/directory %s to be new",k)
                gemftime=self.getGemfTimestamp(k)
                if gemftime is None or gemftime < currentFileTime:
                  self.startConversion(k)
        #end for currentKeys
      else:
        AVNLog.debug("conversion(s) running, skip check")
      self.checkConversionFinished()
      if len(self.runningConversions.keys()) > 0 or len(self.candidateTimes.keys()) == 0:
        time.sleep(self.waittime/5)
      else:
        time.sleep(1)
  #read the import dir and return a dictionary: key - name of dir or mbtiles file, entry: timestamp
  def readImportDir(self):
    AVNLog.debug("read import dir %s",self.importDir)
    rt={}
    for file in os.listdir(self.importDir):
      if file == ".." or file == ".":
        continue
      fullname=os.path.join(self.importDir,file)
      if os.path.isdir(fullname):
        AVNLog.debug("directory %s",fullname)
        timestamp=0
        for chartfile in os.listdir(fullname):
          knownFile=False
          for ext in self.extensions:
            if chartfile.upper().endswith("."+ext.upper()):
              knownFile=True
              break
          if knownFile:
            fullChartFile=os.path.join(fullname,chartfile)
            fstat=os.stat(fullChartFile)
            if fstat.st_mtime > timestamp:
              timestamp=fstat.st_mtime
        if timestamp > 0:
          AVNLog.debug("timestamp %d for directory %s",timestamp,file)
          rt[file]=timestamp
      else:
        if file.endswith(".mbtiles"):
          fstat=os.stat(fullname)
          AVNLog.debug("mbtiles file %s:%d",file,fstat.st_mtime)
          rt[file]=fstat.st_mtime
    AVNLog.debug("return %d entries",len(rt.keys()))
    return rt

  #get the timestamp for the matching gemf file (if it exists) - otherwise none
  def getGemfTimestamp(self,name):
    filename=name
    if (name.endswith(".mbtiles")):
      filename=name.replace(".mbtiles","")
    filename=os.path.join(self.chartbase,filename+".gemf")
    if not os.path.exists(filename):
      AVNLog.debug("getGemfTimestamp for %s returns None",name)
      return None
    fstat=os.stat(filename)
    AVNLog.debug("getGemfTimestamp for %s returns %d",name,fstat.st_mtime)
    return fstat.st_mtime

  def startConversion(self,name):
    AVNLog.info("starting conversion for %s",name)
    try:
      del(self.candidateTimes[name])
    except:
      pass
    now=time.time()
    self.lastTimeStamps[name]=now
    #dummy - simply remember the time when we started
    self.runningConversions[name]=now

  def checkConversionFinished(self):
    if len(self.runningConversions.keys()) == 0:
      return
    now=time.time()
    for k in self.runningConversions.keys():
      v=self.runningConversions.get(k)
      AVNLog.debug("check running conversion for %s, param %d",k,v)
      #TODO
      if (v+30) < now:
        AVNLog.info("finished conversion for %s",k)
        del(self.runningConversions[k])



