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
import os
import shutil

import avnav_handlerList
import gemf_reader
import mbtiles_reader
from avnav_util import *
from avnav_worker import WorkerStatus, AVNWorker
from avndirectorybase import AVNDirectoryHandlerBase, AVNDirectoryListEntry

class ChartEntry(AVNDirectoryListEntry):
    def __init__(self, *args,hasOverlay=False,**kwargs):
        super().__init__(*args,**kwargs)
        self.hasOverlay=hasOverlay

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
    SCOPE_EXT = "ext@"
    def __init__(self, ext,prefix):
        super().__init__()
        self.ext=ext
        self._prefix=prefix

    def mergeAdditions(self, item: dict[str, Any]):
        super().mergeAdditions(item)
        for k,v in self.ext.items():
            if k != 'name' and k != 'keyPrefix' and k != 'chartKey':
                item[k]=v
    def buildKey(self):
        key = self.ext.get('chartKey') or self.ext.get('name')
        return self.SCOPE_EXT+self._prefix+'@'+key
    def buildAltKey(self):
        key = self.ext.get('name')
        if key is None:
            return None
        return self._prefix + '@' + key

class ExternalProvider(object):
  charts = None
  REPLACE_LATER="##REPLACE_LATER##"

  def __init__(self,prefix,providerName,callback):
    self.providerName=providerName
    self.callback=callback
    self.prefix=prefix
    self.charts={}

  def _externalChartToDescription(self,ext):
    echart=ExternalChart(ext,self.providerName)
    return ChartEntry('chart',echart.buildKey(),
                                      displayName=ext['name'],
                                    userData=echart
                                      )
  def queryProvider(self,itemCallback=None):
    if self.callback is None:
      self.charts={}
      return
    extList = []
    extList.extend(self.callback("$"+self.REPLACE_LATER))
    newChartList={}
    for e in extList:
      extEntry = self._externalChartToDescription(e)
      add=True
      if itemCallback is not None:
          add=itemCallback(extEntry)
      if add:
        newChartList[extEntry.name]=extEntry
    self.charts=newChartList

  def getList(self):
    return list(self.charts.values())

  def getChartByKey(self,chartKey):
    return self.charts.get(chartKey)

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
    self.ovlConfigs={}
    #we maintain maps to convert to and from the new keys
    #especially for external providers we use the chart key now to address in the map
    #and to build the overlay name
    self.ovlKeyToName={} #new ovl name to old ovl name
    self.ovlNameToKey={}
    self.nameToKey={} #old external chart name to new external chart name
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
    return ChartEntry

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
  def externalItemAdded(self,item):
      ovl=self.getOverlayConfig(item)
      if ovl is not None:
          item.hasOverlay=True
      return True

  def listDirAndCompare(self,includeDirs=False,previousItems=None,onItem=None) -> dict[str,AVNDirectoryListEntry]:
    '''
    read the directory and chack for changes
    lock is held
    :param includeDirs:
    :param previousItems:
    :param onItem:
    :param scope:
    :return:
    '''
    newContent = self.listDirectory(includeDirs,self.baseDir,scope=self.SCOPE_USER)
    rt={}
    overlays={}
    for f in newContent:
        if f.name.endswith(self.OVL_EXT):
            f.name=f.name[len(self.SCOPE_USER):] #when reading the directory the scope is prepended to names
            overlays[f.name]=f
    self.ovlConfigs=overlays
    for f in newContent:
        if f.name.endswith(self.OVL_EXT):
            continue
        ovl=self.getOverlayConfig(f)
        if ovl is not None:
            f.hasOverlay=True
        if previousItems is not None and onItem is not None:
            oldItem=previousItems.get(f.name)
            if oldItem is not None:
                if f.isModified(oldItem):
                    add=onItem(f,"add")
                    if add:
                        rt[f.name]=f
                else:
                    rt[oldItem.name]=oldItem
            else:
                add=onItem(f,"add")
                if add:
                    rt[f.name]=f
        elif onItem is not None:
            add=onItem(f,"add")
            if add:
                rt[f.name] = f
    if previousItems is not None and onItem is not None:
        for old in previousItems.values():
            if rt.get(old.name) is None:
                onItem(old,"remove")
    return rt

  def periodicRun(self):
    if self.baseDir is None or not os.path.isdir(self.baseDir):
      self.setInfo("main", "directory %s not found" % self.baseDir, WorkerStatus.ERROR)
      AVNLog.error("unable to find a valid chart directory %s" % (self.baseDir))
    else:
      self.setInfo("main", "handling directory %s, %d charts" % (self.baseDir, len(self.itemList)),
                   WorkerStatus.NMEA)
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
        newList=self.listDirAndCompare(self.baseDir,self.itemList,onItem=itemAction)
        self.itemList=newList
    for item in newitems:
        self.onItemAdd(item)
    for item in removeditems:
        self.onItemRemove(item)
    for extProvider in list(self.externalProviders.keys()):
      self.externalProviders[extProvider].queryProvider(self.externalItemAdded)
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
          return False
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

  def getOverlayConfigNames(self,item):
    if item is None:
      return None
    firstName=AVNUtil.clean_filename(item.name) +self.OVL_EXT
    if not isinstance(item.getUserData(), ExternalChart):
        return [firstName]
    altKey=item.getUserData().buildAltKey()
    if altKey == item.name:
      return [firstName]
    return [firstName,AVNUtil.clean_filename(altKey) +self.OVL_EXT]

  def getOverlayConfig(self,chartItem):
      if chartItem is None:
          return None
      configNames=self.getOverlayConfigNames(chartItem)
      if configNames is None:
          return None
      ovlConfigs=self.ovlConfigs
      for name in configNames:
        rt=ovlConfigs.get(name)
        if rt is not None:
            return rt

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
    return 0

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
        for name in self.getOverlayConfigNames(chartEntry):
            ovl=self.ovlConfigs.get(name)
            if ovl is not None:
                try:
                    del self.ovlConfigs[name]
                except KeyError:
                    pass
                os.unlink(ovl.getFileName())
    if self.importer is not None:
        self.importer.deleteImport(chartEntry.name)
    chart.deleteFiles()
    self.deleteFromOverlays('chart',chartEntry.name)
    self.wakeUp()
    return AVNUtil.getReturnData()

  def handleRename(self, name, newName, requestparam):
    return AVNUtil.getReturnData(error="rename not supported for charts")

  def handleUpload(self, name, handler, requestparam):
    if name is None:
      return AVNUtil.getReturnData(error="missing name")
    (path,ext)=os.path.splitext(name)
    if ext not in self.ALLOWED_EXTENSIONS or ext == self.OVL_EXT:
      return AVNUtil.getReturnData(error="unknown file type %s"%ext)
    name=self.checkName(name)
    filename=os.path.join(self.baseDir,name)
    rt=super()._upload(filename,handler,requestparam)
    self.wakeUp()
    return rt

  def entryToList(self,entry:AVNDirectoryListEntry):
      rt=entry.serialize()
      chart=entry.getUserData()
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

  def getChartDescriptionByKey(self, chartKey, requestIp="localhost",returnItem=False):
    '''
    find a chart by given key
    @param chartKey:
    @param requestIp:
    @return: a tuple (prefix,chart) or None
    '''
    if chartKey is None:
      return None
    item=None
    if chartKey.startswith(self.SCOPE_USER):
      #internal chart
      with self.lock:
          item=self.itemList.get(chartKey)
    elif chartKey.startswith(ExternalChart.SCOPE_EXT):
        ckp=chartKey.split("@")
        if len(ckp) < 3:
            return None
        with self.lock:
            provider=self.externalProviders.get(ckp[1])
            if provider is None:
                return None
            item=provider.getChartByKey(chartKey)
    if item is None:
      return None
    if returnItem:
        return item
    rt=self.entryToList(item)
    self.replaceParameters(rt,{ExternalProvider.REPLACE_LATER:requestIp})
    return rt

  def migrateOverlay(self,configName,configJson):
      '''
      migrate old chart names into new ones
      :param configName:
      :param configJson:
      :return:
      '''
      if configName is None:
          return None
      rt=configJson.copy()
      rt['name']=configName
      rt['defaults']=[]
      for ovlname in ['overlays']:
          overlays = rt.get(ovlname)
          if overlays is not None:
              newOverlays = []
              for overlay in overlays:
                  if overlay.get('type') == 'chart':
                      newEntry = overlay.copy()
                      chartKey = overlay.get('chartKey') or overlay.get('name')
                      try:
                          del newEntry['chartKey']
                      except KeyError:
                          pass
                      if chartKey is None:
                          continue
                      if not chartKey.startswith(self.SCOPE_USER) and not chartKey.startswith(ExternalChart.SCOPE_EXT):
                          newName=self.nameToKey.get(chartKey)
                          AVNLog.debug("old chart name in overlay %s - new %s",chartKey,newName)
                          if newName is None:
                              #it seems this chart is not available - so remove it from the overlay
                              continue
                          newEntry['displayName']=newEntry.get('name')
                          newEntry['name']=newName
                          newOverlays.append(newEntry)
                      else:
                          newOverlays.append(newEntry)
                  else:
                      newOverlays.append(overlay)
              rt[ovlname] = newOverlays
      return rt

  CGETCONFIG="getConfig"
  CSAVECONFIG="saveConfig"
  CDELCONFIG="deleteConfig"
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
      if command == self.CGETCONFIG:
        expandCharts = AVNUtil.getHttpRequestFlag(requestparam, "expandCharts", False)
        isDefault=False
        overlay=None
        if name is None or name == "":
            #get default
            ovlname=self.SCOPE_USER+self.DEFAULT_CHART_CFG
            overlay=self.ovlConfigs.get(ovlname)
            isDefault=True
        else:
            chartEntry = self.getChartDescriptionByKey(name,returnItem=True)
            if chartEntry is None:
                return AVNUtil.getReturnData(error="chart %s not found"%name)
            names=self.getOverlayConfigNames(chartEntry)
            if len(names) < 1:
                return AVNUtil.getReturnData(error="unable to compute overlay name for %s" % name)
            ovlname=names[0]
            with self.lock:
                for name in names:
                    overlay=self.ovlConfigs.get(name)
                    if overlay is not None:
                        break
        rt = {}
        if overlay is None:
          rt={'name': ovlname}
        else:
          with open(overlay.getFileName(), "r", encoding='utf-8') as f:
              ovl = json.load(f)
          rt = self.migrateOverlay(ovlname,ovl)
          rt['name']=ovlname
        rt['defaults']=[]
        if expandCharts:
          noMerge = ['type', 'opacity', 'chart']
          for ovlname in ['overlays']:
            overlays = rt.get(ovlname)
            if overlays is not None:
              newOverlays=[]
              for overlay in overlays:
                if overlay.get('type') == 'chart':
                  # update with the final chart config
                  chartKey=overlay.get('chartKey') or overlay.get('name')
                  chartDescription=self.getChartDescriptionByKey(chartKey,hostip)
                  if chartDescription is not None:
                    overlay.update(dict([k_v for k_v in list(chartDescription.items()) if k_v[0] not in noMerge]))
                    newOverlays.append(overlay)
                else:
                  newOverlays.append(overlay)
              rt[ovlname]=newOverlays
        return AVNUtil.getReturnData(data=rt)
      if command == self.CSAVECONFIG or command == self.CDELCONFIG:
          names=[]
          if name is None:
              ovlname=self.SCOPE_USER+self.DEFAULT_CHART_CFG
          else:
            chartEntry = self.getChartDescriptionByKey(name,returnItem=True)
            if chartEntry is None:
              return AVNUtil.getReturnData(error="chart %s not found" % name)
            names = self.getOverlayConfigNames(chartEntry)
            if len(names) < 1:
              return AVNUtil.getReturnData(error="unable to compute overlay name for %s" % name)
            ovlname = names[0]
          delstart=0
          rt=AVNUtil.getReturnData()
          if command == self.CSAVECONFIG:
            delstart=1
            filename = os.path.join(self.baseDir, ovlname)
            rt = super()._upload(filename, handler, requestparam,overwrite=True)
          with self.lock:
            for name in names[delstart:]:
                old=self.ovlConfigs.get(name)
                if old is not None:
                    try:
                        del self.ovlConfigs[name]
                    except KeyError:
                        pass
                    os.unlink(old.getFileName())
          self.wakeUp()
          return rt
      if command == 'listOverlays':
        return AVNUtil.getReturnData(data=[])
      if command == 'deleteFromOverlays':
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
