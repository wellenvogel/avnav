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
try:
  import create_overview
except:
  pass
from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_router import *
from avnav_trackwriter import *
from avnav_httpserver import *

 
  

#a HTTP server with threads for each request
class AVNHTTPServer(SocketServer.ThreadingMixIn,BaseHTTPServer.HTTPServer, AVNWorker):
  instances=0
  navxml="avnav.xml"
  
  @classmethod
  def getConfigName(cls):
    return "AVNHttpServer"
  @classmethod
  def createInstance(cls, cfgparam):
    if cls.instances > 0:
      raise Exception("only one AVNHttpServer is allowed")
    cls.instances+=1
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
    self.basedir=cfgparam['basedir']
    if self.basedir==".":
      self.basedir=os.getcwd()
    pathmappings=None
    #a list of gemf files (key is the url below charts)
    self.gemflist={}
    marray=cfgparam.get("Directory")
    if marray is not None:
      pathmappings={}
      for mapping in marray:
        pathmappings[mapping['urlpath']]=os.path.expanduser(mapping['path'])
    self.pathmappings=pathmappings
    self.navurl=cfgparam['navurl']
    self.overwrite_map=({
                              '.png': 'image/png'
                              })
    mtypes=cfgparam.get('MimeType')
    if mtypes is not None:
      for mtype in mtypes:
        self.overwrite_map[mtype['extension']]=mtype['type']
    server_address=(cfgparam['httpHost'],int(cfgparam['httpPort']))
    AVNWorker.__init__(self, cfgparam)
    self.type=AVNWorker.Type.HTTPSERVER;
    self.handlers={}
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
  #check the list of open gemf files
  def handleGemfFiles(self):
    while True:
      try:
        chartbaseurl=self.getStringParam('chartbase')
        if chartbaseurl is None:
          AVNLog.debug("no chartbase defined - no gemf handling")
          time.sleep(5)
          continue
        chartbaseDir=self.handlePathmapping(chartbaseurl)
        if not os.path.isdir(chartbaseDir):
          AVNLog.debug("chartbase is no directory - no gemf handling")
          time.sleep(5)
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
            oldfile=self.gemflist[old]
            oldfile['gemf'].close()
            del self.gemflist[old]
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
              del self.gemflist[newgemf]
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
      time.sleep(5)

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



class AVNHTTPHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    #allow write buffering
    #see https://lautaportti.wordpress.com/2011/04/01/basehttprequesthandler-wastes-tcp-packets/
    self.wbufsize=-1
    self.id=None
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
  
  
  #return the first element of a request param if set
  @classmethod
  def getRequestParam(cls,param,name):
    pa=param.get(name)
    if pa is None:
      return None
    if len(pa) > 0:
      return pa[0].decode('utf-8')
    return None

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
          requestParam['filename']=[fname]
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
      if requestType=='ais':
        rtj=self.handleAISRequest(requestParam)
      if requestType=='track':
        rtj=self.handleTrackRequest(requestParam)
      if requestType=='status':
        rtj=self.handleStatusRequest(requestParam)
      if requestType=='debuglevel':
        rtj=self.handleDebugLevelRequest(requestParam)
      if requestType=='listCharts':
        rtj=self.handleListChartRequest(requestParam)
      if requestType=='routing':
        rtj=self.handleRoutingRequest(requestParam)
      if requestType=='download':
        #download requests are special
        # the dow not return json...
        self.handleDownloadRequest(requestParam)
        return
      if requestType=='upload':
        rtj=self.handleUploadRequest(requestParam)
      self.sendNavResponse(rtj,requestParam)
    except Exception as e:
          text=e.message+"\n"+traceback.format_exc()
          AVNLog.ld("unable to process request for navrequest ",text)
          self.send_response(500,text);
          self.end_headers()
          return
  #return AIS targets
  #parameter: lat,lon,distance (in NM) - limit to this distance      
  def handleAISRequest(self,requestParam):
    rt=self.server.navdata.getFilteredEntries("AIS",[])
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
      for entry in rt.values():
        try:
          fentry=AVNUtil.convertAIS(entry.data)        
          mdist=AVNUtil.distance((fentry.get('lat'),fentry.get('lon')), dest)
          if mdist<=dist:
            fentry['distance']=mdist
            frt.append(fentry)
          else:
            AVNLog.debug("filtering out %s due to distance %f",unicode(fentry['mmsi']),mdist)
        except:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    else:
      for entry in rt.values():
        try:
          frt.append(AVNUtil.convertAIS(entry.data))
        except Exception as e:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    return json.dumps(frt)
  
  def handleGpsRequest(self,requestParam):
    rtv=self.server.navdata.getMergedEntries("TPV",[])
    return json.dumps(rtv.data)
  #query the current list of trackpoints
  #currently we only limit by maxnumber and interval (in s)
  def handleTrackRequest(self,requestParam):
    lat=None
    lon=None
    dist=None
    maxnum=60 #with default settings this is one hour
    interval=60
    try:
      maxnumstr=self.getRequestParam(requestParam, 'maxnum')
      if not maxnumstr is None:
        maxnum=int(maxnumstr)
      intervalstr=self.getRequestParam(requestParam, 'interval')
      if not intervalstr is None:
        interval=int(intervalstr)
    except:
      pass
    frt=[]
    trackWriter=self.server.getHandler(AVNTrackWriter.getConfigName())
    if not trackWriter is None:
      frt=trackWriter.getTrackFormatted(maxnum,interval)
    return json.dumps(frt)
  def handleStatusRequest(self,requestParam):
    rt=[]
    for handler in AVNWorker.allHandlers:
      entry={'configname':handler.getConfigName(),
             'config': handler.getParam(),
             'name':handler.getName(),
             'info':handler.getInfo()}
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
  
  def handleListChartRequest(self,requestParam):
    chartbaseUrl=self.server.getStringParam('chartbase')
    rt={
        'status': 'ERROR',
        'info':'chart directory not found'}
    if chartbaseUrl is None:
      return json.dumps(rt)
    chartbaseDir=self.handlePathmapping(chartbaseUrl)
    if not os.path.isdir(chartbaseDir):
      rt['info']="chart directory %s not found"%(chartbaseDir)
      return json.dumps(rt)
    rt['status']='OK'
    rt['data']=[]
    for gemfdata in self.server.gemflist.values():
      entry={
             'name':gemfdata['name'],
             'url':"/gemf/"+gemfdata['name'],
             'charturl':"/gemf/"+gemfdata['name']
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
      if not os.path.isdir(dpath):
        continue
      if not os.path.isfile(os.path.join(dpath,self.server.navxml)):
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
             }
      if os.path.exists(os.path.join(dpath,icon)):
        entry['icon']="/"+chartbaseUrl+"/"+icon
      AVNLog.ld("chartentry",entry)
      rt['data'].append(entry)
    num=len(rt['data'])
    rt['info']="read %d entries from %s"%(num,chartbaseDir)
    return json.dumps(rt)

  def handleRoutingRequest(self,requestParam):
    rt=self.server.getHandler(AVNRouter.getConfigName())
    rtj=None
    if rt is not None:
      rtj=rt.handleRoutingRequest(requestParam)
    else:
      raise Exception("router not configured")
    return rtj

  #download requests
  #parameters:
  #   type
  #   type specific parameters
  #        route: name
  #   filename
  def handleDownloadRequest(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    rtd=None
    mtype="application/octet-stream"
    if type == "route":
      mtype="application/gpx+xml"
      rt=self.server.getHandler(AVNRouter.getConfigName())
      if rt is not None:
        rtd=rt.handleRouteDownloadRequest(requestParam)
      else:
        raise Exception("router not configured")
    else:
      raise Exception("invalid request %s",type)
    if rtd is None:
      self.send_error(404, "File not found")
      return
    self.send_response(200)
    fname=self.getRequestParam(requestParam,"filename")
    if fname is not None and fname != "":
      self.send_header("Content-Disposition","attachment")
    self.send_header("Content-type", mtype)
    self.send_header("Content-Length", len(rtd))
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    self.wfile.write(rtd)

  #we use a special form of upload
  #where the file is completely unencoded in the input stream
  #returns json status
  def handleUploadRequest(self,requestParam):
    len=self.headers.get("Content-Length");
    if len is None:
      raise Exception("Content-Length not set in upload request")
    self.connection.settimeout(30)
    type=self.getRequestParam(requestParam,"type")
    if type == "route":
      rt=self.server.getHandler(AVNRouter.getConfigName())
      if rt is not None:
        rtd=rt.handleRouteUploadRequest(requestParam,self.rfile,int(len))
        return rtd;
      else:
        raise Exception("router not configured")
    else:
      raise Exception("invalid request %s",type)

