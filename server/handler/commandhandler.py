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

import time
import subprocess
import threading
import os
import datetime
import glob
import sys
import traceback
import json
import datetime
import threading
import signal
import shlex

from avnav_util import *
from avnav_worker import *
import avnav_handlerList

class Handler:
  def __init__(self,command,name,callback):
    cmdstring=command.get('command')
    repeat=command.get('repeat')
    self.command=cmdstring
    self.name=name
    self.callback=callback
    self.thread=None
    self.stop=False
    self.repeat=int(repeat) if repeat is not None else 1
    self.subprocess=None

  def getCommand(self):
    return self.command

  def _startCmd(self):
    args = shlex.split(self.command)
    AVNLog.debug("starting command ", args)
    self.subprocess = subprocess.Popen(args, stdout=subprocess.PIPE, stdin=subprocess.PIPE,
                                       preexec_fn=os.setsid)
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
      os.killpg(os.getpgid(self.subprocess.pid), signal.SIGTERM)
      self.thread.join(10)
    except :
      AVNLog.error("unable to stop command %s:%s",self.name,traceback.format_exc())

  def run(self):
    threading.current_thread().setName("[%s]cmd: %s" % (AVNLog.getThreadId(), self.name))
    while self.repeat > 0:
      try:
        while True and not self.stop:
          line = self.subprocess.stdout.readline()
          if not line:
            break
          AVNLog.debug("[cmd]%s", line.strip())
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
          self.callback(self.name,status)
      if self.repeat > 0:
        try:
          self._startCmd()
        except:
          AVNLog.debug("unable to start command %s:%s",self.name,self.command)
    return self.subprocess.returncode

class AVNCommandHandler(AVNWorker):
  """a handler to start configured commands"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.runningProcesses={}
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
        'repeat':1
      }
  @classmethod
  def preventMultiInstance(cls):
    return True
  def getName(self):
    return "CommandHandler"

  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    while True:
      #self.startCommand("test")
      time.sleep(10)

  def findCommand(self,name):
    definedCommands=self.param.get('Command')
    if definedCommands is None:
      return None
    for cmd in definedCommands:
      if cmd.get('name') is not None and cmd.get('name') == name:
        return {'command':cmd.get('command'),'repeat':cmd.get('repeat')}
  def commandFinished(self,name,status):
    AVNLog.info("finished with status %d",status)
    self.setInfo(name,"finished with status %d"%(status),self.Status.INACTIVE)
    try:
      del self.runningProcesses[name]
    except:
      pass

  def startCommand(self,name):
    """start a named command"""
    cmd=self.findCommand(name)
    if cmd is None:
      AVNLog.error("no command \"%s\" configured", name)
      self.setInfo(name, "no command \"%s\" configured"%name, self.Status.ERROR)
      return False
    current=self.runningProcesses.get(name)
    if current is not None:
      AVNLog.warn("command %s running on new start, trying to stop",name)
      current.stopHandler()
    AVNLog.info("start command %s=%s",name,cmd)
    handler=Handler(cmd,name,self.commandFinished)
    try:
      handler.start()
      self.setInfo(name,"running \"%s\""%handler.getCommand(),self.Status.RUNNING)
    except:
      AVNLog.error("error starting command %s=%s: %s",name,handler.getCommand(),traceback.format_exc())
      self.setInfo(name, "unable to run %s: %s"%(cmd,traceback.format_exc(1)), self.Status.ERROR)
      return False
    self.runningProcesses[name]=handler
    return True

  def stopCommand(self, name):
    cmd = self.findCommand(name)
    if cmd is None:
      AVNLog.error("no command \"%s\" configured", name)
      return False
    current = self.runningProcesses.get(name)
    if current is not None:
      AVNLog.warn("command %s running on new start, trying to stop", name)
      try:
        current.stopHandler()
        return True
      except:
        self.setInfo(name,"unable to stop command %s"%traceback.format_exc(1),self.Status.ERROR)
        return False


  def getStatusProperties(self):
    commands=self.param.get('Command')
    if commands is None:
      return {}
    rt={}
    for cmd in commands:
      n=cmd.get('name')
      if n is None:
        continue
      rt[n]=cmd.get('command')
    return rt

  def getHandledCommands(self):
    return "command"
  def handleApiRequest(self,type,command,requestparam,**kwargs):
    status=AVNUtil.getHttpRequestParam(requestparam,"status")
    if status is not None:
      status=status.split(',')
      rt={}
      definedCommands = self.param.get('Command')
      if definedCommands is None:
        return rt
      for cmd in definedCommands:
        name=cmd.get('name')
        if name is None:
          continue
        if not name in status and not 'all' in status :
          continue
        running=self.runningProcesses.get(name)
        rt[name]={'command':cmd.get('command'),'repeat':cmd.get('repeat'),'running':True if running is not None else False}
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
        rt['info']=self.info.get(command)
      return rt
    if not self.stopCommand(command):
      rt['status'] = 'error'
      rt['info'] = self.info.get(command)
    return rt


avnav_handlerList.registerHandler(AVNCommandHandler)



