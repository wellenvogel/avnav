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
###############################################################################

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
    rt = [
      WorkerParameter('feederName','',editable=False),
      WorkerParameter('interval', 5,type=WorkerParameter.T_FLOAT),
      WorkerParameter('writeMda',True,type=WorkerParameter.T_BOOLEAN),
      WorkerParameter('writeXdr',True,type=WorkerParameter.T_BOOLEAN),
      WorkerParameter('namePress', 'Barometer',
                      description="XDR transducer name for pressure"),
      WorkerParameter('nameHumid', 'Humidity',
                      description="XDR transducer name for humidity"),
      WorkerParameter('nameTemp', 'TempAir',
                      description="XDR transducer name for temperature"),
    ]
    return rt

  @classmethod
  def canEdit(cls):
    return hasSenseHat

  @classmethod
  def canDeleteHandler(cls):
    return hasSenseHat

  @classmethod
  def canDisable(cls):
    return True

  def isDisabled(self):
    if not hasSenseHat:
      return True
    return super().isDisabled()


  # thread run method - just try forever
  def run(self):
    self.setInfo('main', "reading sense", WorkerStatus.NMEA)
    sense = SenseHat()
    while True:
      source = self.getSourceName()
      try:
        if self.getBoolParam('writeMda'):
          """$AVMDA,,,1.00000,B,,,,,,,,,,,,,,,,"""
          mda = '$AVMDA,,,%.5f,B,,,,,,,,,,,,,,,,' % ( sense.pressure/1000.)
          AVNLog.debug("SenseHat:MDA %s", mda)
          self.writeData(mda,source,addCheckSum=True)
          """$AVMTA,19.50,C*2B"""
          mta = '$AVMTA,%.2f,C' % (sense.temp)
          AVNLog.debug("SenseHat:MTA %s", mta)
          self.writeData(mta,source,addCheckSum=True)
        if self.getBoolParam('writeXdr'):
          tn = self.param.get('namePress', 'Barometer')
          xdr = '$AVXDR,P,%.5f,B,%s' % (sense.pressure/ 1000.,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr,source,addCheckSum=True)
          tn = self.param.get('nameTemp', 'TempAir')
          xdr = '$AVXDR,C,%.2f,C,%s' % (sense.temp,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr,source,addCheckSum=True)
          tn = self.param.get('nameHumid', 'Humidity')
          xdr = '$AVXDR,H,%.2f,P,%s' % (sense.humidity,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.writeData(xdr,source,addCheckSum=True)

      except:
        AVNLog.info("exception while reading data from SenseHat %s", traceback.format_exc())
      wt = self.getFloatParam("interval")
      if not wt:
        wt = 5.0
      self.wait(wt)


avnav_handlerList.registerHandler(AVNSenseHatReader)
