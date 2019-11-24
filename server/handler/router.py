#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
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

import time
import socket
import threading
import os
import sys
import math

import StringIO
from __main__ import traceback

from avnav_config import AVNConfig

sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","..","libraries"))
import gpxpy098.gpx as gpx
import gpxpy098.parser as gpxparser
import gpxpy098.utils as gpxutils
import gpxpy098.geo as geo
import xml.etree.ElementTree as ET

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_store import *
from avnav_nmea import *
import avnav_handlerList

class AVNRoutingLeg():
  def __init__(self,name,fromWP,toWP,active,currentTarget,approachDistance,approach):
    self.name=name
    self.fromWP=fromWP
    self.toWP=toWP
    self.active=active
    self.currentTarget=currentTarget
    self.approachDistance=approachDistance if approachDistance is not None else 300
    self.approach = approach if approach is not None else False
    self.currentRoute=None
    self.anchorDistance=None #if set - we are in anchor watch mode, ignore any toWp and any route

  
  def __unicode__(self):
    if self.anchorDistance is not None:
      return "AVNRoutingLeg route=%s,from=%s,anchorDistanc=%s" \
             % (self.name, unicode(self.fromWP),unicode(self.anchorDistance))
    else:
      return "AVNRoutingLeg route=%s,from=%s,to=%s,active=%s, target=%d, approachDistance=%s, approach=%s"\
           %(self.name,unicode(self.fromWP),unicode(self.toWP),self.active,self.currentTarget,unicode(self.approachDistance),"True" if self.approach else "False")

class AVNRouteInfo():
  def __init__(self,name):
    self.name=name
    self.length=0
    self.numpoints=0
    self.time=AVNUtil.utcnow();
  @classmethod
  def fromRoute(cls,route,time):
    rt=AVNRouteInfo(route.name)
    rt.numpoints=len(route.points)
    rt.length=route.length()/AVNUtil.NM;
    rt.time=time
    return rt

  def toJson(self):
    return json.dumps(self.__dict__)

  def __unicode__(self):
    return self.toJson()

#routing handler
class AVNRouter(AVNWorker):
  MAXROUTESIZE=500000;
  gpxFormat='''<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
    <gpx version="1.1" creator="avnav">%s</gpx>'''
  currentLegName=u"currentLeg.json"
  #unfortunately the gpx stuff uses some long names
  #but we would like to have the same names as in the gpx file also for our json
  #to avoid double parsing all the time we use a conversion list
  fromGpx={
    'latitude':'lat','longitude':'lon', 'elevation':'elevation',
    'time':'time', 'name':'name', 'description':'desc', 'symbol':'sym',
    'type':'type', 'comment':'comment', 'horizontal_dilution':'hdop',
    'vertical_dilution':'vdop', 'position_dilution':'pdop'
     }
  toGpx={}
  @classmethod
  def getConfigName(cls):
    return "AVNRouter"
  
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      
      rt={
          "routesdir":"",
          "interval": 5, #interval in seconds for computing route data
          "feederName":'',
          "computeRMB":True, #if set we compute AP control data,
          "computeAPB": False #if set to true, compute APB taking True course as magnetic!
          }
      return rt
    return None
  
  @classmethod
  def createInstance(cls, cfgparam):
    return AVNRouter(cfgparam)
  
  def __init__(self,cfgparam):
    AVNWorker.__init__(self, cfgparam)
    self.setName(self.getName())
    self.routesdir=None
    self.currentLeg=None
    self.activeRoute=None
    self.activeRouteName=None
    self.currentLegFileName=None
    self.feeder=self.findFeeder(self.getStringParam('feederName'))
    self.startWp=None
    self.endWp=None
    self.WpNr=0
    #approach handling
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.routes=[]
    self.routeListLock=threading.Lock()
    self.routeInfos={}
    self.getRequestParam=AVNUtil.getHttpRequestParam
    self.activatedAlarms={} #ensure that we only re send alarms after they have been reset
    #build the backward conversion
    for k in self.fromGpx.keys():
      v=self.fromGpx[k]
      self.toGpx[v]=k
    
  def getName(self):
    return "AVNRouter"
  
  #make some checks when we have to start
  #we cannot do this on init as we potentiall have to find the feeder...
  def start(self):
    
    AVNWorker.start(self) 
   
  #convert a dictionary to the gpx representation
  def convert(self,dct,converter):
    rt={}
    for k in dct.keys():
      v=dct.get(k)
      if v is not None:
        sk=converter.get(k)
        if sk is not None:
          rt[sk]=v
    return rt
  
  def convertFromGpx(self,dct):
    return self.convert(dct,self.fromGpx)
  
  def convertToGpx(self,dct):
    return self.convert(dct,self.toGpx)
  
  #parse a waypoint from a dictionary  
  def parseWP(self,dct):
    return gpx.GPXWaypoint(**self.convertToGpx(dct))
  
  #parse a leg from a json string
  def parseLeg(self,str):
    dct=json.loads(str)
    if dct.get('from') is None:
      return None
    if (dct.get('anchorDistance') is not None):
      rt = AVNRoutingLeg(
        None,
        gpx.GPXWaypoint(**self.convertToGpx(dct.get('from'))),
          None,
          False,
          -1,
          0,
          False)
      rt.anchorDistance=float(dct.get('anchorDistance'))
      return rt

    if dct.get('to') is None:
      return None
    currentTarget=dct.get('currentTarget')
    if currentTarget is None:
      currentTarget=-1
    rt= AVNRoutingLeg(
                  dct.get('name'),
                  gpx.GPXWaypoint(**self.convertToGpx(dct.get('from'))),
                  gpx.GPXWaypoint(**self.convertToGpx(dct.get('to'))),
                  dct.get('active'),
                  currentTarget,
                  dct.get('approachDistance'),
                  dct.get('approach')
                  )
    if dct.get('currentRoute') is not None:
      try:
        rt.currentRoute=self.routeFromJson(dct.get('currentRoute'))
      except:
        AVNLog.error("error parsing route from leg: %s",traceback.format_exc())
    return rt
  #convert a leg into json
  def leg2Json(self,leg):
    if leg is None:
      return {}
    if leg.anchorDistance is not None:
      dct={
        'from': self.convertFromGpx(leg.fromWP.__dict__),
        'anchorDistance':leg.anchorDistance
      }
      return dct
    dct={
         'from':self.convertFromGpx(leg.fromWP.__dict__),
         'to':self.convertFromGpx(leg.toWP.__dict__),
         'name':leg.name,
         'active':leg.active,
         'currentTarget':leg.currentTarget,
         'approachDistance':leg.approachDistance,
         'approach':leg.approach
         }
    if leg.currentRoute is not None:
      dct['currentRoute']=self.routeToJson(leg.currentRoute)
    return dct

  #get a simple tuple lat,lon from a WP
  #as this is used by our util functions
  def wpToLatLon(self,wP):
    return (wP.latitude,wP.longitude)
  
  def setCurrentLeg(self,leg):
    self.currentLeg=leg
    if leg is None:
      if os.path.exists(self.currentLegFileName):
        os.unlink(self.currentLegFileName)
        AVNLog.info("current leg removed")
      return
    ls=self.leg2Json(leg)
    AVNLog.info("new leg %s",unicode(leg))
    f=open(self.currentLegFileName,"w")
    try:
      f.write(json.dumps(ls))
    except:
      f.close()
      raise
    f.close()
    if leg.name is not None:
      self.activeRouteName=leg.name
    if leg.currentRoute is not None:
      self.saveRoute(leg.currentRoute)

  def routeFromJsonString(self,routeJson):
    try:
      dct=json.loads(routeJson)
      return self.routeFromJson(dct)
    except :
      AVNLog.error("error parsing json for route: %s",traceback.format_exc())
      return None

  def routeFromJson(self,dct):
    if dct.get('name') is None:
      raise Exception("missing name in route")
    route=gpx.GPXRoute(**self.convertToGpx(dict((x,dct.get(x)) for x in ['name','description'])))
    points=dct.get('points')
    if points is not None:
      for p in points:
        rp=gpx.GPXRoutePoint(**self.convertToGpx(dict((x,p.get(x)) for x in ['name','lon','lat'])))
        route.points.append(rp)
    AVNLog.debug("routeFromJson: %s",unicode(route))
    return route

  def routeToJsonString(self,route):
    return json.dumps(self.routeToJson(route))

  def routeToJson(self,route):
    AVNLog.debug("routeToJson: %s",unicode(route))
    rt={'name':route.name,
        'points':[]
        }
    for p in route.points:
      rt['points'].append(self.convertFromGpx(p.__dict__))
    return rt

  def getRouteFileName(self,name):
    return os.path.join(self.routesdir,name+u'.gpx')

  def saveRoute(self,route,ignoreExisting=False):
    if ignoreExisting and self.routeInfos[route.name]:
      AVNLog.info("ignore existing route %s"%(route.name))
    self.updateRouteInfo(route)
    self.addRouteToList(route)
    if self.activeRouteName is not None and self.activeRouteName == route.name:
      self.activeRoute=route
    filename=self.getRouteFileName(route.name)
    f=open(filename,"w")
    try:
      f.write(self.gpxFormat%(route.to_xml()))
    except:
      f.close()
      raise
    f.close()

  def loadRoute(self,name):
    rt=self.getRouteFromList(name)
    if rt is not None:
      return rt
    filename=self.getRouteFileName(name)
    try:
      rt=self.loadRouteFile(filename)
    except:
      AVNLog.error("unable to load route %s:%s"%(filename,traceback.format_exc(1)))
      return
    if rt is not None:
      self.addRouteToList(rt)
    return rt

  def loadRouteFile(self,filename):
    f=open(filename,"r")
    gpx_xml = f.read()
    f.close()
    parser = gpxparser.GPXParser(gpx_xml)
    gpx = parser.parse()
    if gpx.routes is None or len(gpx.routes)  == 0:
      raise "no routes in "+filename
    return gpx.routes[0]

  #fill all routeInfos
  def fillRouteInfos(self):
    self.routeInfos={}
    try:
      for fn in os.listdir(self.routesdir):
        fullname=os.path.join(self.routesdir,fn)
        if not os.path.isfile(fullname):
          continue
        if not fn.endswith(u'.gpx'):
          continue
        try:
          route=self.loadRouteFile(fullname)
          ri=AVNRouteInfo.fromRoute(route,os.path.getmtime(fullname))
          self.routeInfos[ri.name]=ri
          AVNLog.debug("add route info for %s",unicode(ri))
        except:
          AVNLog.debug("unable to read route from %s",fullname)
      AVNLog.info("read %d routes",len(self.routeInfos.items()))
    except:
      pass

  def updateRouteInfo(self,route):
    ri=AVNRouteInfo.fromRoute(route,AVNUtil.utcnow())
    self.routeInfos[ri.name]=ri
  def deleteRouteInfo(self,name):
    try:
      del self.routeInfos[name]
    except:
      pass
        
  #this is the main thread - listener
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    interval=self.getIntParam('interval')
    routesdir=AVNUtil.replaceParam(os.path.expanduser(self.getStringParam("routesdir")),AVNConfig.filterBaseParam(self.getParam()))
    if routesdir == "":
      routesdir=os.path.join(self.getStringParam(AVNConfig.BASEPARAM.DATADIR),u'routes')
    self.routesdir=routesdir
    if not os.path.isdir(self.routesdir):
      AVNLog.info("creating routes directory %s"%(self.routesdir))
      os.makedirs(self.routesdir,0755)
    self.fillRouteInfos()
    self.currentLegFileName=os.path.join(self.routesdir,self.currentLegName)
    if os.path.exists(self.currentLegFileName):
      f=None
      try:
        f=open(self.currentLegFileName,"r")
        strleg=f.read(self.MAXROUTESIZE+1000)
        self.currentLeg=self.parseLeg(strleg)
        if self.currentLeg.toWP is not None:
          distance=geo.length([self.currentLeg.fromWP,self.currentLeg.toWP])
          AVNLog.info("read current leg, route=%s, from=%s, to=%s, length=%fNM"%(self.currentLeg.name,
                                                                  unicode(self.currentLeg.fromWP),unicode(self.currentLeg.toWP),distance/AVNUtil.NM))
        else:
          AVNLog.info("read current leg, route=%s, from=%s, to=%s"% (self.currentLeg.name,
                                                                                   unicode(self.currentLeg.fromWP),
                                                                                   "NONE",
                                                                                   ))
        if self.currentLeg.name is not None:
          self.activeRouteName=self.currentLeg.name
        if self.currentLeg.currentRoute is not None:
          #this will also set the active route
          self.saveRoute(self.currentLeg.currentRoute)
          if self.currentLeg.name != self.currentLeg.currentRoute.name:
            AVNLog.error("leg inconsistent, name in route %s different from name in leg %s, correcting to route name",self.currentLeg.name,
                         self.currentLeg.currentRoute.name)
            self.currentLeg.name=self.currentLeg.currentRoute.name
            self.activeRouteName=self.currentLeg.name
            #write back the corrected leg
            self.setCurrentLeg(self.currentLeg)
        else:
          if self.currentLeg.name is not None:
            self.activeRoute=self.loadRoute(self.currentLeg.name)
            if self.activeRoute is None:
              self.activeRoute=gpx.GPXRoute(self.currentLeg.name)
            self.currentLeg.currentRoute=self.activeRoute
      except:
        AVNLog.error("error parsing current leg %s: %s"%(self.currentLegFileName,traceback.format_exc()))
      if f is not None:
        f.close()
      #TODO: open route
    else:
      AVNLog.info("no current leg %s found"%(self.currentLegFileName,))
    AVNLog.info("router main loop started")
    while True:
      hasLeg=False
      hasRMB=False
      time.sleep(interval)
      if self.currentLeg and self.currentLeg.active:
        hasLeg=True
        if self.currentLeg.anchorDistance is not None:
          routerInfo = "Anchor watch, from %s, (anchor radius %dm)" % (
          unicode(self.currentLeg.fromWP),
           int(self.currentLeg.anchorDistance))
        else:
          routerInfo="from %s, to %s, route=%s, activeWp=%d, approach=%s (approach radius %dm)"%(unicode(self.currentLeg.fromWP)
                   if self.currentLeg.fromWP else "NONE",unicode(self.currentLeg.toWP) if self.currentLeg.toWP else "NONE",
                   self.currentLeg.name if self.currentLeg.name is not None else "NONE", self.currentLeg.currentTarget,
                   "TRUE" if self.currentLeg.approach else "FALSE",int(self.currentLeg.approachDistance))
        AVNLog.debug(routerInfo)
        self.setInfo("leg",routerInfo
                  ,AVNWorker.Status.RUNNING)
      try:
        if self.currentLeg is not None and self.currentLeg.anchorDistance is not None:
          self.computeAnchor()
        else:
          self.startStopAlarm(False,'anchor')
          self.startStopAlarm(False, 'gps')
          computeRMB=self.getBoolParam("computeRMB")
          computeAPB=self.getBoolParam("computeAPB")
          if computeRMB or computeAPB :
            hasRMB=self.computeRMB(computeRMB,computeAPB)
      except Exception as e:
        AVNLog.warn("exception in computeRMB %s, retrying",traceback.format_exc())
      try:
        self.computeApproach()
      except:
        AVNLog.warn("exception in computeApproach %s, retrying",traceback.format_exc())
      if (not hasLeg):
        self.setInfo("leg","no leg",AVNWorker.Status.INACTIVE)
      if (not hasRMB):
        self.setInfo("autopilot","no autopilot data",AVNWorker.Status.INACTIVE)
      try:
        curTPV = self.navdata.getMergedEntries("TPV", [])
        lat = curTPV.data.get('lat')
        lon = curTPV.data.get('lon')
        if lat is not None and lon is not None:
          self.startStopAlarm(False,'gps')
      except:
        pass
      AVNLog.debug("router main loop")

  def startStopAlarm(self,start,name='waypoint'):
    alert = self.findHandlerByName("AVNAlarmHandler")
    if alert is None:
      return
    if start:
      alert.startAlarm(name)
    else:
      alert.stopAlarm(name)
  #compute whether we are approaching the waypoint
  def computeApproach(self):
    if self.currentLeg is None:
      self.startStopAlarm(False)
      return
    if not self.currentLeg.active:
      self.startStopAlarm(False)
      return
    curGps=self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
    lat=curGps.get('lat')
    lon=curGps.get('lon')
    if lat is None or lon is None:
      self.startStopAlarm(False)
      return
    dst = AVNUtil.distanceM(self.wpToLatLon(self.currentLeg.toWP),(lat,lon));
    AVNLog.debug("approach current distance=%f",float(dst))
    if (dst > self.currentLeg.approachDistance):
      self.currentLeg.approach=False
      self.startStopAlarm(False)
      if (self.currentLeg.approach):
        #save leg
        self.setCurrentLeg(self.currentLeg)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    if not self.currentLeg.approach:
      self.startStopAlarm(True)
      self.currentLeg.approach=True
      #save the leg
      self.setCurrentLeg(self.currentLeg)
    AVNLog.info("Route: approaching wp %d (%s) currentDistance=%f",self.currentLeg.currentTarget,unicode(self.currentLeg.toWP),float(dst))
    if self.currentLeg.name is None:
      AVNLog.debug("Approach: no route active")
      return
    self.activeRouteName=self.currentLeg.name
    try:
      if self.activeRoute is None or self.activeRoute.name != self.activeRouteName:
        self.activeRoute=self.loadRoute(self.activeRouteName)
        if self.activeRoute is None:
          AVNLog.error("unable to load route %s, cannot make approach handling",self.currentLeg.name)
          return
    except:
      AVNLog.error("exception when loading route %s:%s",self.activeRouteName,traceback.format_exc())
      return
    nextWpNum=self.currentLeg.currentTarget+1
    hasNextWp=True
    nextDistance=0
    if nextWpNum >= self.activeRoute.get_points_no():
      AVNLog.debug("already at last WP of route %d",(nextWpNum-1))
      hasNextWp=False
    else:
      nextWp=self.activeRoute.points[nextWpNum]
      nextDistance=AVNUtil.distanceM((lat,lon),self.wpToLatLon(nextWp))
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
    if not hasNextWp:
      AVNLog.info("last WP of route reached, switch of routing")
      self.currentLeg.active=False
      self.currentLeg.approach=False
      self.currentLeg.name=None
      self.setCurrentLeg(self.currentLeg)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    #should we wait for some time???
    AVNLog.info("switching to next WP num=%d, wp=%s",nextWpNum,unicode(nextWp))
    self.currentLeg.currentTarget=nextWpNum
    self.currentLeg.fromWP=self.currentLeg.toWP
    self.currentLeg.toWP=nextWp
    self.currentLeg.approach=False
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.setCurrentLeg(self.currentLeg)

  #compute an RMB record and write this into the feeder
  #if we have an active leg
  def computeRMB(self,computeRMB,computeAPB):
    hasRMB=False
    #do the computation of some route data
    nmeaData="$GPRMB,A,,,,,,,,,,,,V,D*19\r\n"
    if self.currentLeg is not None and self.currentLeg.active:
      if self.startWp!=self.currentLeg.fromWP or self.endWp!=self.currentLeg.toWP:
        self.startWp=self.currentLeg.fromWP
        self.endWp=self.currentLeg.toWP
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
          AVNLog.debug("compute route data from %s to %s",unicode(self.startWp),unicode(self.endWp))
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
          if self.currentLeg.approach:
            arrival="A"
          else:
            arrival="V"
          wplat=NMEAParser.nmeaFloatToPos(self.endWp.latitude,True)
          wplon = NMEAParser.nmeaFloatToPos(self.endWp.longitude, False)
          destBearing=AVNUtil.calcBearing((lat,lon),self.wpToLatLon(self.endWp))
          brg=AVNUtil.calcBearing(self.wpToLatLon(self.startWp),self.wpToLatLon(self.endWp))
          self.setInfo("autopilot","RMB=%s,APB=%s:WpNr=%d,XTE=%s%s,DST=%s,BRG=%s,ARR=%s"%
                      (computeRMB,computeAPB,self.WpNr,XTE,LR,destDis,destBearing,arrival),AVNWorker.Status.NMEA)
          hasRMB=True
          if computeRMB:
            nmeaData = "GPRMB,A,%.2f,%s,%s,%s,%s,%s,%s,%s,%.1f,%.1f,%.1f,%s,A"% (
              XTE,LR,self.WpNr,self.WpNr+1,wplat[0],wplat[1],wplon[0],wplon[1],destDis,destBearing,kn,arrival)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s",nmeaData)
            self.feeder.addNMEA(nmeaData)
          if computeAPB:
            nmeaData = "GPAPB,A,A,%.2f,%s,N,%s,,%.1f,M,%s,%.1f,M,%.1f,M" % (XTE,LR,arrival,brg,self.WpNr + 1,destBearing,destBearing)
            nmeaData = "$" + nmeaData + "*" + NMEAParser.nmeaChecksum(nmeaData) + "\r\n"
            AVNLog.debug("adding NMEA %s", nmeaData, )
            self.feeder.addNMEA(nmeaData)
    return hasRMB
  ''' anchor watch
      will only be called if self.currentLeg.anchorDistance is not none
  '''
  def computeAnchor(self):
    curGps = self.navdata.getDataByPrefix(AVNStore.BASE_KEY_GPS,1)
    lat = curGps.get('lat')
    lon = curGps.get('lon')
    if lat is None or lon is None:
      self.startStopAlarm(False,'anchor')
      if self.activatedAlarms.get('gps') is None:
        self.startStopAlarm(True,'gps')
        self.activatedAlarms['gps']=True
      return
    if self.activatedAlarms.get('gps'):
      del self.activatedAlarms['gps']
    self.startStopAlarm(False,'gps')
    anchorDistance = AVNUtil.distanceM((lat, lon), self.wpToLatLon(self.currentLeg.fromWP))
    AVNLog.debug("Anchor distance %d, allowed %d",anchorDistance,self.currentLeg.anchorDistance)
    if anchorDistance > self.currentLeg.anchorDistance:
      self.startStopAlarm(True,'anchor')
    return
  def deleteRouteFromList(self,name):
    self.routeListLock.acquire()
    for i in range(0,len(self.routes)):
      if self.routes[i].name is not None and self.routes[i].name == name:
        self.routes.pop(i)
        self.routeListLock.release()
        return True
    self.routeListLock.release()
    return False

  #get a route from our internal list
  def getRouteFromList(self,name):
    rt=None
    self.routeListLock.acquire()
    for rt in self.routes:
      if rt.name is not None and rt.name == name:
        self.routeListLock.release()
        return rt
    self.routeListLock.release()
    return None

  def addRouteToList(self,route):
    self.routeListLock.acquire()
    for i in range(0,len(self.routes)):
      if self.routes[i].name is not None and self.routes[i].name == route.name:
        self.routes.pop(i)
        self.routes.append(route)
        self.routeListLock.release()
        return
    if len(self.routes) > 10:
      self.routes.pop(0)
    self.routes.append(route)
    self.routeListLock.release()

  def getHandledCommands(self):
    return {"api":"routing","download":"route","upload":"route"}

  #handle a routing request
  #this expects a command as parameter
  #data has the POST data
  def handleApiRequest(self,type,subtype,requestparam,**kwargs):
    if type == 'api':
      return self.handleRoutingRequest(requestparam)
    elif type=="upload":
      return self.handleRouteUploadRequest(requestparam,kwargs['rfile'],kwargs['flen'])
    elif type=="download":
      return self.handleRouteDownloadRequest(requestparam)
    raise Exception("unable to handle routing request of type %s:%s"%(type,subtype))
  def handleRoutingRequest(self,requestparam):
    command=self.getRequestParam(requestparam, 'command')

    if command is None:
      raise Exception('missing command for routing request')
    if (command == 'getleg'):
      return self.leg2Json(self.currentLeg)
    if (command == 'unsetleg'):
      self.setCurrentLeg(None)
      return {'status':'OK'}
    if (command == 'setleg'):
      data=self.getRequestParam(requestparam, 'leg')
      if data is None:
        data=self.getRequestParam(requestparam,'_json')
        if data is None:
          raise Exception("missing leg data for setleg")
      leg=self.parseLeg(data)
      if leg is None:
        raise Exception("invalid leg data %s"%(data))
      self.setCurrentLeg(leg)
      return {'status':'OK'}
    if (command == 'setroute'):
      data=self.getRequestParam(requestparam,'_json')
      if data is None:
        raise Exception("missing route for setroute")
      route=self.routeFromJsonString(data)
      AVNLog.info("saving route %s with %d points"%(route.name,len(route.points)))
      ignoreExisting=self.getRequestParam(requestparam,'ignoreExisting')
      self.saveRoute(route,True if (ignoreExisting is not None and ignoreExisting == "true") else False)
      return {'status':'OK'}
    if (command == 'getroute'):
      data=self.getRequestParam(requestparam, 'name')
      if data is None:
        return {'status':'no route name'}
      AVNLog.debug("load route %s"%(data))
      route=self.loadRoute(data)
      if route is None:
        return json.dumps({'status':'route'+data+' not found'})
      AVNLog.debug("get route %s"%(route.name))
      jroute=self.routeToJson(route)
      rinfo=self.routeInfos.get(data)
      if rinfo is not None:
        jroute['time']=rinfo.time
      return jroute
    if (command == 'deleteroute'):
      name=self.getRequestParam(requestparam, 'name')
      if name is None:
        return json.dumps({'status':'no route name'})
      if self.currentLeg is not None and self.currentLeg.name is not None and self.currentLeg.active and self.currentLeg.name == name:
        return {'status':'cannot delete active route'}
      self.deleteRouteFromList(name)
      self.deleteRouteInfo(name)
      fname=self.getRouteFileName(name)
      if os.path.exists(fname):
        try:
          os.unlink(fname)
        except:
          pass
      return {'status':'OK'}

    if (command == 'listroutes'):
      rt={'status':'OK'}
      infos=[]
      for ri in self.routeInfos:
        infos.append(self.routeInfos[ri].__dict__)
      rt['items']=infos
      return rt

    raise Exception("invalid command "+command)
  #download a route in xml format
  #this has 2 flavours:
  #either we have a name as parameter - in this case, download the route from us
  #otherwise we expected a JSON route as post param and send back this one
  #we need to ensure that we always return some data
  #otherwise we break the GUI
  def handleRouteDownloadRequest(self,requestparam):
    mtype = "application/gpx+xml"
    route=None
    try:
      name=self.getRequestParam(requestparam,"name")
      if name is not None and not name == "":
        AVNLog.debug("download route name=%s",name)
        route=self.loadRoute(name)
      else:
        data=self.getRequestParam(requestparam,'_json');
        if data is None:
          AVNLog.error("unable to find a route for download, returning an empty")
          return ""
        route=self.routeFromJsonString(data)
      if route is None:
          return "error - route not found"
      data=self.gpxFormat%(route.to_xml())
      stream=StringIO.StringIO(data)
      return {'size':len(data),'mimetype':mtype,'stream':stream}
    except:
      AVNLog.error("exception in route download %s",traceback.format_exc())
      return "error"

  #we expect a filename parameter...
  #TODO: should we check that the filename is the same like the route name?
  def handleRouteUploadRequest(self,requestparam,rfile,flen):
    fname=self.getRequestParam(requestparam,"filename")
    AVNLog.debug("route upload request for %s",fname)
    if flen > self.MAXROUTESIZE:
      raise Exception("route is to big, max allowed filesize %d: "%self.MAXROUTESIZE)
    try:
      data=rfile.read(flen)
      parser = gpxparser.GPXParser(data)
      gpx = parser.parse()
      if gpx.routes is None or len(gpx.routes)  == 0:
        raise "no routes in "+fname
      route=gpx.routes[0]
      if route is None:
        raise Exception("no route found in file")
      rinfo=self.routeInfos.get(route.name)
      if rinfo is not None:
        raise Exception("route with name "+route.name+" already exists")
      rinfo=AVNRouteInfo.fromRoute(route,AVNUtil.utcnow())
      self.routeInfos[route.name]=rinfo
      self.saveRoute(route)
      return
    except Exception as e:
      raise Exception("exception parsing "+fname+": "+e.message)
avnav_handlerList.registerHandler(AVNRouter)




    
          
  
