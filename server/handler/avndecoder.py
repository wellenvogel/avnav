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
from avnav_util import MovingSum
from avnav_worker import *
from avnqueue import Fetcher
import avnav_handlerList


class NmeaEntry(object):
  def __init__(self,data,source=None,omitDecode=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    self.data=data
    self.source=source
    self.omitDecode=omitDecode
    self.sourcePriority=sourcePriority
    self.timestamp=time.monotonic()



#a Worker for feeding data trough gpsd (or directly to the navdata)
class AVNDecoder(AVNWorker):
  P_FILTER=WorkerParameter('decoderFilter',default='',type=WorkerParameter.T_FILTER)
  P_ALL=[P_FILTER]
  @classmethod
  def getConfigParam(cls, child=None):
    return cls.P_ALL

  @classmethod
  def canEdit(cls):
    return True


  @classmethod
  def autoInstantiate(cls):
    return True

  def __init__(self,cfgparam):
    super().__init__(cfgparam)
    self.decoded=MovingSum()
    self._fetcher : Fetcher=None

  def updateConfig(self, param, child=None):
    rt=super().updateConfig(param, child)
    if self._fetcher is not None:
      self._fetcher.updateParam(nmeaFilter=self.P_FILTER.fromDict(self.param))
    return rt

  def run(self):
    self._fetcher=Fetcher(self.queue,self,includeSource=True,nmeaFilter=self.P_FILTER.fromDict(self.param) )
    AVNLog.info("decoder started")
    nmeaParser=NMEAParser(self.navdata)
    self.setInfo('main', "running", WorkerStatus.RUNNING)
    while not self.shouldStop():
      try:
        nmealist=self._fetcher.fetch()
        for data in nmealist:
          if not data is None and not data.omitDecode:
            if nmeaParser.parseData(data.data,timestamp=data.timestamp,source=data.source,sourcePriority=data.sourcePriority):
              self.decoded.add(1)
      except Exception as e:
        AVNLog.warn("feeder exception - retrying %s",traceback.format_exc())
      if self.decoded.shouldUpdate():
        self.setInfo('decoder',
                     "decoded %.4g/s"%self.decoded.avg(),
                     WorkerStatus.NMEA if self.decoded.val()>0 else WorkerStatus.INACTIVE)
      self._fetcher.report()

class AVNGpsdFeeder(AVNDecoder):
  '''
  legacy config support with AVNGpsdFeeder
  '''

  @classmethod
  def autoInstantiate(cls):
    return False


avnav_handlerList.registerHandler(AVNGpsdFeeder)
avnav_handlerList.registerHandler(AVNDecoder)
