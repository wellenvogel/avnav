# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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
#a dummy worker class to read some basic configurations
import logging

import avnav_handlerList
from avnav_worker import AVNWorker


class AVNBaseConfig(AVNWorker):
  def __init__(self,param):
    AVNWorker.__init__(self,param)
    self.param=param
    self.version=None
    self.startupError=None
  @classmethod
  def getConfigName(cls):
    return "AVNConfig"

  @classmethod
  def autoInstantiate(cls):
    return True
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'loglevel':logging.INFO,
            'logfile':"",
            'expiryTime': 30,
            'aisExpiryTime': 1200,
            'ownMMSI':'',        #if set - do not store AIS messages with this MMSI
            'debugToLog': 'false',
            'maxtimeback':5,      #how many seconds we allow time to go back before we reset
            'settimecmd': '',     #if set, use this to set the system time
            'systimediff':5,      #how many seconds do we allow the system time to be away from us
            'settimeperiod': 3600 #how often do we set the system time
    }
  @classmethod
  def preventMultiInstance(cls):
    return True
  def start(self):
    if self.startupError is not None:
      self.setInfo("startup",self.startupError,WorkerStatus.ERROR)
    pass
  def setVersion(self,version):
    self.version=version
  def getVersion(self):
    return self.version
  def setStartupError(self,error):
    self.startupError=error

avnav_handlerList.registerHandler(AVNBaseConfig)
