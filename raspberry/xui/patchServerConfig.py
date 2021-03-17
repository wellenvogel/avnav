#! /usr/bin/env python3
import xml.dom as dom
import xml.dom.minidom as parser
import os
import sys

TAG='AVNCommandHandler'
CMDTAG='Command'
def insertCommand(filename,name,param):
    if not os.path.exists(filename):
        raise Exception("file %s not found"%filename)
    domObject=parser.parse(filename)
    handlers=domObject.documentElement.getElementsByTagName(TAG)
    handler=None
    existing=False
    if len(handlers) > 0:
      handler=handlers[0]
      for cmd in handler.childNodes:
        if cmd.nodeName != CMDTAG:
          continue
        if cmd.getAttribute('name') == name:
          for k,v in param.items():
            cmd.setAttribute(k,str(v))
          existing=True
    if handler is None:
      nl=domObject.createTextNode("\n")
      nl2=domObject.createTextNode("\n")
      domObject.documentElement.appendChild(nl)
      handler=domObject.createElement(TAG)
      handler.appendChild(nl2)
      domObject.documentElement.appendChild(handler)
      domObject.documentElement.appendChild(nl)
    if not existing:
      cmd=domObject.createElement(CMDTAG)
      nl=domObject.createTextNode("\n")
      handler.appendChild(cmd)
      handler.appendChild(nl)
      for k,v in param.items():
        cmd.setAttribute(k,str(v))
    tmp=filename+".tmp"
    with open(tmp,"w") as oh:
      domObject.writexml(oh)
    os.replace(tmp,filename)


if __name__ == '__main__':
  if len(sys.argv) < 5:
    print("usage: %s filename name command icon")
    sys.exit(1)
  insertCommand(sys.argv[1],sys.argv[2],{
    'client':'local',
    'command': sys.argv[3],
    'icon': sys.argv[4],
    'name': sys.argv[2]
  })


                   