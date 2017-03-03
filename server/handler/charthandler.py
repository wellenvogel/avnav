# !/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012...2017 Andreas Vogel andreas@wellenvogel.net
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
import traceback

import time

import avnav_handlerList
from avnav_worker import AVNWorker
from avnav_util import *
import create_overview


class AVNChartHandler(AVNWorker):
  """a worker to check the chart dirs
     and create avnav.xml..."""
  def __init__(self,param):
    self.param=param
    AVNWorker.__init__(self, param)
  @classmethod
  def getConfigName(cls):
    return "AVNChartHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'period': 30 #how long to sleep between 2 checks
    }
  @classmethod
  def preventMultiInstance(cls):
    return True
  def getName(self):
    return "AVNChartHandler"
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    server=self.findHandlerByName("AVNHTTPServer")
    if server is None:
      AVNLog.error("unable to find AVNHTTPServer")
      return
    AVNLog.info("charthandler started")
    while True:
      try:
        osdir=server.getChartBaseDir()
        if osdir is None or not os.path.isdir(osdir):
          AVNLog.error("unable to find a valid chart directory %s"%(osdir))
        else:
          for cd in os.listdir(osdir):
            chartdir=os.path.join(osdir,cd)
            if not os.path.isdir(chartdir):
              continue
            args=["","-i",chartdir]
            rt=create_overview.main(args)
            if rt == 0:
              AVNLog.info("created/updated %s in %s",AVNUtil.NAVXML,chartdir)
            if rt == 1:
              AVNLog.error("error creating/updating %s in %s",AVNUtil.NAVXML.navxml,chartdir)
      except:
        AVNLog.error("error while trying to update charts %s",traceback.format_exc())
      time.sleep(self.getIntParam('period') or 10)
avnav_handlerList.registerHandler(AVNChartHandler)
