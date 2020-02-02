import datetime
import json
import socket
import sys
import time
import traceback
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it

from avnav_api import AVNApi


class Plugin:
  PATH="gps.time"

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
      'config':[
        {
          'name':'enabled',
          'description':'set to true to enable plugin',
          'default':'false'
        },
        {
          'name':'port',
          'description':'set to canbus json port',
          'default':'2598'
        }
      ],
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



  def run(self):
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    enabled = self.api.getConfigValue('enabled','false')
    if enabled.lower() != 'true':
      self.api.setStatus("INACTIVE","module not enabled in server config")
      self.api.log("module disabled")
      return
    port=2598
    sock=None
    host=self.api.getConfigValue('host','localhost')
    try:
      port=self.api.getConfigValue('port','2598')
      port=int(port)
    except:
      self.api.log("exception while reading config values %s",traceback.format_exc())
      raise
    self.api.log("started with host=%s,port %d"%(host,port))
    while True:
      self.api.setStatus("STARTED", "connecting to n2kd at %s:%d"%(host,port))
      try:
        sock = socket.create_connection((host, port),timeout=1000)
        self.api.setStatus("RUNNING", "connected to n2kd at %s:%d" %(host,port))
        hasNmea=False
        buffer=""
        while True:
          data = sock.recv(1024)
          if len(data) == 0:
            raise Exception("conenction to n2kd lost")
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
              #{"timestamp":"2016-02-28-20:32:48.226","prio":3,"src":27,"dst":255,"pgn":126992,"description":"System Time","fields":{"SID":117,"Source":"GPS","Date":"2016.02.28", "Time": "19:57:46.05000"}}
              if msg.get('pgn') == 126992:
                fields=msg.get('fields')
                if fields is not None:
                  cdate=fields.get('Date')
                  ctime=fields.get('Time')
                  if cdate is not None and ctime is not None:
                    tsplit=ctime.split(".")
                    dt=datetime.datetime.strptime(cdate+" "+tsplit[0],"%Y.%m.%d %H:%M:%S")
                    if len(tsplit) > 1:
                      dt+=datetime.timedelta(seconds=float("0."+tsplit[1]))
                    if not hasNmea:
                      self.api.log("received time %s"%dt.isoformat())
                      self.api.setStatus("NMEA", "valid time")
                      hasNmea=True
                    self.api.addData(self.PATH,self.formatTime(dt))
              #add other decoders here
            except:
              self.api.log("unable to decode json %s"%l)
            pass
          if len(buffer) > 4096:
            raise Exception("no line feed in long data, stopping")
      except:
        self.api.log("error connecting to n2kd %s:%d: %s",host,port,traceback.format_exc())
        if sock is not None:
          try:
            sock.close()
          except:
            pass
          sock=None
        self.api.setStatus("STARTED", "connecting to n2kd at %s:%d" % (host, port))
        time.sleep(5)

  def formatTime(self,ts):
    t = ts.isoformat()
    # seems that isoformat does not well harmonize with OpenLayers.Date
    # they expect at leas a timezone info
    # as we are at GMT we should have a "Z" at the end
    if not t[-1:] == "Z":
      t += "Z"
    return t







