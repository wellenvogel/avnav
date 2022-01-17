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
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt=[
          WorkerParameter("routesdir","",editable=False),
          WorkerParameter("interval", 5,type=WorkerParameter.T_FLOAT,
                          description='interval in seconds for computing route data'),
          WorkerParameter("feederName",'',editable=False),
          WorkerParameter("computeRMB",True,type=WorkerParameter.T_BOOLEAN,
                          description='if set we compute AP control data'),
          WorkerParameter("computeAPB",False,type=WorkerParameter.T_BOOLEAN,
                          description='if set to true, compute APB taking True course as magnetic!')
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
    self.currentLeg=None
    self.currentLegFileName=None
    self.currentLegTimestamp = None
    self.feeder=self.findFeeder(self.getStringParam('feederName'))
    #approach handling
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.activatedAlarms={} #we keep in mind if WE have already set (or reset) an alarm
                            #independently of others already clearing the alarm
                            #so we re-enable it only after we cleared once

    self.startWp = None
    self.endWp = None
    self.WpNr = 0



  LEG_CHANGE_KEY='leg'

  def setCurrentLeg(self,leg,writeBack=True):
    # type: (AVNRoutingLeg) -> object
    changed=self.currentLeg == None or not self.currentLeg.equal(leg)
    if changed:
      self.navdata.updateChangeCounter(self.LEG_CHANGE_KEY)
    self.currentLeg=leg
    if leg is None:
      if os.path.exists(self.currentLegFileName):
        os.unlink(self.currentLegFileName)
        AVNLog.info("current leg removed")
      return
    if writeBack:
      AVNLog.info("new leg %s",str(leg))
      f=open(self.currentLegFileName,"w",encoding='utf-8')
      try:
        f.write(json.dumps(leg.getJson()))
      except:
        f.close()
        raise
      f.close()
      self.currentLegTimestamp=os.stat(self.currentLegFileName).st_mtime
    if not leg.isActive():
      self.computeApproach() #ensure that we immediately switch off alarms

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
    currentLeg=self.readCurrentLeg()
    if currentLeg is not None:
      self.setCurrentLeg(currentLeg,False)
    else:
      AVNLog.info("no current leg %s found"%(self.currentLegFileName,))
      self.setCurrentLeg(AVNRoutingLeg({}))
    AVNLog.info("router main loop started")

  def periodicRun(self):
    hasLeg = False
    hasRMB = False
    if os.path.exists(self.currentLegFileName):
      newTime=os.stat(self.currentLegFileName).st_mtime
      if newTime != self.currentLegTimestamp:
        AVNLog.info("current leg %s changed timestamp, reload",self.currentLegFileName)
        currentLeg=self.readCurrentLeg()
        if currentLeg:
          self.setCurrentLeg(currentLeg,False)


    if self.currentLeg and self.currentLeg.isActive():
      hasLeg = True
      if self.currentLeg.getAnchorDistance() is not None:
        routerInfo = "Anchor watch, from %s, (anchor radius %sm)" % (
          str(self.currentLeg.getFrom()),
          str(self.currentLeg.getAnchorDistance()))
      else:
        routerInfo = "from %s, to %s, route=%s, activeWp=%s, approach=%s (approach radius %sm)" % (
        str(self.currentLeg.getFrom()), str(self.currentLeg.getTo()),
        self.currentLeg.getRouteName(), self.currentLeg.getCurrentTarget(),
        self.currentLeg.isApproach(), self.currentLeg.getApproachDistance())
      AVNLog.debug(routerInfo)
      self.setInfo("leg", routerInfo
                   , WorkerStatus.RUNNING)
    try:
      if self.currentLeg is not None and self.currentLeg.getAnchorDistance() is not None:
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
    if start:
      if self.activatedAlarms.get(name) is None:
        AVNLog.info("starting alarm %s",name)
      self.activatedAlarms[name]=True
      alert.startAlarm(name)
    else:
      if self.activatedAlarms.get(name) is not None:
        AVNLog.info("stopping alarm %s",name)
        del self.activatedAlarms[name]
      alert.stopAlarm(name)
  #compute whether we are approaching the waypoint
  def computeApproach(self):
    if self.currentLeg is None:
      AVNLog.debug("currentLeg is None")
      self.startStopAlarm(False,self.ALARMS.waypoint)
      self.startStopAlarm(False, self.ALARMS.mob)
      return
    if not self.currentLeg.isActive():
      AVNLog.debug("currentLeg inactive")
      self.startStopAlarm(False,self.ALARMS.waypoint)
      self.startStopAlarm(False, self.ALARMS.mob)
      return
    if self.currentLeg.isMob():
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
    currentLocation=(lat,lon)
    dst=AVNUtil.distanceM(currentLocation,self.wpToLatLon(self.currentLeg.getTo()))
    AVNLog.debug("approach current distance=%f",float(dst))
    if (dst > self.currentLeg.getApproachDistance()):
      old=self.currentLeg.isApproach()
      self.currentLeg.setApproach(False)
      self.startStopAlarm(False,self.ALARMS.waypoint)
      if old:
        #save leg
        self.setCurrentLeg(self.currentLeg)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    if self.activatedAlarms.get(self.ALARMS.waypoint) is None:
      self.startStopAlarm(True, self.ALARMS.waypoint)
    if not self.currentLeg.isApproach():
      self.currentLeg.setApproach(True)
      #save the leg
      self.setCurrentLeg(self.currentLeg)
    AVNLog.info("Route: approaching wp %d (%s) currentDistance=%f",self.currentLeg.getCurrentTarget(),str(self.currentLeg.getTo()),float(dst))
    route=self.currentLeg.getCurrentRoute()
    if route is None or route.get('points') is None:
      AVNLog.debug("Approach: no route active")
      #TODO: stop routing?
      return
    currentTarget=self.currentLeg.getCurrentTarget()
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
      nextWp=route['points'][nextWpNum]
      nextDistance=AVNUtil.distanceM(currentLocation,self.wpToLatLon(nextWp))
      if self.lastDistanceToNext is None or self.lastDistanceToNext is None:
          #first time in approach
          self.lastDistanceToNext=nextDistance
          self.lastDistanceToCurrent=dst
          return
        #check if the distance to own wp increases and to the next decreases
      diffcurrent=dst-self.lastDistanceToCurrent
      if (diffcurrent <= 0):
          #still decreasing
          self.lastDistanceToCurrent=dst
          self.lastDistanceToNext=nextDistance
          return
      diffnext=nextDistance-self.lastDistanceToNext
      if (diffnext > 0):
          #increases to next
          self.lastDistanceToCurrent=dst
          self.lastDistanceToNext=nextDistance
          return
    else:
      AVNLog.info("last WP of route reached, switch of routing")
      self.currentLeg.setActive(False)
      self.setCurrentLeg(self.currentLeg)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    #should we wait for some time???
    AVNLog.info("switching to next WP num=%d, wp=%s",nextWpNum,str(nextWp))
    self.currentLeg.setNewLeg(nextWpNum,self.currentLeg.getTo(),nextWp)
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.setCurrentLeg(self.currentLeg)

  @classmethod
  def wpToLatLon(cls,wp):
    if wp is None:
      return (0,0)
    return (float(wp.get('lat')),float(wp.get('lon')))

  #compute an RMB record and write this into the feeder
  #if we have an active leg
  def computeRMB(self,computeRMB,computeAPB):
    hasRMB=False
    #do the computation of some route data
    nmeaData="$GPRMB,A,,,,,,,,,,,,V,D*19\r\n"
    if self.currentLeg is not None and self.currentLeg.isActive():
      if self.startWp!=self.currentLeg.getFrom() or self.endWp!=self.currentLeg.getTo():
        self.startWp=self.currentLeg.getFrom()
        self.endWp=self.currentLeg.getTo()
        self.WpNr+=1

      if self.startWp is not None and self.endWp is not None:
        curGps=self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
        lat=curGps.get('lat')
        lon=curGps.get('lon')
        kn=curGps.get('speed')
        if kn is None:
          kn=0
        else:
          kn=kn*3600/AVNUtil.NM
        #we could have speed(kn) or course(deg) in curTPV
        #they are basically as decoded by gpsd
        if lat is not None and lon is not None:
          AVNLog.debug("compute route data from %s to %s",str(self.startWp),str(self.endWp))
          XTE=AVNUtil.calcXTE((lat,lon), self.wpToLatLon(self.startWp), self.wpToLatLon(self.endWp))/float(AVNUtil.NM)
          if XTE > 0:
            LR="L"
          else:
            LR="R"
          XTE=abs(XTE)
          if XTE>9.99:
            XTE=9.99
          destDis=AVNUtil.distance((lat,lon),self.wpToLatLon(self.endWp))
          if destDis>999.9:
            destDis=999.9
          if self.currentLeg.isApproach():
            arrival="A"
          else:
            arrival="V"
          wplat=NMEAParser.nmeaFloatToPos(self.endWp['lat'],True)
          wplon = NMEAParser.nmeaFloatToPos(self.endWp['lon'], False)
          destBearing=AVNUtil.calcBearing((lat,lon),self.wpToLatLon(self.endWp))
          brg=AVNUtil.calcBearing(self.wpToLatLon(self.startWp),self.wpToLatLon(self.endWp))
          self.setInfo("autopilot","RMB=%s,APB=%s:WpNr=%d,XTE=%s%s,DST=%s,BRG=%s,ARR=%s"%
                      (computeRMB,computeAPB,self.WpNr,XTE,LR,destDis,destBearing,arrival),WorkerStatus.NMEA)
          hasRMB=True
          if computeRMB:
            nmeaData = "GPRMB,A,%.2f,%s,%s,%s,%s,%s,%s,%s,%.1f,%.1f,%.1f,%s,A"% (
              XTE,LR,self.WpNr,self.WpNr+1,wplat[0],wplat[1],wplon[0],wplon[1],destDis,destBearing,kn,arrival)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s",nmeaData)
            self.feeder.addNMEA(nmeaData,source="router")
          if computeAPB:
            nmeaData = "GPAPB,A,A,%.2f,%s,N,%s,,%.1f,T,%s,%.1f,T,%.1f,T" % (XTE,LR,arrival,brg,self.WpNr + 1,destBearing,destBearing)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s", nmeaData, )
            self.feeder.addNMEA(nmeaData,source="router")
    return hasRMB
  ''' anchor watch
      will only be called if self.currentLeg.anchorDistance is not none
  '''

  @classmethod
  def canEdit(cls):
    return True

  def updateConfig(self, param, child=None):
    return super().updateConfig(param, child)

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
    anchorDistance = AVNUtil.distanceM((lat, lon), self.wpToLatLon(self.currentLeg.getFrom()))
    AVNLog.debug("Anchor distance %d, allowed %d",anchorDistance,self.currentLeg.getAnchorDistance())
    if anchorDistance > self.currentLeg.getAnchorDistance():
      self.startStopAlarm(True,self.ALARMS.anchor)
    return

  def handleList(self,handler=None):
    data=list(self.itemList.values())
    rt = AVNUtil.getReturnData(items=data)
    return rt

  def handleSpecialApiRequest(self,command,requestparam,handler):
    command=AVNUtil.getHttpRequestParam(requestparam, 'command',True)
    if (command == 'getleg'):
      return self.currentLeg.getJson() if self.currentLeg is not None else {}
    if (command == 'unsetleg'):
      self.setCurrentLeg(None)
      return {'status':'OK'}
    if (command == 'setleg'):
      data=AVNUtil.getHttpRequestParam(requestparam, 'leg')
      if data is None:
        data=AVNUtil.getHttpRequestParam(requestparam,'_json')
        if data is None:
          raise Exception("missing leg data for setleg")
      self.setCurrentLeg(AVNRoutingLeg(json.loads(data)))
      return {'status':'OK'}
    raise Exception("invalid command "+command)

avnav_handlerList.registerHandler(AVNRouter)




    
          
  
