import http.server
import io
import cgi
import json
import os
import posixpath
import re
import threading
import traceback
import urllib.request, urllib.parse, urllib.error
import urllib.parse

from avnav_store import AVNStore
from avnav_util import AVNUtil, AVNLog
from avnav_worker import AVNWorker


class Encoder(json.JSONEncoder):
  '''
  allow our objects to have a "serialize" method
  to make them json encodable in a generic manner
  '''
  def default(self, o):
    if hasattr(o,'serialize'):
      return o.serialize()
    return super(Encoder, self).default(o)

class AVNDownload(object):
  def __init__(self, filename, size=None, stream=None, mimeType=None):
    self.filename = filename
    self.size = size
    self.stream = stream
    self.mimeType = mimeType

  def getSize(self):
    if self.size is None:
      return os.path.getsize(self.filename)
    return self.size

  def getStream(self):
    if self.stream is None:
      return open(self.filename, 'rb')
    return self.stream

  def getMimeType(self, handler=None):
    if self.mimeType is not None:
      return self.mimeType
    if handler is None:
      return "application/octet-stream"
    return handler.guess_type(self.filename)


class AVNHTTPHandler(http.server.SimpleHTTPRequestHandler):
  def __init__(self,request,client_address,server):
    #allow write buffering
    #see https://lautaportti.wordpress.com/2011/04/01/basehttprequesthandler-wastes-tcp-packets/
    self.wbufsize=-1
    self.id=None
    self.getRequestParam=AVNUtil.getHttpRequestParam
    AVNLog.ld("receiver thread started",client_address)
    http.server.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)

  def log_message(self, format, *args):
    if self.id is None:
      self.id=AVNLog.getThreadId()
      if self.id is None:
        self.id="?"
      threading.current_thread().setName("[%s]HTTPHandler"%(self.id))
    AVNLog.debug(format,*args)

  def do_POST(self):
    maxlen=5000000
    (path,sep,query) = self.path.partition('?')
    if not path.startswith(self.server.navurl):
      self.send_error(404, "unsupported post url")
      return
    try:
      ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
      if ctype == 'multipart/form-data':
        postvars = cgi.parse_multipart(self.rfile, pdict)
      elif ctype == 'application/x-www-form-urlencoded':
        length = int(self.headers.get('content-length'))
        if length > maxlen:
          raise Exception("too much data"+str(length))
        postvars = cgi.parse_qs(self.rfile.read(length).decode('utf-8'), keep_blank_values=1)
      elif ctype == 'application/json':
        length = int(self.headers.get('content-length'))
        if length > maxlen:
          raise Exception("too much data"+str(length))
        postvars = { '_json':self.rfile.read(length).decode('utf-8')}
      else:
        postvars = {}
      requestParam=urllib.parse.parse_qs(query,True)
      requestParam.update(postvars)
      self.handleNavRequest(path,requestParam)
    except Exception as e:
      txt=traceback.format_exc()
      AVNLog.ld("unable to process request for ",path,query,txt)
      self.send_response(500,txt)
      self.end_headers()
      return

  def getMimeType(self,path):
    base, ext = posixpath.splitext(path)
    if ext in self.server.overwrite_map:
      ctype = self.server.overwrite_map[ext]
    else:
      ctype = self.guess_type(path)
    return ctype

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

    ctype = self.getMimeType(path)
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

  def getPageRoot(self):
    path = self.server.getStringParam('index')
    return re.sub("/[^/]*$", "", path)

  #overwrite this from SimpleHTTPRequestHandler
  def translate_path(self, path):
      """Translate a /-separated PATH to the local filename syntax.

      Components that mean special things to the local file system
      (e.g. drive or directory names) are ignored.  (XXX They should
      probably be diagnosed.)

      """
      # abandon query parameters
      (path,query) = self.server.pathQueryFromUrl(path)
      try:
        #handlers will either return
        #True if already done
        #None if no mapping found (404)
        #a path to be sent
        extPath=self.server.tryExternalMappings(path,query,handler=self)
      except Exception as e:
        self.send_error(404,str(e))
        return None
      if isinstance(extPath,AVNDownload):
        self.writeFromDownload(extPath)
        return None
      if extPath == True:
        return None
      if extPath is not None:
        return extPath
      if path.startswith(self.server.navurl):
        requestParam=urllib.parse.parse_qs(query,True)
        self.handleNavRequest(path,requestParam)
        return None
      if path=="" or path=="/":
        path=self.server.getStringParam('index')
        self.send_response(301)
        self.send_header("Location", path)
        self.end_headers()
        return None

      return self.server.plainUrlToPath(path)


  #send a json encoded response
  def sendNavResponse(self,rtj,requestParam=None):
    if not rtj is None:
      self.send_response(200)
      if requestParam is not None and not requestParam.get('callback') is None:
        rtj="%s(%s);"%(requestParam.get('callback'),rtj)
        self.send_header("Content-type", "text/javascript")
      else:
        self.send_header("Content-type", "application/json")
      wbytes=rtj.encode('utf-8')
      self.send_header("Content-Length", str(len(wbytes)))
      self.send_header("Last-Modified", self.date_time_string())
      self.end_headers()
      self.wfile.write(wbytes)
      AVNLog.ld("nav response",rtj)
    else:
      raise Exception("empty response")

  def sendJsFile(self,filename,baseUrl,addCode=None):
    '''
    send a js file that we encapsulate into an anonymus function
    @param filename:
    @return:
    '''
    PREFIX=("try{(\nfunction(){\nvar AVNAV_BASE_URL=\"%s\";\n"%urllib.parse.quote(baseUrl)).encode('utf-8')
    SUFFIX="\n})();\n}catch(e){\nwindow.avnav.api.showToast(e.message+\"\\n\"+(e.stack||e));\n }\n".encode('utf-8')
    if not os.path.exists(filename):
      self.send_error(404,"File not found")
      return
    self.send_response(200)
    flen=os.path.getsize(filename)
    dlen=flen+len(PREFIX)+len(SUFFIX)
    if addCode is not None:
      addCode=addCode.encode('utf-8')
      dlen+=len(addCode)
    self.send_header("Content-type", "text/javascript")
    self.send_header("Content-Length", str(dlen))
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    self.wfile.write(PREFIX)
    if addCode is not None:
      self.wfile.write(addCode)
    fh=open(filename,"rb")
    self.writeStream(flen,fh)
    self.wfile.write(SUFFIX)
    return True
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
      elif requestType=='config':
        rtj = self.handleConfigRequest(requestParam)
      elif requestType=='debuglevel' or requestType=='loglevel':
        rtj=self.handleDebugLevelRequest(requestParam)
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
          AVNLog.error("upload error: %s",str(e))
          rtj=json.dumps({'status':str(e)},cls=Encoder)
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
          text=str(e)
          rtj=json.dumps(AVNUtil.getReturnData(error=text,stack=traceback.format_exc()),cls=Encoder)
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
      rtj = json.dumps(rtj,cls=Encoder)
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
            fentry['distance']=mdist*AVNUtil.NM #have this in m
            frt.append(fentry)
          else:
            AVNLog.debug("filtering out %s due to distance %f",str(fentry['mmsi']),mdist)
        except:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    else:
      for entry in rt:
        try:
          frt.append(AVNUtil.convertAIS(entry))
        except Exception as e:
          AVNLog.debug("unable to convert ais data: %s",traceback.format_exc())
    return json.dumps(frt,cls=Encoder)

  def handleGpsRequest(self,requestParam):
    rtv=self.server.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS)
    return json.dumps(rtv,cls=Encoder)

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
    satInview = rtv.get('satInview')
    if satInview is None:
      satInview=0
    satUsed   = rtv.get('satUsed')
    if satUsed is None:
      satUsed=0
    statusNmea = {"status": status, "source": src, "info": "Sat %d visible/%d used" % (int(satInview), int(satUsed))}

    status = "red"
    numAis = self.server.navdata.getAisCounter()
    if numAis > 0:
      status = "green"
    src = self.server.navdata.getLastAisSource()
    statusAis = {"status": status, "source": self.server.navdata.getLastAisSource(), "info": "%d targets" % (numAis)}
    rt = {"status": "OK","data":{"nmea": statusNmea, "ais": statusAis}}
    return json.dumps(rt,cls=Encoder)


  def handleStatusRequest(self,requestParam):
    rt=[]
    for handler in AVNWorker.getAllHandlers(True):
      entry={'configname':handler.getConfigName(),
             'config': handler.getParam(),
             'name':handler.getStatusName(),
             'info':handler.getInfo(),
             'disabled': handler.isDisabled(),
             'properties':handler.getStatusProperties() if not handler.isDisabled() else {},
             'canDelete':handler.canDeleteHandler(),
             'id':handler.getId() if handler.canEdit() else None}
      rt.append(entry)
    return json.dumps({'handler':rt},cls=Encoder)

  def handleConfigRequest(self,requestParam):
    rt={'status':'OK'}
    try:
      command=self.getRequestParam(requestParam,'command',mantadory=True)
      id=self.getRequestParam(requestParam,'handlerId',mantadory=True)
      child=self.getRequestParam(requestParam,'child',mantadory=False)
      handler=AVNWorker.findHandlerById(int(id))
      if handler is None:
        raise Exception("unable to find handler for id %s"%id)
      if command == 'getEditables':
        data=handler.getEditableParameters(child)
        if data is not None:
          rt['data']=data
          rt['values']=handler.getParam(child,filtered=True)
      elif command=='setConfig':
        values=self.getRequestParam(requestParam,'_json',mantadory=True)
        decoded=json.loads(values)
        handler.updateConfig(decoded,child)
        AVNLog.info("updated %s, new config %s", handler.getName(), handler.getConfigString())
      else:
        raise Exception("unknown command %s"%command)
      return json.dumps(rt,cls=Encoder)
    except Exception as e:
      return json.dumps({'status':str(e)},cls=Encoder)
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
    return json.dumps(rt,cls=Encoder)

  def writeStream(self,bToSend,fh):
    maxread = 1000000
    while bToSend > 0:
      buf = fh.read(maxread if bToSend > maxread else bToSend)
      if buf is None or len(buf) == 0:
        raise Exception("no more data")
      self.wfile.write(buf)
      bToSend -= len(buf)
    fh.close()

  def writeData(self,data,mimeType):
    self.send_response(200)
    self.send_header("Content-type", mimeType)
    wbytes=None
    if type(data) == bytes:
      wbytes=data
    else:
      wbytes=data.encode('utf-8')
    self.send_header("Content-Length", len(wbytes))
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    self.wfile.write(wbytes)

  def writeFromDownload(self,download,filename=None,noattach=False):
    # type: (AVNDownload, basestring,bool) -> object or None
    self.send_response(200)
    size = download.getSize()
    if filename is not None and filename != "" and not noattach:
      self.send_header("Content-Disposition", "attachment")
    self.send_header("Content-type", download.getMimeType(self))
    self.send_header("Content-Length", size)
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    stream = None
    stream = download.getStream()
    self.writeStream(size, stream)

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
        if isinstance(dl,AVNDownload):
          try:
            self.writeFromDownload(dl,
              filename=self.getRequestParam(requestParam, "filename")
              ,noattach=self.getRequestParam(requestParam, 'noattach') is not None)
          except:
            AVNLog.debug("error when downloading %s: %s",dl.filename,traceback.format_exc())
          return
        #legacy handling
        #TODO: removethis
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
        data = io.StringIO("error: %s"%e.message)
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
        rt=handler.handleApiRequest("upload",type,requestParam,rfile=self.rfile,flen=rlen,handler=self)
        return json.dumps(rt,cls=Encoder)
      else:
        raise Exception("invalid request %s",type)
    except Exception as e:
      return json.dumps({'status':str(e)},cls=Encoder)

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
      return json.dumps(rt,cls=Encoder)

    raise Exception("invalid type %s"%type)

  def handleDeleteRequest(self,requestParam):
    type=self.getRequestParam(requestParam,"type")
    if type is None:
      raise Exception("no type for delete")
    handler = self.server.getRequestHandler('delete', type)
    rt = {'status': 'OK'}
    if handler is not None:
      AVNLog.debug("found handler for delete request %s:%s" % (type, handler.getConfigName()))
      handler.handleApiRequest('delete', type, requestParam,handler=self)
      return json.dumps(rt,cls=Encoder)
    raise Exception("invalid type %s"%type)

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
      'uploadImport': True,
      'uploadOverlays': True,
      'uploadTracks': True,
      'canConnect': True
    }
    return json.dumps({'status':'OK','data':rt},cls=Encoder)
