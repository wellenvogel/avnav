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

from avnav_store import *
hasAisDecoder=False
try:
  import ais
  hasAisDecoder=True
except:
  pass
__author__="Andreas"
__date__ ="$29.06.2014 21:28:01$"

class EmptyPosition(Exception):
  pass

#an NMEA parser
#parses some simple NMEA setences and uses ais from the gpsd project to parse AIS setences
#adds parsed data to a navdata struct
class Key(object):
  def __init__(self,key,description,unit=None,signalK=None,signalKConversion=None):
    self.key=key
    self.description=description
    self.unit=unit
    self.signalK=signalK
    self.signalKConversion=signalKConversion
  def getKey(self):
    return AVNStore.BASE_KEY_GPS+"."+self.key

class NMEAParser(object):
  DEFAULT_SOURCE_PRIORITY=50
  DEFAULT_API_PRIORITY=60
  SKY_BASE_KEYS = ['gdop', 'tdop', 'vdop', 'hdop', 'pdop']
  SKY_SATELLITE_KEYS = ['ss', 'el', 'PRN', 'az', 'used']
  NM=AVNUtil.NM
  #a translation table to strip unwanted chars from NMEA0183 input
  STRIPCHARS={i:None for i in range(0,32)}
  #AIS field translations
  aisFieldTranslations={'msgtype':'type'}
  K_HDGC=Key('headingCompass','compass heading','\N{DEGREE SIGN}','navigation.headingCompass',signalKConversion=AVNUtil.rad2deg)
  K_HDGM=Key('headingMag','magnetic heading','\N{DEGREE SIGN}','navigation.headingMagnetic',signalKConversion=AVNUtil.rad2deg)
  K_HDGT=Key('headingTrue','true heading','\N{DEGREE SIGN}','navigation.headingTrue',signalKConversion=AVNUtil.rad2deg)
  K_VWTT=Key('waterTemp','water temparature','k',signalK='environment.water.temperature')
  K_VHWS=Key('waterSpeed','speed through water','m/s','navigation.speedThroughWater')
  K_TWS=Key('trueWindSpeed','wind speed true (speed through water ref or ground ref)','m/s','environment.wind.speedTrue')
  K_AWS=Key('windSpeed','apparent wind speed in m/s','m/s','environment.wind.speedApparent')
  K_TWA=Key('trueWindAngle','true wind angle','\N{DEGREE SIGN}','environment.wind.angleTrueWater',signalKConversion=AVNUtil.rad2deg)
  K_TWD=Key('trueWindDirection','true wind direction','\N{DEGREE SIGN}')
  K_AWA=Key('windAngle','wind direction','\N{DEGREE SIGN}','environment.wind.angleApparent',signalKConversion=AVNUtil.rad2deg)
  K_MDEV=Key('magDeviation', 'magnetic Deviation in deg','\N{DEGREE SIGN}', signalK='navigation.magneticDeviation', signalKConversion=AVNUtil.rad2deg)
  K_MVAR=Key('magVariation', 'magnetic Variation in deg','\N{DEGREE SIGN}', signalK='navigation.magneticVariation', signalKConversion=AVNUtil.rad2deg)
  K_LAT=Key('lat','gps latitude',signalK='navigation.position.latitude')
  K_LON=Key('lon','gps longitude',signalK='navigation.position.longitude')
  K_COG=Key('track','course','\N{DEGREE SIGN}','navigation.courseOverGroundTrue',signalKConversion=AVNUtil.rad2deg)
  K_SOG=Key('speed','speed in m/s','m/s','navigation.speedOverGround')
  K_SET=Key('currentSet','current set','\N{DEGREE SIGN}','environment.current.setTrue',signalKConversion=AVNUtil.rad2deg)
  K_DFT=Key('currentDrift','current drift in m/s','m/s','environment.current.drift')
  K_DEPTHT=Key('depthBelowTransducer','depthBelowTransducer in m','m','environment.depth.belowTransducer')
  K_DEPTHW=Key('depthBelowWaterline','depthBelowWaterlinein m','m','environment.depth.belowSurface')
  K_DEPTHK=Key('depthBelowKeel','depthBelowKeel in m','m','environment.depth.belowKeel')
  K_TIME=Key('time','the received GPS time',signalK='navigation.datetime')
  #we will add the GPS base to all entries
  GPS_DATA=[
    K_LAT,
    K_LON,
    K_COG,
    K_SOG,
    K_MDEV,
    K_MVAR,
    K_TWA,
    K_AWA,
    K_AWS,
    K_TWS,
    K_TWD,
    K_DEPTHT,
    K_DEPTHW,
    K_DEPTHK,
    K_TIME,
    Key('satInview', 'number of Sats in view',signalK='navigation.gnss.satellitesInView.count'),
    Key('satUsed', 'number of Sats in use',signalK='navigation.gnss.satellites'),
    Key('transducers.*','transducer data from xdr'),
    K_HDGC,
    K_HDGM,
    K_HDGT,
    K_VWTT,
    K_VHWS,
    K_SET,
    K_DFT
  ]

  @classmethod
  def registerKeys(cls,navdata):
    for key in cls.GPS_DATA:
      navdata.registerKey(key.getKey(),key.__dict__,cls.__name__)
    #TODO: add description for sat keys
    for key in cls.SKY_BASE_KEYS:
      navdata.registerKey(AVNStore.BASE_KEY_SKY + "."+key, {'description': 'sat base info'}, cls.__name__)
    #we use the PRN as additional key behind
    for satkey in cls.SKY_SATELLITE_KEYS:
      navdata.registerKey(AVNStore.BASE_KEY_SKY+".satellites.*."+satkey,{'description':'sat status entry'},cls.__name__)
  
  def __init__(self,navdata):
    self.payloads = {'A':'', 'B':''}    #AIS paylod data
    self.navdata=navdata # type: AVNStore
  @classmethod
  def formatTime(cls,ts):
    t = ts.isoformat()
    # seems that isoformat does not well harmonize with OpenLayers.Date
    # they expect at leas a timezone info
    # as we are at GMT we should have a "Z" at the end
    if not t[-1:] == "Z":
      t += "Z"
    return t
  #------------------ some nmea data specific methods -------------------


  def addToNavData(self,data,record=None,source='internal',priority=0,timestamp=None):
    '''
    add a data dictionary toe the internal store
    :param data: 
    :param record: 
    :param source: 
    :param priority: 
    :param timestamp: steady time point
    :return: 
    '''
    self.navdata.setValue(AVNStore.BASE_KEY_GPS,data,source=source,priority=priority,record=record,timestamp=timestamp)

  #returns an datetime object containing the current gps time
  @classmethod
  def gpsTimeToTime(cls,gpstime,gpsdate=None):
    #we take day/month/year from our system and add everything else from the GPS
    gpsts=datetime.time(int(gpstime[0:2] or '0'),int(gpstime[2:4] or '0'),int(gpstime[4:6] or '0'),1000*int(gpstime[7:10] or '0'))
    AVNLog.ld("gpstime/gpsts",gpstime,gpsts)
    if gpsdate is None:
      curdt=datetime.datetime.utcnow()
      gpsdt=datetime.datetime.combine(curdt.date(),gpsts)
      AVNLog.ld("curts/gpsdt before corr",curdt,gpsdt)
      #now correct the time if we are just changing from one day to another
      #this assumes that our system time is not more then one day off...(???)
      if (curdt - gpsdt) > datetime.timedelta(hours=12) and curdt.time().hour < 12:
        #we are in the evening and the gps is already in the morning... (and we accidently put it to the past morning)
        #so we have to hurry up to the next day...
        gpsdt=datetime.datetime.combine(curdt+datetime.timedelta(1),gpsts)
      if (gpsdt - curdt) > datetime.timedelta(hours=12) and curdt.time().hour> 12:
        #now we are faster - the gps is still in the evening of the past day - but we assume it at the coming evening
        gpsdt=datetime.datetime.combine(curdt-datetime.timedelta(1),gpsts)
      AVNLog.ld("curts/gpsdt after corr",curdt,gpsdt)
    else:
      #gpsdate is in the form ddmmyy
      #within GPSdate we do not have the century, so make some best guess:
      #if the 2 digits are below 80, assume that we are in 2000++, otherwise in 1900++
      if len(gpsdate) != 6 and len(gpsdate) != 8:
        raise Exception("invalid gpsdate %s"%(gpsdate))
      if len(gpsdate) == 8:
        #ZDA
        completeyear=int(gpsdate[4:8])
      else:
        year=gpsdate[4:6]
        completeyear=0
        if int(year) < 80:
          completeyear=2000+int(year)
        else:
          completeyear=1900+int(year)
      date=datetime.date(completeyear,int(gpsdate[2:4]),int(gpsdate[0:2]))
      gpsdt=datetime.datetime.combine(date,gpsts)
      AVNLog.ld("gpsts computed",gpsdt)
    return gpsdt
  
  #parse the nmea psoition fields:
  #gggmm.dec,N  - 1-3 characters grad, mm 2 didgits minutes
  #direction N,S,E,W - S,W being negative
  @classmethod
  def nmeaPosToFloat(cls,pos,direction):
    if pos == '' or direction == '':
      raise EmptyPosition("empty position")
    posa=pos.split('.')
    if len(posa) < 2:
      AVNLog.ld("no decimal in pos",pos)
      posa.append("0")
    grd=posa[0][-10:-2]
    min=posa[0][-2:]
    min=min+"."+posa[1]
    rt=float(grd)+float(min)/60
    if rt > 0 and (direction == 'S' or direction == 'W'):
      rt=-rt
    AVNLog.ld("pos",pos,rt)
    return rt

  @classmethod
  def nmeaFloatToPos(cls,pos,isLat):
    '''return a tuple (string,direction) from a position'''
    dir='N' if isLat else 'E'
    if pos < 0:
      dir = 'S' if isLat else 'W'
      pos=-pos
    deg = int(pos)
    min = 60*pos - 60 * deg
    if isLat:
      rt="%02d%05.2f"%(deg,min)
    else:
      rt = "%03d%05.2f" % (deg, min)
    AVNLog.debug("nmeaFloatToPos for %f (isLat=%s) returns %s,%s",pos,isLat,rt,dir)
    return(rt,dir)
  @classmethod
  #check if the line matches a provided filter
  #filter entries starting with ^are considered as blacklist
  def checkFilter(cls,line,filter):
    okMatch = False
    inversMatch = False
    #only consider the check to fail if nothing matches but we had at least one positive condition
    hasPositiveCondition = False
    try:
      if filter is None:
        return True
      for f in filter:
        invers=False
        if f[0:1]=="^":
          invers=True
          f=f[1:]
        else:
          hasPositiveCondition=True
        if f[0:1]=='$':
          if line[0:1]!='$':
            continue
          if len(f) < 2:
            if not invers:
              okMatch=True
            else:
              inversMatch=True
            continue
          if f[1:4]==line[3:6]:
            if not invers:
              okMatch=True
            else:
              inversMatch=True
            continue
          continue
        if line.startswith(f):
          if not invers:
            okMatch=True
          else:
            inversMatch=True
          continue
    except:
      pass
    if inversMatch:
      return False
    if okMatch:
      return True
    return not hasPositiveCondition

  #compute the NMEA checksum
  @classmethod
  def nmeaChecksum(cls,part):
    chksum = 0
    if part[0] == "$" or part[0] == "!":
      part = part[1:]
    for s in part:
      chksum ^= ord(s)
    #return ("%X"%chksum).zfill(2)
    return ("%02X"%chksum)

  #parse a line of NMEA data and store it in the navdata array      
  def parseData(self,data,source='internal',sourcePriority=DEFAULT_SOURCE_PRIORITY,timestamp=None):
    basePriority=sourcePriority*10
    valAndSum=data.rstrip().split("*")
    if len(valAndSum) > 1:
      sum=self.nmeaChecksum(valAndSum[0])
      if sum != valAndSum[1].upper():
        AVNLog.error("invalid checksum in %s, expected %s"%(data,sum))
        return
    darray=valAndSum[0].split(",")
    if len(darray) < 1 or (darray[0][0:1] != "$" and darray[0][0:1] != '!') :
      AVNLog.debug("invalid nmea data (len<1) "+data+" - ignore")
      return False
    if darray[0][0] == '!':
      if not hasAisDecoder:
        AVNLog.debug("cannot parse AIS data (no ais.py found)  %s",data)
        return False
      AVNLog.debug("parse AIS data %s",data)
      return self.ais_packet_scanner(data,source=source,sourcePriority=sourcePriority,timestamp=timestamp)
      
    tag=darray[0][3:]
    rt={}
    #currently we only take the time from RMC
    #as only with this one we have really a valid complete timestamp
    try:
      if tag=='GGA':
        mode=int(darray[6] or '0') #quality
        if mode >= 1:
          rt[self.K_LAT.key]=self.nmeaPosToFloat(darray[2],darray[3])
          rt[self.K_LON.key]=self.nmeaPosToFloat(darray[4],darray[5])
        rt['satUsed']=int(darray[7] or '0')
        self.addToNavData(rt,source=source,record=tag,timestamp=timestamp)
        return True
      if tag=='GSV':
        rt['satInview']=int(darray[3] or '0')
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      if tag=='GLL':
        mode=1
        if len(darray) > 6:
          mode= (0 if (darray[6] != 'A') else 2)
        if mode >= 1:
          rt[self.K_LAT.key]=self.nmeaPosToFloat(darray[1],darray[2])
          rt[self.K_LON.key]=self.nmeaPosToFloat(darray[3],darray[4])
          self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      if tag=='VTG':
        mode=darray[2]
        rt[self.K_COG.key]=float(darray[1] or '0')
        if (mode == 'T'):
          #new mode
          rt[self.K_SOG.key]=float(darray[5] or '0')*self.NM/3600
        else:
          rt[self.K_SOG.key]=float(darray[3]or '0')*self.NM/3600
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      if tag=='RMC':
        #$--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,xxxx,x.x,a*hh
        #this includes current date
        mode=( 0 if darray[2] != 'A' else 2)
        if mode >= 1:
          rt[self.K_LAT.key]=self.nmeaPosToFloat(darray[3],darray[4])
          rt[self.K_LON.key]=self.nmeaPosToFloat(darray[5],darray[6])
          if darray[7] != '':
            rt[self.K_SOG.key]=float(darray[7] or '0')*self.NM/3600
          if darray[8] != '':
            rt[self.K_COG.key]=float(darray[8] or '0')
        gpstime = darray[1]
        gpsdate = darray[9]
        if darray[10] != '':
          if darray[11] == 'E':
            rt[self.K_MVAR.key] = float(darray[10] or '0')
          elif darray[11] == 'W':
            rt[self.K_MVAR.key] = -float(darray[10] or '0')
        if gpsdate != "" and gpstime != "":
          rt['time']=self.formatTime(self.gpsTimeToTime(gpstime, gpsdate))
        self.addToNavData(rt,source=source,priority=basePriority+1,record=tag,timestamp=timestamp)
        return True
      if tag == 'ZDA':
        if darray[1] == '' or darray[2] == '' or darray[3] == '' or darray[4] == '':
          return False
        gpstime=darray[1]
        #ensure each 2 digits for day and month
        gpsdate=('0' + darray[2])[-2:] +('0' + darray[3])[-2:]+('0000'+darray[4])[-4:]
        rt['time']=self.formatTime(self.gpsTimeToTime(gpstime,gpsdate))
        self.addToNavData(rt,source=source,priority=basePriority,record=tag,timestamp=timestamp)
        return True
      if tag == 'VWR':
        '''
        VWR - Relative Wind Speed and Angle
         1  2  3  4  5  6  7  8 9
         |  |  |  |  |  |  |  | |
        $--VWR,x.x,a,x.x,N,x.x,M,x.x,K*hh<CR><LF>
      Field Number:
      1 Wind direction magnitude in degrees
      2 Wind direction Left/Right of bow
      3 Speed(Knots)
      4 N = Knots
      5 Speed (m/s)
      6 M = Meters Per Second
      7 Speed (km/h)
      8 K = Kilometers Per Hour
        Checksum
        '''
        windAngle=float(darray[1] or '0')
        dir=darray[2]
        rt[self.K_AWA.key]= 360-windAngle if ( dir == 'L' or dir == 'l') else windAngle
        priority=0
        #we keep the speed im m/s
        windspeed=None
        if darray[3] != '':
          windspeed=float(darray[3] or '0')
          windspeed=windspeed*self.NM/3600
        elif darray[5] != '':
          windspeed=float(darray[5] or '0')
          windspeed=windspeed/3.6
        elif darray[7] != '':
          windspeed=float(darray[7] or '0')
        if windspeed is not None:
          rt[self.K_AWS.key]=windspeed
        self.addToNavData(rt,source=source,record=tag,priority=basePriority+priority,timestamp=timestamp)
        return True
      if tag == 'MWV':
        '''
        $--MWV,x.x,a,x.x,a*hh<CR><LF>
        Field Number:
        1) Wind Angle, 0 to 360 degrees
        2) Reference, R = Relative, T = True
        3) Wind Speed
        4) Wind Speed Units, K/M/N
        5) Status, A = Data Valid
        6) Checksum
        '''
        ref=darray[2]
        angleKey=self.K_TWA if ref == 'T' else self.K_AWA
        speedKey=self.K_TWS if ref == 'T' else self.K_AWS
        rt[angleKey.key]=float(darray[1])
        #we keep the speed im m/s
        windspeed=float(darray[3] or '0')
        if (darray[4] == 'K'):
          windspeed=windspeed/3.6
        if (darray[4] == 'N'):
          windspeed=windspeed*self.NM/3600
        rt[speedKey.key]=windspeed
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      if tag == 'MWD':
        hasData=False
        '''
        $WIMWD,10.1,T,10.1,M,12,N,40,M*5D
        https://github.com/adrianmo/go-nmea/blob/master/mwd.go
        '''
        if darray[1] != '':
          rt[self.K_TWD.key]=float(darray[1])
          hasData=True
        else:
          if darray[3] != '':
            rt[self.K_TWD.key] = float(darray[3])
            hasData=True
        if ( darray[8] == 'M' or darray[8] == 'm') and darray[7] != '':
          rt[self.K_TWS.key]=float(darray[7])
          hasData=True
        else:
          if (darray[6] == 'N' or darray[6] == 'n') and darray[5] != '':
            rt[self.K_TWS.key] = float(darray[5]) * self.NM/3600.0
            hasData=True
        if hasData:
          self.addToNavData(rt, source=source, record=tag, priority=basePriority,timestamp=timestamp)
        return True
      if tag == 'DPT':
        '''
               DPT - Depth of water
               1   2   3
               |   |   |
        $--DPT,x.x,x.x*hh<CR><LF>
        Field Number:
        1) Depth, meters
        2) Offset from transducer,
            positive means distance from tansducer to water line
            negative means distance from transducer to keel
        3) Checksum
        '''
        rt[self.K_DEPTHT.key] = float(darray[1] or '0')
        if len(darray[2]) > 0:
          if float(darray[2]) >= 0:
            rt[self.K_DEPTHW.key] = float(darray[1] or '0') + float(darray[2] or '0')
          else:
            rt[self.K_DEPTHK.key] = float(darray[1] or '0') + float(darray[2] or '0')
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      if tag == 'DBT':
        '''
                DBT - Depth below transducer
                1   2 3   4 5   6 7
                |   | |   | |   | |
        $--DBT,x.x,f,x.x,M,x.x,F*hh<CR><LF>
        Field Number:
         1) Depth, feet
         2) f = feet
         3) Depth, meters
         4) M = meters
         5) Depth, Fathoms
         6) F = Fathoms
         7) Checksum
        '''
        if len(darray[3]) > 0:
          rt[self.K_DEPTHT.key] = float(darray[3] or '0')
          self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
          return True
        return False

      #HDG - Heading - Deviation & Variation
      #
      #        1   2   3 4   5 6
      #        |   |   | |   | |
      # $--HDG,x.x,x.x,a,x.x,a*hh<CR><LF>

      #Field Number:
      # 1) Magnetic Sensor heading in degrees
      #  2) Magnetic Deviation, degrees
      #  3) Magnetic Deviation direction, E = Easterly, W = Westerly
      #  4) Magnetic Variation degrees
      #  5) Magnetic Variation direction, E = Easterly, W = Westerly
      #  6) Checksum

      if tag == 'HDG':
        MagDevDir=None
        heading_c=None
        MagDeviation=0
        MagVarDir=None
        MagVariation=None
        if(len(darray[1]) > 0):
          heading_c = float(darray[1] or '0')
          rt[self.K_HDGC.key] = heading_c
        if(len(darray[2]) > 0):
          MagDeviation = float(darray[2] or '0')  # --> Ablenkung
          if(len(darray[3]) > 0):
            MagDevDir = darray[3] or 'X'
        if(len(darray[4]) > 0):
          MagVariation = float(darray[4] or '0')  # --> Missweisung
          if(len(darray[5]) > 0):
            MagVarDir = darray[5] or 'X'
        # Deviation
        heading_m = heading_c
        if MagDevDir == 'E':
          heading_m += MagDeviation
          rt[self.K_MDEV.key] = MagDeviation
        elif MagDevDir == 'W':
          heading_m -= MagDeviation
          rt[self.K_MDEV.key] = -MagDeviation
        rt[self.K_HDGM.key] = heading_m

        # True course
        heading_t = None
        if MagVarDir is not None and MagVariation is not None:
          if MagVarDir == 'E':
            heading_t = heading_m + MagVariation
            rt[self.K_MVAR.key] = MagVariation
          elif MagVarDir == 'W':
            heading_t = heading_m - MagVariation
            rt[self.K_MVAR.key] = -MagVariation
        if heading_t is not None:
          rt[self.K_HDGT.key] = heading_t
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True

      if tag == 'HDM' or tag == 'HDT':
        heading=None
        if len(darray[1]) > 0:
          heading = float(darray[1] or '0')
        magortrue = darray[2]
        if heading is not None:
          if magortrue == 'T':
            rt[self.K_HDGT.key]=heading
          else:
            rt[self.K_HDGM.key]=heading
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True



      if tag == 'VDR':
        """ set and drift https://gpsd.gitlab.io/gpsd/NMEA.html#_vdr_set_and_drift
                   1   2 3   4 5   6 7
                   |   | |   | |   | |
            $--VDR,x.x,T,x.x,M,x.x,N*hh<CR><LF>
            1 set degrees true
            3 set degrees magnetic
            5 drift knots
            """
        if len(darray[1])>0 and darray[2]=="T":
          rt[self.K_SET.key] = float(darray[1])
        if len(darray[5])>0 and darray[6]=="N":
          rt[self.K_DFT.key] = float(darray[5])
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True
      
      #VHW - Water speed and heading

      #        1   2 3   4 5   6 7   8 9
      #        |   | |   | |   | |   | |
      # $--VHW,x.x,T,x.x,M,x.x,N,x.x,K*hh<CR><LF>

      # Field Number:
      #  1) Degress True
      #  2) T = True
      #  3) Degrees Magnetic
      #  4) M = Magnetic
      #  5) Knots (speed of vessel relative to the water)
      #  6) N = Knots
      #  7) Kilometers (speed of vessel relative to the water)
      #  8) K = Kilometers
      #  9) Checksum


      if tag == 'VHW':
        if len(darray[1]) > 0:  # Heading True
          rt[self.K_HDGT.key] = float(darray[1] or '0')
        if(len(darray[3]) > 0):
          rt[self.K_HDGM.key] = float(darray[3] or '0')  # Heading magnetic
        if len(darray[5]) > 0:
          rt[self.K_VHWS.key]= float(darray[5] or '0')*self.NM/3600
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True

      if tag == 'MTW':
        # $--MTW,x.x,C*hh<CR><LF>
        if len(darray[1]) > 0:
          rt[self.K_VWTT.key] = float(darray[1])+273.15
        self.addToNavData(rt,source=source,record=tag,priority=basePriority,timestamp=timestamp)
        return True

      if tag == 'XDR':
        # $--XDR,a,x.x,a,c--c, ..... *hh<CR><LF>
        lf = len(darray)
        i = 1
        hasData=False
        while i < (lf -3):
          try:
            # we need 4 fields
            if darray[i + 1] is not None and darray[i] != "":
              ttype = darray[i]
              tdata = float(darray[i + 1] or '0')
              tunit = darray[i + 2]
              tname = darray[i + 3]
              data=self.convertXdrValue(tdata,tunit)
              if tname is not None and tname != "":
                rt["transducers."+tname]=data
                hasData=True
          except Exception as e:
            AVNLog.debug("decode %s at pos %d failed: %s"%(data,i,str(e)))
            pass
          i+=4
        if hasData:
          self.addToNavData(rt, source=source, record=tag,priority=basePriority,timestamp=timestamp)
          return True
        return False
    except EmptyPosition:
      AVNLog.ld("empty position in %s",str(data))
      return False
    except Exception as e:
      AVNLog.info(" error parsing nmea data " + str(data) + "\n" + traceback.format_exc())

  @classmethod
  def convertXdrValue(self, value, unit):
    '''

    :param value:
    :param type:
    :return:
    '''
    #see e.g. https://gpsd.gitlab.io/gpsd/NMEA.html#_xdr_transducer_measurement
    if value is None:
      return value
    if unit == "C":
      value+=273.15
    if unit == "B":
      value=value*100*1000
    return value

  #parse one line of AIS data 
  #taken from ais.py and adapted to our input handling     
  def ais_packet_scanner(self,line,source='internal',sourcePriority=DEFAULT_SOURCE_PRIORITY,timestamp=None):
    basePriority=sourcePriority*10
    "Get a span of AIVDM packets with contiguous fragment numbers."
    if not line.startswith("!"):
      AVNLog.debug("ignore unknown AIS data %s",line)
      return False
    line = line.strip()
    # Strip off USCG metadata 
    line = re.sub(r"(?<=\*[0-9A-F][0-9A-F]),.*", "", line)
    # Compute CRC-16 checksum
    packet = line[1:-3]  # Strip leading !, trailing * and CRC
    csum = 0
    for c in packet:
        csum ^= ord(c)
    csum = "%02X" % csum
    # Ignore comments
    # Assemble fragments from single- and multi-line payloads
    fields = line.split(",")
    try:
        expect = fields[1]
        fragment = fields[2]
        channel = fields[4]
        if fragment == '1':
          cpl=self.payloads.get(channel)
          if cpl is not None and cpl != '':
            AVNLog.debug('channel %s still open with %s',channel,self.payloads[channel])
          self.payloads[channel] = ''
        self.payloads[channel] += fields[5]
        try:
            # This works because a mangled pad literal means
            # a malformed packet that will be caught by the CRC check. 
            pad = int(fields[6].split('*')[0])
        except ValueError:
            pad = 0
        crc = fields[6].split('*')[1].strip()
    except IndexError as e:
        AVNLog.debug("malformed line: %s: %sn",line.strip(),traceback.format_exc())
        return False
    if csum != crc:
        AVNLog.debug("bad checksum %s, expecting %s: %s\n",crc, csum, line.strip())
        return False
    if fragment < expect:
        AVNLog.debug("waiting for more fragments on channel %s: %s",channel,line.strip())
        return True
    else:
      if fragment > '1':
        AVNLog.debug("fragments now complete on channel %s with number %s: %s", channel, fragment,line.strip())
    # Render assembled payload to packed bytes
    bits = ais.BitVector()
    bits.from_sixbit(self.payloads[channel], pad)
    rt=self.parse_ais_messages(self.payloads[channel], bits,source=source,priority=basePriority,timestamp=timestamp)
    self.payloads[channel]=''
    return rt


  #basically taken from ais.py but changed to decode one message at a time
  def parse_ais_messages(self,raw,bits,source='internal',priority=0,timestamp=None):
      "Generator code - read forever from source stream, parsing AIS messages."
      values = {}
      values['length'] = bits.bitlen
      # Without the following magic, we'd have a subtle problem near
      # certain variable-length messages: DSV reports would
      # sometimes have fewer fields than expected, because the
      # unpacker would never generate cooked tuples for the omitted
      # part of the message.  Presently a known issue for types 15
      # and 16 only.  (Would never affect variable-length messages in
      # which the last field type is 'string' or 'raw').
      bits.extend_to(168)
      # Magic recursive unpacking operation
      try:
          cooked = ais.aivdm_unpack(0, bits, 0, values, ais.aivdm_decode)
          # Apply the postprocessor stage
          cooked = ais.postprocess(cooked)
          expected = ais.lengths.get(values['msgtype'], None)
          # Check length; has to be done after so we have the type field 
          bogon = False
          if expected is not None:
              if type(expected) == type(0):
                  expected_range = (expected, expected)
              else:
                  expected_range = expected
              actual = values['length']
              if not (actual >= expected_range[0] and actual <= expected_range[1]):
                  raise Exception("invalid length %d(%d..%d)"%(actual,expected_range[0],expected_range[1]))
          # We're done, hand back a decoding
          #AVNLog.ld('decoded AIS data',cooked)
          self.storeAISdata(cooked,source=source,priority=priority,timestamp=timestamp)
          return True
      except:
          AVNLog.debug("exception %s while decoding AIS data %s",traceback.format_exc())
          return False
  
  def storeAISdata(self,bitfield,source='internal',priority=0,timestamp=None):
    rt={'class':'AIS'}
    storeData=False
    for bfe in bitfield:
      try:
        name=bfe[0].name
        tname=self.aisFieldTranslations.get(name)
        if tname is not None:
          name=tname
        val=str(bfe[1])
        rt[name]=val
      except:
        AVNLog.debug("exception in getting AIS message: %s",traceback.format_exc())
    mmsi=rt.get('mmsi')
    if mmsi is None:
      AVNLog.debug("ignoring AIS data without mmsi, %s"%rt)
      return
    self.navdata.setAisValue(mmsi,AVNUtil.convertAIS(rt),source=source,priority=priority,timestamp=timestamp)
    
