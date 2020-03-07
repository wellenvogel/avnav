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

class AVNAddonHandler(AVNWorker):
  '''
  handle the files in the user directory
  '''
  CHILDNAME="UserTool"
  TYPE="addon"
  @classmethod
  def getPrefix(cls):
    return None
  @classmethod
  def getConfigParam(cls, child=None):
    #we add this to the ones configured at HTTPServer
    if child == cls.CHILDNAME:
      return {
        'url':None, #we replace $HOST...
        'title':'',
        'icon':None, #an icon below $datadir/user
        'keepUrl':'', #auto detect
        'key':None #uniq name
      }
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
    self.userHandler=None   # AVNUserHandler
    self.imagesHandler=None # AVNImagesHandler
    AVNWorker.__init__(self,param)

  def start(self):
    self.userHandler=self.findHandlerByName('AVNUserHandler')
    if self.userHandler is None:
      raise Exception("unable to find a user handler")
    self.imagesHandler=self.findHandlerByName('AVNImagesHandler')
    if self.imagesHandler is None:
      raise Exception("unable to find an images handler")
    AVNWorker.start(self)

  # thread run method - just try forever
  def run(self):
    self.setName(self.getThreadPrefix())
    sleepTime=self.getFloatParam('interval')
    self.setInfo('main', "waiting", AVNWorker.Status.NMEA)
    while True:
      time.sleep(sleepTime)

  def findChild(self,name):
    children=self.param.get(self.CHILDNAME)
    if children is None:
      return -1
    if not isinstance(children,list):
      return -1
    for i in range(0,len(children)):
      child =children[i]
      if child.get('key') == name:
        return i
    return -1

  def getChildConfig(self,name):
    idx=self.findChild(name)
    if idx < 0:
      return {}
    else:
      return self.param[self.CHILDNAME][idx]

  def handleDelete(self,name):
    if name is None:
      raise Exception("missing name")
    name = AVNUtil.clean_filename(name)
    idx=self.findChild(name)
    if idx < 0:
      raise Exception("unable to find %s"%name)
    self.removeChildConfig(self.CHILDNAME,idx)

  def handleList(self,httpHandler=None):
    data = []
    childlist=self.param.get(self.CHILDNAME)
    i = 0
    if childlist is not None:
      for child in childlist:
        i+=1
        if child.get('key') is None:
          child['key']="user:%d"%i
        item=child.copy()
        data.append(item)
    if httpHandler is not None:
      host = httpHandler.headers.get('host')
      hostparts = host.split(':')
      for addon in httpHandler.server.addons:
        i+=1
        newAddon = addon.copy()
        if newAddon.get('key') is None:
          newAddon['key']="addon:%d"%i
        newAddon['url'] = addon['url'].replace('$HOST', hostparts[0])
        if newAddon.get('title') == '':
          del newAddon['title']
        data.append(newAddon)
    rt = AVNUtil.getReturnData(items=data)
    return rt

  def getHandledCommands(self):
    rt={"api": self.TYPE, "list": self.TYPE, "delete": self.TYPE}
    prefix=self.getPrefix()
    if prefix is not None:
      rt["path"]=prefix
    return rt

  def checkName(self,name,doRaise=True):
    cleanName=AVNUtil.clean_filename(name)
    if name != cleanName:
      if doRaise:
        raise Exception("name %s is invalid"%name)
      return False
    return True

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == 'api':
      command=AVNUtil.getHttpRequestParam(requestparam,'command')
      name=AVNUtil.getHttpRequestParam(requestparam,'name',True)
      if command == 'delete':
        self.handleDelete(name)
        return AVNUtil.getReturnData()
      elif command == 'list':
        return self.handleList(kwargs.get('handler'))
      elif command == 'update':
        userFile=AVNUtil.getHttpRequestParam(requestparam,'userFile',True)
        iconType=AVNUtil.getHttpRequestParam(requestparam,'iconType',True) #images,user
        iconName=AVNUtil.getHttpRequestParam(requestparam,'iconName',True)
        title=AVNUtil.getHttpRequestParam(requestparam,'title')
        param={'key':name}
        if not self.userHandler.checkExistance(userFile):
          raise Exception("user file %s not found"%userFile)
        param['url']=self.userHandler.nameToUrl(userFile)
        iconHandler=None
        if iconType == 'user':
          iconHandler=self.userHandler
        elif iconType == 'images':
          iconHandler=self.imagesHandler
        if iconHandler is None:
          raise Exception("unknown icon type %s"%iconType)
        if not iconHandler.checkExistance(iconName):
          raise Exception("icon %s not found "%iconName)
        param['icon']=iconHandler.nameToUrl(iconName)
        param['title']=title
        param['keepUrl']=False
        idx=self.findChild(name)
        for k in param.keys():
          self.changeChildConfig(self.CHILDNAME,idx,k,param[k],True)
        self.writeConfigChanges()

      raise Exception("unknown command for %s api request: %s"%(self.type,command))

    if type == "list":
      return self.handleList(kwargs.get('handler'))

    if type == 'delete':
      name = AVNUtil.getHttpRequestParam(requestparam, "name")
      self.handleDelete(name)
      return AVNUtil.getReturnData()

    raise Exception("unable to handle user request %s"%(type))





avnav_handlerList.registerHandler(AVNAddonHandler)

