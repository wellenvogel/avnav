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
import logging
import logging.handlers
import datetime
import itertools
import os
import threading
import subprocess
import math
import re
import sys
import ctypes
import traceback

VERSION="0.9.1"

class Enum(set):
    def __getattr__(self, name):
        if name in self:
            return name
        raise AttributeError


class LogFilter(logging.Filter):
  def __init__(self,filter):
    self.filterre=re.compile(filter,re.I)
  def filter(self, record):
    if (self.filterre.search(record.msg)):
      return True
    if (self.filterre.search(record.threadName)):
      return True
    return False

class AVNLog():
  logger=logging.getLogger('avn')
  consoleHandler=None
  fhandler=None
  debugToFile=False
  logDir=None
  
  #1st step init of logging - create a console handler
  #will be removed after parsing the cfg file
  @classmethod
  def initLoggingInitial(cls,level):
    try:
      numeric_level=level+0
    except:
      numeric_level = getattr(logging, level.upper(), None)
      if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % level)
    formatter=logging.Formatter("%(asctime)s-%(process)d-%(threadName)s-%(levelname)s-%(message)s")
    cls.consoleHandler=logging.StreamHandler()
    cls.consoleHandler.setFormatter(formatter)
    cls.logger.propagate=False
    cls.logger.addHandler(cls.consoleHandler)
    cls.logger.setLevel(numeric_level)
    cls.filter=None
  
  @classmethod
  def levelToNumeric(cls,level):
    try:
      numeric_level=int(level)+0
    except:
      numeric_level = getattr(logging, level.upper(), None)
      if not isinstance(numeric_level, int):
        raise ValueError('Invalid log level: %s' % level)
    return numeric_level
    
  @classmethod
  def initLoggingSecond(cls,level,filename,debugToFile=False):
    numeric_level=cls.levelToNumeric(level)
    formatter=logging.Formatter("%(asctime)s-%(process)d-%(threadName)s-%(levelname)s-%(message)s")
    if not cls.consoleHandler is None :
      cls.consoleHandler.setLevel(numeric_level)
    version="2.7"
    try:
      version=sys.version.split(" ")[0][0:3]
    except:
      pass
    if version != '2.6':
      cls.fhandler=logging.handlers.TimedRotatingFileHandler(filename=filename,when='midnight',backupCount=7,delay=True)
      cls.fhandler.setFormatter(formatter)
      cls.fhandler.setLevel(logging.INFO if not debugToFile else numeric_level)
      cls.logger.addHandler(cls.fhandler)
    cls.logger.setLevel(numeric_level)
    cls.debugToFile=debugToFile
    cls.logDir=os.path.dirname(filename)
  
  @classmethod
  def changeLogLevel(cls,level):
    try:
      numeric_level=cls.levelToNumeric(level)
      if not cls.logger.getEffectiveLevel() == numeric_level:
        cls.logger.setLevel(numeric_level)
      if not cls.consoleHandler is None:
        cls.consoleHandler.setLevel(numeric_level)
      if cls.debugToFile:
        if cls.fhandler is not None:
          cls.fhandler.setLevel(numeric_level)
        pass
      return True
    except:
      return False
  @classmethod
  def setFilter(cls,filter):
    if cls.filter is not None:
      cls.consoleHandler.removeFilter(cls.filter)
      if cls.fhandler is not None:
        cls.fhandler.removeFilter(cls.filter)
      cls.filter=None
    if filter is None:
      return
    cls.filter=LogFilter(filter)
    cls.consoleHandler.addFilter(cls.filter)
    if cls.fhandler is not None:
      cls.fhandler.addFilter(cls.filter)


  @classmethod
  def debug(cls,str,*args,**kwargs):
    cls.logger.debug(str,*args,**kwargs)
  @classmethod
  def warn(cls,str,*args,**kwargs):
    cls.logger.warn(str,*args,**kwargs)
  @classmethod
  def info(cls,str,*args,**kwargs):
    cls.logger.info(str,*args,**kwargs)
  @classmethod
  def error(cls,str,*args,**kwargs):
    cls.logger.error(str,*args,**kwargs)
  @classmethod
  def ld(cls,*parms):
    cls.logger.debug(' '.join(itertools.imap(repr,parms)))
  @classmethod
  def getLogDir(cls):
    return cls.logDir
  
  #some hack to get the current thread ID
  #basically the constant to search for was
  #__NR_gettid - __NR_SYSCALL_BASE+224
  #taken from http://blog.devork.be/2010/09/finding-linux-thread-id-from-within.html
  #this definitely only works on the raspberry - but on other systems the info is not that important...
  @classmethod
  def getThreadId(cls):
    try:
      SYS_gettid = 224
      libc = ctypes.cdll.LoadLibrary('libc.so.6')
      tid = libc.syscall(SYS_gettid)
      return unicode(tid)
    except:
      return "0"



class AVNUtil():
  NAVXML="avnav.xml"
  NM=1852.0; #convert nm into m
  R=6371000; #earth radius in m
  #convert a datetime UTC to a timestamp in seconds
  @classmethod
  def datetimeToTsUTC(cls,dt):
    if dt is None:
      return None
    #subtract the EPOCH
    td = (dt - datetime.datetime(1970,1,1, tzinfo=None))
    ts=((td.days*24*3600+td.seconds)*10**6 + td.microseconds)/1e6
    return ts

  #timedelta total_seconds that is not available in 2.6
  @classmethod
  def total_seconds(cls,td):
    return (td.microseconds + (td.seconds+td.days*24*3600)*10**6)/10**6
  
  #now timestamp in utc
  @classmethod
  def utcnow(cls):
    return cls.datetimeToTsUTC(datetime.datetime.utcnow())
  
  #check if a given position is within a bounding box
  #all in WGS84
  #ll parameters being tuples lat,lon
  #currently passing 180� is not handled...
  #lowerleft: smaller lat,lot
  @classmethod
  def inBox(cls,pos,lowerleft,upperright):
    if pos[0] < lowerleft[0]:
      return False
    if pos[1] < lowerleft[1]:
      return False
    if pos[0] > upperright[1]:
      return False
    if pos[1] > upperright[1]:
      return False
    return True
  
  # Haversine formula example in Python
  # Author: Wayne Dyck
  #distance in M
  @classmethod
  def distanceM(cls,origin, destination):
    lat1, lon1 = origin
    lat2, lon2 = destination

    dlat = math.radians(lat2-lat1)
    dlon = math.radians(lon2-lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + math.cos(math.radians(lat1)) \
        * math.cos(math.radians(lat2)) * math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    d = (cls.R * c )
    return d

  #distance in NM
  @classmethod
  def distance(cls,origin,destination):
    rt=cls.distanceM(origin,destination);
    return rt/float(cls.NM);

  #XTE - originally from Dirk HH, crosschecked against
  #http://www.movable-type.co.uk/scripts/latlong.html
  #points are always tuples lat,lon
  @classmethod
  def calcXTE(cls,Pp, startWp, endWp):
    d13 = cls.distanceM(startWp,Pp);
    w13 = cls.calcBearing(startWp,Pp)
    w12 = cls.calcBearing(startWp,endWp)
    return math.asin(math.sin(d13/cls.R)*math.sin(math.radians(w13)-math.radians(w12))) * cls.R

  #bearing from one point the next originally by DirkHH
  #http://www.movable-type.co.uk/scripts/latlong.html
  @classmethod
  def calcBearing(cls,curP,endP):
    clat,clon=curP
    elat,elon=endP
    y = math.sin(math.radians(elon)-math.radians(clon)) * math.cos(math.radians(elat))
    x = math.cos(math.radians(clat))*math.sin(math.radians(elat)) - \
        math.sin(math.radians(clat))*math.cos(math.radians(elat))*math.cos(math.radians(elon)-math.radians(clon))
    return ((math.atan2(y, x)*180/math.pi)+360)%360.0

  #convert AIS data (and clone the data)
  #positions / 600000
  #speed/10
  #course/10
  @classmethod
  def convertAIS(cls,aisdata):
    rt=aisdata.copy()
    rt['lat']=float(aisdata['lat'])/600000
    rt['lon']=float(aisdata['lon'])/600000
    rt['speed']=float(aisdata['speed'])/10  
    rt['course']=float(aisdata['course'])/10  
    rt['mmsi']=unicode(aisdata['mmsi'])
    return rt
  
  #parse an ISO8601 t8ime string
  #see http://stackoverflow.com/questions/127803/how-to-parse-iso-formatted-date-in-python
  #a bit limited to what we write into track files or what GPSD sends us
  #returns a datetime object
  @classmethod
  def gt(cls,dt_str):
    dt, delim, us= dt_str.partition(".")
    if delim is None or delim == '':
      dt=dt.rstrip("Z")
    dt= datetime.datetime.strptime(dt, "%Y-%m-%dT%H:%M:%S")
    if not us is None and us != "":
      us= int(us.rstrip("Z"), 10)
    else:
      us=0
    return dt + datetime.timedelta(microseconds=us)
  
  #return a regex to be used to check for NMEA data
  @classmethod
  def getNMEACheck(cls):
    return re.compile("[!$][A-Z][A-Z][A-Z][A-Z]")
  
  #run an external command and and log the output
  #param - the command as to be given to subprocess.Popen
  @classmethod
  def runCommand(cls,param,threadName=None):
    if not threadName is None:
      threading.current_thread().setName("[%s]%s"%(AVNLog.getThreadId(),threadName))
    cmd=subprocess.Popen(param,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,close_fds=True)
    while True:
      line=cmd.stdout.readline()
      if not line:
        break
      AVNLog.debug("[cmd]%s",line.strip())
    cmd.poll()
    return cmd.returncode

  @classmethod
  def importFromDir(cls,mdir,scope):
    """import all pythin files in a directory
       into the callers scope
       inspired by https://gitlab.com/aurelien-lourot/importdir/tree/master
       """
    regexp="(.+)\.py(c?)$"
    names=set()
    for entry in os.listdir(mdir):
      if os.path.isfile(os.path.join(mdir, entry)):
        regexp_result = re.search(regexp, entry)
        if regexp_result:  # is a module file name
          names.add(regexp_result.groups()[0])
    sys.path.append(mdir)
    for module_name in sorted(names):  # for each found module...
      try:
        scope[module_name] = __import__(module_name)
      except:
        print "error importing module %s"%module_name,traceback.format_exc()

  @classmethod
  def getHttpRequestParam(cls,requestparam,name):
    rt = requestparam.get(name)
    if rt is None:
      return None
    if isinstance(rt, list):
      return rt[0].decode('utf-8', errors='ignore')
    return rt
