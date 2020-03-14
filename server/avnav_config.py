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
import codecs
import shutil

from avnav_util import *
from avnav_worker import *
import xml.dom as dom
import xml.dom.minidom as parser
import avnav_handlerList


class ConfigChanger:
  def __init__(self,changeHandler,domBase,isAttached,elementDom,childMap):
    self.isAttached=isAttached
    self.domBase=domBase
    self.elementDom=elementDom
    self.childMap=childMap
    self.dirty=False
    self.changeHandler=changeHandler

  def _setDirty(self):
    self.dirty=True

  def handleChange(self, skip=False):
    if not self.dirty:
      return
    if not self.changeHandler:
      return
    if skip:
      return
    self.changeHandler.dataChanged()

  def _addToDom(self):
    if self.isAttached:
      return
    self.domBase.documentElement.appendChild(self.elementDom)
    newline=self.domBase.createTextNode("\n")
    self.domBase.documentElement.appendChild(newline)
    self._setDirty()

  def changeAttribute(self,name,value):
    self._addToDom()
    self.elementDom.setAttribute(name,unicode(value))
    self._setDirty()
    self.handleChange()

  def changeChildAttribute(self,childName,childIndex,name,value,delayUpdate=False):
    if self.childMap is None:
      raise Exception("no dom, cannot change")
    self._addToDom()
    childList=self.childMap.get(childName)
    if childList is None:
      childList=[]
      self.childMap[childName]=childList
    if childIndex >= 0:
      if childIndex >= len(childList):
        raise Exception("trying to update an non existing child index %s:%d"%(childName,childIndex))
      childList[childIndex].setAttribute(name,unicode(value))
      self._setDirty()
      self.handleChange(delayUpdate)
      return
    #we must insert
    newEl=self.domBase.createElement(childName)
    newEl.setAttribute(name,unicode(value))
    self.elementDom.appendChild(newEl)
    newline = self.domBase.createTextNode("\n")
    self.elementDom.appendChild(newline)
    childList.append(newEl)
    self._setDirty()
    self.handleChange(delayUpdate)
    return len(childList)-1

  def removeChild(self,childName,childIndex):
    if self.childMap is None:
      raise Exception("no dom, cannot change")
    childList=self.childMap.get(childName)
    if childList is None:
      return
    if childIndex < 0 or childIndex >= len(childList):
      raise Exception("trying to update an non existing child index %s:%d"%(childName,childIndex))
    self._addToDom()
    childNode=childList[childIndex]
    sibling=childNode.nextSibling
    if sibling is not None:
      if sibling.nodeType == dom.Node.TEXT_NODE and sibling.nodeValue == "\n":
        #our inserted newline
        self.elementDom.removeChild(sibling)
    self.elementDom.removeChild(childNode)
    childList[childIndex].unlink()
    childList.pop(childIndex)
    self._setDirty()
    self.handleChange()
    return

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

  @classmethod
  def getFallbackName(cls,cfgname,initial=False):
    if initial:
      return cfgname+".initial"
    else:
      return cfgname+".ok"
  @classmethod
  def getInvalidName(cls,fileName):
    now = datetime.datetime.utcnow()
    return fileName + ".invalid-" + now.strftime("%Y%m%d%H%M%S")

  def __init__(self):
    #global parameters
    self.parameters={
                     "debug":0,
                     "expiryTime":20, #time after which an entry is considered to be expired
                     }
    self.baseParam={} #parameters to be added to all handlers
    self.domObject=None
    self.cfgfileName=None
    self.currentCfgFileName=None #potentially this is the fallback file
    pass
  def setBaseParam(self,name,value):
    if not hasattr(self.BASEPARAM,name):
      raise Exception("invalid parameter for setBaseParam")
    self.baseParam[name]=value
  def readConfigAndCreateHandlers(self,filename):
    AVNLog.info("reading config %s",filename)
    AVNWorker.resetHandlerList()
    if not os.path.exists(filename):
      AVNLog.error("unable to read config file %s",filename)
      return False
    self.cfgfileName=filename
    self.currentCfgFileName=filename
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
                raise Exception("invalid main node or main node name for autoInstantiate")
              self.parseHandler(node.documentElement,handler,noDom=True)
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

  def parseHandler(self,element,handlerClass,noDom=False):
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
      instance.setConfigChanger(ConfigChanger(self,self.domObject,not noDom,element, childPointer))

  def dataChanged(self):
    #TODO: do some checks?
    self.writeChanges()

  def houseKeepingCfgFiles(self):
    dir = os.path.dirname(self.cfgfileName)
    if not os.path.isdir(dir):
      return
    base=os.path.basename(self.cfgfileName)
    CFGMAX = 20
    for pattern in ["-",".invalid-"]:
      allBackups=[]
      for f in os.listdir(dir):
        if not f.startswith(base+pattern):
          continue
        if f == base or f == self.getFallbackName(base):
          continue
        full=os.path.join(dir,f)
        if not os.path.isfile(full):
          continue
        allBackups.append(f)
      allBackups.sort()
      #just keep the last 20 backups - maybe configure this...
      for f in allBackups[0:-CFGMAX]:
        full=os.path.join(dir,f)
        AVNLog.debug("removing old backup %s",full)
        try:
          os.unlink(full)
        except:
          AVNLog.error("unable to remove old cfg file %s:%s",full,traceback.format_exc())

  def getBackupName(self,fileName):
    now=datetime.datetime.utcnow()
    return fileName+"-"+now.strftime("%Y%m%d%H%M%S")



  def copyFileWithCheck(self,src,dest,skipExisting=True):
    if skipExisting and os.path.exists(dest):
      return
    dir = os.path.dirname(dest)
    if not os.path.isdir(dir):
      raise Exception("directory for %s does not exist" % dest)
    if not os.access(dir, os.W_OK):
      raise Exception("cannot write into directory for %s" % dest)
    if os.path.exists(dest):
      os.unlink(dest)
    shutil.copyfile(src,dest)
    osize = os.path.getsize(src)
    fsize = os.path.getsize(dest)
    if osize != fsize:
      raise Exception("unable to create fallback file %s, sizes different after copy" % dest)
    try:
      parser.parse(dest)
    except Exception as e:
      raise Exception("unable to create fallback file %s, no valid xml: %s"%(dest,e.message))

  def writeChanges(self):
    if self.cfgfileName is None:
      raise Exception("no cfg file set")
    if self.domObject is None:
      raise Exception("no dom available")
    dir=os.path.dirname(self.cfgfileName)
    fallback=self.getFallbackName(self.cfgfileName)
    backupFile=self.getBackupName(self.cfgfileName)
    copyFile=backupFile
    if not os.path.isfile(fallback):
      copyFile=fallback
    AVNLog.info("creating fallback config file %s",copyFile)
    self.copyFileWithCheck(self.currentCfgFileName,copyFile)
    self.houseKeepingCfgFiles()
    tmpName=self.cfgfileName+".tmp"
    if os.path.exists(tmpName):
      os.unlink(tmpName)
    fh=codecs.open(tmpName,"w",encoding="utf-8",errors='ignore')
    if fh is None:
      raise Exception("unable to open file %s"%tmpName)
    self.domObject.writexml(fh, encoding="utf-8")
    fh.close()
    try:
      parser.parse(tmpName)
    except Exception as e:
      raise Exception("unable to read config after writing it, xml error: %s"%e.message)
    os.unlink(self.cfgfileName)
    try:
      os.rename(tmpName,self.cfgfileName)
    except Exception as e:
      AVNLog.error("exception when finally renaming %s to %s: %s",tmpName,self.cfgfileName,e.message)
      raise


