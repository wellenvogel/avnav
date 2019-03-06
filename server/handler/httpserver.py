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

import time
import socket
import threading
import os
import SocketServer
import BaseHTTPServer
import SimpleHTTPServer
import posixpath
import urllib
import urlparse
import re
import select
import gemf_reader
import cgi
import shutil
import avnav_handlerList
try:
  import create_overview
except:
  pass
from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
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
    return AVNHTTPServer(cfgparam,AVNHTTPHandler)
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
        'title':None,
        'icon':None, #an icon below $datadir/user
      }
    if not child is None:
      return None
    rt={
                     "basedir":".",
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
    self.basedir=cfgparam['basedir']
    if self.basedir==".":
      self.basedir=cfgparam[AVNConfig.BASEPARAM.BASEDIR]
    else:
      self.basedir=AVNUtil.replaceParam(self.basedir,replace)
    self.basedir=AVNUtil.prependBase(self.basedir,cfgparam[AVNConfig.BASEPARAM.BASEDIR])
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

  def getUrlPath(self,path):
    '''
    get an url path that can be used to obtain a file given

    :param path:
    :return: None if no mapping is possible
    '''
    fp=os.path.realpath(path)
    for k in self.pathmappings.keys():
      mpath=os.path.realpath(os.path.join(self.basedir,self.pathmappings[k]))
      if os.path.commonprefix([mpath,fp]) == mpath:
        return "/"+k+"/"+os.path.relpath(fp,mpath)
    mpath=os.path.realpath(self.basedir)
    if os.path.commonprefix([mpath,fp]) == mpath:
      return "/"+os.path.relpath(fp,mpath)
    return None




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
    if self.handlerMap.get(type) is None:
      self.handlerMap[type]={}
    self.handlerMap[type][command]=handler

  def getRequestHandler(self,type,command):
    typeMap=self.handlerMap.get(type)
    if typeMap is None:
      return None
    return typeMap.get(command)

avnav_handlerList.registerHandler(AVNHTTPServer)

class AVNHTTPHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    #allow write buffering
    #see https://lautaportti.wordpress.com/2011/04/01/basehttprequesthandler-wastes-tcp-packets/
    self.wbufsize=-1
    self.id=None
    self.getRequestParam=AVNUtil.getHttpRequestParam
    AVNLog.ld("receiver thread started",client_address)
    SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)
   
  def log_message(self, format, *args):
    if self.id is None:
      self.id=AVNLog.getThreadId()
      if self.id is None:
        self.id="?"
      threading.current_thread().setName("[%s]HTTPHandler"%(self.id))
    AVNLog.debug(format,*args)
  def handlePathmapping(self,path):
    return self.server.handlePathmapping(path)
  
  def do_POST(self):
    maxlen=5000000
    (path,sep,query) = self.path.partition('?')
    if not path.startswith(self.server.navurl):
      self.send_error(404, "unsupported post url")
      return
    try:
      ctype, pdict = cgi.parse_header(self.headers.getheader('content-type'))
      if ctype == 'multipart/form-data':
        postvars = cgi.parse_multipart(self.rfile, pdict)
      elif ctype == 'application/x-www-form-urlencoded':
        length = int(self.headers.getheader('content-length'))
        if length > maxlen:
          raise Exception("too much data"+unicode(length))
        postvars = cgi.parse_qs(self.rfile.read(length), keep_blank_values=1)
      elif ctype == 'application/json':
        length = int(self.headers.getheader('content-length'))
        if length > maxlen:
          raise Exception("too much data"+unicode(length))
        postvars = { '_json':self.rfile.read(length)}
      else:
        postvars = {}      
      requestParam=urlparse.parse_qs(query,True)
      requestParam.update(postvars)
      self.handleNavRequest(path,requestParam)
    except Exception as e:
      txt=traceback.format_exc()
      AVNLog.ld("unable to process request for ",path,query,txt)
      self.send_response(500,txt);
      self.end_headers()
      return
  
  #overwrite this from SimpleHTTPRequestHandler
  def send_head(self):
    path=self.translate_path(self.path)
    if path is None:
      return
    """Common code for GET and HEAD commands.

    This sends the response code and MIME headers.

    Return value is either a file object (which has to be copied
    to the outputfile by the caller unless the command was HEAD,
    and must be closed by the caller under all circumstances), or
    None, in which case the caller has nothing further to do.

    """
    
    f = None
    if os.path.isdir(path):
        if not self.path.endswith('/'):
            # redirect browser - doing basically what apache does
            self.send_response(301)
            self.send_header("Location", self.path + "/")
            self.end_headers()
            return None
        for index in "index.html", "index.htm":
            index = os.path.join(path, index)
            if os.path.exists(index):
                path = index
                break
        else:
            return self.list_directory(path)
    base, ext = posixpath.splitext(path)
    if ext in self.server.overwrite_map:
      ctype=self.server.overwrite_map[ext]
    else:
      ctype = self.guess_type(path)
    try:
        # Always read in binary mode. Opening files in text mode may cause
        # newline translations, making the actual size of the content
        # transmitted *less* than the content-length!
        f = open(path, 'rb')
    except IOError:
        self.send_error(404, "File not found")
        return None
    self.send_response(200)
    self.send_header("Content-type", ctype)
    fs = os.fstat(f.fileno())
    self.send_header("Content-Length", str(fs[6]))
    if path.endswith(".js") or path.endswith(".less"):
      self.send_header("cache-control","private, max-age=0, no-cache")
    self.send_header("Last-Modified", self.date_time_string(fs.st_mtime))
    self.end_headers()
    return f
    
  #overwrite this from SimpleHTTPRequestHandler
  def translate_path(self, path):
      """Translate a /-separated PATH to the local filename syntax.

      Components that mean special things to the local file system
      (e.g. drive or directory names) are ignored.  (XXX They should
      probably be diagnosed.)

      """
      # abandon query parameters
      (path,sep,query) = path.partition('?')
      path = path.split('#',1)[0]
      path = posixpath.normpath(urllib.unquote(path).decode('utf-8'))
      if path.startswith(self.server.navurl):
        requestParam=urlparse.parse_qs(query,True)
        self.handleNavRequest(path,requestParam)
        return None
      if path.startswith("/gemf"):
        self.handleGemfRequest(path,query)
        return None
      if path=="" or path=="/":
        path=self.server.getStringParam('index')
        self.send_response(301)
        self.send_header("Location", path)
        self.end_headers()
        return None
      words = path.split('/')
      words = filter(None, words)
      path = ""
      for word in words:
          drive, word = os.path.splitdrive(word)
          head, word = os.path.split(word)
          if word in (".",".."): continue
          path = os.path.join(path, word)
      AVNLog.ld("request path/query",path,query)
      #pathmappings expect to have absolute pathes!
      return self.handlePathmapping(path)
  

  #handle the request to an gemf file
  def handleGemfRequest(self,path,query):
    try:
      path=path.replace("/gemf/","",1)
      parr=path.split("/")
      gemfname=parr[0]
      for g in self.server.gemflist.values():
        if g['name']==gemfname:
          AVNLog.debug("gemf file %s, request %s, lend=%d",gemfname,path,len(parr))
          #found file
          #basically we can today handle 2 types of requests:
          #get the overview /gemf/<name>/avnav.xml
          #get a tile /gemf/<name>/<srcname>/z/x/y.png
          if parr[1] == self.server.navxml:
            AVNLog.debug("avnav request for GEMF %s",gemfname)
            data=g['avnav']
            self.send_response(200)
            self.send_header("Content-type", "text/xml")
            self.send_header("Content-Length", len(data))
            self.send_header("Last-Modified", self.date_time_string())
            self.end_headers()
            self.wfile.write(data)
            return None
          if len(parr) != 5:
            raise Exception("invalid request to GEMF file %s: %s" %(gemfname,path))
          data=g['gemf'].getTileData((int(parr[2]),int(parr[3]),int(parr[4].replace(".png",""))),parr[1])
          if data is None:
            empty=self.server.emptytile
            if empty is not None:
              data=empty
          if data is None:
            self.send_error(404,"File %s not found"%(path))
            return None
          self.send_response(200)
          self.send_header("Content-type", "image/png")
          self.send_header("Content-Length", len(data))
          self.send_header("Last-Modified", self.date_time_string())
          self.end_headers()
          self.wfile.write(data)
          return None
      raise Exception("gemf file %s not found" %(gemfname))
    except:
      self.send_error(500,"Error: %s"%(traceback.format_exc()))
      return
      
        
  #send a json encoded response
  def sendNavResponse(self,rtj,requestParam):
    if not rtj is None:
      self.send_response(200)
      if not requestParam.get('callback') is None:
        rtj="%s(%s);"%(requestParam.get('callback'),rtj)
        self.send_header("Content-type", "text/javascript")
      else:
        self.send_header("Content-type", "application/json")
      self.send_header("Content-Length", str(len(rtj)))
      self.send_header("Last-Modified", self.date_time_string())
      self.end_headers()
      self.wfile.write(rtj)
      AVNLog.ld("nav response",rtj)
    else:
      raise Exception("empty response")
  #handle a navigational query
  #request parameters:
  #request=gps&filter=TPV&bbox=54.531,13.014,54.799,13.255
  #request: gps,status,...
  #filter is a key of the map in the form prefix-suffix
  
  def handleNavRequest(self,path,requestParam):
    #check if we have something behind the navurl
    #treat this as a filename and set it ion the request parameter
    fname=path[(len(self.server.navurl)+1):]
    if fname is not None and fname != "":
      fname=fname.split('?',1)[0]
      if fname != "":
        if requestParam.get('filename') is None:
          requestParam['filename']=[fname.encode('utf-8')]
    requestType=requestParam.get('request')
    if requestType is None:
      requestType='gps'
    else:
      requestType=requestType[0]
    AVNLog.ld('navrequest',requestParam)
    try:
      rtj=None
      if requestType=='gps':
        rtj=self.handleGpsRequest(requestParam)
      elif requestType=='ais':
        rtj=self.handleAISRequest(requestParam)
      elif requestType=='status':
        rtj=self.handleStatusRequest(requestParam)
      elif requestType=='debuglevel':
        rtj=self.handleDebugLevelRequest(requestParam)
      elif requestType=='listCharts':
        rtj=self.handleListChartRequest(requestParam)
      elif requestType=='listdir':
        rtj=self.handleListDir(requestParam)
      elif requestType=='readAddons':
        rtj=self.handleAddonRequest(requestParam)
      elif requestType=='download':
        #download requests are special
        # the dow not return json...
        self.handleDownloadRequest(requestParam)
        return
      elif requestType=='upload':
        try:
          rtj=self.handleUploadRequest(requestParam)
        except Exception as e:
          AVNLog.error("upload error: %s",unicode(e))
          rtj=json.dumps({'status':unicode(e)})
      elif requestType=='delete':
        rtj=self.handleDeleteRequest(requestParam)
      else:
        handler=self.server.getRequestHandler('api',requestType)
        if handler is None:
          raise Exception("no handler found for request %s",requestType)
        rtj=handler.handleApiRequest('api',requestType,requestParam)
        if isinstance(rtj,dict) or isinstance(rtj,list):
          rtj=json.dumps(rtj)
      self.sendNavResponse(rtj,requestParam)
    except Exception as e:
          text=e.message+"\n"+traceback.format_exc()
          AVNLog.error("unable to process request for navrequest %s"%text)
          self.send_response(500,text)
          self.end_headers()
          return
  #return AIS targets
  #parameter: lat,lon,distance (in NM) - limit to this distance      
  def handleAISRequest(self,requestParam):
    rt=self.server.navdata.getAisData()
    lat=None
    lon=None
    dist=None
    try:
      lat=float(self.getRequestParam(requestParam, 'lat'))
      lon=float(self.getRequestParam(requestParam, 'lon'))
      dist=float(self.getRequestParam(requestParam, 'distance')) #distance in NM
    except:
      pass
    frt=[]
    if not lat is None and not lon is None and not dist is None:
      dest=(lat,lon)
      AVNLog.debug("limiting AIS to lat=%f,lon=%f,dist=%f",lat,lon,dist)
      for entry in rt:
        try:
          fentry=AVNUtil.convertAIS(entry)
          mdist=AVNUtil.distance((fentry.get('lat'),fentry.get('lon')), dest)
          if mdist<=dist:
            fentry['distance']=mdist
            frt.append(fentry)
          else:
            AVNLog.debug("filtering out %s due to distance %f",unicode(fentry['mmsi']),mdist)
        except:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    else:
      for entry in rt:
        try:
          frt.append(AVNUtil.convertAIS(entry))
        except Exception as e:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    return json.dumps(frt)
  
  def handleGpsRequest(self,requestParam):
    rtv=self.server.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS)
    #we depend the status on the mode: no mode - red (i.e. not connected), mode: 1- yellow, mode 2+lat+lon - green
    status="red"
    mode=rtv.get('mode')
    if mode is not None:
      if int(mode) == 1:
        status="yellow"
      if int(mode) == 2 or int(mode) == 3:
        if rtv.get("lat") is not None and rtv.get('lon') is not None:
          status="green"
        else:
          status="yellow"
    src=self.server.navdata.getLastSource(AVNStore.SOURCE_KEY_GPS)
    #TODO: add info from sky
    sky=self.server.navdata.getDataByPrefix(AVNStore.BASE_KEY_SKY)
    visible=set()
    used=set()
    try:
      satellites=sky.get('satellites')
      if satellites is not None:
        for sat in satellites.keys():
          visible.add(sat)
          if satellites[sat].get('used'):
            used.add(sat)
    except:
      AVNLog.info("unable to get sat count: %s",traceback.format_exc())
    statusNmea={"status":status,"source":src,"info":"Sat %d visible/%d used"%(len(visible),len(used))}
    status="red"
    numAis=self.server.navdata.getAisCounter()
    if numAis > 0:
      status="green"
    src=self.server.navdata.getLastSource(AVNStore.SOURCE_KEY_AIS)
    statusAis={"status":status,"source":src,"info":"%d targets"%(numAis)}
    rtv["raw"]={"status":{"nmea":statusNmea,"ais":statusAis}}
    alarmHandler = self.server.findHandlerByName("AVNAlarmHandler")
    if alarmHandler is not None:
      alarmInfo={}
      alarms=alarmHandler.getRunningAlarms()
      for k in alarms.keys():
        alarmInfo[k]={'running':True,'alarm':k}
      rtv['raw']['alarms']=alarmInfo
    return json.dumps(rtv)


  def handleStatusRequest(self,requestParam):
    rt=[]
    for handler in AVNWorker.getAllHandlers(True):
      entry={'configname':handler.getConfigName(),
             'config': handler.getParam(),
             'name':handler.getName(),
             'info':handler.getInfo(),
             'disabled': handler.isDisabled(),
             'properties':handler.getStatusProperties() if not handler.isDisabled() else {}}
      rt.append(entry)       
    return json.dumps({'handler':rt})
  def handleDebugLevelRequest(self,requestParam):
    rt={'status':'ERROR','info':'missing parameter'}
    level=self.getRequestParam(requestParam,'level')
    if not level is None:
      crt=AVNLog.changeLogLevel(level)
      if crt:
        rt['status']='OK'
        rt['info']='set loglevel to '+str(level)
      else:
        rt['info']="invalid level "+str(level)
    filter=self.getRequestParam(requestParam,'filter')
    AVNLog.setFilter(filter)
    return json.dumps(rt) 

  def getChartDir(self):
    chartbaseUrl=self.server.getStringParam('chartbase')
    if chartbaseUrl is None:
      return None
    chartbaseDir=self.handlePathmapping(chartbaseUrl)
    if not os.path.isdir(chartbaseDir):
      return None
    return chartbaseDir

  def listCharts(self,requestParam):
    chartbaseUrl=self.server.getStringParam('chartbase')
    rt={
        'status': 'ERROR',
        'info':'chart directory not found'}
    chartbaseDir=self.getChartDir()
    if chartbaseDir is None:
      return json.dumps(rt)
    rt['status']='OK'
    rt['data']=[]
    for gemfdata in self.server.gemflist.values():
      entry={
             'name':gemfdata['name'],
             'url':"/gemf/"+gemfdata['name'],
             'charturl':"/gemf/"+gemfdata['name'],
             'time': gemfdata['mtime']
      }
      rt['data'].append(entry)
    try:
      list = os.listdir(chartbaseDir)
    except os.error:
      rt['info']="unable to read chart directory %s"%(chartbaseDir)
      return json.dumps(rt)
    urlbase=self.server.getStringParam('chartbaseurl')
    if urlbase == '':
      urlbase=None
    if urlbase is not None:
      host,port=self.request.getsockname()
      urlbase=re.sub('\$host',host,urlbase)
    list.sort(key=lambda a: a.lower())
    icon="avnav.jpg"
    AVNLog.debug("reading chartDir %s",chartbaseDir)
    for de in list:
      if de==".":
        continue
      if de=="..":
        continue
      dpath=os.path.join(chartbaseDir,de)
      fname=os.path.join(dpath,self.server.navxml)
      if not os.path.isdir(dpath):
        continue
      if not os.path.isfile(fname):
        continue
      url="/"+chartbaseUrl+"/"+de
      charturl=url
      if urlbase is not None:
        charturl=urlbase+"/"+de
      #TDOD: read title from avnav
      entry={
             'name':de,
             'url':url,
             'charturl':charturl,
             'time': os.path.getmtime(fname)
             }
      if os.path.exists(os.path.join(dpath,icon)):
        entry['icon']="/"+chartbaseUrl+"/"+icon
      AVNLog.ld("chartentry",entry)
      rt['data'].append(entry)
    num=len(rt['data'])
    rt['info']="read %d entries from %s"%(num,chartbaseDir)
    return rt

  def handleListChartRequest(self,requestParam):
    return json.dumps(self.listCharts(requestParam))

  def writeStream(self,bToSend,fh):
    maxread = 1000000
    while bToSend > 0:
      buf = fh.read(maxread if bToSend > maxread else bToSend)
      if buf is None or len(buf) == 0:
        raise Exception("no more data")
      self.wfile.write(buf)
      bToSend -= len(buf)
    fh.close()

  #download requests
  #parameters:
  #   type
  #   type specific parameters
  #        route: name
  #   filename
  def handleDownloadRequest(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    try:
      handler=self.server.getRequestHandler('download',type)
      if handler is not None:
        AVNLog.debug("found handler %s to handle download %s"%(handler.getConfigName(), type))
        dl=handler.handleApiRequest('download',type,requestParam)
        if dl is None:
          raise Exception("unable to download %s",type)
        if dl.get('mimetype') is None:
          raise Exception("no mimetype")
        if dl.get('size') is None:
          raise Exception("no size")
        if dl.get("stream") is None:
          raise Exception("missing stream")
        self.send_response(200)
        fname = self.getRequestParam(requestParam, "filename")
        if fname is not None and fname != "":
          self.send_header("Content-Disposition", "attachment")
        self.send_header("Content-type", dl['mimetype'])
        self.send_header("Content-Length", dl['size'])
        self.send_header("Last-Modified", self.date_time_string())
        self.end_headers()
        try:
          self.writeStream(dl['size'],dl['stream'])
        except:
          try:
            dl['stream'].close()
          except:
            pass
        return

    except:
      self.send_error(404,traceback.format_exc(1))
      return
    rtd=None
    mtype="application/octet-stream"
    if type=="chart":
      requestOk=True
      url=self.getRequestParam(requestParam,"url")
      if url is None:
        rtd="missing parameter url in request"
      else:
        if url.startswith("/gemf"):
          url=url.replace("/gemf/","",1)
          gemfname=url.split("/")[0]+".gemf"
          gemfentry=self.server.gemflist.get(gemfname)
          if gemfentry is None:
            rtd="file %s not found"%(url)
          else:
            #TODO: currently we only download the first file
            fname=gemfentry['gemf'].filename
            if os.path.isfile(fname):
              fh=open(fname,"rb")
              maxread=1000000
              if fh is not None:
                try:
                  bToSend=os.path.getsize(fname)
                  self.send_response(200)
                  self.send_header("Content-Disposition","attachment")
                  self.send_header("Content-type", mtype)
                  self.send_header("Content-Length", bToSend)
                  self.end_headers()
                  self.writeStream(bToSend,fh)
                  fh.close()
                except:
                  AVNLog.error("error during download %s",url)
                  try:
                    fh.close()
                  except:
                    pass
                return
    self.send_error(404, "invalid download request %s"%type)

  #we use a special form of upload
  #where the file is completely unencoded in the input stream
  #returns json status
  def handleUploadRequest(self,requestParam):
    rlen=None
    try:
      rlen=self.headers.get("Content-Length")
      if rlen is None:
        raise Exception("Content-Length not set in upload request")
      self.connection.settimeout(30)
      type=self.getRequestParam(requestParam,"type")
      handler=self.server.getRequestHandler("upload",type)
      if handler is not None:
        AVNLog.debug("found handler for upload request %s:%s"%(type,handler.getConfigName()))
        handler.handleApiRequest("upload",type,rfile=self.rfile,flen=rlen)
        return json.dumps({'status': 'OK'})
      if type == "chart":
        filename=self.getRequestParam(requestParam,"filename")
        if filename is None:
          raise Exception("missing filename in upload request")
        filename=filename.replace("/","")
        if not filename.endswith(".gemf"):
          raise Exception("invalid filename %s, must be .gemf"%filename)
        outname=os.path.join(self.getChartDir(),filename)
        if os.path.exists(outname):
          raise Exception("chart file %s already exists"%filename)
        writename=outname+".tmp"
        AVNLog.info("start upload of chart file %s",outname)
        fh=open(writename,"wb")
        if fh is None:
          raise Exception("unable to write to %s"%filename)
        bToRead=int(rlen)
        bufSize=1000000
        try:
          while bToRead > 0:
            buf=self.rfile.read(bufSize if bToRead >= bufSize else bToRead)
            if len(buf) == 0 or buf is None:
              raise Exception("no more data received")
            bToRead-=len(buf)
            fh.write(buf)
          fh.close()
          os.rename(writename,outname)
          AVNLog.info("created chart file %s",filename)
        except Exception as e:
          try:
            fh.close()
          except:
            pass
          try:
            os.unlink(writename)
          except:
            pass
          AVNLog.error("upload of chart file %s failed: %s",filename,unicode(e))
          raise Exception("exception during writing %s: %s"%(writename,unicode(e)))
        self.server.notifyGemf()
        return json.dumps({'status':'OK'})
      else:
        raise Exception("invalid request %s",type)
    except Exception as e:
      return json.dumps({'status':unicode(e)})



  def handleListDir(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    if type is None:
      raise Exception("no type for listdir")
    handler=self.server.getRequestHandler('list',type)
    if handler is not None:
      AVNLog.debug("found handler for list request %s:%s" % (type, handler.getConfigName()))
      rt=handler.handleApiRequest('list',type,requestParam)
      if rt is None:
        raise Exception("invalid list response")
      return json.dumps(rt)

    if type != "chart" :
      raise Exception("invalid type %s, allowed is chart"%type)
    rt={'status':'OK','items':[]}
    charts=self.listCharts(requestParam)
    rt['items']=charts['data']
    return json.dumps(rt)

  def handleDeleteRequest(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    if type is None:
      raise Exception("no type for delete")
    type = self.getRequestParam(requestParam, "type")
    handler = self.server.getRequestHandler('delete', type)
    rt = {'status': 'OK'}
    if handler is not None:
      AVNLog.debug("found handler for delete request %s:%s" % (type, handler.getConfigName()))
      handler.handleApiRequest('delete', type, requestParam)
      return json.dumps(rt)
    if type != "chart" :
      raise Exception("invalid type %s, allowed is chart"%type)
    rt={'status':'OK'}
    dir=None
    if type == "chart":
      dir=self.getChartDir()
      url=self.getRequestParam(requestParam,"url")
      if url is None:
        raise Exception("no url for delete chart")
      AVNLog.debug("delete chart request, url=%s",url)
      if url.startswith("/gemf"):
          url=url.replace("/gemf/","",1)
          gemfname=url.split("/")[0]+".gemf"
          gemfentry=self.server.gemflist.get(gemfname)
          if gemfentry is None:
            raise Exception("chart %s not found "%gemfname)
          AVNLog.info("deleting gemf charts %s",gemfname)
          gemfentry['gemf'].deleteFiles()
          try:
            #potentially the gemf handler was faster then we...
            del self.server.gemflist[gemfname]
          except:
            pass
          importer=self.server.getHandler("AVNImporter") #cannot import this as we would get cycling dependencies...
          if importer is not None:
            importer.deleteImport(gemfname)
          return json.dumps(rt)
      else:
        chartbaseUrl=self.server.getStringParam('chartbaseurl')
        if not url.startswith("/"+chartbaseUrl):
          raise Exception("invalid chart url %s"%url)
        dirname=url.replace("/"+chartbaseUrl+"/").split("/")[0]
        if dirname == "." or dirname == "..":
          raise Exception("invalid chart url %s"%url)
        dirname=os.path.join(self.getChartDir(),dirname)
        if not os.path.isdir(dirname):
          raise Exception("chart dir %s not found"%dirname)
        AVNLog.info("deleting chart directory %s",dirname)
        #TODO: how to avoid timeout here?
        shutil.rmtree(dirname)
        return json.dumps(rt)

  def handleAddonRequest(self,param):
    host=self.headers.get('host')
    host,dummy=host.split(':')
    outData=[]
    for addon in self.server.addons:
      newAddon=addon.copy()
      newAddon['url']=addon['url'].replace('$HOST',host)
      outData.append(newAddon)
    return json.dumps({
      'status':'OK',
      'data':outData
    })


