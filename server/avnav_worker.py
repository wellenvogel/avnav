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
from builtins import str

import re
import threading
import copy
from avnav_util import Enum, AVNLog

__author__="Andreas"
__date__ ="$29.06.2014 21:09:10$"

class AVNWorker(threading.Thread):
  """a base class for all workers
     this provides some config functions and a common interfcace for handling them"""
  allHandlers=[] #the list of all instantiated handlers
  Status=Enum(['INACTIVE','STARTED','RUNNING','NMEA','ERROR'])
  Type=Enum(['DEFAULT','FEEDER','HTTPSERVER'])

  @classmethod
  def findHandlerByTypeAndName(cls, type, name=None):
    """find a handler by its type and name (not configName)
       leave the name unset to find by type
       do not find any disabled handler
    """
    if not name is None and name == '':
      name = None
    rt = None
    for handler in cls.allHandlers:
      if handler.type == type and not handler.isDisabled():
        if not name is None:
          if handler.getName() == name:
            rt = handler
            break
        else:
          rt = handler
          break
    return rt
  @classmethod
  def resetHandlerList(cls):
    cls.allHandlers=[]
  @classmethod
  def findFeeder(cls,feedername):
    """find a feeder by its name (not configName)"""
    return cls.findHandlerByTypeAndName(cls.Type.FEEDER,feedername)
  
  @classmethod
  def findHandlerByName(cls,name,disabled=False):
    """find a handler by its config name"""
    for handler in cls.allHandlers:
      if handler.getConfigName() == name and (not handler.isDisabled() or disabled):
        return handler
    return None

  @classmethod
  def getAllHandlers(cls,disabled=False):
    """get the list of all instantiated handlers
    :param disabled if set to true also return disabled handler
    """
    rt=[]
    for h in cls.allHandlers:
      if not h.isDisabled() or disabled:
        rt.append(h)
    return rt

  @classmethod
  def autoInstantiate(cls):
    """should we instantiate this handler even without config?
       instantiation can still be prevented by setting enabled=false
    """
    return False
  
  def __init__(self,cfgparam):
    self.allHandlers.append(self) #fill the static list of handlers
    self.param=cfgparam
    self.status=False
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(self.getName())
    self.info={'main':"started"}
    self.status={'main':self.Status.STARTED}
    self.type=self.Type.DEFAULT
    self.feeder=None
    self.configChanger=None #reference for writing back to the DOM
  def setConfigChanger(self, changer):
    self.configChanger=changer
  def getStatusProperties(self):
    return {}
  def getInfo(self):
    try:
      rt=self.info.copy()
      st=self.status.copy()
      rta=[]
      for k in list(rt.keys()):
        try:
          elem={}
          elem['name']=k
          elem['info']=rt[k]
          elem['status']=st[k]
          rta.append(elem)
        except:
          pass
      return {'name':self.getStatusName(),'items':rta}
    except:
      return {'name':self.getStatusName(),'items':[],'error':"no info available"}
  def setInfo(self,name,info,status):
    self.info[name]=info
    self.status[name]=status
  def deleteInfo(self,name):
    if self.info.get(name) is not None:
      del self.info[name]
    if self.status.get(name) is not None:
      del self.status[name]
  def getParam(self):
    try:
      return self.param
    except:
      return {}
  def getParamValue(self,name,throw=False):
    rt=self.getParam().get(name)
    if rt is None:
      if throw:
        raise Exception("parameter %s not found in config %s"%(name,self.getConfigName()))
      else:
        return None
    return rt
  def getIntParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    try:
      return int(rt or 0)
    except Exception as e:
      if not throw:
        return 0
      else:
        raise e
      
  
  def getBoolParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return False
    else:
      return str(rt).upper()=='TRUE'
    
  def getStringParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    if rt is None:
      return ""
    else:
      if (isinstance(rt,str)):
        return rt
      return str(rt)
  def getFloatParam(self,name,throw=False):
    rt=self.getParamValue(name,throw)
    try:
      return float(rt or 0)
    except Exception as e:
      if not throw:
        return 0
      else:
        raise e
  def isDisabled(self):
    """is this handler set to disabled?"""
    en=self.getParamValue("enabled")
    if en is None:
      en="True"
    return str(en).upper()!='TRUE'

    
  
  #stop any child process (will be called by signal handler)
  def stopChildren(self):
    pass
  #should be overridden
  def getName(self):
    n=self.getParamValue('name')
    if n is not None and n != '':
      return n
    return re.sub("^AVN", "", self.getConfigName())

  def getStatusName(self):
    rt=re.sub("^AVN", "", self.getConfigName())
    n = self.getParamValue('name')
    if n is not None and n != '':
      return "%s(%s)"%(rt,n)
    return rt

  def getThreadPrefix(self):
    '''
    nicely compute the name prefix for a thread
    if we have the default name (just from the config name) - avoid to have this twice
    @return:
    '''
    n=self.getName()
    if "AVN%s"%n == self.getConfigName():
      return "[ %s]-%s"%(AVNLog.getThreadId(),n)
    else:
      return "[ %s]-%s-%s" % (AVNLog.getThreadId(), self.getConfigName(),n)

  def getSourceName(self,defaultSuffix=None):
    '''
    get the name for the data source
    @param defaultSuffix:
    @return: returns either the explicitely set name or the default name appended by the suffix
    '''
    rt=self.getParamValue('name')
    if rt is not None and rt != "":
      return rt
    if defaultSuffix is None:
      defaultSuffix="?"
    return "%s-%s"%(self.getName(),defaultSuffix)

  def changeConfig(self,name,value):
    if self.param is None:
      raise Exception("unable to set param")
    if self.configChanger is None:
      raise Exception("unable to store changed config")
    old=self.getParamValue(name)
    if old != value:
      self.configChanger.changeAttribute(name,value)
      self.param[name] = value

  def changeChildConfig(self,childName,childIndex,name,value,delayWriteOut=False):
    if self.param is None:
      raise Exception("unable to set param")
    if self.configChanger is None:
      raise Exception("unable to store changed config")
    rt=childIndex
    childList=self.param.get(childName)
    if childList is None:
      childList=[]
      self.param[childName]=childList
    if not isinstance(childList,list):
      raise Exception("param %s is no childlist"%childName)
    if childIndex >= 0 and childIndex >= len(childList):
      raise Exception("trying to change a non existing child %s:%d"%(childName,childIndex))
    current=None
    if childIndex < 0:
      current={}
      childList.append(current)
      rt=len(childList)-1
    else:
      current=childList[childIndex]
    old=current.get(name)
    if old != value:
      self.configChanger.changeChildAttribute(childName,childIndex,name,value,delayWriteOut)
      current[name] = value
    return rt

  def writeConfigChanges(self):
    if self.configChanger is None:
      return
    self.configChanger.handleChange()

  def removeChildConfig(self,childName,childIndex):
    if self.param is None:
      raise Exception("unable to set param")
    if self.configChanger is None:
      raise Exception("unable to store changed config")
    childList=self.param.get(childName)
    if childList is None:
      childList=[]
      self.param[childName]=childList
    if not isinstance(childList,list):
      raise Exception("param %s is no childlist"%childName)
    if childIndex < 0 or childIndex >= len(childList):
      raise Exception("trying to delete a non existing child %s:%d"%(childName,childIndex))
    self.configChanger.removeChild(childName,childIndex)
    childList.pop(childIndex)

  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    return cls.__name__
  #return the default cfg values
  #if the parameter child is set, the parameter for a child node
  #must be returned, child nodes are added to the parameter dict
  #as an entry with childnodeName=[] - the child node configs being in the list
  @classmethod
  def getConfigParam(cls,child=None):
    raise Exception("getConfigParam must be overwritten")

  DEFAULT_CONFIG_PARAM={
    'name':''
  }

  @classmethod
  def preventMultiInstance(cls):
    """overwrite this to return true if you only allow one instance
       will only be used if you do not overwrite createInstance
    """
    return False
  @classmethod
  def createInstance(cls,cfgparam):
    if cls.preventMultiInstance():
      cls.checkSingleInstance()
    instance =cls(cfgparam)
    return instance
  #parse an config entry
  @classmethod
  def parseConfig(cls,attrs,default):
    sparam=copy.deepcopy(default)
    if len(list(sparam.keys())) == 0:
      #special case: accept all attributes
      for k in list(attrs.keys()):
        v=attrs[k]
        if v is None or isinstance(v,str) or isinstance(v,str):
          sparam[k]=v
        else:
          sparam[k] = v.value
      return sparam
    sparam.update(cls.DEFAULT_CONFIG_PARAM)
    for k in list(sparam.keys()):
      dv=sparam[k]
      if (isinstance(dv,str)):
        sparam[k]=dv
      v=attrs.get(k)
      if dv is None and v is None:
        raise Exception(cls.getConfigName()+": missing mandatory parameter "+k)
      if v is None:
        sparam[k]=dv
      else:
        if isinstance(v,str) or isinstance(v,str):
          sparam[k]=v
        else:
          sparam[k] = v.value
    return sparam
  
  def startInstance(self,navdata):
    self.navdata=navdata
    self.feeder = self.findFeeder(self.getStringParam('feederName'))
    self.start()

  def writeData(self,data,source=None,addCheckSum=False):
    if self.feeder is None:
      raise Exception("no feeder in %s"%(self.getName()))
    self.feeder.addNMEA(data,source,addCheckSum)


  def getHandledCommands(self):
    """get the API commands that will be handled by this instance
       the return must either be a single string or a dict
       of the form {'api':'route','download':'route','upload':'route','list':'route'}
    """
    return None

  def handleApiRequest(self,type,command,requestparam,**kwargs):
    """
    handle an http request , handling/parameter/return depend on type
    raise an exception on error
    :param type:
           api - return a json with the response
           download: return a dict with: mimetype,size,stream
           upload: -- (exception on error)
           list: dict with {status:OK,items:[]}, items: list of dict{name:xxx,time:xxx}
    :param command: the (sub)command
    :param requestparam: the HTTP request parameter
    :param kwargs: on upload: rfile,flen
    :return: json
    """
    raise Exception("handler for %s:%s not implemented in %s"%(type,command,self.getConfigName()))
    
  #we have 2 startup groups - one for the feeders and 2 for the rest
  #by default we start in groupd 2
  @classmethod
  def getStartupGroup(cls):
    return 2
  @classmethod
  def checkSingleInstance(cls):
    """"
    check that we only run in one instance
    workers that rely on running only once should call this in createInstance
    """
    other=cls.findHandlerByName(cls.getConfigName())
    if not other is None:
      raise Exception("there is already a handler with %s, cannot create another one"%(cls.getConfigName()))
 
  