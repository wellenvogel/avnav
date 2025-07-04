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
                            description='cleanup in hours(length of the current track)', rangeOrList=[1,48])
  P_INTERVAL=WorkerParameter('interval',10,type=WorkerParameter.T_FLOAT,
                             description='time between trackpoints in s')
  P_TRACKDIR=WorkerParameter('trackdir',"",editable=False,description='defaults to datadir/tracks')
  P_MINDIST=WorkerParameter('mindistance',25,type=WorkerParameter.T_FLOAT,
                            description='only write if we at least moved this distance in m')
  P_WRITEF=WorkerParameter('writeFile',True,type=WorkerParameter.T_BOOLEAN,
                           description="write to track file (otherwise memory only)")

  WEXT="avt"
  GPXEXT="gpx"
  def __init__(self,param):
    super(AVNTrackWriter,self).__init__(param,'track')
    self.modifySequence = 0
    self.track=[]
    self.tracklock=threading.Lock()
    self.filelock=threading.Lock()
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
    with self.tracklock:
      while len(self.track) > 0:
        if self.track[0].ts<=cleanupTime:
          numremoved+=1
          self.track.pop(0)
        else:
          break
    if numremoved > 0:
      AVNLog.debug("removed %d track entries older then %s",numremoved,cleanupTime.isoformat())


  def handleSpecialApiRequest(self, command, requestparam, handler):
    if command == 'getTrack':
      return self.handleTrackRequest(requestparam)
    if command == 'getTrackV2':
      return self.handleTrackRequest(requestparam,True)
    if command == 'cleanCurrent':
      return self.cleanCurrent()
    return super(AVNTrackWriter,self).handleSpecialApiRequest(command,requestparam,handler)

  def cleanCurrent(self):
    with self.filelock:
      if self.currentFile:
        self.currentFile.close()
        self.currentFile=None
      affected=self._getNecessaryNames()
      for fn in affected:
        self._renameFile(fn)
    with self.tracklock:
      self.track=[]
      self.modifySequence=time.monotonic()
    return AVNUtil.getReturnData()

  def handleTrackRequest(self, requestParam,v2=False):
      lat = None
      lon = None
      dist = None
      maxnum = 60  # with default settings this is one hour
      interval = 60
      full=False
      try:
        maxnumstr = AVNUtil.getHttpRequestParam(requestParam, 'maxnum')
        if not maxnumstr is None:
          maxnum = int(maxnumstr)
        intervalstr = AVNUtil.getHttpRequestParam(requestParam, 'interval')
        if not intervalstr is None:
          interval = int(intervalstr)
        if v2:
          full=AVNUtil.getHttpRequestFlag(requestParam,'full')
      except:
        pass
      frt = self.getTrackFormatted(maxnum, interval)
      if not v2:
        return frt
      return AVNUtil.getReturnData(data=frt,sequence=self.modifySequence,now=AVNUtil.utcnow(),full=full)

  #get the track as array of dicts
  #filter by maxnum and interval
  def getTrackFormatted(self,maxnum,interval):
    rt=[]
    curts=None
    intervaldt=datetime.timedelta(seconds=interval)
    with self.tracklock:
      try:
        for tp in self.track:
          if curts is None or tp.ts > (curts + intervaldt):
            rt.append(tp.getFormatted())
            curts=tp.ts
      except:
        pass
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
      currentTracks=glob.glob(os.path.join(self.baseDir,"*."+self.WEXT))
      for track in currentTracks:
        try:
          gpx=re.sub(r"%s$"%self.WEXT,self.GPXEXT,track)
          doCreate=True
          if os.path.exists(gpx):
            trackstat=os.stat(track)
            gpxstat=os.stat(gpx)
            if trackstat.st_mtime <= gpxstat.st_mtime:
              doCreate=False
          if doCreate:
            AVNLog.debug("creating gpx file %s",gpx)
            try:
              data=self.readTrackFile(track)
              self.writeGpx(gpx,data)
            except Exception as e:
              AVNLog.error("unable to convert track %s: %s",track,str(e))
            #maybe the avt file has been renamed in between - just delete the gpx
            if not os.path.exists(track):
              try:
                AVNLog.info("track %s has been removed after convert, remove gpx",track)
                os.unlink(gpx)
              except:
                pass
        except:
          pass
      self.wait(60)
  def _nameToFullName(self,base,ext,sfx=None):
    if sfx is None:
      return os.path.join(self.baseDir,base+"."+ext)
    return os.path.join(self.baseDir,"%s-%s.%s"%(base,str(sfx),ext))

  def _getNecessaryNames(self):
    '''
    get all the file names that are necessary to build up the current track - based on the current time
    and the cleanup time
    @return:
    '''
    currentTime = datetime.datetime.utcnow()
    timelist=[currentTime]
    nextTime=currentTime-datetime.timedelta(days=1)
    minTime=currentTime-datetime.timedelta(hours=self.getWParam(self.P_CLEANUP))
    while nextTime >= minTime:
      timelist.append(nextTime)
      nextTime-=datetime.timedelta(days=1)
    rt=[]
    for ts in reversed(timelist):
      curfname = self.createFileName(ts)
      rt.append(curfname)
    return rt

  def _readTrackDataFromFiles(self):
    self.track=[]
    fnames=self._getNecessaryNames()
    currentTime = datetime.datetime.utcnow()
    minTime=currentTime-datetime.timedelta(hours=self.getWParam(self.P_CLEANUP))
    for fname in fnames:
      realfilename = self._nameToFullName(fname,self.WEXT)
      if os.path.exists(realfilename):
        AVNLog.info("reading trackfile %s", realfilename)
        self.setInfo('main', "reading track %s"%fname, WorkerStatus.STARTED)
        data = self.readTrackFile(realfilename)
        with self.tracklock:
          for trkpoint in data:
            if trkpoint.ts >= minTime and trkpoint.ts < currentTime:
              self.track.append(trkpoint)
    self.modifySequence=time.monotonic()

  def _renameFile(self,basename):
    fullbase=os.path.join(self.baseDir,basename)
    extensions=[self.WEXT,self.GPXEXT]
    def alreadyExists(sfx=None):
      for ext in extensions:
        fullname=self._nameToFullName(basename,ext,sfx)
        if os.path.exists(fullname):
          return True
      return False
    if not alreadyExists():
      return False
    foundSfx=None
    for sfx in range(1,1000):
      if not alreadyExists(sfx):
        foundSfx=sfx
        break
    if foundSfx is None:
      foundSfx=999
    #we only rename the avt and leave renaming the gpx to the converter
    oldname=self._nameToFullName(basename,self.WEXT)
    renamed=self._nameToFullName(basename,self.WEXT,foundSfx)
    os.rename(oldname,renamed)
    if os.path.exists(renamed):
      AVNLog.info("rename %s to %s",oldname,renamed)
      #now delete the old gpx file
      oldgpx=self._nameToFullName(basename,self.GPXEXT)
      try:
        os.unlink(oldgpx)
      except:
        pass
    else:
      AVNLog.error("unable to rename %s to %s",oldname,renamed)
    return True


  def onPreRun(self):
    self.fname = None
    self.startSequence+=1
    theConverter = threading.Thread(target=self.converter,args=[self.startSequence])
    theConverter.daemon = True
    theConverter.start()
    self.modifySequence=time.monotonic()
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

  def timeChanged(self):
    super().timeChanged()
    #reread track data from logs and request full query
    self.initial=True

  def periodicRun(self):
    try:
      self.loopCount+=1
      currentTime = datetime.datetime.utcnow()
      curfname = self.createFileName(currentTime)
      newFile=False
      realfilename=None
      writeFile=self.getWParam(self.P_WRITEF)
      with self.filelock:
        if not writeFile and self.currentFile is not None:
          self.currentFile.close()
          self.currentFile=None
      if writeFile:
        if self.initial:
          with self.filelock:
            if not self.currentFile is None:
              AVNLog.info("closing trackfile - initial")
              self.currentFile.close()
              self.currentFile=None
          self.initial=False
          self._readTrackDataFromFiles()
        with self.filelock:
          if not curfname == self.fname or self.currentFile is None:
            self.fname = curfname
            if not self.currentFile is None:
              AVNLog.info("closing trackfile - new name")
              self.currentFile.close()
              self.currentFile=None
            newFile = True
            realfilename = self._nameToFullName(curfname,self.WEXT)
            AVNLog.info("new trackfile %s", realfilename)
          if newFile:
            self.currentFile = open(realfilename, "a",encoding='utf-8')
            self.currentFile.write("#anvnav Trackfile started/continued at %s\n" % (currentTime.isoformat()))
            self.currentFile.flush()
        self.setInfo('main', "writing to %s" % (self.fname,), WorkerStatus.NMEA)
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
          with self.filelock:
            if self.currentFile is not None:
              self.writeLine(self.currentFile,tp)
          with self.tracklock:
            self.track.append(tp)
          self.lastlat = lat
          self.lastlon = lon
        else:
          dist = AVNUtil.distance((self.lastlat, self.lastlon), (lat, lon)) * AVNUtil.NM
          if dist >= self.getWParam(self.P_MINDIST):
            tp.distance = dist
            AVNLog.ld("write track entry", gpsdata)
            with self.filelock:
              if self.currentFile is not None:
                self.writeLine(self.currentFile,tp)
            with self.tracklock:
              self.track.append(tp)
            self.lastlat = lat
            self.lastlon = lon
    except Exception as e:
      AVNLog.error("exception in Trackwriter: %s", traceback.format_exc())


  def handleDelete(self, name):
    rt=super(AVNTrackWriter, self).handleDelete(name)
    if name.endswith(self.GPXEXT):
      if self.fname == name[:-4]:
        AVNLog.info("deleting current track!")
        with self.tracklock:
          self.track=[]
          self.modifySequence=time.monotonic()
        with self.filelock:
          if self.currentFile is not None:
            self.currentFile.close()
            self.currentFile=None
      try:
        super().handleDelete(re.sub(r"%s$"%self.GPXEXT,self.WEXT,name))
      except:
        pass
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
