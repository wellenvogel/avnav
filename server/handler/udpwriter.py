#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
# Copyright (c) 2019 free-x <oroitburd@gmail.com>
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

from threading import Thread

import time
import socket
import threading

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_nmea import *
from socketreaderbase import *
import avnav_handlerList

#a worker to output data via a UDP socket

class AVNUdpWriter(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUdpWriter"

  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt={
          'host'      : 'localhost',                 
          'port'      : 2000,       #port
          'feederName': '',         #if set, use this feeder
          'broadcast' : 'true',
          'filter'    : ''          #, separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters
         }
      return rt
    return None


  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for udp writer")
    AVNWorker.__init__(self, param)


  # make some checks when we have to start
  # we cannot do this on init as we potentiall have to find the feeder...
  def start(self):
    feedername = self.getStringParam('feederName')
    feeder = self.findFeeder(feedername)
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)", self.getName(), feedername or "")
    self.feeder=feeder
    AVNWorker.start(self)
  

  def run(self):
    self.setName("%s-host:%s-port%s"%(self.getThreadPrefix(),self.param['host'],self.param['port']))
    while True:
       cs = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
       cs.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
       if self.getBoolParam('broadcast'):
         cs.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)   
       addr=self.getStringParam('host')
       port=int(self.getIntParam('port'))
       filterstr=self.getStringParam('filter')
       filter=None
       seq=0
       AVNLog.info("Sendto %s:%d" % (unicode(addr),port))
       if filterstr != "":
         filter=filterstr.split(",")
       while True:
          seq,data=self.feeder.fetchFromHistory(seq,10)
          if len(data) > 0:
            for line in data:
               if NMEAParser.checkFilter(line, filter):
                 cs.sendto(line,(addr,port)) 
       cs.close()

avnav_handlerList.registerHandler(AVNUdpWriter)
