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

import hashlib

import avnav_handlerList
from avnav_nmea import *
from avnav_worker import *
from httpserver import AVNHttpServer


class AVNUserAppHandler(AVNWorker):
  '''
  handle the files in the user directory
  '''
  CHILDNAME="UserTool"
  TYPE="addon"

  @classmethod
  def getStartupGroup(cls):
    return 3

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
        'newWindow':''
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
    return True

  def __init__(self,param):
    self.userHandler=None   # AVNUserHandler
    self.imagesHandler=None # AVNImagesHandler
    self.httpServer=None # AVNHttpServer
    self.addonList=[]
    self.additionalAddOns=[]
    AVNWorker.__init__(self,param)

  def startInstance(self, navdata):
    self.userHandler=self.findHandlerByName('AVNUserHandler')
    if self.userHandler is None:
      raise Exception("unable to find a user handler")
    self.imagesHandler=self.findHandlerByName('AVNImagesHandler')
    if self.imagesHandler is None:
      raise Exception("unable to find an images handler")
    self.httpServer = self.findHandlerByName(AVNHttpServer.getConfigName())
    if self.httpServer is None:
      raise Exception("unable to find AVNHttpServer")
    super().startInstance(navdata)

  # thread run method - just try forever
  def run(self):
    sleepTime=self.getFloatParam('interval')
    self.setInfo('main', "starting", WorkerStatus.STARTED)
    self.fillList()
    while not self.shouldStop():
      self.wait(sleepTime)


  def computeKey(self,entry):
    md5=hashlib.md5()
    for k in ('url','icon','title'):
      v=entry.get(k)
      if v is not None:
        try:
          md5.update(v.encode('utf-8'))
        except Exception as e:
          AVNLog.error("unable to compute md5 for %s: %s",v,e)
    return md5.hexdigest()

  def fillList(self):
    data = []
    alreadyFound=set()
    childlist = self.param.get(self.CHILDNAME)
    if childlist is not None:
      for child in childlist:
        url=child.get('url')
        key=self.computeKey(child)
        if url is None:
          child['invalid']=True
        if key in alreadyFound:
          AVNLog.error("duplicate user app found, ignoring %s",url)
          while key in alreadyFound:
            key = key + "x"
          child['name']=key
          child['invalid']=True
        else:
          child['name']=key
          alreadyFound.add(key)
        item=child.copy()
        item['canDelete']=True
        item['source']='user'
        data.append(item)
    serverAddons = self.httpServer.getParamValue(self.CHILDNAME)
    nr=0
    if serverAddons is not None:
      for addon in serverAddons:
        newAddon = addon.copy()
        newAddon['canDelete']=False
        newAddon['name']="server:%d"%nr
        newAddon['source']='legacy'
        nr+=1
        data.append(newAddon)
    for addon in data:
      url = addon.get('url')
      if url is None:
        addon['invalid']=True
      if not url.startswith("http"):
        userFile = self.findFileForUrl(url)
        if userFile is None:
          AVNLog.error("error: user url %s not found", url)
          addon['invalid']=True
      if addon.get('title') == '':
        del addon['title']
      keepUrl = False
      if addon.get('keepUrl') is None or addon.get('keepUrl') == '':
        if addon.get('url').startswith("http"):
          keepUrl = True
      else:
        if str(addon.get('keepUrl')).lower() == "true":
          keepUrl = True
      addon['keepUrl'] = keepUrl
      icon = addon['icon']
      if not icon.startswith("http"):
        if not icon.startswith("/user"):
          icon="/user/"+icon
          addon['icon']=icon
        iconpath = self.findFileForUrl(icon)
        if iconpath is None:
          AVNLog.error("icon path %s for %s not found, ignoring entry", icon, addon['url'])
          addon['invalid'] = True
    self.addonList=data
    self.setInfo('main', "active, %d addons"%len(data), WorkerStatus.NMEA)
    return


  def findFileForUrl(self,url):
    if url is None:
      return None
    if url.startswith("http"):
      return None
    (path,query)=self.httpServer.pathQueryFromUrl(url)
    filePath=self.httpServer.tryExternalMappings(path,query)
    if filePath is None or not os.path.exists(filePath):
      return None
    return filePath

  def findChild(self,name,ignoreInvalid=False):
    children=self.param.get(self.CHILDNAME)
    if children is None:
      return -1
    if not isinstance(children,list):
      return -1
    for i in range(0,len(children)):
      child =children[i]
      if child.get('name') == name:
        if ignoreInvalid:
          inList=[e for e in self.addonList if e.get('name') == name and not ( e.get('invalid') == True)]
          if len(inList) < 0:
            return -1
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
    self.fillList()


  def handleList(self,httpHandler,includeInvalid):
    host = httpHandler.headers.get('host')
    hostparts = host.split(':')
    outdata=[]
    src=self.additionalAddOns+self.addonList
    for addon in src:
      if addon.get('invalid') == True and not includeInvalid:
        continue
      item=addon.copy()
      if hostparts is not None:
        item['originalUrl']=addon['url']
        item['url'] = addon['url'].replace('$HOST', hostparts[0])
      outdata.append(item)
    rt = AVNUtil.getReturnData(items=outdata)
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


  def registerAddOn(self,name,url,iconPath,title=None,preventConnectionLost=False):
    newAddon = {
      'name': name,
      'url': url,
      'icon': iconPath,
      'title': title,
      'canDelete': False,
      'source':'plugin',
      'preventConnectionLost': preventConnectionLost
    }
    self.additionalAddOns.append(newAddon)

  def unregisterAddOn(self,name):
    if name is None:
      raise Exception("name cannot be None")
    for ao in self.additionalAddOns:
      if ao.get('name') == name:
        self.additionalAddOns.remove(ao)
        return True


  def deleteByUrl(self,url):
    """
    called by the user handler when a user file is deleted
    @param url:
    @return:
    """
    if url is None:
      return
    for addon in self.addonList:
      if addon.get('canDelete') == True and addon.get('url') == url:
        self.handleDelete(addon.get('name'))

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == 'api':
      command=AVNUtil.getHttpRequestParam(requestparam,'command',True)
      name=AVNUtil.getHttpRequestParam(requestparam,'name',False)
      if command == 'delete':
        self.handleDelete(name)
        return AVNUtil.getReturnData()
      elif command == 'list':
        includeInvalid = AVNUtil.getHttpRequestParam(requestparam, "invalid")
        return self.handleList(kwargs.get('handler'),includeInvalid is not None and includeInvalid.lower() == 'true')
      elif command == 'update':
        url=AVNUtil.getHttpRequestParam(requestparam,'url',True)
        icon=AVNUtil.getHttpRequestParam(requestparam,'icon',True)
        title=AVNUtil.getHttpRequestParam(requestparam,'title')
        newWindow=AVNUtil.getHttpRequestParam(requestparam,'newWindow')
        param = {}
        param['icon'] = icon
        param['title'] = title
        param['url'] = url
        param['newWindow']=newWindow
        param['keepUrl'] = url.startswith("http")
        doAdd=False
        if name is None:
          doAdd=True
          name=self.computeKey(param)
          #add
          for entry in self.addonList:
            if entry['name'] == name:
              raise Exception("trying to add an already existing url %s"%url)
        param['name']=name
        if not url.startswith("http"):
          userFile=self.findFileForUrl(url)
          if userFile is None:
            raise Exception("unable to find a local file for %s"%url)
        if not icon.startswith("http"):
          iconFile=self.findFileForUrl(icon)
          if iconFile is None:
            raise Exception("unable to find an icon file for %s"%icon)
        idx=self.findChild(name)
        if idx < 0 and not doAdd:
          raise Exception("did not find a user app with this name")
        for k in list(param.keys()):
          idx=self.changeChildConfig(self.CHILDNAME,idx,k,param[k],True)
        self.writeConfigChanges()
        self.fillList()
        return AVNUtil.getReturnData()
      raise Exception("unknown command for %s api request: %s"%(self.type,command))

    if type == "list":
      includeInvalid=AVNUtil.getHttpRequestParam(requestparam,"invalid")
      return self.handleList(kwargs.get('handler'),includeInvalid is not None and includeInvalid.lower() == 'true')

    if type == 'delete':
      name = AVNUtil.getHttpRequestParam(requestparam, "name",True)
      self.handleDelete(name)
      return AVNUtil.getReturnData()

    raise Exception("unable to handle user request %s"%(type))





avnav_handlerList.registerHandler(AVNUserAppHandler)

