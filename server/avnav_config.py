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

from avnav_util import *
from avnav_worker import *
import xml.dom as dom
import xml.dom.minidom as parser
import avnav_handlerList
  
  
# a class for parsing the config file
class AVNConfig():
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
    self.domObject=None
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
      self.parseDomAndCreateHandlers(filename)
    except:
      AVNLog.error("error parsing cfg file %s : %s",filename,traceback.format_exc())
      return False
    for handler in avnav_handlerList.getAllHandlerClasses():
      name=handler.getConfigName()
      ai=handler.autoInstantiate()
      if ai:
        existing=AVNWorker.findHandlerByName(name, True)
        if existing is None:
          AVNLog.info("auto instantiate for %s", name)
          if isinstance(ai,str):
            try:
              node=parser.parseString(ai)
              if node.documentElement.nodeType != dom.Node.ELEMENT_NODE or node.documentElement.tagName != name:
                raise Exception("invalid xml for autoInstantiate: %s",ai)
              self.parseHandler(node.documentElement,handler)
            except Exception:
              AVNLog.error("error parsing default config %s for %s:%s",ai,name,sys.exc_info()[1])
              return False
          else:
            cfg=handler.parseConfig({}, handler.getConfigParam(None))
            cfg.update(self.baseParam)
            handler.createInstance(cfg)
    return len(AVNWorker.getAllHandlers()) > 0


  def parseDomAndCreateHandlers(self,filename):
    self.domObject=parser.parse(filename)
    self.parseDomNode(self.domObject.documentElement)

  def parseDomNode(self,node):
    """
    parse a node from the dom tree
    @param
    @return:
    """
    if node.nodeType != dom.Node.ELEMENT_NODE and node.nodeType != dom.Node.DOCUMENT_NODE:
      return
    name=node.tagName
    handler=avnav_handlerList.findHandlerByConfigName(name)
    if handler is not None:
      AVNLog.info("parsing entry for handler %s",name)
      self.parseHandler(node,handler)
    else:
      nextElement=node.firstChild
      while nextElement is not None:
        self.parseDomNode(nextElement)
        nextElement=nextElement.nextSibling

  def parseHandler(self,element,handlerClass):
    cfg=handlerClass.parseConfig(element.attributes,handlerClass.getConfigParam(None))
    childPointer={}
    child=element.firstChild
    while child is not None:
      if child.nodeType == dom.Node.ELEMENT_NODE:
        childName=child.tagName
        cfgDefaults=handlerClass.getConfigParam(childName)
        if cfgDefaults is not None:
          if childPointer.get(childName) is None:
            childPointer[childName]=[]
          if cfg.get(childName) is None:
            cfg[childName]=[]
          AVNLog.debug("adding child %s to %s",childName,element.tagName)
          childPointer[childName].append(child)
          cfg[childName].append(handlerClass.parseConfig(child.attributes,cfgDefaults))
      child=child.nextSibling
    cfg.update(self.baseParam)
    instance=handlerClass.createInstance(cfg)
    if instance is None:
      AVNLog.error("unable to instantiate handler %s",element.tagName)
    else:
      instance.setDomNode(element,childPointer)

