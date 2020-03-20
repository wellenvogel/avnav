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
import shutil

import time
import traceback

from avnav_config import AVNConfig
from httpserver import AVNHTTPServer
from avnav_util import *
from avnav_worker import *
import avnav_handlerList


#a converter to read our known chart formats and convert them to gemf
#charts are read from the .../data/import directory
#currently supported:
#    xxx.mbtiles  - directly in the import directory - will be converted to xxx.gemf
#    xxx.navipack - directly in the import directory - will be converted to xxx.gemf
#    yyy          - subdirectory below import - will use our chartconvert and will be converted to yyy.gemf
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
      'converterDir':'',
      'importDir':'import', #directory below our data dir
      'workDir': '',    #working directory
      'waittime': 30,       #time to wait in seconds before a conversion is started after detecting a change (and no further change)
      'knownExtensions': 'kap,map,geo' #extensions for gdal conversion
    }
    return rt

  @classmethod
  def autoInstantiate(cls):
    return True

  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.importDir=None
    self.lastTimeStamps={}    #a dictionary of timestamps - key is the directory/filename, value the last read timestamp
    self.candidateTimes={}    #dictionary with candidates for conversion - same layout as lastTimeStamps
    self.runningConversions={} #dictionary of current running conversions (key is the filename/dirname)
    self.waittime=self.getIntParam('waittime',True)
    self.chartbase=None
    self.extensions=self.getStringParam('knownExtensions').split(',')
    self.importDir=AVNConfig.getDirWithDefault(self.param,'importDir','import')
    self.workDir=AVNConfig.getDirWithDefault(self.param,'workDir','work')
    self.converterDir=self.getStringParam('converterDir') # the location of the coneverter python
    if self.converterDir is None or self.converterDir=='':
      self.converterDir=os.path.join(os.path.dirname(os.path.realpath(__file__)),"../..","chartconvert")


    
  

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
    if self.workDir is None or self.workDir == "":
      self.workDir=os.path.join(os.path.dirname(self.importDir),"work")
    if not os.path.isdir(self.workDir):
      AVNLog.info("creating work dir %s",self.workDir)
      try:
        os.makedirs(self.workDir)
      except Exception:
        AVNLog.error("unable to create work directory %s:%s, stopping importer",self.importDir,traceback.format_exc())
        return
    AVNLog.info("starting importer with directory %s, tools dir %s, workdir %s",self.importDir,self.converterDir,self.workDir)
    AVNWorker.start(self) 
     
  #thread run method - just try forever  
  def run(self):
    self.setName(self.getThreadPrefix())
    self.setInfo("main","monitoring started for %s"%(self.importDir),AVNWorker.Status.NMEA)
    self.setInfo("converter","free",AVNWorker.Status.INACTIVE)
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
          if currentlyRunning is not None:
            AVNLog.debug("conversion for %s currently running, skip",k)
            continue
          gemftime=self.getGemfTimestamp(k)
          if (lastTime is None or currentFileTime > lastTime or gemftime is None):
            AVNLog.debug("detected newer time for %s",k)
            candidate=self.candidateTimes.get(k)
            if (candidate is None or candidate != currentFileTime):
              self.candidateTimes[k]=currentFileTime
              self.setInfo("converter", "change detected for %s, waiting to settle" % k, AVNWorker.Status.STARTED)
            else:
              if ((candidate+self.waittime) < currentTime):
                AVNLog.debug("detected file/directory %s to be new",k)
                if gemftime is None or gemftime < currentFileTime:
                  self.startConversion(k)
                  break
                else:
                  AVNLog.debug("gemf file is newer, no conversion")
              else:
                self.setInfo("converter", "change detected for %s, waiting to settle" % k, AVNWorker.Status.STARTED)


        #end for currentKeys
      else:
        AVNLog.debug("conversion(s) running, skip check")
      self.checkConversionFinished()
      if len(self.runningConversions.keys()) > 0 or len(self.candidateTimes.keys()) == 0:
        time.sleep(self.waittime/5)
      else:
        time.sleep(1)
  #read the import dir and return a dictionary: key - name of dir or mbtiles file, entry: timestamp

  def allExtensions(self):
    return self.extensions + ["mbtiles", "navipack"]

  def getExt(self,filename):
    rt=os.path.splitext(filename)[1]
    if len(rt) > 0:
      rt=rt[1:]
    return rt
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
        knownFile=False
        for ext in self.allExtensions():
           if file.upper().endswith("."+ext.upper()):
              knownFile=True
              break
        if knownFile:
          fstat=os.stat(fullname)
          AVNLog.debug("chart file %s:%d",file,fstat.st_mtime)
          rt[file]=fstat.st_mtime
    AVNLog.debug("return %d entries",len(rt.keys()))
    return rt

  def getGemfName(self,name):
    filename=name
    if (name.endswith(".mbtiles")):
      filename=name.replace(".mbtiles","")
    if (name.endswith(".navipack")):
      filename=name.replace(".navipack","")
    filename=os.path.join(self.chartbase,filename+".gemf")
    return filename

  #get the timestamp for the matching gemf file (if it exists) - otherwise none
  def getGemfTimestamp(self,name):
    filename=self.getGemfName(name)
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
    self.setInfo("converter","running for %s"%(name),AVNWorker.Status.RUNNING)
    self.lastTimeStamps[name]=now
    fullname=os.path.join(self.importDir,name)
    gemfName=self.getGemfName(name)
    po=None
    if os.path.isdir(fullname):
      AVNLog.info("gdal conversion for %s",name)
      workdir=os.path.join(self.workDir,name)
      doStart=True
      tmpOutName=None
      if not os.path.isdir(workdir):
        try:
          os.makedirs(workdir)
        except:
          AVNLog.error("unable to create workdir %s",workdir)
          doStart=False
      if doStart:
        args=[sys.executable,os.path.join(self.converterDir,"read_charts.py"),"-o",name+"-tmp","-b",workdir,"-g","-t","1",fullname]
        tmpOutName=os.path.join(workdir,"out",name+"-tmp.gemf")
        po=self.runConverter(name,args)
    elif name.endswith("mbtiles"):
      args=[sys.executable,os.path.join(self.converterDir,"convert_mbtiles.py"),gemfName+".tmp",fullname]
      tmpOutName=gemfName+".tmp"
      po=self.runConverter(name,args)
    elif name.endswith("navipack"):
      args=[sys.executable,os.path.join(self.converterDir,"convert_navipack.py"),gemfName+".tmp",fullname]
      tmpOutName=gemfName+".tmp"
      po=self.runConverter(name,args)

    if po is None:
      AVNLog.error("unable to start conversion for %s - don't know how to handle it",name)
      self.setInfo("converter","start for %s failed - don't know how to handle"%(name,),AVNWorker.Status.ERROR)
      return
    #dummy - simply remember the time when we started
    self.runningConversions[name]=[po,tmpOutName]

  def checkConversionFinished(self):
    if len(self.runningConversions.keys()) == 0:
      return
    now=time.time()
    for k in self.runningConversions.keys():
      [po,tmpname]=self.runningConversions.get(k)
      AVNLog.debug("check running conversion for %s",k)
      rtc=po.poll()
      if rtc is None:
        AVNLog.debug("converter for %s still running",k)
      else:
        AVNLog.info("finished conversion for %s with return code %d",k,rtc)
        if rtc == 0:
          gemfname=self.getGemfName(k)
          fullname=os.path.join(self.importDir,k)
          if not os.path.exists(tmpname):
            AVNLog.error("converter for %s did not create %s",k,tmpname)
            rtc=1
          else:
            AVNLog.info("renaming %s to %s",tmpname,gemfname)
            if os.path.exists(gemfname):
              try:
                os.unlink(gemfname)
              except:
                pass
            try:
              #TODO: handle multiple files...
              os.rename(tmpname,gemfname)
            except:
              AVNLog.error("unable to rename %s to %s: %s",tmpname,gemfname,traceback.format_exc())
              rtc=1
        if rtc == 0:
          self.setInfo("converter","successful for %s"%(k),AVNWorker.Status.INACTIVE)
        else:
          self.setInfo("converter","failed for %s"%(k),AVNWorker.Status.ERROR)
        del(self.runningConversions[k])

  #delete an import dir/file
  #name being the name of a gemf file (without path)
  def deleteImport(self,name):
    if (name.endswith(".gemf")):
      name=name[:-5]
    if self.runningConversions.get(name) is not None:
      [isRunning,tmpname]=self.runningConversions.get(name)
      AVNLog.info("trying to delete import %s, conversion currently running",name)
      try:
        isRunning.kill()
        isRunning.poll()
        del(self.runningConversions[name])
        self.setInfo("converter","killed for %s"%(name),AVNWorker.Status.INACTIVE)
      except:
        pass
    try:
      del(self.lastTimeStamps[name])
    except:
      pass
    fullname=os.path.join(self.importDir,name)
    if os.path.isdir(fullname):
      AVNLog.info("deleting import directory %s",fullname)
      workdir=os.path.join(self.workDir,name)
      try:
        shutil.rmtree(fullname)
        if os.path.isdir(workdir):
          shutil.rmtree(workdir)
      except:
        AVNLog.error("error deleting directory %s:%s",fullname,traceback.format_exc())
    else:
      for ext in [".mbtiles",".navipack"]:
        fullname=os.path.join(self.importDir,name+ext)
        if os.path.isfile(fullname):
          AVNLog.info("deleting import file %s",fullname)
          try:
            os.unlink(fullname)
          except:
            AVNLog.error("error deleting file %s:%s",fullname,traceback.format_exc())

  def runConverter(self,name,args):
    logdir=AVNLog.getLogDir()
    rt=None
    try:
      logfile=None
      if logdir is not None:
        logfilename=os.path.join(logdir,"convert-"+name+".log")
        try:
          logfile=open(logfilename,"w")
        except:
          AVNLog.error("unable to open logile %s: %s",logfilename,traceback.format_exc())
      if logfile is not None:
        AVNLog.info("starting converter for %s with args %s, logfile=%s",name," ".join(args),logfilename)
        rt=subprocess.Popen(args,stdin=None,stdout=logfile,stderr=subprocess.STDOUT)
      else:
        AVNLog.info("starting converter for %s with args %s",name," ".join(args))
        rt=subprocess.Popen(args)
      return rt
    except:
      AVNLog.error("unable to start converter for %s:%s",name,traceback.format_exc())


  def getHandledCommands(self):
    type="import"
    rt = {"api": type, "upload": type, "list": type, "download": type, "delete": type}
    return rt

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == "list":
      return AVNUtil.getReturnData(items=[])
    if type == "delete":
      return AVNUtil.getReturnData(error="delete not yet supported")
    if type == "download":
      return None

    if type == "upload":
      handler=kwargs.get('handler')
      if handler is None:
        return AVNUtil.getReturnData(error="no handler")
      name=AVNUtil.clean_filename(AVNUtil.getHttpRequestParam(requestparam,"name",True))
      subdir=AVNUtil.clean_filename(AVNUtil.getHttpRequestParam(requestparam,"subdir",False))
      if not ( self.getExt(name) in self.allExtensions()) :
        return AVNUtil.getReturnData(error="invalid filename")
      dir=self.importDir
      if subdir is not None:
        dir=os.path.join(self.importDir,subdir)
        if not os.path.isdir(dir):
          os.makedirs(dir)
        if not os.path.isdir(dir):
          return AVNUtil.getReturnData(error="unable to create directory %s"%dir)
      fname=os.path.join(dir,name)
      handler.writeFileFromInput(fname,kwargs.get('flen'),True)
      return AVNUtil.getReturnData()

    if type == "api":
      command=AVNUtil.getHttpRequestParam(requestparam,"command",True)
      if (command == "extensions"):
        return AVNUtil.getReturnData(items=self.allExtensions())
    return AVNUtil.getReturnData(error="unknown command for import")

avnav_handlerList.registerHandler(AVNImporter)



