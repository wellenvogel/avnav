import os
import time
import inspect
import sys
import traceback

from avnav_util import AVNUtil

allData={}

class Logger:
  def log(self,str):
    print "###%s"%(str)

class Feeder:
  def fetchFromHistory(self,seq,num):
    time.sleep(0.5)
    return ['aha','soso']

class DataStore:
  def __init__(self):
    self.patterns=None
  def setPattern(self,pattern):
    self.patterns=pattern
  def storeData(self,path,value,timestamp=None):
    if self.patterns is not None:
      matches=False
      for p in self.patterns:
        if p.get('path') == path:
          matches=True
          break
      if not matches:
        print "@@ERROR: inavlid path %s"%(path)
        return
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
        store = DataStore()
        startDecoder=True
        x=None
        try:
          x=obj()
          d=x.initialize(Logger(),store,Feeder())
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
                store.setPattern(mData)
        except :
          print "##ERROR: cannot start %s:%s"%(name,traceback.format_exc())
          startDecoder=False
        if startDecoder and x is not None:
          try:
            x.run()
          except:
            print "##ERROR: cannot start %s, errors in run %s"%(name,traceback.format_exc())

print "Parameter Listing:"
for p in allData.keys():
  print "%s:%s"%(p,allData[p])

time.sleep(10)

