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
from zipfile import ZipFile
from typing import List
from avnav_manager import AVNHandlerManager
from avnav_nmea import *
from avnav_worker import *
from avnav_util import AVNDownload
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
  def __init__(self,type,prefix,name,time=0,size=0,
               canDelete=False,isDirectory=False,canDownload=True,**kwargs):
    self.name=name
    self.type=type
    self.prefix=prefix
    self.url=prefix+"/"+urllib.parse.quote(name.encode('utf-8'))
    self.time=time
    self.size=size
    self.canDelete=canDelete
    self.isDirectory=isDirectory
    self.canDownload=canDownload

  def isSame(self,other):
    # type: (AVNDirectoryListEntry) -> bool
    if other is None:
      return False
    if self.name == other.name and self.prefix == other.prefix and self.isDirectory == other.isDirectory:
      return True
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


class AVNDirectoryHandlerBase(AVNWorker):
  '''
  handle the files in the user directory
  '''
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
  def nameToUrl(cls,name):
    return cls.getPrefix()+"/"+urllib.parse.quote(name.encode('utf-8'))

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

  @classmethod
  def getAutoScanExtensions(cls):
    """
    if a derived class overloads this
    there will be a periodic reading of the directory
    and self.itemList will be filled with descriptions of the type
    the key will be the value returned by getKey of the item description
    returned by getListEntryClass (the must inherit from AVNDirectoryListEntry
    Callbacks:
    #onItemAdd when a new entry is to be added
    #onItemRemove when an entry has been removed from the list
    @return:
    """
    return []

  @classmethod
  def autoScanIncludeDirectories(cls):
    return False

  def __init__(self,param,type):
    AVNWorker.__init__(self,param)
    self.baseDir=None
    self.type=type
    self.httpServer=None
    self.itemList={}
    self.lock = threading.Lock()

  def startInstance(self, navdata):
    self.httpServer=self.findHandlerByName(AVNHttpServer.getConfigName())
    if self.httpServer is None:
      raise Exception("unable to find AVNHttpServer")
    super().startInstance(navdata)

  def onItemAdd(self,itemDescription):
    # type: (AVNDirectoryListEntry) -> AVNDirectoryListEntry or None
    """
    called when the directory is scanned and this new item
    is to be inserted
    @param itemDescription:
    @return: an itemDescription to be added or None
    """
    return itemDescription

  def onItemRemove(self,itemDescription):
    """
    being called after an entry has been removed from the list
    @param itemDescription:
    @return:
    """
    pass

  def onItemDelete(self,itemDescription):
    """
    being called after an entry has been removed from the list
    @param itemDescription:
    @return: True if the delete should be handled by this base class
    """
    return True

  def onPreRun(self):
    pass

  def periodicRun(self):
    pass


  def getSleepTime(self):
    return self.getFloatParam('interval')

  def removeItem(self, name):
    """
    remove an item from the list of scanned items
    @param name:
    @return:
    """
    item=self.itemList.get(name)
    if item is None:
      return
    try:
      del self.itemList[name]
    except:
      pass
    self.onItemRemove(item)

  def _scanDirectory(self):
    AVNLog.debug("scan directory %s",self.baseDir)
    if not self.autoScanIncludeDirectories() and len(self.getAutoScanExtensions()) < 1:
      return
    try:
      if not os.path.isdir(self.baseDir):
        AVNLog.debug("basedir %s is no directory",self.baseDir)
        return
      newContent=self.listDirectory(self.autoScanIncludeDirectories())
      with self.lock:
        oldContent=list(self.itemList.values())
        currentlist = []
        for f in newContent:
          name=f.name
          if not f.isDirectory:
            (path,ext)=os.path.splitext(name)
            if not ext in self.getAutoScanExtensions():
              continue
          AVNLog.debug("found matching file/dir %s", f)
          currentlist.append(f)
        for old in oldContent:  # type: AVNDirectoryListEntry
          if old is None:
            continue
          if not self.listContains(currentlist,old):
            AVNLog.info("closing chart/overlay file %s", old)
            self.removeItem(old.getKey())
        for newitem in currentlist:  # type: AVNDirectoryListEntry
          olditem = self.itemList.get(newitem.getKey())
          if olditem is not None:
            if olditem.isModified(newitem):
              AVNLog.info("closing file %s due to changed timestamp", newitem.name)
              self.removeItem(olditem.getKey())
            else:
              continue
          AVNLog.info("trying to add file %s", newitem.name)
          filteritem=self.onItemAdd(newitem)
          if filteritem is None:
            AVNLog.info("file %s filtered out", newitem.name)
            continue

          self.itemList[newitem.getKey()] = newitem
          AVNLog.info("successfully added file %s", newitem.name)
    except:
      AVNLog.error("Exception in periodic scan %s, ignore", traceback.format_exc())


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
        if len(self.getAutoScanExtensions()) > 0 or self.autoScanIncludeDirectories():
          self._scanDirectory()
        self.periodicRun()
      except:
        AVNLog.debug("%s: exception in periodic run: %s",self.getName(),traceback.format_exc())
      now=time.time()
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
    if name is None:
      raise Exception("missing name")
    with self.lock:
      self.removeItem(name)
    name = AVNUtil.clean_filename(name)
    filename = os.path.join(self.baseDir, name)
    if not os.path.exists(filename):
      raise Exception("file %s not found" % filename)
    os.unlink(filename)
    chartHandler = self.findHandlerByName('AVNChartHandler')
    if chartHandler is not None:
      chartHandler.deleteFromOverlays(self.type, name)
    self._scanDirectory()

  @classmethod
  def canList(cls):
    return True


  def listDirectory(self,includeDirs=False,baseDir=None):
    # type: (bool,str) -> list[AVNDirectoryListEntry]
    data = []
    if baseDir is None:
      baseDir=self.baseDir
    if not os.path.exists(baseDir):
      return []
    for f in os.listdir(str(baseDir)):
      fullname = os.path.join(str(baseDir), f)
      isDir=False
      if not os.path.isfile(fullname):
        if not includeDirs:
          continue
        isDir=True
      element = self.getListEntryClass()(self.type, self.getPrefix(), f,
                                      time=os.path.getmtime(fullname),
                                      size=os.path.getsize(fullname),
                                      baseDir=baseDir,
                                      canDelete=True,isDir=isDir)
      data.append(element)
    return data

  def listContains(self,list,entry):
    # type: (list[AVNDirectoryListEntry], AVNDirectoryListEntry) -> bool
    for e in list:
      if e.isSame(entry):
        return True
    return False


  def handleList(self,handler=None):
    if not self.canList():
      raise Exception("list not possible")
    if not os.path.exists(self.baseDir):
      return AVNUtil.getReturnData("directory %s does not exist" % self.baseDir)
    data=self.listDirectory()
    rt = AVNUtil.getReturnData(items=data)
    return rt


  def checkName(self,name,doRaise=True):
    if name.startswith(self.TMP_PREFIX):
      if doRaise:
        raise Exception("name %s not allowed to start with %s"%(name,self.TMP_PREFIX))
      else:
        return False
    cleanName=AVNUtil.clean_filename(name)
    if name != cleanName:
      if doRaise:
        raise Exception("name %s is invalid"%name)
      return False
    return True

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
    rt=handler.translate_path(re.sub("\?.*","",url))
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

  def getHandledCommands(self):
    rt={"api": self.type}
    if self.canUpload():
      rt["upload"]=self.type
    if self.canList():
      rt["list"]=self.type
    if self.canDownload():
      rt["download"]=self.type
    if self.canDelete():
      rt["delete"]= self.type
    prefix=self.getPrefix()
    if prefix is not None:
      rt["path"]=prefix
    return rt

  def handleRename(self,name,newName,requestparam):
    self.checkName(name)
    self.checkName(newName)
    src = os.path.join(self.baseDir, name)
    if not os.path.exists(src):
      raise Exception("file %s not found" % name)
    dst = os.path.join(self.baseDir, newName)
    if os.path.exists(dst):
      raise Exception("%s already exists" % newName)
    os.rename(src, dst)
    self._scanDirectory()
    return AVNUtil.getReturnData()

  def handleUpload(self,name,handler,requestparam):
    overwrite = AVNUtil.getHttpRequestParam(requestparam, 'overwrite')
    overwrite = overwrite.lower() == 'true' if overwrite is not None else False
    filename = name
    if filename is None:
      raise Exception("missing name in upload request")
    self.checkName(filename)
    rlen = handler.headers.get("Content-Length")
    if rlen is None:
      raise Exception("Content-Length not set in upload request")
    outname = os.path.join(self.baseDir, filename)
    data = AVNUtil.getHttpRequestParam(requestparam, '_json')
    if data is not None:
      decoded = json.loads(data)
      stream=io.BytesIO(data.encode('utf-8'))
      self.writeAtomic(outname,stream,overwrite)
    else:
      self.writeAtomic(outname,handler.rfile,overwrite,int(rlen))
    self._scanDirectory()
    return AVNUtil.getReturnData()

  def handleDownload(self,name,handler,requestparam):
    if name is None:
      raise Exception("missing name")
    name = AVNUtil.clean_filename(name)
    (filename,baseDir)=self.convertLocalPath(name)
    if filename is None:
      return None
    if baseDir is not None:
      filename = os.path.join(baseDir, filename)
    if not os.path.exists(filename):
      raise Exception("file %s not found" % filename)
    return AVNDownload(filename)

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    handler = kwargs.get('handler')
    name = AVNUtil.getHttpRequestParam(requestparam, 'name')
    if type == 'api':
      command=AVNUtil.getHttpRequestParam(requestparam,'command',True)
      if command=='rename':
        if name is None:
          raise Exception("parameter name missing for rename")
        newName=AVNUtil.getHttpRequestParam(requestparam,'newName',True)
        return self.handleRename(name,newName,requestparam)
      elif command == 'delete':
        self.handleDelete(name)
        return AVNUtil.getReturnData()
      elif command == 'list':
        return self.handleList(handler)
      else:
        return self.handleSpecialApiRequest(command,requestparam,kwargs.get('handler'))
    if type == 'path':
      if self.getPrefix() is None:
        raise Exception("Internal error: no handler prefix for %s"%subtype)
      if not subtype.startswith(self.getPrefix()+"/"):
        raise Exception("Internal routing error: handler prefix %s for %s" % (self.getPrefix(),subtype))
      path = subtype[len(self.getPrefix()) + 1:]
      return self.getPathFromUrl(path,handler=handler,requestParam=requestparam)

    if type == "list":
      return self.handleList(handler)

    if type == 'upload':
      return self.handleUpload(name,handler,requestparam)

    if type == 'download':
      return self.handleDownload(name,handler,requestparam)

    if type == 'delete':
      self.handleDelete(name)
      return AVNUtil.getReturnData()

    raise Exception("unable to handle user request %s"%(type))

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

class AVNScopedDirectoryEntry(AVNDirectoryListEntry):
  T_SYSTEM='system'
  T_USER='user'
  T_PLUGIN='plugin'
  T_ALL=[T_SYSTEM,T_USER,T_PLUGIN]
  def __init__(self, type,prefix,name, **kwargs):
    super().__init__(type, prefix, name,
                     **kwargs)
    self.baseDir=kwargs.get('baseDir')
    self.scopedName=None
    self.itemType=self.T_USER
    self.canDelete=False
    self.fileName=kwargs.get('fileName')
    self.scopePrefix=self.T_USER
  def setName(self,ltype,prefix=None):
    if not ltype in self.T_ALL:
      ltype=self.T_USER
    self.itemType=ltype
    if prefix is not None:
      self.scopePrefix=ltype+"."+prefix
    else:
      self.scopePrefix=ltype
    self.scopedName=self.scopePrefix+"."+self.name
    self.url=self.prefix+"/"+urllib.parse.quote(self.scopedName.encode('utf-8'))
    self.canDelete=ltype == self.T_USER

  def isSame(self, other):
    rt=super().isSame(other)
    if not rt:
      return rt
    return self.scopePrefix == other.scopePrefix

  @classmethod
  def getExtension(cls):
    return '.json'

  @classmethod
  def nameToClientName(cls,name):
    if not name:
      return
    if name.endswith(cls.getExtension()):
        name=name[0:- len(cls.getExtension())]
    return name

  @classmethod
  def clientNameToName(cls,clientName):
    if not clientName:
      return clientName
    if clientName.endswith(cls.getExtension()):
      return clientName
    return clientName+cls.getExtension()

  def serialize(self):
    '''
    when we send to the client it expects
    the full name in the name field
    @return:
    '''
    rt=super().serialize()
    name=rt.get('scopedName')
    rt['name']=self.nameToClientName(name)
    return rt

  def toPlain(self):
    return self.__dict__

  def getKey(self):
    return self.scopedName

  @classmethod
  def stripPrefix(cls,name):
    if not name:
      return name
    for p in cls.T_ALL:
      if name.startswith(p+"."):
        return name[len(p)+1:]
    return name

  @classmethod
  def getType(cls,name):
    if not name:
      return cls.T_USER
    for p in cls.T_ALL:
      if name.startswith(p+"."):
        return p
    return cls.T_USER

class AVNScopedDirectoryHandler(AVNDirectoryHandlerBase):
  '''
  a handler for items that can be located in a system directory (read only),
  a user directory and can be added by plugins
  it uses the autoscan feature of the base
  you must implemenzt the getAutoScanExtensions
  '''
  def __init__(self, param,type):
    super().__init__(param, type)
    self.baseDir= AVNHandlerManager.getDirWithDefault(self.param,'userDir',type)
    self.systemDir=None
    self.systemItems: List[AVNScopedDirectoryEntry]  =[]
    self.pluginItems : List[AVNScopedDirectoryEntry] =[]

  @classmethod
  def getListEntryClass(cls):
    return AVNScopedDirectoryEntry

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
      self.systemItems=self.listDirectory(baseDir=self.systemDir)

  def listDirectory(self, includeDirs=False, baseDir=None):
    items=super().listDirectory(includeDirs, baseDir)
    scope=AVNScopedDirectoryEntry.T_USER
    if baseDir is not None and baseDir == self.systemDir:
      scope=AVNScopedDirectoryEntry.T_SYSTEM
    for item in items:
      item.setName(scope)
    return items

  def onItemAdd(self, itemDescription: AVNScopedDirectoryEntry):
    '''automatically added items are from the user dir'''
    itemDescription.setName(AVNScopedDirectoryEntry.T_USER)
    return itemDescription

  def handleList(self, handler=None):
    with self.lock:
      items=self.systemItems+self.pluginItems+list(self.itemList.values())
      return AVNUtil.getReturnData(items=items)

  def findItem(self,name)-> AVNScopedDirectoryEntry:
    with self.lock:
      for item in self.systemItems+self.pluginItems+list(self.itemList.values()):
        if item.scopedName == name:
          return item

  def clientNameToScopedName(self, clientName: str):
    return self.getListEntryClass().clientNameToName(clientName)

  def convertLocalPath(self, path) -> (str, str or None):
    name=self.clientNameToScopedName(path)
    item=self.findItem(name)
    if not item:
      return (None,None)
    if item.fileName:
      return (item.fileName,None)
    return (item.name,item.baseDir)

  def handleDelete(self, name):
    name=self.clientNameToScopedName(name)
    item=self.findItem(name)
    if not item:
      raise Exception("%s %s not found"%(self.type,name))
    if not item.canDelete:
      raise Exception("%s cannot be deleted "%(name))
    return super().handleDelete(item.name)

  def handleRename(self, name, newName, requestparam):
    name=self.clientNameToScopedName(name)
    item=self.findItem(name)
    if not item:
      return AVNUtil.getReturnData(error="%s %s not found"%(self.type,name))
    if not item.canDelete:
      return AVNUtil.getReturnData(error="unable to rename %s "%(name))
    return super().handleRename(
      item.name,
      self.getListEntryClass().stripPrefix(self.clientNameToScopedName(newName))
      , requestparam)

  def handleUpload(self, name, handler, requestparam):
    name=self.clientNameToScopedName(name)
    if AVNScopedDirectoryEntry.getType(name) != AVNScopedDirectoryEntry.T_USER:
      return AVNUtil.getReturnData(error="cannot upload %s"%name)
    return super().handleUpload(self.getListEntryClass().stripPrefix(name), handler, requestparam)

  def registerPluginItem(self,pluginName,name,fileName):
    if not os.path.exists(fileName):
      return False
    name=self.clientNameToScopedName(name)
    AVNLog.debug("register plugin item %s",name)
    info=AVNScopedDirectoryEntry(self.type, self.getPrefix(), name, time=os.path.getmtime(fileName),
                                 baseDir=os.path.dirname(fileName),
                                 fileName=fileName)
    info.setName(AVNScopedDirectoryEntry.T_PLUGIN, prefix=pluginName)
    if self.findItem(info.scopedName) is not None:
      AVNLog.error("trying to register an already existing plugin item %s",name)
      return False
    with self.lock:
      self.pluginItems.append(info)

  def deregisterPluginItem(self,pluginName,name):
    name=self.clientNameToScopedName(name)
    AVNLog.debug("deregister plugin item %s",name)
    info=AVNScopedDirectoryEntry(self.type, self.getPrefix(), name)
    info.setName(AVNScopedDirectoryEntry.T_PLUGIN, prefix=pluginName)
    existing=self.findItem(info.scopedName)
    if not existing:
      AVNLog.error("item %s not found",name)
      return False
    with self.lock:
      self.pluginItems.remove(existing)
    return True


