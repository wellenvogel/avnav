#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
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
from __main__ import traceback
sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","libraries"))
import gpxpy098.gpx as gpx
import gpxpy098.parser as gpxparser
import gpxpy098.utils as gpxutils
import gpxpy098.geo as geo
import xml.etree.ElementTree as ET

from avnav_util import *
from avnav_nmea import *
from avnav_worker import *
from avnav_data import *
from avnav_nmea import *


class AVNRoutingLeg():
  def __init__(self,name,fromWP,toWP,active,currentTarget,approachDistance,approach):
    self.name=name
    self.fromWP=fromWP
    self.toWP=toWP
    self.active=active
    self.currentTarget=currentTarget
    self.approachDistance=approachDistance if approachDistance is not None else 300
    self.approach = approach if approach is not None else False

  
  def __str__(self):
    return "AVNRoutingLeg route=%s,from=%s,to=%s,active=%s, target=%d, approachDistance=%s, approach=%s"\
           %(self.name,str(self.fromWP),str(self.toWP),self.active,self.currentTarget,str(self.approachDistance),"True" if self.approach else "False")
    
#routing handler
class AVNRouter(AVNWorker):
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
          "computeRMB":True #if set we compute AP control data
          };
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
    if dct.get('to') is None:
      return None
    currentTarget=dct.get('currentTarget')
    if currentTarget is None:
      currentTarget=-1
    return AVNRoutingLeg(
                  dct.get('name'),
                  gpx.GPXWaypoint(**self.convertToGpx(dct.get('from'))),
                  gpx.GPXWaypoint(**self.convertToGpx(dct.get('to'))),
                  dct.get('active'),
                  currentTarget,
                  dct.get('approachDistance'),
                  dct.get('approach')
                  )
  #convert a leg into json
  def leg2Json(self,leg):
    if leg is None:
      return {}
    dct={
         'from':self.convertFromGpx(leg.fromWP.__dict__),
         'to':self.convertFromGpx(leg.toWP.__dict__),
         'name':leg.name,
         'active':leg.active,
         'currentTarget':leg.currentTarget,
         'approachDistance':leg.approachDistance,
         'approach':leg.approach
         }
    return dct

  #get a simple tuple lat,lon from a WP
  #as this is used by our util functions
  def wpToLatLon(self,wP):
    return (wP.latitude,wP.longitude)
  
  def setCurrentLeg(self,leg):
    self.currentLeg=leg;
    if leg is None:
      if os.path.exists(self.currentLegFileName):
        os.unlink(self.currentLegFileName)
        AVNLog.info("current leg removed")
      return
    ls=self.leg2Json(leg)
    AVNLog.info("new leg %s",str(leg))
    f=open(self.currentLegFileName,"w")
    try:
      f.write(json.dumps(ls))
    except:
      f.close()
      raise
    f.close()

  def routeFromJson(self,routeJson):
    dct=json.loads(routeJson)
    if dct.get('name') is None:
      raise Exception("missing name in route")
    route=gpx.GPXRoute(**self.convertToGpx(dict((x,dct.get(x)) for x in ['name','description'])))
    points=dct.get('points')
    if points is not None:
      for p in points:
        rp=gpx.GPXRoutePoint(**self.convertToGpx(dict((x,p.get(x)) for x in ['name','lon','lat'])))
        route.points.append(rp)
    AVNLog.debug("routeFromJson: %s",str(route))
    return route

  def routeToJson(self,route):
    AVNLog.debug("routeToJson: %s",str(route))
    rt={'name':route.name,
        'points':[]
        }
    for p in route.points:
      rt['points'].append(self.convertFromGpx(p.__dict__))
    return json.dumps(rt)

  def getRouteFileName(self,name):
    return os.path.join(self.routesdir,name+u'.gpx')

  def saveRoute(self,route):
    filename=self.getRouteFileName(route.name)
    f=open(filename,"w")
    try:
      f.write(self.gpxFormat%(route.to_xml()))
    except:
      f.close()
      raise
    f.close()

  def loadRoute(self,name):
    filename=self.getRouteFileName(name)
    f=open(filename,"r")
    gpx_xml = f.read()
    f.close()
    parser = gpxparser.GPXParser(gpx_xml)
    gpx = parser.parse()
    if gpx.routes is None or len(gpx.routes) == 0:
      raise "no routes in "+name
    return gpx.routes[0]
    
        
  #this is the main thread - listener
  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getName()))
    interval=self.getIntParam('interval')
    routesdir=self.getStringParam("routesdir")
    if routesdir == "":
      routesdir=os.path.join(unicode(os.path.dirname(sys.argv[0])),u'routes')
    self.routesdir=routesdir
    if not os.path.isdir(self.routesdir):
      AVNLog.info("creating routes directory %s"%(self.routesdir))
      os.makedirs(self.routesdir,0755)
    self.currentLegFileName=os.path.join(self.routesdir,self.currentLegName)
    if os.path.exists(self.currentLegFileName):
      try:
        f=open(self.currentLegFileName,"r")
        strleg=f.read(2000)
        self.currentLeg=self.parseLeg(strleg)
        distance=geo.length([self.currentLeg.fromWP,self.currentLeg.toWP])
        AVNLog.info("read current leg, route=%s, from=%s, to=%s, length=%fNM"%(self.currentLeg.name,
                                                                  str(self.currentLeg.fromWP),str(self.currentLeg.toWP),distance/AVNUtil.NM))
        if self.currentLeg.name is not None:
          self.activeRouteName=self.currentLeg.name
      except:
        AVNLog.error("error parsing current leg %s: %s"%(self.currentLegFileName,traceback.format_exc()))
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
        self.setInfo("leg","from %s, to %s, route=%s, activeWp=%d, approach=%s (approach radius %dm)"%
                   (str(self.currentLeg.fromWP) if self.currentLeg.fromWP else "NONE",str(self.currentLeg.toWP) if self.currentLeg.toWP else "NONE",
                   self.currentLeg.name if self.currentLeg.name is not None else "NONE", self.currentLeg.currentTarget,
                   "TRUE" if self.currentLeg.approach else "FALSE",int(self.currentLeg.approachDistance))
                  ,AVNWorker.Status.RUNNING)
      try:
        if self.getBoolParam("computeRMB"):
          hasRMB=self.computeRMB()
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
      AVNLog.debug("router main loop")

  #compute whether we are approaching the waypoint
  def computeApproach(self):
    if self.currentLeg is None:
      return
    if not self.currentLeg.active:
      return
    curTPV=self.navdata.getMergedEntries("TPV", [])
    lat=curTPV.data.get('lat')
    lon=curTPV.data.get('lon')
    if lat is None or lon is None:
      return
    dst = AVNUtil.distanceM(self.wpToLatLon(self.currentLeg.toWP),(lat,lon));
    AVNLog.debug("approach current distance=%f",float(dst))
    if (dst > self.currentLeg.approachDistance):
      self.currentLeg.approach=False
      if (self.currentLeg.approach):
        #save leg
        self.setCurrentLeg(self.currentLeg)
      self.lastDistanceToCurrent=None
      self.lastDistanceToNext=None
      return
    if not self.currentLeg.approach:
      self.currentLeg.approach=True
      #save the leg
      self.setCurrentLeg(self.currentLeg)
    AVNLog.info("Route: approaching wp %d (%s) currentDistance=%f",self.currentLeg.currentTarget,str(self.currentLeg.toWP),float(dst))
    if self.currentLeg.name is None:
      AVNLog.debug("Approach: not route active")
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
    AVNLog.info("switching to next WP num=%d, wp=%s",nextWpNum,str(nextWp))
    self.currentLeg.currentTarget=nextWpNum
    self.currentLeg.fromWP=self.currentLeg.toWP
    self.currentLeg.toWP=nextWp
    self.currentLeg.approach=False
    self.lastDistanceToCurrent=None
    self.lastDistanceToNext=None
    self.setCurrentLeg(self.currentLeg)

  #compute an RMB record and write this into the feeder
  #if we have an active leg
  def computeRMB(self):
    hasRMB=False
    #do the computation of some route data
    nmeaData="$GPRMB,A,,,,,,,,,,,,V,D*19\r\n"
    if self.currentLeg and self.currentLeg.active:
      if self.startWp!=self.currentLeg.fromWP or self.endWp!=self.currentLeg.toWP:
        self.startWp=self.currentLeg.fromWP
        self.endWp=self.currentLeg.toWP
        self.WpNr+=1

      if self.startWp is not None and self.endWp is not None:
        curTPV=self.navdata.getMergedEntries("TPV", [])
        lat=curTPV.data.get('lat')
        lon=curTPV.data.get('lon')
        kn=curTPV.data.get('speed')
        if kn is None:
          kn=""
        #we could have speed(kn) or course(deg) in curTPV
        #they are basically as decoded by gpsd
        if lat is not None and lon is not None:
          AVNLog.debug("compute route data from %s to %s",str(self.startWp),str(self.endWp))
          XTE=AVNUtil.calcXTE((lat,lon), self.wpToLatLon(self.startWp), self.wpToLatLon(self.endWp))/float(AVNUtil.NM)
          if XTE < 0:
            LR="L"
          else:
            LR="R"
          XTE=abs(XTE)
          if XTE>9.99:
            XTE=9.99
          XTE="%.2f"%(XTE)
          destDis=AVNUtil.distance((lat,lon),self.wpToLatLon(self.endWp))
          if destDis>999.9:
            destDis=999.9
          if destDis<0.1:
            arrival="A"
          else:
            arrival="V"
          destDis="%.1f"%(destDis)
          destBearing="%.1f"%AVNUtil.calcBearing((lat,lon),self.wpToLatLon(self.endWp))
          nmeaData="GPRMB,A,"+XTE+","+LR+","+"%s"%(self.WpNr)+","+"%s"%(self.WpNr+1)+",,,,,"+destDis+","+destBearing+","+"%s"%kn+","+arrival+",A"
          nmeaData="$"+nmeaData+"*"+NMEAParser.nmeaChecksum(nmeaData)+"\r\n"
          self.setInfo("autopilot","GPRMB:WpNr=%d,XTE=%s%s,DST=%s,BRG=%s,ARR=%s"%
                      (self.WpNr,XTE,LR,destDis,destBearing,arrival),AVNWorker.Status.NMEA)
          hasRMB=True
          AVNLog.debug("adding NMEA %s",nmeaData,)
          self.feeder.addNMEA(nmeaData)
    return hasRMB

  #get a HTTP request param
  def getRequestParam(self,requestparam,name):
    rt=requestparam.get(name)
    if rt is None:
      return None
    if isinstance(rt,list):
      return rt[0]
    return rt
  
  #handle a routing request
  #this expects a command as parameter
  #data has the POST data
  def handleRoutingRequest(self,requestparam):
    command=self.getRequestParam(requestparam, 'command')
    
    if command is None:
      raise Exception('missing command for routing request')
    if (command == 'getleg'):
      return json.dumps(self.leg2Json(self.currentLeg))
    if (command == 'unsetleg'):
      self.setCurrentLeg(None)
      return json.dumps({'status':'OK'})
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
      return json.dumps({'status':'OK'})  
    if (command == 'setroute'):
      data=self.getRequestParam(requestparam,'_json');
      if data is None:
        raise Exception("missing route for setroute")
      route=self.routeFromJson(data)
      AVNLog.info("saving route %s with %d points"%(route.name,len(route.points)))
      self.saveRoute(route)
      return json.dumps({'status':'OK'})  
    if (command == 'getroute'):
      data=self.getRequestParam(requestparam, 'name')
      if data is None:
        return json.dumps({'status':'no route name'})
      if not os.path.exists(self.getRouteFileName(data)):
        return json.dumps({'status':'route '+data+' not found'})
      route=self.loadRoute(data)
      AVNLog.debug("get route %s"%(route.name))
      return self.routeToJson(route)

    raise Exception("invalid command "+command)
      
    
          
  
