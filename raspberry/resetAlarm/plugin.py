# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.de
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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
#
###############################################################################
import time

from avnav_api import AVNApi
GPIO=None
try:
  import RPi.GPIO as GPIO
except:
  pass

class Plugin(object):
  P_PIN={
    'name':'gpio',
    'type':'NUMBER',
    'default':None,
    'description': 'the gpio to be used to reset alarm (board numbering)'
  }
  P_LOW={
    'name':'lowActive',
    'type':'BOOLEAN',
    'default': True,
    'description': 'if true the input will be active low, else high'
  }
  P_PUD={
    'name':'pullUpDown',
    'type':'BOOLEAN',
    'default':True,
    'description':'activate a pull up/down resistor at the pin'
  }
  P_ALL=[P_PIN,P_LOW,P_PUD]
  @classmethod
  def pluginInfo(cls):
    """
    the description for the module
    @return: a dict with the content described below
            parts:
               * description (mandatory)
               * data: list of keys to be stored (optional)
                 * path - the key - see AVNApi.addData, all pathes starting with "gps." will be sent to the GUI
                 * description
    """
    return {
      'description': 'clear all alarms via gpio pin',
      'data': [
      ]
    }

  def __init__(self,api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    self.api = api # type: AVNApi
    self.api.registerRestart(self.stop)
    self.api.registerEditableParameters(self.P_ALL,self.changeData)
    self.api.registerRestart(self.stop)
    self.changeSequence=0

  def changeData(self,changed):
    self.api.saveConfigValues(changed)
    self.changeSequence+=1
  def stop(self):
    self.changeSequence+=1
  def getConfig(self,param):
    rt=self.api.getConfigValue(param['name'],param['default'])
    if param['type'].lower()=='boolean':
      if rt is None:
        return False
      if isinstance(rt,bool):
        return rt
      if isinstance(rt,int):
        return rt != 0
      return rt.lower() == 'true'
    if param['type'].lower()=='number':
      if rt is None:
        return None
      return int(rt)
    return rt
  def _runImpl(self):
    seq=self.changeSequence
    pin=self.getConfig(self.P_PIN)
    actLow=self.getConfig(self.P_LOW)
    pud=self.getConfig(self.P_PUD)
    if pin is None or int(pin) == 0:
      self.api.setStatus('DISABLED','no gpio pin configured')
      time.sleep(0.5)
      return
    try:
      pin=int(pin)
      GPIO.setmode(GPIO.BOARD)
      pull=GPIO.PUD_OFF
      pudstr="off"
      if pud:
        pull=GPIO.PUD_UP if actLow else GPIO.PUD_DOWN
        pudstr="pull up" if actLow else "pull down"
      GPIO.setup(pin,GPIO.IN,pull_up_down=pull)
      edge=GPIO.FALLING if actLow else GPIO.RISING
      GPIO.add_event_detect(pin,edge,callback=self._gpioCmd,bouncetime=100)
      self.api.setStatus('NMEA','activated pin %s (act=%s,pud=%s) for alarm reset'%(str(pin),"low" if actLow else "high",pudstr))
    except Exception as e:
      try:
        GPIO.cleanup(pin)
      except:
        pass
      self.api.setStatus('ERROR',"unable to set up the pin %d: %s"%(pin,str(e)))
      time.sleep(1)
      return
    while (seq == self.changeSequence):
      time.sleep(0.5)
    try:
      GPIO.cleanup(pin)
    except:
      pass

  def _gpioCmd(self,dummy):
    self.api.clearAlarms()


  def run(self):
    while not self.api.shouldStopMainThread():
      if GPIO is None:
        self.api.setStatus('ERROR','missing packages')
        time.sleep(1)
        continue
      self._runImpl()