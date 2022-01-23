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
import imp
import inspect
import json
from typing import Dict, Any

from avnav_api import AVNApi
from avnav_store import AVNStore

from avnav_manager import AVNHandlerManager
from avnav_util import *
from avnav_worker import *
import avnav_handlerList
from avnremotechannel import AVNRemoteChannelHandler
from avnuserapps import AVNUserAppHandler
from avnusb import AVNUsbSerialReader
from layouthandler import AVNLayoutHandler
from charthandler import AVNChartHandler

URL_PREFIX= "/plugins"

class UserApp(object):
  def __init__(self,url,icon,title):
    self.url=url
    self.title=title
    self.icon=icon
  def __eq__(self, other):
    return self.__dict__ == other.__dict__



class ApiImpl(AVNApi):
  def __init__(self,parent,store,queue,prefix,moduleFile):
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
    self.wildcardPatterns=[]
    self.addonIndex=1
    self.fileName=moduleFile
    self.requestHandler=None
    self.paramChange=None
    self.editables=None
    self.stopHandler=None
    self.storeKeys=[]
    self.userApps=[]

  def stop(self):
    if self.stopHandler is None:
      raise Exception("plugin %s cannot be stopped during runtime"%self.prefix)
    try:
      charthandler = AVNWorker.findHandlerByName(AVNChartHandler.getConfigName())
      charthandler.registerExternalProvider(self.prefix, None)
    except:
      pass
    try:
      usbhandler = AVNWorker.findHandlerByName(AVNUsbSerialReader.getConfigName())
      usbhandler.deregisterExternalHandlers(self.prefix)
    except:
      pass
    self.requestHandler=None
    try:
      self.userApps=[]
      addonhandler = AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
      for id in range(0,self.addonIndex+1):
        addonhandler.unregisterAddOn("%s%i"%(self.prefix,id))
    except:
      pass
    self.stopHandler()


  def log(self, str, *args):
    AVNLog.info("%s",str % args)

  def error(self, str, *args):
    AVNLog.error("%s",str % args)

  def debug(self, str, *args):
    AVNLog.debug("%s",str % args)

  def fetchFromQueue(self, sequence, number=10,includeSource=False,waitTime=0.5,filter=None):
    if filter is not None:
      if not (isinstance(filter,list)):
        filter=filter.split(',')
    return self.queue.fetchFromHistory(sequence,number,includeSource=includeSource,waitTime=waitTime,nmeafilter=filter)

  def addNMEA(self, nmea, addCheckSum=False,omitDecode=True,source=None):
    if source is None:
      source=self.prefix
    return self.queue.addNMEA(nmea,source=source,addCheckSum=addCheckSum,omitDecode=omitDecode)

  def registerKeys(self):
    if self.storeKeys is None:
      return
    for keydata in self.storeKeys:
      self.addKey(keydata)

  def addKey(self,data):
    keySource="Plugin: %s"%self.prefix
    key=data.get('path')
    if key is None:
      raise Exception("%s: missing path in data entry: %s"%(self.prefix,data))
    AVNLog.info("%s: register key %s"%(self.prefix,key))
    if self.store.isKeyRegistered(key,keySource):
      allowOverwrite=self.getConfigValue(AVNApi.ALLOW_KEY_OVERWRITE,"false")
      if allowOverwrite.lower() != "true":
        self.error("key %s already registered, skipping it"%key)
        if key.find('*') >= 0:
          if key in self.wildcardPatterns:
            self.wildcardPatterns.remove(key)
        else:
          if key in self.patterns:
            self.patterns.remove(key)
        return
    else:
      self.store.registerKey(key,data,keySource)
    if key.find('*') >= 0:
      if not key in self.wildcardPatterns:
        self.wildcardPatterns.append(key)
    else:
      if not key in self.patterns:
        self.patterns.append(key)
  def addData(self,path,value,source=None,record=None):
    if source is None:
      source="plugin-"+self.prefix
    matches=False
    for p in self.patterns:
      if p == path:
        matches=True
        break
    if not matches:
      for p in self.wildcardPatterns:
        if AVNStore.wildCardMatch(path,p):
          matches=True
          break
    if not matches:
      AVNLog.error("%s:setting invalid path %s"%(self.prefix,path))
      return False
    if record is not None:
      self.store.setReceivedRecord(record,source)
    self.store.setValue(path,value,source)
    return True
  def getDataByPrefix(self, prefix):
    return self.store.getDataByPrefix(prefix)

  def getSingleValue(self, key,includeInfo=False):
    return self.store.getSingleValue(key,includeInfo=includeInfo)

  def getExpiryPeriod(self):
    return self.store.getExpiryPeriod()

  def getConfigValue(self, key, default=None):
    childcfg=self.phandler.getParamValue(self.prefix) #for now we use the prefix as cfg name
    if childcfg is None:
      return default
    if len(childcfg) < 1:
      return default
    rt=childcfg[0].get(key)
    if rt is None:
      return default
    return rt

  def setStatus(self,value,info):
    self.phandler.setInfo(self.prefix,info,value)

  def registerUserApp(self, url, iconFile, title=None):
    addonhandler=AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
    if addonhandler is None:
      raise Exception("no http server")
    if os.path.isabs(iconFile):
      raise Exception("only relative pathes for icon files")
    iconFilePath=os.path.join(os.path.dirname(self.fileName),iconFile)
    if not os.path.exists(iconFilePath):
      raise Exception("icon file %s not found"%iconFilePath)
    id = "%s%i"%(self.prefix,self.addonIndex)
    userApp=UserApp(url,iconFile,title)
    if userApp in self.userApps:
      self.log("trying to re-register user app url=%s, ignore",url)
      return
    self.userApps.append(userApp)
    addonhandler.registerAddOn(id,url,"%s/%s/%s"%(URL_PREFIX,self.prefix,iconFile),
                               title=title)
    self.addonIndex+=1
    return id

  def unregisterUserApp(self, id):
    addonhandler = AVNWorker.findHandlerByName(AVNUserAppHandler.getConfigName())
    if addonhandler is None:
      raise Exception("no http server")
    return addonhandler.unregisterAddOn(id)

  def registerLayout(self, name, layoutFile):
    if not os.path.isabs(layoutFile):
      layoutFile=os.path.join(os.path.dirname(self.fileName),layoutFile)
    if not os.path.exists(layoutFile):
      raise Exception("layout file %s not found",layoutFile)
    layoutHandler=AVNWorker.findHandlerByName(AVNLayoutHandler.getConfigName()) #type: AVNLayoutHandler
    if layoutHandler is None:
      raise Exception("no layout handler")
    layoutHandler.registerPluginLayout(re.sub(".*\.","",self.prefix),name,layoutFile)

  def timestampFromDateTime(self, dt=None):
    if dt is None:
      dt=datetime.datetime.utcnow()
    return AVNUtil.datetimeToTsUTC(dt)

  def getDataDir(self):
    return self.phandler.getParamValue(AVNHandlerManager.BASEPARAM.DATADIR)

  def registerChartProvider(self,callback):
    charthandler = AVNWorker.findHandlerByName(AVNChartHandler.getConfigName())
    charthandler.registerExternalProvider(self.prefix,callback)
    pass

  def registerRequestHandler(self, callback):
    self.requestHandler=callback

  def getBaseUrl(self):
    return URL_PREFIX+"/"+self.prefix

  def registerUsbHandler(self, usbid, callback):
    usbhandler=AVNWorker.findHandlerByName(AVNUsbSerialReader.getConfigName())
    if usbhandler is None:
      raise Exception("no usb handler configured, cannot register %s"%usbid)
    usbhandler.registerExternalHandler(usbid,self.prefix,callback)

  def deregisterUsbHandler(self, usbid=None):
    usbhandler=AVNWorker.findHandlerByName(AVNUsbSerialReader.getConfigName())
    if usbhandler is None:
      raise Exception("no usb handler configured, cannot register %s"%usbid)
    usbhandler.deregisterExternalHandler(self.prefix,usbid)

  def getAvNavVersion(self):
    baseConfig=AVNWorker.findHandlerByName("AVNConfig")
    if baseConfig is None:
      raise Exception("internal error: no base config")
    return int(baseConfig.getVersion())

  def saveConfigValues(self, configDict):
    self.log("saving config %s",str(configDict))
    return self.phandler.changeChildConfigDict(self.prefix,configDict)

  def registerEditableParameters(self, paramList, changeCallback):
    if type(paramList) is not list:
      raise Exception("paramList must be a list")
    editables=[]
    for p in paramList:
      if type(p) is not dict:
        raise Exception("items of paramList must be dictionaries")
      if p.get('name') is None:
        raise Exception("missing key name in %s"%str(p))
      description=WorkerParameter(p['name'],
                                  default=p.get('default'),
                                  type=p.get('type'),
                                  rangeOrList=p.get('rangeOrList'),
                                  description=p.get('description'),
                                  condition=p.get('condition'))
      editables.append(description)
    self.editables=editables
    self.paramChange=changeCallback
    self.phandler.setChildEditable(self.prefix,
                                   self.stopHandler is not None
                                   or (self.paramChange is not None
                                   and len(self.editables) > 0)
                                   )

  def registerRestart(self, stopCallback):
    self.stopHandler=stopCallback
    self.phandler.setChildEditable(self.prefix,
                                   self.stopHandler is not None
                                   or (self.paramChange is not None
                                       and len(self.editables) > 0)
                                   )

  def shouldStopMainThread(self):
    current=threading.get_ident()
    running=self.phandler.startedThreads.get(self.prefix)
    if running is None:
      return True
    return running.ident != current

  def sendRemoteCommand(self, command, param, channel=0):
    channelhandler=AVNWorker.findHandlerByName(AVNRemoteChannelHandler.getConfigName())
    if channelhandler is None:
      raise Exception("no remote channel handler configured")
    channelhandler.sendMessage(command+" "+param,channel=channel)


class AVNPluginHandler(AVNWorker):
  createdApis: Dict[str, ApiImpl]
  ENABLE_PARAMETER=WorkerParameter('enabled',
                                   type=WorkerParameter.T_BOOLEAN,
                                   default=True,
                                   description="enable this plugin")

  """a handler for plugins"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.queue=None
    self.createdPlugins={}
    self.createdApis={} 
    self.startedThreads={}
    self.pluginDirs={} #key: moduleName, Value: dir
    self.configLock=threading.Lock()


  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      return {
        'builtinDir':os.path.join(os.path.dirname(__file__),'..','plugins'),
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
    return True

  def startInstance(self, navdata):
    """
    we overwrite start to allow for an error stop
    if the feeder is misconfigured
    @return:
    """
    feeder=self.findFeeder(self.getStringParam('feederName'))
    if feeder is None:
      raise Exception("%s: cannot find a suitable feeder (name %s)",self.getName(),self.getStringParam('feederName') or "")
    self.queue=feeder
    super().startInstance(navdata)

  def run(self):
    builtInDir=self.getStringParam('builtinDir')
    systemDir=AVNHandlerManager.getDirWithDefault(self.param, 'systemDir', defaultSub=os.path.join('..', 'plugins'), belowData=False)
    userDir=AVNHandlerManager.getDirWithDefault(self.param, 'userDir', 'plugins')
    directories={
      'builtin':{
        'dir':builtInDir,
        'prefix':'builtin'
      },
      'system':{
        'dir':systemDir,
        'prefix':'system'
      },
      'user':{
        'dir':userDir,
        'prefix':'user'
      }
    }


    for basedir in ['builtin','system','user']:
      dircfg=directories[basedir]
      if not os.path.isdir(dircfg['dir']):
        continue
      for dirname in os.listdir(dircfg['dir']):
        dir=os.path.join(dircfg['dir'],dirname)
        if not os.path.isdir(dir):
          continue
        module=None
        moduleName=dircfg['prefix'] + "-" + dirname
        try:
          module=self.loadPluginFromDir(dir, moduleName)
        except:
          AVNLog.error("error loading plugin from %s:%s",dir,traceback.format_exc())
        if module is not None:
          self.pluginDirs[moduleName]=os.path.realpath(dir)
          self.instantiateHandlersFromModule(moduleName,module)
        else:
          if os.path.exists(os.path.join(dir,"plugin.js")) or os.path.exists(os.path.join(dir,"plugin.css")):
            self.pluginDirs[moduleName]=dir
            self.setInfo(moduleName,"java script/css only",WorkerStatus.STARTED)
    for name in list(self.createdPlugins.keys()):
      self.startPluginThread(name)
    AVNLog.info("pluginhandler finished")

  def runPlugin(self,api,plugin):
    api.log("run started")
    api.setStatus(WorkerStatus.INACTIVE, "plugin started")
    try:
      api.registerKeys()
      plugin.run()
      api.log("plugin run finshed")
      if AVNUtil.getBool(api.getConfigValue('enabled'),True):
        api.setStatus(WorkerStatus.INACTIVE,"plugin run finished")
      else:
        api.setStatus(WorkerStatus.INACTIVE, "plugin disabled")
    except Exception as e:
      api.error("plugin run exception: %s",traceback.format_exc())
      api.setStatus(WorkerStatus.ERROR,"plugin exception %s"%str(e))

  def startPluginThread(self,name):
    plugin = self.createdPlugins[name]
    api = self.createdApis[name]
    if api is None:
      AVNLog.error("internal error: api not created for plugin %s", name)
      return
    enabled = AVNUtil.getBool(api.getConfigValue("enabled"), True)
    if not enabled:
      AVNLog.info("plugin %s is disabled by config", name)
      self.setInfo(name, "disabled by config", WorkerStatus.INACTIVE)
      return
    AVNLog.info("starting plugin %s", name)
    thread = threading.Thread(target=self.runPlugin,args=[api,plugin])
    thread.setDaemon(True)
    thread.setName("Plugin: %s" % (name))
    thread.start()
    self.startedThreads[name] = thread

  def instantiateHandlersFromModule(self,modulename, module):
    MANDATORY_METHODS = ['run']
    MANDATORY_CLASSMETHODS=['pluginInfo']

    obj = getattr(module, "Plugin")
    if obj is None:
      return
    ic = inspect.isclass(obj)
    if ic:
      if obj.__module__ != (modulename):
        return
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
        #see https://stackoverflow.com/questions/19227724/check-if-a-function-uses-classmethod
        if not ( inspect.ismethod(mObj) and mObj.__self__ is obj):
          hasMethods=False
          break
      if hasMethods:
        #TODO: handle multiple instances from config
        api = ApiImpl(self,self.navdata,self.queue,modulename,inspect.getfile(obj))
        AVNLog.info("creating %s" % (modulename))
        try:
          description=obj.pluginInfo()
          if description is None or not isinstance(description,dict):
            raise Exception("invalid return from pluginInfo")
          mData = description.get('data')
          if mData is not None:
            for entry in mData:
              path = entry.get('path')
              if path is None:
                raise Exception("missing path in entry %s" % (str(entry)))
          api.storeKeys=mData
          pluginInstance = obj(api)
          AVNLog.info("created plugin %s",modulename)
          self.createdPlugins[modulename]=pluginInstance
          self.createdApis[modulename]=api
          self.setInfo(modulename,"created",WorkerStatus.STARTED)
        except Exception as e:
          self.setInfo(modulename,"unable to create plugin: %s"%str(e), WorkerStatus.ERROR)
          AVNLog.error("cannot start %s:%s" % (modulename, traceback.format_exc()))

  def loadPluginFromDir(self, dir, name):
    """
    load aplugin module from a directory
    @param dir: the dir to be loaded from
    @param name: the module name
    @return: the module (if nay)
    """
    moduleFile=os.path.join(dir,"plugin.py")
    if not os.path.exists(moduleFile):
      return None
    try:
      rt = imp.load_source(name, moduleFile)
      AVNLog.info("loaded %s as %s", moduleFile, name)
      return rt
    except:
      AVNLog.error("unable to load %s:%s", moduleFile, traceback.format_exc())
    return None

  def changeChildConfigDict(self, childName, configDict):
    self.configLock.acquire()
    hasChanges = False
    try:
      childIdx=0
      currentList=self.param.get(childName)
      if currentList is None:
        childIdx=-1
      for k,v in configDict.items():
        if currentList is None or len(currentList) < 1 or \
            currentList[0].get(k) != str(v):
          hasChanges=True
          childIdx=self.changeChildConfig(childName, childIdx, k, str(v),delayWriteOut=True)
    finally:
      self.configLock.release()
    if hasChanges:
      self.writeConfigChanges()

  def setChildEditable(self,child,enable=True):
    existing=self.status.get(child)
    if existing:
      existing.id=child if enable else None
    else:
      if enable:
        self.setInfo(child,'created',WorkerStatus.INACTIVE,childId=child)

  def getEditableChildParameters(self, child):
    api=self.createdApis.get(child)
    if api is None:
      return []
    editables=api.editables
    if editables is None:
      editables=[]
    if api.stopHandler:
      editables= editables + [self.ENABLE_PARAMETER]
    rt=[]
    for e in editables:
      if callable(e.rangeOrList):
        ne=e.copy()
        ne.rangeOrList=e.rangeOrList()
        rt.append(ne)
      else:
        rt.append(e)
    return rt

  def getParam(self, child=None, filtered=False):
    if child is None:
      return super().getParam(child, filtered)
    param=self.getParamValue(child)
    if param is None or len(param) < 1:
      param={}
    else:
      param=param[0]
    if filtered:
      return WorkerParameter.filterByList(
        self.getEditableChildParameters(child),
        param
      )
    return param


  def updateConfig(self, param, child=None):
    if child is None:
      return super().updateConfig(param, child)
    api = self.createdApis.get(child)
    if api is None:
      raise Exception("plugin %s not found"%child)
    checked=WorkerParameter.checkValuesFor(self.getEditableChildParameters(child),param,self.param.get(child))
    if 'enabled' in checked:
      newEnabled=AVNUtil.getBool(checked.get('enabled'),True)
      current=AVNUtil.getBool(api.getConfigValue('enabled'),True)
      if newEnabled != current:
        self.changeChildConfigDict(child, {'enabled': newEnabled})
        if not newEnabled:
          if api.stopHandler is None:
            raise Exception("plugin %s cannot stop during runtime")
          try:
            del self.startedThreads[child]
          except:
            pass
          api.stop()
        else:
          self.startPluginThread(child)
          pass
      del checked['enabled']
      if len(list(checked.keys())) < 1:
        return

    if api.paramChange is None:
      raise Exception("unable to change parameters")
    api.paramChange(checked)
    #maybe allowKeyOverrides has changed...
    api.registerKeys()

  def getStatusProperties(self):
    rt={}
    return rt

  def getHandledCommands(self):
    return {"api":"plugins","path":URL_PREFIX}

  def handleApiRequest(self,atype,command,requestparam,**kwargs):
    if atype == 'path':
      handler = kwargs.get('handler')
      '''path mapping request, just return the module path
         command is the original url
      '''
      localPath= command[len(URL_PREFIX) + 1:].split("/", 1)
      if len(localPath) < 2:
        raise Exception(404,"missing plugin path")
      dir=self.pluginDirs.get(localPath[0])
      if dir is None:
        raise Exception("plugin %s not found"%localPath[0])
      if localPath[1][0:3] == 'api':
        #plugin api request
        api=self.createdApis.get(localPath[0])
        if api is None:
          raise Exception("no plugin %s found"%localPath[0])
        if api.requestHandler is None:
          raise Exception("plugin %s does not handle requests " % localPath[0])
        if handler is None:
          raise Exception("no handler for plugin %s request" % localPath[0])
        rt=api.requestHandler(localPath[1][4:],handler,requestparam)
        if type(rt) is dict:
          handler.sendNavResponse(json.dumps(rt))
          return True
        return rt
      if localPath[1] == 'plugin.js':
        if handler is None:
          AVNLog.error("plugin.js request without handler")
          return None
        fname=os.path.join(dir,'plugin.js')
        name=localPath[0]
        url= URL_PREFIX + "/" + name
        addCode="var AVNAV_PLUGIN_NAME=\"%s\";\n"%(name)
        return handler.sendJsFile(fname,url,addCode)
      return os.path.join(dir,kwargs.get('server').plainUrlToPath(localPath[1],False))

    '''
    handle the URL based requests
    :param type: ???
    :return: the answer
    '''
    sub=AVNUtil.getHttpRequestParam(requestparam,'command')
    if atype == "api":
      if sub=="list":
        data=[]
        for k in list(self.pluginDirs.keys()):
          dir=self.pluginDirs[k]
          element={'name':k,'dir':dir}
          if os.path.exists(os.path.join(dir,"plugin.js")):
            element['js']= URL_PREFIX + "/" + k + "/plugin.js"
          if os.path.exists(os.path.join(dir,"plugin.css")):
            element['css']= URL_PREFIX + "/" + k + "/plugin.css"
          data.append(element)
        rt={'status':'OK','data':data}
        return rt
      return {'status':'request not found %s'%sub}
    raise Exception("unable to handle routing request of type %s:%s" % (type, command))



avnav_handlerList.registerHandler(AVNPluginHandler)



