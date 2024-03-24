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
from avnav_manager import AVNHandlerManager
from avndirectorybase import *


class TrackPoint:
  def __init__(self,ts=None,lat=None,lon=None,speed=None,course=None,distance=None):
    self.ts=ts
    self.lat=lat
    self.lon=lon
    self.speed=speed
    self.course=course
    self.distance=distance

  def fillFromGpsData(self,data):
    self.lat=data.get('lat')
    self.lon=data.get('lon')
    self.course=data.get('track')
    self.speed=data.get('speed')
    self.distance=data.get('distance')

  def getFormatted(self):
    rt=self.__dict__.copy()
    try:
      del rt['distance']
    except:
      pass
    rt['ts']=AVNUtil.datetimeToTsUTC(self.ts)
    rt['time']=self.ts.isoformat()
    return rt

  def getLine(self):
    ts=self.ts.replace(microsecond=0).isoformat()
    if not ts[-1:]=="Z":
        ts+="Z"
    return "%s,%f,%f,%f,%f,%f\n"%(ts,self.lat,self.lon,self.course or 0,self.speed or 0,self.distance or 0)

#a writer for our track
class AVNTrackWriter(AVNDirectoryHandlerBase):
  P_CLEANUP=WorkerParameter('cleanup',25,type=WorkerParameter.T_FLOAT,
                            description='cleanup in hours')
  P_INTERVAL=WorkerParameter('interval',10,type=WorkerParameter.T_FLOAT,
                             description='time between trackpoints in s')
  P_TRACKDIR=WorkerParameter('trackdir',"",editable=False,description='defaults to datadir/tracks')
  P_MINDIST=WorkerParameter('mindistance',25,type=WorkerParameter.T_FLOAT,
                            description='only write if we at least moved this distance in m')
  P_WRITEF=WorkerParameter('writeFile',True,type=WorkerParameter.T_BOOLEAN,
                           description="write to track file (otherwise memory only)")
  def __init__(self,param):
    super(AVNTrackWriter,self).__init__(param,'track')
    self.track=[]
    self.tracklock=threading.Lock()
    self.baseDir=AVNHandlerManager.getDirWithDefault(self.param, self.P_TRACKDIR.name, 'tracks')
    self.fname=None
    self.loopCount=0
    self.currentFile=None
    self.initial=True
    self.lastlon=None
    self.lastlat=None
    self.startSequence=0

  @classmethod
  def getConfigParam(cls, child=None):
    if child is not None:
      return None
    return [
            cls.P_INTERVAL,
            cls.P_TRACKDIR,
            cls.P_MINDIST,
            cls.P_CLEANUP,
            cls.P_WRITEF
    ]

  @classmethod
  def canEdit(cls):
    return True


  @classmethod
  def getPrefix(cls):
    return '/track'

  def getTrackDir(self):
    return self.baseDir
  #write out the line
  #timestamp is a datetime object
  def writeLine(self,filehandle,tp: TrackPoint):
    filehandle.write(tp.getLine())
    filehandle.flush()
  def createFileName(self,dt):
    fstr=str(dt.strftime("%Y-%m-%d"))
    return fstr
  def cleanupTrack(self):
    numremoved=0
    cleanupTime=datetime.datetime.utcnow()-datetime.timedelta(hours=self.getWParam(self.P_CLEANUP))
    self.tracklock.acquire()
    while len(self.track) > 0:
      if self.track[0].ts<=cleanupTime:
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
        if curts is None or tp.ts > (curts + intervaldt):
          rt.append(tp.getFormatted())
          curts=tp.ts
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
    f=open(filename,"r",encoding='utf-8')
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
          tp=TrackPoint(AVNUtil.gt(par[0]),
                        lat=float(par[1]),
                        lon=float(par[2]),
                        course=float(par[3]),
                        speed=float(par[4]))
          rt.append(tp)
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
        ts=trackpoint.ts.isoformat()
        if not ts[-1:]=="Z":
          ts+="Z"
        f.write(trkpstr%(trackpoint.lat,trackpoint.lon,ts,trackpoint.course,trackpoint.speed))
      f.write(footer)
    except:
      AVNLog.warn("Exception while writing gpx file %s: %s",filename,traceback.format_exc())
    f.close()

  #a converter running in a separate thread
  #will convert all found track files to gpx if the gpx file does not exist or is older
  def converter(self,sequence):
    infoName="TrackWriter:converter"
    AVNLog.info("%s thread started",infoName)
    while self.startSequence == sequence:
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
      self.wait(60)

  def onPreRun(self):
    self.fname = None
    self.startSequence+=1
    theConverter = threading.Thread(target=self.converter,args=[self.startSequence])
    theConverter.daemon = True
    theConverter.start()
    AVNLog.info("started with dir=%s,interval=%d, distance=%d",
                self.baseDir,
                self.getWParam(self.P_INTERVAL),
                self.getWParam(self.P_MINDIST))

  def getSleepTime(self):
    return self.getWParam(self.P_INTERVAL)

  def stop(self):
    super().stop()
    self.startSequence+=1

  def updateConfig(self, param, child=None):
    super().updateConfig(param, child)
    self.wakeUp()

  def periodicRun(self):
    try:
      self.loopCount+=1
      currentTime = datetime.datetime.utcnow()
      curfname = self.createFileName(currentTime)
      newFile=False
      realfilename=None
      writeFile=self.getWParam(self.P_WRITEF)
      if not writeFile and self.currentFile is not None:
        self.currentFile.close()
        self.currentFile=None
        self.initial=True
      if writeFile:
        if not curfname == self.fname or self.currentFile is None:
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
                self.track.append(trkpoint)
            self.initial = False
        if newFile:
          self.currentFile = open(realfilename, "a",encoding='utf-8')
          self.currentFile.write("#anvnav Trackfile started/continued at %s\n" % (currentTime.isoformat()))
          self.currentFile.flush()
          self.setInfo('main', "writing to %s" % (realfilename,), WorkerStatus.NMEA)
      else:
        self.setInfo('main','writing to memory only',WorkerStatus.NMEA)
      if self.loopCount >= 10:
        self.cleanupTrack()
        self.loopCount = 0
      gpsdata = self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS, 1)
      lat = gpsdata.get('lat')
      lon = gpsdata.get('lon')
      if not lat is None and not lon is None:
        tp=TrackPoint(ts=currentTime)
        tp.fillFromGpsData(gpsdata)
        if self.lastlat is None or self.lastlon is None:
          AVNLog.ld("write track entry", gpsdata)
          if self.currentFile is not None:
            self.writeLine(self.currentFile,tp)
          self.track.append(tp)
          self.lastlat = lat
          self.lastlon = lon
        else:
          dist = AVNUtil.distance((self.lastlat, self.lastlon), (lat, lon)) * AVNUtil.NM
          if dist >= self.getWParam(self.P_MINDIST):
            tp.distance = dist
            AVNLog.ld("write track entry", gpsdata)
            if self.currentFile is not None:
              self.writeLine(self.currentFile,tp)
            self.track.append(tp)
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
