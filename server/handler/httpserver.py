#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
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

import SocketServer
import BaseHTTPServer
import gemf_reader

from handler.httphandler import AVNHTTPHandler

try:
  import create_overview
except:
  pass
from wpahandler import *
from avnav_config import *
hasIfaces=False
try:
  import netifaces
  hasIfaces=True
except:
  pass
import threading

 
  

#a HTTP server with threads for each request
class AVNHTTPServer(SocketServer.ThreadingMixIn,BaseHTTPServer.HTTPServer, AVNWorker):
  navxml=AVNUtil.NAVXML
  
  @classmethod
  def getConfigName(cls):
    return "AVNHttpServer"
  @classmethod
  def createInstance(cls, cfgparam):
    cls.checkSingleInstance()
    return AVNHTTPServer(cfgparam, AVNHTTPHandler)
  @classmethod
  def getConfigParam(cls,child):
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
      }
    if not child is None:
      return None
    rt={
                     "basedir":"",
                     "navurl":"/viewer/avnav_navi.php", #those must be absolute with /
                     "index":"/viewer/avnav_viewer.html",
                     "chartbase": "maps", #this is the URL without leading /!
                     "chartbaseurl":"",   #if this is set to a non empty value, this will be prepended to the
                                          #chart urls, set e.g. to http://$host/charts
                     "httpPort":"8080",
                     "numThreads":"5",
                     "httpHost":"",
                     "upzoom":"2",         #number of "pseudo" layers created for gemf files
                     "empty":"none"        #empty tile (OS path) - special name "none" to indicate no empty...
        }
    return rt
  
  def __init__(self,cfgparam,RequestHandlerClass):
    replace=AVNConfig.filterBaseParam(cfgparam)
    if cfgparam.get('basedir')== '.':
      #some migration of the older setting - we want to use our global dir function, so consider . to be empty
      cfgparam['basedir']=''
    self.basedir=AVNConfig.getDirWithDefault(cfgparam,'basedir',defaultSub='',belowData=False)
    datadir=cfgparam[AVNConfig.BASEPARAM.DATADIR]
    pathmappings=None
    #a list of gemf files (key is the url below charts)
    self. gemflist={}
    marray=cfgparam.get("Directory")
    if marray is not None:
      pathmappings={}
      for mapping in marray:
        pathmappings[mapping['urlpath']]=AVNUtil.prependBase(AVNUtil.replaceParam(os.path.expanduser(mapping['path']),replace),self.basedir)
    if pathmappings.get('user') is None:
      pathmappings['user']=os.path.join(datadir,'user')
    self.pathmappings=pathmappings
    charturl=cfgparam['chartbase']
    if charturl is not None:
      #set a default chart dir if not set via config url mappings
      if self.pathmappings.get(charturl) is None:
        self.pathmappings[charturl]=os.path.join(cfgparam[AVNConfig.BASEPARAM.DATADIR],"charts")
    self.navurl=cfgparam['navurl']
    self.overwrite_map=({
                              '.png': 'image/png',
                              '.js': 'text/javascript; charset=utf-8'
                              })
    mtypes=cfgparam.get('MimeType')
    if mtypes is not None:
      for mtype in mtypes:
        self.overwrite_map[mtype['extension']]=mtype['type']
    addons=cfgparam.get('UserTool')
    self.addons=[]
    if addons is not None:
      addonkey=1
      for addon in addons:
        if addon.get('url') is not None and addon.get('icon') is not None:
          iconpath=os.path.join(self.pathmappings['user'],addon['icon'])
          if not os.path.exists(iconpath):
            AVNLog.error("icon path %s for %s not found, ignoring entry",iconpath,addon['url'])
            continue
          newAddon={
            'key':"addon%d"%addonkey,
            'url':addon['url'],
            'icon':'/user/'+addon['icon'],
            'title':addon.get('title')
          }
          self.addons.append(newAddon)
          addonkey+=1
    server_address=(cfgparam['httpHost'],int(cfgparam['httpPort']))
    AVNWorker.__init__(self, cfgparam)
    self.type=AVNWorker.Type.HTTPSERVER
    self.handlers={}
    self.interfaceReader=None
    self.gemfCondition=threading.Condition()
    self.addresslist=[]
    self.handlerMap={}
    self.externalHandlers={} #prefixes that will be handled externally
    BaseHTTPServer.HTTPServer.__init__(self, server_address, RequestHandlerClass, True)
  def getName(self):
    return "HTTPServer"
  
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),"HTTPServer"))
    AVNLog.info("HTTP server "+self.server_name+", "+unicode(self.server_port)+" started at thread "+self.name)
    self.setInfo('main',"serving at port %s"%(unicode(self.server_port)),AVNWorker.Status.RUNNING)
    self.gemfhandler=threading.Thread(target=self.handleGemfFiles)
    self.gemfhandler.daemon=True
    emptyname=self.getParamValue("empty", False)
    self.emptytile=None
    if emptyname is not None and emptyname != "none":
      fname=os.path.join(self.basedir,emptyname)
      AVNLog.info("HTTP server trying empty tile %s"%(fname))
      if os.path.isfile(fname):
        AVNLog.info("HTTP server reading empty tile %s"%(fname))
        with open(fname,"rb") as f:
          self.emptytile=f.read()
    self.gemfhandler.start()
    if hasIfaces:
      self.interfaceReader=threading.Thread(target=self.readInterfaces)
      self.interfaceReader.daemon=True
      self.interfaceReader.start()
    self.serve_forever()
    
  def handlePathmapping(self,path):
    if not self.pathmappings is None:
      for mk in self.pathmappings.keys():
        if path.find(mk) == 0:
          path=self.pathmappings[mk]+path[len(mk):]
          AVNLog.ld("remapped path to",path)
          return path
      path=os.path.join(self.basedir,path)
      return path
    else:
      return path


  def waitOnGemfCondition(self,timeout):
    self.gemfCondition.acquire()
    try:
      AVNLog.debug("gemf reader wait")
      self.gemfCondition.wait(timeout)
    except:
      pass
    AVNLog.debug("gemf reader wait end")
    self.gemfCondition.release()

  def notifyGemf(self):
    self.gemfCondition.acquire()
    try:
      self.gemfCondition.notifyAll()
    except:
      pass
    self.gemfCondition.release()

  def getChartBaseDir(self):
    chartbaseurl=self.getStringParam('chartbase')
    return self.handlePathmapping(chartbaseurl)

  #check the list of open gemf files
  def handleGemfFiles(self):
    while True:
      try:
        chartbaseurl=self.getStringParam('chartbase')
        if chartbaseurl is None:
          AVNLog.debug("no chartbase defined - no gemf handling")
          self.waitOnGemfCondition(5)
          continue
        chartbaseDir=self.getChartBaseDir()
        if not os.path.isdir(chartbaseDir):
          AVNLog.debug("chartbase is no directory - no gemf handling")
          self.waitOnGemfCondition(5)
          continue
        files=os.listdir(chartbaseDir)
        oldlist=self.gemflist.keys()
        currentlist=[]
        for f in files:
          if not f.endswith(".gemf"):
            continue
          if not os.path.isfile(os.path.join(chartbaseDir,f)):
            continue
          AVNLog.debug("found gemf file %s",f)
          currentlist.append(f)
        for old in oldlist:
          if not old in currentlist:
            AVNLog.info("closing gemf file %s",old)
            oldfile=self.gemflist.get(old)
            if oldfile is None:
              #maybe someone else already deleted...
              continue
            oldfile['gemf'].close()
            try:
              del self.gemflist[old]
            except:
              pass
        for newgemf in currentlist:
          fname=os.path.join(chartbaseDir,newgemf)
          govname=fname.replace(".gemf",".xml")
          gstat=os.stat(fname)
          ovstat=None
          if (os.path.isfile(govname)):
            ovstat=os.stat(govname)
          oldgemfFile=self.gemflist.get(newgemf)
          if oldgemfFile is not None:
            mtime=gstat.st_mtime
            if ovstat is not None:
              if ovstat.st_mtime > mtime:
                mtime=ovstat.st_mtime
            if mtime != oldgemfFile['mtime']:
              AVNLog.info("closing gemf file %s due to changed timestamp",newgemf)
              oldgemfFile['gemf'].close()
              try:
                del self.gemflist[newgemf]
              except:
                pass
              oldgemfFile=None
          if oldgemfFile is None:
            AVNLog.info("trying to add gemf file %s",fname)
            gemf=gemf_reader.GemfFile(fname)
            try:
              gemf.open()
              avnav=None
              if ovstat is not None:
                #currently this is some hack - if there is an overview
                #xml file we assume the gemf to have one source...
                baseurl=gemf.sources[0].get('name')
                AVNLog.info("using %s to create the GEMF overview, baseurl=%s"%(govname,baseurl))
                avnav=create_overview.parseXml(govname,baseurl)
                if avnav is None:
                  AVNLog.error("unable to parse GEMF overview %s"%(govname,))
              if avnav is None:
                avnav=self.getGemfInfo(gemf)
              gemfdata={'name':newgemf.replace(".gemf",""),'gemf':gemf,'avnav':avnav,'mtime':gstat.st_mtime}
              self.gemflist[newgemf]=gemfdata
              AVNLog.info("successfully added gemf file %s %s",newgemf,unicode(gemf))
            except:
              AVNLog.error("error while trying to open gemf file %s  %s",fname,traceback.format_exc())
      except:
        AVNLog.error("Exception in gemf handler %s, ignore",traceback.format_exc())
      self.waitOnGemfCondition(5)

  #get the avnav info from a gemf file
  #we can nicely reuse here the stuff we have for MOBAC atlas files
  def getGemfInfo(self,gemf):
    try:
      data=gemf.getSources()
      options={}
      options['upzoom']=self.getIntParam('upzoom')
      rt=create_overview.getGemfInfo(data,options)
      AVNLog.info("created GEMF overview for %s",gemf.filename)
      AVNLog.debug("overview for %s:%s",gemf.filename,rt)
      return rt

    except:
      AVNLog.error("error while trying to get the overview data for %s  %s",gemf.filename,traceback.format_exc())
    return "<Dummy/>"
  
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
    if self.handlerMap.get(type) is None:
      self.handlerMap[type]={}
    self.handlerMap[type][command]=handler

  def getRequestHandler(self,type,command):
    typeMap=self.handlerMap.get(type)
    if typeMap is None:
      return None
    return typeMap.get(command)

avnav_handlerList.registerHandler(AVNHTTPServer)


