import datetime
import socket
import struct
import time
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
import traceback
from pyroute2.netlink.taskstats import tstats

from avnav_api import AVNApi


class Plugin:
  PATH="gps.time"
  CONFIG = [
    {
      'name': 'enabled',
      'description': 'set to true to enable plugin',
      'default': 'false'
    },
    {
      'name': 'host',
      'description': 'the ntp server to be queried',
      'default': 'pool.ntp.org'
    },
    {
      'name': 'interval',
      'description': 'check interval in seconds',
      'default': '10'
    },
    {
      'name': 'initialWait',
      'description': 'initial wait in seconds',
      'default': '60'
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
      'description':
        '''a plugin to set the time from an ntp server if no time is availble internally
           you need to set allowKeyOverwrite and enabled in the plugin config
        ''',
      'data': [
        {
          'path': cls.PATH,
          'description': 'internal time in AvNav',
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
    self.config={}



  def run(self):
    """
    the run method
    this will be called after successfully instantiating an instance
    this method will be called in a separate Thread
    The example simply counts the number of NMEA records that are flowing through avnav
    and writes them to the store every 10 records
    @return:
    """
    enabled = self.api.getConfigValue('enabled', 'true')
    if enabled.lower() != 'true':
      self.api.setStatus("INACTIVE", "module not enabled in server config")
      self.api.error("module disabled")
      return
    for cfg in self.CONFIG:
      v=self.api.getConfigValue(cfg['name'],cfg['default'])
      if v is None:
        self.api.error("missing config value %s"%cfg['name'])
        self.api.setStatus("INACTIVE", "missing config value %s"%cfg['name'])
        return
      self.config[cfg['name']]=v

    self.api.setStatus("INACTIVE", "initial wait")
    self.api.log("started")
    interval=10
    initialWait=120
    try:
      interval=int(self.config['interval'])
    except:
      self.api.error("invalid interval %s" % self.config['interval'])
      self.api.setStatus("INACTIVE", "missing config value %s" % self.config['interval'])
      return
    try:
      initialWait=int(self.config['initialWait'])
    except:
      self.api.error("invalid initialWait %s" % self.config['initialWait'])
      self.api.setStatus("INACTIVE", "missing config value %s" % self.config['initialWait'])
      return
    sourceName="plugin-ntptime"
    hasTime=True
    hasError=False
    time.sleep(initialWait)
    self.api.setStatus("STARTED", "watching")
    while True:
      time.sleep(interval)
      internalTime=self.api.getSingleValue(self.PATH,True)
      if internalTime is None or internalTime.source == sourceName:
        if hasTime:
          self.api.log("no time in gps data, try to query %s",self.config['host'])
          self.api.setStatus("NMEA","querying time from %s"%self.config['host'])
          hasTime=False
        ntpTime=self.queryNtp(self.config['host'])
        if ntpTime is None:
          if not hasError:
            self.api.error("unable to get ntp time from %s",self.config['host'])
            self.api.setStatus("ERROR", "unable to query time from %s" % self.config['host'])
            hasError=True
        else:
          hasError=False
          self.api.setStatus("NMEA", "querying time from %s" % self.config['host'])
          tstring= ntpTime.isoformat()
          # seems that isoformat does not well harmonize with OpenLayers.Date
          # they expect at leas a timezone info
          # as we are at GMT we should have a "Z" at the end
          if not tstring[-1:] == "Z":
            tstring += "Z"
          self.api.debug("set ntp time to %s",tstring)
          self.api.addData(self.PATH,tstring,source=sourceName)
      else:
        self.api.setStatus("STARTED", "watching")
        hasTime=True
        hasError=False



  def queryNtp(self,host,timeout=30):
    '''
    https://www.mattcrampton.com/blog/query_an_ntp_server_from_python/
    @param host:
    @return:
    '''
    port = 123
    buf = 1024
    address = (host, port)
    msg = '\x1b' + 47 * '\0'

    # reference time (in seconds since 1900-01-01 00:00:00)
    TIME1970 = 2208988800  # 1970-01-01 00:00:00

    # connect to server
    client = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    client.settimeout(timeout)
    try:
      client.sendto(msg.encode('utf-8'), address)
      msg, address = client.recvfrom(buf)

      t = struct.unpack("!12I", msg)[10]
      t -= TIME1970
      rt=datetime.datetime.utcfromtimestamp(t)
      return rt
    except:
      self.api.error("exception querying ntp server %s: %s",host,traceback.format_exc())
    return None