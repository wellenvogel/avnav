# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
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
import json

import shutil

from avnav_util import *
from avnav_worker import *
import xml.dom as dom
import xml.dom.minidom as parser
import avnav_handlerList



class ConfigChanger(object):
  def __init__(self,changeHandler,domBase,isAttached,elementDom,childMap):
    self.isAttached=isAttached
    self.domBase=domBase
    self.elementDom=elementDom
    self.childMap=childMap
    self.dirty=False
    self.changeHandler=changeHandler

  def acquireLock(self):
    self.changeHandler.acquireLock()
  def releaseLock(self):
    self.changeHandler.releaseLock()
  def _setDirty(self):
    self.dirty=True

  def handleChange(self, skip=False,lock=True):
    if not self.dirty:
      return
    if not self.changeHandler:
      return
    if skip:
      return
    self.changeHandler.dataChanged()
    self.dirty=False

  def _addToDom(self):
    if self.isAttached:
      return
    #we try some "insert before"
    tagName=self.elementDom.tagName
    newline = self.domBase.createTextNode("\n")
    existing=self.domBase.documentElement.getElementsByTagName(tagName)
    if existing is not None and existing.length > 0:
      lastExisting=existing[existing.length-1]
      nextSibling=lastExisting.nextSibling
      if nextSibling is not None:
        if nextSibling.nodeType == dom.Node.TEXT_NODE and nextSibling.nodeValue == "\n" and nextSibling.nextSibling is not None:
          nextSibling=nextSibling.nextSibling
        lastExisting.parentNode.insertBefore(self.elementDom,nextSibling)
        lastExisting.parentNode.insertBefore(newline, nextSibling)
      else:
        lastExisting.parentNode.appendChild(self.elementDom)
        lastExisting.parentNode.appendChild(newline)
    else:
      self.domBase.documentElement.appendChild(self.elementDom)
      self.domBase.documentElement.appendChild(newline)
    self.isAttached=True
    self._setDirty()

  def changeAttribute(self,name,value,delayUpdate=False):
    self.acquireLock()
    try:
      self._addToDom()
      self.elementDom.setAttribute(name,str(value))
      self._setDirty()
      if not delayUpdate:
        self.handleChange()
    finally:
      self.releaseLock()

  def changeChildAttribute(self,childName,childIndex,name,value,delayUpdate=False):
    if self.childMap is None:
      raise Exception("no dom, cannot change")
    self.acquireLock()
    try:
      self._addToDom()
      childList=self.childMap.get(childName)
      if childList is None:
        childList=[]
        self.childMap[childName]=childList
      if childIndex >= 0:
        if childIndex >= len(childList):
          raise Exception("trying to update an non existing child index %s:%d"%(childName,childIndex))
        childList[childIndex].setAttribute(name,str(value))
        self._setDirty()
        self.handleChange(delayUpdate,lock=False)
        return
      #we must insert
      newEl=self.domBase.createElement(childName)
      newEl.setAttribute(name,str(value))
      self.elementDom.appendChild(newEl)
      newline = self.domBase.createTextNode("\n")
      self.elementDom.appendChild(newline)
      childList.append(newEl)
      self._setDirty()
      self.handleChange(delayUpdate,lock=False)
    finally:
      self.releaseLock()
    return len(childList)-1

  def removeChild(self,childName,childIndex,delayUpdate=False):
    if self.childMap is None:
      raise Exception("no dom, cannot change")
    self.acquireLock()
    try:
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
      if not delayUpdate:
        self.handleChange(lock=False)
    finally:
      self.releaseLock()
    return

  def writeAll(self):
    self.acquireLock()
    try:
      self._addToDom()
      self._setDirty()
      self.handleChange()
    finally:
      self.releaseLock()

  def removeSelf(self):
    if not self.isAttached:
      return
    self.acquireLock()
    try:
      parentNode=self.elementDom.parentNode
      sibling = self.elementDom.nextSibling
      if sibling is not None:
        if sibling.nodeType == dom.Node.TEXT_NODE and sibling.nodeValue == "\n":
          # our inserted newline
          parentNode.removeChild(sibling)
      parentNode.removeChild(self.elementDom)
      self.elementDom.unlink()
      self._setDirty()
      self.handleChange(lock=False)
      self.isAttached=False
    finally:
      self.releaseLock()




# a class for parsing the config file
class AVNHandlerManager(object):
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
      if not isinstance(value, str):
        value = str(value)
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
    for k in list(cls.BASEPARAM.__dict__.keys()):
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

  def isDisabled(self):
    '''
    the httpserver will check all handlers for being disabled
    and thus needs this method
    :return:
    '''
    return False

  def __init__(self,canRestart=False):
    #global parameters
    self.parameters={
                     "debug":0,
                     "expiryTime":20, #time after which an entry is considered to be expired
                     }
    self.baseParam={} #parameters to be added to all handlers
    self.domObject=None
    self.cfgfileName=None
    self.currentCfgFileName=None #potentially this is the fallback file
    self.parseError=None
    self.navData=None
    self.canRestart=canRestart
    self.configLock=threading.Lock()
    self.shouldStop=False

  def setBaseParam(self,name,value):
    if not hasattr(self.BASEPARAM,name):
      raise Exception("invalid parameter for setBaseParam")
    self.baseParam[name]=value

  def createHandlerFromScratch(self,tagName,properties=None):
    ai = "<" + tagName + "/>"
    node = parser.parseString(ai)
    if node.documentElement.nodeType != dom.Node.ELEMENT_NODE or node.documentElement.tagName != tagName:
      raise Exception("invalid main node or main node name for autoInstantiate")
    for handler in avnav_handlerList.getAllHandlerClasses():
      name = handler.getConfigName()
      if name == tagName:
        if not handler.canDeleteHandler():
          raise Exception("unable to create handler of type %s"%tagName)
        if properties is not None:
          for k,v in properties.items():
            node.documentElement.setAttribute(k,str(v))
        return self.parseHandler(node.documentElement, handler, domAttached=False)
    raise Exception("handler type %s not found"%tagName)


  def readConfigAndCreateHandlers(self,filename,allowNoConfig=False):
    AVNLog.info("reading config %s",filename)
    AVNWorker.resetHandlerList()
    existingConfig=True
    if not os.path.exists(filename):
      if not allowNoConfig:
        AVNLog.error("unable to read config file %s",filename)
        return False
      existingConfig=False
    self.cfgfileName=filename
    self.currentCfgFileName=filename
    try:
      if not existingConfig:
        self.createEmptyDom()
      else:
        self.parseDomAndCreateHandlers(filename)
    except Exception as e:
      AVNLog.error("error parsing cfg file %s : %s",filename,traceback.format_exc())
      self.parseError=str(e)
      return False
    for handler in avnav_handlerList.getAllHandlerClasses():
      name=handler.getConfigName()
      ai=handler.autoInstantiate()
      if ai:
        existing=AVNWorker.findHandlerByName(name, True)
        if existing is None:
          AVNLog.info("auto instantiate for %s", name)
          if not isinstance(ai,str):
            ai="<"+name+"/>"
          try:
            node=parser.parseString(ai)
            if node.documentElement.nodeType != dom.Node.ELEMENT_NODE or node.documentElement.tagName != name:
              raise Exception("invalid main node or main node name for autoInstantiate")
            self.parseHandler(node.documentElement, handler, domAttached=False)
          except Exception:
              AVNLog.error("error parsing default config %s for %s:%s",ai,name,traceback.format_exc())
              return False
    return len(AVNWorker.getAllHandlers()) > 0


  def parseDomAndCreateHandlers(self,filename):
    self.domObject=parser.parse(filename)
    self.parseDomNode(self.domObject.documentElement)
  def createEmptyDom(self):
    ai = "<AVNServer></AVNServer>"
    self.domObject=parser.parseString(ai)
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

  def parseHandler(self, element, handlerClass, domAttached=True):
    configParam= handlerClass.getConfigParamCombined()
    if type(configParam) is list:
      cfg=handlerClass.parseConfigNew(element.attributes,configParam)
    else:
      cfg=handlerClass.parseConfig(element.attributes,configParam)
    childPointer={}
    child=element.firstChild
    while child is not None:
      if child.nodeType == dom.Node.ELEMENT_NODE:
        childName=child.tagName
        cfgDefaults= handlerClass.getConfigParamCombined(childName)
        if cfgDefaults is not None:
          if childPointer.get(childName) is None:
            childPointer[childName]=[]
          if cfg.get(childName) is None:
            cfg[childName]=[]
          AVNLog.debug("adding child %s to %s",childName,element.tagName)
          childPointer[childName].append(child)
          if type(cfgDefaults) is list:
            cfg[childName].append(handlerClass.parseConfigNew(child.attributes,cfgDefaults))
          else:
            cfg[childName].append(handlerClass.parseConfig(child.attributes,cfgDefaults))
      child=child.nextSibling
    cfg.update(self.baseParam)
    instance=handlerClass.createInstance(cfg)
    if instance is None:
      AVNLog.error("unable to instantiate handler %s",element.tagName)
    else:
      instance.setConfigChanger(ConfigChanger(self, self.domObject, domAttached, element, childPointer))
    return instance

  def acquireLock(self):
    self.configLock.acquire()

  def releaseLock(self):
    self.configLock.release()
  def dataChanged(self):
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
      raise Exception("unable to create fallback file %s, no valid xml: %s"%(dest,str(e)))

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
    if os.path.exists(self.currentCfgFileName):
      AVNLog.info("creating fallback config file %s",copyFile)
      self.copyFileWithCheck(self.currentCfgFileName,copyFile)
    self.houseKeepingCfgFiles()
    tmpName=self.cfgfileName+".tmp"
    if os.path.exists(tmpName):
      os.unlink(tmpName)
    fh=open(tmpName,"w",encoding="utf-8",errors='ignore')
    if fh is None:
      raise Exception("unable to open file %s"%tmpName)
    self.domObject.writexml(fh)
    fh.close()
    try:
      parser.parse(tmpName)
    except Exception as e:
      raise Exception("unable to read config after writing it, xml error: %s"%str(e))
    if os.path.exists(self.cfgfileName):
      os.unlink(self.cfgfileName)
    try:
      os.rename(tmpName,self.cfgfileName)
    except Exception as e:
      AVNLog.error("exception when finally renaming %s to %s: %s",tmpName,self.cfgfileName,str(e))
      raise

  def startHandlers(self,navData):
    self.navData=navData
    groups = set()
    for handler in AVNWorker.getAllHandlers():
      groups.add(handler.getStartupGroup())
    grouplist = list(groups)
    grouplist.sort()
    for group in grouplist:
      for handler in AVNWorker.getAllHandlers(disabled=True):
        try:
          if handler.getStartupGroup() == group:
            handler.startInstance(navData)
        except Exception:
          AVNLog.warn("unable to start handler : " + traceback.format_exc())
    AVNLog.info("All Handlers started")

  def getConfigName(self):
    return "Manager"

  def updateChangeCounter(self):
    self.navData.updateChangeCounter('config')
  def handleApiRequest(self,request,type,requestParam,**kwargs):

    if request == 'download':
      maxBytes=AVNUtil.getHttpRequestParam(requestParam,'maxBytes')
      if AVNLog.fhandler is None:
        raise Exception("logging not initialized")
      fname=AVNLog.fhandler.baseFilename
      if fname is None:
        raise Exception("unable to get log file")
      if not os.path.exists(fname):
        raise Exception("log %s not found"%fname)
      rt=AVNDownload(fname,lastBytes=maxBytes)
      return rt
    if request != "api":
      raise Exception("unknown request %s"%request)
    if type != 'config':
      raise Exception("unknown config request %s"%type)
    command=AVNUtil.getHttpRequestParam(requestParam,'command',mantadory=True)
    rt={'status':'OK'}
    if command == 'createHandler':
      tagName=AVNUtil.getHttpRequestParam(requestParam,'handlerName',mantadory=True)
      config=AVNUtil.getHttpRequestParam(requestParam,'_json',mantadory=True)
      handler=self.createHandlerFromScratch(tagName,json.loads(config))
      handler.configChanger.writeAll()
      handler.startInstance(self.navData)
      self.updateChangeCounter()
      rt['id']=handler.getId()
      return rt
    if command == 'getAddables':
      allHandlers = avnav_handlerList.getAllHandlerClasses()
      hlist = []
      for h in allHandlers:
        if h.canDeleteHandler():
          hlist.append(h.getConfigName())
      rt['data'] = hlist
      return rt
    if command == 'getAddAttributes':
      tagName = AVNUtil.getHttpRequestParam(requestParam, 'handlerName', mantadory=True)
      handlerClass = avnav_handlerList.findHandlerByConfigName(tagName)
      if handlerClass is None:
        raise Exception("unable to find handler for %s" % tagName)
      if not handlerClass.canDeleteHandler():
        raise Exception("handler %s cannot be added" % tagName)
      rt['data'] = handlerClass.getEditableParameters()
      return rt

    if command == 'canRestart':
      rt['canRestart']=self.canRestart
      return rt
    if command == 'restartServer':
      if not self.canRestart:
        raise Exception("AvNav cannot restart")
      self.shouldStop=True
      return rt

    id = AVNUtil.getHttpRequestParam(requestParam, 'handlerId', mantadory=False)
    child = AVNUtil.getHttpRequestParam(requestParam, 'child', mantadory=False)
    configName=AVNUtil.getHttpRequestParam(requestParam,'handlerName',mantadory=False)
    if command == 'getEditables':
      if id is None and configName is None:
        return AVNUtil.getReturnData(error="either id or handlerName must be provided")
      if id is not None:
        handler = AVNWorker.findHandlerById(int(id))
        if handler is None:
          return AVNUtil.getReturnData(error="unable to find handler for %s"%str(id))
      else:
        handler=AVNWorker.findHandlerByName(configName,disabled=True)
        if handler is None:
          return AVNUtil.getReturnData(error="unable to find handler for %s"%configName)
        if not handler.preventMultiInstance():
          return AVNUtil.getReturnData(error="can only find single instance handler by name")
      if child is not None:
        data = handler.getEditableChildParameters(child)
        canDelete = handler.canDeleteChild(child)
      else:
        data = handler.getEditableParameters(id=handler.getId())
        canDelete = handler.canDeleteHandler()
      if data is not None:
          rt['handlerId']=handler.getId()
          rt['data'] = data
          rt['values'] = handler.getParam(child, filtered=True)
          rt['configName'] = handler.getConfigName()
          rt['canDelete'] = canDelete
      return rt
    if id is None:
      return AVNUtil.getReturnData(error="missing parameter id")
    handler = AVNWorker.findHandlerById(int(id))
    if handler is None:
      raise Exception("unable to find handler for id %s" % id)
    if command == 'setConfig':
      values = AVNUtil.getHttpRequestParam(requestParam, '_json', mantadory=True)
      decoded = json.loads(values)
      handler.updateConfig(decoded, child)
      self.updateChangeCounter()
      AVNLog.info("updated %s, new config %s", handler.getName(), handler.getConfigString())
    elif command == 'deleteChild':
      if child is None:
        raise Exception("missing parameter child")
      AVNLog.info("deleting child %s for %s", child, handler.getName())
      handler.deleteChild(child)
      self.updateChangeCounter()
    elif command == 'deleteHandler':
      AVNLog.info("removing handler %s", handler.getName())
      AVNWorker.removeHandler(int(id))
      self.updateChangeCounter()

    else:
      raise Exception("unknown command %s" % command)
    return rt
