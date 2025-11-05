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

import avnav_handlerList
import gemf_reader
import mbtiles_reader
from avnav_util import *
from avnav_worker import WorkerStatus
from avndirectorybase import AVNDirectoryHandlerBase, AVNDirectoryListEntry


class XmlChartFile(ChartFile):
  def __init__(self,filename,isDir=False):
    super().__init__()
    self.filename=filename
    self.isDir=isDir

  def getTileData(self,tile,soure):
    raise Exception("no tile data for xml files")

  def getAvnavXml(self):
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


class ExternalChart(ChartFile):
    def __init__(self, ext):
        super().__init__()
        self.ext=dict((key,value)
                for key,value in ext.items()
                if key != 'name' and key != 'keyPrefix')

    def mergeAdditions(self, item: dict[str, Any]):
        super().mergeAdditions(item)
        for k,v in self.ext.items():
            item[k]=v


class ExternalProvider(object):
  charts = None
  REPLACE_LATER="##REPLACE_LATER##"

  def __init__(self,prefix,providerName,callback):
    self.providerName=providerName
    self.callback=callback
    self.prefix=prefix
    self.charts={}

  def _externalChartToDescription(self,ext):
    key=ext.get('chartKey') or ext.get('name')
    return AVNDirectoryListEntry('chart',self.providerName+"@"+key,
                                      displayName=ext['name'],
                                    userData=ExternalChart(ext)
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
      newChartList[extEntry.name]=extEntry
    self.charts=newChartList

  def getList(self):
    return list(self.charts.values())

  def getChartByKey(self,chartKey,makeCopy=False):
    rt=self.charts.get(chartKey)
    if rt is None:
      return None
    if not makeCopy:
      return rt
    return rt.copy()

class OverlayData:
    def __init__(self,jsonData):
        self.jsonData=jsonData

class AVNChartHandler(AVNDirectoryHandlerBase):
  """a worker to check the chart dirs
  """
  SCOPE_USER = "int@"
  PATH_PREFIX="/chart"
  DEFAULT_CHART_CFG="default.cfg"
  OVL_EXT = ".cfg"
  ALLOWED_EXTENSIONS=[".gemf",".mbtiles",".xml",OVL_EXT]
  TYPE="chart"
  def __init__(self,param):
    super().__init__(param,self.TYPE)
    self.param=param
    self.externalProviders={}
    self.importer=None
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
    return AVNDirectoryListEntry

  @classmethod
  def getPrefix(cls):
    return cls.PATH_PREFIX

  def getSleepTime(self):
    rt=self.getFloatParam('period')
    if rt == 0:
      rt=30
    return rt

  def startInstance(self, navdata):
      super().startInstance(navdata)

  def run(self):
    self.baseDir = self.httpServer.getChartBaseDir()
    self.importer = self.findHandlerByName("AVNImporter")
    super().run()

  def wakeUp(self):
    super().wakeUp()
    #we need to wake all threads that are sitting at conditions
    for item in list(self.itemList.values()):
      chart=item.getUserData()
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
    newitems=[]
    removeditems=[]
    def itemAction(item,type):
        if type == 'add':
            #we must check the extensions here as we cannot provide them to listDirectory
            #this would remove the extensions from the name (what we do not want)
            (path,ext)=os.path.splitext(item.name)
            if not ext in self.ALLOWED_EXTENSIONS:
                return False
            if ext == self.OVL_EXT:
                #for overlays we do not prefix the file name as the scope is already part of it
                if item.name.startswith(self.SCOPE_USER):
                    item.name=item.name[len(self.SCOPE_USER):]
            newitems.append(item)
            return True
        elif type == 'remove':
            removeditems.append(item)
            return True
        return True
    with self.lock:
        newList=self.listDirAndCompare(self.baseDir,None,self.itemList,onItem=itemAction,scope=self.SCOPE_USER)
    for item in newitems:
        self.onItemAdd(item)
    for item in removeditems:
        self.onItemRemove(item)
    with self.lock:
        self.itemList=newList
  def onItemAdd(self, itemDescription):
    # type: (AVNDirectoryListEntry) -> bool
    if itemDescription is None:
      return False
    try:
      fullname=itemDescription.getFileName()
      chart=None
      if itemDescription.isDirectory:
        if not os.path.exists(os.path.join(fullname, AVNUtil.NAVXML)):
          return False
        chart = XmlChartFile(fullname, True)
      else:
        if fullname.endswith(".gemf"):
          chart = gemf_reader.GemfFile(fullname)
        elif fullname.endswith(".mbtiles"):
          chart = mbtiles_reader.MBTilesFile(fullname)
        elif fullname.endswith(".xml"):
          chart = XmlChartFile(fullname)
      if chart is None:
        if not fullname.endswith(self.OVL_EXT):
          return False
        with open(fullname, "r",encoding='utf-8') as f:
          ovl = json.load(f)
          itemDescription.setUserData(OverlayData(ovl))
      else:
        chart.setUpzoom(self.getIntParam('upzoom'))
        chart.open()
        itemDescription.setUserData(chart)
        itemDescription.displayName=itemDescription.name[len(self.SCOPE_USER):]
        itemDescription.url=self.getPrefix()+"/"+urllib.parse.quote(itemDescription.name)
        if self.importer is not None:
            logName=self.importer.getLogFileName(itemDescription.name,checkExistance=True)
            if logName is not None:
                chart.setHasImporterLog(True)
      return True
    except Exception as e:
      AVNLog.error("error opening chart %s:%s",itemDescription.name,traceback.format_exc())
      return False

  def getOverlayConfigName(self,itemDescription):
    if itemDescription is None:
      return None
    return AVNUtil.clean_filename(itemDescription.name) +self.OVL_EXT
  def handleDownload(self, name, handler, requestparam):
    chartDescription=self.itemList.get(name)
    if chartDescription is None:
      raise Exception("chart %s not found for download",name)
    return super()._download(chartDescription.getFileName())

  def onItemRemove(self, itemDescription):
    # type: (AVNDirectoryListEntry) -> None
    chart = itemDescription.getUserData()
    if isinstance(chart,ChartFile):
      chart.close()

  def deleteFromOverlays(self,type,name):
    """
    delete an entry from overlays
    @param type: the type of overlay
    @param name: tha name (for charts this is the chartKey)
    @return:
    """
    numChanged=0
    with self.lock:
        for info in self.itemList.values():
            userData=info.getUserData()
            if not isinstance(userData,OverlayData):
                continue
            overlayConfig=userData.jsonData
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
                  data=json.dumps(overlayConfig,indent=2).encode('utf-8')
                  self.writeAtomic(info.getFileName(),
                                   io.BytesIO(data),True)
                except Exception as e:
                  AVNLog.error("unable to write overlay config %s:%s",info.name,traceback.format_exc())
    if numChanged > 0:
      self.wakeUp()
    return numChanged

  def handleDelete(self,name):
    chartEntry=None
    chart=None
    with self.lock:
        chartEntry=self.itemList.get(name)
        if chartEntry is None:
            raise Exception("item %s not found"%name)
        if not chartEntry.canDelete:
            raise Exception("delete for %s not possible" % name)
        chart=chartEntry.getUserData() # type: ChartFile
        if not isinstance(chart,ChartFile):
            raise Exception("item %s is no chart - cannot delete",name)
        del self.itemList[name]
        overlayName=self.getOverlayConfigName(chartEntry)
        overlayConfig=self.itemList[overlayName]
        if overlayConfig is not None:
            try:
                del self.itemList[overlayName]
            except KeyError:
                pass
    if self.importer is not None:
        self.importer.deleteImport(chartEntry.name)
    chart.deleteFiles()
    if overlayConfig is not None:
        os.unlink(overlayConfig.getFileName())
    self.deleteFromOverlays('chart',chartEntry.name)
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
    name=self.checkName(name)
    filename=os.path.join(self.baseDir,name)
    rt=super()._upload(filename,handler,requestparam)
    return rt

  def entryToList(self,entry:AVNDirectoryListEntry):
      rt=entry.serialize()
      chart=entry.getUserData()
      rt['overlayConfig']=self.getOverlayConfigName(entry)
      rt['chartKey']=rt['name']
      chart.mergeAdditions(rt)
      return rt

  def replaceParameters(self, item,parameters):
      for k in item.keys():
          if k.startswith("_"):
              continue
          v = item[k]
          if not isinstance(v, str) and not isinstance(v, str):
              continue
          item[k] = AVNUtil.replaceParam(v, parameters)
  def handleList(self, handler=None):
    hostip=self.getRequestIp(handler)
    with self.lock:
        clist=[self.entryToList(entry) for entry in self.itemList.values() if isinstance(entry.getUserData(),ChartFile)]
        replacements={ExternalProvider.REPLACE_LATER:hostip}
        for provider in list(self.externalProviders.values()):
            plist=[]
            for item in provider.getList():
                le=self.entryToList(item)
                self.replaceParameters(le, replacements)
                clist.append(le)
    return AVNUtil.getReturnData(items=clist)


  def getPathFromUrl(self, path, handler=None, requestParam=None):
    parts=path.split("/")
    if len(parts) < 1:
      raise Exception("invalid chart request %s"%path)
    name=parts[0]
    chartDescription=self.itemList.get(name)
    if chartDescription is None or not isinstance(chartDescription.getUserData(),ChartFile):
      raise Exception("chart %s not found"%name)
    if len(parts) < 2:
      return chartDescription.getFileName() #direct chart download
    AVNLog.debug("chart file %s, request %s, lend=%d",chartDescription.name,
                 path,len(parts))
    chart=chartDescription.getUserData()
    #found file
    #basically we can today handle 2 types of requests:
    #get the overview /chart/int/<name>/avnav.xml
    #get a tile /chart/int/<name>/<srcname>/z/x/y.png
    if parts[1] == AVNUtil.NAVXML:
      AVNLog.debug("avnav request for chart %s",chartDescription.name)
      data=chart.getAvnavXml()
      handler.writeData(data, "text/xml", )
      return True
    if parts[1] == "sequence":
      rsp={'status':'OK','sequence':chart.getChangeCount()}
      handler.sendJsonResponse(json.dumps(rsp))
      return True
    if len(parts) != 5:
      raise Exception("invalid request to chart file %s: %s" %(chartDescription.name,path))
    data=chart.getTileData((int(parts[2]),int(parts[3]),int(parts[4].replace(".png",""))),parts[1])
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
    ckp=chartKey.split("@",1)
    if len(ckp) != 2:
        return None
    item=None
    if ckp[0] == self.SCOPE_USER:
      #internal chart
      with self.lock:
          item=self.itemList.get(chartKey)
    else:
        with self.lock:
            provider=self.externalProviders.get(ckp[0])
            if provider is None:
                return None
            item=provider.getChartByKey(chartKey,True)
    if item is None:
      return None
    rt=self.entryToList(item)
    self.replaceParameters(rt,{ExternalProvider.REPLACE_LATER:requestIp})
    return rt

  def checkConfigName(self, configName):
      if configName is None:
          return False
      (path, ext) = os.path.splitext(configName)
      if ext != self.OVL_EXT:
          return False
      spl = configName.split("@")
      if len(spl) != 2:
          return False
      for i in [0, 1]:
          if spl[i] != AVNUtil.clean_filename(spl[i]):
              return False
      return True
  def handleSpecialApiRequest(self, command, requestparam, handler):
    hostip=self.getRequestIp(handler)
    name=AVNUtil.getHttpRequestParam(requestparam, "name")
    try:
      if (command == "scheme"):
        if name is None:
          return AVNUtil.getReturnData(error="missing name/url")
        scheme = AVNUtil.getHttpRequestParam(requestparam, "newScheme", True)
        chartEntry = self.itemList.get(name)
        if chartEntry is None or not isinstance(chartEntry.getUserData(),ChartFile):
          return AVNUtil.getReturnData(error="chart %s not found"%name)
        changed = chartEntry.getUserData().changeScheme(scheme)
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
          if configName != self.DEFAULT_CHART_CFG and not self.checkConfigName(configName):
            return AVNUtil.getReturnData(error="invalid config name")
          rt={'name': configName}
        else:
          if not isinstance(overlay.getUserData(),OverlayData):
            return AVNUtil.getReturnData(error="invalid config")
          rt = overlay.getUserData().jsonData.copy()
        default = {}
        if mergeDefault:
          defaultCfg = self.itemList.get(self.DEFAULT_CHART_CFG)
          if defaultCfg is not None:
            default=defaultCfg.getUserData().jsonData
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
        rt=[item for item in list(self.itemList.values()) if isinstance(item.getUserData(),OverlayData)]
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
    if callback is not None:
      AVNLog.info("ChartHandler: registering external chart provider %s", name)
      with self.lock:
        self.externalProviders[name]=ExternalProvider(
            self.getPrefix(),name,callback)
      self.wakeUp()
    else:
      AVNLog.info("ChartHandler: deregistering external chart provider %s", name)
      with self.lock:
        if self.externalProviders.get(name):
            try:
                del self.externalProviders[name]
            except:
                pass

avnav_handlerList.registerHandler(AVNChartHandler)
