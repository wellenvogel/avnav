import datetime
import json
import re
import sys
import time
#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
import traceback
import urllib

from avnav_api import AVNApi


class Plugin:
  PATH="gps.signalk"
  CHARTNAME_PREFIX="sk-"
  AVNAV_XML="""<?xml version="1.0" encoding="UTF-8" ?>
  <TileMapService version="1.0.0" >
   <Title>%(title)s</Title>
   <TileMaps>
     <TileMap 
       title="%(title)s" 
       href="%(url)s"
       minzoom="%(minzoom)s"
       maxzoom="%(maxzoom)s"
       projection="EPSG:4326">
             <BoundingBox minlon="9" minlat="50" maxlon="20" maxlat="60" title="layer"/>
       <TileFormat width="256" height="256" mime-type="x-png" extension="png" />
    </TileMap>       
   </TileMaps>
 </TileMapService>

  """

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
          'name': 'host',
          'description': 'set to signalk host',
          'default': 'localhost'
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
    self.api.registerRequestHandler(self.requestHandler)
    self.skCharts=[]
    self.connected=False



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
    host='localhost'
    try:
      port=self.api.getConfigValue('port','3000')
      port=int(port)
      period=self.api.getConfigValue('period','1000')
      period=int(period)
      host=self.api.getConfigValue('host','localhost')
    except:
      self.api.log("exception while reading config values %s",traceback.format_exc())
      raise
    self.api.log("started with port %d, period %d"%(port,period))
    baseUrl="http://%s:%d/signalk"%(host,port)
    self.api.registerUserApp("http://$HOST:%s"%port,"signalk.svg")
    self.api.registerLayout("example","example.json")
    self.api.registerChartProvider(self.listCharts)
    errorReported=False
    while True:
      apiUrl=None
      self.api.setStatus("STARTED", "connecting at %s"%baseUrl)
      while apiUrl is None:
        self.connected=False
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
      selfUrl=apiUrl+"vessels/self"
      self.api.setStatus("NMEA", "connected at %s" % apiUrl)
      try:
        while True:
          response=urllib.urlopen(selfUrl)
          if response is None:
            self.skCharts=[]
            raise Exception("unable to fetch from %s:%s",selfUrl,sys.exc_info()[0])
          data=json.loads(response.read())
          self.api.debug("read: %s",json.dumps(data))
          self.storeData(data,self.PATH)
          self.connected=True
          name=data.get('name')
          if name is not None:
            self.api.addData(self.PATH+".name",name)
          try:
            charturl=apiUrl+"resources/charts"
            chartlistResponse=urllib.urlopen(charturl)
            if chartlistResponse is None:
              self.skCharts=[]
              continue
            chartlist=json.loads(chartlistResponse.read())
            newList=[]
            baseUrl=self.api.getApiUrl()+"/charts/"
            for chart in chartlist.values():
              name=chart.get('identifier')
              if name is None:
                continue
              name=self.CHARTNAME_PREFIX+name
              url=baseUrl+urllib.quote(name)
              chartInfo={
                'name':name,
                'url': url,
                'charturl': url,
                'sequence':0, #TODO
                'canDelete': False,
                'internal':{
                  'url': "http://%s:%d"%(host,port)+chart.get('tilemapUrl'),
                  'bounds': chart.get('bounds'),
                  'minzoom': chart.get('minzoom'),
                  'maxzoom': chart.get('maxzoom')
                }
              }
              newList.append(chartInfo)
            self.skCharts=newList
          except Exception as e:
            self.skCharts=[]
            self.api.debug("exception while reading chartlist %s",traceback.format_exc())
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

  def listCharts(self,hostip):
    self.api.debug("listCharts %s"%hostip)
    if not self.connected:
      self.api.debug("not yet connected")
      return []
    try:
      rt=[]
      items=self.skCharts+[]
      for item in items:
        cp=item.copy()
        del cp['internal']
        rt.append(cp)
      return rt
    except:
      self.api.debug("unable to list charts: %s"%traceback.format_exc())
      return []

  def requestHandler(self,url,handler,args):
    '''
    handle api requests
    @param url:
    @param handler:
    @param args:
    @return:
    '''
    if url.startswith("charts/"):
      chart=url[len("charts/"):]
      parr=chart.split("/")
      if len(parr) < 2:
        raise Exception("invalid chart url %s"%url)
      chartName = parr[0]
      chart=None
      for chartinfo in self.skCharts:
        if chartinfo.get('name')==chartName:
          chart=chartinfo
          break
      if chart is None:
        raise Exception("chart %s not found"%chartName)
      if parr[1] == "avnav.xml":
        data=self.AVNAV_XML%{
          'title':chart['name'],
          'url':'tiles',
          'minzoom':chart['internal'].get('minzoom'),
          'maxzoom':chart['internal'].get('maxzoom')
        }
        handler.send_response(200)
        handler.send_header("Content-type", "text/xml")
        handler.send_header("Content-Length", len(data))
        handler.send_header("Last-Modified", handler.date_time_string())
        handler.end_headers()
        handler.wfile.write(data)
        return True
      if parr[1] == "sequence":
        return {'status':'OK','sequence':0}
      if len(parr) < 5:
        raise Exception("invalid request to chart %s: %s" % (chartName, url))
      replaceV={'z':parr[2],
                'x':parr[3],
                'y':re.sub("\..*","",parr[4])}
      skurl=chart['internal']['url']
      for k in replaceV.keys():
        skurl=re.sub("{"+k+"}",replaceV[k],skurl)
      try:
        tile = urllib.urlopen(skurl)
        if tile is None:
          return None
        tileData = tile.read()
      except:
        self.api.debug("unable to read tile from sk %s:%s"%(url,traceback.format_exc()))
        return
      handler.send_response(200)
      handler.send_header("Content-type", "image/png")
      handler.send_header("Content-Length", len(tileData))
      handler.send_header("Last-Modified", handler.date_time_string())
      handler.end_headers()
      handler.wfile.write(tileData)
      return True





