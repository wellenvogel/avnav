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
import shutil
import urllib

import avnav_handlerList
import gemf_reader
import mbtiles_reader
from avnav_util import *
from avnav_worker import AVNWorker


class AVNChartHandler(AVNWorker):
  """a worker to check the chart dirs
  """
  PATH_PREFIX="/chart"
  EXT_PREFIX="ext" # prefix for found xml files
  INT_PREFIX="int" #prefix for mbtiles,gemf
  def __init__(self,param):
    self.param=param
    self.chartlist={}
    self.chartDir=None
    self.server=None
    self.listCondition = threading.Condition()
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
        if not f.endswith(".gemf") and not  f.endswith(".mbtiles"):
          continue
        if not os.path.isfile(os.path.join(chartbaseDir, f)):
          continue
        AVNLog.debug("found chart file %s", f)
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
            AVNLog.info("closing gemf file %s due to changed timestamp", newchart)
            oldChartFile['gemf'].close()
            try:
              del self.chartlist[newchart]
            except:
              pass
            oldChartFile = None
        if oldChartFile is None:
          AVNLog.info("trying to add chart file %s", fname)
          if fname.endswith(".gemf"):
            chart = gemf_reader.GemfFile(fname)
          else:
            chart=mbtiles_reader.MBTilesFile(fname)
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

  def handleChartRequest(self,url,handler):
    try:
      path=url.replace(self.PATH_PREFIX+"/","",1)
      parr=path.split("/")
      if len(parr) < 3:
        return None
      if parr[0] == self.EXT_PREFIX:
        if parr[2] != AVNUtil.NAVXML:
          return None
        avnav =os.path.join(self.chartDir,AVNUtil.clean_filename(parr[1]),AVNUtil.NAVXML)
        return avnav
      name=parr[1]
      for g in self.chartlist.values():
        if g['name']==name:
          AVNLog.debug("chart file %s, request %s, lend=%d",name,path,len(parr))
          #found file
          #basically we can today handle 2 types of requests:
          #get the overview /chart/int/<name>/avnav.xml
          #get a tile /chart/int/<name>/<srcname>/z/x/y.png
          if parr[2] == AVNUtil.NAVXML:
            AVNLog.debug("avnav request for chart %s",name)
            data=g['avnav']
            handler.send_response(200)
            handler.send_header("Content-type", "text/xml")
            handler.send_header("Content-Length", len(data))
            handler.send_header("Last-Modified", handler.date_time_string())
            handler.end_headers()
            handler.wfile.write(data)
            return True
          if len(parr) != 6:
            raise Exception("invalid request to GEMF file %s: %s" %(name,path))
          data=g['chart'].getTileData((int(parr[3]),int(parr[4]),int(parr[5].replace(".png",""))),parr[2])
          if data is None:
            handler.send_error(404,"File %s not found"%(path))
            return None
          handler.send_response(200)
          handler.send_header("Content-type", "image/png")
          handler.send_header("Content-Length", len(data))
          handler.send_header("Last-Modified", handler.date_time_string())
          handler.end_headers()
          handler.wfile.write(data)
          return None
      raise Exception("chart file %s not found" %(name))
    except:
      handler.send_error(500,"Error: %s"%(traceback.format_exc()))
      return

  def listCharts(self):
    chartbaseDir=self.chartDir
    if chartbaseDir is None:
      return AVNUtil.getReturnData(error="no chart dir")
    data=[]
    for chart in self.chartlist.values():
      url=self.PATH_PREFIX+"/"+self.INT_PREFIX+"/"+urllib.quote(chart['name'].encode('utf-8'))
      entry={
             'name':chart['name'],
             'url':url,
             'charturl':url,
             'time': chart['mtime'],
             'canDelete': True,
             'canDownload': True,
             'schema': chart['chart'].getSchema(),
             'sequence':chart['chart'].getChangeCount()
      }
      data.append(entry)
    try:
      list = os.listdir(chartbaseDir)
    except os.error:
      return AVNUtil.getReturnData(error="unable to read %s"%chartbaseDir)
    list.sort(key=lambda a: a.lower())
    AVNLog.debug("reading chartDir %s",chartbaseDir)
    for de in list:
      if de==".":
        continue
      if de=="..":
        continue
      dpath=os.path.join(chartbaseDir,de)
      fname=os.path.join(dpath,AVNUtil.NAVXML)
      if not os.path.isdir(dpath):
        continue
      if not os.path.isfile(fname):
        continue
      url=self.PATH_PREFIX+"/"+self.EXT_PREFIX+"/"+urllib.quote(de.encode('utf-8'))
      charturl=url
      entry={
             'name':de,
             'url':url,
             'charturl':charturl,
             'time': os.path.getmtime(fname),
             'canDelete': False
             }
      AVNLog.ld("chartentry",entry)
      data.append(entry)
    num=len(data)
    AVNLog.debug("read %d entries from %s",num,chartbaseDir)
    return AVNUtil.getReturnData(items=data)

  def handleDelete(self,url):
    if not url.startswith(self.PATH_PREFIX):
      return AVNUtil.getReturnData(error="invalid url %s"%url)
    parr=url[1:].split("/")
    if len(parr) < 3:
      return AVNUtil.getReturnData(error="invalid url %s" % url)
    if parr[1] == self.INT_PREFIX:
      chartEntry=self.chartlist.get(parr[2])
      if chartEntry is None:
        return AVNUtil.getReturnData(error="chart %s not found"%url)
      del self.chartlist[parr[2]]
      chartEntry['chart'].deleteFiles()
      importer = self.server.getHandler("AVNImporter")  # cannot import this as we would get cycling dependencies...
      if importer is not None:
        importer.deleteImport(chartEntry['name'])
      return AVNUtil.getReturnData()
    if parr[1] == self.EXT_PREFIX:
      dir=os.path.join(self.chartDir,AVNUtil.clean_filename(parr[2]))
      if not os.path.isdir(dir):
        return AVNUtil.getReturnData(error="invalid external url %s"%url)
      shutil.rmtree(dir)
      return AVNUtil.getReturnData()
    return AVNUtil.getReturnData(error="invalid chart url")

  def getHandledCommands(self):
    type="chart"
    rt = {"api": type, "upload": type, "list": type, "download": type, "delete": type}
    rt["path"] = self.PATH_PREFIX
    return rt

  def handleApiRequest(self, type, subtype, requestparam, **kwargs):
    if type == 'path':
      handler=kwargs.get('handler')
      if handler is None:
        AVNLog.error("chartrequest without handler")
        return None
      return self.handleChartRequest(subtype,handler)
    if type == "list":
      return self.listCharts()
    if type == "delete":
      url=AVNUtil.getHttpRequestParam(requestparam,"url",True)
      self.handleDelete(url)
    if type == "download":
      url = AVNUtil.getHttpRequestParam(requestparam, "url", True)
      if not url.startswith(self.PATH_PREFIX):
        raise Exception("invalid url")
      parr = url[1:].split("/")
      if len(parr) < 3:
        raise Exception("invalid url")
      if parr[1] != self.INT_PREFIX:
        raise Exception("invalid url")
      chartEntry=self.chartlist.get(parr[2])
      if chartEntry is None:
        raise Exception("chart not found")
      fname=chartEntry['chart'].filename
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
      name=AVNUtil.clean_filename(AVNUtil.getHttpRequestParam(requestparam,"name",True))
      if not ( name.endswith(".gemf") or name.endswith(".mbtiles")):
        return AVNUtil.getReturnData(error="invalid filename")
      if self.chartlist.get(name) is not None:
        return AVNUtil.getReturnData(error="already exists")
      fname=os.path.join(self.chartDir,name)
      handler.writeFileFromInput(fname,kwargs.get('flen'),False)
      self.listChanged()
      return AVNUtil.getReturnData()

    if type == "api":
      command=AVNUtil.getHttpRequestParam(requestparam,"command",True)
      if (command == "schema"):
        url=AVNUtil.getHttpRequestParam(requestparam,"url",True)
        schema=AVNUtil.getHttpRequestParam(requestparam,"newSchema",True)
        if not url.startswith(self.PATH_PREFIX):
          raise Exception("invalid url")
        parr = url[1:].split("/")
        if len(parr) < 3:
          raise Exception("invalid url")
        if parr[1] != self.INT_PREFIX:
          raise Exception("invalid url")
        chartEntry = self.chartlist.get(parr[2])
        if chartEntry is None:
          raise Exception("chart not found")
        changed=chartEntry['chart'].changeSchema(schema)
        if changed:
          chartEntry['avnav']=chartEntry['chart'].getAvnavXml(self.getIntParam('upzoom'))
        return AVNUtil.getReturnData()

    return AVNUtil.getReturnData(error="Unknown chart request")







avnav_handlerList.registerHandler(AVNChartHandler)
