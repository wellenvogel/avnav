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
import glob
import imp
import inspect
import time

from avnav_api import AVNApi
from avnav_store import AVNStore, AVNDataEntry

hasGpio=False
try:
  import RPi.GPIO as GPIO
  hasGpio=True
except:
  pass

from avnav_config import AVNConfig
from avnav_util import *
from avnav_worker import *
import avnav_handlerList

class ApiImpl(AVNApi):
  def __init__(self,parent,store,queue,prefix):
    """

    @param parent: the pluginhandler instance to access cfg data
    @param store: the data store
    @param queue: the feeder
    @param prefix: a prefix for this plugin
    """
    self.phandler=parent # type: AVNPluginHandler
    self.store=store # type: AVNStore
    self.queue=queue
    self.prefix=prefix
    self.patterns=[]

  def log(self, str, *args):
    AVNLog.info("(%s):%s",self.prefix,str % args)

  def error(self, str, *args):
    AVNLog.error("(%s):%s" % (self.prefix,str % args))

  def debug(self, str, *args):
    AVNLog.debug("(%s):%s" % (self.prefix,str % args))

  def fetchFromQueue(self, sequence, number=10):
    return self.queue.fetchFromHistory(sequence,number)

  def addKey(self,data):
    key=data.get('path')
    if key is None:
      raise Exception("%s: missing path in data entry: %s"%(self.prefix,data))
    AVNLog.info("%s: register key %s"%(self.prefix,key))
    self.store.registerKey(key,data,"Plugin: %s"%self.prefix)
    self.patterns.append(data)
  def addData(self,path,value):
    if self.patterns is not None:
      matches=False
      for p in self.patterns:
        if p.get('path') == path:
          matches=True
          break
      if not matches:
        AVNLog.error("%s:setting invalid path %s"%(self.prefix,path))
        return False
    dataEntry = AVNDataEntry(path, value)
    self.store.addEntry(dataEntry)

  def getConfigValue(self, key, default=None):
    childcfg=self.phandler.getParamValue(self.prefix) #for now we use the prefix as cfg name
    if childcfg is None:
      return default
    rt=childcfg.get(key)
    if rt is None:
      return default
    return rt




class AVNPluginHandler(AVNWorker):
  """a handler for plugins"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.queue=None
    self.createdPlugins={}
    self.createdApis={}
    self.startedThreads={}


  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      return {
        'builtinDir':os.path.join(os.path.dirname(__file__),'..','decoder'),
        'systemDir':'',
        'userDir':'',
        'feederName':''
      }
    #accept all parameters for children
    return {}
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return """
    <%s>
	  </%s>
    """%(cls.getConfigName(),cls.getConfigName())

  def start(self):
    """
    we overwrite start to allow for an error stop
    if the feeder is misconfigured
    @return:
    """
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam('feederName') or "")
    self.queue=feeder
    AVNWorker.start(self)

  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    builtInDir=self.getStringParam('builtinDir')
    systemDir=self.getStringParam('systemDir')
    if systemDir is None or systemDir == '':
      systemDir=os.path.join(self.getStringParam(AVNConfig.BASEPARAM.BASEDIR),'user')
    userDir=self.getStringParam('userDir')
    if userDir is None or userDir == '':
      userDir=self.getStringParam(AVNConfig.BASEPARAM.DATADIR,'plugins')

    directories={
      'buildin':{
        'dir':builtInDir,
        'prefix':'buildin-plugins'
      },
      'system':{
        'dir':systemDir,
        'prefix':'system-plugins'
      },
      'user':{
        'dir':userDir,
        'prefix':'user-plugins'
      }
    }


    for dir in ['buildin','system','user']:
      dircfg=directories[dir]
      modules={}
      try:
        modules=self.loadPluginsFromDir(dircfg['dir'],dircfg['prefix'])
        AVNLog.debug("loaded %d modules from %s"%(len(modules),dircfg['dir']))
      except:
        AVNLog.error("error loading plugins from %s:%s",dircfg['dir'],traceback.format_exc())
      for modulname in modules.keys():
        self.instantiateHandlersFromModule(modulname,modules[modulname])
      for name in self.createdPlugins.keys():
        plugin=self.createdPlugins[name]
        AVNLog.info("starting plugin %s",name)
        thread=threading.Thread(target=plugin.run)
        thread.setDaemon(True)
        thread.setName("Plugin: %s"%(name))
        thread.start()
        self.startedThreads[name]=thread


  def instantiateHandlersFromModule(self,modulename, module):
    MANDATORY_METHODS = ['run']
    MANDATORY_CLASSMETHODS=['pluginInfo']
    for name in dir(module):
      obj = getattr(module, name)
      ic = inspect.isclass(obj)
      if ic:
        if obj.__module__ != (modulename):
          continue
        AVNLog.debug("checking module: %s <=> %s" % (obj.__module__, module))
        hasMethods = True
        for m in MANDATORY_METHODS:
          if not hasattr(obj, m):
            hasMethods=False
            break
          mObj = getattr(obj, m)
          if not callable(mObj):
            hasMethods = False
            break
        for clm in MANDATORY_CLASSMETHODS:
          if not hasattr(obj, clm):
            hasMethods=False
            break
          mObj = getattr(obj,clm)
          if not isinstance(mObj,classmethod):
            hasMethods=False
            break
        if hasMethods:
          AVNLog.info("creating %s" % (name))
          #TODO: handle multiple instances from config
          api = ApiImpl(self,self.navdata,self.queue,name)
          startPlugin = True
          pluginInstance = None
          try:
            description=obj.pluginInfo()
            if description is None or not isinstance(description,dict):
              raise Exception("invalid return from pluginInfo")
            mData = description.get('data')
            if mData is None:
              raise Exception("no 'data' field in pluginInfo result")

            for entry in mData:
              path = entry.get('path')
              if path is None:
                raise Exception("missing path in entry %s" % (entry))
              else:
                api.addKey(entry)
            pluginInstance = obj(api)
            AVNLog.info("created plugin %s",name)
            self.createdPlugins[name]=pluginInstance
            self.createdApis[name]=api
          except:
            AVNLog.error("cannot start %s:%s" % (name, traceback.format_exc()))

  def loadPluginsFromDir(self,dir,prefix):
    """
    load plugin modules from a directory
    @param dir: the dir to be loaded from
    @param prefix: the prefix for the module name
    @return: a dictionary of module_name->module
    """
    modules = {}
    for path in glob.glob(os.path.join(dir, '[!_]*.py')):
      name, ext = os.path.splitext(os.path.basename(path))
      try:
        modules[prefix + name] = imp.load_source(prefix + name, path)
        AVNLog.info("loaded %s as %s", path, prefix + name)
      except:
        AVNLog.error("unable to load %s:%s", path, traceback.format_exc())
    return modules

  def getStatusProperties(self):
    rt={}
    return rt

  def getHandledCommands(self):
    return {}

  def handleApiRequest(self,type,command,requestparam,**kwargs):
    '''
    handle the URL based requests
    :param type: ???
    :return: the answer
    '''
    rt={}
    return rt


avnav_handlerList.registerHandler(AVNPluginHandler)



