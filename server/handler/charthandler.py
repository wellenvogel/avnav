# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012...2020 Andreas Vogel andreas@wellenvogel.net
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
import json
import shutil
import urllib.request, urllib.parse, urllib.error


import avnav_handlerList
import gemf_reader
import mbtiles_reader
from avnav_util import *
from avnav_worker import WorkerStatus
from avndirectorybase import AVNDirectoryHandlerBase, AVNDirectoryListEntry


class XmlChartFile(ChartFile):
  def __init__(self,filename,isDir=False):
    self.filename=filename
    self.isDir=isDir

  def getTileData(self,tile,soure):
    raise Exception("no tile data for xml files")

  def getAvnavXml(self,upzoom=None):
    if not os.path.exists(self.filename):
      return None
    if self.isDir:
      ovname=os.path.join(self.filename,AVNUtil.NAVXML)
      if not os.path.exists(ovname):
        return None
    else:
      ovname=self.filename
    with open(ovname,"r",encoding='utf-8') as f:
      return f.read()

  def deleteFiles(self):
    if os.path.isfile(self.filename):
      return os.unlink(self.filename)
    if self.isDir and os.path.isdir(self.filename):
      shutil.rmtree(self.filename)

  def getDownloadFile(self):
    if self.isDir:
      return os.path.join(self.filename,AVNUtil.NAVXML)
    else:
      return self.filename

  def __str__(self):
    return "xml %s"%self.filename


class ChartDescription(AVNDirectoryListEntry):
    INT_PREFIX = "int"  # prefix for mbtiles,gemf
    OVL_EXT = ".cfg"

    def __init__(self,type,prefix,name,
                  keyPrefix=None,
                  sequence=None,
                  tokenUrl=None,
                  tokenFunction=None,
                  scheme=None,
                  originalScheme=None,
                  info=None,
                  infoMode=None,
                  eulaMode=None,
                  validTo=None,
                  version=None,
                  url=None,
                  icon=None,
                  hasFeatureInfo=None,
                  upzoom=None,
                 **kwargs):
      super(ChartDescription,self).__init__(type,prefix,name,**kwargs)
      self._chart=None
      self._data=None #either avnav or overlay
      self._isChart=True
      kp=self.INT_PREFIX if keyPrefix is None else keyPrefix
      self.canDownload= kp == self.INT_PREFIX
      self.canDelete = kp == self.INT_PREFIX
      self.chartKey=kp+"@"+name
      self.overlayConfig=AVNUtil.clean_filename(kp+"@"+name)+self.OVL_EXT
      self.sequence=sequence if sequence is not None else self.time
      self.tokenUrl=tokenUrl
      self.tokenFunction=tokenFunction
      self.scheme=scheme
      self.originalScheme=originalScheme
      self.info=info
      self.infoMode=infoMode
      self.eulaMode=eulaMode
      self.validTo=validTo
      self.version=version
      self.icon=icon
      self.hasFeatureInfo=hasFeatureInfo
      self.upzoom=upzoom
      self.hasImporterLog=False
      if url is not None:
        self.url=url


    def copy(self):
      """
      craete a copy for all simple types
      @return:
      """
      rt=ChartDescription(self.type,self.prefix,self.name)
      rt.__dict__=self.__dict__.copy()
      rt._chart=None
      rt._data=None
      return rt

    @classmethod
    def splitChartKey(cls,chartKey):
      """
      get the prefix and name from the chart key
      @param chartKey:
      @return:
      """
      if chartKey is None:
        return ("","")
      spl=chartKey.split("@",1)
      if len(spl) < 2:
        return (cls.INT_PREFIX,spl[0])
      return spl
    @classmethod
    def checkConfigName(self,configName):
      if configName is None:
        return False
      (path,ext)=os.path.splitext(configName)
      if ext != self.OVL_EXT:
        return False
      spl = configName.split("@")
      if len(spl) != 2:
        return False
      for i in [0,1]:
        if spl[i] != AVNUtil.clean_filename(spl[i]):
          return False
      return True

    def isChart(self):
      return self._isChart

    def getChart(self):
      return self._chart

    def _fillFromChart(self,upzoom):
      if self._chart is None:
        return
      self._data = self._chart.getAvnavXml(upzoom)
      self.sequence = self._chart.getChangeCount()
      self.scheme = self._chart.getScheme()
      self.originalScheme = self._chart.getOriginalScheme()

    def setChart(self,chart,upzoom=None):
      # type: (ChartFile, int) -> None
      self._chart=chart
      chart.open()
      self._isChart=True
      self._fillFromChart(upzoom)

    def reload(self,upzoom=None):
      self._fillFromChart(upzoom)


    def setOverlayData(self,data):
      self._isChart=False
      self._data=data
      self.chartKey=self.name

    def getData(self):
      return self._data

    def close(self):
      if not self._isChart:
        return
      if self._chart is None:
        return
      return self._chart.close()

    def getKey(self):
      return self.name

    def isOwnChart(self):
      return self.isChart() and self.chartKey.startswith(self.INT_PREFIX+"@")

    def replaceParameters(self,parameters):
      for k in list(self.__dict__.keys()):
        if k.startswith("_"):
          continue
        v=self.__dict__[k]
        if not isinstance(v,str) and not isinstance(v,str):
          continue
        self.__dict__[k]=AVNUtil.replaceParam(v,parameters)

class ExternalProvider(object):
  charts = None
  REPLACE_LATER="##REPLACE_LATER##"

  def __init__(self,prefix,providerName,callback):
    self.providerName=providerName
    self.callback=callback
    self.prefix=prefix
    self.charts={}

  def _externalChartToDescription(self,ext):
    filteredExt=dict((key,value)
                for key,value in ext.items()
                if key != 'name' and key != 'keyPrefix')
    return ChartDescription('chart',self.prefix,ext['name'],
                                      keyPrefix=self.providerName,
                                      **(filteredExt)
                                      )
  def queryProvider(self):
    if self.callback is None:
      self.charts={}
      return
    extList = []
    extList.extend(self.callback("$"+self.REPLACE_LATER))
    newChartList={}
    for e in extList:
      extEntry = self._externalChartToDescription(e)
      newChartList[extEntry.chartKey]=extEntry
    self.charts=newChartList

  def getList(self,hostip):
    rt=[]
    for chart in list(self.charts.values()):
      chartCopy=chart.copy() #type: ChartDescription
      chartCopy.replaceParameters({self.REPLACE_LATER:hostip})
      rt.append(chartCopy)
    return rt

  def getChartByKey(self,chartKey,makeCopy=False):
    rt=self.charts.get(chartKey)
    if rt is None:
      return None
    if not makeCopy:
      return rt
    return rt.copy()


class AVNChartHandler(AVNDirectoryHandlerBase):
  """a worker to check the chart dirs
  """
  externalProviders = None
  itemList = None
  PATH_PREFIX="/chart"
  DEFAULT_CHART_CFG="default.cfg"
  ALLOWED_EXTENSIONS=[".gemf",".mbtiles",".xml",ChartDescription.OVL_EXT]
  def __init__(self,param):
    self.param=param
    self.externalProviders={}
    self.importer=None
    AVNDirectoryHandlerBase.__init__(self, param,'chart')
  @classmethod
  def getConfigName(cls):
    return "AVNChartHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'period': 5, #how long to sleep between 2 checks
            'upzoom': 2 #zoom up in charts
    }


  @classmethod
  def autoInstantiate(cls):
    return True

  @classmethod
  def getListEntryClass(cls):
    return ChartDescription

  @classmethod
  def getPrefix(cls):
    return cls.PATH_PREFIX

  @classmethod
  def autoScanIncludeDirectories(cls):
    return True

  @classmethod
  def getAutoScanExtensions(cls):
    return cls.ALLOWED_EXTENSIONS

  def getSleepTime(self):
    rt=self.getFloatParam('period')
    if rt == 0:
      rt=30
    return rt

  def run(self):
    self.baseDir = self.httpServer.getChartBaseDir()
    self.importer = self.findHandlerByName("AVNImporter")
    super().run()

  def wakeUp(self):
    super().wakeUp()
    #we need to wake all threads that are sitting at conditions
    for item in list(self.itemList.values()):
      chart=item.getChart()
      if isinstance(chart,ChartFile):
        try:
          chart.wakeUp()
        except:
          pass

  def periodicRun(self):
    if self.baseDir is None or not os.path.isdir(self.baseDir):
      self.setInfo("main", "directory %s not found" % self.baseDir, WorkerStatus.ERROR)
      AVNLog.error("unable to find a valid chart directory %s" % (self.baseDir))
    else:
      self.setInfo("main", "handling directory %s, %d charts" % (self.baseDir, len(self.itemList)),
                   WorkerStatus.NMEA)
    for extProvider in list(self.externalProviders.keys()):
      self.externalProviders[extProvider].queryProvider()

  def onItemAdd(self, itemDescription):
    # type: (ChartDescription) -> ChartDescription or None
    if itemDescription is None:
      return None
    try:
      fullname=os.path.join(self.baseDir,itemDescription.name)
      chart=None
      if itemDescription.isDirectory:
        if not os.path.exists(os.path.join(fullname, AVNUtil.NAVXML)):
          return None
        chart = XmlChartFile(fullname, True)
      else:
        if fullname.endswith(".gemf"):
          chart = gemf_reader.GemfFile(fullname)
        elif fullname.endswith(".mbtiles"):
          chart = mbtiles_reader.MBTilesFile(fullname)
        elif fullname.endswith(".xml"):
          chart = XmlChartFile(fullname)
      if chart is None:
        if not fullname.endswith(ChartDescription.OVL_EXT):
          return None
        with open(fullname, "r",encoding='utf-8') as f:
          ovl = json.load(f)
          itemDescription.setOverlayData(ovl)
      else:
        itemDescription.setChart(chart,self.getIntParam('upzoom'))
      itemDescription.upzoom=True
      if self.importer is not None:
        logName=self.importer.getLogFileName(itemDescription.name,checkExistance=True)
        if logName is not None:
          itemDescription.hasImporterLog=True
      return itemDescription  
    except Exception as e:
      AVNLog.error("error opening chart %s:%s",itemDescription.name,traceback.format_exc())
      

  def handleDownload(self, name, handler, requestparam):
    chartDescription=self.itemList.get(name)
    if chartDescription is None:
      raise Exception("chart %s not found for download",name)
    return super(AVNChartHandler, self).handleDownload(name, handler, requestparam)

  def onItemRemove(self, itemDescription):
    # type: (ChartDescription) -> None
    if itemDescription.isChart():
      itemDescription.getChart().close()

  def deleteFromOverlays(self,type,name):
    """
    delete an entry from overlays
    @param type: the type of overlay
    @param name: tha name (for charts this is the chartKey)
    @return:
    """
    numChanged=0
    for info in list(self.itemList.values()):
      if info.isChart():
        continue
      overlayConfig=info.getData()
      overlays=overlayConfig.get('overlays')
      isModified=False
      if overlays is not None:
        newOverlays=[]
        for overlay in overlays:
          if overlay.get('type') != type:
            newOverlays.append(overlay)
            continue
          overlayName=overlay.get('name') if type != 'chart' else overlay.get('chartKey')
          if overlayName == name:
            AVNLog.debug("removing overlay entry %s from %s",name,info.name)
            isModified=True
          else:
            newOverlays.append(overlay)
        if isModified:
          numChanged+=1
          overlayConfig['overlays']=newOverlays
          try:
            with open(os.path.join(self.baseDir,info.name),"w",encoding='utf-8') as f:
              f.write(json.dumps(overlayConfig,indent=2))
              f.close()
          except Exception as e:
            AVNLog.error("unable to write overlay config %s:%s",info.name,traceback.format_exc())
    if numChanged > 0:
      self.wakeUp()
    return numChanged

  def handleDelete(self,name):
    chartEntry=self.itemList.get(name)
    if chartEntry is None:
      raise Exception("item %s not found"%name)
    if not chartEntry.canDelete:
      raise Exception("delete for %s not possible" % name)
    self.removeItem(name)
    if chartEntry.isChart():
      if self.importer is not None:
        self.importer.deleteImport(chartEntry.name)
      chartEntry.getChart().deleteFiles()
      #for our own files we can safely delete the config...
      #as it is unique for a chart
      configEntry=self.itemList.get(chartEntry.overlayConfig)
      if configEntry is not None:
        os.unlink(os.path.join(self.baseDir,configEntry.name))
        self.removeItem(configEntry.getKey())
      self.deleteFromOverlays('chart',chartEntry.chartKey)
    else:
      os.unlink(os.path.join(self.baseDir,chartEntry.name))
    self.wakeUp()
    return AVNUtil.getReturnData()

  def handleRename(self, name, newName, requestparam):
    return AVNUtil.getReturnData(error="rename not supported for charts")

  def handleUpload(self, name, handler, requestparam):
    if name is None:
      return AVNUtil.getReturnData(error="missing name")
    (path,ext)=os.path.splitext(name)
    if ext not in self.ALLOWED_EXTENSIONS:
      return AVNUtil.getReturnData(error="unknown file type %s"%ext)
    rt=super(AVNChartHandler, self).handleUpload(name, handler, requestparam)
    return rt

  def handleList(self, handler=None):
    hostip=self.getRequestIp(handler)
    clist=[entry for entry in list(self.itemList.values()) if entry.isChart()]
    for provider in list(self.externalProviders.values()):
      clist.extend(provider.getList(hostip))
    return AVNUtil.getReturnData(items=clist)


  def getPathFromUrl(self, path, handler=None, requestParam=None):
    parts=path.split("/")
    if len(parts) < 1:
      raise Exception("invalid chart request %s"%path)
    name=parts[0]
    chartDescription=self.itemList.get(name)
    if chartDescription is None or not chartDescription.isChart():
      raise Exception("chart %s not found"%name)
    if len(parts) < 2:
      return os.path.join(self.baseDir,name) #direct chart download
    AVNLog.debug("chart file %s, request %s, lend=%d",chartDescription.name,
                 path,len(parts))
    #found file
    #basically we can today handle 2 types of requests:
    #get the overview /chart/int/<name>/avnav.xml
    #get a tile /chart/int/<name>/<srcname>/z/x/y.png
    if parts[1] == AVNUtil.NAVXML:
      AVNLog.debug("avnav request for chart %s",chartDescription.name)
      data=chartDescription.getData()
      handler.writeData(data, "text/xml", )
      return True
    if parts[1] == "sequence":
      rsp={'status':'OK','sequence':chartDescription.getChart().getChangeCount()}
      handler.sendNavResponse(json.dumps(rsp))
      return True
    if len(parts) != 5:
      raise Exception("invalid request to chart file %s: %s" %(chartDescription.name,path))
    data=chartDescription.getChart().getTileData((int(parts[2]),int(parts[3]),int(parts[4].replace(".png",""))),parts[1])
    if data is None:
      handler.send_error(404,"File %s not found"%(path))
      return True
    handler.writeData(data, "image/png", )
    return True

  def getChartDescriptionByKey(self, chartKey, requestIp="localhost"):
    '''
    find a chart by given key
    @param chartKey:
    @param requestIp:
    @return: a tuple (prefix,chart) or None
    '''
    if chartKey is None:
      return None
    ckp=ChartDescription.splitChartKey(chartKey)
    if ckp[0] == ChartDescription.INT_PREFIX:
      #internal chart
      for chart in list(self.itemList.values()):
        if chart.chartKey == chartKey:
          return chart.serialize()
      return None
    provider=self.externalProviders.get(ckp[0])
    if provider is None:
      return None
    chart=provider.getChartByKey(chartKey,True)
    if chart is None:
      return None
    chart.replaceParameters({ExternalProvider.REPLACE_LATER:requestIp})
    return chart.serialize()

  def _legacyNameFromUrl(self,url):
    if url is None:
      return None
    if url[0] == "/":
      url=url[1:]
    if not url.startswith(self.getPrefix()+"/"):
      return None
    url=url[len(self.getPrefix())+1:]
    parts=url.split("/")
    if len(parts) < 1 or len(parts)>1:
      return None
    return urllib.parse.unquote(parts[0])

  def handleSpecialApiRequest(self, command, requestparam, handler):
    hostip=self.getRequestIp(handler)
    name=AVNUtil.getHttpRequestParam(requestparam, "name")
    if not name:
      name=self._legacyNameFromUrl(AVNUtil.getHttpRequestParam(requestparam, "url"))
    try:
      if (command == "scheme"):
        if name is None:
          return AVNUtil.getReturnData(error="missing name/url")
        scheme = AVNUtil.getHttpRequestParam(requestparam, "newScheme", True)
        chartEntry = self.itemList.get(name)
        if chartEntry is None or not chartEntry.isChart():
          return AVNUtil.getReturnData(error="chart %s not found"%name)
        changed = chartEntry.getChart().changeScheme(scheme)
        if changed:
          chartEntry.reload(self.getIntParam('upzoom'))
        return AVNUtil.getReturnData()
      if (command == "getConfig"):
        configName = AVNUtil.getHttpRequestParam(requestparam, "overlayConfig", True)
        expandCharts = AVNUtil.getHttpRequestFlag(requestparam, "expandCharts", False)
        mergeDefault = AVNUtil.getHttpRequestFlag(requestparam, "mergeDefault", False)
        rt={}
        if configName == self.DEFAULT_CHART_CFG:
          mergeDefault=False
        overlay=self.itemList.get(configName)
        if overlay is None:
          if configName != self.DEFAULT_CHART_CFG and not ChartDescription.checkConfigName(configName):
            return AVNUtil.getReturnData(error="invalid config name")
          rt={'name': configName}
        else:
          if overlay.isChart():
            return AVNUtil.getReturnData(error="invalid config")
          rt = overlay.getData().copy()
        default = {}
        if mergeDefault:
          defaultCfg = self.itemList.get(self.DEFAULT_CHART_CFG)
          if defaultCfg is not None:
            default=defaultCfg.getData()
            if default.get('overlays') is not None:
              rt['defaults'] = []+default['overlays']
        if expandCharts:
          noMerge = ['type', 'chartKey', 'opacity', 'chart']
          for ovlname in ['defaults', 'overlays']:
            overlays = rt.get(ovlname)
            if overlays is not None:
              newOverlays=[]
              for overlay in overlays:
                if overlay.get('type') == 'chart':
                  # update with the final chart config
                  chartDescription=self.getChartDescriptionByKey(overlay.get('chartKey'),hostip)
                  if chartDescription is not None:
                    overlay.update(dict([k_v for k_v in list(chartDescription.items()) if k_v[0] not in noMerge]))
                    newOverlays.append(overlay)
                else:
                  newOverlays.append(overlay)
              rt[ovlname]=newOverlays
        else:
          rt = default
        rt['name'] = configName
        return AVNUtil.getReturnData(data=rt)
      if command == 'listOverlays':
        rt=[item for item in list(self.itemList.values()) if not item.isChart()]
        return AVNUtil.getReturnData(data=rt)
      if command == 'deleteFromOverlays':
        if name is None:
          return AVNUtil.getReturnData(error="missing name")
        type=AVNUtil.getHttpRequestParam(requestparam,'itemType')
        rt=self.deleteFromOverlays(type,name)
        return AVNUtil.getReturnData()
    except Exception as e:
      return AVNUtil.getReturnData(error=str(e))
    return super(AVNChartHandler, self).handleSpecialApiRequest(command, requestparam, handler)

  def registerExternalProvider(self,name,callback):
    AVNLog.info("registering external chart provider %s",name)
    if callback is not None:
      self.externalProviders[name]=ExternalProvider(
        self.getPrefix(),name,callback)
      self.wakeUp()
    else:
      if self.externalProviders.get(name):
        try:
          del self.externalProviders[name]
        except:
          pass

avnav_handlerList.registerHandler(AVNChartHandler)
