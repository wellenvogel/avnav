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


from avnav_manager import *
from avnav_nmea import *
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


avnav_handlerList.registerHandler(AVNOverlayHandler)
avnav_handlerList.registerHandler(AVNUserHandler)
avnav_handlerList.registerHandler(AVNImagesHandler)

