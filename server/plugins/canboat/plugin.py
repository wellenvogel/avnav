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

# -----------------------------------------------------------------------------
# Hint:
# this plugin uses a couple of internal functions of AvNav and therefore
# you should not use this as an example for own plugins
# Those internal functions can change at any point in time without notice.
# -----------------------------------------------------------------------------

import datetime
import json
import socket
import subprocess
import sys
import threading
import time
import traceback
from csv import excel

from avnav_api import AVNApi
from avnav_worker import WorkerParameter
from avnav_nmea import Key, NMEAParser


def hasCanboatRust():
    return True

class SubState:
    JSON = "JSON"
    NMEA="NMEA"
    PROCESS="PROCESS"
    def __init__(self,key,status,info):
        self.key=key
        self.status=status
        self.info=info
    def update(self,api):
        pass
class NmeaState(SubState):
    def __init__(self,source):
        super().__init__(SubState.NMEA,"RUNNING","")
        self._source=source
    def update(self,api):
        lat = api.getSingleValue(NMEAParser.K_LAT.getKey(), True)
        lon = api.getSingleValue(NMEAParser.K_LON.getKey(), True)
        tm = api.getSingleValue(NMEAParser.K_TIME.getKey(), True)
        hasPos = (lat is not None and lon is not None and lat.source == self._source and lon.source == self._source)
        hasTime = (tm is not None and tm.source == self._source)
        if not hasPos and not hasTime:
            self.status="RUNNING"
            self.info=""
        else:
            self.status="NMEA"
            txt=""
            if hasTime:
                txt += "time"
            if hasPos:
                if len(txt) > 0:
                    txt+=", "
                txt += "pos"
            self.info=txt

def importance(status):
    if status == "ERROR":
        return 3
    if status == "NMEA":
        return 2
    if status == "RUNNING":
        return 1
    return 0

class Status:
    def __init__(self):
        self._states={}
        self._lock=threading.Lock()

    def reset(self):
        with self._lock:
            self._states={}
    def addState(self, state):
        with self._lock:
            self._states[state.key] = state
    def toState(self, api):
        with self._lock:
            state="STARTED"
            info=""
            for k,v in self._states.items():
                v.update(api)
                if importance(v.status) > importance(state):
                    state=v.status
                if len(info) > 0:
                    info+=", "
                info+=v.info
        api.setStatus(state, info or "started")

class Connection:
    def __init__(self, host, port,key,state,callback):
        self._host=host
        self._port=port
        self._socket=None
        self._key=key
        self._state=state #Status
        self._callback=callback
        self._stop=False
        self._thread=None
    def connect(self):
        self._state.addState(SubState(self._key,"STARTING",f"{self._key} con {self._host}:{self._port}"))
        self._socket = socket.create_connection((self._host, self._port), timeout=20)
        self._state.addState(SubState(self._key, "RUNNING", f"{self._key} {self._host}:{self._port}"))
        self._socket.settimeout(1)
    def close(self):
        if self._socket is not None:
            try:
                self._socket.close()
            except:
                pass
            self._socket=None
    def start(self):
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()
    def stop(self):
        self._stop=True
        self.close()
        if self._thread is not None:
            self._thread.join(5)
            self._thread=None
    def _run(self):
        buffer=""
        while not self._stop:
            try:
                if self._socket is None:
                    self.connect()
                data = self._socket.recv(1024)
                if len(data) == 0:
                    raise Exception("connection lost")
                buffer = buffer + data.decode('ascii', 'ignore')
            except socket.timeout:
                pass
            except Exception as e:
                self._state.addState(SubState(self._key, "ERROR", f"{self._key} {self._host}:{self._port}: {str(e)}"))
                self.close()
                time.sleep(2)
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
                        self._state.addState(SubState(self._key, "ERROR", f"{self._key} {self._host}:{self._port}: unable to decode json {l}: {str(e)}"))
            except Exception as e:
                self._state.addState(SubState(self._key, "ERROR", f"{self._key} {str(e)}"))
                self.close()
                time.sleep(2)


class Plugin(object):
    NM = 1852.0
    # PGNS used to set the time
    DEFAULT_PGNS = '126992,129029'
    P_PORT = WorkerParameter('port', description='canbus json port', default=2598, type=WorkerParameter.T_NUMBER)
    P_HOST = WorkerParameter('host', description='canbus json host (default: localhost)', default='localhost')
    P_SENDRMC = WorkerParameter('autoSendRMC', description='time in seconds with no RMC to start sending it,0: off',
                                default=0, type=WorkerParameter.T_NUMBER)
    P_SRC = WorkerParameter('sourceName',
                            description='source name to be set for the generated records (defaults to plugin name)',
                            default='')
    P_IV = WorkerParameter('timeInterval',
                           description='time in seconds to store time received via n2k (also used as interval for auto send RMC, 0 to disable)',
                           default=0.5, type=WorkerParameter.T_FLOAT)
    P_TIPGNS = WorkerParameter('timePGNs', description='PGNs used to set time',
                               default=DEFAULT_PGNS)
    P_READPOS = WorkerParameter('readPos', description='read position from 129025 and cog/sog from 129026',
                                default=True, type=WorkerParameter.T_BOOLEAN)
    P_PRIORITY = WorkerParameter('priority', description='priority of for the channel',
                                 default=40,
                                 type=WorkerParameter.T_NUMBER)
    P_CANBOATDEV = WorkerParameter('canboatDevice',
                                   description='the canboat device to use (e.g. can0, vcan0, etc.)',
                                   mandatory=False,
                                   default=None)
    P_CANBOATKIND = WorkerParameter('canboatKind',
                                    type=WorkerParameter.T_SELECT,
                                    rangeOrList=['actisense', 'socketcan', 'yachtd'],
                                    description='the canboat device kind to use (socketcan, actisense, yachtd)',
                                    mandatory=False,
                                    default='socketcan')
    PATHES = [
        NMEAParser.K_TIME,
        NMEAParser.K_SOG,
        NMEAParser.K_COG,
        NMEAParser.K_LON,
        NMEAParser.K_LAT
    ]
    CONFIG = ([] if not hasCanboatRust() else [
        P_CANBOATKIND,
        P_CANBOATDEV
        ])+ [
        P_PORT,
        P_HOST,
        P_SENDRMC,
        P_READPOS,
        P_SRC,
        P_IV,
        P_TIPGNS,
        P_PRIORITY
    ]
    CONFIGLIST = list(map(lambda v: v.__dict__, CONFIG))

    @classmethod
    def pluginInfo(cls):
        """
        the description for the module
        @return: a dict with the content described below
                parts:
                   * description (mandatory)
                   * data: list of keys to be stored (optional)
                     * path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
                     * description
        """
        return {
            'description': 'a plugin that reads some PGNS from canboat. Currently supported: 126992:SystemTime. You need to set allowKeyOverwrite=true',
            'version': '1.0',
            'config': cls.CONFIGLIST,
            'data': list(map(lambda k: {'path': k.getKey(), 'description': k.description}, cls.PATHES))
        }

    def __init__(self, api):
        """
            initialize a plugins
            do any checks here and throw an exception on error
            do not yet start any threads!
            @param api: the api to communicate with avnav
            @type  api: AVNApi
        """
        self.api = api  # type: AVNApi
        self.api.registerRestart(self.stop)
        self.api.registerEditableParameters(self.CONFIGLIST, self.changeConfig)
        self.changeSequence = 0
        self.lastRmc = time.monotonic()
        self.status = None
        self.process = None
        self.connections={}

    def rmcWatcher(self, sequence, source):
        while sequence == self.changeSequence:
            seq = 0
            seq, data = self.api.fetchFromQueue(seq, 10, includeSource=True, filter='$RMC')
            if len(data) > 0:
                for d in data:
                    if d.source != source:
                        self.lastRmc = time.monotonic()
                        break

    def _stop(self):
        if self.process is not None:
            try:
                self.api.log("stopping process %s", self.process)
                self.process.terminate()
                self.process = None
            except Exception as e:
                self.api.log("exception while stopping process %s: %s", self.process, repr(e))
        for con in self.connections.values():
            if con is not None:
                try:
                    con.stop()
                except Exception as e:
                    self.api.log("exception while stopping connection %s: %s", con, repr(e))
        self.connections.clear()


    def changeConfig(self, newValues):
        self.api.saveConfigValues(newValues)
        self.changeSequence += 1
        self._stop()

    def stop(self):
        self.changeSequence += 1
        self._stop()

    def run(self):
        while not self.api.shouldStopMainThread():
            self._runInternal()

    def _getConfig(self, cfg: WorkerParameter):
        v = self.api.getConfigValue(cfg.name, cfg.default)
        return cfg.checkValue(v, False)

    def _getField(self, msg, name, sub=None):
        fields = msg.get("fields")
        if fields is None:
            return
        rt = fields.get(name)
        if sub is None or rt is None:
            return rt
        if isinstance(rt, dict):
            return rt.get(sub)
        return rt

    def _buildCmd(self, kind, device,jsonPort):
        return ["canboat", "server", "--kind", kind, "--device", device,
                '--snapshot-port','0',
                '--input-port','0',
                '--ais-port','0',
                '--raw-port','0',
                '--nmea0183-filter-port','0',
                '--overrides-port','0',
                '--analyzer-port', str(jsonPort)]

    def _checkProcess(self):
        if not hasCanboatRust():
            return True
        if self.process is None:
            self.api.setStatus("ERROR", "canboat server not running")
            return False
        if self.process.poll() is not None:
            self.api.setStatus("ERROR", f"canboat server exited with {self.process.returncode}")
            return False
        else:
            self.state.addState(SubState(SubState.PROCESS,"RUNNING",f"pid {self.process.pid}"))
            self.state.toState(self.api)
        return True
    def _stopWithError(self,sequence, msg):
        self.api.setStatus("ERROR", msg)
        self._stop()
        while sequence == self.changeSequence and not self.api.shouldStopMainThread():
            time.sleep(0.1)
    def _safeWait(self, sequence, timeout):
        start = time.monotonic()
        while sequence == self.changeSequence and not self.api.shouldStopMainThread() and (time.monotonic() - start) < timeout:
            time.sleep(0.1)
    def _handleJson(self, line, handledPGNs, readPos, source, priority, autoSendRMC, timeInterval):
        try:
            msg = json.loads(line)
            pgn = msg.get('pgn')
            if pgn in handledPGNs:
                now = time.monotonic()
                if now >= (self.lastRmc + timeInterval) and timeInterval > 0:
                    self.lastRmc = now
                    cdate = self._getField(msg, 'Date', 'value')
                    ctime = self._getField(msg, 'Time', 'value')
                    dt = None
                    if cdate is not None and ctime is not None:
                        dt = datetime.datetime(year=1970, month=1, day=1)
                        dt += datetime.timedelta(days=cdate, milliseconds=ctime / 10)
                    if dt is not None:
                        self.api.addData(NMEAParser.K_TIME.getKey(), self.formatTime(dt), source=source,
                                         sourcePriority=priority)
                    if autoSendRMC > 0:
                        if self.lastRmc is None or self.lastRmc < (now - autoSendRMC):
                            lat = self.api.getSingleValue("gps.lat")
                            lon = self.api.getSingleValue("gps.lon")
                            if lat is not None and lon is not None:
                                speed = self.api.getSingleValue("gps.speed")
                                cog = self.api.getSingleValue("gps.track")
                                self.api.debug("generating RMC lat=%f,lon=%f,ts=%s", lat, lon,
                                               dt.isoformat())
                                fixutc = "%02d%02d%02d.%02d" % (dt.hour, dt.minute, dt.second,
                                                                dt.microsecond / 1000)
                                (latstr, NS) = self.nmeaFloatToPos(lat, True)
                                (lonstr, EW) = self.nmeaFloatToPos(lon, False)
                                speedstr = "" if speed is None else "%.2f" % (speed * 3600 / self.NM)
                                year = "%04d" % dt.year
                                datestr = "%02d%02d%s" % (dt.day, dt.month, year[-2:])
                                cogstr = "" if cog is None else "%.2f" % cog
                                record = "$GPRMC,%s,A,%s,%s,%s,%s,%s,%s,%s,,,A" % (fixutc, latstr, NS,
                                                                                   lonstr, EW, speedstr,
                                                                                   cogstr, datestr)
                                self.api.addNMEA(record, addCheckSum=True, source=source)
                    if readPos:
                        if pgn == 129025:  # pos
                            clat = self.api.getSingleValue(NMEAParser.K_LAT.getKey(), includeInfo=True)
                            clon = self.api.getSingleValue(NMEAParser.K_LON.getKey(), includeInfo=True)
                            if clon is None or clon.source == source or clat is None or clat.source == source:
                                lon = self._getField(msg, 'Longitude')
                                lat = self._getField(msg, 'Latitude')
                                if lon is not None and lat is not None:
                                    self.api.addData(NMEAParser.K_LON.getKey(), lon, source=source,
                                                     sourcePriority=priority)
                                    self.api.addData(NMEAParser.K_LAT.getKey(), lat, source=source,
                                                     sourcePriority=priority)
                        if pgn == 129026:  # sog/cog
                            csog = self.api.getSingleValue(NMEAParser.K_SOG.getKey(), includeInfo=True)
                            ccog = self.api.getSingleValue(NMEAParser.K_COG.getKey(), includeInfo=True)
                            if csog is None or csog.source == source or ccog is None or ccog.source == source:
                                ref = self._getField(msg, "COG Reference")
                                if ref is not None and ref.get('value') == 0:
                                    cog = self._getField(msg, 'COG')
                                    sog = self._getField(msg, 'SOG')
                                    if sog is not None and cog is not None:
                                        self.api.addData(NMEAParser.K_SOG.getKey(), sog, source=source,
                                                         sourcePriority=priority)
                                        self.api.addData(NMEAParser.K_COG.getKey(), cog, source=source,
                                                         sourcePriority=priority)
                    # add other decoders here

        except:
            self.api.log("unable to decode json %s:%s" % (line, traceback.format_exc()))

    def _runInternal(self):
        sequence = self.changeSequence
        self._stop()
        self.state=Status()
        self.state.addState(NmeaState(self._getConfig(self.P_SRC)))
        device=self._getConfig(self.P_CANBOATDEV)
        kind=self._getConfig(self.P_CANBOATKIND)
        if hasCanboatRust():
            if device is None or device.strip() == "":
                self._stopWithError(sequence, "no canboatDevice configured, stopping plugin")
            if kind is None or kind.strip() == "":
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
        sock = None
        host = self._getConfig(self.P_HOST)
        timeInterval = 0.5
        try:
            port = self._getConfig(self.P_PORT)
            timeInterval = self._getConfig(self.P_IV)
        except:
            self.api.log("exception while reading config values %s", traceback.format_exc())
            raise
        if hasCanboatRust():
            cmd=self._buildCmd(kind, device, port)
            self.api.setStatus("RUNNING", f"starting canboat server {' '.join(cmd)}")
            self.process=self.api.safeSpawn(cmd, shell=False,
                                        stdout_reader=lambda line: self.api.log("canboat: %s" % line),
                                        stderr_reader=lambda line: self.api.log("canboat: %s" % line))
        if not self._checkProcess():
            self._safeWait(sequence, 10)
            return
        autoSendRMC = self._getConfig(self.P_SENDRMC)
        handledPGNs = self._getConfig(self.P_TIPGNS).split(',')
        readPos = self._getConfig(self.P_READPOS)
        handledPGNs = [int(p) for p in handledPGNs]
        self.api.log("started with host=%s,port %d, autoSendRMC=%d" % (host, port, autoSendRMC))
        source = self._getConfig(self.P_SRC)
        rmcWatcher = threading.Thread(target=self.rmcWatcher, args=[sequence, source], daemon=True)
        rmcWatcher.start()
        priority = self._getConfig(self.P_PRIORITY)
        self.api.setStatus("STARTED", "connecting to n2kd at %s:%d" % (host, port))
        jCon=Connection(host=host, port=port,key=SubState.JSON,
                                                   state=self.state,
                                                   callback=lambda l: self._handleJson(l, handledPGNs, readPos, source, priority, autoSendRMC, timeInterval))
        self.connections[SubState.JSON] = jCon
        jCon.start()
        while sequence == self.changeSequence:
            if not self._checkProcess():
                self._safeWait(sequence, 10)
                return
            self.state.toState(self.api)
            if sequence != self.changeSequence:
                return
            self._safeWait(sequence, 1)

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
