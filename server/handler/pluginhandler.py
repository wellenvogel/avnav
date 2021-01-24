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

from avnav_api import AVNApi
from avnav_store import AVNStore

from avnav_config import AVNConfig
from avnav_util import *
from avnav_worker import *
import avnav_handlerList
from avnuserapps import AVNUserAppHandler
from usb import AVNUsbSerialReader
from layouthandler import AVNLayoutHandler
from charthandler import AVNChartHandler

URL_PREFIX= "/plugins"

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

  def log(self, str, *args):
    AVNLog.info("[%s]%s",AVNLog.getThreadId(),str % args)

  def error(self, str, *args):
    AVNLog.error("[%s]%s", AVNLog.getThreadId(),(str % args))

  def debug(self, str, *args):
    AVNLog.debug("[%s]%s",AVNLog.getThreadId(),(str % args))

  def fetchFromQueue(self, sequence, number=10,includeSource=False,waitTime=0.5,filter=None):
    if filter is not None:
      if not (isinstance(filter,list)):
        filter=[filter]
    return self.queue.fetchFromHistory(sequence,number,includeSource=includeSource,waitTime=waitTime,nmeafilter=filter)

  def addNMEA(self, nmea, addCheckSum=False,omitDecode=True,source=None):
    if source is None:
      source=self.prefix
    return self.queue.addNMEA(nmea,source=source,addCheckSum=addCheckSum,omitDecode=omitDecode)

  def addKey(self,data):
    key=data.get('path')
    if key is None:
      raise Exception("%s: missing path in data entry: %s"%(self.prefix,data))
    AVNLog.info("%s: register key %s"%(self.prefix,key))
    if self.store.isKeyRegistered(key):
      allowOverwrite=self.getConfigValue("allowKeyOverwrite","false")
      if allowOverwrite.lower() != "true":
        self.error("key %s already registered, skipping it"%key)
        return
    else:
      self.store.registerKey(key,data,"Plugin: %s"%self.prefix)
    if key.find('*') >= 0:
      self.wildcardPatterns.append(data)
    else:
      self.patterns.append(data)
  def addData(self,path,value,source=None,record=None):
    if source is None:
      source="plugin-"+self.prefix
    matches=False
    for p in self.patterns:
      if p.get('path') == path:
        matches=True
        break
    if not matches:
      for p in self.wildcardPatterns:
        if AVNStore.wildCardMatch(path,p.get('path')):
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
    if not value in AVNWorker.Status:
      value=AVNWorker.Status.ERROR
    oldStatus=self.phandler.status.get(self.prefix)
    if value != oldStatus:
      self.log("SetStatus: %s %s",value,info)
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
    addonhandler.registerAddOn("%s%i"%(self.prefix,self.addonIndex),url,"%s/%s/%s"%(URL_PREFIX,self.prefix,iconFile),title)
    self.addonIndex+=1

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
    return self.phandler.getParamValue(AVNConfig.BASEPARAM.DATADIR)

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

  def getAvNavVersion(self):
    baseConfig=AVNWorker.findHandlerByName("AVNConfig")
    if baseConfig is None:
      raise Exception("internal error: no base config")
    return int(baseConfig.getVersion())


class AVNPluginHandler(AVNWorker):
  """a handler for plugins"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.queue=None
    self.createdPlugins={}
    self.createdApis={}
    self.startedThreads={}
    self.pluginDirs={} #key: moduleName, Value: dir


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
    self.setName(self.getThreadPrefix())
    builtInDir=self.getStringParam('builtinDir')
    systemDir=AVNConfig.getDirWithDefault(self.param,'systemDir',defaultSub=os.path.join('..','plugins'),belowData=False)
    userDir=AVNConfig.getDirWithDefault(self.param,'userDir','plugins')
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
    for name in list(self.createdPlugins.keys()):
      plugin=self.createdPlugins[name]
      api=self.createdApis[name]
      if api is None:
        AVNLog.error("internal error: api not created for plugin %s",name)
        continue
      enabled=api.getConfigValue("enabled","true")
      if enabled.upper() != 'TRUE':
        AVNLog.info("plugin %s is disabled by config", name)
        self.setInfo(name,"disabled by config",self.Status.INACTIVE)
        continue
      AVNLog.info("starting plugin %s",name)
      thread=threading.Thread(target=plugin.run)
      thread.setDaemon(True)
      thread.setName("Plugin: %s"%(name))
      thread.start()
      self.startedThreads[name]=thread

    AVNLog.info("pluginhandler finished")


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
                raise Exception("missing path in entry %s" % (entry))
              else:
                api.addKey(entry)
          pluginInstance = obj(api)
          AVNLog.info("created plugin %s",modulename)
          self.createdPlugins[modulename]=pluginInstance
          self.createdApis[modulename]=api
          self.setInfo(modulename,"created",AVNWorker.Status.STARTED)
        except:
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



