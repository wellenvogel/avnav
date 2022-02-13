# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012...2021 Andreas Vogel andreas@wellenvogel.net
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

import time

import avnav_handlerList
from avnav_worker import AVNWorker
from avnav_manager import AVNHandlerManager
from avndirectorybase import *
from avnav_util import *

TYPE="layout"
PREFIX="/layouts"
class LayoutInfo(AVNDirectoryListEntry):
  T_SYSTEM='system'
  T_USER='user'
  T_PLUGIN='plugin'
  T_ALL=[T_SYSTEM,T_USER,T_PLUGIN]
  def __init__(self, type,prefix,name, **kwargs):
    super().__init__(type, prefix, name,
                     **kwargs)
    self.baseDir=kwargs.get('baseDir')
    self.layoutName=None
    self.layoutType=self.T_USER
  def setName(self,ltype,prefix=None):
    if not ltype in self.T_ALL:
      ltype=self.T_USER
    self.layoutType=ltype
    if prefix is not None:
      self.layoutName=ltype+"."+prefix+"."+self.name
    else:
      self.layoutName=ltype+"."+self.name
    self.canDelete=ltype == self.T_USER

  def serialize(self):
    '''
    when we send to the client it expects
    the full name in the name field
    @return:
    '''
    rt=super().serialize()
    name=rt.get('layoutName')
    if name:
      if name.endswith('.json'):
        name=name[0:-5]
      rt['name']=name
    return rt

  def toPlain(self):
    return self.__dict__

  def getKey(self):
    return self.layoutName

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


class AVNLayoutHandler(AVNDirectoryHandlerBase):
  ALLOWED_EXTENSIONS=['.json']

  def __init__(self, param):
    super().__init__(param, TYPE)
    self.baseDir= AVNHandlerManager.getDirWithDefault(self.param,'userDir',TYPE)
    self.type=TYPE
    self.systemDir=None
    self.systemItems =[]
    self.pluginItems=[]

  @classmethod
  def getAutoScanExtensions(cls):
    return cls.ALLOWED_EXTENSIONS

  @classmethod
  def getListEntryClass(cls):
    return LayoutInfo

  @classmethod
  def getPrefix(cls):
    return PREFIX

  def onPreRun(self):
    super().onPreRun()
    self.systemDir = os.path.join(self.httpServer.handlePathmapping("viewer"), TYPE)
    self.systemItems=self.listDirectory(baseDir=self.systemDir)
    for item in self.systemItems:
      item.setName(LayoutInfo.T_SYSTEM)

  def onItemAdd(self, itemDescription: LayoutInfo):
    '''automatically added items are from the user dir'''
    itemDescription.setName(LayoutInfo.T_USER)
    return itemDescription

  def handleList(self, handler=None):
    items=self.systemItems+self.pluginItems+list(self.itemList.values())
    return AVNUtil.getReturnData(items=items)

  def findItem(self,name)-> LayoutInfo:
    for item in self.systemItems+self.pluginItems+list(self.itemList.values()):
      if item.layoutName == name:
        return item

  def correctName(self,clientName):
    if clientName.endswith('.json'):
      return clientName
    return clientName+".json"

  def handleDelete(self, name):
    name=self.correctName(name)
    item=self.findItem(name)
    if not item:
      return AVNUtil.getReturnData(error="%s %s not found"%(TYPE,name))
    if not item.canDelete:
      return AVNUtil.getReturnData(error="unable to delete %s "%(name))
    return super().handleDelete(LayoutInfo.stripPrefix(name))

  def handleRename(self, name, newName, requestparam):
    name=self.correctName(name)
    item=self.findItem(name)
    if not item:
      return AVNUtil.getReturnData(error="%s %s not found"%(TYPE,name))
    if not item.canDelete:
      return AVNUtil.getReturnData(error="unable to rename %s "%(name))
    return super().handleRename(
      LayoutInfo.stripPrefix(name),
      LayoutInfo.stripPrefix(self.correctName(newName))
      , requestparam)

  def handleUpload(self, name, handler, requestparam):
    name=self.correctName(name)
    if LayoutInfo.getType(name) != LayoutInfo.T_USER:
      return AVNUtil.getReturnData(error="cannot upload %s"%name)
    return super().handleUpload(LayoutInfo.stripPrefix(name), handler, requestparam)

  def handleDownload(self, name, handler, requestparam, **kwargs):
    name=self.correctName(name)
    item=self.findItem(name)
    if not item:
      raise Exception("%s %s not found"%(TYPE,name))
    return super().handleDownload(item.name, handler, requestparam,item.baseDir)

  def registerPluginLayout(self,pluginName,name,fileName):
    if not os.path.exists(fileName):
      return False
    name=self.correctName(name)
    info=LayoutInfo(self.type,self.getPrefix(),name,time=os.path.getmtime(fileName),baseDir=os.path.dirname(fileName))
    info.setName(LayoutInfo.T_PLUGIN,prefix=pluginName)
    if self.findItem(info.layoutName) is not None:
      AVNLog.error("trying to register an already existing plugin layout %s",name)
      return False
    self.pluginItems.append(info)

  def deregisterPluginLayout(self,pluginName,name):
    name=self.correctName(name)
    info=LayoutInfo(self.type,self.getPrefix(),name)
    info.setName(LayoutInfo.T_PLUGIN,prefix=pluginName)
    existing=self.findItem(info.layoutName)
    if not existing:
      AVNLog.error("item %s not found",name)
      return False
    self.pluginItems.remove(existing)
    return True


avnav_handlerList.registerHandler(AVNLayoutHandler)
