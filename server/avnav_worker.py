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
import traceback

import time

import threading
import copy

from avnav_nmea import NMEAParser
from avnav_store import AVNStore
from avnav_util import Enum, AVNLog
import sys
import os

class ParamValueError(Exception):
  pass

class WorkerParameter(object):
  T_STRING='STRING'
  T_NUMBER='NUMBER'
  T_FLOAT = 'FLOAT'
  T_BOOLEAN='BOOLEAN'
  T_SELECT='SELECT'
  T_FILTER='FILTER'
  ALL_TYPES=[T_STRING,T_NUMBER,T_BOOLEAN,T_FLOAT,T_SELECT,T_FILTER]
  VALUE_TYPES=[T_STRING,T_NUMBER,T_BOOLEAN,T_FLOAT]
  RANGE_TYPES=[T_NUMBER,T_FLOAT]
  PREDEFINED_DESCRIPTIONS={
    T_FILTER: ', separated list of sentences either !AIVDM or $RMC - for $ we ignore the 1st 2 characters'
  }

  def __init__(self,name,
               default=None,
               type=None,
               rangeOrList=None,
               description=None,
               editable=True,
               mandatory=None,
               condition=None,
               valuetype=None):
    self.name=name
    self.type=type if type is not None else self.T_STRING
    if self.type not in self.ALL_TYPES:
      raise ParamValueError("invalid parameter type %s"%self.type)
    self.default=default
    self.rangeOrList=rangeOrList
    if description is None:
      description=self.PREDEFINED_DESCRIPTIONS.get(type)
    self.description=description or ''
    self.editable=editable
    self.mandatory=mandatory if mandatory is not None else default is None
    self.condition=condition #a dict with name:value that must match for visbility
    if self.type == self.T_SELECT:
      self.valuetype=self.T_STRING if valuetype is None else valuetype
      if self.valuetype not in self.VALUE_TYPES:
        raise ParamValueError("invalid valuetype %s"%self.valuetype)
    else:
      self.valuetype=self.type if self.type != self.T_FILTER else self.T_STRING

  def _getValue(self,val):
    if self.valuetype == self.T_NUMBER:
      return int(val)
    if self.valuetype == self.T_FLOAT:
      return float(val)
    if self.valuetype == self.T_BOOLEAN:
      if val == True or val == False:
        return val
      if type(val) is str:
        return val.upper()=="TRUE"
      return True if val else False
    return str(val)

  def serialize(self):
    return self.__dict__

  def setValue(self,name,value):
    if not hasattr(self,name):
      raise ParamValueError("invalid parameter %s"%name)
    return self.__setattr__(name,value)

  def copy(self,resolveList=True,**kwargs):
    rt= WorkerParameter(self.name,
                           default=self.default,
                           type=self.type,
                           rangeOrList=None,
                           description=self.description,
                           editable=self.editable,
                           mandatory=self.mandatory,
                           condition=self.condition,
                           valuetype=self.valuetype)
    if resolveList:
      if callable(self.rangeOrList):
        rt.rangeOrList=self.rangeOrList()
      else:
        if self.rangeOrList is not None:
          rt.rangeOrList=list(self.rangeOrList)
    else:
      if callable(self.rangeOrList):
        rt.rangeOrList=self.rangeOrList
      else:
        if self.rangeOrList is not None:
          rt.rangeOrList=list(self.rangeOrList)
    for k in self.__dict__.keys():
      nv=kwargs.get(k)
      if nv is not None:
        rt.__setattr__(k,nv)
    return rt

  @classmethod
  def updateParamFor(cls, plist, paramName, vdict):
    for p in plist:
      if p.name == paramName:
        for k,v in vdict.items():
          if k == 'name':
            continue
          p.setValue(k,v)
        return

  @classmethod
  def checkValuesFor(cls,plist,newParam,existingParam=None):
    rt={}
    for k,v in newParam.items():
      param=next((x for x in plist if x.name == k), None)
      if param is None:
        continue
      rt[k]=param.checkValue(v)
    for p in plist:
      if p.mandatory:
        if not p.name in rt and (existingParam is None or not p.name in existingParam):
          raise ParamValueError("missing mandatory parameter %s"%p.name)
    return rt

  @classmethod
  def filterEditables(clscls,plist,makeCopy=True):
    rt=[]
    for p in plist:
      if p.editable:
        if callable(p.rangeOrList):
          rt.append(p.copy())
        else:
          if makeCopy:
            rt.append(p.copy())
          else:
            rt.append(p)
    return rt

  @classmethod
  def filterByList(cls,plist,pdict,addDefaults=False):
    rt={}
    for p in plist:
      if p.name in pdict:
        rt[p.name]=pdict.get(p.name)
      else:
        if addDefaults and p.default is not None:
          rt[p.name]=p.default
    return rt

  def checkValue(self,value,rangeOrListCheck=True):
    if value is None and self.default is None:
      if not self.mandatory:
        return None
      raise ParamValueError("missing mandatory parameter %s"%self.name)
    try:
      tvalue=self._getValue(value)
    except Exception as e:
        raise ParamValueError("invalid value for %s:%s"%(self.name,str(e)))
    if not rangeOrListCheck:
      return tvalue
    if self.type in self.RANGE_TYPES:
      if self.rangeOrList is not None and len(self.rangeOrList) == 2:
        if tvalue < self._getValue(self.rangeOrList[0]) or tvalue > self._getValue(self.rangeOrList[1]):
          raise ParamValueError("value %s for %s out of range %s"%(
            str(tvalue),self.name,",".join(map(lambda v: str(v),self.rangeOrList))))
      return tvalue
    if self.type != self.T_SELECT or not rangeOrListCheck:
      return tvalue
    if self.rangeOrList is None:
      raise ValueError("no select list for %s"%self.name)
    checkList=self.rangeOrList if not callable(self.rangeOrList) else self.rangeOrList()
    for cv in checkList:
        cmp=cv
        if type(cv) is dict:
          cmp=cv.get('value')
        cmp=self._getValue(cmp)
        if cmp == tvalue:
          return tvalue
    raise ValueError("value %s for %s not in list %s"%(str(value),self.name,",".join(
        list(map(lambda x:str(x),checkList)))))

  def fromDict(self,valueDict,check=True,rangeOrListCheck=True):
    rt=valueDict.get(self.name)
    if rt is None:
      rt=self.default
    if check:
      return self.checkValue(rt,rangeOrListCheck=rangeOrListCheck)
    return rt



class UsedResource(object):
  T_SERIAL='serial'
  T_TCP='tcp'
  T_UDP='udp'
  T_USB='usb'
  T_SERVICE='service'

  def __init__(self,type,handlerId,value):
    self.type=type
    self.handlerId=handlerId
    self.value=value

  def usingOther(self,used):
    return self.type == used.type and str(self.value) == str(used.value)

  def usingTypeValue(self,type,value):
    return self.type == type and str(self.value) == str(value)

  @classmethod
  def filterByType(cls,ulist,type):
    return list(filter(lambda x: x.type == type,ulist))

  @classmethod
  def toPlain(cls,ulist):
    return list(map(lambda x:x.value,ulist))

  @classmethod
  def filterListByUsed(cls,type,ilist,used):
    rt=[]
    for item in ilist:
      itemUsed=False
      for us in used:
        if us.usingTypeValue(type,item):
          itemUsed=True
          break
      if not itemUsed:
        rt.append(item)
    return rt


class WorkerStatus(object):
  INACTIVE='INACTIVE'
  STARTED='STARTED'
  RUNNING='RUNNING'
  NMEA='NMEA'
  ERROR='ERROR'
  ALL_STATES=[INACTIVE,STARTED,RUNNING,NMEA,ERROR]
  def __init__(self,name,status,info,timeout=None,childId=None,canDelete=False):
    '''
    status for the status page
    @param name:
    @param status:
    @param info:
    @param timeout:
    @param childId: if this is set to some id this child can be edited
    '''
    if not status in self.ALL_STATES:
      status=self.INACTIVE
    self.status=status
    self.info=info
    self.name=name
    self.modified=time.time()
    self.timeout=timeout
    self.id=childId
    self.canDelete=canDelete

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
  def refresh(self,timeout=None):
    self.modified=time.time()
    if timeout is not None:
      self.timeout=timeout
  def expired(self):
    if self.timeout is None or self.timeout <=0:
      return False
    now = time.time()
    if now < self.modified or (self.modified + self.timeout) < now:
      return True
    return False

  def toDict(self):
    if self.expired():
      return None
    rt={
      'info':self.info,
      'status':self.status,
      'name':self.name,
      'canDelete':self.canDelete,
      'canEdit': self.id is not None
    }
    if self.id is not None:
      rt['id']=self.id
    return rt

  def __str__(self) -> str:
    return "STATUS[%s] %s, %s"%(self.name,self.status,self.info)

class WorkerId(object):
  def __init__(self):
    self.id=0
    self.lock=threading.Lock()
  def next(self):
    self.lock.acquire()
    try:
      self.id+=1
      return self.id
    finally:
      self.lock.release()

def forceExit():
  time.sleep(8)
  AVNLog.info("forced exit")
  os._exit(1)


class InfoHandler(object):
  def setInfo(self,name,info,status,childId=None,canDelete=False,timeout=None):
    pass
  def refreshInfo(self,name,timeout=None):
    pass
  def deleteInfo(self,name):
    pass

class TrackingInfoHandler(InfoHandler):
  def __init__(self,handler:InfoHandler):
    self._handler=handler
    self._names=set()
  def __del__(self):
    self.cleanup()
  def setInfo(self, name, info, status, childId=None, canDelete=False, timeout=None):
    self._names.add(name)
    self._handler.setInfo(name, info, status, childId, canDelete, timeout)

  def refreshInfo(self, name, timeout=None):
    self._names.add(name)
    self._handler.refreshInfo(name, timeout)

  def deleteInfo(self, name):
    if name is not None:
      try:
        self._names.remove(name)
      except:
        pass
    self._handler.deleteInfo(name)

  def cleanup(self):
    for n in self._names:
      self._handler.deleteInfo(n)
    self._names.clear()

class SubInfoHandler(InfoHandler):
  def __init__(self,parent:InfoHandler,prefix=None,track=True):
    self._prefix = prefix if prefix is not None else ""
    self._parent=parent if not track else TrackingInfoHandler(parent)
  def _gn(self,name):
    return self._prefix+":#:"+name

  def setInfo(self, name, info, status, childId=None, canDelete=False, timeout=None):
    self._parent.setInfo(self._gn(name), info, status, childId, canDelete, timeout)

  def refreshInfo(self, name, timeout=None):
    self._parent.refreshInfo(self._gn(name), timeout)

  def deleteInfo(self, name):
    self._parent.deleteInfo(self._gn(name))


class AVNWorker(InfoHandler):
  QUEUE_NAME_PARAMETER=WorkerParameter('queueName',default='',type=WorkerParameter.T_STRING,editable=False)
  NAME_PARAMETER=WorkerParameter('name',default='',type=WorkerParameter.T_STRING)
  DEFAULT_CONFIG_PARAM = [
    NAME_PARAMETER,
    QUEUE_NAME_PARAMETER
  ]
  ENABLE_PARAM_DESCRIPTION=WorkerParameter('enabled',default=True,type=WorkerParameter.T_BOOLEAN)
  ENABLE_CONFIG_PARAM=[
    ENABLE_PARAM_DESCRIPTION
  ]
  PRIORITY_PARAM_DESCRIPTION=WorkerParameter('priority',default=NMEAParser.DEFAULT_SOURCE_PRIORITY,
                                             type=WorkerParameter.T_NUMBER,rangeOrList=[10,100],
                                             description="The priority for this source. If there is data from higher priority sources, values will be ignored in parser")
  FILTER_PARAM=WorkerParameter('filter','',type=WorkerParameter.T_FILTER)
  BLACKLIST_PARAM=WorkerParameter('blackList' , '',description=', separated list of sources we do not send out')

  handlerListLock=threading.Lock()
  """a base class for all workers
     this provides some config functions and a common interfcace for handling them"""
  allHandlers=[] #the list of all instantiated handlers
  __workerId=WorkerId()
  Type=Enum(['DEFAULT','FEEDER','HTTPSERVER'])


  @classmethod
  def getNextWorkerId(cls):
    return cls.__workerId.next()

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

  def findFeeder(self,feedername=None):
    if feedername is None:
      feedername=self.QUEUE_NAME_PARAMETER.fromDict(self.param)
      if feedername == "":
        #support legacy config
        feedername=self.getStringParam('feederName')
    """find a feeder by its name (not configName)"""
    rt=self.findHandlerByTypeAndName(self.Type.FEEDER,feedername)
    if rt is None:
      #try fallback to main
      rt=self.findHandlerByTypeAndName(self.Type.FEEDER)
      if rt is None:
        raise Exception("unable to find queue %s"%(feedername or ""))
    return rt
  
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
  def canDeleteHandler(cls):
    return False
  @classmethod
  def canDisable(cls):
    return False

  @classmethod
  def getEditableParameters(cls, makeCopy=True,id=None):
    '''
    get the parameters we can edit
    @return:
    '''
    if not cls.canEdit():
      return None
    return WorkerParameter.filterEditables(cls.getConfigParamCombined(),makeCopy=makeCopy)


  @classmethod
  def removeHandler(cls,handlerId):
    handler=cls.findHandlerById(handlerId)
    if handler is None:
      raise Exception("handler for id %s not found"%str(handlerId))
    if not handler.canDeleteHandler():
      raise Exception("handler %s cannot be deleted"%str(handlerId))
    cls.handlerListLock.acquire()
    try:
      cls.allHandlers.remove(handler)
    finally:
      cls.handlerListLock.release()
    handler.stop()
    handler.configChanger.removeSelf()

  @classmethod
  def shutdownServer(cls):
    for handler in cls.allHandlers:
      try:
        AVNLog.info("stopping handler %s",handler.getName())
        handler.stop()
      except:
        pass
    fe = threading.Thread(target=forceExit)
    fe.start()
    sys.exit(1)
  
  def __init__(self,cfgparam):
    self.handlerListLock.acquire()
    try:
      self.allHandlers.append(self) #fill the static list of handlers
    finally:
      self.handlerListLock.release()
    self.id=self.getNextWorkerId()
    self.param=cfgparam
    self.status={'main':WorkerStatus('main',WorkerStatus.STARTED,"created")}
    self.__statusLock=threading.Lock()
    self.type=self.Type.DEFAULT
    self.queue=None
    self.configChanger=None #reference for writing back to the DOM
    self.condition=threading.Condition()
    self.currentThread=None
    self.name=self.getName()
    self.usedResources=[]


  def setNameIfEmpty(self,name):
    if self.getParamValue('name') is not None:
      return
    self.name=name
    if self.currentThread is not None:
      self.currentThread.setName(name)

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
  def setInfo(self,name,info,status,childId=None,canDelete=False,timeout=None):
    with  self.__statusLock:
      existing=self.status.get(name)
      if existing:
        if existing.update(status,info,timeout=timeout):
          AVNLog.info("%s",str(existing))
          return True
      else:
        ns=WorkerStatus(name,status,info,childId=childId,canDelete=canDelete,timeout=timeout)
        self.status[name]=ns
        AVNLog.info("%s",str(ns))
  def refreshInfo(self,name,timeout=None):
    with self.__statusLock:
      existing=self.status.get(name)
      if existing:
        existing.refresh(timeout=timeout)
  def deleteInfo(self,name):
    with self.__statusLock:
      if self.status.get(name) is not None:
        try:
          del self.status[name]
        except:
          pass
  def getId(self):
    return self.id


  def getParam(self,child=None,filtered=False):
    if child is not None:
      raise Exception("cannot return child parameters")
    try:
      if filtered:
        return WorkerParameter.filterByList(self.getConfigParamCombined(), self.param)
      else:
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
  def getWParam(self,param:WorkerParameter,rangeOrListCheck:bool=False):
    return param.fromDict(self.param,rangeOrListCheck=rangeOrListCheck)
  def isDisabled(self):
    """is this handler set to disabled?"""
    if not self.canDisable() and not self.canDeleteHandler():
      return False
    en=self.getParamValue("enabled")
    if en is None:
      en="True"
    return str(en).upper()!='TRUE'

  def getEditableChildParameters(self,child):
    raise Exception("getEditableChildParameters not available for %s"%self.getName())
  def canDeleteChild(self,child):
    return False

  def updateConfig(self,param,child=None):
    '''
    change of config parameters
    the handler must update its data and store the values using changeMultiConfig, changeChildConfig
    @param param: a dictonary with the keyes matching the keys from getEditableParameters
    @type param: dict
    @param child: a child id or None
    @return:
    '''
    if child is not None:
      raise Exception("cannot modify child %s"%str(child))
    checked = WorkerParameter.checkValuesFor(self.getEditableParameters(id=self.id), param, self.getParam())
    newEnable = None
    if 'enabled' in checked:
      newEnable=checked.get('enabled',True)
      if type(newEnable) is str:
        newEnable=newEnable.upper() != 'FALSE'
    if newEnable == True or not self.isDisabled():
      checkConfig=self.param.copy()
      checkConfig.update(checked)
      self.checkConfig(checkConfig)
    rt = self.changeMultiConfig(checked)
    if self.canDisable() or self.canDeleteHandler():
      if 'enabled' in checked:
        if newEnable != self.isDisabled():
          if not newEnable:
            AVNLog.info("handler disabled, stopping")
            self.stop()
          else:
            AVNLog.info("handler enabled, starting")
            self.startThread()
    if self.ENABLE_PARAM_DESCRIPTION.fromDict(self.param,True) and self.currentThread is None:
      #was not running - start now
      AVNLog.info("handler was stopped, starting now")
      self.startThread()

    return rt

  def deleteChild(self,child):
    raise Exception("delete child not allowed for %s"%self.getName())

  def shouldStop(self):
    current=self.currentThread
    if current is None:
      return True
    if threading.get_ident() != current.ident:
      return True
    return False

  def timeChanged(self):
    '''
    called when main changes the system time
    @return:
    '''
    pass
  def wakeUp(self):
    self.condition.acquire()
    try:
      self.condition.notifyAll()
    finally:
      self.condition.release()
  #stop any child process (will be called by signal handler)
  def stop(self):
    self.currentThread=None
    self.wakeUp()



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


  def getSourceName(self,defaultSuffix=None):
    '''
    get the name for the data source
    @param defaultSuffix:
    @return: returns either the explicitely set name or the default name appended by the suffix
    '''
    rt=self.NAME_PARAMETER.fromDict(self.param)
    if rt is not None and rt != "":
      return rt
    if defaultSuffix is None:
      defaultSuffix="?"
    return "%s-%s"%(self.getName(),str(defaultSuffix))

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
    return hasChanges

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

  def removeChildConfig(self,childName,childIndex,delayWriteOut=False):
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
    self.configChanger.removeChild(childName,childIndex,delayUpdate=delayWriteOut)
    childList.pop(childIndex)

  #get the XML tag in the config file that describes this worker
  @classmethod
  def getConfigName(cls):
    return cls.__name__

  @classmethod
  def getConfigParamCombined(cls,child=None):
    if child is None:
      rt=cls.getConfigParam()
      if type(rt) is dict:
        rt.update({'name':''})
        return rt
      else:
        if cls.canDeleteHandler() or cls.canDisable():
          rt=cls.ENABLE_CONFIG_PARAM+rt
        return cls.DEFAULT_CONFIG_PARAM+rt
    else:
      return cls.getConfigParam(child)

  #return the default cfg values
  #if the parameter child is set, the parameter for a child node
  #must be returned, child nodes are added to the parameter dict
  #as an entry with childnodeName=[] - the child node configs being in the list
  @classmethod
  def getConfigParam(cls, child=None):
    raise Exception("getConfigParam must be overwritten")



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

  @classmethod
  def getConfigFromAttrs(cls,attrs):
    sparam={}
    for k in list(attrs.keys()):
        v=attrs[k]
        if v is None or isinstance(v,str):
          sparam[k]=v
        else:
          sparam[k] = v.value
    return sparam

  @classmethod
  def parseConfigNew(cls,attrs,workerParam):
    parsed=cls.getConfigFromAttrs(attrs)
    rt={}
    for wp in workerParam:
      try:
        #we cannot use fromDict here as we have to be tolernat against
        #all old config
        v=parsed.get(wp.name)
        if v is None:
          v=wp.default
        if v is None and wp.mandatory:
          raise Exception("missing mandatory parameter %s",wp.name)
        rt[wp.name]=v
      except Exception as e:
        AVNLog.error("unable to parse %s(%s) for %s",wp.name,str(parsed),cls.getConfigName())
        raise
    return rt

  #parse an config entry
  @classmethod
  def parseConfig(cls,attrs,default):
    parsed=cls.getConfigFromAttrs(attrs)
    if len(list(default.keys())) == 0:
      #special case: accept all attributes
      return parsed
    sparam=copy.deepcopy(default)
    for k in list(sparam.keys()):
      dv=sparam[k]
      v=parsed.get(k)
      if dv is None and v is None:
        raise Exception(cls.getConfigName()+": missing mandatory parameter "+k)
      if v is not None:
        sparam[k]=v
    return sparam

  def run(self):
    raise Exception("run must be overloaded")

  def _runInternal(self):
    self.usedResources=[]
    AVNLog.info("run started")
    try:
      self.run()
      self.setInfo('main','handler stopped',WorkerStatus.INACTIVE)
    except Exception as e:
      self.setInfo('main','handler stopped with: %s'%str(e),WorkerStatus.ERROR)
      AVNLog.error("handler run stopped with exception %s",traceback.format_exc())
    self.usedResources=[]
    self.currentThread=None

  def checkConfig(self,param):
    '''
    will be called whenever new config parameters
    are set
    give the handler a chance to throw an exception
    @param param:
    @return:
    '''
    pass
  def startThread(self):
    AVNLog.info("starting %s with config %s", self.getName(), self.getConfigString())
    self.currentThread = threading.Thread(target=self._runInternal, name=self.name or '')
    self.currentThread.setDaemon(True)
    self.currentThread.start()

  def startInstance(self,navdata):
    """

    @type navdata: AVNStore
    """
    self.navdata=navdata #type: AVNStore
    self.queue = self.findFeeder()
    try:
      self.checkConfig(self.param)
    except Exception as e:
      self.setInfo('main','%s'%str(e),WorkerStatus.ERROR)
      raise
    if not self.isDisabled():
      self.startThread()
    else:
      self.setInfo('main','disabled',WorkerStatus.INACTIVE)
      AVNLog.info("not starting %s (disabled) with config %s", self.getName(), self.getConfigString())

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

  def writeData(self,data,source=None,addCheckSum=False,sourcePriority=NMEAParser.DEFAULT_SOURCE_PRIORITY):
    if self.queue is None:
      raise Exception("no feeder in %s"%(self.getName()))
    self.queue.addNMEA(data, source, addCheckSum, sourcePriority=sourcePriority)

  def getUsedResources(self,type=None):
    '''
    return a list of UsedResource
    @param type:
    @return:
    '''
    return self.usedResources

  @classmethod
  def findUsersOf(cls,type,ownId=None,value=None,toPlain=False,onlyRunning=True):
    used=[]
    for handler in cls.getAllHandlers():
      if onlyRunning and handler.currentThread is None:
        continue
      if handler.getId() == ownId:
        continue
      used+=handler.getUsedResources(type)
    if value is None:
      if toPlain:
        return UsedResource.toPlain(used)
      return used
    rt=[]
    for us in used:
      if us.usingTypeValue(type,value):
        rt.append(us)
    if toPlain:
      return UsedResource.toPlain(rt)
    return rt

  def checkUsedResource(self,type,value,prefix=None):
    if value is None:
      return
    others=self.findUsersOf(type,ownId=self.id,value=value)
    if len(others) >0:
      if prefix is None:
        prefix = others[0].type
      h=self.findHandlerById(others[0].handlerId)
      if h is None:
        name='handler %s'%others[0].handlerId
      else:
        name=h.getName()
      raise Exception("%s %s already in use by %s(%s)"%(
        prefix,
        str(others[0].value),
        name,
        str(others[0].handlerId)
      ))
  def claimUsedResource(self,type,value,force=False):
    if not force:
      self.checkUsedResource(type,value)
    res=UsedResource(type,self.id,value)
    self.usedResources.append(res)

  def freeUsedResource(self,type,name):
    newRes=[]
    for res in self.usedResources:
      if not res.usingTypeValue(type,name):
        newRes.append(res)
    self.usedResources=newRes

  def freeAllUsedResources(self):
    self.usedResources=[]

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

  def getRequestIp(self, handler, default="localhost"):
    hostip = default
    try:
      host = handler.headers.get('host')
      hostparts = host.split(':')
      hostip = hostparts[0]
    except:
      pass
    return hostip
 
  