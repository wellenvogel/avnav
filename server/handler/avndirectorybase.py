# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013-2021 Andreas Vogel andreas@wellenvogel.net
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
#  parts contributed by free-x https://github.com/free-x
#  parts contributed by Matt Hawkins http://www.raspberrypi-spy.co.uk/
#
###############################################################################
import io
import json
import shutil
import urllib.request, urllib.parse, urllib.error
from fileinput import filename
from zipfile import ZipFile
from typing import List

from avnav_manager import AVNHandlerManager
from avnav_nmea import *
from avnav_worker import *
from avnav_util import AVNDownload
from httphandler import RequestException
from httpserver import AVNHttpServer


class AVNDirectoryListEntry(object):
  '''
  a json serializable
  '''
  def serialize(self):
    return dict((key,value)
                for key,value in self.__dict__.items()
                if value is not None and not key.startswith("_") and key not in self.getFilteredKeys())

  @classmethod
  def getFilteredKeys(self):
    return []
  def __init__(self,type,name,time=0,size=0,
               canDelete=False,isDirectory=False,canDownload=True,
               extension=None,scope=None,url=None,filename=None,userData=None,displayName=None,downloadName=None,**kwargs):
    self.name=name
    self.displayName=displayName
    self.type=type
    self.url=url
    self.time=time
    self.size=size
    self.canDelete=canDelete
    self.isDirectory=isDirectory
    self.canDownload=canDownload
    self.extension=extension
    self.scope=scope
    self.downloadName=downloadName
    self._filename=filename
    self._userData=userData

  def getFileName(self):
      return self._filename
  def getUserData(self):
      return self._userData
  def setUserData(self,userData):
      self._userData=userData
  def isSame(self,other):
    # type: (AVNDirectoryListEntry) -> bool
    if other is None:
      return False
    if self.name != other.name:
        return False
    if self.isDirectory != other.isDirectory:
        return False
    if self.scope != other.scope:
        return False
    if self.extension != other.extension:
        return False

    return False

  def isModified(self, other):
    # type: (AVNDirectoryListEntry) -> bool
    if not self.isSame(other):
      return True
    if self.time != other.time or self.size != other.size:
      return True

    return False

  def getKey(self):
    return self.name
  def copy(self):
      rt=AVNDirectoryListEntry(self.type,self.name,self.time)
      rt.__dict__=self.__dict__.copy()
      return rt

class AVNDirectoryHandlerBase(AVNWorker):
  '''
  handle the files in the user directory
  '''
  SCOPE_USER="user."
  @classmethod
  def getPrefix(cls):
    return None
  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = {
      'interval': '5',
    }
    return rt


  @classmethod
  def preventMultiInstance(cls):
    return True
  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def getListEntryClass(cls):
    """
    get the class that should be used in the list functions
    must inherit from AVNDirectoryListEntry
    @return:
    """
    return AVNDirectoryListEntry

  def __init__(self,param,dtype):
    AVNWorker.__init__(self,param)
    self.baseDir=None
    self.type=dtype
    self.httpServer=None
    self.itemList={}
    self.lock = threading.Lock()

  def startInstance(self, navdata):
    self.httpServer=self.findHandlerByName(AVNHttpServer.getConfigName())
    if self.httpServer is None:
      raise Exception("unable to find AVNHttpServer")
    super().startInstance(navdata)


  def onPreRun(self):
    pass

  def periodicRun(self):
    pass

  def getFixedExtension(self):
      return None

  def getSleepTime(self):
    return self.getFloatParam('interval')

  # thread run method - just try forever
  def run(self):
    lastCleanup=0
    if not os.path.exists(self.baseDir):
      AVNLog.info("creating user dir %s"%self.baseDir)
      os.makedirs(self.baseDir)
    if not os.path.exists(self.baseDir):
      self.setInfo("main","unable to create %s"%self.baseDir,WorkerStatus.ERROR)
      AVNLog.error("unable to create user dir %s"%self.baseDir)
      return
    self.onPreRun()
    self.setInfo('main', "handling %s"%self.baseDir, WorkerStatus.NMEA)
    while not self.shouldStop():
      try:
        self.periodicRun()
      except:
        AVNLog.debug("%s: exception in periodic run: %s",self.getName(),traceback.format_exc())
      now=time.monotonic()
      if (lastCleanup+3600) < now or lastCleanup > now:
        try:
          self.cleanupTmp(self.baseDir)
          lastCleanup=now
        except Exception as e:
          AVNLog.error("exception in cleanup tmp %s"%str(e))
      sleepTime = self.getSleepTime()
      AVNLog.debug("main loop periodic run sleeping %f seconds",sleepTime)
      self.wait(sleepTime)
      AVNLog.debug("main loop periodic run")

  @classmethod
  def canDelete(self):
    return True


  def handleDelete(self,name):
    if not self.canDelete():
      raise Exception("delete not possible")
    fname=self.checkName(name)
    filename = os.path.join(self.baseDir, fname)
    if not os.path.exists(filename):
      raise Exception("file %s not found" % filename)
    os.unlink(filename)
    chartHandler = self.findHandlerByName('AVNChartHandler')
    if chartHandler is not None:
      chartHandler.deleteFromOverlays(self.type, name)

  @classmethod
  def canList(cls):
    return True

  def buildUrl(self,name,extension=None,scope=None):
      '''
      build an url if the handler supports this
      :param name: either the complete name below basedir (extension None) or the base name
      :param extension: the extension (if we have a fixed extension
      :param scope: the scope if
      :return:
      '''
      if self.getPrefix() is None:
          return None
      if scope is not None:
          return None
      if extension is not None:
          name=name+extension
      return self.getPrefix()+"/"+urllib.parse.quote(name.encode('utf-8'))

  def listDirectory(self,includeDirs=False,baseDir=None,extension=None,scope=None):
    # type: (bool,str,list[str]|None) -> list[AVNDirectoryListEntry]
    data = []
    if baseDir is None:
      baseDir=self.baseDir
    if not os.path.exists(baseDir):
      return []
    for f in os.listdir(str(baseDir)):
      if f.startswith(self.TMP_PREFIX):
          continue
      originalName=f
      fullname = os.path.join(str(baseDir), f)
      isDir=False
      ext=None
      if not os.path.isfile(fullname):
        if not includeDirs:
          continue
        isDir=True
      else:
        if extension is not None:
          (path,ext)=os.path.splitext(f)
          if ext != extension:
              continue
          f=path
      if scope is None:
          name=f
      else:
          name=scope + f
      element = self.getListEntryClass()(self.type, name,
                                      time=os.path.getmtime(fullname),
                                      size=os.path.getsize(fullname),
                                      filename=fullname,
                                      baseDir=baseDir,
                                      downloadName=originalName,
                                      canDelete=scope is None or scope == self.SCOPE_USER,
                                      isDirectory=isDir,
                                      extension=ext,
                                      scope=scope,
                                      url=self.buildUrl(name,ext,scope))
      data.append(element)
    return data

  def handleList(self,handler=None):
    if not self.canList():
      raise Exception("list not possible")
    if not os.path.exists(self.baseDir):
      return AVNUtil.getReturnData("directory %s does not exist" % self.baseDir)
    extensions = self.getFixedExtension()
    extensions = [extensions] if extensions is not None else None
    data=self.listDirectory(False,self.baseDir,extensions)
    rt = AVNUtil.getReturnData(items=data)
    return rt


  def checkName(self,name,doRaise=True):
    '''
    check a name received in a request and return the local file name
    this will be the name "as is" if self.getFixedExtension() is None, else the extension is appended
    :param name:
    :param doRaise:
    :return:
    '''
    if name is None:
      if doRaise:
          raise Exception("name can't be None")
      return None
    if name.startswith(self.TMP_PREFIX):
      if doRaise:
        raise Exception("name %s not allowed to start with %s"%(name,self.TMP_PREFIX))
      else:
        return None
    cleanName=AVNUtil.clean_filename(name)
    if name != cleanName:
      if doRaise:
        raise Exception("name %s is invalid"%name)
      return None
    extension=self.getFixedExtension()
    if extension is None:
        return name
    return name+extension

  def tryFallbackOrFail(self,requestParam,handler,error):
    if requestParam is None:
      raise Exception(error)
    url=AVNUtil.getHttpRequestParam(requestParam,"fallback")
    if url is None:
      raise Exception(error)
    if url[0] != '/':
      if handler is None:
        raise Exception("no handler")
      baseUrl=handler.getPageRoot()
      url=baseUrl+"/"+url
    rt=handler.translate_path(re.sub(r"\?.*","",url))
    if rt is None:
      raise Exception(error)
    return rt

  def getZipEntry(self,zipname,entryName,handler,requestParam=None):
    if not os.path.exists(zipname):
      return self.tryFallbackOrFail(requestParam, handler, "zip file %s not found" % zipname)
    zip = ZipFile(zipname)
    entry = None
    try:
      entry = zip.getinfo(entryName)
    except KeyError as e:
      pass
    if entry is None and (entryName.lower() == "doc.kml") and zipname.lower().endswith(".kmz"):
        # when looking for *.kmz/doc.kml, accept first .kml file found in root, regardless of name
        # just like it says in: https://developers.google.com/kml/documentation/kmzarchives#recommended-directory-structure
        for mbr in zip.infolist():
          if ('/' not in mbr.filename) and mbr.filename.lower().endswith('.kml'):
            entry = mbr
            break    
    if entry is None:
      return self.tryFallbackOrFail(requestParam, handler, "no entry %s in %s" % (entryName, zipname))
    handler.send_response(200)
    handler.send_header("Content-type", handler.getMimeType(entry.filename))
    handler.send_header("Content-Length", entry.file_size)
    fs = os.stat(zipname)
    handler.send_header("Last-Modified", handler.date_time_string(fs.st_mtime))
    handler.end_headers()
    if handler.command.lower() != 'head':
      handler.wfile.write(zip.read(entry))
    return True

  def convertLocalPath(self,path) -> (str,str or None):
    '''
    helper for getPathFromUrl
    @param path:
    @return: tuple name,basedir
             basedir can be None
    '''
    return (path,self.baseDir)
  def getPathFromUrl(self,path,handler=None,requestParam=None):
    """
    the path is already unqouted and utf8-decoded here
    @param path:
    @param handler:
    @param requestParam:
    @return:
    """
    #TODO: should we limit this to only one level?
    #we could use checkName and this way ensure that we only have one level
    subPath=self.httpServer.plainUrlToPath(path, False)
    (subPath,baseDir)=self.convertLocalPath(subPath)
    if subPath is None:
      return #not found
    #check for zip files in the path
    pathParts=subPath.split(os.sep)
    hasZip=False
    for part in pathParts:
      if part.lower().endswith(".zip") or part.lower().endswith(".kmz"):
        hasZip=True
        break
    if not hasZip:
      if baseDir is not None:
        return os.path.join(baseDir, subPath)
      else:
        return subPath
    currentPath=baseDir
    for k in range(0,len(pathParts)):
      part=pathParts[k]
      if currentPath is not None:
        currentPath=os.path.join(currentPath,part)
      if not os.path.exists(currentPath):
        return None
      if (part.lower().endswith(".zip") or part.lower().endswith('.kmz')) and k < (len(pathParts)-1):
        return self.getZipEntry(currentPath,"/".join(pathParts[k+1:]),handler,requestParam)
    if baseDir is not None:
      return os.path.join(baseDir,subPath)
    return subPath

  def handleSpecialApiRequest(self,command,requestparam,handler):
    raise Exception("unknown command for %s api request: %s" % (self.type, command))

  @classmethod
  def canUpload(self):
    return True

  @classmethod
  def canDownload(self):
    return True

  def getApiType(self):
    return self.type

  def getHandledPath(self):
      return  self.getPrefix()

  def _rename(self,fullName,targetName):
      src = os.path.join(self.baseDir, fullName)
      if not os.path.exists(src):
          raise Exception("file %s not found" % fullName)
      dst = os.path.join(self.baseDir, targetName)
      if os.path.exists(dst):
          raise Exception("%s already exists" % targetName)
      os.rename(src, dst)
      return AVNUtil.getReturnData()
  def handleRename(self,name,newName,requestparam):
    name=self.checkName(name)
    newName=self.checkName(newName)
    return self._rename(name,newName)

  def _upload(self,filename,handler,requestparam,overwrite=False):
      rlen = handler.headers.get("Content-Length")
      if rlen is None:
          raise RequestException("Content-Length not set in upload request",code=409)
      dooverwrite = overwrite or AVNUtil.getHttpRequestFlag(requestparam, 'overwrite')
      try:
        outname = os.path.join(self.baseDir, filename)
        data = AVNUtil.getHttpRequestParam(requestparam, '_json')
        if data is not None:
          stream = io.BytesIO(data.encode('utf-8'))
          self.writeAtomic(outname, stream, dooverwrite)
        else:
          self.writeAtomic(outname, handler.rfile, dooverwrite, int(rlen))
        return AVNUtil.getReturnData()
      except RequestException as r:
          raise r
      except Exception as e:
        raise RequestException(str(e), code=409)
  def handleUpload(self,name,handler,requestparam):
    filename = self.checkName(name)
    return self._upload(filename,handler,requestparam)

  def _download(self,fname):
      filename = os.path.join(self.baseDir, fname)
      if not os.path.exists(filename):
          raise Exception("file %s not found" % filename)
      return AVNDownload(filename)
  def handleDownload(self,name,handler,requestparam):
    if name is None:
      raise Exception("missing name")
    name=self.checkName(name)
    return self._download(name)

  def handlePathRequest(self, path, requestparam, server=None,handler=None):
      if self.getPrefix() is None:
        raise Exception("Internal error: no handler prefix for %s"%path)
      if not path.startswith(self.getPrefix()+"/"):
        raise Exception("Internal routing error: handler prefix %s for %s" % (self.getPrefix(),path))
      path = path[len(self.getPrefix()) + 1:]
      return self.getPathFromUrl(path,handler=handler,requestParam=requestparam)

  def handleApiRequest(self, command, requestparam, handler=None, **kwargs):
    name = AVNUtil.getHttpRequestParam(requestparam, 'name')
    if command == 'rename':
        if name is None:
          raise Exception("parameter name missing for rename")
        newName=AVNUtil.getHttpRequestParam(requestparam,'newName',True)
        return self.handleRename(name,newName,requestparam)
    elif command == 'delete':
        self.handleDelete(name)
        return AVNUtil.getReturnData()
    elif command == 'list':
        return self.handleList(handler)
    elif command == 'upload':
      return self.handleUpload(name,handler,requestparam)
    elif command == 'download':
      return self.handleDownload(name,handler,requestparam)
    elif command == 'delete':
      self.handleDelete(name)
      return AVNUtil.getReturnData()
    else:
        return self.handleSpecialApiRequest(command,requestparam,handler)

  TMP_PREFIX='__avn.'
  tmpCount=0
  tmpLock=threading.Lock()
  @classmethod
  def getTmpFor(cls,name):
    (dir,fn)=os.path.split(name)
    with cls.tmpLock:
      cls.tmpCount+=1
      return os.path.join(dir,cls.TMP_PREFIX+str(cls.tmpCount)+"."+fn)
  @classmethod
  def writeAtomic(cls,outname,instream,overwrite,requestedLength=-1):
    if not overwrite and os.path.exists(outname):
      raise Exception("outname already exists")
    tmp=cls.getTmpFor(outname)
    with open(tmp,"wb") as oh:
      bRead=0
      length=16*1024
      while True:
        bToRead=length
        if requestedLength >=0:
          if bToRead > (requestedLength-bRead):
            bToRead=requestedLength-bRead
        if bToRead <= 0:
          break
        buf = instream.read(bToRead)
        if not buf:
          break
        oh.write(buf)
        bRead+=bToRead
      oh.close()
      instream.close()
    if requestedLength >= 0:
      sz=os.stat(tmp).st_size
      if sz != requestedLength:
        os.unlink(tmp)
        raise Exception("not all bytes copied (%d from %d)"%(sz,requestedLength))
    os.replace(tmp,outname)

  @classmethod
  def cleanupTmp(cls,dir):
    if dir is None:
      return
    if not os.path.isdir(dir):
      return
    now=time.time()
    removeTime=now-3600
    for f in os.listdir(dir):
      if not f.startswith(cls.TMP_PREFIX):
        continue
      fn=os.path.join(dir,f)
      mtime=os.stat(fn).st_mtime
      if mtime > time.time() or mtime < removeTime:
        os.unlink(fn)


class AVNScopedDirectoryHandler(AVNDirectoryHandlerBase):
  SCOPE_SYSTEM='system.'
  SCOPE_PLUGIN='plugin.'
  '''
  a handler for items that can be located in a system directory (read only),
  a user directory and can be added by plugins
  it only can handle fixed extensions
  '''
  def __init__(self, param,type,fixedExtension):
    super().__init__(param, type)
    self.baseDir= AVNHandlerManager.getDirWithDefault(self.param,'userDir',type)
    self.systemDir=None
    self.systemItems: List[AVNDirectoryListEntry]  =[]
    self.pluginItems : List[AVNDirectoryListEntry] =[]
    self.extension=fixedExtension

  def getFixedExtension(self):
      return self.extension

  def getSystemDir(self):
    '''
    will be called initially in onPreRun to set the system dir
    @return:
    '''
    return None
  def onPreRun(self):
    super().onPreRun()
    self.systemDir = self.getSystemDir()
    if self.systemDir is not None:
      self.systemItems=self.listDirectory(baseDir=self.systemDir,scope=self.SCOPE_SYSTEM,extension=self.getFixedExtension())


  def handleList(self, handler=None):
    own=self.listDirectory(baseDir=self.baseDir,scope=self.SCOPE_USER,extension=self.getFixedExtension())
    with self.lock:
      items=self.systemItems+self.pluginItems+own
      return AVNUtil.getReturnData(items=items)

  def checkName(self, name, doRaise=True,scope=AVNDirectoryHandlerBase.SCOPE_USER):
      name=super().checkName(name, doRaise)
      if scope is not None:
          if not name.startswith(scope):
              raise Exception(f"name {name} does not match scope {scope}")
          return name[len(scope):]
      return name

  def handleDelete(self, name):
    name=self.checkName(name,scope=self.SCOPE_USER)
    fname=os.path.join(self.baseDir,name)
    if not os.path.isfile(fname):
      raise Exception("%s %s not found"%(self.type,name))
    os.unlink(fname)
    return AVNUtil.getReturnData()

  def handleRename(self, name, newName, requestparam):
    name=self.checkName(name,scope=self.SCOPE_USER)
    newName=self.checkName(newName,scope=self.SCOPE_USER)
    return self._rename(name,newName)

  def handleUpload(self, name, handler, requestparam):
    fname=self.checkName(name,scope=self.SCOPE_USER)
    return self._upload(fname,handler,requestparam)

  def findSystemOrPluginItem(self,name):
      with self.lock:
          for item in self.systemItems:
              if item.name == name:
                  return item
          for item in self.pluginItems:
              if item.name == name:
                  return item
      return None

  def handleDownload(self, name, handler, requestparam):
      item=self.findSystemOrPluginItem(name)
      if item is not None:
          if item.scope == self.SCOPE_SYSTEM:
            sname=self.checkName(name,scope=self.SCOPE_SYSTEM)
            sfile=os.path.join(self.baseDir,sname)
            if not os.path.isfile(sfile):
                raise Exception("%s %s not found"%(self.type,sfile))
            return AVNDownload(sfile)
          elif item.scope.startswith(self.SCOPE_PLUGIN):
            sfile=item.getFileName()
            if not os.path.isfile(sfile):
                raise Exception("%s %s not found"%(self.type,sfile))
            return AVNDownload(sfile)


      fname=self.checkName(name,scope=self.SCOPE_USER)
      return self._download(fname)


  def registerPluginItem(self,pluginName,name,fileName):
    if not os.path.exists(fileName):
      return False
    scope=self.SCOPE_PLUGIN+pluginName+"."
    if name.endswith(self.extension):
        raise Exception(f"the item name must not end with {self.extension}")
    self.checkName(scope+name,scope=self.SCOPE_PLUGIN)
    AVNLog.debug("register plugin item %s",name)
    info=AVNDirectoryListEntry(self.type, scope+ name, time=os.path.getmtime(fileName),
                                 baseDir=os.path.dirname(fileName),
                                 fileName=fileName,
                                 scope=scope,
                                 extension=self.getFixedExtension())
    if self.findSystemOrPluginItem(info.name) is not None:
      AVNLog.error("trying to register an already existing plugin item %s",name)
      return False
    with self.lock:
      self.pluginItems.append(info)
    return True

  def deregisterPluginItem(self,pluginName,name):
    scope=self.SCOPE_PLUGIN+pluginName+"."
    AVNLog.debug("deregister plugin item %s%s",scope,name)
    existing=self.findSystemOrPluginItem(scope+name)
    if not existing:
      AVNLog.error("item %s not found",name)
      return False
    with self.lock:
      self.pluginItems.remove(existing)
    return True


