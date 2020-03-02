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
import StringIO
import shutil

from avnav_config import *
from avnav_nmea import *
from avnav_worker import *
import avnav_handlerList

class AVNUserHandlerBase(AVNWorker):
  '''
  handle the files in the user directory
  '''
  @classmethod
  def getPrefix(cls):
    raise NotImplemented()
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
    return """
      <%s>
  	  </%s>
      """ % (cls.getConfigName(), cls.getConfigName())

  def __init__(self,param):
    AVNWorker.__init__(self,param)
    self.baseDir=None

  def copyTemplates(self):
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

  def handlePathRequest(self,path,server):
    return None

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == 'path':
      server=kwargs.get('server')
      originalPath=server.plainUrlToPath(subtype,True)
      if os.path.exists(originalPath):
        return originalPath
      path = subtype[len(self.getPrefix()) + 1:]
      rt=self.handlePathRequest(path,server)
      if rt is not None:
        return rt
      #nothing we can really do...
      return originalPath

    if type == "list":
      data = []
      if not os.path.exists(self.baseDir):
        return {'status':'ERROR','info':"directory %s does not exist"%self.baseDir}
      for f in os.listdir(self.baseDir):
        fullname=os.path.join(self.baseDir,f)
        if not os.path.isfile(fullname):
          continue
        element = {'name': f,
                   'type': 'user',
                   'time':os.path.getmtime(fullname),
                   'size':os.path.getsize(fullname),
                   'canDelete':True
                   }
        data.append(element)
      rt = {'status': 'OK', 'items': data}
      return rt

    if type == 'upload':
      overwrite=AVNUtil.getHttpRequestParam(requestparam,'overwrite')
      overwrite=overwrite.lower()=='true' if overwrite is not None else False
      filename = AVNUtil.getHttpRequestParam(requestparam, "filename")
      if filename is None:
        raise Exception("missing filename in upload request")
      len=kwargs.get('flen')
      handler=kwargs.get('handler')
      filename = AVNUtil.clean_filename(filename)
      outname=os.path.join(self.baseDir,filename)
      data=requestparam.get('_data')
      if data is not None:
        if isinstance(data,list):
          data=data[0]
        stream = StringIO.StringIO(data)
        stream.seek(0)
        handler.writeFileFromInput(outname,len,overwrite,stream)
      else:
        handler.writeFileFromInput(outname,len,overwrite)
      return {'status':'OK'}

    if type == 'download':
      name = AVNUtil.getHttpRequestParam(requestparam, "name")
      if name is None:
        raise Exception("missing name")
      name=AVNUtil.clean_filename(name)
      filename=os.path.join(self.baseDir,name)
      if not os.path.exists(filename):
        raise Exception("file %s not found"%filename)
      dl={}
      dl['mimetype']=kwargs.get('handler').guess_type(name)
      dl['size']=os.path.getsize(filename)
      dl['stream']=open(filename,'rb')
      return dl

    if type == 'delete':
      name = AVNUtil.getHttpRequestParam(requestparam, "name")
      if name is None:
        raise Exception("missing name")
      name=AVNUtil.clean_filename(name)
      filename=os.path.join(self.baseDir,name)
      if not os.path.exists(filename):
        raise Exception("file %s not found"%filename)
      os.unlink(filename)
      return {'status': 'OK'}

    raise Exception("unable to handle user request %s"%(type))


class AVNUserHandler(AVNUserHandlerBase):
  PREFIX = "/user/viewer"
  FLIST=['user.css',"user.js"]
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  def __init__(self,param):
    AVNUserHandlerBase.__init__(self,param)

  def copyTemplates(self):
    httpserver=self.findHandlerByName("AVNHttpServer")
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

  def start(self):
    self.baseDir=AVNConfig.getDirWithDefault(self.param,'userDir',os.path.join('user','viewer'))
    AVNWorker.start(self)

  def getHandledCommands(self):
    return {"upload":"user","list":"user","download":"user","delete":"user","path":self.getPrefix()}
  def handlePathRequest(self,path,server):
    if path == 'keys.json':
      return server.plainUrlToPath('/viewer/layout/keys.json')
    for p in self.FLIST:
      if path == p:
        return server.plainUrlToPath("/viewer/" + p, True)
    if path.startswith("images/"):
      return server.plainUrlToPath("/viewer/images/" + path[len("images/"):])

class AVNImagesHandler(AVNUserHandlerBase):
  PREFIX = "/user/images"
  @classmethod
  def getPrefix(cls):
    return cls.PREFIX
  def __init__(self,param):
    AVNUserHandlerBase.__init__(self,param)
  def start(self):
    self.baseDir=AVNConfig.getDirWithDefault(self.param,'userDir',os.path.join('user','images'))
    AVNWorker.start(self)


  def getHandledCommands(self):
    return {"upload":"images","list":"images","download":"images","delete":"images","path":self.getPrefix()}

  def handlePathRequest(self,path,server):
      return server.plainUrlToPath("/viewer/images/" + path[len("images/"):])


avnav_handlerList.registerHandler(AVNUserHandler)
avnav_handlerList.registerHandler(AVNImagesHandler)

