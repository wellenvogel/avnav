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

from avnav_config import AVNConfig
from avnav_util import *
from avnav_worker import *
import avnav_handlerList


class AVNAlarmHandler(AVNWorker):
  """a handler for alarms"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.runningAlarms={}
    self.commandHandler=None
  @classmethod
  def getConfigName(cls):
    return "AVNAlarmHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      return {
        'defaultCommand':'sound',
        'defaultParameter':''
      }
    if child == "Alarm":
      return {
        'name': '',
        'command': '',
        'autoclean':'false',
        'repeat':'1',
        'parameter':'',
        'duration':'' #duration in s - last that long even if the command finishes earlier
      }
  @classmethod
  def preventMultiInstance(cls):
    return True

  @classmethod
  def autoInstantiate(cls):
    return '''
    <AVNAlarmHandler>
		<Alarm name="waypoint" command="sound" parameter="$BASEDIR/../sounds/waypointAlarm.mp3" repeat="1"/>
		<Alarm name="ais" command="sound" parameter="$BASEDIR/../sounds/aisAlarm.mp3" repeat="1"/>
		<Alarm name="anchor" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>
		<Alarm name="gps" command="sound" parameter="$BASEDIR/../sounds/anchorAlarm.mp3" repeat="20000"/>
	</AVNAlarmHandler>
    '''

  def getName(self):
    return "AlarmHandler"

  def run(self):
    self.setName("[%s]%s"%(AVNLog.getThreadId(),self.getConfigName()))
    self.commandHandler=self.findHandlerByName("AVNCommandHandler")
    if self.commandHandler is None:
      self.setInfo('main',"no command handler found",self.Status.ERROR)
      return
    self.setInfo('main',"running",self.Status.NMEA)
    while True:
      time.sleep(0.5)
      deletes=[]
      for k in self.runningAlarms.keys():
        info = self.runningAlarms.get(k)
        if not self.commandHandler.isCommandRunning(info['command']):
          if info['autoclean']:
            deletes.append(k)
          if info['repeat'] > 1:
            info['repeat'] = info['repeat'] -1
            self._startAlarmCmd(info)
      for k in deletes:
        try:
          del self.runningAlarms[k]
        except:
          pass
        self.setInfo(k, "alarm inactive \"%s\" " % k,
                     self.Status.INACTIVE)

  def getRunningAlarms(self):
    return self.runningAlarms

  @classmethod
  def getBoolean(cls,dict,name):
    rt=dict.get(name)
    if rt is None:
      return False
    return unicode(rt).upper() == u'TRUE'
  @classmethod
  def getInt(cls,dict,name):
    if dict is None:
      return None
    rt=dict.get(name)
    try:
      return int(rt or 0)
    except:
      return 0
  def findAlarm(self,name,useDefault=False):
    definedAlarms=self.param.get('Alarm')
    rt=None
    if definedAlarms is not None:
      for cmd in definedAlarms:
        if cmd.get('name') is not None and cmd.get('name') == name:
          param=cmd.get('parameter')
          if param=="":
            param=None
          if param is not None:
            param=AVNUtil.replaceParam(param,AVNConfig.filterBaseParam(self.getParam()))
          rt= {
            'command':cmd.get('command'),
            'autoclean':self.getBoolean(cmd,'autoclean'),
            'repeat':self.getInt(cmd,'repeat'),
            'parameter':param
          }
          break
    if rt is None and useDefault:
      rt={
        'command':self.getStringParam('defaultCommand'),
        'parameter':self.getStringParam('defaultParameter'),
        'autoclean':True,
        'repeat':1}
    return rt

  def _startAlarmCmd(self,alarmdef):
    return self.commandHandler.startCommand(alarmdef['command'],alarmdef.get('repeat'),alarmdef.get('parameter'))

  def startAlarm(self,name,useDefault=False):
    """start a named alarm"""
    cmd=self.findAlarm(name,useDefault)
    if cmd is None:
      AVNLog.error("no alarm \"%s\" configured", name)
      self.setInfo(name, "no alarm \"%s\" configured"%name, self.Status.ERROR)
      return False
    if self.runningAlarms.get(name) is not None:
      return True
    alarmid=self._startAlarmCmd(cmd)
    if alarmid is not None:
      info=cmd['command']
      if cmd.get('parameter') is not None:
        info+=" "+cmd.get('parameter')
      self.setInfo(name, "activated %s" % info, self.Status.NMEA)
    else:
      self.setInfo(name, "unable to start alarm command \"%s\":\"%s\" " % (name,cmd['command']), self.Status.INACTIVE)
    self.runningAlarms[name] = alarmid
    return True

  def stopAlarm(self, name):
    '''stop a named command'''
    cmd = self.findAlarm(name,True)
    if cmd is None:
      AVNLog.error("no alarm \"%s\" configured", name)
      return False
    alarmid=self.runningAlarms.get(name)
    try:
      del self.runningAlarms[name]
    except:
      pass
    if alarmid is not None:
      self.commandHandler.stopCommand(alarmid)
    self.setInfo(name, "stopped", self.Status.INACTIVE)
    return True

  def isAlarmActive(self,name):
    '''return True if the named alarm is running'''
    al=self.runningAlarms.get(name)
    if al is None:
      return False
    return True
  def getStatusProperties(self):
    commands=self.param.get('Alarm')
    rt={}
    if commands is not None:
      for cmd in commands:
        n=cmd.get('name')
        if n is None:
          continue
        rt[n]=cmd.get('command')
    for k in self.runningAlarms.keys():
      if rt.get(k) is None:
        cmd=self.runningAlarms.get(k)
        rt[k]=cmd['command']
    return rt

  def getHandledCommands(self):
    return "alarm"

  def handleApiRequest(self,type,command,requestparam,**kwargs):
    '''
    handle the URL based requests
    :param type: api
    :param command: alarm
    :param requestparam: url parameters
    :param kwargs:
    :return: the answer
    status=name,name,|all returns a hash {name:{name:alarmName,running:true}
    start=name returns {status:ok|error}
    stop=name,name {status: ok|err}
    media=name {command:thecommand,repeat:therepeat,url:mediaUrl}
    '''
    status=AVNUtil.getHttpRequestParam(requestparam,"status")
    if status is not None:
      status=status.split(',')
      rt={}
      definedCommands = self.getStatusProperties()
      if definedCommands is None:
        return rt
      for name in definedCommands.keys():
        if name is None:
          continue
        if not name in status and not 'all' in status :
          continue
        running=self.runningAlarms.get(name)
        rt[name]={'alarm':name,'running':True if running is not None else False}
      return rt
    media=AVNUtil.getHttpRequestParam(requestparam,"media")
    rt={'status':'ok'}
    if media is not None:
      http=self.findHandlerByName('AVNHttpServer')
      for alarm in media.split(','):
        alarmInfo=self.findAlarm(alarm)
        rt['command']=alarmInfo.get('command')
        rt['repeat']=alarmInfo.get('repeat')
        if http is not None:
          rt['url']=http.getUrlPath(alarmInfo.get('parameter')) or ""
        return rt
        #TODO: handle multiple alarms
      return rt
    mode="start"
    command=AVNUtil.getHttpRequestParam(requestparam,"start")
    if command is None:
      command = AVNUtil.getHttpRequestParam(requestparam, "stop")
      mode="stop"
      if command is None:
        rt={'info':"missing request parameter start or stop",'status':'error'}
        return rt
    rt={'status':'ok'}
    if mode == "start":
      if not self.startAlarm(command,True):
        rt['status']='error'
        rt['info']=self.info.get(command)
      return rt
    if not self.stopAlarm(command):
      rt['status'] = 'error'
      rt['info'] = self.info.get(command)
    return rt


avnav_handlerList.registerHandler(AVNAlarmHandler)



