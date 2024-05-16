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

import re
import signal
import urllib.parse

import time

import avnav_handlerList
from avnav_manager import AVNHandlerManager
from avnav_util import *
from avnav_worker import *


class Handler(object):
  def __init__(self,command,id,callback,parameters=None):
    repeat=command.get('repeat')
    self.command=command
    self.parameters=parameters
    self.name=command.get('name')
    self.id=id
    self.callback=callback
    self.thread=None
    self.stop=False
    self.repeat=int(repeat) if repeat is not None else 1
    self.subprocess=None

  def getCommandStr(self):
    return self.command.get('command')

  def _startCmd(self):
    args = re.split("[ \t]+",self.getCommandStr())
    AVNLog.debug("starting command %s", " ".join(args))
    if self.parameters is not None:
      if isinstance(self.parameters,list):
        args.extend(self.parameters)
      else:
        args.extend(re.split("[ \t]+",self.parameters))
    if hasattr(os,'setsid'):
      self.subprocess = subprocess.Popen(args, stdout=subprocess.PIPE, stdin=subprocess.PIPE,
                                       preexec_fn=os.setsid)
    else:
      self.subprocess = subprocess.Popen(args, stdout=subprocess.PIPE, stdin=subprocess.PIPE)
    self.subprocess.stdin.close()
  def start(self):
    self._startCmd()
    self.thread=threading.Thread(target=self.run)
    self.thread.setDaemon(True)
    self.thread.start()

  def stopHandler(self):
    if self.stop:
      return
    try:
      self.stop=True
      self.repeat=0
      if hasattr(os,'killpg'):
        os.killpg(os.getpgid(self.subprocess.pid), signal.SIGTERM)
      else:
        os.kill(self.subprocess.pid,signal.SIGTERM)
      self.thread.join(10)
    except :
      AVNLog.error("unable to stop command %s:%s",self.name,traceback.format_exc())


  def run(self):
    threading.current_thread().setName("CommandHandler: %s" %  self.name)
    while self.repeat > 0:
      status=None
      try:
        while True and not self.stop:
          line = self.subprocess.stdout.readline()
          if not line:
            break
          AVNLog.info("[cmd]%s", line.strip())
        status=None
        wt=30
        while wt >0 and status is None:
          status=self.subprocess.poll()
          if status is None:
            time.sleep(0.1)
          wt-=1
      except :
        pass
      self.repeat -= 1
      if self.repeat <= 0:
        if self.callback is not None:
          if status is None:
            status=-1
          self.callback(self.id,status)
      if self.repeat > 0:
        try:
          self._startCmd()
        except:
          AVNLog.debug("unable to start command %s:%s",self.name,self.command)
    return self.subprocess.returncode

  def getName(self):
    return self.name
  def getId(self):
    return self.id
  def getIdStr(self):
    return str(self.id)
  def __str__(self):
    return "%s(%d): %s %s, repeat=%d"%(self.name,self.id,self.getCommandStr(),self.parameters,self.repeat)

class AVNCommandHandler(AVNWorker):
  """a handler to start configured commands"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.runningProcesses={}
    self.cntLock = threading.Lock()
    self.idCounter = 0
    self.pluginCommands={}
    self.lock=threading.Lock()
  @classmethod
  def getConfigName(cls):
    return "AVNCommandHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      return {
      }
    if child == "Command":
      return {
        'name': '',
        'command': '',
        'repeat':1,
        'client':'none', #none,local,all
        'icon':''
      }
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return '''
    <AVNCommandHandler>
        <Command name="sound" command="mpg123 -q" repeat="1"/>
    </AVNCommandHandler>
    '''


  def getNextId(self):
    self.cntLock.acquire()
    self.idCounter+=1
    rt=self.idCounter
    self.cntLock.release()
    return rt
  def run(self):
    for cmd in self.getConfiguredCommands():
      self.updateCommandStatus(cmd)
    while not self.shouldStop():
      #self.startCommand("test")
      self.wait(10)

  def getConfiguredCommands(self):
    rt={}
    definedCommands = self.param.get('Command')
    if definedCommands is not None:
      for cmd in definedCommands:
        name=cmd.get('name')
        if name is not None:
          rt[name]=cmd
    with self.lock:
      for k,v in self.pluginCommands.items():
        for cmd in v:
          name=cmd.get('name')
          if name is not None:
            rt[name]=cmd
    return list(rt.values())

  def listCommandNames(self):
    rt=[]
    commands=self.getConfiguredCommands()
    for c in commands:
      name=c.get('name')
      if name is not None:
        rt.append(name)
    return rt

  def addPluginCommand(self,pluginName,name,command,icon=None,client=None):
    '''
    add a command from a plugin
    @param pluginName: the plugin name
    @param name: the command name
    @param command: the command to be executed (can contain parameters)
    @param icon: the icon
    @param client: local|all|None
    @return:
    '''
    with self.lock:
      cmds=self.pluginCommands.get(pluginName)
      newCommands=[]
      if cmds is not None:
        for cmd in cmds:
          if cmd.get('name') != name:
            newCommands.append(cmd)
      newCommand={
        'name':name,
        'command':command,
        'icon':icon if icon is not None else ''
      }
      if client in ['local','all']:
        newCommand['client']=client
      newCommands.append(newCommand)
      self.pluginCommands[pluginName]=newCommands

  def removePluginCommands(self,pluginName):
    with self.lock:
      try:
        del self.pluginCommands[pluginName]
      except:
        pass

  def updateCommandStatus(self,cmd):
    running=self.findRunningCommandsByName(cmd.get('name'))
    self.setInfo(cmd.get('name'), "param=%s,repeat=%s" % (cmd.get('parameter'), cmd.get('repeat')),
                 WorkerStatus.INACTIVE if len(running) == 0 else WorkerStatus.NMEA)

  def findCommand(self,name):
    '''
    find a command by its name
    :param name:
    :return:
    '''
    for cmd in self.getConfiguredCommands():
      if cmd.get('name') is not None and cmd.get('name') == name:
        return {'command':AVNUtil.replaceParam(cmd.get('command'), AVNHandlerManager.filterBaseParam(self.getParam())), 'repeat':cmd.get('repeat'), 'name':cmd.get('name')}
  def findRunningCommandsByName(self,name):
    rt=[]
    if name is None:
      return rt
    for id in list(self.runningProcesses.keys()):
      try:
        if self.runningProcesses[id].getName() == name:
          rt.append(self.runningProcesses[id])
      except:
        pass
    return rt
  def commandFinished(self,id,status):
    AVNLog.info("%d finished with status %d",id,status)
    self.deleteInfo(id)
    try:
      cmd=self.runningProcesses.get(id)
      del self.runningProcesses[id]
      if cmd is not None:
        self.updateCommandStatus(cmd)
    except:
      pass

  def startCommand(self,name,repeat=None,parameters=None):
    """start a named command

        :arg name the name of the command to be started
        :returns an id to be used when querying or stopping the command or None if not started
    """
    cmd=self.findCommand(name)
    if cmd is None:
      AVNLog.error("no command \"%s\" configured", name)
      self.setInfo(name, "no command \"%s\" configured"%name, WorkerStatus.ERROR)
      return None
    cmd=cmd.copy()
    if repeat is not None:
      cmd['repeat']=repeat
    AVNLog.info("start command %s=%s",name,cmd)
    id=self.getNextId()
    handler=Handler(cmd,id,self.commandFinished,parameters)
    try:
      handler.start()
      self.setInfo(id,"running %s"%(str(handler)),WorkerStatus.RUNNING)
    except:
      AVNLog.error("error starting command %s=%s: %s",name,handler.getCommandStr(),traceback.format_exc())
      self.setInfo(name, "unable to run %s: %s"%(cmd,traceback.format_exc(1)), WorkerStatus.ERROR)
      return None
    self.runningProcesses[id]=handler
    try:
      self.updateCommandStatus(cmd)
    except:
      pass
    return id

  def stopCommand(self, id):
    '''stop a command

    :arg id the command id
    '''
    current = self.runningProcesses.get(id)
    if current is not None:
      AVNLog.info("command %d running ,trying to stop", id)
      try:
        current.stopHandler()
        return True
      except:
        self.setInfo(id,"unable to stop command %s"%traceback.format_exc(1),WorkerStatus.ERROR)
        return False

  def isCommandRunning(self,id):
    '''return True if the command is running'''
    current=self.runningProcesses.get(id)
    if current is None:
      return False
    return True

  def getStatusProperties(self):
    commands=self.getConfiguredCommands()
    rt={}
    for cmd in commands:
      n=cmd.get('name')
      if n is None:
        continue
      rt[n]=cmd.get('command')
    return rt

  def getIconUrl(self,cmd,handler=None):
    icon=cmd.get('icon')
    if icon is None or icon == '':
      return None
    if icon[0] != '/':
      if handler is None:
        return None
      baseUrl=handler.getPageRoot()
      return baseUrl+"/"+icon
    return icon

  def getClientCommands(self,isLocal,handler=None,addCmd=False):
    rt=[]
    commands=self.getConfiguredCommands()
    for cmd in commands:
      clientMode=cmd.get('client')
      if clientMode is None:
        continue
      if clientMode == 'all' or (clientMode == 'local' and isLocal):
        el={
          'name':cmd.get('name'),
          'icon': self.getIconUrl(cmd,handler)
        }
        if addCmd:
          el['cmd']=cmd
        rt.append(el)
    return rt

  def getHandledCommands(self):
    return "command"
  def handleApiRequest(self,type,command,requestparam,**kwargs):
    if type == 'api':
      command=AVNUtil.getHttpRequestParam(requestparam,"action",mantadory=False)
      if command is not None:
        handler=kwargs.get('handler')
        isLocal=False
        try:
          remoteIp=handler.client_address[0]
          isLocal=(remoteIp == '127.0.0.1' or remoteIp =='localhost')
        except Exception as e:
          pass
        rt={'status':'unknown action %s'%command}
        if command == 'getCommands': #get the commands we can trigger from remote
          rt['status']='OK'
          rt['data']=self.getClientCommands(isLocal,handler)
          return rt
        if command == 'runCommand':
          name=AVNUtil.getHttpRequestParam(requestparam,'name',mantadory=True)
          parameter=AVNUtil.getHttpRequestParam(requestparam,"parameter",mantadory=False)
          allowedCommands=self.getClientCommands(isLocal,handler)
          for cmd in allowedCommands:
            if cmd['name'] == name:
              self.startCommand(name,parameters=parameter)
              return {'status':'OK'}
          return {'status': 'command %s not found'%name}
        return rt
    status=AVNUtil.getHttpRequestParam(requestparam,"status")
    if status is not None:
      status=status.split(',')
      rt={}
      definedCommands = self.getConfiguredCommands()
      for cmd in definedCommands:
        name=cmd.get('name')
        if name is None:
          continue
        if not name in status and not 'all' in status :
          continue
        running=self.findRunningCommandsByName(name)
        rt[name]={'command':cmd.get('command'),'repeat':cmd.get('repeat'),'running':",".join([ x.getIdStr() for x in running])}
      return rt
    mode="start"
    command=AVNUtil.getHttpRequestParam(requestparam,"start")
    if command is None:
      command = AVNUtil.getHttpRequestParam(requestparam, "stop")
      mode="stop"
      if command is None:
        raise Exception("missing request parameter start or stop")

    rt={'status':'ok'}
    if mode == "start":
      if not self.startCommand(command):
        rt['status']='error'
        rt['info']=str(self.status.get(command))
      return rt
    if not self.stopCommand(command):
      rt['status'] = 'error'
      rt['info'] = str(self.status.get(command))
    return rt


avnav_handlerList.registerHandler(AVNCommandHandler)



