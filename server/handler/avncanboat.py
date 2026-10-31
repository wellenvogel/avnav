# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021,2019,2024 Andreas Vogel andreas@wellenvogel.net
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


import datetime
import json
import socket
import threading
import time
import traceback

import avnav_handlerList
from avnav_api import AVNApi
from avnav_nmea import NMEAParser
from avnav_store import AVNStore
from avnav_util import AVNLog, AVNUtil, SafePopen
from avnav_worker import WorkerParameter, AVNWorker, WorkerStatus


class Connection:
    def __init__(self, host, port,key,infoCb,callback):
        self._host=host
        self._port=port
        self._socket=None
        self._key=key
        self._infoCb=infoCb
        self._callback=callback
        self._stop=False
        self._thread=None
        self._condition=threading.Condition()
    def _info(self,key,*args):
        if not self._stop:
            self._infoCb(key,*args)
        else:
            self._infoCb(key,"stopped",WorkerStatus.INACTIVE)
    def _wait(self,timeout):
        with self._condition:
            self._condition.wait(timeout)
    def _wake(self):
        with self._condition:
            self._condition.notify()
    def connect(self):
        if self._stop:
            return
        self._info(self._key,f"trying {self._host}:{self._port}",WorkerStatus.STARTED)
        self._socket = socket.create_connection((self._host, self._port), timeout=20)
        self._info(self._key, f"connected {self._host}:{self._port}", WorkerStatus.RUNNING)
        self._socket.settimeout(1)
    def close(self):
        if self._socket is not None:
            try:
                self._socket.close()
            except:
                pass
            self._socket=None
        self._info(self._key, f"closed {self._host}:{self._port}", WorkerStatus.INACTIVE)
    def start(self):
        if self._thread is not None:
            return
        if self._stop:
            return
        self._thread = threading.Thread(target=self._run,
                                        daemon=True,
                                        name=f"Canboat-{self._key}")
        self._thread.start()
    def stop(self):
        self._stop=True
        self.close()
        self._wake()
        if self._thread is not None:
            self._thread.join(5)
            self._thread=None
    def _run(self):
        buffer=""
        while not self._stop:
            try:
                if self._socket is None:
                    self.connect()
                if self._socket is None:
                    raise Exception("not connected")
                self._info(self._key, f"receiving {self._host}:{self._port}", WorkerStatus.RUNNING)
                data = self._socket.recv(1024)
                if len(data) == 0:
                    raise Exception("connection lost")
                buffer = buffer + data.decode('ascii', 'ignore')
            except socket.timeout:
                pass
            except Exception as e:
                self.close()
                self._info(self._key, f"{self._host}:{self._port}: {str(e)}",WorkerStatus.ERROR)
                self._wait(5)
                continue
            try:
                lines = buffer.splitlines(True)
                if len(lines) == 0:
                    continue
                if lines[-1][-1] == '\n':
                    buffer = ""
                else:
                    if len(lines) > 0:
                        buffer = lines.pop(-1)
                    else:
                        buffer = ""
                for l in lines:
                    try:
                        self._callback(l)
                    except Exception as e:
                        AVNLog.debug(f"{self._key} {self._host}:{self._port}: unable to decode json {l}: {str(e)}")
            except Exception as e:
                self.close()
                self._info(self._key, f"{self._host}:{self._port}: {str(e)}", WorkerStatus.ERROR)
                self._wait(3)

class ConnectionList:
    def __init__(self):
        self._lock=threading.Lock()
        self._connections={}
    def add(self,key,connection):
        with self._lock:
            self._connections[key]=connection
    def remove(self,key):
        with self._lock:
            if key in self._connections:
                del self._connections[key]
                return True
    def clear(self):
        with self._lock:
            self._connections.clear()
    def all(self):
        with self._lock:
            connections=self._connections.copy()
            return connections

class AVNCanboatHandler(AVNWorker):
    NM = 1852.0
    # PGNS used to set the time
    DEFAULT_PGNS = '126992,129029'
    T_RUST='rust'
    T_LEGACY='legacy'
    P_CANBOATTYPE = WorkerParameter('canboatType',
                                    type=WorkerParameter.T_SELECT,
                                    rangeOrList=[T_RUST, T_LEGACY, ''],
                                    description='the canboat implementation to use , leave empty to disable',
                                    mandatory=False,
                                    default=T_RUST,
                                    editable=False)
    P_PORT = WorkerParameter('port', description='canbus json port', default=2598, type=WorkerParameter.T_NUMBER)
    P_HOST = WorkerParameter('host', description='canbus json host (default: localhost)',
                             default='localhost',
                             condition={P_CANBOATTYPE.name: T_LEGACY}
                             )
    P_SENDRMC = WorkerParameter('autoSendRMC', description='If no other RMC record is seen within this time in seconds, start sending it.\n'+
                                                           'Set 0 to disable RMC sending.',
                                default=0, type=WorkerParameter.T_NUMBER)
    P_RMCTALKER= WorkerParameter('talkerId', description='The talker id used when sending RMC messages',
                                 default='GP')
    P_IV = WorkerParameter('timeInterval',
                           description='Time in seconds to store time received via n2k directly.\n'+
                                       'Also use this as interval betwen two RMC messages if autoSendRMC is active.\n'+
                                       'Set to 0 to disable receiving time data from N2K',
                           default=0.5, type=WorkerParameter.T_FLOAT)
    P_TIPGNS = WorkerParameter('timePGNs', description='PGNs used to set time',
                               default=DEFAULT_PGNS)
    P_READPOS = WorkerParameter('readPos', description='Read position from 129025 and cog/sog from 129026\n'+
                                'This allows to have minimal navigation functions even without enabling the NMEA0183 stream',
                                default=True, type=WorkerParameter.T_BOOLEAN)
    P_PRIORITY = WorkerParameter('priority', description='Priority of for the channel.\n'+
                                 'The priority is used for the NMEA messages\n.'
                                 'The values directly received from N2K (if enabled) use this priority +1.',
                                 default=40,
                                 type=WorkerParameter.T_NUMBER)
    P_CANBOATDEV = WorkerParameter('canboatDevice',
                                   description='The canboat device to use (e.g. can0, vcan0, etc.).\n'+
                                     'For special cases you can leave this empty and provide all parameters directly with canboatParam.',
                                   mandatory=False,
                                   default='',
                                   condition={P_CANBOATTYPE.name:T_RUST})
    P_CANBOATKIND = WorkerParameter('canboatKind',
                                    type=WorkerParameter.T_SELECT,
                                    rangeOrList=['actisense', 'socketcan', 'yachtd',''],
                                    description='The canboat device kind to use (socketcan, actisense, yachtd).\n'+
                                                'For special cases you can leave this empty and provide all parameters directly with canboatParam.',
                                    mandatory=False,
                                    default='socketcan',
                                    condition={P_CANBOATTYPE.name:T_RUST})
    P_CANBOATPARAM= WorkerParameter('canboatParam',
                                    description='Additional parameters for the canboat rust call.\n'+
                                      'Refer to the documentation for more details.\n',
                                    default="",
                                    mandatory=False,
                                    condition={P_CANBOATTYPE.name:T_RUST})
    P_CANBOATNMEA=WorkerParameter('canboatNMEA',type=WorkerParameter.T_BOOLEAN,
                                  description='Enable receiving NMEA messages from canboat.\n'+
                                    'If you enable this DO NOT additionally configure a socket reader',
                                  default=True,
                                  condition={P_CANBOATTYPE.name:T_RUST})
    P_NMEAPORT=WorkerParameter('nmeaPort',type=WorkerParameter.T_NUMBER,
                               mandatory=False,
                               default=2607,
                               description='The port to be used for NMEA data.\n'+
                               'The default intentionally differs from the canboat default of 2599 to avoid issues with an additonal socket reader on the legacy port.',
                               condition={P_CANBOATTYPE.name:T_RUST,P_CANBOATNMEA.name:True})

    PATHES = [
        NMEAParser.K_TIME,
        NMEAParser.K_SOG,
        NMEAParser.K_COG,
        NMEAParser.K_LON,
        NMEAParser.K_LAT
    ]
    CONFIG_ALL = [
        P_CANBOATTYPE,
        P_CANBOATKIND,
        P_CANBOATDEV,
        P_CANBOATPARAM,
        P_HOST,
        P_PORT,
        P_CANBOATNMEA,
        P_NMEAPORT,
        P_SENDRMC,
        P_READPOS,
        P_IV,
        P_TIPGNS,
        P_PRIORITY
    ]
    ST_JSON = "json"
    ST_NMEA = "nmea"
    ST_PROCESS = "server"
    ST_MAIN="main"
    ST_DECODE = "decode"

    SUBSOURCE_NMEA="NMEA"
    SUBSOURCE_N2K="N2K"


    def _hasRust(self):
        return self._getConfig(self.P_CANBOATTYPE) == self.T_RUST
    def _hasLegay(self):
        return self._getConfig(self.P_CANBOATTYPE) == self.T_LEGACY
    def __init__(self, cfgparam):
        """
            initialize a plugins
            do any checks here and throw an exception on error
            do not yet start any threads!
            @param api: the api to communicate with avnav
            @type  api: AVNApi
        """
        super().__init__(cfgparam)
        self.changeSequence = 0
        self.lastRmc = time.monotonic() #last foreign RMC
        self.lastOwnTime = time.monotonic() #last handled time/last send RMC
        self.process = None
        self.connections=ConnectionList()

    def startInstance(self, navdata:AVNStore):
        super().startInstance(navdata)
        for key in self.PATHES:
            navdata.registerKey(key.getKey(),key.description,allowOverwrite=True)

    @classmethod
    def getConfigParamCombined(cls, child=None):
        if child is not None:
            return None
        return [cls.NAME_PARAMETER.copy(default='canboat'),cls.QUEUE_NAME_PARAMETER,cls.ENABLE_PARAM_DESCRIPTION]+cls.CONFIG_ALL

    def rmcWatcher(self, sequence, source):
        while sequence == self.changeSequence:
            seq = 0
            seq, data = self.queue.fetchFromHistory(sequence, 10, includeSource=True,
                                           nmeafilter=['$RMC'])
                #self.queue.fetchFromQueue(seq, 10, includeSource=True, filter='$RMC'))
            if len(data) > 0:
                for d in data:
                    #we consider RMC ok if another source provides this
                    #or if our own NMEA stream provides this
                    if d.source != source or d.subsource == self.SUBSOURCE_NMEA:
                        self.lastRmc = time.monotonic()
                        break
            #self.wait(0.1)

    def _stop(self):
        if self.process is not None:
            try:
                AVNLog.info("stopping process %s", self.process)
                process=self.process
                process.kill_all()
                def wait_done():
                    #catching the killed process to avoid defuncts
                    while process.poll() is None:
                        time.sleep(0.1)
                    AVNLog.info("process %s finished", process)
                waiter=threading.Thread(target=wait_done,daemon=True)
                waiter.start()
                self.process = None
            except Exception as e:
                AVNLog.info("exception while stopping process %s: %s", self.process, repr(e))
        for con in self.connections.all().values():
            if con is not None:
                try:
                    con.stop()
                except Exception as e:
                    AVNLog.info("exception while stopping connection %s: %s", con, repr(e))
        self.connections.clear()
        self.setInfo(self.ST_MAIN,"stopped",WorkerStatus.INACTIVE)
        for st in [self.ST_NMEA, self.ST_PROCESS,self.ST_JSON,self.ST_DECODE]:
            self.deleteInfo(st)

    @classmethod
    def preventMultiInstance(cls):
        return True

    @classmethod
    def autoInstantiate(cls):
        return True #TODO

    @classmethod
    def canEdit(cls):
        return True

    @classmethod
    def canDisable(cls):
        return True

    def updateConfig(self, newValues,child=None):
        if child is None:
            if self.P_CANBOATTYPE.name in newValues:
                try:
                    del newValues[self.P_CANBOATTYPE.name]
                except KeyError:
                    pass
        super().updateConfig(newValues,child)
        self.changeSequence += 1
        self._stop()

    def stop(self):
        self.changeSequence += 1
        self._stop()

    def run(self):
        while not self.shouldStop():
            try:
                self._runImpl()
            except Exception as e:
                AVNLog.info("exception while running plugin %s: %s", self.process, repr(e))
            self._stop()
            self.wait(5)

    def _getConfig(self, cfg: WorkerParameter):
        return self.getWParam(cfg, False)


    def _getField(self, msg, name, sub=None):
        fields = msg.get("fields")
        if fields is None:
            return
        rt = fields.get(name) or fields.get(name.lower())
        if rt is None:
            return
        if sub is None or rt is None:
            return rt
        if isinstance(rt, dict):
            return rt.get(sub)
        return rt

    def _buildCmd(self, kind=None, device=None,jsonPort=None,nmeaPort=None,param=None):
        rt= ["canboat", "server",
                '--snapshot-port','0',
                '--input-port','0',
                '--ais-port','0',
                '--raw-port','0',
                '--nmea0183-filter-port','0',
                '--overrides-port','0'
        ]
        if jsonPort is not None:
            rt.append("--analyzer-port")
            rt.append(str(jsonPort))
        if nmeaPort is not None:
            rt.append("--nmea0183-port")
            rt.append(str(nmeaPort))
        if kind is not None and not kind.strip() == '':
            rt.append("--kind")
            rt.append(kind)
        if device is not None and not device.strip() == '':
            rt.append("--device")
            rt.append(device)
        if param is not None and not param.strip() == '':
            for p in param.split(' '):
                rt.append(p)
        return rt

    def _checkProcess(self):
        if not self._hasRust():
            return True
        if self.process is None:
            self.setInfo(self.ST_PROCESS, "canboat server not running",WorkerStatus.ERROR)
            return False
        if self.process.poll() is not None:
            self.setInfo(self.ST_PROCESS, f"canboat server exited with {self.process.returncode}",WorkerStatus.ERROR)
            return False
        else:
            self.setInfo(self.ST_PROCESS,f"pid {self.process.pid}",WorkerStatus.NMEA)
        return True
    def _stopWithError(self,sequence, msg):
        self._stop()
        self.setInfo(self.ST_MAIN, msg, WorkerStatus.ERROR)
        while sequence == self.changeSequence and not self.shouldStop():
            self.wait(5)
    def _safeWait(self, sequence, timeout):
        self.wait(timeout)

    def _handleNmea(self,line,source,priority):
        self.queue.addNMEA(line,source=source,sourcePriority=priority,omitDecode=False,subsource=self.SUBSOURCE_NMEA)

    def _handleJson(self, line, handledPGNs, readPos, source, priority, autoSendRMC, timeInterval,timeInSeconds):
        try:
            msg = json.loads(line)
            pgn = msg.get('pgn')
            if pgn in handledPGNs:
                now = time.monotonic()
                if now >= (self.lastOwnTime + timeInterval) and timeInterval > 0:
                    self.lastOwnTime = now
                    cdate = self._getField(msg, 'Date', 'value')
                    ctime = self._getField(msg, 'Time', 'value')
                    dt = None
                    if cdate is not None and ctime is not None:
                        dt = datetime.datetime(year=1970, month=1, day=1)
                        if timeInSeconds:
                            dt += datetime.timedelta(days=cdate, seconds=ctime )
                        else:
                            dt += datetime.timedelta(days=cdate, milliseconds=ctime / 10)
                    if dt is not None:
                        self.navdata.setValue(NMEAParser.K_TIME.getKey(), self.formatTime(dt), source=source,
                                         priority=priority+1)
                    if autoSendRMC > 0:
                        if self.lastRmc is None or self.lastRmc < (now - autoSendRMC):
                            lat = self.navdata.getSingleValue(NMEAParser.K_LAT.getKey())
                            lon = self.navdata.getSingleValue(NMEAParser.K_LON.getKey())
                            if lat is not None and lon is not None:
                                speed = self.navdata.getSingleValue(NMEAParser.K_SOG.getKey())
                                cog = self.navdata.getSingleValue(NMEAParser.K_COG.getKey())
                                AVNLog.debug("generating RMC lat=%f,lon=%f,ts=%s", lat, lon,
                                               dt.isoformat())
                                fixutc = "%02d%02d%02d.%02d" % (dt.hour, dt.minute, dt.second,
                                                                dt.microsecond / 1000)
                                (latstr, NS) = self.nmeaFloatToPos(lat, True)
                                (lonstr, EW) = self.nmeaFloatToPos(lon, False)
                                speedstr = "" if speed is None else "%.2f" % (speed * 3600 / self.NM)
                                year = "%04d" % dt.year
                                datestr = "%02d%02d%s" % (dt.day, dt.month, year[-2:])
                                cogstr = "" if cog is None else "%.2f" % cog
                                talker=self._getConfig(self.P_RMCTALKER) or 'GP'
                                record = "$%sRMC,%s,A,%s,%s,%s,%s,%s,%s,%s,,,A" % (talker,fixutc, latstr, NS,
                                                                                   lonstr, EW, speedstr,
                                                                                   cogstr, datestr)
                                self.queue.addNMEA(record, addCheckSum=True,
                                                   omitDecode=True,
                                                   source=source,sourcePriority=priority,
                                                   subsource=self.SUBSOURCE_N2K)
            if readPos:
                if pgn == 129025:  # pos
                    lon = self._getField(msg, 'Longitude')
                    lat = self._getField(msg, 'Latitude')
                    if lon is not None and lat is not None:
                        self.navdata.setValue(NMEAParser.K_LON.getKey(), lon, source=source,
                                              priority=priority+1)
                        self.navdata.setValue(NMEAParser.K_LAT.getKey(), lat, source=source,
                                              priority=priority+1)
                if pgn == 129026:  # sog/cog
                    ref = self._getField(msg, "COG Reference") or self._getField(msg, "cogReference")
                    if ref is not None and ref.get('value') == 0:
                        cog = self._getField(msg, 'COG')
                        sog = self._getField(msg, 'SOG')
                        if sog is not None and cog is not None:
                            self.navdata.setValue(NMEAParser.K_SOG.getKey(), sog, source=source,
                                                  priority=priority+1)
                            self.navdata.setValue(NMEAParser.K_COG.getKey(), cog, source=source,
                                                  priority=priority+1)
            # add other decoders here

        except Exception as e:
            AVNLog.info("unable to decode json %s:%s" % (line, traceback.format_exc()))

    def _updateNmeaState(self):
        source=self.getSourceName()
        lat = self.navdata.getSingleValue(NMEAParser.K_LAT.getKey(), True)
        lon = self.navdata.getSingleValue(NMEAParser.K_LON.getKey(), True)
        tm = self.navdata.getSingleValue(NMEAParser.K_TIME.getKey(), True)
        hasPos = (lat is not None and lon is not None and lat.source == source and lon.source == source)
        hasTime = (tm is not None and tm.source == source)
        status=WorkerStatus.INACTIVE
        info=""
        if not hasPos and not hasTime:
            status = WorkerStatus.INACTIVE
        else:
            status = WorkerStatus.NMEA
            if hasTime:
                info += "time"
            if hasPos:
                if len(info) > 0:
                    info += ", "
                info += "pos"
        self.setInfo(self.ST_DECODE, info, status)

    def _runImpl(self):
        sequence = self.changeSequence
        self._stop()
        self._updateNmeaState()
        device=self._getConfig(self.P_CANBOATDEV)
        kind=self._getConfig(self.P_CANBOATKIND)
        param=self._getConfig(self.P_CANBOATPARAM)
        hasRust=self._hasRust()
        if hasRust:
            if (device is None or device.strip() == "") and (param is None or not 'device' in param):
                self._stopWithError(sequence, "no canboatDevice configured, stopping plugin")
            if (kind is None or kind.strip() == "") and (param is None or not 'kind' in param):
                self._stopWithError(sequence, "no canboatKind configured, stopping plugin")
        """
        the run method
        this will be called after successfully instantiating an instance
        this method will be called in a separate Thread
        The example simply counts the number of NMEA records that are flowing through avnav
        and writes them to the store every 10 records
        @return:
        """
        port = 2598
        host = self._getConfig(self.P_HOST)
        timeInterval = 0.5
        try:
            port = self._getConfig(self.P_PORT)
            timeInterval = self._getConfig(self.P_IV)
        except:
            AVNLog.info("exception while reading config values %s", traceback.format_exc())
            raise
        nmeaPort=None
        if self._hasRust():
            if self._getConfig(self.P_CANBOATNMEA):
                nmeaPort = self._getConfig(self.P_NMEAPORT)
            cmd=self._buildCmd(kind, device, port,nmeaPort,self._getConfig(self.P_CANBOATPARAM))
            self.setInfo(self.ST_PROCESS, f"starting canboat server {' '.join(cmd)}",WorkerStatus.RUNNING)
            self.process=SafePopen(cmd, shell=False,
                                        stdout_reader=lambda line: AVNLog.info("canboat: %s" % line),
                                        stderr_reader=lambda line: AVNLog.info("canboat: %s" % line))
        if not self._checkProcess():
            self._safeWait(sequence, 10)
            return
        autoSendRMC = self._getConfig(self.P_SENDRMC)
        handledPGNs = self._getConfig(self.P_TIPGNS).split(',')
        readPos = self._getConfig(self.P_READPOS)
        handledPGNs = [int(p) for p in handledPGNs]
        AVNLog.info("started with host=%s,port %d, autoSendRMC=%d" % (host, port, autoSendRMC))
        self.setInfo(self.ST_MAIN, f"started",WorkerStatus.RUNNING)
        source = self.getSourceName()
        rmcWatcher = threading.Thread(target=self.rmcWatcher, args=[sequence, source], daemon=True)
        rmcWatcher.start()
        priority = self._getConfig(self.P_PRIORITY)
        #with version 9 canboat changed the time to be in seconds
        #instead of the previous wire based value
        #as we do not support canboat >= 9 in the classical version (and we do not have rust < 9)
        #for us hasRust can be used to determine between versions < 9 and >= 9
        jCon=Connection(host=host, port=port,key=self.ST_JSON,
                            infoCb=self.setInfo,
                            callback=lambda l: self._handleJson(l, handledPGNs,
                                                                readPos, source, priority,
                                                                autoSendRMC, timeInterval,hasRust))
        self.connections.add(self.ST_JSON,jCon)
        jCon.start()
        if nmeaPort:
            nCon=Connection(host=host, port=nmeaPort,key=self.ST_NMEA,infoCb=self.setInfo,
                            callback=lambda l: self._handleNmea(l, source,priority))
            self.connections.add(self.ST_NMEA,nCon)
            nCon.start()
        while sequence == self.changeSequence:
            if not self._checkProcess():
                self._safeWait(sequence, 10)
                return
            self._updateNmeaState()
            if sequence != self.changeSequence:
                return
            self._safeWait(sequence, 3)

    def formatTime(self, ts):
        t = ts.isoformat()
        # seems that isoformat does not well harmonize with OpenLayers.Date
        # they expect at leas a timezone info
        # as we are at GMT we should have a "Z" at the end
        if not t[-1:] == "Z":
            t += "Z"
        return t

    def nmeaFloatToPos(self, pos, isLat):
        '''return a tuple (string,direction) from a position'''
        if pos is None:
            return ("", "")
        dir = 'N' if isLat else 'E'
        if pos < 0:
            dir = 'S' if isLat else 'W'
            pos = -pos
        deg = int(pos)
        min = 60 * pos - 60 * deg
        if isLat:
            rt = "%02d%05.2f" % (deg, min)
        else:
            rt = "%03d%05.2f" % (deg, min)
        return (rt, dir)

avnav_handlerList.registerHandler(AVNCanboatHandler)