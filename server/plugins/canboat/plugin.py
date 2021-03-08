import datetime
import json
import socket
import sys
import time
import traceback
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it

from avnav_api import AVNApi


class Plugin(object):
  PATH="gps.time"
  NM = 1852.0
  #PGNS used to set the time
  DEFAULT_PGNS='126992,129029'
  CONFIG=[
        {
          'name':'port',
          'description':'canbus json port',
          'default':2598,
          'type': 'NUMBER'
        },
        {
          'name': 'host',
          'description': 'canbus json host (default: localhost)',
          'default': 'localhost'
        },
        {
          'name': 'allowKeyOverwrite',
          'description': 'necessary to be able to set our time directly from canboat',
          'default': False,
          'type': 'BOOLEAN'
        },
        {
          'name': 'autoSendRMC',
          'description': 'time in seconds with no RMC to start sending it,0: off',
          'default': 0,
          'type': 'NUMBER'
        },
        {
          'name': 'sourceName',
          'description': 'source name to be set for the generated records (defaults to plugin name)',
          'default': ''
        },
        {
          'name': 'timeInterval',
          'description': 'time in seconds to store time received via n2k',
          'default': 0.5,
          'type':'FLOAT'
        },
        {
          'name': 'timePGNs',
          'description':'PGNs used to set time',
          'default': DEFAULT_PGNS
        }
        ]

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
      'config': cls.CONFIG,
      'data': [
        {
          'path': cls.PATH,
          'description': 'time from pgn 126992',
        }
      ]
    }

  def __init__(self,api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    self.api = api # type: AVNApi
    self.api.registerRestart(self.stop)
    self.api.registerEditableParameters(self.CONFIG,self.changeConfig)
    self.changeSequence=0
    self.socket=None

  def changeConfig(self,newValues):
    self.api.saveConfigValues(newValues)
    self.changeSequence+=1
    try:
      self.socket.close()
    except:
      pass

  def stop(self):
    self.changeSequence+=1
    try:
      self.socket.close()
    except:
      pass

  def run(self):
    while not self.api.shouldStopMainThread():
      self._runInternal()

  def _runInternal(self):
    sequence=self.changeSequence
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    port=2598
    sock=None
    host=self.api.getConfigValue('host','localhost')
    timeInterval=0.5
    try:
      port=self.api.getConfigValue('port','2598')
      port=int(port)
      timeInterval=float(self.api.getConfigValue('timeInterval','0.5'))
    except:
      self.api.log("exception while reading config values %s",traceback.format_exc())
      raise
    autoSendRMC=int(self.api.getConfigValue('autoSendRMC',"0"))
    handledPGNs=self.api.getConfigValue('timePGNs',self.DEFAULT_PGNS).split(',')
    if len(handledPGNs) < 1:
      self.api.log("no pgns to be handled, stopping plugin")
      self.api.setStatus("INACTIVE", "no pgns to be handled")
      return
    handledPGNs=[int(p) for p in handledPGNs]
    self.api.log("started with host=%s,port %d, autoSendRMC=%d"%(host,port,autoSendRMC))
    source=self.api.getConfigValue("sourceName",None)
    errorReported=False
    self.api.setStatus("STARTED", "connecting to n2kd at %s:%d"%(host,port))
    while sequence == self.changeSequence:
      try:
        self.socket = socket.create_connection((host, port),timeout=1000)
        self.api.setStatus("RUNNING", "connected to n2kd at %s:%d" %(host,port))
        hasNmea=False
        buffer=""
        lastTimeSet=self.api.timestampFromDateTime()
        while True:
          data = self.socket.recv(1024)
          if len(data) == 0:
            raise Exception("connection to n2kd lost")
          buffer = buffer + data.decode('ascii', 'ignore')
          lines = buffer.splitlines(True)
          if lines[-1][-1] == '\n':
            buffer=""
          else:
            if len(lines) > 0:
              buffer=lines.pop(-1)
            else:
              buffer=""
          for l in lines:
            try:
              msg=json.loads(l)
              errorReported=False
              #{"timestamp":"2016-02-28-20:32:48.226","prio":3,"src":27,"dst":255,"pgn":126992,"description":"System Time","fields":{"SID":117,"Source":"GPS","Date":"2016.02.28", "Time": "19:57:46.05000"}}
              if msg.get('pgn') in handledPGNs:
                #currently we can decode messages that have a Date and Time field set
                now = self.api.timestampFromDateTime()
                if now < lastTimeSet or now > (lastTimeSet+timeInterval):
                  fields = msg.get('fields')
                  if fields is not None:
                    cdate = fields.get('Date')
                    ctime = fields.get('Time')
                    dt=None
                    if cdate is not None and ctime is not None:
                      tsplit = ctime.split(".")
                      dt = datetime.datetime.strptime(cdate + " " + tsplit[0], "%Y.%m.%d %H:%M:%S")
                      if len(tsplit) > 1:
                        dt += datetime.timedelta(seconds=float("0." + tsplit[1]))
                    if dt is not None:
                      if not hasNmea:
                        self.api.log("received time %s"%dt.isoformat())
                        self.api.setStatus("NMEA", "valid time")
                        hasNmea=True
                      self.api.addData(self.PATH,self.formatTime(dt))
                      lastTimeSet=now
                      if autoSendRMC > 0:
                        lastRmc=self.api.getSingleValue("internal.last.RMC",includeInfo=True)
                        if lastRmc is None or lastRmc.timestamp < (now - autoSendRMC) or (lastRmc.timestamp > now) :
                          lat=self.api.getSingleValue("gps.lat")
                          lon=self.api.getSingleValue("gps.lon")
                          if lat is not None and lon is not None:
                            speed=self.api.getSingleValue("gps.speed")
                            cog=self.api.getSingleValue("gps.track")
                            self.api.debug("generating RMC lat=%f,lon=%f,ts=%s",lat,lon,dt.isoformat())
                            # $--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,xxxx,x.x,a*hh
                            fixutc="%02d%02d%02d.%02d"%(dt.hour,dt.minute,dt.second,dt.microsecond/1000)
                            (latstr,NS)=self.nmeaFloatToPos(lat,True)
                            (lonstr,EW)=self.nmeaFloatToPos(lon,False)
                            speedstr="" if speed is None else "%.2f"%(speed*3600/self.NM)
                            year="%04d"%dt.year
                            datestr="%02d%02d%s"%(dt.day,dt.month,year[-2:])
                            cogstr="" if cog is None else "%.2f"%cog
                            record="$GPRMC,%s,A,%s,%s,%s,%s,%s,%s,%s,,,A"%(fixutc,latstr,NS,lonstr,EW,speedstr,cogstr,datestr)
                            self.api.addNMEA(record,addCheckSum=True,source=source)

              #add other decoders here
            except:
              self.api.log("unable to decode json %s:%s"%(l,traceback.format_exc()))
            pass
          if len(buffer) > 4096:
            raise Exception("no line feed in long data, stopping")
      except Exception as e:
        if not errorReported:
          self.api.setStatus("ERROR","connecting to n2kd %s:%d: %s"%(host,port,str(e)))
          errorReported=True
        if sock is not None:
          try:
            sock.close()
          except:
            pass
          sock=None
        self.api.setStatus("STARTED", "connecting to n2kd at %s:%d" % (host, port))
        if sequence != self.changeSequence:
          return
        time.sleep(2)

  def formatTime(self,ts):
    t = ts.isoformat()
    # seems that isoformat does not well harmonize with OpenLayers.Date
    # they expect at leas a timezone info
    # as we are at GMT we should have a "Z" at the end
    if not t[-1:] == "Z":
      t += "Z"
    return t

  def nmeaFloatToPos(self,pos,isLat):
    '''return a tuple (string,direction) from a position'''
    if pos is None:
      return ("","")
    dir='N' if isLat else 'E'
    if pos < 0:
      dir = 'S' if isLat else 'W'
      pos=-pos
    deg = int(pos)
    min = 60*pos - 60 * deg
    if isLat:
      rt="%02d%05.2f"%(deg,min)
    else:
      rt = "%03d%05.2f" % (deg, min)
    return(rt,dir)







