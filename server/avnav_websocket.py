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
'''
from https://gist.github.com/SevenW/47be2f9ab74cac26bf21
The MIT License (MIT)
Copyright (C) 2014, 2015 Seven Watt <info@sevenwatt.com>
<http://www.sevenwatt.com>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
'''

import socket  # for socket exceptions
import struct
import threading
import time
from base64 import b64encode
from hashlib import sha1
from http.server import SimpleHTTPRequestHandler

from avnav_util import AVNLog


class WebSocketError(Exception):
  pass

class QueueMessage:
  def __init__(self,message,isClose=False):
    self.message=message
    self.isClose=isClose

class OutQueue:
  def __init__(self,size):
    self.condition=threading.Condition()
    self.data=[]
    self.size=size

  def clear(self):
    self.condition.acquire()
    self.data=[]
    self.condition.notifyAll()
    self.condition.release()
  def add(self,item):
    self.condition.acquire()
    try:
      self.data.append(item)
      self.condition.notifyAll()
      if len(self.data) > self.size:
        self.data.pop(0)
    finally:
      self.condition.release()

  def read(self,timeout=1):
    now=time.time()
    loopCount=timeout*5
    while loopCount > 0:
      self.condition.acquire()
      try:
        if len(self.data) > 0:
          return self.data.pop(0)
        self.condition.wait(0.2)
        loopCount=loopCount-1
      finally:
        self.condition.release()
    return None




class HTTPWebSocketsHandler(SimpleHTTPRequestHandler):
  _ws_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
  _opcode_continu = 0x0
  _opcode_text = 0x1
  _opcode_binary = 0x2
  _opcode_close = 0x8
  _opcode_ping = 0x9
  _opcode_pong = 0xa

  @classmethod
  def send_queue_len(cls):
    '''
    derived classes could decide to have their own thread
    being used for sending - in this case return 0 here
    you must ensure that only one thread at a time is calling send_message
    :return:
    '''
    return 20

  def on_ws_message(self, message):
    """Override this handler to process incoming websocket messages."""
    pass

  def on_ws_connected(self):
    """Override this handler."""
    pass

  def on_ws_closed(self):
    """Override this handler."""
    pass

  def allow_ws(self):
    return True

  def send_message(self, message):
    if self.send_queue_len() > 0:
      self.queue.add(QueueMessage(message))
    else:
      self._send_message(self._opcode_text, message)

  def close_ws(self):
    if self.send_queue_len() > 0:
      self.queue.clear()
      self.queue.add(QueueMessage(None,True))
    else:
      self._ws_close()
  def _fetch_messages(self):
    while self.connected:
      message=self.queue.read()
      if message != None:
        if message.isClose:
          self._ws_close()
        else:
          self._send_message(self._opcode_text, message.message)

  def setup(self):
    SimpleHTTPRequestHandler.setup(self)
    self.connected = False
    if self.send_queue_len() > 0:
      self.queue=OutQueue(self.send_queue_len())
    self.mutex = threading.Lock()


  def checkAuthentication(self):
    auth = self.headers.get('Authorization')
    if auth != "Basic %s" % self.server.auth:
      self.send_response(401)
      self.send_header("WWW-Authenticate", 'Basic realm="Plugwise"')
      self.end_headers()
      return False
    return True


  def do_GET(self):
    #if self.server.auth and not self.checkAuthentication():
    #  return
    if self.headers.get("Upgrade", None) == "websocket":
      if not self.allow_ws():
        AVNLog.debug("invalid websocket request at %s",self.path)
        self.send_response(500,"websockets noch allowed at %s"%self.path)
        self.end_headers()
        return
      self._handshake()
      self.wfile.flush()
      # This handler is in websocket mode now.
      # do_GET only returns after client close or socket error.
      self._read_messages()
    else:
      super().do_GET()

  def _read_messages(self):
    if self.send_queue_len() > 0:
      sender=threading.Thread(target=self._fetch_messages)
      sender.setDaemon(True)
      sender.start()
    while self.connected == True:
      try:
        self._read_next_message()
      except (socket.error, WebSocketError) as e:
        # websocket content error, time-out or disconnect.
        self.log_message("RCV: Close connection: Socket Error %s" % str(e.args))
        self._ws_close()
      except Exception as err:
        # unexpected error in websocket connection.
        self.log_error("RCV: Exception: in _read_messages: %s" % str(err.args))
        self._ws_close()

  def _read_next_message(self):
    # self.rfile.read(n) is blocking.
    # it returns however immediately when the socket is closed.
    try:
      self.opcode = ord(self.rfile.read(1)) & 0x0F
      length = ord(self.rfile.read(1)) & 0x7F
      if length == 126:
        length = struct.unpack(">H", self.rfile.read(2))[0]
      elif length == 127:
        length = struct.unpack(">Q", self.rfile.read(8))[0]
      masks = [byte for byte in self.rfile.read(4)]
      decoded = ""
      for char in self.rfile.read(length):
        decoded += chr(char ^ masks[len(decoded) % 4])
      self._on_message(decoded)
    except (struct.error, TypeError) as e:
      # catch exceptions from ord() and struct.unpack()
      if self.connected:
        raise WebSocketError("Websocket read aborted while listening")
      else:
        # the socket was closed while waiting for input
        self.log_error("RCV: _read_next_message aborted after closed connection")
        pass

  def _send_message(self, opcode, message):
    try:
      # use of self.wfile.write gives socket exception after socket is closed. Avoid.
      self.request.send(bytes([0x80 + opcode]))
      if type(message) is str:
        message=message.encode('utf-8')
      length = len(message)
      if length <= 125:
        self.request.send(bytes([length]))
      elif length >= 126 and length <= 65535:
        self.request.send(bytes([126]))
        self.request.send(struct.pack(">H", length))
      else:
        self.request.send(bytes([127]))
        self.request.send(struct.pack(">Q", length))
      if length > 0:
        self.request.send(message)
    except socket.error as e:
      # websocket content error, time-out or disconnect.
      self.log_message("SND: Close connection: Socket Error %s" % str(e.args))
      self._ws_close()
    except Exception as err:
      # unexpected error in websocket connection.
      self.log_error("SND: Exception: in _send_message: %s" % str(err.args))
      self._ws_close()

  def _handshake(self):
    headers = self.headers
    if headers.get("Upgrade", None) != "websocket":
      return
    key = headers['Sec-WebSocket-Key']
    digest = b64encode(sha1((key + self._ws_GUID).encode()).digest())
    self.send_response(101, 'Switching Protocols')
    self.send_header('Upgrade', 'websocket')
    self.send_header('Connection', 'Upgrade')
    self.send_header('Sec-WebSocket-Accept', digest.decode())
    self.end_headers()
    self.connected = True
    self.close_connection = False
    self.on_ws_connected()

  def _ws_close(self):
    # avoid closing a single socket two time for send and receive.
    self.mutex.acquire()
    try:
      if self.connected:
        self.connected = False
        # Terminate BaseHTTPRequestHandler.handle() loop:
        self.close_connection = 1
        # send close and ignore exceptions. An error may already have occurred.
        try:
          self._send_close()
        except:
          pass
        self.on_ws_closed()
      else:
        self.log_message("_ws_close websocket in closed state. Ignore.")
        pass
    finally:
      self.mutex.release()

  def _on_message(self, message):
    # self.log_message("_on_message: opcode: %02X msg: %s" % (self.opcode, message))

    # close
    if self.opcode == self._opcode_close:
      self.connected = False
      # Terminate BaseHTTPRequestHandler.handle() loop:
      self.close_connection = 1
      try:
        self._send_close()
      except:
        pass
      self.on_ws_closed()
    # ping
    elif self.opcode == self._opcode_ping:
      self._send_message(self._opcode_pong, message)
    # pong
    elif self.opcode == self._opcode_pong:
      pass
    # data
    elif (self.opcode == self._opcode_continu or
          self.opcode == self._opcode_text or
          self.opcode == self._opcode_binary):
      self.on_ws_message(message)

  def _send_close(self):
    # Dedicated _send_close allows for catch all exception handling
    msg = bytearray()
    msg.append(0x80 + self._opcode_close)
    msg.append(0x00)
    self.request.send(msg)

