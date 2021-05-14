 # software includes geomag.py
# by Christopher Weiss cmweiss@gmail.com
# https://github.com/cmweiss/geomag

 
 
 

import math
import time
import os
from datetime import date
hasgeomag = False
import sys
try:
  # add current directory to sys.path to import library from there
  sys.path.insert(0, os.path.dirname(__file__)+'/lib')
  import geomag as geomag    
  hasgeomag = True
except:
  pass


class Config(object):

  def __init__(self, api):
    self.WMM_FILE = api.getConfigValue('WMM_FILE', 'WMM2020.COF')
    self.WMM_PERIOD = api.getConfigValue('WMM_PERIOD', '3600')


class Plugin(object):
  PATHAWD = "gps.AWD"
  PATHTWD = "gps.TWD"
  PATHTWS = "gps.TWS"
  PATHTWA = "gps.TWA"
  PATHHDG_M = "gps.HDGm"
  PATHHDG_T = "gps.HDGt"
  PATHSTW = "gps.STW"
  PATHGMM = "gps.MagVar"
  WMM_FILE = 'WMM2020.COF'
  #FILTER= ['$HDG','$HDM','$HDT','$VHW']
  FILTER= '$HDG,$HDM,$HDT,$VHW'
  CONFIG = [
      {
      'name':'WMM_FILE',
      'description':'File with WMM-coefficents for magnetic deviation',
      'default':'WMM2020.COF'
      },
      {
      'name':'WMM_PERIOD',
      'description':'Time in sec to recalculate magnetic deviation',
      'default':3600,
      'type': 'NUMBER'
      },
      {
        'name':'computePeriod',
        'description': 'Compute period (s) for wind data',
        'type': 'FLOAT',
        'default': 1.0
      },
      {
        'name':'NewNMEAPeriod',
        'description': 'period (s) for NMEA records',
        'type': 'FLOAT',
        'default': 1
      }
      ]

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
      'description': 'a plugin that calculates true wind data, magnetic deviation at the current position, speed through water and magnetic and true heading',
      'version': '1.0',
      'config': cls.CONFIG,
      'data': [
        {
          'path': cls.PATHAWD,
          'description': 'apparent Wind direction',
        },
        {
          'path': cls.PATHTWD,
          'description': 'true Wind direction',
        },
        {
          'path': cls.PATHTWS,
          'description': 'true Wind speed',
        },
        {
          'path': cls.PATHTWA,
          'description': 'true Wind angle',
        },
        {
          'path': cls.PATHHDG_M,
          'description': 'Heading Magnetic',
        },
        {
          'path': cls.PATHHDG_T,
          'description': 'Heading True',
        },
        {
          'path': cls.PATHSTW,
          'description': 'Speed through water',
        },
        {
          'path': cls.PATHGMM,
          'description': 'Magnetic Deviation',
        },
      ]
    }

  def __init__(self, api):
    """
        initialize a plugins
        do any checks here and throw an exception on error
        do not yet start any threads!
        @param api: the api to communicate with avnav
        @type  api: AVNApi
    """
    self.api = api
    self.api.registerEditableParameters(self.CONFIG, self.changeParam)
    self.api.registerRestart(self.stop)
    self.oldtime = 0
    self.variation_time = 0
    self.variation_val = 0
    self.MissweisungFromSensor = False

    self.userAppId = None
    self.startSequence=0
    self.receivedTags=[]
  def stop(self):
    pass
  
  def getConfigValue(self,name):
    defaults=self.pluginInfo()['config']
    for cf in defaults:
      if cf['name'] == name:
        return self.api.getConfigValue(name,cf.get('default'))
    return self.api.getConfigValue(name)
  
  def changeParam(self, param):
    self.api.saveConfigValues(param)
    self.startSequence += 1

  def run(self):
    """
    the run method
    @return:
    """
    lastnmea=0
    startSequence=None
    seq = 0
    self.api.log("started")
    self.api.setStatus('STARTED', 'running')
    gm=None
    computePeriod=0.5
    while not self.api.shouldStopMainThread():
      if startSequence != self.startSequence:
        try:
          computePeriod = float(self.getConfigValue('computePeriod'))
        except:
          pass
        startSequence = self.startSequence
        if hasgeomag:
          wmm_filename = os.path.join(os.path.dirname(__file__)+'/lib', self.getConfigValue('WMM_FILE'))
          gm = geomag.GeoMag(wmm_filename)
      lastTime = time.time()
      gpsdata = {}
      computesVar = False
      computesWind = False
      try:
        gpsdata = self.api.getDataByPrefix('gps')
        if 'lat' in gpsdata and 'lon' in gpsdata and gm is not None:
          computesVar = True
          now = time.time()
          if now - self.variation_time > int(self.getConfigValue('WMM_PERIOD')) or now < self.variation_time:
            variation = gm.GeoMag(gpsdata['lat'], gpsdata['lon'])
            self.variation_time = now
            self.variation_val = variation.dec
            self.api.addData(self.PATHGMM, self.variation_val)
          else:
            self.api.addData(self.PATHGMM, self.variation_val)
      except Exception:
        self.api.error(" error in calculation of magnetic Variation")

      if 'windSpeed' in gpsdata:
        if gpsdata['windReference'] == 'R':
            computesWind=True
            if (self.calcTrueWind(gpsdata)):
                self.api.addData(self.PATHAWD, gpsdata['AWD'])
                self.api.addData(self.PATHTWD, gpsdata['TWD'])
                self.api.addData(self.PATHTWS, gpsdata['TWS'])
                self.api.addData(self.PATHTWA, gpsdata['TWA'])
      if computesVar or computesWind:
        stText='computing '
        if computesVar:
          stText+='variation '
        if computesWind:
          stText+='wind'
        self.api.setStatus('NMEA',stText )
      else:
        self.api.setStatus('STARTED', 'running')
      runNext = False
      # fetch from queue till next compute period
      while not runNext:
        now = time.time()
        if now < lastTime:
          # timeShift back
          runNext = True
          continue
        if ((now - lastTime) < computePeriod):
          waitTime = computePeriod - (now - lastTime)
        else:
          waitTime = 0.01
          runNext = True
        seq, data = self.api.fetchFromQueue(seq,number=100, waitTime=waitTime, filter=self.FILTER)
        if len(data) > 0:
          for line in data:
            self.parseData(line)
      if((time.time()-lastnmea) > float(self.getConfigValue('NewNMEAPeriod'))):
          print(now,self.receivedTags)
          # schreibe MWD ODER MWV 0 f(TWA) 
          # schreibe VHW f(STW und oder Variation) 
          # schreibe HDT, HDM f(HDGt oder HDGm) 
          # schreibe HDG f(HDGt und HDGm und Variation) 
          self.api.addNMEA("$KSKDS,,,,,", True, True, 'GG')
          self.receivedTags=[]
          lastnmea=now

  def nmeaChecksum(cls, part):
    chksum = 0
    if part[0] == "$" or part[0] == "!":
      part = part[1:]
    for s in part:
      chksum ^= ord(s)
    return ("%02X" % chksum)

  def parseData(self, data, source='internal'):
    valAndSum = data.rstrip().split("*")
    if len(valAndSum) > 1:
      sum = self.nmeaChecksum(valAndSum[0])
      if sum != valAndSum[1].upper():
        self.api.error("invalid checksum in %s, expected %s" % (data, sum))
        return
    darray = valAndSum[0].split(",")
    if len(darray) < 1 or (darray[0][0:1] != "$" and darray[0][0:1] != '!'):
      self.api.error("invalid nmea data (len<1) " + data + " - ignore")
      return False
    tag = darray[0][3:]
    rt = {}
    # print(tag)
    try:
      if tag == 'HDG':
        self.receivedTags.append(tag)
        rt['MagDevDir'] = 'X'
        rt['MagVarDir'] = 'X'  
        rt['SensorHeading'] = float(darray[1] or '0') 
        if(len(darray[2]) > 0): 
            rt['MagDeviation'] = float(darray[2] or '0')  # --> Ablenkung
            rt['MagDevDir'] = darray[3] or 'X'
        if(len(darray[4]) > 0): 
            rt['MagVariation'] = float(darray[4] or '0')  # --> Missweisung
            rt['MagVarDir'] = darray[5] or 'X'
#        self.addToNavData(rt,source=source,record=tag)
        heading_m = rt['SensorHeading']
        # Kompassablenkung korrigieren
        if(rt['MagDevDir'] == 'E'):
            heading_m = heading_m + rt['MagDeviation']
        elif(rt['MagDevDir'] == 'W'): 
            heading_m = heading_m - rt['MagDeviation']
        self.api.addData(self.PATHHDG_M, heading_m)
        # Wahrer Kurs unter Berücksichtigung der Missweisung
        heading_t=None
        if(rt['MagVarDir'] == 'E'):
            heading_t = heading_m + rt['MagVariation']
            self.variation_val = rt['MagVariation']
        elif(rt['MagVarDir'] == 'W'): 
            heading_t = heading_m - rt['MagVariation']
            self.variation_val = -rt['MagVariation']
        if heading_t is not None:
          self.api.addData(self.PATHHDG_T, heading_t)
        return True

      if tag == 'HDM' or tag == 'HDT':
        self.receivedTags.append(tag)
        rt['Heading'] = float(darray[1] or '0')
        rt['magortrue'] = darray[2]
        if(rt['magortrue'] == 'T'):
          self.api.addData(self.PATHHDG_T, rt['Heading'])
        else:
          self.api.addData(self.PATHHDG_M, rt['Heading'])
          self.api.addData(self.PATHHDG_T, rt['Heading'] + self.variation_val)
        return True

      # print(tag)
      if tag == 'VHW':
        self.receivedTags.append(tag)
        if(len(darray[1]) > 0):  # Heading True
            rt['Heading'] = float(darray[1] or '0')
            self.api.addData(self.PATHHDG_T, rt['Heading'])
        if(len(darray[3]) > 0): 
            rt['Heading'] = float(darray[3] or '0')  # Heading magnetic
            self.api.addData(self.PATHHDG_M, rt['Heading'])
            if(len(darray[1]) == 0):
                self.api.addData(self.PATHHDG_T, rt['Heading'] + self.variation_val)
        if(len(darray[7]) > 0):  # Speed of vessel relative to the water, km/hr 
            rt['STW'] = float(darray[7] or '0')  # km/h
            rt['STW'] = rt['STW'] / 3.6  # m/s
            self.api.addData(self.PATHSTW, rt['STW'])
        elif(len(darray[5]) > 0):  # Speed of vessel relative to the water, knots
            rt['STW'] = float(darray[7] or '0')  # kn
            rt['STW'] = rt['STW'] * 0.514444  # m/s
            self.api.addData(self.PATHSTW, rt['STW'])
      return True
    
    except Exception:
      self.api.error(" error parsing nmea data " + str(data) + "\n")
    return False
  
  def calcTrueWind(self, gpsdata):
        rt = gpsdata
        if not 'track' in gpsdata or not 'windAngle' in gpsdata:
            return False
        try:
            gpsdata['AWD'] = (gpsdata['windAngle'] + gpsdata['track']) % 360
            KaW = self.toKartesisch(gpsdata['AWD'])
            KaW['x'] *= gpsdata['windSpeed']  # 'm/s'
            KaW['y'] *= gpsdata['windSpeed']  # 'm/s'
            KaB = self.toKartesisch(gpsdata['track'])
            KaB['x'] *= gpsdata['speed']  # 'm/s'
            KaB['y'] *= gpsdata['speed']  # 'm/s'

            if(gpsdata['speed'] == 0 or gpsdata['windSpeed'] == 0):
                gpsdata['TWD'] = gpsdata['AWD']
            else:
                gpsdata['TWD'] = (self.toPolWinkel(KaW['x'] - KaB['x'], KaW['y'] - KaB['y'])) % 360

            gpsdata['TWS'] = math.sqrt((KaW['x'] - KaB['x']) * (KaW['x'] - KaB['x']) + (KaW['y'] - KaB['y']) * (KaW['y'] - KaB['y']))
            gpsdata['TWA'] = (gpsdata['TWD'] - gpsdata['track']) % 360

            return True
        except Exception:
            self.api.error(" error calculating TrueWind-Data " + str(gpsdata) + "\n")
        return False

  def toPolWinkel(self, x, y):  # [grad]
        return(180 * math.atan2(y, x) / math.pi)

  def toKartesisch(self, alpha):  # // [grad]
        K = {}
        K['x'] = math.cos((alpha * math.pi) / 180)
        K['y'] = math.sin((alpha * math.pi) / 180)
        return(K)    
