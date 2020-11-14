#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013-2020 Andreas Vogel andreas@wellenvogel.net
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
import urllib
from zipfile import ZipFile

from avnav_nmea import *
from avnav_worker import *
from httphandler import AVNDownload



class AVNDirectoryListEntry(object):
  '''
  a json serializable
  '''
  def serialize(self):
    return self.__dict__

  def __init__(self,type,prefix,name,time=0,size=0,canDelete=False):
    self.name=name
    self.type=type
    self.prefix=prefix
    self.url=prefix+"/"+urllib.quote(name)
    self.time=time
    self.size=size
    self.canDelete=canDelete

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
    return cls.getPrefix()+"/"+urllib.quote(name)

  @classmethod
  def preventMultiInstance(cls):
    return True
  @classmethod
  def autoInstantiate(cls):
    return """
      <%s>
  	  </%s>
      """ % (cls.getConfigName(), cls.getConfigName())

  def __init__(self,param,type):
    AVNWorker.__init__(self,param)
    self.baseDir=None
    self.type=type
    self.httpServer=None
    self.addonHandler=None

  def start(self):
    self.httpServer=self.findHandlerByName('AVNHttpServer')
    if self.httpServer is None:
      raise Exception("unable to find AVNHttpServer")
    AVNWorker.start(self)


  def copyTemplates(self):
    pass

  def periodicRun(self):
    pass


  # thread run method - just try forever
  def run(self):
    self.setName(self.getThreadPrefix())
    if not os.path.exists(self.baseDir):
      AVNLog.info("creating user dir %s"%self.baseDir)
      os.makedirs(self.baseDir)
    if not os.path.exists(self.baseDir):
      self.setInfo("main","unable to create %s"%self.baseDir,AVNWorker.Status.ERROR)
      AVNLog.error("unable to create user dir %s"%self.baseDir)
      return
    self.copyTemplates()
    sleepTime=self.getFloatParam('interval')
    self.setInfo('main', "handling %s"%self.baseDir, AVNWorker.Status.NMEA)
    while True:
      time.sleep(sleepTime)
      try:
        self.periodicRun()
      except:
        AVNLog.debug("%s: exception in periodic run: %s",self.getName(),traceback.format_exc())

  @classmethod
  def canDelete(self):
    return True

  def handleDelete(self,name):
    if not self.canDelete():
      raise Exception("delete not possible")
    if name is None:
      raise Exception("missing name")
    name = AVNUtil.clean_filename(name)
    filename = os.path.join(self.baseDir, name)
    if not os.path.exists(filename):
      raise Exception("file %s not found" % filename)
    os.unlink(filename)
    if self.addonHandler is not None:
      try:
        self.addonHandler.deleteByUrl(self.nameToUrl(name))
      except Exception as e:
        AVNLog.error("unable to delete addons for %s:%s",name,e)

  @classmethod
  def canList(self):
    return True

  def handleList(self,handler=None):
    if not self.canList():
      raise Exception("list not possible")
    data = []
    if not os.path.exists(self.baseDir):
      return AVNUtil.getReturnData("directory %s does not exist" % self.baseDir)
    for f in os.listdir(self.baseDir):
      fullname = os.path.join(self.baseDir, f)
      if not os.path.isfile(fullname):
        continue
      element = AVNDirectoryListEntry(self.type,self.getPrefix(),f,
                                      time=os.path.getmtime(fullname),
                                      size=os.path.getsize(fullname),
                                      canDelete=True)
      data.append(element)
    rt = AVNUtil.getReturnData(items=data)
    return rt


  def checkName(self,name,doRaise=True):
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
    if entry is None:
      return self.tryFallbackOrFail(requestParam, handler, "no entry %s in %s" % (entryName, zipname))
    handler.send_response(200)
    handler.send_header("Content-type", handler.getMimeType(entryName))
    handler.send_header("Content-Length", entry.file_size)
    handler.send_header("Last-Modified", handler.date_time_string())
    handler.end_headers()
    handler.wfile.write(zip.read(entry))
    return True

  def getPathFromUrl(self,url,handler=None,requestParam=None):
    if self.getPrefix() is None:
      return None
    if not url.startswith(self.getPrefix()):
      return None
    path = url[len(self.getPrefix()) + 1:]
    #TODO: should we limit this to only one level?
    #we could use checkName and this way ensure that we only have one level
    subPath=self.httpServer.plainUrlToPath(path, False)
    #check for zip files in the path
    pathParts=subPath.split(os.path.sep)
    hasZip=False
    for part in pathParts:
      if part.lower().endswith(".zip"):
        hasZip=True
        break
    if not hasZip:
      originalPath = os.path.join(self.baseDir, subPath)
      return originalPath
    currentPath=self.baseDir
    for k in range(0,len(pathParts)):
      part=pathParts[k]
      currentPath=os.path.join(currentPath,part)
      if not os.path.exists(currentPath):
        return None
      if part.lower().endswith(".zip") and k < (len(pathParts)-1):
        return self.getZipEntry(currentPath,"/".join(pathParts[k+1:]),handler,requestParam)
    #we should never end here - but just to be sure
    originalPath = os.path.join(self.baseDir,subPath)
    return originalPath

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
    return AVNUtil.getReturnData()

  def handleUpload(self,name,handler,requestparam):
    overwrite = AVNUtil.getHttpRequestParam(requestparam, 'overwrite')
    overwrite = overwrite.lower() == 'true' if overwrite is not None else False
    filename = name
    if filename is None:
      raise Exception("missing filename in upload request")
    self.checkName(filename)
    rlen = handler.headers.get("Content-Length")
    if rlen is None:
      raise Exception("Content-Length not set in upload request")
    outname = os.path.join(self.baseDir, filename)
    data = AVNUtil.getHttpRequestParam(requestparam, '_json')
    if data is not None:
      decoded = json.loads(data)
      if not overwrite and os.path.exists(outname):
        raise Exception("file %s already exists" % outname)
      fh = open(outname, "wb")
      if fh is None:
        raise Exception("unable to write to %s" % outname)
      fh.write(decoded.encode('utf-8'))
      fh.close()
    else:
      handler.writeFileFromInput(outname, rlen, overwrite)
    return AVNUtil.getReturnData()

  def handleDownload(self,name,handler,requestparam):
    if name is None:
      raise Exception("missing name")
    name = AVNUtil.clean_filename(name)
    filename = os.path.join(self.baseDir, name)
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
      return self.getPathFromUrl(subtype,handler=handler,requestParam=requestparam)

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


