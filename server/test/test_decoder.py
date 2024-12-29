
import os
import threading
import time
import inspect
import sys
import traceback

from avnav_util import AVNUtil
from avnav_api import AVNApi

allData={}

class ApiImpl(AVNApi):
  def __init__(self):
    self.patterns = None # type: dict
    self.prefix=''

  def log(self, str, *args):
    print("###LOG### %s%s" % (self.prefix,str % args))

  def error(self, str, *args):
    print("###ERROR# %s%s" % (self.prefix,str % args))

  def debug(self, str, *args):
    print("###DEBUG# %s%s" % (self.prefix,str % args))

  def fetchFromQueue(self, sequence, number=10):
    time.sleep(0.5)
    return sequence+2,['aha','soso']

  def setPattern(self,pattern):
    self.patterns=pattern

  def addData(self,path,value):
    if self.patterns is not None:
      matches=False
      for p in self.patterns:
        if p.get('path') == path:
          matches=True
          break
      if not matches:
        print("@@ERROR: invalid path %s"%(path))
        return
    print("@@DATA@@:%s->%s"%(path,value))

import os, glob, importlib.util

def loadModule(name,path):
  spec = importlib.util.spec_from_file_location(name, path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module
def loadModulesFromDir(dir,logger,prefix=''):
  modules = {}
  for path in glob.glob(os.path.join(dir, '[!_]*.py')):
    name, ext = os.path.splitext(os.path.basename(path))
    try:
      modules[prefix+name] = loadModule(prefix + name, path)
      logger.log("loaded %s as %s",path, prefix+name)
    except:
      logger.error("unable to load %s:%s",path,traceback.format_exc())
    return modules

def instantiateHandlersFromModule(modulename,module,allData,logger):
  rt=[] #the list of instantiated objects
  MANDATORY_METHODS = ['initialize', 'run']
  for name in dir(module):
    obj=getattr(module,name)
    ic=inspect.isclass(obj)
    logger.debug("X: %s.%s => %s"%(module,name,ic))
    if ic:
      logger.debug("C: %s <=> %s"%(obj.__module__,module))
      if obj.__module__ != (modulename):
        continue
      hasMethods=True
      for m in MANDATORY_METHODS:
        if not hasattr(obj,m):
          continue
        mObj=getattr(obj,m)
        if not callable(mObj):
          hasMethods=False
          break
      if hasMethods:
        logger.log("creating %s"%(name))
        api = ApiImpl()
        api.prefix="(%s): "%name
        startDecoder=True
        handlerInstance=None
        try:
          handlerInstance=obj()
          d=handlerInstance.initialize(api)
          mData=d.get('data')
          if mData is None:
            raise Exception("no 'data' field in init result")
          else:
            for entry in mData:
              path=entry.get('path')
              if path is None:
                raise Exception("missing path in entry %s"%(entry))
              else:
                if allData.get(path) is not None:
                  raise Exception("entry for %s already defined: %s"%(path,allData.get(path)))
                allData[path]=entry
            api.setPattern(mData)
        except :
          logger.error("##ERROR: cannot start %s:%s"%(name,traceback.format_exc()))
          startDecoder=False
        if startDecoder:
          rt.append(handlerInstance)
  return rt

PREFIX="avnav_decoder_sys_"
logger=ApiImpl()
modules=loadModulesFromDir(os.path.join(os.path.dirname(__file__),'..','plugins'),logger,PREFIX)

print(modules)

allHandlers=[]
for modulname in modules:
  handlers=instantiateHandlersFromModule(modulname,modules[modulname],allData,logger)
  allHandlers+=handlers

print("created %d handlers"%len(allHandlers))

for handler in allHandlers:
    try:
      dt=threading.Thread(target=handler.run)
      dt.setDaemon(True)
      dt.start()
      print("###INFO: started %s"%handler)
    except:
      print("##ERROR: cannot start %s, errors in run %s"%(handler,traceback.format_exc()))

print("Parameter Listing:")
for p in list(allData.keys()):
  print("%s:%s"%(p,allData[p]))

time.sleep(10)

