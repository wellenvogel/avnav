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
import avnav_handlerList
from avnav_handlerList import findHandlerByConfigName
from avnav_store import AVNStore
from avnav_worker import AVNWorker, WorkerParameter, WorkerKind, WorkerStatus
from baseconfig import AVNBaseConfig


class AVNAISWorker(AVNWorker):
    P_AIS_EXPIRYTIME = WorkerParameter('aisExpiryTime', 1200, type=WorkerParameter.T_FLOAT,
                                       description="expiry time in seconds for AIS data")
    P_OWNMMSI = WorkerParameter('ownMMSI', '', type=WorkerParameter.T_STRING,
                                description='if set - do not store AIS messages with this MMSI')

    def __init__(self,cfgparam):
      self.baseConfig = None
      super(AVNAISWorker,self).__init__(cfgparam)

    def getParam(self, child=None, filtered=False):
        rt=super().getParam(child, filtered)
        if child is None and rt is not None and self.baseConfig is not None:
            for p in [self.P_AIS_EXPIRYTIME.name,self.P_OWNMMSI.name]:
                if rt.get(p) is None:
                    migrated=self.baseConfig.param.get(p)
                    if migrated:
                        rt[p]=migrated
        return rt

    @classmethod
    def getKind(cls):
        return WorkerKind.AIS

    def _updateParam(self,aisParam,navdata:AVNStore):
        if aisParam is not None:
            setParam={}
            for p in [self.P_OWNMMSI,self.P_AIS_EXPIRYTIME]:
                if aisParam.get(p.name) is not None:
                    setParam[p.name]=p.fromDict(aisParam)
            navdata.updateBaseConfig(aisExpiry=setParam.get(self.P_AIS_EXPIRYTIME.name),ownMMSI=setParam.get(self.P_OWNMMSI.name))

    def updateConfig(self, param, child=None):
        rt=super().updateConfig(param, child)
        if child is None:
            self._updateParam(param,self.navdata)

    def startInstance(self, navdata:AVNStore):
        self.baseConfig=findHandlerByConfigName(AVNBaseConfig.getConfigName())
        aisParam=self.getParam()
        self._updateParam(aisParam,navdata)
        super().startInstance(navdata)

    @classmethod
    def preventMultiInstance(cls):
        return True

    @classmethod
    def canEdit(cls):
        return True

    @classmethod
    def autoInstantiate(cls):
        return True

    def run(self):
        self.setInfo('main','tracking',WorkerStatus.NMEA)
        while not self.shouldStop():
            aisParam=self.getParam()
            mmsi=self.P_OWNMMSI.fromDict(aisParam)
            self.setInfo('ownMMSI',f"{mmsi}",WorkerStatus.NMEA if mmsi else WorkerStatus.INACTIVE)
            status=WorkerStatus.RUNNING
            numAis = self.navdata.getAisCounter()
            if numAis > 0:
                status = WorkerStatus.NMEA
            src = self.navdata.getLastAisSource()
            self.setInfo('ais',f"{numAis} targets, src: {src}",status)
            self.wait(1)

    @classmethod
    def getConfigParam(cls, child=None):
        if child is not None:
            return None
        return [cls.P_OWNMMSI,cls.P_AIS_EXPIRYTIME]


avnav_handlerList.registerHandler(AVNAISWorker)