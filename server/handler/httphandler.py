import http.server
import cgi
import json
import os
import posixpath
import re
import threading
import traceback
import urllib.request, urllib.parse, urllib.error
import urllib.parse

from avnav_util import AVNUtil, AVNLog, AVNDownload, AVNStringDownload, Encoder, AVNJsonDownload
from avnav_websocket import HTTPWebSocketsHandler


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


class RequestException(Exception):
    def __init__(self,str,code=500):
        super().__init__(str)
        self.code=code



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
    self.requestDone=False

  def log_message(self, format, *args):
    AVNLog.debug(format,*args)

  def allow_ws(self):
    (path,query) = AVNUtil.pathQueryFromUrl(self.path)
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


  def getMimeType(self,path):
    base, ext = posixpath.splitext(path)
    if ext in self.server.overwrite_map:
      ctype = self.server.overwrite_map[ext]
    else:
      ctype = self.guess_type(path)
    return ctype


  def do_GET(self):
      if super().do_GET():
          #ws request
          return
      m="GET"
      self.handleRequest(m)

  def do_HEAD(self):
      m="HEAD"
      self.handleRequest(m)
  def _getPostParam(self):
      maxlen = 5000000
      ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
      if ctype == 'multipart/form-data':
          postvars = cgi.parse_multipart(self.rfile, pdict)
      elif ctype == 'application/x-www-form-urlencoded':
          length = int(self.headers.get('content-length'))
          if length > maxlen:
              raise Exception("too much data" + str(length))
          postvars = cgi.parse_qs(self.rfile.read(length).decode('utf-8'), keep_blank_values=1)
      elif ctype == 'application/json':
          length = int(self.headers.get('content-length'))
          if length > maxlen:
              raise Exception("too much data" + str(length))
          postvars = {'_json': self.rfile.read(length).decode('utf-8')}
      else:
          postvars = {}
      return postvars
  def do_POST(self):
      self.handleRequest("POST")

  def getPageRoot(self):
    path = self.server.getStringParam('index')
    return re.sub("/[^/]*$", "", path)

  def handleRequest(self,method=None):
      self.requestDone=False
      (path, query) = AVNUtil.pathQueryFromUrl(self.path)
      if path=="" or path=="/":
          path = self.server.getStringParam('index')
          self.send_response(301)
          self.send_header("Location", path)
          self.end_headers()
          self.close_connection = True
          return
      trailing = self.server.isNavUrl(path)
      response=None
      requestParam=None
      if trailing != False:
          #navRequest
          requestParam = urllib.parse.parse_qs(query, True)
          if method == "POST":
              updates = self._getPostParam()
              if updates:
                  requestParam.update(updates)
          try:
              response=self.handleNavRequest(trailing, requestParam)
          except Exception as e:
              txt = str(e)+": "+traceback.format_exc()
              AVNLog.ld("unable to process request for ", path, query, txt)
              self.send_response(500, txt)
              self.end_headers()
              self.close_connection=True
              self.requestDone=True
              return
      else:
          if method == "POST":
              self.send_error(404, "unsupported post url")
              self.requestDone=True
              return
          try:
              # handlers will either return
              # True if already done
              # None if no mapping found (404)
              # a path to be sent
              response = self.server.tryExternalMappings(path, query, handler=self)
          except Exception as e:
              self.send_error(404, str(e))
              self.requestDone=True
              return
      if isinstance(response, AVNDownload):
          try:
              start=None
              end=None
              range=self.headers.get('range')
              if range is not None:
                  if range.lower().startswith('bytes='):
                      range=range[len('bytes='):]
                      [start,end]=range.split('-')
              response.writeOut(self,
                            filename=self.getRequestParam(requestParam, "filename"),
                            noattach=self.getRequestParam(requestParam, 'noattach') is not None,
                            sendbody=method != "HEAD",
                            start=start,
                            end=end )
              self.requestDone=True
          except Exception as e:
              txt = traceback.format_exc()
              self.send_error(500, str(e), txt)
              self.requestDone=True
      else:
          if not self.requestDone:
              self.send_error(404, path+ ": no response")
              self.requestDone=True
      return


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
      return AVNJsonDownload(rtj)
    if isinstance(rtj, AVNDownload):
        return rtj
    if rtj is None:
        raise Exception(f"empty response for {requestType} {type}")
    return rtj

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
        try:
            return handler.handleApiRequest(command, requestParam, handler=self)
        except Exception as e:
            self.send_response(409, str(e))
            self.end_headers()
            self.close_connection=True
            return None
    try:
        rtj = handler.handleApiRequest(command, requestParam, handler=self)
    except RequestException as e:
        self.send_response(e.code, str(e))
        self.end_headers()
        if e.code == 409:
            self.close_connection = True
        return None
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
