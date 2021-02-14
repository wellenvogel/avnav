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

import socket
import avnav_handlerList
from socketreaderbase import *


#a worker to output data via a UDP socket

class AVNUdpWriter(AVNWorker):
  @classmethod
  def getConfigName(cls):
    return "AVNUdpWriter"

  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt=[
          WorkerParameter('host','localhost',description="target host for udp packages"),
          WorkerParameter('port',2000,type=WorkerParameter.T_NUMBER,
                          description='port for udp packages'),
          WorkerParameter('feederName', '',editable=False),
          WorkerParameter('broadcast', True,type=WorkerParameter.T_BOOLEAN,
                          description="send broadcast packages"),
          WorkerParameter('filter','',type=WorkerParameter.T_FILTER),
          WorkerParameter('blackList' , '',description=', separated list of sources we do not send out')
         ]
      return rt
    return None


  def __init__(self,param):
    for p in ('port','host'):
      if param.get(p) is None:
        raise Exception("missing "+p+" parameter for udp writer")
    AVNWorker.__init__(self, param)
    self.blackList=self.getStringParam('blackList').split(',')


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
       AVNLog.info("Sendto %s:%d" % (str(addr),port))
       if filterstr != "":
         filter=filterstr.split(",")
       while True:
          seq,data=self.feeder.fetchFromHistory(seq,10,nmeafilter=filter,includeSource=True)
          if len(data) > 0:
            for line in data:
               if line.source in self.blackList:
                 AVNLog.debug("ignore line %s:%s due to blacklist",line.source,line.data)
               else:
                 cs.sendto(line.data,(addr,port))
       cs.close()

avnav_handlerList.registerHandler(AVNUdpWriter)
