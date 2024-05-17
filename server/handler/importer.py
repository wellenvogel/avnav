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
import json
import shutil

import avnav_handlerList
from avnav_api import ConverterApi
from avnav_manager import AVNHandlerManager
from avnav_util import *
from avnav_worker import *
from avndirectorybase import AVNDirectoryHandlerBase
from httpserver import AVNHttpServer
import zipfile

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

  def getName(self):
    if hasattr(self._converter,'getName'):
      return self._converter.getName()
    return super().getName()

  def getZipSubDir(self, outname):
    if hasattr(self._converter,'getZipSubDir'):
      return self._converter.getZipSubDir(outname)
    return outname

  def allowSubDir(self):
    if hasattr(self._converter,'allowSubDir'):
      return self._converter.allowSubDir()
    return super().allowSubDir()


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
  def _handleZipFile(self,md5,fn):
    rt=0
    try:
      zip=zipfile.ZipFile(fn)
      for info in zip.infolist():
        if info.is_dir():
          continue
        if self._canHandle(info.filename):
          rt+=1
          md5.update(info.filename.encode(errors="ignore"))
          md5.update(str(info.date_time).encode(errors='ignore'))
          md5.update(str(info.file_size).encode(errors="ignore"))
      zip.close()
      return rt
    except Exception as e:
      self._logger.error("unable to handle zipfile %s:%s"%(fn,traceback.format_exc()))
      return 0
  def _handleFile(self,md5,fn):
    if self._canHandle(fn):
      if fn.upper().endswith('.ZIP'):
        return self._handleZipFile(md5,fn)
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

  def allowSubDir(self):
    return False


class GdalConverter(InternalConverter):
  EXTENSIONS=['kap','map','geo','eap']
  def __init__(self, converterPath:str,chartDir:str,workDir:str):
    super().__init__(self.EXTENSIONS,chartDir)
    self._converter=converterPath
    self._workdir=workDir

  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,"-o",self.getOutFileOrDir(outname),
            "-b",os.path.join(self._workdir,outname),"-g","-t","1",input]

  def getName(self):
    return 'builtin-gdal'

  def allowSubDir(self):
    return True

class GdalZipConverter(GdalConverter):
  def __init__(self, converterPath: str, chartDir: str, workDir: str):
    super().__init__(converterPath, chartDir, workDir)

  def getName(self):
    return 'builtin-gdal-zip'

  def allowSubDir(self):
    return False

  def handledExtensions(self):
    return ['.ZIP']

  def _canHandle(self, fn):
    sh=super()._canHandle(fn)
    if sh:
      return sh
    return fn.upper().endswith('.ZIP')


class NavipackConverter(InternalConverter):
  EXTENSIONS=["navipack"]
  def __init__(self,converterPath:str,chartDir:str):
    super().__init__(self.EXTENSIONS,chartDir)
    self._converter=converterPath

  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,self.getOutFileOrDir(outname),input]

  def getName(self):
    return 'builtin-navipack'


class MbtilesConverter(InternalConverter):
  EXTENSIONS=['mbtiles']
  def __init__(self, converterPath:str,chartDir: str):
    super().__init__(self.EXTENSIONS, chartDir)
    self._converter=converterPath
  def getConverterCommand(self, input, outname):
    return [sys.executable,self._converter,self.getOutFileOrDir(outname),input]

  def getName(self):
    return 'builtin-mbtiles'


class ConversionResult:
  def __init__(self,md5,error=None,ts=None,disabled=False):
    self.error=error
    self.md5=md5
    self.ts=ts if ts is not None else time.time()
    self.disabled=disabled
  def valid(self):
    return self.md5 is not None
  def dateStr(self):
    return datetime.datetime.fromtimestamp(self.ts).strftime('%Y-%m-%d %H:%M')
  def isOk(self):
    return self.error is None
  def isDisabled(self):
    return self.disabled


class ConversionCandidate:
  KPRFX="conv:"
  class State(Enum):
    SETTLE=1
    CONVERTING=2
    DONE=3
    NOCONV=4
    DONENC=5 #done but no converter
    ERROR=6
    DISABLED=7
  def __init__(self,name,filename):
    self.name=name # type: str
    self.filename=filename # type: str
    self.realName=filename
    self.converter=None # type: ConverterApi
    self.score=0
    self.currentmd5=None # type: str
    self.timestamp=time.monotonic()
    self.result=ConversionResult(None)
    self.running=False
  def isDir(self):
    return os.path.isdir(self.realName)
  def update(self,other):
    if other is None or other.name != self.name:
      return
    self.converter=other.converter
    self.score=other.score
    self.currentmd5=other.currentmd5
    self.timestamp=other.timestamp
    self.result=other.result
    self.running=other.running
  def md5changed(self):
    return self.currentmd5 != self.result.md5
  def hasChanged(self,other):
    return self.currentmd5 != other.currentmd5
  def getOutName(self):
    return self.converter.getOutFileOrDir(self.name)
  def getInfoKey(self):
    return "%s%s"%(self.KPRFX,self.name)
  def _isConverted(self):
    return self.result.valid() and self.result.isOk()
  def hasError(self):
    return not self.result.isOk()
  def isDisabled(self):
    return self.result.isDisabled()
  def getState(self):
    if self.running:
      return self.State.CONVERTING
    if self.hasError():
      return self.State.ERROR
    if self.isDisabled():
      return self.State.DISABLED
    if self.score == 0:
      if self._isConverted():
        return self.State.DONENC
      else:
        return self.State.NOCONV
    if self.md5changed():
      return self.State.SETTLE
    if self._isConverted():
      return self.State.DONE
    return self.State.ERROR
  def getWstate(self,st=None):
    if st is None:
      st=self.getState()
    if st == self.State.CONVERTING:
      return WorkerStatus.NMEA
    if st == self.State.DONENC:
      return WorkerStatus.INACTIVE
    if st == self.State.NOCONV:
      return WorkerStatus.ERROR
    if st == self.State.SETTLE:
      return WorkerStatus.RUNNING
    if st == self.State.DONE:
      return WorkerStatus.INACTIVE
    if st == self.State.DISABLED:
      return WorkerStatus.INACTIVE
    return WorkerStatus.ERROR
  def getStateInfo(self,st=None):
    if st is None:
      st=self.getState()
    if st == self.State.CONVERTING:
      return "converting %d files"%self.score
    if st == self.State.DONENC:
      return "no converter yet but converted at %s"%self.result.dateStr()
    if st == self.State.NOCONV:
      return "no converter"
    if st == self.State.SETTLE:
      return "changed, waiting to settle (%d files)"%self.score
    if st == self.State.DONE:
      return "converted at %s"%self.result.dateStr()
    if st == self.State.DISABLED:
      return "disabled"
    return "conversion failed at %s: %s"%(self.result.dateStr(),str(self.result.error))
  def getFileOrDir(self):
    return self.realName
  def couldConvert(self):
    if self.isDisabled() or self.hasError() or self.score < 1:
      return False
    return self.md5changed()
  def getConverterName(self):
    if self.converter is None:
      return 'NONE'
    return self.converter.getName()

class Conversion:
  def __init__(self,process,candidate:ConversionCandidate):
    self.process=process
    self.candidate=candidate
    self.timestamp=time.monotonic()
    self.running=True

  def stop(self):
    if not self.running:
      return -1
    self.process.kill()
    self.running=False
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
  P_WAITTIME=WorkerParameter('dirsettle',30,type=WorkerParameter.T_NUMBER,
                             description='time to wait in seconds before a conversion is started after detecting a change of a directory (settle time)')
  P_FWAITTIME=WorkerParameter('filesettls',10,type=WorkerParameter.T_NUMBER,
                             description='time to wait in seconds before a conversion is started after detecting a change of a directory (settle time)')
  P_SCANINTERVAL=WorkerParameter('scanInterval', 0, type=WorkerParameter.T_NUMBER,
                             description='seconds between import dir scan, 0 to disable automatic scan')
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
      cls.P_FWAITTIME,
      cls.P_SCANINTERVAL
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

  @classmethod
  def preventMultiInstance(cls):
    return True
  INFO_MAIN="main"
  INFO_CONVERTER="converter"
  EXT_LINK=".CLK"
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.importDir=None
    self.lastTimeStamps={}    #a dictionary of timestamps - key is the directory/filename, value the last read timestamp
    self.candidateTimes={}    #dictionary with candidates for conversion - same layout as lastTimeStamps
    self.runningConversion=None # type: Conversion
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
    httpserver=self.findHandlerByName(AVNHttpServer.getConfigName())
    if httpserver is None:
      raise Exception("unable to find the httpserver")
    self.chartbase=httpserver.getChartBaseDir()
    if self.chartbase is None or not os.path.isdir(self.chartbase):
      AVNLog.error("chartbase directory not found, stopping converter")
      return
    self.converters.append(GdalConverter(os.path.join(self.converterDir,"read_charts.py"),self.chartbase,self.workDir))
    self.converters.append(GdalZipConverter(os.path.join(self.converterDir,"read_charts.py"),self.chartbase,self.workDir))
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

  def _syncInfo(self,candidates):
    keys=set()
    for c in candidates: # type: ConversionCandidate
      keys.add(c.getInfoKey())
      self.setInfo(c.getInfoKey(),c.getStateInfo(),c.getState())
    def check(k,v):
      if not k.startswith(ConversionCandidate.KPRFX):
        return True
      return k in keys
    self.cleanupInfo(check)
  #thread run method - just try forever  
  def run(self):
    self.setInfo(self.INFO_MAIN,"monitoring started for %s"%(self.importDir),WorkerStatus.NMEA)
    self.setInfo(self.INFO_CONVERTER,"free",WorkerStatus.STARTED)
    waitingCandidates={}
    while not self.shouldStop():
      waittime=self.getWParam(self.P_WAITTIME)
      fwaittime=self.getWParam(self.P_FWAITTIME)
      AVNLog.debug("mainloop")
      currentCandidates=self.readImportDir()
      self.candidates=currentCandidates
      foundNames=set()
      if self.runningConversion is None:
        self.setInfo(self.INFO_MAIN,"scanning",WorkerStatus.NMEA)
        now=time.monotonic()
        for k in currentCandidates:
          foundNames.add(k.name)
          if not k.couldConvert():
            try:
              del waitingCandidates[k.name]
            except:
              pass
            continue
          existing=waitingCandidates.get(k.name)
          startConversion=False
          if existing is not None:
            if existing.hasChanged(k):
              waitingCandidates[k.name]=k
            else:
              wt=waittime if k.isDir() else fwaittime
              if (existing.timestamp+wt) < now:
                startConversion=True
                waitingCandidates[k.name]=k
          else:
            waitingCandidates[k.name]=k
          if not startConversion:
            continue
          rs=self.startConversion(k)
          if not rs:
            try:
              del waitingCandidates[k.name]
            except:
              pass
          else:
            break
        #remove any waiting entries that are not there any more
        candidateKeys=list(waitingCandidates.keys())
        for ckey in candidateKeys:
          if not ckey in foundNames:
            try:
              del waitingCandidates[ckey]
            except:
              pass
      else:
        AVNLog.debug("conversion(s) running, skip check")
        for k in currentCandidates:
          if k.name == self.runningConversion.candidate.name:
            k.running=True
      candidate=self.checkConversionFinished()
      if candidate is not None:
        try:
          del waitingCandidates[candidate.name]
        except:
          pass
        for ac in self.candidates:
          if ac.name == candidate.name:
            ac.update(candidate)
      self._syncInfo(self.candidates)
      if candidate is not None:
        #immediately scan again as we could start the next
        continue
      if self.runningConversion is not None or len(waitingCandidates.keys())> 0:
        self.setInfo(self.INFO_MAIN,"scanning",WorkerStatus.NMEA)
        self.wait(min(waittime,fwaittime)/5)
      else:
        idlewait=self.getWParam(self.P_SCANINTERVAL)
        if idlewait <= 0:
          idlewait=24*3600 #1day
        self.setInfo(self.INFO_MAIN,"pausing for %d seconds"%idlewait,WorkerStatus.STARTED)
        self.wait(idlewait)
    if self.runningConversion is not None:
      self.runningConversion.stop()

  def allExtensions(self,fullInfo=False):
    extensions=[]
    def addExt(ext,sub=False):
      ext=ext.upper()
      if not ext.startswith('.'):
        ext='.'+ext
      if fullInfo:
        extensions.append({'ext':ext,'sub':sub})
      else:
        extensions.append(ext)
    addExt(self.EXT_LINK)
    converters=self._getConverters()
    for converter in converters: # type: ConverterApi
      cnvext=converter.handledExtensions()
      allowSub=converter.allowSubDir()
      for cnv in cnvext:
        addExt(cnv,allowSub)
    return extensions

  def getResultName(self,name):
    return os.path.join(self.importDir,"_"+name)
  def saveLastResult(self, name, result:ConversionResult):
    fn=self.getResultName(name)
    try:
      data=json.dumps(result.__dict__)
      with open(fn,"w") as h:
        h.write(data)
        return True
    except:
      return False

  def getLastResult(self, name):
    fn=self.getResultName(name)
    rt=ConversionResult(None,"unable to read result")
    if not os.path.exists(fn):
      rt.error=None
      return rt
    try:
      with open(fn,"r") as h:
        raw=json.load(h)
        for k,v in raw.items():
          if hasattr(rt,k):
            setattr(rt,k,v)
        return rt
    except:
      try:
        os.unlink(fn)
      except:
        pass
      return rt
  def deleteLastResult(self,name):
    resultname=self.getResultName(name)
    try:
      os.unlink(resultname)
      return True
    except:
      return False

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
      name=self.getNameFromImport(file)
      candidate=ConversionCandidate(name,fullname)
      if file.upper().endswith(self.EXT_LINK):
        #file contains a link to the real file/dir
        error=None
        realName=None
        try:
          with open(fullname,"r") as h:
            realName=h.readline().rstrip()
        except Exception as e:
          error=str(e)
        if realName is None:
          error="no filename in %s"%file
        if error is None:
          if not os.path.exists(realName):
            error="%s not found"%realName
        if error is not None:
          candidate.result=ConversionResult(None,error=error)
        else:
          candidate.realName=realName
      if not candidate.hasError():
        for cnv in self._getConverters(): # type: ConverterApi
          try:
            cs,currentmd5=cnv.countConvertibleFiles(candidate.getFileOrDir())
            if cs > candidate.score:
              candidate.converter=cnv
              candidate.score=cs
              candidate.currentmd5=currentmd5
          except Exception as e:
            AVNLog.error("error reading import dir for converter %s",traceback.format_exc())
        if candidate.score < 1:
          AVNLog.debug("unknown import %s",fullname)
        candidate.result=self.getLastResult(name)
      else:
        self.saveLastResult(candidate.name,candidate.result)
      rt.append(candidate)
    return rt


  def startConversion(self,candidate:ConversionCandidate):
    AVNLog.info("starting conversion for %s",candidate.name)
    now=time.time()
    self.setInfo(self.INFO_CONVERTER,"running for %s"%(candidate.name),WorkerStatus.NMEA)
    cmd=candidate.converter.getConverterCommand(candidate.getFileOrDir(),candidate.name)
    po=self.runConverter(candidate.name,cmd)
    if po is None:
      AVNLog.error("unable to start conversion for %s - don't know how to handle it",candidate.name)
      self.setInfo(self.INFO_CONVERTER,"start for %s failed - don't know how to handle"%(candidate.name,),WorkerStatus.ERROR)
      return False
    candidate.running=True
    self.runningConversion=Conversion(po,candidate)

  def checkConversionFinished(self):
    if self.runningConversion is None:
      return
    if not self.runningConversion.running:
      self.setInfo(self.INFO_CONVERTER,"killed for %s"%(self.runningConversion.candidate.name),WorkerStatus.ERROR)
      candidate=self.runningConversion.candidate
      self.runningConversion=None
      self.saveLastResult(candidate.name, ConversionResult(None,"killed"))
      return candidate
    rtc=self.runningConversion.process.poll()
    if rtc is None:
      AVNLog.debug("converter for %s still running",self.runningConversion.candidate.name)
      return
    else:
      AVNLog.info("finished conversion for %s with return code %d",self.runningConversion.candidate.name,rtc)
      result=ConversionResult(self.runningConversion.candidate.currentmd5)
      if rtc == 0:
        outname=self.runningConversion.candidate.getOutName()
        if not os.path.exists(outname):
          result.error="%s not created"%(outname)
          rtc=1
      else:
        result.error="failed with status %d"%rtc
      if rtc == 0:
          self.setInfo(self.INFO_CONVERTER,"successful for %s"%(self.runningConversion.candidate.name),WorkerStatus.STARTED)
      else:
          self.setInfo(self.INFO_CONVERTER,"failed for %s"%(self.runningConversion.candidate.name),WorkerStatus.ERROR)
      candidate=self.runningConversion.candidate
      candidate.result=result
      candidate.running=False
      self.saveLastResult(candidate.name, result)
      self.runningConversion=None # type: Conversion
      return candidate

  #delete an import dir/file
  #name being the name of a gemf file (without path)
  def deleteImport(self,name):
    if (name.endswith(".gemf")):
      name=name[:-5]
    candidate=self.findCandidate(name)
    if candidate is not None:
      self.deleteImportByCandidate(candidate)
  def stopConversion(self,name=None):
    running=self.runningConversion
    if running is not None and (name is None or running.candidate.name == name) and running.running:
      running.stop()

  def deleteImportByCandidate(self,candidate):
    try:
      self.stopConversion(candidate.name)
    except:
      pass
    fullname=candidate.filename
    self.deleteLastResult(candidate.name)
    workdir=os.path.join(self.workDir,candidate.name)
    if os.path.isdir(workdir):
      try:
        shutil.rmtree(workdir)
      except:
        pass
    logfile=self.getLogFileName(candidate.name)
    if os.path.exists(logfile):
      try:
        os.unlink(logfile)
      except:
        pass
    rt=False
    if os.path.isdir(fullname):
      AVNLog.info("deleting import directory %s",fullname)
      try:
        shutil.rmtree(fullname)
        rt=True
      except:
        AVNLog.error("error deleting directory %s:%s",fullname,traceback.format_exc())
    else:
      if os.path.isfile(fullname):
        AVNLog.info("deleting import file %s",fullname)
        try:
          os.unlink(fullname)
          rt=True
        except:
          AVNLog.error("error deleting file %s:%s",fullname,traceback.format_exc())
    self.wakeUp()
    return True

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

  def findCandidate(self,key,isName=False):
    currentCandidates=self.candidates #thread safe copy
    for c in currentCandidates: # type: ConversionCandidate
      if isName:
        if c.name == key:
          return c
      else:
        if c.getInfoKey() == key:
          return c

  def checkDuplicateName(self,dir,name):
    '''
    check if there is a file with the same name but different extension
    @param dir:
    @param name:
    @return:
    '''
    path,ext=os.path.splitext(name)
    for f in os.listdir(dir):
      fpath,fext=os.path.splitext(f)
      if fpath == path and fext != ext:
        return f

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == "list":
      status=self.getInfo(['main','converter'])
      items=[]
      if status is not None and status.get('items') is not None:
        items=status['items']
      candidates=self.candidates
      for can in candidates: # type: ConversionCandidate
        canDownload=False
        st=can.getState()
        if st == ConversionCandidate.State.DONE or st == ConversionCandidate.State.DONENC:
          if can.converter is not None:
            downloadFile=can.converter.getOutFileOrDir(can.name)
            if downloadFile is not None and os.path.exists(downloadFile):
              canDownload=True
        hasLog=self.getLogFileName(can.name,True) is not None
        path,ext=os.path.splitext(can.filename)
        basename=os.path.basename(path)+ext
        canst={
          'name':ConversionCandidate.KPRFX+can.name,
          'istate':can.getState(),
          'status':can.getWstate(),
          'info':can.getStateInfo(),
          'fullname':can.filename,
          'basename':basename,
          'running':can.running,
          'converter':can.getConverterName(),
          'canDownload': canDownload,
          'hasLog': hasLog}
        if can.getFileOrDir() != can.filename:
          canst['realname']=can.getFileOrDir()
        items.append(canst)
      return AVNUtil.getReturnData(items=items)
    if type == "delete":
      name=AVNUtil.getHttpRequestParam(requestparam,'name',True)
      if not name.startswith('conv:'):
        return AVNUtil.getReturnData(error="unknown item "+name)
      candidate=self.findCandidate(name)
      if candidate is None:
        return AVNUtil.getReturnData(error="item %s not found"%name)
      if not self.deleteImportByCandidate(candidate):
        return AVNUtil.getReturnData(error="unable to delete")
      self.wakeUp()
      return AVNUtil.getReturnData()
    if type == "download":
      name=AVNUtil.getHttpRequestParam(requestparam,'name',True)
      candidate=self.findCandidate(name)
      if candidate is None:
        return AVNDownloadError("item %s not found"%name)
      dlfile=None
      if candidate.converter is not None:
        dlfile=candidate.converter.getOutFileOrDir(candidate.name)
      if dlfile is None:
        return AVNDownloadError("no download for %s"%name)
      if not os.path.exists(dlfile):
        return AVNDownloadError("%s not found"%dlfile)
      if os.path.isdir(dlfile):
        subDir=candidate.name
        if hasattr(candidate.converter,'getZipSubDir'):
          subDir=candidate.converter.getZipSubDir(candidate.name)
        return AVNZipDownload(candidate.name+".zip",dlfile,subDir)
      filename=os.path.basename(dlfile)
      return AVNDownload(dlfile,dlname=filename)

    if type == "upload":
      handler=kwargs.get('handler')
      if handler is None:
        return AVNUtil.getReturnData(error="no handler")
      name=AVNUtil.clean_filename(AVNUtil.getHttpRequestParam(requestparam,"name",True))
      subdir=AVNUtil.clean_filename(AVNUtil.getHttpRequestParam(requestparam,"subdir",False))
      path,ext=os.path.splitext(name)
      if not ( ext.upper() in self.allExtensions() or ext.upper() == self.EXT_LINK) :
        return AVNUtil.getReturnData(error="unknown file type %s"%ext)
      if name.startswith("_"):
        return AVNUtil.getReturnData(error="names with starting _ not allowed")
      if ext.upper() == '.ZIP':
        #no subdir for zip files
        subdir=None
      dir=self.importDir
      if subdir is not None:
        dir=os.path.join(self.importDir,subdir)
        if not os.path.isdir(dir):
          os.makedirs(dir)
        if not os.path.isdir(dir):
          return AVNUtil.getReturnData(error="unable to create directory %s"%dir)
      dupl=self.checkDuplicateName(dir,name)
      if dupl is not None:
        return AVNUtil.getReturnData(error="name conflict with %s (same base)"%dupl)
      fname=os.path.join(dir,name)
      AVNDirectoryHandlerBase.writeAtomic(fname,handler.rfile,True,int(kwargs.get('flen')))
      self.wakeUp()
      return AVNUtil.getReturnData()

    if type == "api":
      command=AVNUtil.getHttpRequestParam(requestparam,"command",True)
      if (command == "extensions"):
        return AVNUtil.getReturnData(items=self.allExtensions(True))
      if (command == "getlog"):
        handler=kwargs.get('handler')
        name=AVNUtil.getHttpRequestParam(requestparam,"name",True)
        lastBytes=AVNUtil.getHttpRequestParam(requestparam,"maxBytes",False)
        candidate=None
        rt=None
        if name == '_current':
          running=self.runningConversion
          if running is not None and running.running:
            candidate=self.runningConversion.candidate
          if candidate is None:
            rt=AVNDownloadError("no conversion running")
        else:
          candidate=self.findCandidate(name)
        if rt is None:
          if candidate is None:
            rt=AVNDownloadError("%s not found"%name)
        if rt is None:
          logName=self.getLogFileName(candidate.name,True)
          if logName is None:
            rt=AVNDownloadError("log for %s not found"%name)
          if rt is None:
            filename=os.path.basename(logName)
            rt=AVNDownload(logName,lastBytes=lastBytes,dlname=filename)
        handler.writeFromDownload(rt)
        return None
      if command == 'cancel':
        running=self.runningConversion
        if running is None or not running.running:
          return AVNUtil.getReturnData(error="no conversion running")
        name=AVNUtil.getHttpRequestParam(requestparam,"name",False)
        if name is not None and name != (ConversionCandidate.KPRFX+running.candidate.name):
          return AVNUtil.getReturnData(error="%s not running any more"%name)
        self.stopConversion(running.candidate.name)
        self.wakeUp()
        return AVNUtil.getReturnData()
      if command == 'restart':
        name=AVNUtil.getHttpRequestParam(requestparam,"name",True)
        candidate=self.findCandidate(name)
        if candidate is None:
          return AVNUtil.getReturnData(error="%s not found"%name)
        if candidate.getState() == ConversionCandidate.State.CONVERTING:
          return AVNUtil.getReturnData(error="%s currently converting"%name)
        self.deleteLastResult(candidate.name)
        self.wakeUp()
        return AVNUtil.getReturnData()
      if command == 'disable':
        name=AVNUtil.getHttpRequestParam(requestparam,"name",True)
        candidate=self.findCandidate(name)
        if candidate is None:
          return AVNUtil.getReturnData(error="%s not found"%name)
        if candidate.getState() == ConversionCandidate.State.CONVERTING:
          return AVNUtil.getReturnData(error="%s currently converting"%name)
        self.saveLastResult(candidate.name,ConversionResult(None,disabled=True))
        self.wakeUp()
        return AVNUtil.getReturnData()
      if command == 'rescan':
        self.wakeUp()
        return AVNUtil.getReturnData()
    return AVNUtil.getReturnData(error="unknown command for import")

  def registerConverter(self,id,converter:ConverterApi):
    with self.listlock:
      converters=[]
      found=False
      for cnv in self.externalConverters:
        if cnv.id == id:
          if converter is not None:
            cnv.setConverter(converter)
            converters.append(cnv)
            found=True
        else:
          converters.append(cnv)
      if not found and converter is not None:
        converters.append(ExternalConverter(converter,id))
      self.externalConverters=converters
    self.wakeUp()

  def deregisterConverter(self,id):
    self.registerConverter(id,None)



avnav_handlerList.registerHandler(AVNImporter)



