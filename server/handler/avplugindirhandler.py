# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
import threading
import time
from typing import override
from zipfile import ZipFile

import avnav_handlerList
from avnav_util import AVNLog, AVNUtil, AVNZipDownload
from avndirectorybase import AVNDirectoryHandlerBase, AVNDirectoryListEntry
from pluginhandler import AVNPluginHandler


class AVNPluginDirHandler(AVNDirectoryHandlerBase):
  PREFIX = "/plugindir"
  UPLOAD_NAME="upload"
  USERNAME_PREFIX=AVNPluginHandler.D_USER+"-"
  EXT='.zip'
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  @override
  @classmethod
  def getStartupGroup(cls):
    '''must be started after the plugin handler'''
    return 3
  def startInstance(self, navdata):
    self.pluginhandler = self.findHandlerByName(AVNPluginHandler.getConfigName()) #type: AVNPluginHandler
    self.baseDir=self.pluginhandler.getPluginBaseDir()
    return super().startInstance(navdata)

  def __init__(self,param):
    super().__init__(param, "plugin")
    self.baseDir = None

  def onPreRun(self):
      super().onPreRun()
      try:
          for file in os.listdir(self.baseDir):
              if file.startswith(self.UPLOAD_NAME) and file.endswith(self.EXT):
                  os.unlink(os.path.join(self.baseDir,file))
      except Exception as e:
          AVNLog.error("unable to cleanup upload files: %s",str(e))

  def updatePluginListEntry(self,entry:AVNDirectoryListEntry,ptype=AVNPluginHandler.D_USER):
      if not entry.name.startswith(ptype+"-"):
          entry.name=ptype+'-'+entry.name
      if ptype != AVNPluginHandler.D_USER:
          entry.canDownload=False
          entry.canDelete=False
  def listDirectory(self, includeDirs=False, baseDir=None):
      dlist = [entry for entry in super().listDirectory(True, baseDir) if entry.isDirectory]
      for e in dlist:
          self.updatePluginListEntry(e,AVNPluginHandler.D_USER)
      blist = [entry for entry in
               super().listDirectory(True, self.pluginhandler.getPluginBaseDir(AVNPluginHandler.D_BUILTIN)) if
               entry.isDirectory]
      for e in blist:
          self.updatePluginListEntry(e,AVNPluginHandler.D_BUILTIN)
      slist = [entry for entry in
               super().listDirectory(True, self.pluginhandler.getPluginBaseDir(AVNPluginHandler.D_SYSTEM)) if
               entry.isDirectory]
      for e in slist:
          self.updatePluginListEntry(e,AVNPluginHandler.D_SYSTEM)
      dlist.extend(blist)
      dlist.extend(slist)
      return dlist

  def handleDownload(self, name, handler, requestparam):
      if name is None:
          raise Exception("missing name")
      name = AVNUtil.clean_filename(name)
      if not name.startswith(self.USERNAME_PREFIX):
          raise Exception(f"plugin {name} is no user plugin")
      name=name[len(self.USERNAME_PREFIX):]
      (filename, baseDir) = self.convertLocalPath(name)
      if filename is None:
          return None
      if baseDir is not None:
          filename = os.path.join(baseDir, filename)
      if not os.path.exists(filename) or not os.path.isdir(filename):
          raise Exception("plugin %s not found" % filename)
      def filter(fn):
          if fn is None:
              return True
          if fn.find('__pycache__') >= 0:
              return False
          return True
      return AVNZipDownload(name+".zip",filename,prefix=name,filter=filter)

  def handleDelete(self, name):
      if not self.canDelete():
          raise Exception("delete not possible")
      if name is None:
          raise Exception("missing name")
      name = AVNUtil.clean_filename(name)
      if not name.startswith(self.USERNAME_PREFIX):
          raise Exception(f"plugin {name} is no user plugin")
      name=name[len(self.USERNAME_PREFIX):]
      filename = os.path.join(self.baseDir, name)
      if not os.path.exists(filename) or not os.path.isdir(filename):
          raise Exception("plugin %s not found" % filename)
      self.pluginhandler.deletePlugin(name)
      shutil.rmtree(filename)
  def checkPath(self,path,base,isdir=False):
      parts=path.split('/')
      if len(parts) < 1:
          raise Exception(f"invalid path [{path}]")
      if not isdir and len(parts) < 2:
          raise Exception(f"plugin: [{path}] files must be in a sub directory")
      if parts[0] != base:
          raise Exception(f"plugin: [{path}] all files must be below {base}")
      for fn in parts[1:]:
          clean=AVNUtil.clean_filename(fn)
          if clean != fn:
              raise Exception(f"plugin: [{path}] invalid part in path {fn}")
  def handleUpload(self, name, handler, requestparam):
      self.checkName(name)
      if name.lower().endswith(self.EXT):
          name=name[0:-len(self.EXT)]
      overwrite = AVNUtil.getHttpRequestFlag(requestparam, 'overwrite')
      plugindir=os.path.join(self.baseDir,name)
      if os.path.exists(plugindir) and not overwrite:
          raise Exception(f"plugin {plugindir} already exists")
      uploadName=f"{self.UPLOAD_NAME}-{threading.get_ident()}{self.EXT}"
      filename = os.path.join(self.baseDir, uploadName)
      if os.path.exists(filename):
          os.unlink(filename)
      try:
        rt= super().handleUpload(uploadName, handler, requestparam)
        if not os.path.exists(filename):
          raise Exception(f"file {filename} not found after upload")
        zip = ZipFile(filename)
        hasEntries=False
        for entry in zip.infolist():
            AVNLog.debug(f"zip entry {entry}")
            self.checkPath(entry.filename,name,isdir=entry.is_dir())
            if not entry.is_dir():
                hasEntries=True
        if not hasEntries:
            raise Exception(f"no files in zip {name}")
        zip.extractall(self.baseDir)
        now=time.time()
        os.utime(plugindir,(now,now))
        self.pluginhandler.updatePlugin(name)
      finally:
        os.unlink(filename)
      return rt

avnav_handlerList.registerHandler(AVNPluginDirHandler)