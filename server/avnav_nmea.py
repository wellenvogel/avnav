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
  def __init__(self,key,description,unit=None):
    self.key=key
    self.description=description
    self.unit=unit
  def getKey(self):
    return AVNStore.BASE_KEY_GPS+"."+self.key

class NMEAParser(object):
  SKY_BASE_KEYS = ['gdop', 'tdop', 'vdop', 'hdop', 'pdop']
  SKY_SATELLITE_KEYS = ['ss', 'el', 'PRN', 'az', 'used']
  NM=AVNUtil.NM
  #a translation table to strip unwanted chars from NMEA0183 input
  STRIPCHARS={i:None for i in range(0,32)}
  #AIS field translations
  aisFieldTranslations={'msgtype':'type'}
  K_HDGM=Key('headingMag','magnetic heading','\N{DEGREE SIGN}')
  K_HDGT=Key('headingTrue','true heading','\N{DEGREE SIGN}')
  K_VWTT=Key('waterTemp','water temparature','k')
  K_VHWS=Key('waterSpeed','speed through water','m/s')
  #we will add the GPS base to all entries
  GPS_DATA=[
    Key('lat','gps latitude'),
    Key('lon','gps longitude'),
    Key('mode','nmea mode 0/2'),
    Key('track','course','\N{DEGREE SIGN}'),
    Key('speed','speed in m/s','m/s'),
    Key('windAngle','wind direction','\N{DEGREE SIGN}'),
    Key('windReference','wind reference: R or T'),
    Key('windSpeed','wind speed in m/s','m/s'),
    Key('depthBelowTransducer','depthBelowTransducer in m','m'),
    Key('depthBelowWaterline','depthBelowWaterlinein m','m'),
    Key('depthBelowKeel','depthBelowKeel in m','m'),
    Key('source','source of GPS info'),
    Key('tag','the original NMEA record'),
    Key('time','the received GPS time'),
    Key('satInview', 'number of Sats in view'),
    Key('satUsed', 'number of Sats in use'),
    Key('transducers.*','transducer data from xdr'),
    K_HDGM,
    K_HDGT,
    K_VWTT,
    K_VHWS
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
  #add a valid dataset to nav data
  #timedate is a datetime object as returned by gpsTimeToTime
  #fill this additionally into the time part of data
  def addToNavData(self,data,record=None,source='internal',priority=0):
    if record is not None:
      self.navdata.setReceivedRecord(record,source)
    self.navdata.setValue(AVNStore.BASE_KEY_GPS,data,source=source,priority=priority)
    
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
      if len(gpsdate) != 6:
        raise Exception("invalid gpsdate %s"%(gpsdate))
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
  def parseData(self,data,source='internal'):
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
      return self.ais_packet_scanner(data,source=source)
      
    tag=darray[0][3:]
    rt={}
    #currently we only take the time from RMC
    #as only with this one we have really a valid complete timestamp
    try:
      if tag=='GGA':
        rt['lat']=self.nmeaPosToFloat(darray[2],darray[3])
        rt['lon']=self.nmeaPosToFloat(darray[4],darray[5])
        rt['mode']=int(darray[6] or '0') #quality
        rt['satUsed']=int(darray[7] or '0')
        self.addToNavData(rt,source=source,record=tag)
        return True
      if tag=='GSV':
        rt['satInview']=int(darray[3] or '0')
        self.addToNavData(rt,source=source,record=tag)
        return True
      if tag=='GLL':
        rt['mode']=1
        if len(darray) > 6:
          rt['mode']= (0 if (darray[6] != 'A') else 2)
        rt['lat']=self.nmeaPosToFloat(darray[1],darray[2])
        rt['lon']=self.nmeaPosToFloat(darray[3],darray[4])
        self.addToNavData(rt,source=source,record=tag)
        return True
      if tag=='VTG':
        mode=darray[2]
        rt['track']=float(darray[1] or '0')
        if (mode == 'T'):
          #new mode
          rt['speed']=float(darray[5] or '0')*self.NM/3600
        else:
          rt['speed']=float(darray[3]or '0')*self.NM/3600
        self.addToNavData(rt,source=source,record=tag)
        return True
      if tag=='RMC':
        #$--RMC,hhmmss.ss,A,llll.ll,a,yyyyy.yy,a,x.x,x.x,xxxx,x.x,a*hh
        #this includes current date
        rt['mode']=( 0 if darray[2] != 'A' else 2)
        rt['lat']=self.nmeaPosToFloat(darray[3],darray[4])
        rt['lon']=self.nmeaPosToFloat(darray[5],darray[6])
        rt['speed']=float(darray[7] or '0')*self.NM/3600
        rt['track']=float(darray[8] or '0')
        gpstime = darray[1]
        gpsdate = darray[9]
        if gpsdate != "" and gpstime != "":
          rt['time']=self.formatTime(self.gpsTimeToTime(gpstime, gpsdate))
        self.addToNavData(rt,source=source,priority=1,record=tag)
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
        rt['windAngle']= 360-windAngle if ( dir == 'L' or dir == 'l') else windAngle
        rt['windReference']='R'
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
          rt['windSpeed']=windspeed
        self.addToNavData(rt,source=source,record=tag,priority=priority)
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
        rt['windAngle']=float(darray[1])
        rt['windReference']=darray[2]
        priority=1
        if darray[2] != 'R':
          priority=0
        #we keep the speed im m/s
        windspeed=float(darray[3] or '0')
        if (darray[4] == 'K'):
          windspeed=windspeed/3.6
        if (darray[4] == 'N'):
          windspeed=windspeed*self.NM/3600
        rt['windSpeed']=windspeed
        self.addToNavData(rt,source=source,record=tag,priority=priority)
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
        rt['depthBelowTransducer'] = float(darray[1] or '0')
        if len(darray[2]) > 0:
          if float(darray[2]) >= 0:
            rt['depthBelowWaterline'] = float(darray[1] or '0') + float(darray[2] or '0')
          else:
            rt['depthBelowKeel'] = float(darray[1] or '0') + float(darray[2] or '0')
        self.addToNavData(rt,source=source,record=tag)
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
          rt['depthBelowTransducer'] = float(darray[3] or '0')
          self.addToNavData(rt,source=source,record=tag)
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
        heading=None
        MagDeviation=0
        MagVarDir=None
        MagVariation=None
        if(len(darray[1]) > 0):
          heading = float(darray[1] or '0')
        if(len(darray[2]) > 0):
          MagDeviation = float(darray[2] or '0')  # --> Ablenkung
          if(len(darray[3]) > 0):
            MagDevDir = darray[3] or 'X'
        if(len(darray[4]) > 0):
          MagVariation = float(darray[4] or '0')  # --> Missweisung
          if(len(darray[5]) > 0):
            MagVarDir = darray[5] or 'X'
        # Kompassablenkung korrigieren
        if MagDevDir == 'E':
           heading= heading + MagDeviation
        elif MagDevDir == 'W':
          heading = heading - MagDeviation
        rt[self.K_HDGM.key] = heading

        # Wahrer Kurs unter Berücksichtigung der Missweisung
        heading_t = None
        if MagVarDir is not None and MagVariation is not None:
          if MagVarDir == 'E':
            heading_t = heading + MagVariation
          elif MagVarDir == 'W':
            heading_t = heading - MagVariation
        if heading_t is not None:
          rt[self.K_HDGT.key]=heading_t
        self.addToNavData(rt,source=source,record=tag)
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
        self.addToNavData(rt,source=source,record=tag)
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
        self.addToNavData(rt,source=source,record=tag)
        return True

      if tag == 'MTW':
        # $--MTW,x.x,C*hh<CR><LF>
        if len(darray[1]) > 0:
          rt[self.K_VWTT.key] = float(darray[1])+273.15
        self.addToNavData(rt,source=source,record=tag)
        return True

      if tag == 'XDR':
        # $--XDR,a,x.x,a,c--c, ..... *hh<CR><LF>
        lf = len(darray)
        i = 1
        hasData=False
        while i < lf:
          if i < (lf - 3):
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
          self.addToNavData(rt, source=source, record=tag)
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
  def ais_packet_scanner(self,line,source='internal'):
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
    return self.parse_ais_messages(self.payloads[channel], bits,source=source)


  #basically taken from ais.py but changed to decode one message at a time
  def parse_ais_messages(self,raw,bits,source='internal'):
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
          # We now have a list of tuples containing unpacked fields
          # Collect some field groups into ISO8601 format
          for (offset, template, label, legend, formatter) in ais.field_groups:
              segment = cooked[offset:offset+len(template)]
              if [x[0] for x in segment] == template:
                  group = ais.formatter(*[x[1] for x in segment])
                  group = (label, group, 'string', legend, None)
                  cooked = cooked[:offset]+[group]+cooked[offset+len(template):]
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
          self.storeAISdata(cooked,source=source)
          return True
      except:
          (exc_type, exc_value, exc_traceback) = sys.exc_info()
          AVNLog.debug("exception %s while decoding AIS data %s",exc_value,raw.strip())
          return False
  
  def storeAISdata(self,bitfield,source='internal'):
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
    self.navdata.setAisValue(mmsi,rt,source=source)
    
