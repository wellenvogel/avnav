import SimpleHTTPServer
import StringIO
import cgi
import json
import os
import posixpath
import re
import shutil
import threading
import traceback
import urllib
import urlparse
from os import path

from avnav_store import AVNStore
from avnav_util import AVNUtil, AVNLog
from avnav_worker import AVNWorker


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
    if path.endswith(".js") or path.endswith(".css"):
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
      try:
        extPath=self.server.tryExternalMappings(path,query)
      except Exception as e:
        self.send_error(404,e.message)
        return None
      if extPath is not None:
        return extPath
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

      return self.server.plainUrlToPath(path)


  #handle the request to an gemf file
  def handleGemfRequest(self,path,query):
    try:
      path=path.replace("/gemf/","",1)
      parr=path.split("/")
      gemfname=parr[0]+".gemf"
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
      if requestType=='gps' or requestType=='self':
        rtj=self.handleGpsRequest(requestParam)
      elif requestType=='nmeaStatus':
        rtj=self.handleNmeaStatus(requestParam)
      elif requestType=='ais':
        rtj=self.handleAISRequest(requestParam)
      elif requestType=='status':
        rtj=self.handleStatusRequest(requestParam)
      elif requestType=='debuglevel' or requestType=='loglevel':
        rtj=self.handleDebugLevelRequest(requestParam)
      elif requestType=='listCharts':
        rtj=self.handleListChartRequest(requestParam)
      elif requestType=='listdir' or requestType == 'list':
        rtj=self.handleListDir(requestParam)
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

      elif requestType=='capabilities':
        rtj=self.handleCapabilityRequest(requestParam)
      elif requestType=='api':
        #new handling for dedicated requests for some handler
        type=self.getRequestParam(requestParam,'type')
        rtj=self.handleSpecificRequest(requestParam,type)
      else:
        #legacy: have the api type as requestType
        rtj=self.handleSpecificRequest(requestParam,requestType)
      self.sendNavResponse(rtj,requestParam)
    except Exception as e:
          text=e.message
          rtj=json.dumps(AVNUtil.getReturnData(error=text,stack=traceback.format_exc()))
          self.sendNavResponse(rtj,requestParam)
          return

  def handleSpecificRequest(self,requestParam,rtype):
    """
    a request that is specific to a particular handler
    @param requestParam:
    @param rtype: the request type
    @return: json
    """
    if type is None:
      raise Exception("missing parameter type for api request")
    handler = self.server.getRequestHandler('api', rtype)
    if handler is None:
      raise Exception("no handler found for request %s", rtype)
    rtj = handler.handleApiRequest('api', rtype, requestParam,handler=self)
    if isinstance(rtj, dict) or isinstance(rtj, list):
      rtj = json.dumps(rtj)
    return rtj

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
    return json.dumps(rtv)

  def handleNmeaStatus(self, requestParam):
    rtv = self.server.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS)
    # we depend the status on the mode: no mode - red (i.e. not connected), mode: 1- yellow, mode 2+lat+lon - green
    status = "red"
    mode = rtv.get('mode')
    if mode is not None:
      if int(mode) == 1:
        status = "yellow"
      if int(mode) == 2 or int(mode) == 3:
        if rtv.get("lat") is not None and rtv.get('lon') is not None:
          status = "green"
        else:
          status = "yellow"
    src = self.server.navdata.getLastSource(AVNStore.BASE_KEY_GPS + ".lat")  # we just want the last source of position
    # TODO: add info from sky
    sky = self.server.navdata.getDataByPrefix(AVNStore.BASE_KEY_SKY)
    visible = set()
    used = set()
    try:
      satellites = sky.get('satellites')
      if satellites is not None:
        for sat in satellites.keys():
          visible.add(sat)
          if satellites[sat].get('used'):
            used.add(sat)
    except:
      AVNLog.info("unable to get sat count: %s", traceback.format_exc())
    statusNmea = {"status": status, "source": src, "info": "Sat %d visible/%d used" % (len(visible), len(used))}
    status = "red"
    numAis = self.server.navdata.getAisCounter()
    if numAis > 0:
      status = "green"
    src = self.server.navdata.getLastAisSource()
    statusAis = {"status": status, "source": self.server.navdata.getLastAisSource(), "info": "%d targets" % (numAis)}
    rt = {"status": "OK","data":{"nmea": statusNmea, "ais": statusAis}}
    return json.dumps(rt)


  def handleStatusRequest(self,requestParam):
    rt=[]
    for handler in AVNWorker.getAllHandlers(True):
      entry={'configname':handler.getConfigName(),
             'config': handler.getParam(),
             'name':handler.getStatusName(),
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
      url="/gemf/"+gemfdata['name'].replace(".gemf","")
      entry={
             'name':gemfdata['name'],
             'url':url,
             'charturl':url,
             'time': gemfdata['mtime'],
             'canDelete': True
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
      if de == "gemf":
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
        dl=handler.handleApiRequest('download',type,requestParam,handler=self)
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
        if fname is not None and fname != "" and self.getRequestParam(requestParam,'noattach') is None:
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

    except Exception as e:
      if self.getRequestParam(requestParam,'noattach') is None:
        #send some empty data
        data = StringIO.StringIO("error: %s"%e.message)
        data.seek(0)
        self.send_response(200)
        self.send_header("Content-type", "application/octet-stream")
        try:
          self.copyfile(data, self.wfile)
        finally:
          data.close()
      else:
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
        handler.handleApiRequest("upload",type,requestParam,rfile=self.rfile,flen=rlen,handler=self)
        return json.dumps({'status': 'OK'})
      if type == "chart":
        filename=self.getRequestParam(requestParam,"name")
        if filename is None:
          raise Exception("missing filename in upload request")
        filename=AVNUtil.clean_filename(filename)
        if not filename.endswith(".gemf"):
          raise Exception("invalid filename %s, must be .gemf"%filename)
        outname=os.path.join(self.getChartDir(),filename)
        self.writeFileFromInput(outname,rlen,False)
        AVNLog.info("created chart file %s",filename)
        self.server.notifyGemf()
        return json.dumps({'status':'OK'})
      else:
        raise Exception("invalid request %s",type)
    except Exception as e:
      return json.dumps({'status':unicode(e)})

  def writeFileFromInput(self,outname,rlen,overwrite=False,stream=None):
    if os.path.exists(outname) and not overwrite:
      raise Exception("file %s already exists" % outname)
    writename = outname + ".tmp"
    AVNLog.info("start upload of file %s", outname)
    fh = open(writename, "wb")
    if fh is None:
      raise Exception("unable to write to %s" % outname)
    if stream is None:
      stream=self.rfile
    bToRead = int(rlen)
    bufSize = 1000000
    try:
      while bToRead > 0:
        buf = stream.read(bufSize if bToRead >= bufSize else bToRead)
        if len(buf) == 0 or buf is None:
          raise Exception("no more data received")
        bToRead -= len(buf)
        fh.write(buf)
      fh.close()
      if os.path.exists(outname):
        os.unlink(outname)
      os.rename(writename, outname)
    except:
      try:
        os.unlink(writename)
      except:
        pass
      raise

  def handleListDir(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    if type is None:
      raise Exception("no type for listdir")
    handler=self.server.getRequestHandler('list',type)
    if handler is not None:
      AVNLog.debug("found handler for list request %s:%s" % (type, handler.getConfigName()))
      rt=handler.handleApiRequest('list',type,requestParam,handler=self)
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
    handler = self.server.getRequestHandler('delete', type)
    rt = {'status': 'OK'}
    if handler is not None:
      AVNLog.debug("found handler for delete request %s:%s" % (type, handler.getConfigName()))
      handler.handleApiRequest('delete', type, requestParam,handler=self)
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

  def handleCapabilityRequest(self,param):
    #see keys.jsx in the viewer at gui.capabilities
    rt={
      'addons':True,
      'uploadCharts':True,
      'plugins':True,
      'uploadRoute': True,
      'uploadLayout':True,
      'uploadUser':True,
      'uploadImages':True,
      'canConnect': True
    }
    return json.dumps({'status':'OK','data':rt})