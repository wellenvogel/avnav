#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py 
###############################################################################
import glob
import logging.handlers
import optparse
import signal
import datetime

from avnav_nmea import NMEAParser
from avnav_store import AVNStore

try:
  import create_overview
except:
  pass
AVNAV_VERSION=datetime.datetime.now().strftime("%Y%m%d")
try:
  from avnav_server_version import AVNAV_VERSION
except:
  pass
from avnav_util import *
from avnav_manager import *
import avnav_handlerList
from avnav_store import *
sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","libraries"))
import handler
import builtins

loggingInitialized=False

def avnavPrint(*args, **kwargs):
  line=""
  first=True
  for k in args:
    line=line+k+(',' if not first else '')
    first=False
  AVNLog.info(line)

builtins.print=avnavPrint



def sighandler(signal,frame):
  AVNWorker.shutdownServer()
        
def findHandlerByConfig(list,configName):
  for h in list:
    if h.getConfigName()==configName:
      return h
  return None

def getFailedBackupName(fileName):
  now=datetime.datetime.utcnow()
  return fileName+"-failed-"+now.strftime("%Y%m%d%H%M%S")

def houseKeepingCfg(cfgFile):
  backupFiles=glob.glob(cfgFile+"-*")
  namelen=len(cfgFile)
  failingFiles=list(filter(lambda x: re.match("^-fail",x[namelen:]),backupFiles))
  copies=list(filter(lambda x: re.match("^-[0-9]",x[namelen:]),backupFiles))
  failingFiles.sort()
  copies.sort()
  numDeletes=0
  for f in failingFiles[:-10]:
    AVNLog.debug("deleting failed config %s",f)
    try:
      os.unlink(f)
      numDeletes+=1
    except:
      pass
  for f in copies[:-10]:
    AVNLog.debug("deleting config copy %s",f)
    try:
      os.unlink(f)
      numDeletes+=1
    except:
      pass
  AVNLog.info("deleted %s backups/failed configs",numDeletes)

def createFailedBackup(cfgname):
  failedBackup = getFailedBackupName(cfgname)
  try:
    shutil.copy(cfgname, failedBackup)
    AVNLog.error("created backup %s of failed config %s",failedBackup,cfgname)
    return True
  except:
    AVNLog.error("unable to create failed backup %s", failedBackup)
  return False

def setLogFile(filename,level,consoleOff=False):
  if not os.path.exists(os.path.dirname(filename)):
    os.makedirs(os.path.dirname(filename), 0o777)
  firstLevel=level
  if firstLevel > logging.INFO:
    firstLevel=logging.INFO
  AVNLog.initLoggingSecond(firstLevel, filename, debugToFile=True,consoleOff=consoleOff)
  AVNLog.info("#### avnserver pid=%d,version=%s,parameters=%s start processing ####", os.getpid(), AVNAV_VERSION,
              " ".join(sys.argv))
  if firstLevel != level:
    AVNLog.setLogLevel(level)

LOGFILE="avnav.log"
def writeStderr(txt):
  sys.stderr.write("AVNAV-ERROR: "+txt+"\n")
def main(argv):
  global loggingInitialized,debugger
  try:
    #workaround for some strange bug AttributeError: 'module' object has no attribute '_strptime'
    #see http://code-trick.com/python-bug-attribute-error-_strptime
    datetime.datetime.strptime("1999","%Y")
  except:
    pass
  debugger=sys.gettrace()
  cfgname=None
  usage="usage: %s [-q][-d][-p pidfile] [-c mapdir] [-l loglevel] [configfile] " % (argv[0])
  parser = optparse.OptionParser(
        usage = usage,
        version=AVNAV_VERSION,
        description='av navserver')
  parser.add_option("-q", "--quiet",  dest="quiet", action="store_true" ,help="do not log to stderr")
  parser.add_option("-e", "--error", action="store_const",
                    const=True, dest="failOnError")
  parser.add_option("-p", "--pidfile", dest="pidfile", help="if set, write own pid to this file")
  parser.add_option("-c", "--chartbase", dest="chartbase", help="if set, overwrite the chart base dir from the HTTPServer")
  parser.add_option("-w", "--datadir", dest="datadir",
                    help="if set make this the base data dir")
  parser.add_option("-u", "--urlmap", dest="urlmap",
                    help="provide mappings in the form url=path,...")
  parser.add_option("-r", "--restart", dest="canRestart", action='store_const', const=True,
                    help="avnav will restart if server exits")
  parser.add_option("-l", "--loglevel", dest="loglevel", default="INFO", help="loglevel, default INFO")
  parser.add_option("-d","--debug",dest="loglevel", action="store_const", const="DEBUG")
  (options, args) = parser.parse_args(argv[1:])
  if len(args) < 1:
    cfgname=os.path.join(os.path.dirname(argv[0]),"avnav_server.xml")
  else:
    cfgname=args[0]
  AVNLog.initLoggingInitial(AVNLog.levelToNumeric(options.loglevel))
  basedir = os.path.abspath(os.path.dirname(__file__))
  datadir = options.datadir
  if datadir is None:
    if options.chartbase is not None:
      datadir = os.path.join(options.chartbase, os.path.pardir)
  if datadir is None:
    datadir = os.path.join(os.path.expanduser("~"), "avnav")
  datadir = os.path.abspath(datadir)
  AVNLog.info("basedir=%s,datadir=%s", basedir, datadir)
  systemdEnv = os.environ.get('INVOCATION_ID')
  quiet=False
  if options.quiet or systemdEnv is not None:
    quiet=True
  logDir = os.path.join(datadir, "log")
  logFile = os.path.join(logDir, LOGFILE)
  AVNLog.info("####start processing (version=%s, logging to %s, parameters=%s)####", AVNAV_VERSION, logFile,
                " ".join(argv))

  setLogFile(logFile,AVNLog.levelToNumeric(options.loglevel),consoleOff=quiet)
  canRestart=options.canRestart or systemdEnv is not None
  handlerManager=AVNHandlerManager(canRestart)
  handlerManager.setBaseParam(handlerManager.BASEPARAM.BASEDIR,basedir)
  handlerManager.setBaseParam(handlerManager.BASEPARAM.DATADIR,datadir)
  usedCfgFile=cfgname
  rt=handlerManager.readConfigAndCreateHandlers(cfgname)
  fallbackName = AVNHandlerManager.getFallbackName(cfgname)
  failedBackup=None
  if rt is False:
    if os.path.exists(fallbackName) and not options.failOnError:
      AVNLog.error("error when parsing %s, trying fallback %s",cfgname,fallbackName)
      writeStderr("error when parsing %s, trying fallback %s"%(cfgname,fallbackName))
      usedCfgFile=fallbackName
      rt=handlerManager.readConfigAndCreateHandlers(fallbackName)
      if not rt:
        AVNLog.error("unable to parse config file %s", fallbackName)
        sys.exit(1)
      createFailedBackup(cfgname)
      try:
        tmpName=cfgname+".tmp"+str(os.getpid())
        shutil.copyfile(fallbackName,tmpName)
        os.replace(tmpName,cfgname)
      except Exception as e:
        AVNLog.error("unable to create %s from %s: %s",cfgname,fallbackName,str(e))
      handlerManager.cfgfileName=cfgname #we just did read the fallback - but if we write...

    else:
      AVNLog.error("unable to parse config file %s, no fallback found",cfgname)
      writeStderr("unable to parse config file %s, no fallback found"%cfgname)
      if not options.failOnError and canRestart:
        if createFailedBackup(cfgname):
          AVNLog.error("removing invalid config file %s",cfgname)
          writeStderr("removing invalid config file %s"%cfgname)
          os.unlink(cfgname)
      sys.exit(1)
  else:
    handlerManager.copyFileWithCheck(cfgname,fallbackName,False) #write a "last known good"
  baseConfig=AVNWorker.findHandlerByName("AVNConfig")
  httpServer=AVNWorker.findHandlerByName("AVNHttpServer")
  if baseConfig is None:
    AVNLog.error("internal error: base config not loaded")
    sys.exit(1)
  baseConfig.setVersion(AVNAV_VERSION)
  parseError=handlerManager.parseError
  cfgStat = os.stat(usedCfgFile)
  cfgTime = time.strftime("%Y/%m/%d %H:%M:%S", time.localtime(cfgStat.st_mtime))
  if parseError is not None:
    baseConfig.setStartupError("parsing config failed: %s, reverting back to fallback config from %s, invalid config moved to %s"%
                             (parseError,cfgTime or '',failedBackup or ''))
  baseConfig.setConfigInfo("%s (%s,%d bytes)"%(usedCfgFile,cfgTime,cfgStat.st_size))
  houseKeepingCfg(cfgname)
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
  if httpServer is not None:
    for handler in AVNWorker.getAllHandlers():
      handledCommands=handler.getHandledCommands()
      if handledCommands is not None:
        if isinstance(handledCommands,dict):
          for h in list(handledCommands.keys()):
            httpServer.registerRequestHandler(h,handledCommands[h],handler)
        else:
          httpServer.registerRequestHandler('api',handledCommands,handler)
    httpServer.registerRequestHandler('api','config',handlerManager)
    httpServer.registerRequestHandler('download', 'config', handlerManager)
  navData=AVNStore(
    float(baseConfig.param['expiryTime']),
    float(baseConfig.param['aisExpiryTime']),
    baseConfig.param['ownMMSI'])
  NMEAParser.registerKeys(navData)
  if options.pidfile is not None:
    f=open(options.pidfile,"w",encoding='utf-8')
    if f is not None:
      f.write(str(os.getpid())+"\n")
      f.close()
  #really start processing here - we start all handlers that have been configured
  signal.signal(signal.SIGINT, sighandler)
  signal.signal(signal.SIGTERM, sighandler)
  signal.signal(signal.SIGABRT, sighandler)
  try:
    signal.signal(signal.SIGHUP, sighandler)
  except:
    pass
  try:
    handlerManager.startHandlers(navData)
    
    #---------------------------- main loop --------------------------------
    #check if we have a position and handle time updates
    hasFix=False
    lastsettime=0
    lastutc=datetime.datetime.utcnow()
    timeFalse=False
    
    while not handlerManager.shouldStop:
      time.sleep(1)
      #query the data to get old entries being removed 
      curutc=datetime.datetime.utcnow()
      delta=curutc-lastutc
      allowedBackTime=baseConfig.getIntParam('maxtimeback')
      if AVNUtil.total_seconds(delta) < -allowedBackTime and allowedBackTime != 0:
        AVNLog.warn("time shift backward (%d seconds) detected, deleting all entries ",AVNUtil.total_seconds(delta))
        navData.reset()
        #if the time is shifting all condition waits must
        #be notified...
        for h in AVNWorker.allHandlers:
          try:
            h.wakeUp()
          except:
            pass
        hasFix=False
      lastutc=curutc
      lat=None
      lon=None
      curGpsTime=None
      try:
        lat=navData.getSingleValue(AVNStore.BASE_KEY_GPS+".lat")
        lon = navData.getSingleValue(AVNStore.BASE_KEY_GPS + ".lon")
        curGpsTime=navData.getSingleValue(AVNStore.BASE_KEY_GPS + ".time")
      except Exception as e:
        AVNLog.error("Exception when getting curGpsData: %s",traceback.format_exc())
      if ( lat is not None) and (lon is not None):
        #we have some position
        if not hasFix:
          AVNLog.info("new GPS fix lat=%f lon=%f, time=%s, currentTime=%s",lat,lon,curGpsTime,curutc.isoformat())
          hasFix=True
        #settime handling
        if not curGpsTime is None:
          try:
            AVNLog.debug("checking time diffs - new gpsts=%s",curGpsTime)
            curts=AVNUtil.gt(curGpsTime)
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
                  curutc=datetime.datetime.utcnow()
                  if abs(AVNUtil.total_seconds(curts-curutc)) > allowedDiff:
                    AVNLog.error("unable to set system time to %s, still above difference",newtime)
                  else:
                    AVNLog.info("setting system time to %s succeeded",newtime)
                    lastsettime=curutc
                    timeFalse=False
                    for h in AVNWorker.allHandlers:
                      try:
                        h.timeChanged()
                      except:
                        pass
                      try:
                        h.wakeUp()
                      except:
                        pass

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

  except Exception as e:
    AVNLog.error("Exception in main %s",traceback.format_exc())
  AVNLog.info("stopping")
  sighandler(None, None)
   
if __name__ == "__main__":
    main(sys.argv)
    
         
  
