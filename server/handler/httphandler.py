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

from avnav_nmea import NMEAParser
from avnav_store import AVNStore
from avnav_util import AVNUtil, AVNLog, AVNDownload
from avnav_websocket import HTTPWebSocketsHandler
from avnav_worker import AVNWorker

class WebSocketHandler(object):
  def __init__(self,handler):
    """

    @type handler: AVNHTTPHandler
    """
    self.handler=handler
    self.connected=False
  def send_message(self,message):
    if self.connected:
      self.handler.send_message(message)
  def on_ws_message(self, message):
    """Override this handler to process incoming websocket messages."""
    pass
  def on_ws_connected(self):
    self.connected=True
  def on_ws_closed(self):
    self.connected=False


class Encoder(json.JSONEncoder):
  '''
  allow our objects to have a "serialize" method
  to make them json encodable in a generic manner
  '''
  def default(self, o):
    if hasattr(o,'serialize'):
      return o.serialize()
    return super(Encoder, self).default(o)


class AVNHTTPHandler(HTTPWebSocketsHandler):
  wsHandler: WebSocketHandler
  protocol_version = "HTTP/1.1" #necessary for websockets!
  def __init__(self,request,client_address,server):
    #allow write buffering
    #see https://lautaportti.wordpress.com/2011/04/01/basehttprequesthandler-wastes-tcp-packets/
    self.wbufsize=-1
    self.id=None
    self.getRequestParam=AVNUtil.getHttpRequestParam
    threading.current_thread().setName("HTTPHandler")
    AVNLog.ld("receiver thread started",client_address)
    http.server.SimpleHTTPRequestHandler.__init__(self, request, client_address, server)
    self.wsHandler=None

  def log_message(self, format, *args):
    AVNLog.debug(format,*args)

  def allow_ws(self):
    (path,query) = self.server.pathQueryFromUrl(self.path)
    try:
      #handlers will either return
      #True if already done
      #None if no mapping found (404)
      #a path to be sent
      self.wsHandler=self.server.getWebSocketsHandler(path,query,handler=self)
      return True
    except Exception as e:
      return False

  def on_ws_message(self, message):
    if self.wsHandler is None:
      raise Exception("no websocket handler")
    self.wsHandler.on_ws_message(message)

  def on_ws_connected(self):
    if self.wsHandler is None:
      raise Exception("no websocket handler")
    self.wsHandler.on_ws_connected()

  def on_ws_closed(self):
    if self.wsHandler is None:
      raise Exception("no websocket handler")
    self.wsHandler.on_ws_closed()

  def do_POST(self):
    maxlen=5000000
    (path,sep,query) = self.path.partition('?')
    trailing=self.server.isNavUrl(path)
    if trailing is None:
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
      self.handleNavRequest(trailing,requestParam)
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
            self.close_connection=True
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
      if isinstance(extPath, AVNDownload):
        self.writeFromDownload(extPath)
        return None
      if extPath == True:
        return None
      if extPath is not None:
        return extPath
      trailing=self.server.isNavUrl(path)
      if trailing is not None:
        requestParam=urllib.parse.parse_qs(query,True)
        self.handleNavRequest(trailing,requestParam)
        return None
      if path=="" or path=="/":
        path=self.server.getStringParam('index')
        self.send_response(301)
        self.send_header("Location", path)
        self.end_headers()
        self.close_connection=True
        return None

      return self.server.plainUrlToPath(path)


  #send a json encoded response
  def sendJsonResponse(self, rtj):
    if not rtj is None:
      self.send_response(200)
      self.send_header("Content-type", "application/json")
      wbytes=rtj.encode('utf-8')
      self.send_header("Content-Length", str(len(wbytes)))
      self.send_header("Last-Modified", self.date_time_string())
      self.send_header("Cache-Control", "no-store")
      self.end_headers()
      self.wfile.write(wbytes)
      AVNLog.ld("json response",rtj)
    else:
      AVNLog.ld("empty response")

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

  DIRECT_RMAP=['download','upload','list','delete','upload']
  def mapOldStyleRequest(self,requestType,type):
      if requestType == 'api':
          return None
      if requestType == 'gps' or requestType== 'self' or requestType is None:
          return ('decoder','gps')
      if requestType == 'ais' or requestType == 'nmeaStatus':
          return ('decoder',requestType)
      if requestType == 'status' or requestType == 'loglevel' \
              or requestType == 'currentLogLevel' or requestType == 'capabilities':
          return ('config',requestType)
      if type is None:
          raise Exception(f"missing parameter type for {requestType}")
      if requestType in self.DIRECT_RMAP:
          return (type,requestType)
      if requestType == 'listDir':
          return (type,'list')

  def handleNavRequest(self,trailing,requestParam):
    ''' handle an api query
      request parameters:
      request=api&type=decoder&command=gps&filter=TPV&bbox=54.531,13.014,54.799,13.255
      or
      /decoder/gps?&filter=TPV&bbox=54.531,13.014,54.799,13.255
    '''
    #check if we have something behind the navurl
    #treat this as type/command
    type=None
    command=None
    requestType=None
    if trailing is not None and trailing != "":
        #new style requests
        tparts=trailing.split("/")
        if len(tparts) >= 2:
            type=tparts[0]
            command=tparts[1]
            requestType='api'
    requestTypeP=AVNUtil.getHttpRequestParam(requestParam,'request',False)
    if requestTypeP is not None:
        requestType=requestTypeP
    AVNLog.ld('navrequest ',requestParam)
    try:
      rtj=None
      typeP=AVNUtil.getHttpRequestParam(requestParam,'type',False)
      if typeP is not None:
          type=typeP
      converted=self.mapOldStyleRequest(requestType,type)
      if converted is None:
          commandP=AVNUtil.getHttpRequestParam(requestParam,'command',False)
          if commandP is not None:
              command=commandP
          if command is None:
              raise Exception(f"missing parameter command for api request {type}")
      else:
          type=converted[0]
          command=converted[1]
      rtj=self.handleApiRequest(type,command,requestParam)

      if isinstance(rtj, dict) or isinstance(rtj, list):
        rtj = json.dumps(rtj, cls=Encoder)
        self.sendJsonResponse(rtj)
        return
      if isinstance(rtj, AVNDownload):
          try:
            self.writeFromDownload(rtj,
              filename=self.getRequestParam(requestParam, "filename")
              ,noattach=self.getRequestParam(requestParam, 'noattach') is not None)
          except Exception as e:
            AVNLog.debug("error when downloading %s: %s",rtj.filename,traceback.format_exc())
            raise e
          return
      if rtj is None:
          raise Exception(f"empty response for {requestType} {type}")
    except Exception as e:
        self.close_connection=True
        self.send_error(404, message=str(e), explain=traceback.format_exc(1))

  def handleApiRequest(self,type,command,requestParam):
    """
    a request that is specific to a particular handler
    @param requestParam:
    @param rtype: the request type
    @return: json
    """
    if type is None:
      raise Exception("missing parameter type for api request")
    handler = self.server.getRequestHandler(type)
    if handler is None:
      raise Exception("no handler found for request %s"%type)
    if command == 'upload':
        self.connection.settimeout(30)
    rtj = handler.handleApiRequest(command, requestParam, handler=self)
    return rtj

  def writeStream(self,bToSend,fh):
    maxread = 1000000
    while bToSend > 0:
      buf = fh.read(maxread if bToSend > maxread else bToSend)
      if buf is None or len(buf) == 0:
        raise Exception("no more data")
      self.wfile.write(buf)
      bToSend -= len(buf)
    fh.close()
  def writeChunkedStream(self,fh):
    maxread = 1000000
    while True:
      buf = fh.read(maxread)
      if buf is None or len(buf) == 0:
        self.wfile.write(b'0\r\n\r\n')
        fh.close()
        return
      l = len(buf)
      self.wfile.write('{:X}\r\n'.format(l).encode('utf-8'))
      self.wfile.write(buf)
      self.wfile.write(b'\r\n')

  def writeData(self,data,mimeType):
    self.send_response(200)
    self.send_header("Content-type", mimeType)
    wbytes=None
    if type(data) == bytes:
      wbytes=data
    else:
      wbytes=data.encode('utf-8')
    self.send_header("Content-Length", str(len(wbytes)))
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    self.wfile.write(wbytes)

  def writeFromDownload(self,download: AVNDownload,filename:str=None,noattach:bool=False):
    size = download.getSize()
    stream = None
    stream = download.getStream()
    if download.dlname is not None:
      filename=download.dlname
    if download.noattach is not None:
      noattach=download.noattach
    #after we have sent the content type headers or and_headers we cannot really handle errors
    #so wey try to do "dangerous" things before this line
    self.send_response(200)
    if filename is not None and filename != "" and not noattach:
      self.send_header("Content-Disposition", "attachment; %s"%AVNDownload.fileToAttach(filename))
    self.send_header("Content-type", download.getMimeType(self))
    if size is not None:
      self.send_header("Content-Length", size)
    else:
      self.send_header('Transfer-Encoding', 'chunked')
    self.send_header("Last-Modified", self.date_time_string())
    self.end_headers()
    if size is not None:
      self.writeStream(size, stream)
    else:
      self.writeChunkedStream(stream)

