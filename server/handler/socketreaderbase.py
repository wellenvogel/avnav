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
import socket

from avnav_nmea import *
from avnav_worker import *

  

#a base class for socket readers
#this should not directly be instantiated, instead classes doing socket reading
#should derive from this
#the derived class must have the setInfo,writeData methods
class SocketReader(object):
  def setInfo(self,name,text,status):
    pass
  def writeData(self,data,source=None):
    pass
  def readSocket(self,sock,infoName,sourceName,filter=None,timeout=None):
    filterA = None
    if filter:
      filterA = filter.split(',')
    pattern=AVNUtil.getNMEACheck()
    peer = "unknown connection"
    try:
      peer="%s:%d"%sock.getsockname()
      peer+="-%s:%d"%sock.getpeername()
    except:
      pass
    AVNLog.info("%s established, start reading",peer)
    self.setInfo(infoName, "receiving %s"%(peer,), WorkerStatus.RUNNING)
    buffer=""
    hasNMEA=False
    try:
      sock.settimeout(1)
      lastReceived=time.time()
      while sock.fileno() >= 0:
        try:
          data = sock.recv(1024)
          lastReceived=time.time()
        except socket.timeout:
          if timeout is not None:
            now=time.time()
            if now < lastReceived:
              lastReceived=now
              continue
            if now > (lastReceived + timeout):
              raise Exception("no data received within timeout of %s seconds"%str(timeout))
          continue
        if len(data) == 0:
          AVNLog.info("connection lost")
          break
        buffer=buffer+data.decode('ascii','ignore')
        lines=buffer.splitlines(True)
        if lines[-1][-1]=='\n':
          #last one ends with nl
          for l in lines:
            l=l.translate(NMEAParser.STRIPCHARS)
            if pattern.match(l):
              if not NMEAParser.checkFilter(l, filterA):
                continue
              self.writeData(l,source=sourceName)
              if not hasNMEA:
                self.setInfo(infoName, "NMEA %s"%(peer,), WorkerStatus.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",l)
          buffer=''
        else:
          for i in range(len(lines)-1):
            line=lines[i].translate(NMEAParser.STRIPCHARS)
            if pattern.match(line):
              self.writeData(line,source=sourceName)
              if not hasNMEA:
                self.setInfo(infoName, "NMEA %s"%peer, WorkerStatus.NMEA)
                hasNMEA=True
            else:
              AVNLog.debug("ignoring unknown data %s",lines[i])
          if len(lines) > 0:
            buffer=lines[-1]
        if len(buffer) > 4096:
          AVNLog.debug("no line feed in long data, stopping")
          break
      sock.shutdown(socket.SHUT_RDWR)
      sock.close()
    except Exception as e:
      AVNLog.error("exception while reading from socket: %s",traceback.format_exc())
      pass
    try:
      sock.shutdown(socket.SHUT_RDWR)
      sock.close()
    except:
      pass
    AVNLog.info("disconnected from socket %s",peer)
    self.setInfo(infoName, "socket to %s disconnected"%(peer), WorkerStatus.ERROR)


 