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


class AVNRoutingLeg():
  def __init__(self,name,fromWP,toWP,active,currentTarget):
    self.name=name
    self.fromWP=fromWP
    self.toWP=toWP
    self.active=active
    self.currentTarget=currentTarget

  
  def __str__(self):
    return "AVNRoutingLeg route=%s,from=%s,to=%s,active=%s, target=%d"%(self.name,str(self.fromWP),str(self.toWP),self.active,self.currentTarget)
    
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
          "feederName":''
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
                  currentTarget
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
         'currentTarget':leg.currentTarget
         }
    return dct 
  
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
    feeder=self.findFeeder(self.getStringParam('feederName'))
    while True:
      time.sleep(interval)
      try:
        #do the computation of some route data
        if self.currentLeg:
          startWp=self.currentLeg.fromWP
          endWp=self.currentLeg.toWP
          if startWp is not None and endWp is not None:
            curTPV=self.navdata.getMergedEntries("TPV", [])
            lat=curTPV.data.get('lat')
            lon=curTPV.data.get('lon')
            #we could have speed(kn) or course(deg) in curTPV
            #they are basically as decoded by gpsd
            if lat is not None and lon is not None:
              AVNLog.debug("compute route data from %s to %s",str(startWp),str(endWp))
              #do the computation here using e.g. geo
              #see some lines above for a distance
              nmeaData="$XXXaha\n"
              AVNLog.debug("adding NMEA %s",nmeaData,)
              feeder.addNMEA(nmeaData)
          pass
        else:
          pass
      except Exception as e:
        AVNLog.warn("exception in router %s, retrying",traceback.format_exc())
  
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
      
    
          
  
