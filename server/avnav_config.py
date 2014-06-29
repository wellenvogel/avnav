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
  
  
# a class for parsing the config file
class AVNConfig(sax.handler.ContentHandler):
  def __init__(self,handlerList):
    self.handlerList=handlerList
    #global parameters
    self.parameters={
                     "debug":0,
                     "expiryTime":20, #time after which an entry is considered to be expired
                     }
    self.currentHandlerClass=None
    self.currentHandlerData=None
    self.handlerInstances=None
    sax.handler.ContentHandler.__init__(self)
    pass
  
  def readConfigAndCreateHandlers(self,filename):
    AVNLog.info("reading config %s",filename)
    if not os.path.exists(filename):
      AVNLog.error("unable to read config file %s",filename)
      return False
    try:
      self.currentHandlerData=None
      self.currentHandlerClass=None
      self.handlerInstances=[]
      parser=sax.parse(filename,self)
    except:
      AVNLog.error("error parsing cfg file %s : %s",filename,traceback.format_exc())
      return None
    return self.handlerInstances
    
  def startElement(self, name, attrs):
    if not self.currentHandlerClass is None:
      #we are at a child element
      #currently we ignore any deeper nesting
      childParamDefaults=self.currentHandlerClass.getConfigParam(name)
      if childParamDefaults is None:
        return
      childParam=AVNWorker.parseConfig(attrs,childParamDefaults)
      if self.currentHandlerData.get(name) is None:
        self.currentHandlerData[name]=[]
      self.currentHandlerData[name].append(childParam)
      AVNLog.ld("added sub to handlerdata",name,childParam)
      return
    for handler in self.handlerList:
      if name==handler.getConfigName():
        self.currentHandlerClass=handler
        self.currentHandlerData=handler.parseConfig(attrs, handler.getConfigParam(None))
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
    nextInstance=self.currentHandlerClass.createInstance(self.currentHandlerData)
    if not nextInstance is None:
      self.handlerInstances.append(nextInstance)
    else:
      AVNLog.warn("unable to create instance for handler %s",name)
    self.currentHandlerClass=None
    self.currentHandlerData=None   
    pass
  def characters(self, content): 
    pass
