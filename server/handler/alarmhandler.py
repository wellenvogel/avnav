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
import time

hasGpio=False
try:
  import RPi.GPIO as GPIO
  hasGpio=True
except:
  pass

from avnav_manager import AVNHandlerManager
from avnav_util import *
from avnav_worker import *
import avnav_handlerList

class AlarmConfig:
  def __init__(self,name="dummy",command="sound", parameter=None, repeat="1"):
    self.name=name
    self.command=command
    self.parameter=parameter
    self.repeat=int(repeat)
  def toDict(self):
    return self.__dict__


class AVNAlarmHandler(AVNWorker):
  CHANGE_KEY='alarm' #key for change counts
  DEFAULT_ALARMS=[
    		AlarmConfig(name="waypoint",command="sound",parameter="$BASEDIR/../sounds/waypointAlarm.mp3",repeat="1"),
  		  AlarmConfig(name="ais",command="sound",parameter="$BASEDIR/../sounds/aisAlarm.mp3",repeat="1"),
  		  AlarmConfig("anchor",command="sound",parameter="$BASEDIR/../sounds/anchorAlarm.mp3",repeat="20000"),
  		  AlarmConfig(name="gps",command="sound", parameter="$BASEDIR/../sounds/anchorAlarm.mp3", repeat="20000"),
  		  AlarmConfig(name="mob", command="sound", parameter="$BASEDIR/../sounds/anchorAlarm.mp3", repeat="2")
  ]
  """a handler for alarms"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.runningAlarms={}
    self.commandHandler=None
    currentAlarms=self.param.get('Alarm')
    if currentAlarms is None:
      currentAlarms=[]
    for da in self.DEFAULT_ALARMS:
      if any(x for x in currentAlarms if x.get('name') == da.name):
        continue
      currentAlarms.append(da.toDict())
    self.param['Alarm']=currentAlarms

  @classmethod
  def getConfigName(cls):
    return "AVNAlarmHandler"
  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      return {
        'defaultCommand':'sound',
        'defaultParameter':'',
        'stopAlarmPin':'' #when going low - stop alarm
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
    return True


  def _gpioCmd(self,channel):
    self.stopAll()
  def run(self):
    self.commandHandler=self.findHandlerByName("AVNCommandHandler")
    if self.commandHandler is None:
      self.setInfo('main',"no command handler found",WorkerStatus.ERROR)
      return
    self.setInfo('main',"running",WorkerStatus.NMEA)
    gpioPin=self.getIntParam('stopAlarmPin',False)
    if gpioPin != 0:
      if not hasGpio:
        AVNLog.error("gpio pin for stopAlarm defined but no GPIO support found")
      else:
        GPIO.setmode(GPIO.BOARD)
        GPIO.setup(gpioPin,GPIO.IN,pull_up_down=GPIO.PUD_UP)
        GPIO.add_event_detect(gpioPin,GPIO.FALLING,callback=self._gpioCmd,bouncetime=100)
        AVNLog.info("set gpio pin %d as reset alarm",gpioPin)
    while not self.shouldStop():
      time.sleep(0.5)
      deletes=[]
      for k in list(self.runningAlarms.keys()):
        id = self.runningAlarms.get(k)
        if not self.commandHandler.isCommandRunning(id):
          info=self.findAlarm(k,True)
          if info is not None and info.get("autoclean"):
            deletes.append(k)
      for k in deletes:
        try:
          del self.runningAlarms[k]
        except:
          pass
        self.setInfo(k, "alarm inactive \"%s\" " % k,
                     WorkerStatus.INACTIVE)

  def getRunningAlarms(self):
    return self.runningAlarms

  @classmethod
  def getBoolean(cls,dict,name):
    rt=dict.get(name)
    if rt is None:
      return False
    return str(rt).upper() == 'TRUE'
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
            param=AVNUtil.replaceParam(param, AVNHandlerManager.filterBaseParam(self.getParam()))
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
      self.setInfo(name, "no alarm \"%s\" configured"%name, WorkerStatus.ERROR)
      return False
    if self.runningAlarms.get(name) is not None:
      return True
    alarmid=self._startAlarmCmd(cmd)
    if alarmid is not None:
      info=cmd['command']
      if cmd.get('parameter') is not None:
        info+=" "+cmd.get('parameter')
      self.setInfo(name, "activated %s" % info, WorkerStatus.NMEA)
    else:
      self.setInfo(name, "unable to start alarm command \"%s\":\"%s\" " % (name,cmd['command']), WorkerStatus.INACTIVE)
    if alarmid is None:
      alarmid=-1
    self.runningAlarms[name] = alarmid
    self.navdata.updateChangeCounter(self.CHANGE_KEY)
    return True

  def stopAll(self):
    '''stop all alarms'''
    AVNLog.info("stopAllAlarms")
    alist=self.getRunningAlarms()
    if list is None:
      return
    for name in list(alist.keys()):
      self.stopAlarm(name)
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
      self.navdata.updateChangeCounter(self.CHANGE_KEY)
    if alarmid is not None and alarmid >=0:
      self.commandHandler.stopCommand(alarmid)
    self.setInfo(name, "stopped", WorkerStatus.INACTIVE)
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
    for k in list(self.runningAlarms.keys()):
      if rt.get(k) is None:
        info=self.findAlarm(k,True)
        rt[k]=info.get('command')
    return rt

  def getHandledCommands(self):
    return {"api":"alarm","download":"alarm"}

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
    if type == "download":
      name = AVNUtil.getHttpRequestParam(requestparam, "name")
      AVNLog.debug("download alarm %s",name)
      if name is None:
        AVNLog.error("missing parameter name for alarm download")
        return None
      alarmInfo = self.findAlarm(name)
      if alarmInfo is None:
        AVNLog.error("no alarm %s defined",name)
        return None
      file=alarmInfo.get('parameter')
      if file is None:
        return None
      fh=open(file,"rb")
      if fh is None:
        AVNLog.error("unable to find alarm sound %s",file)
        return None
      fsize=os.path.getsize(file)
      rt={}
      rt['mimetype'] = "audio/mpeg"
      rt['size']=fsize
      rt['stream']=fh
      return rt
    status=AVNUtil.getHttpRequestParam(requestparam,"status")
    if status is not None:
      status=status.split(',')
      rt={}
      definedCommands = self.getStatusProperties()
      if definedCommands is None:
        return rt
      for name in list(definedCommands.keys()):
        if name is None:
          continue
        if not name in status and not 'all' in status :
          continue
        running=self.runningAlarms.get(name)
        config=self.findAlarm(name,True)
        rt[name]={'alarm':name,
                  'running':True if running is not None else False,
                  'repeat': config.get('repeat')
                  }
      return {"status":"OK","data":rt}
    rt={'status':'ok'}
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



