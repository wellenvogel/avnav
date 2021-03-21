import os
import sys
import re
import importlib
sys.path.insert(0,os.path.dirname(os.path.realpath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(__file__),"..","..","libraries"))
__all__=[]
regexp="(.+)\.py(c?)$"
mdir=os.path.dirname(__file__)
for entry in os.listdir(mdir):
  if entry == '__init__.py':
    continue
  if os.path.isfile(os.path.join(mdir, entry)):
    regexp_result = re.search(regexp, entry)
    if regexp_result:  # is a module file name
      importlib.import_module("."+regexp_result.groups()[0],__package__)
