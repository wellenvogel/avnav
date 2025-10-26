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
import os.path
import shutil
from zipfile import ZipFile

from typing_extensions import override

from avnav_manager import *
from avnav_worker import *
import avnav_handlerList
from avndirectorybase import AVNDirectoryHandlerBase
from httpserver import AVNHttpServer


class AVNUserHandler(AVNDirectoryHandlerBase):
  PREFIX = "/user/viewer"
  FLIST=['user.css',"user.js","splitkeys.json","images.json"]
  EMPTY_JSONS=['keys.json']
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  def __init__(self,param):
    AVNDirectoryHandlerBase.__init__(self, param, "user")
    self.baseDir = AVNHandlerManager.getDirWithDefault(self.param, 'userDir', os.path.join('user', 'viewer'))
    self.addonHandler=None

  def startInstance(self, navdata):
    self.addonHandler = self.findHandlerByName("AVNUserAppHandler")
    return super().startInstance(navdata)

  def onPreRun(self):
    httpserver=self.findHandlerByName(AVNHttpServer.getConfigName())
    if not httpserver:
      return
    srcDir=httpserver.handlePathmapping('viewer')
    if not os.path.isdir(srcDir):
      return
    if not os.path.isdir(self.baseDir):
      return
    for fn in self.FLIST:
      src=os.path.join(srcDir,fn)
      dest=os.path.join(self.baseDir,fn)
      if not os.path.exists(dest) and os.path.exists(src):
        AVNLog.info("copying template from %s to %s"%(src,dest))
        shutil.copyfile(src,dest)
    for jf in self.EMPTY_JSONS:
      dest=os.path.join(self.baseDir,jf)
      if not os.path.exists(dest):
        with open(dest,"w",encoding='utf-8') as fh:
          fh.write("{\n}\n")

  def handleDelete(self,name):
    super(AVNUserHandler, self).handleDelete(name)
    if self.addonHandler is not None:
      try:
        self.addonHandler.deleteByUrl(self.nameToUrl(name))
      except Exception as e:
        AVNLog.error("unable to delete addons for %s:%s", name, e)

  def handleUpload(self, name, handler, requestparam):
      rt=super().handleUpload(name, handler, requestparam)
      if name in self.FLIST:
          self.navdata.updateChangeCounter('config')
      return rt


  def getPathFromUrl(self, path, handler=None,requestParam=None):
    if path == 'user.js':
      fname=os.path.join(self.baseDir,path)
      if os.path.exists(fname) and handler is not None:
        return handler.sendJsFile(fname,self.PREFIX)
    return super(AVNUserHandler, self).getPathFromUrl(path, handler,requestParam)


class AVNImagesHandler(AVNDirectoryHandlerBase):
  PREFIX = "/user/images"
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  def __init__(self,param):
    AVNDirectoryHandlerBase.__init__(self, param, "images")
    self.baseDir = AVNHandlerManager.getDirWithDefault(self.param, 'userDir', os.path.join('user', 'images'))


class AVNOverlayHandler(AVNDirectoryHandlerBase):
  PREFIX = "/overlays"
  ICONPREFIX=PREFIX+"/icons"
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  def __init__(self,param):
    AVNDirectoryHandlerBase.__init__(self, param, "overlay")
    self.baseDir = AVNHandlerManager.getDirWithDefault(self.param, 'overlayDir', "overlays")

class AVNIconHandler(AVNDirectoryHandlerBase):
  PREFIX = "/icons"
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX

  @classmethod
  def canDelete(self):
    return False

  @classmethod
  def canUpload(self):
    return False

  @classmethod
  def canDownload(self):
    return False

  def __init__(self,param):
    AVNDirectoryHandlerBase.__init__(self, param, "icons")

  def startInstance(self, navdata):
    super().startInstance(navdata)
    self.baseDir=os.path.join(self.httpServer.handlePathmapping('viewer'),'images')


class AVNPluginDirHandler(AVNDirectoryHandlerBase):
  PREFIX = "/plugindir"
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  @override
  @classmethod
  def getStartupGroup(cls):
    '''must be started after the plugin handler'''
    return 3
  def startInstance(self, navdata):
    self.pluginhandler = self.findHandlerByName("AVNPluginHandler")
    self.baseDir=self.pluginhandler.getUserDir()
    return super().startInstance(navdata)

  def __init__(self,param):
    super().__init__(param, "plugin")
    self.baseDir = None

  def listDirectory(self, includeDirs=False, baseDir=None):
      dlist=[entry for entry in super().listDirectory(True, baseDir) if entry.isDirectory]
      return dlist

  def handleDownload(self, name, handler, requestparam):
      if name is None:
          raise Exception("missing name")
      name = AVNUtil.clean_filename(name)
      (filename, baseDir) = self.convertLocalPath(name)
      if filename is None:
          return None
      if baseDir is not None:
          filename = os.path.join(baseDir, filename)
      if not os.path.exists(filename) or not os.path.isdir(filename):
          raise Exception("plugin %s not found" % filename)
      return AVNZipDownload(name+".zip",filename,prefix=name)

  def handleDelete(self, name):
      if not self.canDelete():
          raise Exception("delete not possible")
      if name is None:
          raise Exception("missing name")
      name = AVNUtil.clean_filename(name)
      filename = os.path.join(self.baseDir, name)
      if not os.path.exists(filename) or not os.path.isdir(filename):
          raise Exception("plugin %s not found" % filename)
      self.pluginhandler.deletePlugin(name)
      shutil.rmtree(filename)

  def handleUpload(self, name, handler, requestparam):
      if not name.lower().endswith(".zip"):
          raise Exception("only zip files allowed")
      rt= super().handleUpload(name, handler, requestparam)
      filename=os.path.join(self.baseDir, name)
      if not os.path.exists(filename):
          raise Exception(f"file {filename} not found after upload")
      zip = ZipFile(filename)
      dirname=name[0:-4]
      try:
        hasEntries=False
        for entry in zip.infolist():
            AVNLog.debug(f"zip entry {entry}")
            if entry.is_dir():
                if entry.filename != dirname:
                    raise Exception(f"directory in zip {entry.filename} does not match plugin name {dirname}")
            else:
                if not (os.path.dirname(entry.filename)+os.path.sep).startswith(dirname+os.path.sep) :
                    raise Exception(f"directory of {entry.filename} does not match plugin name {dirname}")
                else:
                    hasEntries=True
        if not hasEntries:
            raise Exception(f"no files in zip {name}")
        zip.extractall(self.baseDir)
        self.pluginhandler.updatePlugin(dirname)
      finally:
        os.unlink(filename)
      return rt

avnav_handlerList.registerHandler(AVNOverlayHandler)
avnav_handlerList.registerHandler(AVNUserHandler)
avnav_handlerList.registerHandler(AVNImagesHandler)
avnav_handlerList.registerHandler(AVNIconHandler)
avnav_handlerList.registerHandler(AVNPluginDirHandler)

