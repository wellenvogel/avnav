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

import re
import time

import threading
import copy
from avnav_util import Enum, AVNLog

class ParamValueError(Exception):
  pass

class WorkerParameter(object):
  T_STRING='STRING'
  T_NUMBER='NUMBER'
  T_FLOAT = 'FLOAT'
  T_BOOLEAN='BOOLEAN'
  T_SELECT='SELECT'
  T_FILTER='FILTER'

  PREDEFINED_DESCRIPTIONS={
    T_FILTER: 'separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters'
  }

  def __init__(self,name,default=None,type=None,rangeOrList=None,description=None,editable=True):
    self.name=name
    self.type=type if type is not None else self.T_STRING
    self.default=default
    self.rangeOrList=rangeOrList
    if description is None:
      description=self.PREDEFINED_DESCRIPTIONS.get(type)
    self.description=description or ''
    self.editable=editable

  def serialize(self):
    return self.__dict__

  @classmethod
  def filterNameDef(cls,plist):
    rt={}
    for p in plist:
      rt[p.name]=p.default
    return rt

  @classmethod
  def checkValueFor(cls,plist,name,value):
    for p in plist:
      if p.name == name:
        return p.checkValue(value)
    raise ParamValueError("%s not found in parameters"%name)

  def checkValue(self,value):
    if self.type == self.T_STRING:
      return str(value)
    if self.type == self.T_NUMBER or self.type == self.T_FLOAT:
      if self.type == self.T_FLOAT:
        rv=float(value)
      else:
        rv=int(value)
      if self.rangeOrList is not None and len(self.rangeOrList) == 2:
        if rv < self.rangeOrList[0] or rv > self.rangeOrList[1]:
          raise ParamValueError("value %f for %s out of range %s"%(rv,self.name,",".join(self.rangeOrList)))
      return rv
    if self.type == self.T_BOOLEAN:
      if value == True or value == False:
        return value
      if type(value) is str:
        return value.upper()=="TRUE"
      return True if value else False
    if self.type == self.T_SELECT:
      if self.rangeOrList is None:
        raise ValueError("no select list for %s"%self.name)
      for cv in self.rangeOrList:
        if type(cv) is dict:
          if value == cv.get('value'):
            return cv
        else:
          if value == cv:
            return value
      raise ValueError("value %s for %s not in list %s"%(str(value),self.name,",".join(self.rangeOrList)))
    if self.type == self.T_FILTER:
      #TODO: some filter checks
      return str(value)
    return value



class WorkerStatus(object):
  INACTIVE='INACTIVE'
  STARTED='STARTED'
  RUNNING='RUNNING'
  NMEA='NMEA'
  ERROR='ERROR'
  ALL_STATES=[INACTIVE,STARTED,RUNNING,NMEA,ERROR]
  def __init__(self,name,status,info,timeout=None):
    if not status in self.ALL_STATES:
      status=self.INACTIVE
    self.status=status
    self.info=info
    self.name=name
    self.modified=time.time()
    self.timeout=timeout

  def update(self,status,info,timeout=None):
    old=self.status
    if not status in self.ALL_STATES:
      status=self.INACTIVE
    rt=False
    if old != status:
      rt=True
    self.status=status
    self.info=info
    self.modified=time.time()
    if timeout is not None:
      self.timeout=timeout
    return rt

  def expired(self):
    if self.timeout is None or self.timeout <=0:
      return False
    now = time.time()
    if now < self.modified or (self.modified + self.timeout):
      return True
    return False

  def toDict(self):
    if self.expired():
      return None
    rt={
      'info':self.info,
      'status':self.status,
      'name':self.name
    }
    return rt

  def __str__(self) -> str:
    return "STATUS[%s] %s, %s"%(self.name,self.status,self.info)


class AVNWorker(threading.Thread):
  handlerListLock=threading.Lock()
  """a base class for all workers
     this provides some config functions and a common interfcace for handling them"""
  allHandlers=[] #the list of all instantiated handlers
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
  def findHandlerById(cls,id):
    for handler in cls.allHandlers:
      if handler.id == id:
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

  @classmethod
  def canEdit(cls):
    return False
  @classmethod
  def canDelete(cls):
    return False

  @classmethod
  def getEditableParameters(cls):
    if not cls.canEdit():
      return None
    parameterDescriptions=cls.getConfigParam()
    if type(parameterDescriptions) is not list:
      return None
    rt=[]
    for pd in parameterDescriptions:
      if not pd.editable:
        continue
      rt.append(pd)
    return rt

  
  def __init__(self,cfgparam):
    self.handlerListLock.acquire()
    id=0
    try:
      self.allHandlers.append(self) #fill the static list of handlers
      id=len(self.allHandlers) - 1
    finally:
      self.handlerListLock.release()
    self.id=id
    self.param=cfgparam
    self.status=False
    threading.Thread.__init__(self)
    self.setDaemon(True)
    self.setName(self.getName())
    self.status={'main':WorkerStatus('main',WorkerStatus.STARTED,"started")}
    self.type=self.Type.DEFAULT
    self.feeder=None
    self.configChanger=None #reference for writing back to the DOM
    self._stop=False
    self.condition=threading.Condition()
  def setConfigChanger(self, changer):
    self.configChanger=changer
  def getStatusProperties(self):
    return {}
  def getInfo(self):
    try:
      st=self.status.copy()
      rta=[]
      for k,v in st.items():
        try:
          elem=v.toDict()
          if elem is not None:
            rta.append(elem)
        except:
          pass
      return {'name':self.getStatusName(),'items':rta}
    except:
      return {'name':self.getStatusName(),'items':[],'error':"no info available"}
  def setInfo(self,name,info,status):
    existing=self.status.get(name)
    if existing:
      if existing.update(status,info):
        AVNLog.info("%s",str(existing))
        return True
    else:
      ns=WorkerStatus(name,status,info)
      self.status[name]=ns
      AVNLog.info("%s",str(ns))
  def deleteInfo(self,name):
    if self.status.get(name) is not None:
      try:
        del self.status[name]
      except:
        pass
  def getId(self):
    return self.id


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



  def checkConfig(self,param):
    '''
    check the config valaues against the defined ones
    and return a dict with the converted values
    @param param:
    @return:
    '''
    cfgs=self.getEditableParameters()
    if cfgs is None:
      raise Exception("no editable parameters")
    rt={}
    for k,v in param.items():
      cv=WorkerParameter.checkValueFor(cfgs,k,v)
      rt[k]=cv
    return rt
  def updateConfig(self,param):
    '''
    change of config parameters
    the handler must update its data and store the values using changeMultiConfig, changeChildConfig
    @param param: a dictonary with the keyes matching the keys from getEditableParameters
    @type param: dict
    @return:
    '''
    checked = self.checkConfig(param)
    self.changeMultiConfig(checked)


  def shouldStop(self):
    return self._stop
  #stop any child process (will be called by signal handler)
  def stop(self):
    self._stop=True
    self.condition.acquire()
    try:
      self.condition.notifyAll()
    finally:
      self.condition.release()


  def wait(self,time):
    self.condition.acquire()
    try:
      self.condition.wait(time)
    finally:
      self.condition.release()

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

  def changeMultiConfig(self,values):
    if self.param is None:
      raise Exception("unable to set param")
    if self.configChanger is None:
      raise Exception("unable to store changed config")
    hasChanges=False
    for k,v in values.items():
      old=self.getParamValue(k)
      if old != v:
        self.configChanger.changeAttribute(k,v,delayUpdate=True)
        hasChanges=True
        self.param[k] = v
    if hasChanges:
      self.configChanger.handleChange()

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
    AVNLog.info("starting %s with config %s",self.getName(),self.getConfigString())
    self.navdata=navdata
    self.feeder = self.findFeeder(self.getStringParam('feederName'))
    self.start()

  def getConfigString(self,cfg=None):
    rt=""
    if cfg is None:
      cfg=self.param
    for k,v in cfg.items():
      if rt != "":
        rt+=","
      if type(v) is dict:
        rt+="%s=%s"%(k,self.getConfigString(v))
      elif type(v) is list:
        rt+="%s=["%k
        for item in v:
          rt+=self.getConfigString(item)+","
        rt+="]"
      else:
        rt+="%s=%s"%(k,str(v))
    return rt

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
 
  