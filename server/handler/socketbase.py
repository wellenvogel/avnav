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
import re

from avnav_nmea import *
from avnav_worker import *
from avnav_util import MovingSum

  

#a base class for socket readers and writers
from avnqueue import AVNQueue, Fetcher


class SocketReader(object):
  P_STRIP_LEADING = WorkerParameter('stripLeading', False, type=WorkerParameter.T_BOOLEAN,
                                description="strip anything before $ or ! in received lines")
  START_PATTERN=re.compile('[$!]')
  def __init__(self,socket,queue:AVNQueue,setInfo:InfoHandler,shouldStop=None,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY,stripLeading=False):
    self.queue=queue
    self.socket=socket
    self.stopFlag=False
    self.infoHandler=TrackingInfoHandler(setInfo)
    self.shouldStop=shouldStop if shouldStop is not None else self.shouldStopInternal
    self.sourcePriority=sourcePriority
    self.stripLeading=stripLeading


  def shouldStopInternal(self):
    return self.stopFlag
  def stop(self):
    self.stopFlag=True
    try:
      self.socket.shutdown(socket.SHUT_RDWR)
    except:
      pass
    self.socket.close()

  def _removeLeading(self,line):
    if not self.stripLeading:
      return line
    if line is None:
      return line
    match=self.START_PATTERN.search(line)
    if match is None:
      return line
    return line[match.span()[0]:]

  def readSocket(self,sourceName,filter=None,timeout=None,minTime=None):
    INAME='reader'
    nmeaSum=MovingSum()
    def nmeaInfo(peer):
      if nmeaSum.shouldUpdate():
        self.infoHandler.setInfo(INAME,
                     "%d/s"%(nmeaSum.avg()),
                     WorkerStatus.NMEA if nmeaSum.val()>0 else WorkerStatus.RUNNING)
    sock=self.socket
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
    self.infoHandler.setInfo(INAME, "receiving %s"%(peer,), WorkerStatus.RUNNING)
    buffer=""
    try:
      sock.settimeout(1)
      lastReceived=time.time()
      while sock.fileno() >= 0 and not self.shouldStop():
        nmeaSum.add(0)
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
          nmeaInfo(peer)
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
            l=self._removeLeading(l)
            if pattern.match(l):
              if not NMEAParser.checkFilter(l, filterA):
                continue
              nmeaSum.add(1)
              self.queue.addNMEA(l,source=sourceName,sourcePriority=self.sourcePriority)
              if minTime is not None:
                time.sleep(minTime/1000)
            else:
              AVNLog.debug("ignoring unknown data %s",l)
          buffer=''
        else:
          for i in range(len(lines)-1):
            line=lines[i].translate(NMEAParser.STRIPCHARS)
            line=self._removeLeading(line)
            if pattern.match(line):
              nmeaSum.add(1)
              self.queue.addNMEA(line,source=sourceName,sourcePriority=self.sourcePriority)
            else:
              AVNLog.debug("ignoring unknown data %s",lines[i])
          if len(lines) > 0:
            buffer=lines[-1]
        if len(buffer) > 4096:
          AVNLog.debug("no line feed in long data, stopping")
          break
        nmeaInfo(peer)
      sock.shutdown(socket.SHUT_RDWR)
      sock.close()
    except Exception as e:
      AVNLog.error("exception while reading from socket: %s",traceback.format_exc())
      pass
    try:
      self.stop()
    except:
      pass
    AVNLog.info("disconnected from socket %s",peer)
    self.infoHandler.deleteInfo(INAME)

  def writeSocket(self,filterstr,version,blacklist):
    '''
    write method
    there is no stop handling so the socket must be closed from another thread
    :param infoName:
    :param filterstr:
    :param version:
    :param blacklist:
    :return:
    '''
    fetcher=Fetcher(self.queue,self.infoHandler,
                    nmeaFilter=filterstr,
                    blackList=blacklist,
                    errorKey="werr",
                    sumKey='writer')
    try:
      fetcher.report()
      self.socket.sendall(("avnav_server %s\r\n" % (version)).encode('utf-8'))
      while self.socket.fileno() >= 0:
        hasSend = False
        data = fetcher.fetch()
        fetcher.report()
        if len(data) > 0:
          for line in data:
            self.socket.sendall(line.encode('ascii', errors='ignore'))
            hasSend = True
        if not hasSend:
          # just throw an exception if the reader potentially closed the socket
          self.socket.getpeername()
    except Exception as e:
      AVNLog.info("exception in client connection %s", traceback.format_exc())
    AVNLog.info("client disconnected or stop received")
    try:
      self.stop()
    except Exception as e:
      AVNLog.error("error closing socket %s", str(e))

 