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
  P_FEEDER=WorkerParameter('feederName','',editable=False)
  P_INTERVAL=WorkerParameter('interval', 5,type=WorkerParameter.T_FLOAT)
  P_MDA=WorkerParameter('writeMda',True,type=WorkerParameter.T_BOOLEAN,
                        description="create MTA and MDA records")
  P_XDR=WorkerParameter('writeXdr',True,type=WorkerParameter.T_BOOLEAN,
                        description="create XDR records")
  P_NPRESS=WorkerParameter('namePress', 'Baro',
                           description="XDR transducer name for pressure",
                           condition={P_XDR.name:True})
  P_OFFSET=WorkerParameter('offsetPress','0',type=WorkerParameter.T_FLOAT,description="Offset pressure  HPa")
  P_NHUMID=WorkerParameter('nameHumid', 'Humidity',
                           description="XDR transducer name for humidity",
                           condition={P_XDR.name:True})
  P_NTEMP=WorkerParameter('nameTemp', 'AirTemp',
                          description="XDR transducer name for temperature",
                          condition={P_XDR.name:True})
  P_NROLL=WorkerParameter('nameRoll', 'Roll',
                          description="XDR transducer name for Roll",
                          condition={P_XDR.name:True})
  P_NPITCH=WorkerParameter('namePitch', 'Pitch',
                           description="XDR transducer name for Pitch",
                           condition={P_XDR.name:True})
  @classmethod
  def getConfigName(cls):
    return "AVNSenseHatReader"

  @classmethod
  def getConfigParam(cls, child=None):
    if not child is None:
      return None
    rt = [
      cls.PRIORITY_PARAM_DESCRIPTION,
      cls.P_FEEDER,
      cls.P_INTERVAL,
      cls.P_MDA,
      cls.P_XDR,
      cls.P_NPRESS,
      cls.P_OFFSET,
      cls.P_NHUMID,
      cls.P_NTEMP,
      cls.P_NROLL,
      cls.P_NPITCH,
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

  def setOk(self):
    self.setInfo('main', "reading sense", WorkerStatus.NMEA)
  # thread run method - just try forever
  def run(self):
    self.setOk()
    sense = SenseHat()
    hasError=False
    while True:
      priority=self.PRIORITY_PARAM_DESCRIPTION.fromDict(self.param)
      offsetpress = self.getWParam(self.P_OFFSET)
      source = self.getSourceName()
      hasRead=False
      try:
        if self.P_MDA.fromDict(self.param):
          hasRead=True
          """$AVMDA,,,1.00000,B,,,,,,,,,,,,,,,,"""
          mda = '$AVMDA,,,%.5f,B,,,,,,,,,,,,,,,,' % ( sense.pressure+offsetpress/1000.)
          AVNLog.debug("SenseHat:MDA %s", mda)
          self.queue.addNMEA(mda,source,addCheckSum=True,sourcePriority=priority)
          """$AVMTA,19.50,C*2B"""
          mta = '$AVMTA,%.2f,C' % (sense.temp)
          AVNLog.debug("SenseHat:MTA %s", mta)
          self.queue.addNMEA(mta,source,addCheckSum=True,sourcePriority=priority)
        if self.P_XDR.fromDict(self.param):
          hasRead=True
          tn = self.P_NPRESS.fromDict(self.param)
          xdr = '$AVXDR,P,%.5f,B,%s' % (sense.pressure+offsetpress/ 1000.,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.P_NTEMP.fromDict(self.param)
          xdr = '$AVXDR,C,%.2f,C,%s' % (sense.temp,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.P_NHUMID.fromDict(self.param)
          xdr = '$AVXDR,H,%.2f,P,%s' % (sense.humidity,tn)
          AVNLog.debug("SenseHat:XDR %s", xdr)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          o = sense.get_orientation()
          pitch = o["pitch"]
          tn = self.P_NPITCH.fromDict(self.param)
          xdr = '$AVXDR,A,%.2f,D,%s' % ( float(pitch), tn)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
          tn = self.P_NROLL.fromDict(self.param)
          roll = o["roll"]
          xdr = '$AVXDR,A,%.2f,D,%s' % ( float(roll), tn)
          self.queue.addNMEA(xdr,source,addCheckSum=True,sourcePriority=priority)
        if hasRead:
          self.setOk()
          hasError=False
        else:
          self.setInfo('main','reading disabled',WorkerStatus.INACTIVE)
      except Exception as e:
        if not hasError:
          self.setInfo('main','exceptioon while reading from SenseHat %s'%str(e),WorkerStatus.ERROR)
          hasError=True
        AVNLog.info("exception while reading data from SenseHat %s", traceback.format_exc())
      wt = self.P_INTERVAL.fromDict(self.param)
      self.wait(wt)


avnav_handlerList.registerHandler(AVNSenseHatReader)
