#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013-2017 Andreas Vogel andreas@wellenvogel.net
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
###############################################################################

import time
import threading

hasSenseHat=False
try:
  from  sense_hat import SenseHat
  hasSenseHat=True
except:
  pass

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
import avnav_handlerList


class AVNSenseHatReader(AVNWorker):
  """ a worker to read data from the SenseHat module
    and insert it as NMEA MDA/XDR records
  """

  @classmethod
  def getConfigName(cls):
    return "AVNSenseHatReader"

  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = {
      'feederName': '',  # if this one is set, we do not use the defaul feeder but this one
      'interval': '5',
      'writeMda': 'true',
      'writeXdr': 'true'
    }
    return rt

  @classmethod
  def createInstance(cls, cfgparam):
    if cfgparam.get('name') is None:
      cfgparam['name'] = "SenseHatReader"
    rt = AVNSenseHatReader(cfgparam)
    return rt

  def __init__(self, param):
    self.feederWrite = None
    AVNWorker.__init__(self, param)
    if param.get('name') is None:
      self.param['name'] = "SenseHatReader"

  def isDisabled(self):
    if not hasSenseHat:
      return True
    return super(AVNSenseHatReader, self).isDisabled()

  def getName(self):
    return self.param['name']

  # make some checks when we have to start
  # we cannot do this on init as we potentiall have to find the feeder...
  def start(self):
    feedername = self.getStringParam('feederName')
    feeder = self.findFeeder(feedername)
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)", self.getName(), feedername or "")
    self.feederWrite = feeder.addNMEA
    AVNWorker.start(self)

  def writeData(self, data):
    self.feederWrite(data)

  # thread run method - just try forever
  def run(self):
    self.setName("[%s]%s" % (AVNLog.getThreadId(), self.getName()))
    self.setInfo('main', "reading sense", AVNWorker.Status.NMEA)
    sense = SenseHat()
    while True:
      try:
        if self.getBoolParam('writeMda'):
          """$AVMDA,,,1.00000,B,,,,,,,,,,,,,,,,"""
          mda = '$AVMDA,,,%.5f,B,,,,,,,,,,,,,,,,' % ( sense.pressure / 1000.)
          mda += "*" + NMEAParser.nmeaChecksum(mda) + "\r\n"
          AVNLog.debug("SenseHat:MDA %s", mda)
          self.writeData(mda)
          """$AVMTA,19.50,C*2B"""
          mta = 'AVMTA,%.2f,C' % (sense.temp)
          mta += "*" + NMEAParser.nmeaChecksum(mta) + "\r\n"
          AVNLog.debug("SenseHat:MTA %s", mta)
          self.writeData(mta)
        if self.getBoolParam('writeXdr'):
          xdr = '$AVXDR,P,%.5f,B,Barometer' % (sense.pressure / 1000.)
          xdr += "*" + NMEAParser.nmeaChecksum(xdr) + "\r\n"
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr)

          xdr = '$AVXDR,C,%.2f,C,TempAir' % (sense.temp)
          xdr += "*" + NMEAParser.nmeaChecksum(xdr) + "\r\n"
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr)

          xdr = '$AVXDR,H,%.2f,P,Humidity' % (sense.humidity)
          xdr += "*" + NMEAParser.nmeaChecksum(xdr) + "\r\n"
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr)

      except:
        AVNLog.info("exception while reading data from SenseHat %s", traceback.format_exc())
      wt = self.getFloatParam("interval")
      if not wt:
        wt = 5.0
      time.sleep(wt)


avnav_handlerList.registerHandler(AVNSenseHatReader)
