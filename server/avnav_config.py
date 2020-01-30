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

import os
import pprint
import xml.sax as sax
import traceback
from avnav_util import *
from avnav_worker import *
import avnav_handlerList
  
  
# a class for parsing the config file
class AVNConfig(sax.handler.ContentHandler):
  class BASEPARAM(Enum):
    BASEDIR='BASEDIR' #the base directory for the server - location of the main python file
    DATADIR='DATADIR' #the data directory if not provided on the commandline: either parent dir of chart dir or $HOME/avnav

  @classmethod
  def getDirWithDefault(cls, parameters, name, defaultSub=None, belowData=True):
    '''
    return a directory performing some substitutions:
      user replacement
      prepending basedir if not abs
    @param parameters:  the parameters from our worker
    @param name:        the config name for the dir
    @param defaultSub:  if set, return this as a default (otherwise return None if not set )
    @param belowData:   if true: DATADIR as basedir, otherwise BASEDIR
    @return:
    '''
    value = parameters.get(name)
    defName = cls.BASEPARAM.BASEDIR if not belowData else cls.BASEPARAM.DATADIR
    baseDir=parameters.get(defName)
    if baseDir is None:
      raise Exception("%s not found in parameters"%defName)
    if value is not None and value:
      if not isinstance(value, unicode):
        value = unicode(value, errors='ignore')
      value=os.path.expanduser(value)
      value=AVNUtil.replaceParam(value,cls.filterBaseParam(parameters))
      if not os.path.isabs(value):
          if value.startswith(baseDir):
            return value
          return os.path.join(baseDir,value)
      return value
    if defaultSub is None :
      return None
    if not defaultSub:
      #empty sub
      return baseDir
    return os.path.join(baseDir,defaultSub)

  @classmethod
  def filterBaseParam(cls,dict):
    '''
    filter the base parameter out of the existing paramneters
    :param dict: the dict with the current parameters
    :return: a dictionary with all baseparameters (if they are set)
    '''
    rt={}
    if dict is None:
      return rt
    for k in cls.BASEPARAM.__dict__.keys():
      if dict.get(k) is not None:
        rt[k]=dict[k]
    return rt
  def __init__(self):
    #global parameters
    self.parameters={
                     "debug":0,
                     "expiryTime":20, #time after which an entry is considered to be expired
                     }
    self.baseParam={} #parameters to be added to all handlers
    self.currentHandlerClass=None
    self.currentHandlerData=None
    self.restrictedHandler=None
    sax.handler.ContentHandler.__init__(self)
    pass
  def setBaseParam(self,name,value):
    if not hasattr(self.BASEPARAM,name):
      raise Exception("invalid parameter for setBaseParam")
    self.baseParam[name]=value
  def readConfigAndCreateHandlers(self,filename):
    AVNLog.info("reading config %s",filename)
    if not os.path.exists(filename):
      AVNLog.error("unable to read config file %s",filename)
      return False
    try:
      self.currentHandlerData=None
      self.currentHandlerClass=None
      parser=sax.parse(filename,self)
    except:
      AVNLog.error("error parsing cfg file %s : %s",filename,traceback.format_exc())
      return False
    for handler in avnav_handlerList.getAllHandlerClasses():
      ai=handler.autoInstantiate()
      if ai:
        existing=AVNWorker.findHandlerByName(handler.getConfigName(), True)
        if existing is None:
          AVNLog.info("auto instantiate for %s", handler.getConfigName())
          if isinstance(ai,str):
            try:
              self.restrictedHandler=handler
              parser=sax.parseString(ai,self)
              self.restrictedHandler=None
            except Exception:
              AVNLog.error("error parsing default config %s for %s:%s",ai,handler.getConfigName(),sys.exc_info()[1])
              return False
          else:
            cfg=handler.parseConfig({}, handler.getAllConfigParam(None))
            cfg.update(self.baseParam)
            handler.createInstance(cfg)
    return len(AVNWorker.getAllHandlers()) > 0
    
  def startElement(self, name, attrs):
    if not self.currentHandlerClass is None:
      #we are at a child element
      #currently we ignore any deeper nesting
      childParamDefaults=self.currentHandlerClass.getAllConfigParam(name)
      if childParamDefaults is None:
        return
      childParam=AVNWorker.parseConfig(attrs,childParamDefaults)
      if self.currentHandlerData.get(name) is None:
        self.currentHandlerData[name]=[]
      self.currentHandlerData[name].append(childParam)
      AVNLog.ld("added sub to handlerdata",name,childParam)
      return
    handler=avnav_handlerList.findHandlerByConfigName(name)
    if self.restrictedHandler is not None:
      if self.restrictedHandler.getConfigName() != name:
        raise Exception("invalid xml for default config, expected %s, got %s"%(self.restrictedHandler.getConfigName(),name))
    if handler is not None:
      self.currentHandlerClass=handler
      self.currentHandlerData=handler.parseConfig(attrs, handler.getAllConfigParam(None))
      AVNLog.ld("handler config started for ",name,self.currentHandlerData)
      return
    AVNLog.warn("unknown XML element %s - ignoring",name)
    pass
  def endElement(self, name):
    if self.currentHandlerClass is None:
      return
    if not self.currentHandlerClass.getConfigName() == name:
      return #only create the handler when we are back at the handler level
    AVNLog.info("creating instance for %s with param %s",name,pprint.pformat(self.currentHandlerData))
    self.currentHandlerData.update(self.baseParam)
    nextInstance=self.currentHandlerClass.createInstance(self.currentHandlerData)
    if nextInstance is None:
      AVNLog.warn("unable to create instance for handler %s",name)
    self.currentHandlerClass=None
    self.currentHandlerData=None   
    pass
  def characters(self, content): 
    pass
