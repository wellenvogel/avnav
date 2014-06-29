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
from avnav_util import *
from avnav_nmea import *
from avnav_worker import *

  

#a base class for socket readers
#this should not directly be instantiated, instead classes doing socket reading
#should derive from this
#the derived class must have the setInfo,writeData methods
class SocketReader():
  def readSocket(self,sock,infoName,timeout=None):
    pattern=AVNUtil.getNMEACheck()
    peer="unknown"
    try:
      peer="%s:%d"%sock.getpeername()
    except:
      pass
    AVNLog.info("connection to %s established, start reading",peer)
    self.setInfo(infoName, "socket to %s connected"%(peer,), AVNWorker.Status.RUNNING)
    buffer=""
    hasNMEA=False
    try:
      while True:
        data = sock.recv(1024)
        if len(data) == 0:
          AVNLog.info("connection lost")
          break
        buffer=buffer+data.decode('ascii','ignore')
        lines=buffer.splitlines(True)
        if lines[-1][-1]=='\n':
          #last one ends with nl
          for l in lines:
            if pattern.match(l):
              self.writeData(l)
              if not hasNMEA:
                self.setInfo(infoName, "receiving from %s"%(peer,), AVNWorker.Status.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",l)
          buffer=''
        else:
          for i in range(len(lines)-1):
            if pattern.match(lines[i]):
              self.writeData(lines[i])
              if not hasNMEA:
                self.setInfo(infoName, "receiving", AVNWorker.Status.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",lines[i])
          if len(lines) > 0:
            buffer=lines[-1]
        if len(buffer) > 4096:
          AVNLog.debug("no line feed in long data, stopping")
          break
      sock.close()
    except Exception as e:
      AVNLog.debug("exception while reading from socket: %s",traceback.format_exc())
      pass
    try:
      sock.close()
    except:
      pass
    AVNLog.info("disconnected from socket %s",peer)
    self.setInfo(infoName, "socket to %s disconnected"%(peer), AVNWorker.Status.ERROR)

 