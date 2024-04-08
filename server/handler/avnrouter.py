# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
#                         Dirk Radloff nixtodo@gmx.de
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
import math
import os
import sys

import gpxpy098.parser as gpxparser
from avnav_worker import AVNWorker,WorkerParameter

from avnav_manager import AVNHandlerManager
from avnav_util import AVNLog

sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","..","libraries"))

from avndirectorybase import *
import avnav_handlerList

class AVNRoutingLeg(object):
  MOBNAME="MOB" #the waypoint name fro MOB
  def __init__(self,dict):
    if dict is None:
      dict={}
    self.plain=dict
    #TODO: some checks here

  def getFrom(self):
    return self.plain.get('from')
  def getTo(self):
    return self.plain.get('to')

  def isMob(self):
    toWp=self.getTo()
    if toWp is None:
      return False
    if toWp.get('name') == self.MOBNAME:
      return True
    return False

  def isValid(self):
    return self.getFrom() is not None

  def isAnchorWatch(self):
    return self.plain.get('anchorDistance') is not None and self.isValid()

  def getAnchorDistance(self):
    if not self.isAnchorWatch():
      return None
    return float(self.plain.get('anchorDistance'))
  def getCurrentRoute(self):
    return self.plain.get('currentRoute')
  def getRouteName(self):
    route=self.getCurrentRoute()
    if route is not None:
      return route.get('name')

  def getCurrentTarget(self):
    return self.plain.get('currentTarget')

  def getApproachDistance(self):
    d=self.plain.get('approachDistance')
    if d is not None:
      return d
    return 300

  def isActive(self):
    if not self.isValid():
      return False
    if self.getTo() is None:
      return False
    act=self.plain.get('active')
    if act is None:
      return False
    return act

  def isApproach(self):
    return self.plain.get('approach')

  def getJson(self):
    return self.plain

  def equal(self,other):
    # type: (AVNRoutingLeg) -> bool
    if other is None:
      return False
    s1=json.dumps(self.getJson())
    s2=json.dumps(other.getJson())
    return (s1 == s2)

  def setApproach(self,nv):
    self.plain['approach']=nv

  def setActive(self,nv):
    self.plain['active']=nv

  def setNewLeg(self,newTarget,newFrom,newTo):
    self.plain['currentTarget']=newTarget
    self.plain['to']=newTo
    self.plain['from']=newFrom
    self.plain['approach']=False

  def __str__(self):
    if self.isAnchorWatch():
      return "AVNRoutingLeg AnchorWatch from=%s,anchorDistanc=%s" \
             % (str(self.getFrom()),str(self.getAnchorDistance()))
    else:
      return "AVNRoutingLeg route=%s,from=%s,to=%s,active=%s, target=%d, approachDistance=%s, approach=%s"\
           %(self.getRouteName(),str(self.getFrom()),str(self.getTo()),self.isActive(),self.getCurrentTarget() or 0,str(self.getApproachDistance()),"True" if self.isApproach() else "False")
  def clone(self):
    return AVNRoutingLeg(self.plain if self.plain is None else self.plain.copy())

class AVNRouteInfo(AVNDirectoryListEntry):
  def __init__(self,type,prefix,name,**kwargs):
    super(AVNRouteInfo,self).__init__(type,prefix,name,**kwargs)
    self.name=name
    self.length=0
    self.numpoints=0
    self.canDelete=True

  def fillInfo(self,baseDir):
    routeFile=os.path.join(baseDir,self.name)
    try:
      if os.path.isfile(routeFile):
        content=""
        with open(routeFile,"r",encoding='utf-8') as f:
          content=f.read()
        parser = gpxparser.GPXParser(content)
        gpx = parser.parse()
        if gpx.routes is None or len(gpx.routes) == 0:
          AVNLog.error("no routes in %s",routeFile)
        else:
          route=gpx.routes[0]
          self.numpoints=len(route.points)
          self.length=route.length()/AVNUtil.NM
    except Exception as e:
      AVNLog.error("error when parsing route %s: %s",routeFile,str(e))

  def __str__(self):
    return "Route: %s"%self.name

class WpData:
  @classmethod
  def float(cls,v):
    if v is None:
      return None
    return float(v)
  def _calcVmg(self, targetCourse):
    if all(v is not None for v in [self.course, self.speed, targetCourse]):
      return self.speed * math.cos(math.radians(targetCourse-self.course))

  def __init__(self,leg: AVNRoutingLeg = None,lat=None,lon=None,speed=None,course=None,useRhumLine=False):
    self.validData=False
    self.xte=None
    self.xteRhumbLine=None
    self.distance=None
    self.distanceRhumbLine=None
    self.bearing=None
    self.bearingRhumbLine=None
    self.dstBearing=None
    self.dstBearingRhumbLine=None
    self.lat=None
    self.lon=None
    self.fromLat=None
    self.fromLon=None
    self.speed=speed
    self.vmg=None
    self.vmgRhumbLine=None
    self.course=course
    self.useRhumbLine=useRhumLine
    lat=self.float(lat)
    lon=self.float(lon)
    target=None
    fromWp=None
    self.approachDistance=None
    if leg is not None and leg.isActive():
      self.approachDistance=leg.getApproachDistance() if not leg.isMob() else None
      target=leg.getTo()
      fromWp=leg.getFrom()
    if target is not None:
      self.lat=self.float(target.get('lat'))
      self.lon=self.float(target.get('lon'))
    if fromWp is not None:
      self.fromLon=self.float(fromWp.get('lon'))
      self.fromLat=self.float(fromWp.get('lat'))
    if self.lat is not None and self.lon is not None and lat is not None and lon is not None:
      self.validData=True
      self.distance=AVNUtil.distanceM((lat,lon),(self.lat,self.lon))
      self.distanceRhumbLine = AVNUtil.distanceRhumbLineM((lat, lon), (self.lat, self.lon))
      self.dstBearing=AVNUtil.calcBearing((lat,lon),(self.lat,self.lon))
      self.dstBearingRhumbLine = AVNUtil.calcBearingRhumbLine((lat, lon), (self.lat, self.lon))
      self.vmg=self._calcVmg(self.dstBearing)
      self.vmgRhumbLine=self._calcVmg(self.dstBearingRhumbLine)
      if self.fromLon is not None and self.fromLat is not None:
        self.xte=AVNUtil.calcXTE((lat,lon),(self.fromLat,self.fromLon),(self.lat,self.lon))
        self.xteRhumbLine = AVNUtil.calcXTERumbLine((lat, lon), (self.fromLat, self.fromLon), (self.lat, self.lon))
        self.bearing=AVNUtil.calcBearing((self.fromLat,self.fromLon),(self.lat,self.lon))
        self.bearingRhumbLine=AVNUtil.calcBearingRhumbLine((self.fromLat,self.fromLon),(self.lat,self.lon))


#routing handler
class AVNRouter(AVNDirectoryHandlerBase):
  currentLeg = None  # type: AVNRoutingLeg
  MAXROUTESIZE=500000
  PATH_PREFIX="/route"
  ALLOWED_EXTENSIONS=['.gpx']
  currentLegName="currentLeg.json"

  @classmethod
  def getConfigName(cls):
    return "AVNRouter"
  P_RHUMBLINE=WorkerParameter('useRhumbLine',False,type=WorkerParameter.T_BOOLEAN,
                              description='use rhumb lines for courses (otherwise great circle)')
  P_WPMODE=WorkerParameter('nextWpMode','late',type=WorkerParameter.T_SELECT,
                           description='when to switch to next waypoint\nearly: xx seconds after wp alarm\n90: we are at +/-90° from wp course\nlate: old behavior',
                           rangeOrList=['early','90','late'])
  P_WPTIME=WorkerParameter('nextWpTime',10,type=WorkerParameter.T_NUMBER,
                           description='seconds after approach to switch wp (5...100) in mode early',
                           condition=[{P_WPMODE.name:'early'}],
                           rangeOrList=[5,100])
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt=[
          WorkerParameter("routesdir","",editable=False),
          WorkerParameter("interval", 5,type=WorkerParameter.T_FLOAT,
                          description='interval in seconds for computing route data'),
          WorkerParameter("computeRMB",True,type=WorkerParameter.T_BOOLEAN,
                          description='if set we compute AP control data'),
          WorkerParameter("computeAPB",False,type=WorkerParameter.T_BOOLEAN,
                          description='if set to true, compute APB taking True course as magnetic!'),
          cls.P_RHUMBLINE,
          cls.P_WPMODE,
          cls.P_WPTIME
          ]
      return rt
    return None

  @classmethod
  def getListEntryClass(cls):
    return AVNRouteInfo

  @classmethod
  def getPrefix(cls):
    return cls.PATH_PREFIX

  @classmethod
  def getAutoScanExtensions(cls):
    return cls.ALLOWED_EXTENSIONS



  ALARMS=Enum(['gps','waypoint','anchor','mob'])
  
  def __init__(self,cfgparam):
    AVNDirectoryHandlerBase.__init__(self,cfgparam,'route')
    self.baseDir = AVNHandlerManager.getDirWithDefault(self.param, 'routesdir', 'routes')
    self.currentLeg=None # type AVNRoutingLeg
    self.currentLegFileName=None
    self.currentLegTimestamp = None
    #approach handling
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.activatedAlarms={} #we keep in mind if WE have already set (or reset) an alarm
                            #independently of others already clearing the alarm
                            #so we re-enable it only after we cleared once

    self.startWp = None
    self.endWp = None
    self.WpNr = 0
    self.__legLock=threading.Lock()
    self.__writeLegLock=threading.Lock() #alayws lock this first!
    self.approachStarted=None



  LEG_CHANGE_KEY='leg'

  def getCurrentLeg(self):
    with self.__legLock:
      if self.currentLeg is None:
        return None
      return self.currentLeg.clone()

  def setCurrentLeg(self,leg=None,writeBack=True,changeFunction=None,forceWrite=False):
    # type: (AVNRoutingLeg,bool,function or list,bool) -> object
    with self.__writeLegLock:
      with self.__legLock:
        oldLeg=self.currentLeg
        newLeg=leg
        if changeFunction is not None:
          if not type(changeFunction) is list:
            changeFunction=[changeFunction]
          newLeg=oldLeg.clone() if oldLeg is not None else None
          for f in changeFunction:
            newLeg=f(newLeg,leg)
        changed=(oldLeg == None and newLeg is not None) or not oldLeg.equal(newLeg)
        self.currentLeg=newLeg     
      if changed or forceWrite:
        self.navdata.updateChangeCounter(self.LEG_CHANGE_KEY)
        ts=0
        if newLeg is None:
          if os.path.exists(self.currentLegFileName):
            os.unlink(self.currentLegFileName)
            AVNLog.info("current leg removed")
          return
        if writeBack:
          AVNLog.info("new leg %s",str(leg))
          data=json.dumps(newLeg.getJson()).encode('utf-8')
          self.writeAtomic(self.currentLegFileName,io.BytesIO(data),True)
        ts=os.stat(self.currentLegFileName).st_mtime
        self.currentLegTimestamp=ts

  def getSleepTime(self):
    return self.getFloatParam('interval')


  def onItemAdd(self, itemDescription):
    # type: (AVNRouteInfo) -> AVNRouteInfo
    itemDescription.fillInfo(self.baseDir)
    return itemDescription

  def readCurrentLeg(self):
     if os.path.exists(self.currentLegFileName):
       f = None
       try:
         self.currentLegTimestamp=os.stat(self.currentLegFileName).st_mtime
         f = open(self.currentLegFileName, "r", encoding='utf-8')
         strleg = f.read(self.MAXROUTESIZE + 1000)
         currentLeg = AVNRoutingLeg(json.loads(strleg))
         if currentLeg.getTo() is not None:
           distance = AVNUtil.distanceM(self.wpToLatLon(currentLeg.getFrom()),
                                      self.wpToLatLon(currentLeg.getTo()))
           AVNLog.info("read current leg, route=%s, from=%s, to=%s, length=%fNM" % (currentLeg.getRouteName(),
                                                                                  str(currentLeg.getFrom()),
                                                                                  str(currentLeg.getTo()),
                                                                                  distance / AVNUtil.NM))
         else:
           AVNLog.info("read current leg, route=%s, from=%s, to=%s" % (currentLeg.getRouteName(),
                                                                     str(currentLeg.getFrom()),
                                                                     "NONE",                                                              ))
         return currentLeg
       except:
         AVNLog.error("unable to read current leg %s:%s",self.currentLegFileName,traceback.format_exc())
         self.currentLegTimestamp=None

  #this is the main thread - listener
  def onPreRun(self):
    self.currentLegFileName=os.path.join(self.baseDir,self.currentLegName)
    currentLeg=None
    with self.__writeLegLock:
      currentLeg=self.readCurrentLeg()
    if currentLeg is not None:
      self.setCurrentLeg(currentLeg,False)
    else:
      AVNLog.info("no current leg %s found"%(self.currentLegFileName,))
      self.setCurrentLeg(AVNRoutingLeg({}))
    self.computeApproach()
    AVNLog.info("router main loop started")

  def periodicRun(self):
    hasLeg = False
    hasRMB = False
    currentLeg=None
    nonexist=False
    modeText='rhumb line' if self.P_RHUMBLINE.fromDict(self.param) else 'great circle'
    self.setInfo('mode',"%s"%(modeText),WorkerStatus.NMEA)
    self.setInfo('wpswitch',"%s"%self.P_WPMODE.fromDict(self.param),WorkerStatus.NMEA)
    with self.__writeLegLock:
      if os.path.exists(self.currentLegFileName):
        newTime=os.stat(self.currentLegFileName).st_mtime
        if newTime != self.currentLegTimestamp:
          AVNLog.info("current leg %s changed timestamp, reload",self.currentLegFileName)
          currentLeg=self.readCurrentLeg()
      else:
        nonexist=True
    if currentLeg:
      self.setCurrentLeg(currentLeg,False)
    if nonexist:
      def update(leg,x):
        return leg
      self.setCurrentLeg(changeFunction=update,forceWrite=True)
    leg=self.getCurrentLeg()
    if leg and leg.isActive():
      hasLeg = True
      if leg.getAnchorDistance() is not None:
        routerInfo = "Anchor watch, from %s, (anchor radius %sm)" % (
          str(leg.getFrom()),
          str(leg.getAnchorDistance()))
      else:
        routerInfo = "from %s, to %s, route=%s, activeWp=%s, approach=%s (approach radius %sm)" % (
        str(leg.getFrom()), str(leg.getTo()),
        leg.getRouteName(), leg.getCurrentTarget(),
        leg.isApproach(), leg.getApproachDistance())
      AVNLog.debug(routerInfo)
      self.setInfo("leg", routerInfo
                   , WorkerStatus.RUNNING)
    try:
      if leg is not None and leg.getAnchorDistance() is not None:
        self.computeAnchor()
      else:
        self.startStopAlarm(False, self.ALARMS.anchor)
        self.startStopAlarm(False, self.ALARMS.gps)
        computeRMB = self.getBoolParam("computeRMB")
        computeAPB = self.getBoolParam("computeAPB")
        if computeRMB or computeAPB:
          hasRMB = self.computeRMB(computeRMB, computeAPB)
    except Exception as e:
      AVNLog.warn("exception in computeRMB %s, retrying", traceback.format_exc())
    try:
      self.computeApproach()
    except:
      AVNLog.warn("exception in computeApproach %s, retrying", traceback.format_exc())
    if (not hasLeg):
      self.setInfo("leg", "no leg", WorkerStatus.INACTIVE)
    if (not hasRMB):
      self.setInfo("autopilot", "no autopilot data", WorkerStatus.INACTIVE)
    try:
      lat = self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS+".lat")
      lon = self.navdata.getSingleValue(AVNStore.BASE_KEY_GPS+".lon")
      if lat is not None and lon is not None:
        self.startStopAlarm(False, self.ALARMS.gps)
    except:
      pass
    AVNLog.debug("router main loop")

  def startStopAlarm(self,start,name=ALARMS.waypoint):
    alert = self.findHandlerByName("AVNAlarmHandler")
    if alert is None:
      return
    try:
      if start:
        if self.activatedAlarms.get(name) is None:
          AVNLog.info("starting alarm %s",name)
        self.activatedAlarms[name]=True
        alert.startAlarm(name)
      else:
        if self.activatedAlarms.get(name) is not None:
          AVNLog.info("stopping alarm %s",name)
          del self.activatedAlarms[name]
        alert.stopAlarm(name,ownOnly=True)
      self.setInfo('alarm',"%s alarm %s"%('set' if start else 'unset',name),WorkerStatus.NMEA)
    except Exception as e:
      self.setInfo('alarm','unable to handle alarm %s:%s'%(name,str(e)),WorkerStatus.ERROR)


  def _inQuadrant(self,courseStart,course):
    ranges=[]
    min=courseStart-90
    if (min < 0):
      ranges.append([360+min,0])
      min=0
    max=courseStart+90
    if max >= 360:
      ranges.append([0,max-360])
      max=360
    ranges.append([min,max])
    for mm in ranges:
      if mm[0] <= course and mm[1] > course:
        return True
    return False

  #compute whether we are approaching the waypoint
  def computeApproach(self):
    leg=self.getCurrentLeg()
    if leg is None:
      AVNLog.debug("currentLeg is None")
      self.startStopAlarm(False,self.ALARMS.waypoint)
      self.startStopAlarm(False, self.ALARMS.mob)
      return
    if not leg.isActive():
      AVNLog.debug("currentLeg inactive")
      self.startStopAlarm(False,self.ALARMS.waypoint)
      self.startStopAlarm(False, self.ALARMS.mob)
      return
    if leg.isMob():
      AVNLog.debug("currentLeg MOB")
      self.startStopAlarm(False, self.ALARMS.waypoint)
      if self.activatedAlarms.get(self.ALARMS.mob) is None:
        self.startStopAlarm(True, self.ALARMS.mob)
      return
    self.startStopAlarm(False,self.ALARMS.mob)
    curGps=self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
    lat=curGps.get('lat')
    lon=curGps.get('lon')
    if lat is None or lon is None:
      self.startStopAlarm(False,self.ALARMS.waypoint)
      return
    switchMode=self.P_WPMODE.fromDict(self.param)
    switchTime=self.P_WPTIME.fromDict(self.param)
    currentLocation=(lat,lon)
    dst=None
    if self.useRhumbLine():
      dst=AVNUtil.distanceRhumbLineM(currentLocation,self.wpToLatLon(leg.getTo()))
    else:
      dst = AVNUtil.distanceM(currentLocation, self.wpToLatLon(leg.getTo()))
    AVNLog.debug("approach current distance=%f",float(dst))
    if (dst > leg.getApproachDistance()):
      def unsetApproach(leg,x):
        if not leg:
          return leg
        leg.setApproach(False)
        return leg
      self.approachStarted=None
      self.setCurrentLeg(changeFunction=unsetApproach)
      self.startStopAlarm(False,self.ALARMS.waypoint)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    if self.activatedAlarms.get(self.ALARMS.waypoint) is None:
      self.startStopAlarm(True, self.ALARMS.waypoint)
      self.approachStarted=time.time()
    #we have approach
    def setApproach(leg,x):
      if not leg:
        return leg
      leg.setApproach(True)
      return leg
    changes=[setApproach]
    AVNLog.info("Route: approaching wp %d (%s) currentDistance=%f",leg.getCurrentTarget(),str(leg.getTo()),float(dst))
    route=leg.getCurrentRoute()
    if route is None or route.get('points') is None:
      AVNLog.debug("Approach: no route active")
      self.setCurrentLeg(changeFunction=changes)
      #TODO: stop routing?
      return
    currentTarget=leg.getCurrentTarget()
    hasNextWp = True
    nextWpNum=0
    if currentTarget is None:
      hasNextWp=False
    else:
      nextWpNum=currentTarget+1
      nextDistance=0
      if nextWpNum >= len(route['points']):
        AVNLog.debug("already at last WP of route %d",(nextWpNum-1))
        hasNextWp=False
    if hasNextWp:
      if switchMode == 'early':
        if self.approachStarted is not None:
          now=time.time()
          if self.approachStarted > now:
            self.approachStarted=now
          if self.approachStarted > (now - switchTime):
            self.setCurrentLeg(changeFunction=changes)
            return
        else:
          self.setCurrentLeg(changeFunction=changes)
          return
      nextWp=route['points'][nextWpNum]
      if switchMode == 'late':
        nextDistance=None
        if self.useRhumbLine():
          nextDistance=AVNUtil.distanceRhumbLineM(currentLocation,self.wpToLatLon(nextWp))
        else:
          nextDistance = AVNUtil.distanceM(currentLocation, self.wpToLatLon(nextWp))
        if self.lastDistanceToNext is None or self.lastDistanceToNext is None:
            #first time in approach
            self.lastDistanceToNext=nextDistance
            self.lastDistanceToCurrent=dst
            self.setCurrentLeg(changeFunction=changes)
            return
          #check if the distance to own wp increases and to the next decreases
        diffcurrent=dst-self.lastDistanceToCurrent
        if (diffcurrent <= 0):
            #still decreasing
            self.lastDistanceToCurrent=dst
            self.lastDistanceToNext=nextDistance
            self.setCurrentLeg(changeFunction=changes)
            return
        diffnext=nextDistance-self.lastDistanceToNext
        if (diffnext > 0):
            #increases to next
            self.lastDistanceToCurrent=dst
            self.lastDistanceToNext=nextDistance
            self.setCurrentLeg(changeFunction=changes)
            return
      if switchMode == '90':
        fromWp=leg.getFrom()
        if fromWp is None:
          AVNLog.debug("no fromWp in leg")
          self.setCurrentLeg(changeFunction=changes)
          return
        if self.useRhumbLine():
          courseLeg=AVNUtil.calcBearingRhumbLine(self.wpToLatLon(leg.getTo()),self.wpToLatLon(fromWp))
          courseCur=AVNUtil.calcBearingRhumbLine(self.wpToLatLon(leg.getTo()),currentLocation)
        else:
          courseLeg=AVNUtil.calcBearing(self.wpToLatLon(leg.getTo()),self.wpToLatLon(fromWp))
          courseCur=AVNUtil.calcBearing(self.wpToLatLon(leg.getTo()),currentLocation)
        if self._inQuadrant(courseLeg,courseCur):
          AVNLog.debug("courseLeg=%d, courseCur=%d, still not passed",courseLeg,courseCur)
          self.setCurrentLeg(changeFunction=changes)
          return
        else:
          AVNLog.debug("90° from wp")
    else:
      AVNLog.info("last WP of route reached, switch of routing")
      def unsetActive(leg,x):
        if not leg:
          return leg
        leg.setActive(False)
        return leg
      changes.append(unsetActive)  
      self.setCurrentLeg(changeFunction=changes)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    #should we wait for some time???
    AVNLog.info("switching to next WP num=%d, wp=%s",nextWpNum,str(nextWp))
    def newWp(leg,x):
      if not leg:
        return leg
      leg.setNewLeg(nextWpNum,leg.getTo(),nextWp)
      return leg
    changes.append(newWp)
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.setCurrentLeg(changeFunction=changes)

  @classmethod
  def wpToLatLon(cls,wp):
    if wp is None:
      return (0,0)
    return (float(wp.get('lat')),float(wp.get('lon')))

  def getWpData(self) -> WpData:
    if self.navdata is None:
      #called when uninitialized
      return None
    curGps=self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
    lat=curGps.get('lat')
    lon=curGps.get('lon')
    speed=curGps.get('speed')
    course=curGps.get('track')
    wpData=WpData(self.getCurrentLeg(),lat,lon,speed or 0,course,useRhumLine=self.P_RHUMBLINE.fromDict(self.param))
    return wpData
  #compute an RMB record and write this into the queue
  #if we have an active leg
  def computeRMB(self,computeRMB,computeAPB):
    hasRMB=False
    #do the computation of some route data
    nmeaData="$GPRMB,A,,,,,,,,,,,,V,D*19\r\n"
    leg=self.getCurrentLeg()
    if leg is not None and leg.isActive():
      if self.startWp!=leg.getFrom() or self.endWp!=leg.getTo():
        self.startWp=leg.getFrom()
        self.endWp=leg.getTo()
        self.WpNr+=1

      if self.startWp is not None and self.endWp is not None:
        wpData=self.getWpData()

        if wpData is not None and wpData.validData:
          AVNLog.debug("compute route data from %s to %s",str(self.startWp),str(self.endWp))
          XTE=None
          if self.useRhumbLine():
            XTE = wpData.xteRhumbLine / float(AVNUtil.NM)
          else:
            XTE=wpData.xte/float(AVNUtil.NM)
          if XTE > 0:
            LR="L"
          else:
            LR="R"
          XTE=abs(XTE)
          if XTE>9.99:
            XTE=9.99
          destDis=None
          if self.useRhumbLine():
            destDis = wpData.distanceRhumbLine / float(AVNUtil.NM)
          else:
            destDis=wpData.distance/float(AVNUtil.NM)
          if destDis>999.9:
            destDis=999.9
          if leg.isApproach():
            arrival="A"
          else:
            arrival="V"
          wplat=NMEAParser.nmeaFloatToPos(self.endWp['lat'],True)
          wplon = NMEAParser.nmeaFloatToPos(self.endWp['lon'], False)
          destBearing=None
          if self.useRhumbLine():
            destBearing=wpData.dstBearingRhumbLine
          else:
            destBearing = wpData.dstBearing
          brg=wpData.bearing
          vmg=wpData.vmg if not wpData.useRhumbLine else wpData.vmgRhumbLine
          kn=vmg*3600/AVNUtil.NM if vmg is not None else 0
          self.setInfo("autopilot","RMB=%s,APB=%s:WpNr=%d,XTE=%s%s,DST=%s,BRG=%s,ARR=%s,VMG=%skn"%
                      (computeRMB,computeAPB,self.WpNr,XTE,LR,destDis,destBearing,arrival,kn),WorkerStatus.NMEA)
          hasRMB=True
          if computeRMB:
            nmeaData = "GPRMB,A,%.2f,%s,%s,%s,%s,%s,%s,%s,%.1f,%.1f,%.1f,%s,A"% (
              XTE,LR,self.WpNr,self.WpNr+1,wplat[0],wplat[1],wplon[0],wplon[1],destDis,destBearing,kn,arrival)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s",nmeaData)
            self.queue.addNMEA(nmeaData,source="router")
          if computeAPB:
            nmeaData = "GPAPB,A,A,%.2f,%s,N,%s,,%.1f,T,%s,%.1f,T,%.1f,T" % (XTE,LR,arrival,brg,self.WpNr + 1,destBearing,destBearing)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s", nmeaData, )
            self.queue.addNMEA(nmeaData,source="router")
    return hasRMB
  ''' anchor watch
      will only be called if leg.anchorDistance is not none
  '''

  def useRhumbLine(self):
    return self.P_RHUMBLINE.fromDict(self.param)

  @classmethod
  def canEdit(cls):
    return True

  def updateConfig(self, param, child=None):
    rt=super().updateConfig(param, child)
    self.navdata.updateChangeCounter(self.LEG_CHANGE_KEY)
    return rt

  def computeAnchor(self):
    curGps = self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
    lat = curGps.get('lat')
    lon = curGps.get('lon')
    if lat is None or lon is None:
      self.startStopAlarm(False,self.ALARMS.anchor)
      if self.activatedAlarms.get(self.ALARMS.gps) is None:
        self.startStopAlarm(True,self.ALARMS.gps)
      return
    self.startStopAlarm(False,self.ALARMS.gps)
    leg=self.getCurrentLeg()
    if self.useRhumbLine():
      anchorDistance=AVNUtil.distanceRhumbLineM((lat, lon), self.wpToLatLon(leg.getFrom()))
    else:
      anchorDistance = AVNUtil.distanceM((lat, lon), self.wpToLatLon(leg.getFrom()))
    AVNLog.debug("Anchor distance %d, allowed %d",anchorDistance,leg.getAnchorDistance())
    if anchorDistance > leg.getAnchorDistance():
      self.startStopAlarm(True,self.ALARMS.anchor)
    return

  def handleList(self,handler=None):
    data=list(self.itemList.values())
    rt = AVNUtil.getReturnData(items=data)
    return rt
  def handleSpecialApiRequest(self,command,requestparam,handler):
    command=AVNUtil.getHttpRequestParam(requestparam, 'command',True)
    if (command == 'getleg'):
      if self.currentLeg is None:
        return {}
      legData=self.currentLeg.getJson().copy()
      legData[self.P_RHUMBLINE.name]=self.useRhumbLine()
      legData[self.P_WPMODE.name]=self.P_WPMODE.fromDict(self.param)
      legData[self.P_WPTIME.name]=self.P_WPTIME.fromDict(self.param)
      return legData
    if (command == 'unsetleg'):
      self.setCurrentLeg(None)
      self.wakeUp()
      return {'status':'OK'}
    if (command == 'setleg'):
      data=AVNUtil.getHttpRequestParam(requestparam, 'leg')
      if data is None:
        data=AVNUtil.getHttpRequestParam(requestparam,'_json')
        if data is None:
          raise Exception("missing leg data for setleg")
      legData=json.loads(data)
      rmValues=[self.P_WPTIME.name,self.P_WPMODE.name,self.P_RHUMBLINE.name]
      for name in rmValues:
        if name in legData:
          try:
            del legData[name]
          except:
            pass
      self.setCurrentLeg(AVNRoutingLeg(legData))
      self.wakeUp()
      return {'status':'OK'}
    if (command == 'useRhumbLine'):
      return AVNUtil.getReturnData(useRhumbLine=self.useRhumbLine())
    raise Exception("invalid command "+command)

avnav_handlerList.registerHandler(AVNRouter)




    
          
  
