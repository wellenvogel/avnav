#! /usr/bin/env python3
import xml.dom as dom
import xml.dom.minidom as parser
import os
import sys
import getopt
import tempfile
import traceback


def usage():
  print("usage: %s -f filename -h handler -c child [-k keyname=keyValue...] [-d] name=value"%sys.argv[0])

class ConfigItem:
  def __init__(self, handler:str = None, child:str = None):
    self.handler=handler
    self.child=child
    self.keys={}
    self.attributes={}
    self.doDelete=False
  def hasKeys(self):
    return len(self.keys) > 0
  def matchesKeys(self,element):
    if len(self.keys) < 1:
      return True
    for k,v in self.keys.items():
      if (not element.hasAttribute(k) or element.getAttribute(k) != v):
        return False
    return True
  def setAttributes(self,element,includeKeys=False):
    hasChanges=False
    if includeKeys:
      for k,v in self.keys.items():
        if element.hasAttribute(k) and element.getAttribute(k) == v:
          continue
        hasChanges=True
        element.setAttribute(k,v)
    for k,v in self.attributes.items():
      if element.hasAttribute(k) and element.getAttribute(k) == v:
        continue
      hasChanges=True
      element.setAttribute(k,v)
    return hasChanges
  def check(self):
    if self.handler is None:
      raise Exception("missing parameter handler")
    if len(self.keys) == 0 and len(self.attributes) == 0 and not self.doDelete:
      raise Exception("missing parameter keys and/or attributes")
    if self.doDelete and len(self.attributes) != 0:
      raise Exception("no attributes allowed for delete")
  def __str__(self):
    return "handler={handler}, child={child}, keys={xkeys}, doDelete={doDelete} attributes={xattributes}".\
      format(**self.__dict__,xkeys=str(self.keys),xattributes=str(self.attributes))


def changeDom(domObject, cfg: ConfigItem):
    handlers=domObject.documentElement.getElementsByTagName(cfg.handler)
    foundHandlers=[]
    handler=None
    isNew=False
    if len(handlers) > 0:
      if len(handlers) > 1:
        if not cfg.hasKeys():
          raise Exception("multiple handlers of type %s found but no keys given"%cfg.handler)
      for existingHandler in handlers:
        if cfg.matchesKeys(existingHandler):
          foundHandlers.append(existingHandler)
    if len(foundHandlers) > 1:
      raise Exception("found > 1 handler with matching keys")
    if len(foundHandlers) > 0:
      handler=foundHandlers[0]
    if handler is None:
      if cfg.doDelete:
        return False
      nl=domObject.createTextNode("\n")
      nl2=domObject.createTextNode("\n")
      domObject.documentElement.appendChild(nl)
      handler=domObject.createElement(cfg.handler)
      handler.appendChild(nl2)
      domObject.documentElement.appendChild(handler)
      domObject.documentElement.appendChild(nl)
      isNew=True
    if cfg.child is not None:
      foundChildren=[]
      for child in handler.childNodes:
        if child.nodeName != cfg.child:
          continue
        if cfg.matchesKeys(child):
          foundChildren.append(child)
      if len(foundChildren) > 0:
        isNew=False
        if len(foundChildren) > 1:
          raise Exception("more then one child node %s matches keys"%cfg.child)
        handler=foundChildren[0]
      else:
        if cfg.doDelete:
          #no matching child found - consider delete to be oK
          return False
        #create child node
        isNew=True
        child=domObject.createElement(cfg.child)
        nl=domObject.createTextNode("\n")
        handler.appendChild(child)
        handler.appendChild(nl)
        handler=child
    if cfg.doDelete:
      nextNode=handler.nextSibling
      if nextNode.nodeType == dom.Node.TEXT_NODE:
        if nextNode.data == '\n':
          handler.parentNode.removeChild(nextNode)
      handler.parentNode.removeChild(handler)
      return True
    changed=cfg.setAttributes(handler,isNew)
    return changed or isNew

def spNV(data):
  spl=data.split('=',2)
  if len(spl) != 2:
    return None
  return spl

def err(txt,printUsage=True):
  print("ERROR",txt)
  if printUsage:
    usage()
  sys.exit(1)

if __name__ == '__main__':
  cfg=ConfigItem()
  filename=None
  debug=0
  optlist,args=getopt.getopt(sys.argv[1:],'h:c:k:f:vd')
  for opt in optlist:
    if opt[0] == '-h':
      cfg.handler=opt[1]
    elif opt[0] == '-v':
      debug=1
    elif opt[0] == '-c':
      cfg.child=opt[1]
    elif opt[0] == '-d':
      cfg.doDelete=True
    elif opt[0] == '-f':
      filename=opt[1]
    elif opt[0] == '-k':
      spl=spNV(opt[1])
      if spl is not None:
        cfg.keys[spl[0]]=spl[1]
      else:
        err("invalid -k parameter %s"%opt[1])
  for arg in args:
    spl=spNV(arg)
    if spl is not None:
      cfg.attributes[spl[0]]=spl[1]
    else:
      err("invalid parameter %s"%arg)
  if filename is None:
    err("missing arg filename")
  if not os.path.exists(filename):
    err("file %s does not exist"%filename)
  if not os.access(filename,os.W_OK):
    err("cannot write file %s"%filename)
  curState=os.stat(filename)
  tmpfile=tempfile.NamedTemporaryFile(mode="w",dir=os.path.dirname(filename),prefix=os.path.basename(filename))
  if debug:
    print("tmpfile=",tmpfile.name)
  if not os.path.exists(filename):
    raise Exception("file %s not found"%filename)
  try:
    cfg.check()
  except Exception as e:
    print("Error: ",str(e))
    usage()
    sys.exit(1)
  if debug:
    print("filename=",filename)
    print("cfg=",cfg)
  domObject=parser.parse(filename)
  changed=False
  try:
    changed=changeDom(domObject,cfg)
  except Exception as e:
    if (debug):
      print(traceback.format_exc())
    err(str(e))
  if changed:
    domObject.writexml(tmpfile)
    tmpfile.flush()
    os.chown(tmpfile.name,curState.st_uid,curState.st_gid)
    os.chmod(tmpfile.name,curState.st_mode)
    os.replace(tmpfile.name,filename)
    try:
      tmpfile.close()
    except Exception as e:
      pass
    if debug:
      print("updated",filename)
  else:
    if debug:
      print("unchanged",filename)
