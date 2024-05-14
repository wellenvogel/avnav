# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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

import socketserver
import http.server
import posixpath
import urllib.request, urllib.parse, urllib.error
import urllib.parse
from typing import Dict, Any

import gemf_reader

from httphandler import AVNHTTPHandler, WebSocketHandler

try:
  import create_overview
except:
  pass
from wpahandler import *
from avnav_manager import *
hasIfaces=False
try:
  import netifaces
  hasIfaces=True
except:
  pass
import threading



#a HTTP server with threads for each request
class AVNHttpServer(socketserver.ThreadingMixIn,http.server.HTTPServer, AVNWorker):
  webSocketHandlers: Dict[str, WebSocketHandler]
  navxml=AVNUtil.NAVXML
  PORT_CONFIG="httpPort"

  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def createInstance(cls, cfgparam):
    cls.checkSingleInstance()
    return AVNHttpServer(cfgparam, AVNHTTPHandler)
  @classmethod
  def getConfigParam(cls, child=None):
    if child == "Directory":
      return {
              "urlpath":None,
              "path":None
              }
    if child == "MimeType":
      return {
              'extension':None,
              'type':None
              }
    if child == 'UserTool':
      return {
        'url':None, #we replace $HOST...
        'title':'',
        'icon':None, #an icon below $datadir/user
        'keepUrl':'' #auto detect
      }
    if not child is None:
      return None
    rt={
                     "basedir":"",
                     "navurl":"/viewer/avnav_navi.php", #those must be absolute with /
                     "index":"/viewer/avnav_viewer.html",
                     "chartbase": "maps", #this is the URL without leading /!
                     cls.PORT_CONFIG:"8080",
                     "numThreads":"5",
                     "httpHost":"",
        }
    return rt
  
  def __init__(self,cfgparam,RequestHandlerClass):
    replace=AVNHandlerManager.filterBaseParam(cfgparam)
    if cfgparam.get('basedir')== '.':
      #some migration of the older setting - we want to use our global dir function, so consider . to be empty
      cfgparam['basedir']=''
    self.basedir=AVNHandlerManager.getDirWithDefault(cfgparam, 'basedir', defaultSub='', belowData=False)
    datadir=cfgparam[AVNHandlerManager.BASEPARAM.DATADIR]
    pathmappings={}
    marray=cfgparam.get("Directory")
    if marray is not None:
      pathmappings={}
      for mapping in marray:
        pathmappings[mapping['urlpath']]=AVNUtil.prependBase(AVNUtil.replaceParam(os.path.expanduser(mapping['path']),replace),self.basedir)
    if pathmappings.get('user') is None:
      pathmappings['user']=os.path.join(datadir,'user')
    self.pathmappings=pathmappings
    self.navurl=cfgparam['navurl']
    self.overwrite_map=({
                              '.png': 'image/png',
                              '.js': 'text/javascript; charset=utf-8',
                              '.avt': 'text/plain',
                              '.log': 'text/plain'
                              })
    mtypes=cfgparam.get('MimeType')
    if mtypes is not None:
      for mtype in mtypes:
        self.overwrite_map[mtype['extension']]=mtype['type']
    AVNWorker.__init__(self, cfgparam)
    self.type=AVNWorker.Type.HTTPSERVER
    self.handlers={}
    self.interfaceReader=None
    self.addresslist=[]
    self.handlerMap={}
    self.externalHandlers={} #prefixes that will be handled externally
    self.webSocketHandlers={}
    self.requestHandler=RequestHandlerClass
  
  def run(self):
    self.freeAllUsedResources()
    server_address=(self.param['httpHost'],int(self.param[self.PORT_CONFIG]))
    http.server.HTTPServer.__init__(self, server_address, self.requestHandler)
    self.claimUsedResource(UsedResource.T_TCP,self.server_port,force=True)
    self.setNameIfEmpty("%s-%d"%(self.getName(),self.server_port))
    AVNLog.info("HTTP server "+self.server_name+", "+str(self.server_port)+" started at thread "+self.name)
    self.setInfo('main',"serving at port %s"%(str(self.server_port)),WorkerStatus.RUNNING)
    charturl=self.getStringParam('chartbase')
    if charturl is not None:
      #set a default chart dir if not set via config url mappings
      if self.pathmappings.get(charturl) is None:
        self.pathmappings[charturl]=os.path.join(self.getStringParam(AVNHandlerManager.BASEPARAM.DATADIR), "charts")
    if hasIfaces:
      self.interfaceReader=threading.Thread(target=self.readInterfaces)
      self.interfaceReader.daemon=True
      self.interfaceReader.start()
    self.serve_forever()

  def handlePathmapping(self,path):
    if not self.pathmappings is None:
      for mk in list(self.pathmappings.keys()):
        if path.find(mk) == 0:
          path=self.pathmappings[mk]+path[len(mk):]
          AVNLog.ld("remapped path to",path)
          return path
      path=os.path.join(self.basedir,path)
      return path
    else:
      return path

  def getChartBaseDir(self):
    chartbaseurl=self.getStringParam('chartbase')
    return self.handlePathmapping(chartbaseurl)


  def getHandler(self,name):
    if self.handlers.get(name) is not None:
      return self.handlers.get(name)
    rt=self.findHandlerByName(name)
    if rt is not None:
      self.handlers[name]=rt
    return rt

  #read out all IP addresses
  def readInterfaces(self):
    while True:
      addresses=[]
      interfaces=netifaces.interfaces()
      for intf in interfaces:
        intfaddr=netifaces.ifaddresses(intf)
        if intfaddr is not None:
          ips=intfaddr.get(netifaces.AF_INET)
          if ips is not None:
            for ip in ips:
              if ip.get('addr') is not None:
                addresses.append(ip.get('addr')+":"+str(self.server_port))
      self.addresslist=addresses
      time.sleep(5)

  def getStatusProperties(self):
    if self.addresslist is not None and len(self.addresslist) > 0:
      return {'addresses':self.addresslist}
    else:
      return {}

  def registerRequestHandler(self,type,command,handler):
    if type == 'path':
      self.externalHandlers[command]=handler
      return
    if type == 'websocket':
      self.webSocketHandlers[command]=handler
      return
    if self.handlerMap.get(type) is None:
      self.handlerMap[type]={}
    self.handlerMap[type][command]=handler

  def getRequestHandler(self,type,command):
    typeMap=self.handlerMap.get(type)
    if typeMap is None:
      return None
    handler=typeMap.get(command)
    if handler is None:
      return None
    if handler.isDisabled():
      return None
    return handler

  def plainUrlToPath(self,path,usePathMapping=True):
    '''

    @param path: the URL as received
    @param usePathMapping: if true use the mapping table
    @return: an OS path
    '''
    words = path.split('/')
    words = [_f for _f in words if _f]
    path = ""
    for word in words:
          drive, word = os.path.splitdrive(word)
          head, word = os.path.split(word)
          if word in (".",".."): continue
          path = os.path.join(path, word)
    AVNLog.ld("request path",path)
    if not usePathMapping:
      return path
    #pathmappings expect to have absolute pathes!
    return self.handlePathmapping(path)

  @classmethod
  def pathQueryFromUrl(cls,url):
    (path, sep, query) = url.partition('?')
    path = path.split('#', 1)[0]
    path = posixpath.normpath(urllib.parse.unquote(path))
    return (path,query)

  def tryExternalMappings(self,path,query,handler=None):
    requestParam=urllib.parse.parse_qs(query,True)
    for prefix in list(self.externalHandlers.keys()):
      if path.startswith(prefix) and not self.externalHandlers[prefix].isDisabled():
        # the external handler can either return a mapped path (already
        # converted in an OS path - e.g. using plainUrlToPath)
        # or just do the handling by its own and return None
        try:
          return self.externalHandlers[prefix].handleApiRequest('path', path, requestParam, server=self,handler=handler)
        except:
          AVNLog.error("external mapping failed for %s: %s",path,traceback.format_exc())
        return None
    #legacy fallback:
    #if we have images at /user/images or /user/icons we can fallback to viewer
    #new pathes should be /user/viewer/images
    for prefix in ['icons','images']:
      cp="/user/"+prefix
      if path.startswith(cp):
        osPath = self.plainUrlToPath(path, True)
        if os.path.exists(osPath):
          return osPath
        return self.plainUrlToPath("/viewer/images/"+path[len(cp)+1:],True)

  def getWebSocketsHandler(self,path,query,handler):
    requestParam=urllib.parse.parse_qs(query,True)
    for prefix in list(self.webSocketHandlers.keys()):
      if path.startswith(prefix) and not self.webSocketHandlers[prefix].isDisabled():
        # the external handler can either return a mapped path (already
        # converted in an OS path - e.g. using plainUrlToPath)
        # or just do the handling by its own and return None
        try:
          return self.webSocketHandlers[prefix].handleApiRequest('websocket', path, requestParam, server=self,handler=handler)
        except:
          AVNLog.error("no websocket handler %s: %s",path,traceback.format_exc())
        return None


avnav_handlerList.registerHandler(AVNHttpServer)


