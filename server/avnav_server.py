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
import sys
import os
import signal
import logging
import logging.handlers
import json
import time
import threading
import datetime
import traceback
import pprint
import socket
import posixpath
import urllib
import optparse
import subprocess
import urlparse
import re
import select
import gemf_reader
try:
  import create_overview
except:
  pass
import glob

from avnav_util import *
from avnav_config import *
from avnav_worker import *
from avnav_data import *
from avnav_nmea import *
from avnav_serial import *
from avnav_gpsd import *
from avnav_trackwriter import *
from avnav_socketwriter import *
from avnav_bluetooth import *
from avnav_usb import *
from avnav_socketreaderbase import *
from avnav_socketreader import *
from avnav_udpreader import *
from avnav_httpserver import *
from avnav_router import *
from avnav_serialwriter import *
from avnav_nmealogger import *
from avnav_importer import AVNImporter
from avnav_wpahandler import *
sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","libraries"))

loggingInitialized=False
#should have a better solution then a global...
trackWriter=None


#a dummy worker class to read some basic configurations
class AVNBaseConfig(AVNWorker):
  def __init__(self,param):
    self.param=param
  @classmethod
  def getConfigName(cls):
    return "AVNConfig"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'loglevel':logging.INFO,
            'logfile':"",
            'expiryTime': 30,
            'aisExpiryTime': 1200,
            'ownMMSI':'',        #if set - do not store AIS messages with this MMSI
            'debugToLog': 'false',
            'maxtimeback':5,      #how many seconds we allow time to go back before we reset
            'settimecmd': '',     #if set, use this to set the system time
            'systimediff':5,      #how many seconds do we allow the system time to be away from us
            'settimeperiod': 3600 #how often do we set the system time
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNBaseConfig(cfgparam)
  def start(self):
    pass
          
 
#a worker to check the chart dirs
#and create avnav.xml...
class AVNChartHandler(AVNWorker):
  def __init__(self,param):
    self.param=param
    AVNWorker.__init__(self, param)
  @classmethod
  def getConfigName(cls):
    return "AVNChartHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'period': 30 #how long to sleep between 2 checks
    }
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNChartHandler(cfgparam)
  def getName(self):
    return "AVNChartHandler"
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    server=None
    for h in self.allHandlers:
      if h.getConfigName()==AVNHTTPServer.getConfigName():
        server=h
        break
    if server is None:
      AVNLog.error("unable to find AVNHTTPServer")
      return
    AVNLog.info("charthandler started")
    while True:
      try:
        osdir=server.getChartBaseDir()
        if osdir is None or not os.path.isdir(osdir):
          AVNLog.error("unable to find a valid chart directory %s"%(osdir))
        else:
          for cd in os.listdir(osdir):
            chartdir=os.path.join(osdir,cd)
            if not os.path.isdir(chartdir):
              continue
            args=["","-i",chartdir]
            rt=create_overview.main(args)
            if rt == 0:
              AVNLog.info("created/updated %s in %s",AVNHTTPServer.navxml,chartdir)
            if rt == 1:
              AVNLog.error("error creating/updating %s in %s",AVNHTTPServer.navxml,chartdir)
      except:
        AVNLog.error("error while trying to update charts %s",traceback.format_exc())
      time.sleep(self.getIntParam('period') or 10)   
    
      
def sighandler(signal,frame):
  for handler in AVNWorker.allHandlers:
    try:
      handler.stopChildren()
    except:
      pass
  sys.exit(1)
        

def main(argv):
  global loggingInitialized,debugger,trackWriter
  debugger=sys.gettrace()
  workerlist=[AVNBaseConfig,AVNGpsdFeeder,AVNSerialReader,AVNGpsd,
              AVNHTTPServer,AVNTrackWriter,AVNBlueToothReader,AVNUsbSerialReader,
              AVNSocketWriter,AVNSocketReader,AVNUdpReader,AVNChartHandler,AVNRouter, AVNSerialWriter, AVNNmeaLogger, AVNImporter,AVNWpaHandler]
  cfgname=None
  usage="usage: %s [-q][-d][-p pidfile] [-c mapdir] [configfile] " % (argv[0])
  parser = optparse.OptionParser(
        usage = usage,
        version="1.0",
        description='av navserver')
  parser.add_option("-q", "--quiet", action="store_const", 
        const=100, default=logging.INFO, dest="verbose")
  parser.add_option("-d", "--debug", action="store_const", 
        const=logging.DEBUG, dest="verbose")
  parser.add_option("-p", "--pidfile", dest="pidfile", help="if set, write own pid to this file")
  parser.add_option("-c", "--chartbase", dest="chartbase", help="if set, overwrite the chart base dir from the HTTPServer")
  parser.add_option("-u", "--urlmap", dest="urlmap",
                    help="provide mappinsg in the form url=path,...")
  (options, args) = parser.parse_args(argv[1:])
  if len(args) < 1:
    cfgname=os.path.join(os.path.dirname(argv[0]),"avnav_server.xml")
  else:
    cfgname=args[0]
  AVNLog.initLoggingInitial(options.verbose if not options.verbose is None else logging.INFO)
  cfg=AVNConfig(workerlist)
  allHandlers=cfg.readConfigAndCreateHandlers(cfgname)
  if allHandlers is None:
    AVNLog.error("unable to parse config file %s",cfgname)
    sys.exit(1)
  baseConfig=None
  httpServer=None
  for handler in allHandlers:
    if handler.getConfigName() == "AVNConfig":
      baseConfig=handler
    if handler.getConfigName() == "AVNTrackWriter":
      trackWriter=handler
    if handler.getConfigName() == AVNHTTPServer.getConfigName():
      httpServer=handler
  if baseConfig is None:
    #no entry for base config found - using defaults
    baseConfig=AVNBaseConfig(AVNBaseConfig.getConfigParam())
  if httpServer is not None and options.chartbase is not None:
    mapurl=httpServer.getStringParam('chartbase')
    if mapurl is not None and mapurl != '':
      httpServer.pathmappings[mapurl]=options.chartbase
  if httpServer is not None and options.urlmap is not None:
    for mapping in re.split("\s*,\s*",options.urlmap):
      try:
        url,path=re.split("\s*=\s*",mapping,2)
        httpServer.pathmappings[url] = path
        AVNLog.info("set url mapping %s=%s"%(url,path))
      except:
        pass
  navData=AVNNavData(float(baseConfig.param['expiryTime']),float(baseConfig.param['aisExpiryTime']),baseConfig.param['ownMMSI'])
  level=logging.INFO
  filename=os.path.join(os.path.dirname(argv[0]),"log","avnav.log")
  if not options.verbose is None:
    level=options.verbose
  else:    
    if not baseConfig.param.get("loglevel") is None:
      level=baseConfig.param.get("loglevel")
  AVNLog.ld("baseconfig",baseConfig.param)
  if not baseConfig.param.get("logfile") == "":
    filename=os.path.expanduser(baseConfig.param.get("logfile"))
  AVNLog.info("####start processing (logging to %s, parameters=%s)####",filename," ".join(argv))
  if not os.path.exists(os.path.dirname(filename)):
    os.makedirs(os.path.dirname(filename), 0777)
  AVNLog.initLoggingSecond(level, filename,baseConfig.getParam()['debugToLog'].upper()=='TRUE') 
  AVNLog.info("#### avnserver pid=%d start processing ####",os.getpid())
  if options.pidfile is not None:
    f=open(options.pidfile,"w")
    if f is not None:
      f.write(str(os.getpid())+"\n")
      f.close()
  #really start processing here - we start all handlers that have been configured
  signal.signal(signal.SIGINT, sighandler)
  signal.signal(signal.SIGTERM, sighandler)
  signal.signal(signal.SIGABRT, sighandler)
  signal.signal(signal.SIGHUP, sighandler)
  try:
    for group in (1,2):
      for handler in allHandlers:
        try:
          if handler.getStartupGroup() == group:
            handler.startInstance(navData)
        except Exception:
          AVNLog.warn("unable to start handler : "+traceback.format_exc())
    AVNLog.info("All Handlers started")
    
    #---------------------------- main loop --------------------------------
    #check if we have a position and handle time updates
    hasFix=False
    lastsettime=0
    lastutc=datetime.datetime.utcnow();
    timeFalse=False
    
    while True:
      time.sleep(3)
      #query the data to get old entries being removed 
      curutc=datetime.datetime.utcnow()
      delta=curutc-lastutc
      allowedBackTime=baseConfig.getIntParam('maxtimeback')
      if AVNUtil.total_seconds(delta) < -allowedBackTime and allowedBackTime != 0:
        AVNLog.warn("time shift backward (%d seconds) detected, deleting all entries ",AVNUtil.total_seconds(delta))
        navData.reset()
        hasFix=False
      lastutc=curutc
      curTPV=navData.getMergedEntries("TPV", [])
      if ( not curTPV.data.get('lat') is None) and (not curTPV.data.get('lon') is None):
        #we have some position
        if not hasFix:
          AVNLog.info("new GPS fix lat=%f lon=%f",curTPV.data.get('lat'),curTPV.data.get('lon'))
          hasFix=True
        #settime handling
        curTPVtime=curTPV.data.get('time')
        if not curTPVtime is None:
          try:
            AVNLog.debug("checking time diffs - new gpsts=%s",curTPVtime)
            curts=AVNUtil.gt(curTPVtime)
            AVNLog.debug("time diff check system utc %s - gps utc %s",curutc.isoformat(),curts.isoformat())
            allowedDiff=baseConfig.getIntParam('systimediff')
            settimecmd=baseConfig.getStringParam('settimecmd')
            settimeperiod=baseConfig.getIntParam('settimeperiod')
            if allowedDiff != 0 and settimecmd != "" and settimeperiod != 0:
            #check if the time is too far away and the period is reached
              if abs(AVNUtil.total_seconds(curts-curutc)) > allowedDiff:
                timeFalse=True
                AVNLog.debug("UTC time diff detected system=%s, gps=%s",curutc.isoformat(),curts.isoformat())
                if lastsettime == 0 or AVNUtil.total_seconds(curutc-lastsettime) > settimeperiod:
                  AVNLog.warn("detected UTC time diff between system time %s and gps time %s, setting system time",
                              curutc.isoformat(),curts.isoformat())
                  #[MMDDhhmm[[CC]YY][.ss]]
                  newtime="%02d%02d%02d%02d%04d.%02d"%(curts.month,curts.day,curts.hour,curts.minute,curts.year,curts.second)
                  cmd=[settimecmd,newtime]
                  AVNLog.info("starting command %s"," ".join(cmd))
                  cmdThread=threading.Thread(target=AVNUtil.runCommand,args=(cmd,"setTime"))
                  cmdThread.start()
                  cmdThread.join(20)
                  if cmdThread.isAlive():
                    #AVNLog.error("unable to finish setting the system time within 40s")
                    pass
                  else:
                    pass
                  curutc=datetime.datetime.utcnow()
                  if abs(AVNUtil.total_seconds(curts-curutc)) > allowedDiff:
                    AVNLog.error("unable to set system time, still above difference")
                  else:
                    AVNLog.info("setting system time succeeded")
                    lastsettime=curutc
                    timeFalse=False
              else:
                #time is OK now
                if timeFalse:
                  AVNLog.info("UTC system time is correct now")
                  timeFalse=False
            else:
              AVNLog.debug("no time check - disabled by parameter")
          except Exception as e:
              AVNLog.warn("exception when checking time diff %s",traceback.format_exc())          
      else:
        if hasFix:
          AVNLog.warn("lost GPS fix")
        hasFix=False
      #AVNLog.debug("entries for TPV: "+unicode(curTPV))
      curAIS=navData.getMergedEntries("AIS",[])
      #AVNLog.debug("entries for AIS: "+unicode(curAIS))
  except Exception as e:
    AVNLog.error("Exception in main %s",traceback.format_exc())
    sighandler(None, None)
   
if __name__ == "__main__":
    main(sys.argv)
    
         
  
