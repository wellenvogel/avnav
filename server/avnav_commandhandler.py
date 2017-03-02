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

from avnav_util import *
from avnav_worker import *
from wpa_control import WpaControl
import avnav_handlerList

class Handler:
  def __init__(self,command,name,callback):
    self.command=command
    self.name=name
    self.callback=callback
    self.thread=None
    self.stop=False
    self.subprocess=None

  def start(self):
    self.subprocess=subprocess.Popen(self.command, stdout=subprocess.PIPE,
                       preexec_fn=os.setsid)
    self.thread=threading.Thread(target=self.run)
    self.thread.setDaemon(True)
    self.thread.start()

  def stop(self):
    if self.stop:
      return
    try:
      self.stop=True
      os.killpg(os.getpgid(self.subprocess.pid), signal.SIGTERM)
      self.thread.join(10)
    except :
      AVNLog.error("unable to stop command %s:%s",self.name,traceback.format_exc())

  def run(self):
    threading.current_thread().setName("[%s]cmd: %s" % (AVNLog.getThreadId(), self.name))
    while True and not self.stop:
      line = self.subprocess.stdout.readline()
      if not line:
        break
      AVNLog.debug("[cmd]%s", line.strip())
    self.subprocess.poll()
    if self.callback is not None:
      self.callback(self.name,self.subprocess.returncode)
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
        'commandline': ""
      }
  @classmethod
  def preventMultiInstance(cls):
    return True
  def getName(self):
    return "CommandHandler"

  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    while True:
      time.sleep(5)

  def findCommand(self,name):
    definedCommands=self.param.get('Commands')
    if definedCommands is None:
      return None
    for cmd in definedCommands:
      if cmd.get('name') is not None and cmd.get('name') == name:
        return cmd.get('commandLine')
  def commandFinished(self,name,status):
    AVNLog.debug("command %s finished with status %d",name,status)
    try:
      del self.runningProcesses[name]
    except:
      pass

  def startCommand(self,name):
    """start a named command"""
    cmd=self.findCommand(name)
    if cmd is None:
      AVNLog.error("no command %s configured", name)
      return False
    current=self.runningProcesses.get(name)
    if current is not None:
      AVNLog.warn("command %s running on new start, trying to stop",name)
      current.stop()
    AVNLog.info("start command %s=%s",name,cmd)
    handler=Handler(cmd,name,self.commandFinished)
    try:
      handler.start()
    except:
      AVNLog.error("error starting command %s=%s: %s",name,cmd,traceback.format_exc())
      return False
    self.runningProcesses[name]=handler



avnav_handlerList.registerHandler(AVNCommandHandler)



