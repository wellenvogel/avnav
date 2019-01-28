import os
import time
import inspect
import sys

from avnav_util import AVNUtil

class Logger:
  def log(self,str):
    print "###%s"%(str)

class Feeder:
  def fetchFromHistory(self,seq,num):
    time.sleep(0.5)
    return ['aha','soso']

class DataStore:
  def storeData(self,path,value,timestamp=None):
    print "@@DATA@@:%s->%s"%(path,value)

import os, glob, imp
MANDATORY_METHODS=['initialize','run']
modules = {}
for path in glob.glob(os.path.join(os.path.dirname(__file__),'..','decoder','[!_]*.py')):
    name, ext = os.path.splitext(os.path.basename(path))
    modules[name] = imp.load_source("avnav_decoder_sys_"+name, path)
print modules

print "AllModules="
print sys.modules.keys()

for module in modules:
  for name in dir(modules[module]):
    obj=getattr(modules[module],name)
    ic=inspect.isclass(obj)
    print "X: %s.%s => %s"%(module,name,ic)
    if ic:
      hasMethods=True
      for m in MANDATORY_METHODS:
        mObj=getattr(obj,m)
        if not callable(mObj):
          hasMethods=False
          break
      if hasMethods:
        print "starting %s"%(name)
        x=obj()
        d=x.initialize(Logger(),DataStore(),Feeder())
        x.run()

time.sleep(10)

