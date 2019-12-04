# !/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012...2017 Andreas Vogel andreas@wellenvogel.net
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
###############################################################################
import json
import traceback

import time

import avnav_handlerList
from avnav_worker import AVNWorker
from avnav_config import AVNConfig
from avnav_util import *
import create_overview

class LayoutInfo:
  def __init__(self,name,filename,time,isSystem=False):
    self.filename=filename
    self.time=time
    self.canDelete=not isSystem
    self.type="layout"
    self.name = self.getKey(name,isSystem)
    self.updateCount=0
  def toJson(self):
    return json.dumps(self.__dict__)
  def toPlain(self):
    return self.__dict__
  @classmethod
  def getKey(cls,name,isSystem):
    rt="system." if isSystem else "user."
    rt=rt+name
    return rt


class AVNLayoutHandler(AVNWorker):
  """a worker to check the chart dirs
     and create avnav.xml..."""
  def __init__(self,param):
    self.param=param
    AVNWorker.__init__(self, param)
    self.layouts={}
  @classmethod
  def getConfigName(cls):
    return "AVNLayoutHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
        'systemDir': '',
        'userDir':'',
        'period': 10
    }
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return """
      <%s>
  	  </%s>
      """ % (cls.getConfigName(), cls.getConfigName())
  def getName(self):
    return self.getConfigName()
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    AVNLog.info("started")
    userDir=self.getUserDir()
    if not os.path.isdir(userDir):
      os.makedirs(userDir)
    while True:
      self.updateAllLayouts()
      time.sleep(self.getIntParam('period') or 10)
  def getUserDir(self):
    userDir = self.getStringParam('userDir')
    if userDir is None or userDir == "":
      userDir = os.path.join(self.getStringParam(AVNConfig.BASEPARAM.DATADIR), 'layout')
    return userDir
  def updateAllLayouts(self):
    dt = datetime.datetime.now()
    updateCount=dt.microsecond
    httpServer = self.findHandlerByName("AVNHttpServer")
    if httpServer is None:
      AVNLog.error("unable to find AVNHttpServer")
      return
    systemDir = self.getStringParam('systemDir')
    if systemDir is None or systemDir == "":
      systemDir = os.path.join(httpServer.handlePathmapping("viewer"), 'layout')
    userDir=self.getUserDir()
    try:
      self.readLayouts(systemDir, updateCount, True)
      self.readLayouts(userDir, updateCount, False)
      # remove disappaearing
      deleteKeys = []
      for key in self.layouts:
        if self.layouts[key].updateCount != updateCount:
          deleteKeys.append(key)
      for key in deleteKeys:
        del self.layouts[key]
    except:
      AVNLog.error("error while trying to update layouts %s", traceback.format_exc())

  def readLayouts(self,baseDir,updateCount,isSystem=False):
    if os.path.isdir(baseDir):
      for f in os.listdir(baseDir):
        if not f[-5:] == ".json":
          continue
        if f =="keys.json":
          continue
        file=os.path.join(baseDir,f)
        if not os.path.isfile(file):
          continue
        name=f[0:-5]
        key=LayoutInfo.getKey(name,isSystem)
        mtime=os.path.getmtime(file)
        if self.layouts.get(key):
          self.layouts[key].time=mtime
          self.layouts[key].updateCount=updateCount
        else:
          info=LayoutInfo(name,file,mtime,isSystem)
          info.updateCount=updateCount
          self.layouts[key]=info

  def getHandledCommands(self):
    return {"api": "layout",'list':'layout','upload':'layout','download':'layout','delete':'layout' }

  def handleApiRequest(self, type, command, requestparam, **kwargs):
    if type == 'list':
      rt=[]
      for v in self.layouts.values():
        rt.append(v.toPlain())
      return {'status':'OK','items':rt}
    if type == 'upload':
      #only json uploads with the data in _json
      name=AVNUtil.getHttpRequestParam(requestparam,'name')
      if name is None:
        raise Exception("missing parameter name")
      userDir=self.getUserDir()
      if not os.path.isdir(userDir):
        raise Exception("no user dir %s found"%userDir)
      fname=os.path.join(userDir,name+".json")
      data=AVNUtil.getHttpRequestParam(requestparam,'_json')
      if data is None:
        raise Exception("no data in upload layout")
      with open(fname,"w") as fp:
        fp.write(data)
        fp.close()
      self.updateAllLayouts()

    if type == 'download':
      name=AVNUtil.getHttpRequestParam(requestparam,'name')
      noAttach=AVNUtil.getHttpRequestParam(requestparam,'noattach')
      if name is None:
        raise Exception("missing parameter name")
      info=self.layouts.get(name)
      if info is None:
        raise Exception("layout %s not found"%name)
      fname=info.filename
      if fname is None:
        raise Exception("no layout file")
      len=os.path.getsize(fname)
      stream=open(fname,"rb")
      rt={'size':len,'mimetype':'application/json','stream':stream}
      if noAttach is not None:
        rt['noattach']=True
      return rt
    if type == 'delete':
      name=AVNUtil.getHttpRequestParam(requestparam,'name')
      if name is None:
        raise Exception("missing parameter name")
      info=self.layouts.get(name)
      if info is None:
        raise Exception("layout %s not found"%name)
      if not info.canDelete:
        raise Exception("cannot delete this layout")
      fname=info.filename
      if fname is None:
        raise Exception("no layout file")
      os.unlink(fname)
      self.updateAllLayouts()

avnav_handlerList.registerHandler(AVNLayoutHandler)
