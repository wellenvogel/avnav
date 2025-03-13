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
    self.api.registerEditableParameters([self.P_PIN],self.changeData)
    self.changeSequence=0

  def changeData(self,changed):
    self.api.saveConfigValues(changed)
    self.changeSequence+=1
  def stop(self):
    pass

  def _runImpl(self):
    seq=self.changeSequence
    pin=self.api.getConfigValue(self.P_PIN['name'],None)
    if pin is None or int(pin) == 0:
      self.api.setStatus('DISABLED','no gpio pin configured')
      time.sleep(0.5)
      return
    try:
      pin=int(pin)
      GPIO.setmode(GPIO.BOARD)
      GPIO.setup(pin,GPIO.IN,pull_up_down=GPIO.PUD_UP)
      GPIO.add_event_detect(pin,GPIO.FALLING,callback=self._gpioCmd,bouncetime=100)
      self.api.setStatus('NMEA','activated pin %s for alarm reset'%str(pin))
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