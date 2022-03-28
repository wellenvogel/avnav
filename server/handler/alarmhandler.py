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

from avndirectories import AVNUserHandler
from commandhandler import AVNCommandHandler

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
  C_INFO='info'
  C_CRITICAL='critical'
  @classmethod
  def fromDict(cls,dct):
    rt=AlarmConfig()
    for k in list(rt.__dict__.keys()):
      setattr(rt,k,dct.get(k))
    return rt
  def __init__(self,name=None,command="sound", parameter=None, repeat="1",category=None,sound=None,autoclean=False):
    self.name=name
    self.command=command
    self.parameter=parameter
    self.repeat=int(repeat)
    self.category=category
    self.sound=sound
    self.autoclean=autoclean
  def toDict(self):
    return {k:v for k,v in self.__dict__.items() if v is not None}


class RunningAlarm:
  def __init__(self,config,commandId=None,running=True,info=None):
    self.config=config
    self.commandId=commandId
    self.running=running
    self.info=info

class AVNAlarmHandler(AVNWorker):
  CHANGE_KEY='alarm' #key for change counts
  P_INFOSOUND=WorkerParameter('infoSound',type=WorkerParameter.T_SELECT,default='waypointAlarm.mp3',
                              description='sound to be played for info Alarms (only if no explicit config)',
                              rangeOrList=[])
  P_CRITICALSOUND=WorkerParameter('criticalSound',type=WorkerParameter.T_SELECT,default='anchorAlarm.mp3',
                              description='sound to be played for critical Alarms (only if no explicit config)',
                              rangeOrList=[])
  P_STOPALARMPIN=WorkerParameter('stopAlarmPin',type=WorkerParameter.T_NUMBER,
                                 description='a gpio pin (board numbering!) to switch off alarms when it goes low',
                                 mandatory=False)
  P_DEFAULTCOMMAND=WorkerParameter('defaultCommand',type=WorkerParameter.T_SELECT,
                                   default='sound',
                                   description='a command that is configured at AVNCommandhandler',
                                   rangeOrList=[])
  P_DEFAULTPARAM=WorkerParameter('defaultParameter',default='',editable=False)

  @classmethod
  def getSoundDirs(cls):
    soundDirs=[]
    instance=cls.findHandlerByName(AVNUserHandler.getConfigName())
    if instance:
      base=instance.baseDir
      if os.path.isdir(base):
        soundDirs.append(base)
    instance=cls.findHandlerByName(cls.getConfigName())
    if instance:
      base=instance.getStringParam(AVNHandlerManager.BASEPARAM.BASEDIR)
      if base:
        baseSounds=os.path.join(base,'..','sounds')
        if os.path.isdir(baseSounds):
          soundDirs.append(baseSounds)
    return soundDirs

  @classmethod
  def listAlarmSounds(cls):
    sounds=set()
    soundDirs=cls.getSoundDirs()
    for dir in soundDirs:
      for f in os.listdir(dir):
            if f.endswith('.mp3') or f.endswith('.MP3'):
              sounds.add(f)
    return list(sounds)

  @classmethod
  def listCommands(cls):
    cmdhandler=cls.findHandlerByName(AVNCommandHandler.getConfigName())
    if cmdhandler:
      return cmdhandler.listCommandNames()
    return ['sound']


  DEFAULT_ALARMS=[
    		AlarmConfig(name="waypoint",category=AlarmConfig.C_INFO,repeat="1"),
  		  AlarmConfig("anchor",category=AlarmConfig.C_CRITICAL,repeat="20000"),
  		  AlarmConfig(name="gps",category=AlarmConfig.C_CRITICAL, repeat="20000"),
  		  AlarmConfig(name="mob", category=AlarmConfig.C_CRITICAL, repeat="2")
  ]
  """a handler for alarms"""
  def __init__(self,param):
    AVNWorker.__init__(self, param)
    self.runningAlarms={}
    self.__runningAlarmsLock=threading.Lock()
    self.commandHandler=None
    self.handlers=[]
    self.__handlerLock=threading.Lock()
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
  def getConfigParamCombined(cls, child=None):
    return cls.getConfigParam(child)

  @classmethod
  def getConfigParam(cls, child=None):
    if child is None:
      rt=[cls.P_INFOSOUND.copy(rangeOrList=cls.listAlarmSounds),
          cls.P_CRITICALSOUND.copy(rangeOrList=cls.listAlarmSounds),
          cls.P_DEFAULTCOMMAND.copy(rangeOrList=cls.listCommands),
          cls.P_DEFAULTPARAM]
      if hasGpio:
        rt.append(cls.P_STOPALARMPIN)
      return rt
    if child == "Alarm":
      return {
        'name': '',
        'command': '',
        'category':'',
        'autoclean':'false',
        'sound':'',
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

  @classmethod
  def canEdit(cls):
    return True

  def _gpioCmd(self,channel):
    self.stopAll()
  def run(self):
    self.commandHandler=self.findHandlerByName(AVNCommandHandler.getConfigName())
    if self.commandHandler is None:
      self.setInfo('main',"no command handler found",WorkerStatus.ERROR)
      return
    self.setInfo('main',"running",WorkerStatus.NMEA)
    gpioPin=self.P_STOPALARMPIN.fromDict(self.param)
    if gpioPin is not None and gpioPin != 0:
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
      current=self.getRunningAlarms()
      for k,alarm in current.items():
        if alarm.commandId is not None:
          if not self.commandHandler.isCommandRunning(alarm.commandId):
            if alarm.config.autoclean:
              deletes.append(alarm)
      with self.__runningAlarmsLock:
        for alarm in deletes:
          active=self.runningAlarms.get(alarm.config.name)
          #check again as someone else could have stopped and started again...
          if active is not None and active.commandId == alarm.commandId:
            try:
              del self.runningAlarms[active.config.name]
            except:
              pass
            self.setInfo(alarm.config.name, "alarm inactive",
                     WorkerStatus.INACTIVE)


  def getRunningAlarms(self):
    with self.__runningAlarmsLock:
      return self.runningAlarms.copy()

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

  def expandAlarmConfig(self,config:AlarmConfig):
    if config is None:
      return None
    if config.name is None:
      return None
    ALL_CAT=[AlarmConfig.C_INFO,AlarmConfig.C_CRITICAL]
    if config.category not in ALL_CAT:
      config.category=None
    if config.parameter == '':
      config.parameter=None
    if config.parameter is not None:
      config.parameter=AVNUtil.replaceParam(config.parameter, AVNHandlerManager.filterBaseParam(self.getParam()))
    if config.command is None or config.command == '':
      config.command=self.P_DEFAULTCOMMAND.fromDict(self.param,rangeOrListCheck=False)
    if config.sound is None or config.sound == '':
      if config.category in ALL_CAT:
        config.sound=self.P_INFOSOUND.fromDict(self.param,rangeOrListCheck=False) if config.category==AlarmConfig.C_INFO \
          else self.P_CRITICALSOUND.fromDict(self.param,rangeOrListCheck=False)
      else:
        config.sound=config.parameter
    if config.parameter is None and config.sound is not None:
      config.parameter=config.sound
    return config

  def findAlarm(self,name,defaultCategory=None):
    definedAlarms=self.param.get('Alarm')
    if definedAlarms is not None:
      for cmd in definedAlarms:
        if cmd.get('name') is not None and cmd.get('name') == name:
          return self.expandAlarmConfig(AlarmConfig.fromDict(cmd))
    return self.expandAlarmConfig(AlarmConfig(category=defaultCategory,name=name))

  def _startAlarmCmd(self,alarmdef:AlarmConfig):
    if alarmdef.command is None:
      return False
    return self.commandHandler.startCommand(
      alarmdef.command,
      alarmdef.repeat,
      alarmdef.parameter)
  def callHandlers(self,alarm: RunningAlarm,on:bool=True,caller=None):
    handlers=[]
    with self.__handlerLock:
      handlers=self.handlers.copy()
    for h in handlers:
      if h == caller:
        continue
      try:
        h.handleAlarm(alarm.config.name,on,alarm.info)
      except Exception as e:
        AVNLog.debug("alarm handler error: %s",str(e))

  def startAlarm(self,name,defaultCategory=None,caller=None,info=None):
    """start a named alarm"""
    cmd=self.findAlarm(name,defaultCategory)
    if cmd is None:
      AVNLog.error("no alarm \"%s\" configured", name)
      self.setInfo(name, "no alarm \"%s\" configured"%name, WorkerStatus.ERROR)
      return False
    running=RunningAlarm(cmd,info=info)
    with self.__runningAlarmsLock:
      if self.runningAlarms.get(name) is not None:
        return True
      #just block the alarm to prevent multiple starts
      self.runningAlarms[name]=running
    alarmid=self._startAlarmCmd(cmd)
    if alarmid is not None:
      info=cmd.command+(cmd.parameter or '')
      self.setInfo(name, "activated %s" % info, WorkerStatus.NMEA)
    else:
      self.setInfo(name, "unable to start alarm command \"%s\":\"%s\" " % (name,cmd.command), WorkerStatus.INACTIVE)
    with self.__runningAlarmsLock:
      running.commandId=alarmid
    self.callHandlers(running,True,caller)
    self.navdata.updateChangeCounter(self.CHANGE_KEY)
    return True

  def stopAll(self,caller=None):
    '''stop all alarms'''
    AVNLog.info("stopAllAlarms")
    alist=self.getRunningAlarms()
    if list is None:
      return
    for name in list(alist.keys()):
      self.stopAlarm(name,caller)
  def stopAlarm(self, name,caller=None):
    running=None
    with self.__runningAlarmsLock:
      running=self.runningAlarms.get(name)
      try:
        del self.runningAlarms[name]
      except:
        pass
    if running is not None:
      self.callHandlers(running,False,caller)
      self.navdata.updateChangeCounter(self.CHANGE_KEY)
      if running.commandId is not None:
        self.commandHandler.stopCommand(running.commandId)
    self.setInfo(name, "stopped", WorkerStatus.INACTIVE)
    return True

  def isAlarmActive(self,name):
    '''return True if the named alarm is running'''
    with self.__runningAlarmsLock:
      al=self.runningAlarms.get(name)
      if al is None:
        return False
      return True

  def getAllAlarms(self):
    rt={}
    running=self.getRunningAlarms()
    for k,v in running.items():
      rt[k]=v
    commands=self.param.get('Alarm')
    if commands is not None:
      for cmd in commands:
        config=self.expandAlarmConfig(AlarmConfig.fromDict(cmd))
        if config is not None and not config.name in rt:
          rt[config.name]=RunningAlarm(config,running=False)
    return rt

  def getStatusProperties(self):
    all=self.getAllAlarms()
    rt={}
    for k,v in all.items():
      rt[k]=v.config.command
    return rt

  def registerHandler(self,handler):
    with self.__handlerLock:
      for h in self.handlers:
        if h == handler:
          return False
      self.handlers.append(handler)
      return True

  def deregisterHandler(self,handler):
    with self.__handlerLock:
      newHandlers=[]
      for h in self.handlers:
        if h != handler:
          newHandlers.append(h)
      self.handlers=newHandlers

  def getSoundFile(self,name):
    if name is None:
      return None
    dirs=self.getSoundDirs()
    name=AVNUtil.clean_filename(name)
    for d in dirs:
      fn=os.path.join(d,name)
      if os.path.exists(fn):
        return fn


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
      name = AVNUtil.getHttpRequestParam(requestparam, "name",mantadory=True)
      AVNLog.debug("download alarm %s",name)
      running=None
      alarmInfo=None
      with self.__runningAlarmsLock:
        running=self.runningAlarms.get(name)
      if running:
        alarmInfo=running.config
      if alarmInfo is None:
        alarmInfo = self.findAlarm(name)
      if alarmInfo is None:
        AVNLog.error("no alarm %s defined",name)
        return None
      file=self.getSoundFile(alarmInfo.sound)
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
      all=self.getAllAlarms()
      if all is None:
        return rt
      for name,item in all.items():
        if not name in status and not 'all' in status :
          continue
        rt[name]={'alarm':item.config.name,
                  'running':item.running,
                  'repeat': item.config.repeat
                  }
      return {"status":"OK","data":rt}
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
      category=AVNUtil.getHttpRequestParam(requestparam,'defaultCategory')
      if not self.startAlarm(command,defaultCategory=category):
        rt['status']='error'
      return rt
    if not self.stopAlarm(command):
      rt['status'] = 'error'
    return rt


avnav_handlerList.registerHandler(AVNAlarmHandler)



