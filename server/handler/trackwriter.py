# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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

import glob

import avnav_handlerList
from avnav_config import AVNConfig
from avndirectorybase import *


#a writer for our track
class AVNTrackWriter(AVNDirectoryHandlerBase):
  def __init__(self,param):
    super(AVNTrackWriter,self).__init__(param,'track')
    self.track=[]
    #param checks
    throw=True
    self.getIntParam('cleanup', throw)
    self.getFloatParam('mindistance', throw)
    self.getFloatParam('interval', throw)
    self.tracklock=threading.Lock()
    self.baseDir=AVNConfig.getDirWithDefault(self.param,"trackdir",'tracks')
    self.fname=None
    self.loopCount=0
    self.currentFile=None
    self.initial=True
    self.lastlon=None
    self.lastlat=None
  @classmethod
  def getConfigName(cls):
    return "AVNTrackWriter"
  @classmethod
  def getConfigParam(cls, child=None, forEdit=False):
    if child is not None:
      return None
    return [
            WorkerParameter('interval',10,type=WorkerParameter.T_FLOAT,
                            description='write every nn seconds'),
            WorkerParameter('trackdir',"",editable=False,description='defaults to datadir/tracks'),
            WorkerParameter('mindistance',25,type=WorkerParameter.T_FLOAT,
                            description='only write if we at least moved this distance in m'),
            WorkerParameter('cleanup',25,type=WorkerParameter.T_FLOAT,
                          description='cleanup in hours')
    ]

  @classmethod
  def getPrefix(cls):
    return '/track'

  def getTrackDir(self):
    return self.baseDir
  #write out the line
  #timestamp is a datetime object
  def writeLine(self,filehandle,timestamp,data):
    ts=timestamp.isoformat();
    if not ts[-1:]=="Z":
        ts+="Z"
    str="%s,%f,%f,%f,%f,%f\n"%(ts,data['lat'],data['lon'],(data.get('track') or 0),(data.get('speed') or 0),(data.get('distance') or 0))
    filehandle.write(str)
    filehandle.flush()
  def createFileName(self,dt):
    fstr=str(dt.strftime("%Y-%m-%d"))
    return fstr
  def cleanupTrack(self):
    numremoved=0
    cleanupTime=datetime.datetime.utcnow()-datetime.timedelta(hours=self.getIntParam('cleanup'))
    self.tracklock.acquire()
    while len(self.track) > 0:
      if self.track[0][0]<=cleanupTime:
        numremoved+=1
        self.track.pop(0)
      else:
        break
    self.tracklock.release()
    if numremoved > 0:
      AVNLog.debug("removed %d track entries older then %s",numremoved,cleanupTime.isoformat())


  def handleSpecialApiRequest(self, command, requestparam, handler):
    if command == 'getTrack':
      return self.handleTrackRequest(requestparam)
    return super(AVNTrackWriter,self).handleSpecialApiRequest(command,requestparam,handler)

  def handleTrackRequest(self, requestParam):
      lat = None
      lon = None
      dist = None
      maxnum = 60  # with default settings this is one hour
      interval = 60
      try:
        maxnumstr = AVNUtil.getHttpRequestParam(requestParam, 'maxnum')
        if not maxnumstr is None:
          maxnum = int(maxnumstr)
        intervalstr = AVNUtil.getHttpRequestParam(requestParam, 'interval')
        if not intervalstr is None:
          interval = int(intervalstr)
      except:
        pass
      frt = self.getTrackFormatted(maxnum, interval)
      return frt

  #get the track as array of dicts
  #filter by maxnum and interval
  def getTrackFormatted(self,maxnum,interval):
    rt=[]
    curts=None
    intervaldt=datetime.timedelta(seconds=interval)
    self.tracklock.acquire()
    try:
      for tp in self.track:
        if curts is None or tp[0] > (curts + intervaldt):
          entry={
               'ts':AVNUtil.datetimeToTsUTC(tp[0]),
               'time':tp[0].isoformat(),
               'lat':tp[1],
               'lon':tp[2]}
          rt.append(entry)
          curts=tp[0]
    except:
      pass
    self.tracklock.release()
    return rt[-maxnum:]
  #read in a track file (our csv syntax)
  #return an array of track data
  def readTrackFile(self,filename):
    rt=[]
    if not os.path.exists(filename):
      AVNLog.debug("unable to read track file %s",filename)
      return rt
    f=open(filename,"r")
    if f is None:
      AVNLog.debug("unable to open track file %s",filename)
      return rt
    AVNLog.debug("reading track file %s",filename)
    try:
      for line in f:
        line=re.sub('#.*','',line)
        par=line.split(",")
        if len(par) < 3:
          continue
        try:
          newLat=float(par[1])
          newLon=float(par[2])
          track=float(par[3])
          speed=float(par[4])
          rt.append((AVNUtil.gt(par[0]),newLat,newLon,track,speed))
        except:
          AVNLog.warn("exception while reading track file %s: %s",filename,traceback.format_exc())
    except:
      pass
    f.close()
    AVNLog.debug("read %d entries from %s",len(rt),filename)
    return rt

  #write track data to gpx file
  #input: current track data
  def writeGpx(self,filename,data):
    header='''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
           <gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1" creator="avnav" 
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
            xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd"> 
            <trk>
            <name>avnav-track-%s</name>
            <trkseg>
            '''
    footer='''
            </trkseg>
            </trk>
            </gpx>
            '''
    trkpstr="""
             <trkpt lat="%2.9f" lon="%2.9f" ><time>%s</time><course>%3.1f</course><speed>%3.2f</speed></trkpt>
             """
    if os.path.exists(filename):
      os.unlink(filename)
    f=None
    try:
      f=open(filename,"w",encoding='utf-8')
    except:
      pass
    if f is None:
      AVNLog.warn("unable to write to gpx file %s",filename)
      return
    AVNLog.debug("writing gpx file %s",filename)
    title,e=os.path.splitext(os.path.basename(filename))
    try:
      f.write(header%(title,))
      for trackpoint in data:
        ts=trackpoint[0].isoformat()
        if not ts[-1:]=="Z":
          ts+="Z"
        f.write(trkpstr%(trackpoint[1],trackpoint[2],ts,trackpoint[3],trackpoint[4]))
      f.write(footer)
    except:
      AVNLog.warn("Exception while writing gpx file %s: %s",filename,traceback.format_exc());
    f.close()

  #a converter running in a separate thread
  #will convert all found track files to gpx if the gpx file does not exist or is older
  def converter(self):
    infoName="TrackWriter:converter"
    AVNLog.info("%s thread %s started",infoName,AVNLog.getThreadId())
    while True:
      currentTracks=glob.glob(os.path.join(self.baseDir,"*.avt"))
      for track in currentTracks:
        try:
          gpx=re.sub(r"avt$","gpx",track)
          doCreate=True
          if os.path.exists(gpx):
            trackstat=os.stat(track)
            gpxstat=os.stat(gpx)
            if trackstat.st_mtime <= gpxstat.st_mtime:
              doCreate=False
          if doCreate:
            AVNLog.debug("creating gpx file %s",gpx)
            data=self.readTrackFile(track)
            self.writeGpx(gpx,data)
        except:
          pass
      time.sleep(60)

  def onPreRun(self):
    self.fname = None
    theConverter = threading.Thread(target=self.converter)
    theConverter.daemon = True
    theConverter.start()
    AVNLog.info("started with dir=%s,interval=%d, distance=%d",
                self.baseDir,
                self.getFloatParam("interval"),
                self.getFloatParam("mindistance"))

  def getSleepTime(self):
    return self.getFloatParam("interval")

  def periodicRun(self):
    try:
      self.loopCount+=1
      currentTime = datetime.datetime.utcnow()
      curfname = self.createFileName(currentTime)
      newFile=False
      realfilename=None
      if not curfname == self.fname:
        self.fname = curfname
        if not self.currentFile is None:
          self.currentFile.close()
        newFile = True
        realfilename = os.path.join(self.baseDir, curfname + ".avt")
        AVNLog.info("new trackfile %s", realfilename)
        if self.initial:
          if os.path.exists(realfilename):
            self.setInfo('main', "reading old track data", WorkerStatus.STARTED)
            data = self.readTrackFile(realfilename)
            for trkpoint in data:
              self.track.append((trkpoint[0], trkpoint[1], trkpoint[2]))
          self.initial = False
      if newFile:
        self.currentFile = open(realfilename, "a",encoding='utf-8')
        self.currentFile.write("#anvnav Trackfile started/continued at %s\n" % (currentTime.isoformat()))
        self.currentFile.flush()
        self.setInfo('main', "writing to %s" % (realfilename,), WorkerStatus.NMEA)
      if self.loopCount >= 10:
        self.cleanupTrack()
        self.loopCount = 0
      gpsdata = self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS, 1)
      lat = gpsdata.get('lat')
      lon = gpsdata.get('lon')
      if not lat is None and not lon is None:
        if self.lastlat is None or self.lastlon is None:
          AVNLog.ld("write track entry", gpsdata)
          self.writeLine(self.currentFile, currentTime, gpsdata)
          self.track.append((currentTime, lat, lon))
          self.lastlat = lat
          self.lastlon = lon
        else:
          dist = AVNUtil.distance((self.lastlat, self.lastlon), (lat, lon)) * AVNUtil.NM
          if dist >= self.getFloatParam('mindistance'):
            gpsdata['distance'] = dist
            AVNLog.ld("write track entry", gpsdata)
            self.writeLine(self.currentFile, currentTime, gpsdata)
            self.track.append((currentTime, lat, lon))
            self.lastlat = lat
            self.lastlon = lon
    except Exception as e:
      AVNLog.error("exception in Trackwriter: %s", traceback.format_exc());


  def handleDelete(self, name):
    rt=super(AVNTrackWriter, self).handleDelete(name)
    if name.endswith(".gpx"):
      if self.fname == name[:-4]:
        AVNLog.info("deleting current track!")
        self.track=[]
    return rt

  LISTED_EXTENSIONS=['.nmea','.nmea.gz','.gpx']
  def handleList(self, handler=None):
    data=self.listDirectory()
    rt=[]
    for item in data:
      for  ext in self.LISTED_EXTENSIONS:
        if item.name.endswith(ext):
          rt.append(item)
          break
    return AVNUtil.getReturnData(items=rt)


avnav_handlerList.registerHandler(AVNTrackWriter)
