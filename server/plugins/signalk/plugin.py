import datetime
import json
import sys
import time
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
import traceback
import urllib

from avnav_api import AVNApi


class Plugin:
  PATH="gps.signalk"

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
      'description': 'a plugin that fetches vessels data from signalk',
      'version': '1.0',
      'config':[
        {
          'name':'enabled',
          'description':'set to true to enable plugin',
          'default':'false'
        },
        {
          'name':'port',
          'description':'set to signalk port',
          'default':'3000'
        },
        {
          'name':'period',
          'description':'query period in ms',
          'default':'1000'
        }
      ],
      'data': [
        {
          'path': cls.PATH+".*",
          'description': 'vessels data from signalk',
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
    port=3000
    period=1000
    try:
      port=self.api.getConfigValue('port','3000')
      port=int(port)
      period=self.api.getConfigValue('period','1000')
      period=int(period)
    except:
      self.api.log("exception while reading config values %s",traceback.format_exc())
      raise
    self.api.log("started with port %d, period %d"%(port,period))
    baseUrl="http://localhost:%d/signalk"%port
    self.api.registerUserApp("http://$HOST:%s"%port,"signalk.svg")
    self.api.registerLayout("example","example.json")
    errorReported=False
    while True:
      apiUrl=None
      self.api.setStatus("STARTED", "connecting at %s"%baseUrl)
      while apiUrl is None:
        responseData=None
        try:
          response=urllib.urlopen(baseUrl)
          if response is None:
            raise Exception("no response on %s"%baseUrl)
          responseData=json.loads(response.read())
          if responseData is None:
            raise Exception("no response on %s"%baseUrl)
          #{"endpoints":{"v1":{"version":"1.20.0","signalk-http":"http://localhost:3000/signalk/v1/api/","signalk-ws":"ws://localhost:3000/signalk/v1/stream","signalk-tcp":"tcp://localhost:8375"}},"server":{"id":"signalk-server-node","version":"1.20.0"}}
          endpoints = responseData.get('endpoints')
          if endpoints is None:
            raise Exception("no endpoints in response to %s"%baseUrl)
          for k in endpoints.keys():
            ep=endpoints[k]
            apiUrl=ep.get('signalk-http')
            if apiUrl is not None:
              errorReported=False
              break
        except:
          if not errorReported:
            self.api.log("unable to connect at url %s: %s" % (baseUrl, sys.exc_info()[0]))
            errorReported=True
          time.sleep(1)
          continue
        if apiUrl is None:
          time.sleep(1)
        else:
          self.api.log("found api url %s",apiUrl)
      apiUrl=apiUrl+"vessels/self"
      self.api.setStatus("NMEA", "connected at %s" % apiUrl)
      try:
        while True:
          response=urllib.urlopen(apiUrl)
          if response is None:
            raise Exception("unable to fetch from %s:%s",apiUrl,sys.exc_info()[0])
          data=json.loads(response.read())
          self.api.debug("read: %s",json.dumps(data))
          self.storeData(data,self.PATH)
          name=data.get('name')
          if name is not None:
            self.api.addData(self.PATH+".name",name)
          time.sleep(float(period)/1000.0)
      except:
        self.api.log("error when fetching from signalk %s: %s",apiUrl,traceback.format_exc())
        time.sleep(5)

  def storeData(self,node,prefix):
    if 'value' in node:
      self.api.addData(prefix, node.get('value'), 'signalk')
      return
    for key, item in node.items():
      if isinstance(item,dict):
        self.storeData(item,prefix+"."+key)








