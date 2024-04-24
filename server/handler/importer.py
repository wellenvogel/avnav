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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
###############################################################################
import hashlib
import shutil

import time
import traceback

from avnav_manager import AVNHandlerManager
from avndirectorybase import AVNDirectoryHandlerBase
from httpserver import AVNHTTPServer
from avnav_util import *
from avnav_worker import *
from avnav_api import ConverterApi
import avnav_handlerList


class ExternalConverter(ConverterApi):
  def __init__(self,converter:ConverterApi,id):
    self._converter=converter
    self.id=id
  def setConverter(self,converter:ConverterApi):
    self._converter=converter
  def countConvertibleFiles(self, dirOrFile):
    return self._converter.countConvertibleFiles(dirOrFile)

  def getConverterCommand(self, input, outname):
    return self._converter.getConverterCommand(input, outname)

  def getOutFileOrDir(self, outname):
    return self._converter.getOutFileOrDir(outname)

  def handledExtensions(self):
    return self._converter.handledExtensions()


class InternalConverter(ConverterApi):
  def __init__(self,knownExtensions:list,chartDir:str):
    self._extensions=list(map(lambda x: "."+x.upper(),knownExtensions))
    self._logger=AVNLog
    self._chartdir=chartDir
  def _canHandle(self,fn):
    (name,ext)=os.path.splitext(fn)
    return ext.upper() in self._extensions
  def _addMd5(self,md5,fn):
    md5.update(fn.encode(errors='ignore'))
    st=os.stat(fn.encode(errors='ignore'))
    md5.update(str(st.st_mtime).encode(errors='ignore'))
    md5.update(str(st.st_size).encode(errors='ignore'))
  def _handleFile(self,md5,fn):
    if self._canHandle(fn):
      self._addMd5(md5,fn)
      return 1
    return 0
  def _handleDir(self,md5,dir):
    rt=0
    for f in os.listdir(dir):
      fn=os.path.join(dir,f)
      if os.path.isdir(fn):
        rt+=self._handleDir(md5,fn)
      else:
        rt+=self._handleFile(md5,fn)
    return rt

  def countConvertibleFiles(self, dirOrFile):
    if not os.path.exists(dirOrFile):
      return (0,None)
    md5=hashlib.md5()
    rt=0
    if os.path.isdir(dirOrFile):
      rt=self._handleDir(md5,dirOrFile)
    else:
      rt=self._handleFile(md5,dirOrFile)
    if rt > 0:
      return (rt,md5.hexdigest())
    else:
      return(rt,None)
  def handledExtensions(self):
    return self._extensions

  def getOutFileOrDir(self, outname):
    return os.path.join(self._chartdir,outname+".gemf")

class GdalConverter(InternalConverter):
  EXTENSIONS=['kap','map','geo','eap']
  def __init__(self, converterPath:str,chartDir:str,workDir:str):
    super().__init__(self.EXTENSIONS,chartDir)
    self._converter=converterPath
    self._workdir=workDir

  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,"-o",self.getOutFileOrDir(outname),
            "-b",os.path.join(self._workdir,outname),"-g","-t","1",input]

class NavipackConverter(InternalConverter):
  EXTENSIONS=["navipack"]
  def __init__(self,converterPath:str,chartDir:str):
    super().__init__(self.EXTENSIONS,chartDir)
    self._converter=converterPath

  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,self.getOutFileOrDir(outname),input]

class MbtilesConverter(InternalConverter):
  EXTENSIONS=['mbtiles']
  def __init__(self, converterPath:str,chartDir: str):
    super().__init__(self.EXTENSIONS, chartDir)
    self._converter=converterPath
  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,self.getOutFileOrDir(outname),input]


class ConversionCandidate:
  def __init__(self,name,filename,converter,currentmd5,convertedmd5,convertedTime):
    self.name=name # type: str
    self.filename=filename # type: str
    self.converter=converter # type: ConverterApi
    self.currentmd5=currentmd5 # type: str
    self.convertedmd5=convertedmd5 # type: str
    self.convertedTime=convertedTime
    self.timestamp=time.monotonic()
  def md5changed(self):
    return self.currentmd5 != self.convertedmd5
  def hasChanged(self,other):
    return self.currentmd5 != other.currentmd5
  def getOutName(self):
    return self.converter.getOutFileOrDir(self.name)
  def getInfoKey(self):
    return "conv:%s"%self.name
class Conversion:
  def __init__(self,process,candidate:ConversionCandidate):
    self.process=process
    self.candidate=candidate
    self.timestamp=time.monotonic()

  def stop(self):
    self.process.kill()
    return self.process.poll()


#a converter to read our known chart formats and convert them to gemf
#charts are read from the .../data/import directory
#currently supported:
#    xxx.mbtiles  - directly in the import directory - will be converted to xxx.gemf
#    xxx.navipack - directly in the import directory - will be converted to xxx.gemf
#    yyy          - subdirectory below import - will use our chartconvert and will be converted to yyy.gemf
# when deleting files via the gui corresponding files at import are deleted too
# intermediate files are written to the ...import/yyy/work directory
class AVNImporter(AVNWorker):

  P_DIR=WorkerParameter('converterDir','',editable=False)
  P_IMPORTDIR=WorkerParameter('importDir','import',editable=False)
  P_WORKDIR=WorkerParameter('workDir','',editable=False)
  P_WAITTIME=WorkerParameter('waittime',30,type=WorkerParameter.T_NUMBER,
                             description='time to wait in seconds before a conversion is started after detecting a change (and no further change)')
  P_KEEPINFO=WorkerParameter('keepInfoTime', 30, type=WorkerParameter.T_NUMBER,
                             description='seconds to keep the info entry',editable=False)
  @classmethod
  def getConfigName(cls):
    return "AVNImporter"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt=[
      cls.P_DIR,
      cls.P_IMPORTDIR, #directory below our data dir
      cls.P_WORKDIR,    #working directory
      cls.P_WAITTIME,
      cls.P_KEEPINFO
    ]
    return rt

  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def canEdit(cls):
    return True

  @classmethod
  def canDisable(cls):
    return True

  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.importDir=None
    self.lastTimeStamps={}    #a dictionary of timestamps - key is the directory/filename, value the last read timestamp
    self.candidateTimes={}    #dictionary with candidates for conversion - same layout as lastTimeStamps
    self.runningConversion=None # type: Conversion
    self.waittime=None
    self.chartbase=None
    self.importDir=AVNHandlerManager.getDirWithDefault(self.param, self.P_IMPORTDIR.name, 'import')
    self.workDir=AVNHandlerManager.getDirWithDefault(self.param, self.P_WORKDIR.name, 'work')
    self.converterDir=self.getWParam(self.P_DIR ) # the location of the converter python
    if self.converterDir is None or self.converterDir=='':
      self.converterDir=os.path.join(os.path.dirname(os.path.realpath(__file__)),"../..","chartconvert")
    self.converters=[]
    self.externalConverters=[]
    self.candidates=[]
    self.listlock=threading.Lock()

  def _getConverters(self):
    with self.listlock:
      rt=self.converters.copy()
      rt.extend(self.externalConverters)
      return rt

  #make some checks when we have to start
  #we cannot do this on init as we potentiall have to find the feeder...
  def startInstance(self, navdata):
    httpserver=self.findHandlerByName(AVNHTTPServer.getConfigName())
    if httpserver is None:
      raise Exception("unable to find the httpserver")
    self.chartbase=httpserver.getChartBaseDir()
    if self.chartbase is None or not os.path.isdir(self.chartbase):
      AVNLog.error("chartbase directory not found, stopping converter")
      return
    self.converters.append(GdalConverter(os.path.join(self.converterDir,"read_charts.py"),self.chartbase,self.workDir))
    self.converters.append(MbtilesConverter(os.path.join(self.converterDir,"convert_mbtiles.py"),self.chartbase))
    self.converters.append(NavipackConverter(os.path.join(self.converterDir,"convert_navipack.py"),self.chartbase))
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
    super().startInstance(navdata)

  #thread run method - just try forever  
  def run(self):
    self.setInfo("main","monitoring started for %s"%(self.importDir),WorkerStatus.NMEA)
    self.setInfo("converter","free",WorkerStatus.STARTED)
    waitingCandidates={}
    while not self.shouldStop():
      timeout=self.getWParam(self.P_KEEPINFO)
      self.waittime=self.getWParam(self.P_WAITTIME)
      AVNLog.debug("mainloop")
      if self.runningConversion is None:
        self.setInfo("main","scanning",WorkerStatus.NMEA)
        currentCandidates=self.readImportDir()
        self.candidates=currentCandidates
        now=time.monotonic()
        for k in currentCandidates:
          infoKey=k.getInfoKey()
          if not k.md5changed():
            try:
              del waitingCandidates[k.name]
            except:
              pass
            timestamp_str = datetime.datetime.fromtimestamp(k.convertedTime).strftime('%Y-%m-%d %H:%M')
            self.setInfo(infoKey,"already converted at %s"%timestamp_str,WorkerStatus.INACTIVE)
            continue
          existing=waitingCandidates.get(k.name)
          startConversion=False
          if existing is not None:
            if existing.hasChanged(k):
              waitingCandidates[k.name]=k
            else:
              if (existing.timestamp+self.waittime) < now:
                startConversion=True
                waitingCandidates[k.name]=k
          else:
            waitingCandidates[k.name]=k
          if not startConversion:
            self.setInfo(infoKey, "change detected, waiting to settle" , WorkerStatus.STARTED,timeout=timeout)
            continue
          self.setInfo(infoKey, "conversion started", WorkerStatus.NMEA,timeout=timeout)
          rs=self.startConversion(k)
          if not rs:
            try:
              del waitingCandidates[k.name]
            except:
              pass
          else:
            break
      else:
        AVNLog.debug("conversion(s) running, skip check")
      candidate=self.checkConversionFinished()
      try:
        del waitingCandidates[candidate.name]
      except:
        pass
      if self.runningConversion is not None or len(waitingCandidates.keys())> 0:
        self.wait(self.waittime/5)
      else:
        self.wait(1)
    if self.runningConversion is not None:
      self.runningConversion.stop()

  def allExtensions(self):
    extensions=[]
    converters=self._getConverters()
    for converter in converters: # type: ConverterApi
      extensions.extend(converter.handledExtensions())
    return extensions

  def saveLastMd5(self,name,hexdigest):
    fn=os.path.join(self.importDir,"_"+name)
    try:
      with open(fn,"w") as h:
        h.write(hexdigest)
        return True
    except:
      return False

  def getLastMd5(self,name):
    fn=os.path.join(self.importDir,"_"+name)
    if not os.path.exists(fn):
      return (None,None)
    mt=os.stat(fn).st_mtime
    try:
      with open(fn,"r") as h:
        return (mt,h.read())
    except:
      return (None,None)
  def getNameFromImport(self,dirOrFile):
    path,ext=os.path.splitext(dirOrFile)
    path=os.path.basename(path)
    return AVNUtil.clean_filename(path)
  def readImportDir(self):
    AVNLog.debug("read import dir %s",self.importDir)
    rt=[]
    for file in os.listdir(self.importDir):
      if file == ".." or file == "." or file.startswith('_'):
        continue
      fullname=os.path.join(self.importDir,file)
      score=0
      converter=None
      md5=None
      for cnv in self._getConverters(): # type: ConverterApi
        try:
          cs,currentmd5=cnv.countConvertibleFiles(fullname)
          if cs > score:
            converter=cnv
            score=cs
            md5=currentmd5
        except Exception as e:
          AVNLog.error("error reading importt dir for converter %s",traceback.format_exc())
      if score < 1:
        AVNLog.debug("ignore unknown import %s",fullname)
        continue
      name=self.getNameFromImport(file)
      lastTime,lastMd5=self.getLastMd5(name)
      if lastMd5 == md5:
        AVNLog.debug("import %s unchanged, skip",fullname)
      rt.append(ConversionCandidate(name,fullname,converter,md5,lastMd5,lastTime))
    return rt


  def startConversion(self,candidate:ConversionCandidate):
    AVNLog.info("starting conversion for %s",candidate.name)
    now=time.time()
    self.setInfo("converter","running for %s"%(candidate.name),WorkerStatus.NMEA)
    cmd=candidate.converter.getConverterCommand(candidate.filename,candidate.name)
    po=self.runConverter(candidate.name,cmd)
    if po is None:
      AVNLog.error("unable to start conversion for %s - don't know how to handle it",candidate.name)
      self.setInfo("converter","start for %s failed - don't know how to handle"%(candidate.name,),WorkerStatus.ERROR)
      return False
    self.runningConversion=Conversion(po,candidate)

  def checkConversionFinished(self):
    if self.runningConversion is None:
      return
    rtc=self.runningConversion.process.poll()
    if rtc is None:
      AVNLog.debug("converter for %s still running",self.runningConversion.candidate.name)
      self.refreshInfo(self.runningConversion.candidate.getInfoKey(),timeout=self.getWParam(self.P_KEEPINFO))
      return
    else:
      AVNLog.info("finished conversion for %s with return code %d",self.runningConversion.candidate.name,rtc)
      if rtc == 0:
        outname=self.runningConversion.candidate.getOutName()
        if not os.path.exists(outname):
          self.setInfo(self.runningConversion.candidate.getInfoKey(),"%s not created"%(outname),WorkerStatus.ERROR)
          rtc=1
        else:
          self.setInfo(self.runningConversion.candidate.getInfoKey(),"conversion ok",WorkerStatus.NMEA)
      else:
        self.setInfo(self.runningConversion.candidate.getInfoKey(),"failed with status %d"%rtc,WorkerStatus.ERROR)

      if rtc == 0:
          self.setInfo("converter","successful for %s"%(self.runningConversion.candidate.name),WorkerStatus.STARTED)
      else:
          self.setInfo("converter","failed for %s"%(self.runningConversion.candidate.name),WorkerStatus.ERROR)
      candidate=self.runningConversion.candidate
      self.saveLastMd5(candidate.name,candidate.currentmd5 if rtc == 0 else '')
      self.runningConversion=None
      return candidate

  #delete an import dir/file
  #name being the name of a gemf file (without path)
  def deleteImport(self,name):
    if (name.endswith(".gemf")):
      name=name[:-5]
    if self.runningConversion is not None and self.runningConversion.candidate.name == name:
      try:
        self.runningConversion.stop()
        self.setInfo(self.runningConversion.candidate.getInfoKey(),"killed",WorkerStatus.INACTIVE)
        self.runningConversion=None
        self.setInfo("converter","killed for %s"%(name),WorkerStatus.ERROR)
      except:
        pass
    for candidate in self.candidates: # type: ConversionCandidate
      if candidate.name == name:
        fullname=candidate.filename
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
          if os.path.isfile(fullname):
            AVNLog.info("deleting import file %s",fullname)
            try:
              os.unlink(fullname)
            except:
              AVNLog.error("error deleting file %s:%s",fullname,traceback.format_exc())

  def getLogFileName(self,name,checkExistance=False):
    if name is None:
      return None
    logdir=AVNLog.getLogDir()
    logfilename="convert-"+name+".log"
    rt=os.path.join(logdir,logfilename)
    if not checkExistance:
      return rt
    if not os.path.exists(rt):
      return None
    return rt

  def runConverter(self,name,args):
    logdir=AVNLog.getLogDir()
    rt=None
    logfilename=''
    try:
      logfile=None
      if logdir is not None:
        logfilename=self.getLogFileName(name)
        try:
          logfile=open(logfilename,"w",encoding='utf-8')
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
      path,ext=os.path.splitext(name)
      if not ( ext.upper() in self.allExtensions()) :
        return AVNUtil.getReturnData(error="unknown file type %s"%ext)
      dir=self.importDir
      if subdir is not None:
        dir=os.path.join(self.importDir,subdir)
        if not os.path.isdir(dir):
          os.makedirs(dir)
        if not os.path.isdir(dir):
          return AVNUtil.getReturnData(error="unable to create directory %s"%dir)
      fname=os.path.join(dir,name)
      AVNDirectoryHandlerBase.writeAtomic(fname,handler.rfile,True,int(kwargs.get('flen')))
      return AVNUtil.getReturnData()

    if type == "api":
      command=AVNUtil.getHttpRequestParam(requestparam,"command",True)
      if (command == "extensions"):
        return AVNUtil.getReturnData(items=self.allExtensions())
      if (command == "getlog"):
        handler=kwargs.get('handler')
        name=AVNUtil.getHttpRequestParam(requestparam,"name",True)
        lastBytes=AVNUtil.getHttpRequestParam(requestparam,"lastBytes",False)
        logName=self.getLogFileName(name,True)
        if logName is None:
          return AVNUtil.getReturnData(error="log for %s not found"%name)
        filename=os.path.basename(logName)
        handler.writeFromDownload(
          AVNDownload(logName,lastBytes=lastBytes),filename=filename)
        return None
    return AVNUtil.getReturnData(error="unknown command for import")

  def registerConverter(self,id,converter:ConverterApi):
    with self.listlock:
      converters=[]
      for cnv in self.externalConverters:
        if cnv.id == id:
          if converter is not None:
            cnv.setConverter(converter)
            converters.append(cnv)
        else:
          converters.append(cnv)
      self.externalConverters=converters

  def deregisterConverter(self,id):
    self.registerConverter(id,None)

  def getInfo(self):
    rt= super().getInfo()
    return rt


avnav_handlerList.registerHandler(AVNImporter)



