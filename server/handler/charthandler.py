# !/usr/bin/env python
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
import urllib

import avnav_handlerList
import gemf_reader
import mbtiles_reader
from avnav_util import *
from avnav_worker import AVNWorker


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
    with open(ovname,"r") as f:
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

  def __unicode__(self):
    return "xml %s"%self.filename

class AVNChartHandler(AVNWorker):
  """a worker to check the chart dirs
  """
  PATH_PREFIX="/chart"
  INT_PREFIX="int" #prefix for mbtiles,gemf
  DEFAULT_CHART_CFG="default.cfg"
  def __init__(self,param):
    self.param=param
    self.chartlist={}
    self.chartDir=None
    self.server=None
    self.listCondition = threading.Condition()
    self.externalProviders={} #key is the plugin name, value the callback
    AVNWorker.__init__(self, param)
  @classmethod
  def getConfigName(cls):
    return "AVNChartHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return {
            'period': 30, #how long to sleep between 2 checks
            'upzoom': 2 #zoom up in charts
    }
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return True

  def run(self):
    self.setName(self.getThreadPrefix())
    self.server=self.findHandlerByName("AVNHttpServer")
    if self.server is None:
      AVNLog.error("unable to find AVNHttpServer")
      return
    AVNLog.info("charthandler started")
    while True:
      try:
        self.chartDir=self.server.getChartBaseDir()

        if self.chartDir is None or not os.path.isdir(self.chartDir):
          self.setInfo("main", "directory %s not found" % self.chartDir, AVNWorker.Status.ERROR)
          AVNLog.error("unable to find a valid chart directory %s"%(self.chartDir))
        else:
          self.setInfo("main", "handling directory %s, %d charts" %(self.chartDir,len(self.chartlist)), AVNWorker.Status.NMEA)
          self.readChartDir(self.chartDir)
      except:
        AVNLog.error("error while trying to update charts %s",traceback.format_exc())
      self.listCondition.acquire()
      try:
        self.listCondition.wait(self.getIntParam('period') or 5)
      except:
        pass
      self.listCondition.release()

  def readChartDir(self,chartbaseDir):
    try:
      if not os.path.isdir(chartbaseDir):
        AVNLog.debug("chartbase is no directory - no chart handling")
        return
      files = os.listdir(chartbaseDir)
      oldlist = self.chartlist.keys()
      currentlist = []
      for f in files:
        fullname=os.path.join(chartbaseDir, f)
        if os.path.isfile(fullname):
          if not f.endswith(".gemf") and not  f.endswith(".mbtiles") and not f.endswith(".xml"):
            continue
        else:
          if os.path.isdir(fullname):
            if not os.path.exists(os.path.join(fullname,AVNUtil.NAVXML)):
              continue
          else:
            continue
        AVNLog.debug("found chart file/dir %s", f)
        currentlist.append(f)
      for old in oldlist:
        if not old in currentlist:
          AVNLog.info("closing chart file %s", old)
          oldfile = self.chartlist.get(old)
          if oldfile is None:
            # maybe someone else already deleted...
            continue
          oldfile['chart'].close()
          try:
            del self.chartlist[old]
          except:
            pass
      for newchart in currentlist:
        fname = os.path.join(chartbaseDir, newchart)
        gstat = os.stat(fname)
        oldChartFile = self.chartlist.get(newchart)
        if oldChartFile is not None:
          mtime = gstat.st_mtime
          if mtime != oldChartFile['mtime']:
            AVNLog.info("closing chart file %s due to changed timestamp", newchart)
            oldChartFile['chart'].close()
            try:
              del self.chartlist[newchart]
            except:
              pass
            oldChartFile = None
        if oldChartFile is None:
          AVNLog.info("trying to add chart file %s", fname)
          chart=None
          if os.path.isdir(fname):
            chart=XmlChartFile(fname,True)
          else:
            if fname.endswith(".gemf"):
              chart = gemf_reader.GemfFile(fname)
            if fname.endswith(".mbtiles"):
              chart=mbtiles_reader.MBTilesFile(fname)
            if fname.endswith(".xml"):
              chart=XmlChartFile(fname)
          if chart is not None:
            try:
              chart.open()
              avnav = chart.getAvnavXml(self.getIntParam('upzoom'))
              chartdata = {'name': newchart, 'chart': chart, 'avnav': avnav, 'mtime': gstat.st_mtime}
              self.chartlist[newchart] = chartdata
              AVNLog.info("successfully added chart file %s %s", newchart, unicode(chart))
            except:
              AVNLog.error("error while trying to open chart file %s  %s", fname, traceback.format_exc())
    except:
      AVNLog.error("Exception in chart handler %s, ignore", traceback.format_exc())

  def listChanged(self):
    self.listCondition.acquire()
    try:
      self.listCondition.notify_all()
    except:
      pass
    self.listCondition.release()

  def getChartFromUrl(self,url,returnParts=False):
    '''
    find a chart from the url
    @param url:
    @param returnParts: if True return a tuple (chart,urlsPartsArray)
    @return: either the chart or the tuple
    '''
    if not url.startswith(self.PATH_PREFIX):
      raise Exception("invalid url %s"%url)
    path = url.replace(self.PATH_PREFIX + "/", "", 1)
    parr=path.split("/")
    if len(parr) < 1:
      raise Exception("invalid url %s" % url)
    chartName=urllib.unquote(parr[0])
    chartEntry = self.chartlist.get(chartName)
    if chartEntry is None:
      raise Exception("chart %s not found"%chartName)
    if returnParts:
      return (chartEntry,parr)
    else:
      return chartEntry

  def handleChartRequest(self,url,handler):
    try:
      try:
        (chart,parr)=self.getChartFromUrl(url,True)
      except Exception as e:
        handler.send_error(404, "%s:%s" % (url,e.message))
        return True
      AVNLog.debug("chart file %s, request %s, lend=%d",chart['name'],url,len(parr))
      #found file
      #basically we can today handle 2 types of requests:
      #get the overview /chart/int/<name>/avnav.xml
      #get a tile /chart/int/<name>/<srcname>/z/x/y.png
      if parr[1] == AVNUtil.NAVXML:
        AVNLog.debug("avnav request for chart %s",chart['name'])
        data=chart['avnav']
        handler.send_response(200)
        handler.send_header("Content-type", "text/xml")
        handler.send_header("Content-Length", len(data))
        handler.send_header("Last-Modified", handler.date_time_string())
        handler.end_headers()
        handler.wfile.write(data)
        return True
      if parr[1] == "sequence":
        rsp={'status':'OK','sequence':chart['chart'].getChangeCount()}
        handler.sendNavResponse(json.dumps(rsp))
        return True
      if len(parr) != 5:
        raise Exception("invalid request to chart file %s: %s" %(chart['name'],url))
      data=chart['chart'].getTileData((int(parr[2]),int(parr[3]),int(parr[4].replace(".png",""))),parr[1])
      if data is None:
        handler.send_error(404,"File %s not found"%(url))
        return True
      handler.send_response(200)
      handler.send_header("Content-type", "image/png")
      handler.send_header("Content-Length", len(data))
      handler.send_header("Last-Modified", handler.date_time_string())
      handler.end_headers()
      handler.wfile.write(data)
      return True
    except:
      handler.send_error(500,"Error: %s"%(traceback.format_exc()))
      return

  def getChartConfigKey(self,entry,prefix=None):
    if prefix is None:
      prefix=self.INT_PREFIX
    name=entry.get('baseName')
    if name is None:
      name=entry.get('name')
    return prefix+"@"+AVNUtil.clean_filename(name)

  def getChartConfigFile(self,entry,prefix=None):
    cfgkey=self.getChartConfigKey(entry,prefix)
    cfgfile=os.path.join(self.chartDir,cfgkey+".cfg")
    if not os.path.exists(cfgfile):
      return None
    return cfgfile

  def getChartKey(self,entry,prefix=None):
    if prefix is None:
      prefix=self.INT_PREFIX
    name=entry.get('name')
    return prefix+"@"+name

  def getChartDescriptionByKey(self, chartKey, requestIp="localhost", returnTuple=True):
    '''
    find a chart by given key
    @param chartKey:
    @param requestIp:
    @return: a tuple (prefix,chart) or None
    '''
    if chartKey is None:
      return
    ckp=chartKey.split("@",1)
    if len(ckp) != 2:
      AVNLog.debug("invalid chart key %s",chartKey)
      return
    if ckp[0] == self.INT_PREFIX:
      #internal chart
      for chart in self.chartlist.values():
        if chart['name'] == ckp[1]:
          description=self.getDescriptionFromChart(chart)
          return (ckp[0],description) if returnTuple else description
      return
    provider=self.externalProviders.get(ckp[0])
    if provider is None:
      return
    for chart in provider(requestIp):
      if chart['name'] == ckp[1]:
        return (ckp[0],chart) if returnTuple else chart

  def getDescriptionFromChart(self,chart):
    url = self.PATH_PREFIX + "/" + urllib.quote(chart['name'].encode('utf-8'))
    entry = {
      'name': chart['name'],
      'url': url,
      'charturl': url,
      'time': chart['mtime'],
      'canDelete': True,
      'canDownload': True,
      'scheme': chart['chart'].getScheme(),
      'sequence': chart['chart'].getChangeCount(),
      'originalScheme': chart['chart'].getOriginalScheme(),
    }
    entry['chartKey'] = self.getChartKey(entry)
    return entry

  def listCharts(self,httpHandler,hostip):
    chartbaseDir=self.chartDir
    if chartbaseDir is None:
      return AVNUtil.getReturnData(error="no chart dir")
    data=[]
    for chart in self.chartlist.values():
      entry=self.getDescriptionFromChart(chart)
      data.append(entry)
    for k in self.externalProviders.keys():
      cb=self.externalProviders[k]
      try:
        if cb is not None:
          extList=[]
          extList.extend(cb(hostip))
          for e in extList:
            e['chartKey']=self.getChartKey(e,k)
          data.extend(extList)
      except:
        AVNLog.error("exception while querying charts from %s: %s",k,traceback.format_exc())
    num=len(data)
    AVNLog.debug("read %d entries from %s",num,chartbaseDir)
    return AVNUtil.getReturnData(items=data)

  def handleDelete(self,url):
    chartEntry=None
    try:
      chartEntry=self.getChartFromUrl(url)
    except Exception as e:
      return AVNUtil.getReturnData(error=e.message)
    del self.chartlist[chartEntry['name']]
    importer = self.server.getHandler("AVNImporter")  # cannot import this as we would get cycling dependencies...
    if importer is not None:
      importer.deleteImport(chartEntry['name'])
    chartEntry['chart'].deleteFiles()
    #for our own files we can safely delete the config...
    #as it is unique for a chart
    cfgFile=self.getChartConfigFile(chartEntry)
    if cfgFile is not None:
      os.unlink(cfgFile)
    return AVNUtil.getReturnData()

  def getHandledCommands(self):
    type="chart"
    rt = {"api": type, "upload": type, "list": type, "download": type, "delete": type}
    rt["path"] = self.PATH_PREFIX
    return rt

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    handler = kwargs.get('handler')
    hostip='localhost'
    try:
      host = handler.headers.get('host')
      hostparts = host.split(':')
      hostip=hostparts[0]
    except:
      pass
    if type == 'path':
      if handler is None:
        AVNLog.error("chartrequest without handler")
        return None
      return self.handleChartRequest(subtype,handler)
    if type == "list":
      return self.listCharts(handler,hostip)
    if type == "delete":
      url=AVNUtil.getHttpRequestParam(requestparam,"url",True)
      self.handleDelete(url)
    if type == "download":
      url = AVNUtil.getHttpRequestParam(requestparam, "url", True)
      chartEntry=self.getChartFromUrl(url)
      fname=chartEntry['chart'].getDownloadFile()
      if not os.path.isfile(fname):
        raise Exception("chart file not found")
      return AVNUtil.getReturnData(
        mimetype="application/octet-stream",
        size=os.path.getsize(fname),
        stream=open(fname,"rb")
      )

    if type == "upload":
      handler=kwargs.get('handler')
      if handler is None:
        return AVNUtil.getReturnData(error="no handler")
      name=AVNUtil.getHttpRequestParam(requestparam, "name", True)
      if name.endswith(".cfg"):
        if name == self.DEFAULT_CHART_CFG:
          pass
        else:
          nameparts=name.split("@",1)
          if len(nameparts) != 2:
            return AVNUtil.getReturnData(error="invalid filename")
          cleanName=AVNUtil.clean_filename(nameparts[1])
          if cleanName != nameparts[1]:
            return AVNUtil.getReturnData(error="invalid filename")
          if nameparts[0] != self.INT_PREFIX and self.externalProviders[nameparts[0]] is None:
            return AVNUtil.getReturnData(error="chart provider %s not available"%nameparts[0])
        fname = os.path.join(self.chartDir, name)
        if os.path.exists(fname):
          overwrite=AVNUtil.getHttpRequestParam(requestparam,"overwrite")
          if overwrite is not None and overwrite.lower() == 'true':
            pass
          else:
            return AVNUtil.getReturnData(error="already exists")
        handler.writeFileFromInput(fname, kwargs.get('flen'), True)
      else:
        name=AVNUtil.clean_filename(name)
        if not ( name.endswith(".gemf") or name.endswith(".mbtiles") or name.endswith(".xml")) :
          return AVNUtil.getReturnData(error="invalid filename")
        if self.chartlist.get(name) is not None:
          return AVNUtil.getReturnData(error="already exists")
        fname=os.path.join(self.chartDir,name)
        handler.writeFileFromInput(fname,kwargs.get('flen'),False)
        self.listChanged()
      return AVNUtil.getReturnData()

    if type == "api":
      command=AVNUtil.getHttpRequestParam(requestparam,"command",True)
      try:
        if (command == "scheme"):
          url=AVNUtil.getHttpRequestParam(requestparam,"url",True)
          scheme=AVNUtil.getHttpRequestParam(requestparam,"newScheme",True)
          chartEntry = self.getChartFromUrl(url)
          changed=chartEntry['chart'].changeScheme(scheme)
          if changed:
            chartEntry['avnav']=chartEntry['chart'].getAvnavXml(self.getIntParam('upzoom'))
          return AVNUtil.getReturnData()
        if (command == "getConfig"):
          chartKey = AVNUtil.getHttpRequestParam(requestparam, "chartKey", True)
          expandCharts = AVNUtil.getHttpRequestFlag(requestparam, "expandCharts",False)
          mergeDefault = AVNUtil.getHttpRequestFlag(requestparam,"mergeDefault",False)
          if chartKey == self.DEFAULT_CHART_CFG:
            configName=self.DEFAULT_CHART_CFG
            ovlname=os.path.join(self.chartDir,self.DEFAULT_CHART_CFG)
          else:
            chartEntryAnPrefix = self.getChartDescriptionByKey(chartKey)
            if chartEntryAnPrefix is None:
              AVNLog.debug("chart not found for key %s", chartKey)
              return AVNUtil.getReturnData(data={})
            ovlname = self.getChartConfigFile(chartEntryAnPrefix[1],chartEntryAnPrefix[0])
            configName=self.getChartConfigKey(chartEntryAnPrefix[1],chartEntryAnPrefix[0])+".cfg"
          rt={}
          default= {}
          if mergeDefault:
            defaultCfg=os.path.join(self.chartDir,self.DEFAULT_CHART_CFG)
            if (os.path.exists(defaultCfg)):
              with open(defaultCfg,"r") as f:
                default=json.load(f)
          if ovlname is not None and os.path.exists(ovlname):
            with open(ovlname,"r") as f:
              rt=json.load(f)
          if mergeDefault:
            if default.get('overlays') is not None:
              rt['defaults'] = default['overlays']
          if expandCharts:
            noMerge = ['type', 'chartKey', 'opacity', 'chart']
            for ovlname in ['defaults', 'overlays']:
              overlays = rt.get(ovlname)
              if overlays is not None:
                for overlay in overlays:
                  if overlay.get('type') == 'chart':
                    # update with the final chart config
                    overlay.update(
                      dict(filter(
                        lambda (k, v): k not in noMerge,
                        (self.getChartDescriptionByKey(overlay.get('chartKey'), hostip, returnTuple=False) or {})
                          .items())))

          else:
            rt=default
          rt['name']=configName
          return AVNUtil.getReturnData(data=rt)
      except Exception as e:
        return AVNUtil.getReturnData(error=e.message)

    return AVNUtil.getReturnData(error="Unknown chart request")


  def registerExternalProvider(self,name,callback):
    AVNLog.info("registering external chart provider %s",name)
    self.externalProviders[name]=callback

avnav_handlerList.registerHandler(AVNChartHandler)
