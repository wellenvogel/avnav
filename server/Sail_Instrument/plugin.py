#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import math
import time
from datetime import datetime
import os
from datetime import date
import xml.etree.ElementTree as ET
import urllib.request, urllib.parse, urllib.error
import json
import sys
from _ast import Try
import traceback
import time
from builtins import len
try:
    from avnrouter import AVNRouter, WpData
    from avnav_worker import AVNWorker, WorkerParameter, WorkerStatus
except:
    pass
MIN_AVNAV_VERSION="20220426"

    #// https://www.rainerstumpe.de/HTML/wind02.html
    #// https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721

    #//http://www.movable-type.co.uk/scripts/latlong.html
    #//The longitude can be normalised to −180…+180 using (lon+540)%360-180

#            a=b<0?c;
            #self.minTWD[0] = actTWD if actTWD<self.minTWD[0] else self.minTWD[0]





class Plugin(object):
  PATHTWDF="gps.TWDF"   #    TrueWindDirection PT1 gefiltert
  PATHAWDF="gps.AWDF"   #    ApparentWindDirection PT1 gefiltert
  PATHTLL_SB="gps.LLSB" #    Winkel Layline Steuerbord
  PATHTLL_BB="gps.LLBB" #    Winkel Layline Backbord
  PATHTLL_VPOL="gps.VPOL" #  Geschwindigkeit aus Polardiagramm basierend auf TWS und TWA 
  PATHTLL_OPTVMC="gps.OPTVMC" #  Geschwindigkeit aus Polardiagramm basierend auf TWS und TWA
  PATHmaxTWD="gps.maxTWD" 
  PATHminTWD="gps.minTWD" 
#  PATHTLL_speed="gps.speed" #  Geschwindigkeit aus Polardiagramm basierend auf TWS und TWA 


  CONFIG = [
      {
      'name':'TWD_filtFreq',
      'description':'Limit Frequency for PT1-Filter of TWD',
      'default':'0.2',
      'type': 'FLOAT'
      },
            {
      'name':'LL_Minutes',
      'description':'Minutes considered for Layline-Areas [0..60] (0=>No Laylineareas)',
      'default':'1',
      'type': 'NUMBER'
      },
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
      'description': 'a test plugins',
      'version': '1.0',
      'config': cls.CONFIG,
      
      'data': [
        {
          'path': cls.PATHminTWD,
          'description': 'minimum TrueWindDirection last xx Minutes',
        },
        {
          'path': cls.PATHmaxTWD,
          'description': 'maximum TrueWindDirection last xx Minutes',
        },
        {
          'path': cls.PATHTWDF,
          'description': 'TrueWindDirection PT1 filtered',
        },
        {
          'path': cls.PATHAWDF,
          'description': 'ApparentWindDirection PT1 filtered',
        },
        {
          'path': cls.PATHTLL_OPTVMC,
          'description': 'optimum vmc direction',
        },
        {
          'path': cls.PATHTLL_SB,
          'description': 'Layline Steuerbord',
        },
        {
          'path': cls.PATHTLL_BB,
          'description': 'Layline Backbord',
        },
        {
          'path': cls.PATHTLL_VPOL,
          'description': 'Speed aus Polare',
        },
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
    if(self.api.getAvNavVersion() < int(MIN_AVNAV_VERSION)):
        raise Exception("SegelDisplay-Plugin is not available for this AvNav-Version")
        return 

    self.api.registerEditableParameters(self.CONFIG, self.changeParam)
    self.api.registerRestart(self.stop)

    vers=self.api.getAvNavVersion()
    #we register an handler for API requests
    self.api.registerRequestHandler(self.handleApiRequest)
    self.count=0
    self.TrueWindDirection_filtered={'x':0,'y':0, 'alpha':0}
    self.ApparentWindDirection_filtered={'x':0,'y':0, 'alpha':0}
    self.awdf=0
    self.twdf=0
    self.api.registerRestart(self.stop)
    self.oldtime=0
    self.polare={}
    if not self.Polare('polare.xml'):
       raise Exception("polare.xml not found Error")
       return
    self.saveAllConfig()
    self.startSequence = 0

# Normalizes any number to an arbitrary range 
# by assuming the range wraps around when going below min or above max 
  def normalize(self, value, start, end ): 
        width       = end - start      
        offsetValue = value - start    # value relative to 0      
        return ( offsetValue - ( math.floor( offsetValue / width ) * width ) ) + start ;
        #// + start to reset back to start of original range

  def getConfigValue(self, name):
    defaults = self.pluginInfo()['config']
    for cf in defaults:
      if cf['name'] == name:
        return self.api.getConfigValue(name, cf.get('default'))
    return self.api.getConfigValue(name)
  
  def saveAllConfig(self):
    d = {}
    defaults = self.pluginInfo()['config']
    for cf in defaults:
      v = self.getConfigValue(cf.get('name'))
      d.update({cf.get('name'):v})
    self.api.saveConfigValues(d)
    return 
  
  def changeConfig(self, newValues):
    self.api.saveConfigValues(newValues)
  
  def changeParam(self,param):
    self.api.saveConfigValues(param)
    self.startSequence+=1  
  
  def stop(self):
    pass

  def PT_1funk(self, f_grenz, t_abtast, oldvalue, newvalue):
    """
        PT1 filter
        @param f_grenz, t_abtast, oldvalue, newvalue
        @return:
    """
    #const t_abtast= globalStore.getData(keys.properties.positionQueryTimeout)/1000 //[ms->s]
    T = 1 / (2*math.pi*f_grenz)
    tau = 1 / ((T / t_abtast) + 1)
    return(oldvalue + tau * (newvalue - oldvalue))

  minTWD=[]
  maxTWD=[]
  lastMinute = -1
  def run(self):
    """
    the run method
    @return:
    """
    def calc_minmaxTWD(self, actTWD, act_minute, max_minutes): # using lists instead of collections because length is <= 60
        if(act_minute != self.lastMinute):   # list shiften
            self.minTWD.insert(0,actTWD) #// New Element on pos 0
            self.maxTWD.insert(0,actTWD)               
        elif len(self.minTWD)>0:
            self.minTWD[0] = actTWD if actTWD<self.minTWD[0] else self.minTWD[0]
            self.maxTWD[0] = actTWD if actTWD>self.maxTWD[0] else self.maxTWD[0]
    
        while(len(self.minTWD)>max_minutes):
            self.minTWD.pop();   #limit array-length to maxmaxminutes if necessary
            self.maxTWD.pop();   #limit array-length to maxmaxminutes if necessary
        # print(minTWD)
        self.lastMinute=act_minute
        print("delta:",max(self.maxTWD)-min(self.minTWD))
        if(max(self.maxTWD)-min(self.minTWD)>180):
            print(self.minTWD)
            print(self.maxTWD)
        if len(self.minTWD)>0:  # if max_minutes>0 return min/max TWD  
            return([min(self.minTWD),max(self.maxTWD)])
        else:
            return([actTWD,actTWD]) # if max_minutes==0 return actTWD



    seq=0
    self.api.log("started")
    self.api.setStatus('STARTED', 'running')
    gpsdata={}
    while not self.api.shouldStopMainThread():
      time.sleep(0.5)  
      #gpsdata=self.api.getDataByPrefix('gps')
      gpsdata['track']=self.api.getSingleValue('gps.track')
      gpsdata['windAngle']=self.api.getSingleValue('gps.windAngle')
      gpsdata['windSpeed']=self.api.getSingleValue('gps.windSpeed')
      gpsdata['speed']=self.api.getSingleValue('gps.speed')

      calcTrueWind(self, gpsdata)       
      if 'AWS' in gpsdata and 'AWD' in gpsdata and 'TWA' in gpsdata and 'TWS' in gpsdata:
            best_vmc_angle(self,gpsdata)
            if(calcFilteredWind(self, gpsdata)):
                minmaxTWD=calc_minmaxTWD(self, gpsdata['TWDF'], datetime.now().minute, float(self.getConfigValue('LL_Minutes')))
                #print(datetime.now().minute,"min ",minmaxTWD)
                gpsdata['minTWD']=minmaxTWD[0]
                gpsdata['maxTWD']=minmaxTWD[1]
                self.api.addData(self.PATHTWDF,gpsdata['TWDF'])
                self.api.addData(self.PATHAWDF,gpsdata['AWDF'])
                self.api.addData(self.PATHminTWD,gpsdata['minTWD'])
                self.api.addData(self.PATHmaxTWD,gpsdata['maxTWD'])
                
                if calc_Laylines(self,gpsdata):  
                    self.api.setStatus('NMEA', 'computing Laylines/VPOL')
                
      else:
          self.api.setStatus('ERROR', 'Missing Input of windAngle and/or windSpeed, cannot compute Laylines')


  
  
 #https://stackoverflow.com/questions/4983258/python-how-to-check-list-monotonicity
  def strictly_increasing(self, L):
        return all(x<y for x, y in zip(L, L[1:]))
  

  def Polare(self, f_name):
    #polare_filename = os.path.join(os.path.dirname(__file__), f_name)
    polare_filename = os.path.join(self.api.getDataDir(),'user','viewer','polare.xml')
    try:
        tree = ET.parse(polare_filename)
    except:
            try:
                source=os.path.join(os.path.dirname(__file__), f_name)
                dest=os.path.join(self.api.getDataDir(),'user','viewer','polare.xml')
                with open(source, 'rb') as src, open(dest, 'wb') as dst: dst.write(src.read())
                tree = ET.parse(polare_filename)
            except:
                return False
    finally:
            if not 'tree' in locals():
                return False
            root = tree.getroot()
            x=ET.tostring(root, encoding='utf8').decode('utf8')
            e_str='windspeedvector'
            x=root.find('windspeedvector').text
        # whitespaces entfernen
            x="".join(x.split())
            self.polare['windspeedvector']=list(map(float,x.strip('][').split(',')))
            if not self.strictly_increasing(self.polare['windspeedvector']):
                raise Exception("windspeedvector in polare.xml IS NOT STRICTLY INCREASING!")
                return(False)

            e_str='windanglevector'
            x=root.find('windanglevector').text
        # whitespaces entfernen
            x="".join(x.split())
            self.polare['windanglevector']=list(map(float,x.strip('][').split(',')))
            if not self.strictly_increasing(self.polare['windanglevector']):
                raise Exception("windanglevector in polare.xml IS NOT STRICTLY INCREASING!")
                return(False)
            
            e_str='boatspeed'
            x=root.find('boatspeed').text
        # whitespaces entfernen
            z="".join(x.split())
        
            z=z.split('],[')
            boatspeed=[]
            for elem in z:
                zz=elem.strip('][').split(',')
                boatspeed.append(list(map(float,zz)))
            self.polare['boatspeed']=boatspeed
    
    
            e_str='wendewinkel'
            x=root.find('wendewinkel')
        
            e_str='upwind'
            y=x.find('upwind').text
        # whitespaces entfernen
            y="".join(y.split())
            self.polare['ww_upwind']=list(map(float,y.strip('][').split(',')))
    
            e_str='downwind'
            y=x.find('downwind').text
        # whitespaces entfernen
            y="".join(y.split())
            self.polare['ww_downwind']=list(map(float,y.strip('][').split(',')))
    return(True)

    
#https://appdividend.com/2019/11/12/how-to-convert-python-string-to-list-example/#:~:text=To%20convert%20string%20to%20list,delimiter%E2%80%9D%20as%20the%20delimiter%20string.        

  def handleApiRequest(self,url,handler,args):
    """
    handler for API requests send from the JS
    @param url: the url after the plugin base
    @param handler: the HTTP request handler
                    https://docs.python.org/2/library/basehttpserver.html#BaseHTTPServer.BaseHTTPRequestHandler
    @param args: dictionary of query arguments
    @return:
    """
    out=urllib.parse.parse_qs(url)
    out2=urllib.parse.urlparse(url)
    if url == 'test':
      return {'status':'OK'}
    if url == 'parameter':
      #self.count=0
      defaults = self.pluginInfo()['config']
      b={}
      for cf in defaults:
          v = self.getConfigValue(cf.get('name'))
          b.setdefault(cf.get('name'), v)
      b.setdefault('server_version', self.api.getAvNavVersion())
      return(b)
    return {'status','unknown request'}


def bilinear(self,xv, yv, zv, x, y) :
    #ws = xv
 try:
    angle =yv
    speed =zv
    #var x2i = ws.findIndex(this.checkfunc, x)
    x2i = list(filter(lambda lx: xv[lx] >= x, range(len(xv))))
    if(len(x2i) > 0):
        x2i = 1 if x2i[0] < 1 else x2i[0]
        x2 = xv[x2i]
        x1i = x2i - 1
        x1 = xv[x1i]
    else:
        x1=x2=xv[len(xv)-1]
        x1i=x2i=len(xv)-1

    #var y2i = angle.findIndex(this.checkfunc, y)
    y2i = list(filter(lambda lx: angle[lx] >= y, range(len(angle))))
    if(len(y2i) > 0):
        y2i = 1 if y2i[0] < 1 else y2i[0]
        #y2i = y2i < 1 ? 1 : y2i
        y2 = angle[y2i]
        y1i = y2i - 1
        y1 = angle[y2i - 1]
    else:
        y1=y2=angle[len(angle)-1]
        y1i=y2i=len(angle)-1

    ret =   \
             ((y2 - y) / (y2 - y1)) *   \
        (((x2 - x) / (x2 - x1)) * speed[y1i][x1i]  +    \
            ((x - x1) / (x2 - x1)) * speed[y1i][x2i])  +    \
        ((y - y1) / (y2 - y1)) *    \
        (((x2 - x) / (x2 - x1)) * speed[y2i][x1i]  +    \
            ((x - x1) / (x2 - x1)) * speed[y2i][x2i]) 
    return ret
 except:
        self.api.error(" error calculating bilinear interpolation for TWS with "+str(x)+"kn  at "+str(y)+"°\n")
        return(0)

  
def linear(x, x_vector, y_vector):

    #var x2i = x_vector.findIndex(this.checkfunc, x)
    #https://www.geeksforgeeks.org/python-ways-to-find-indices-of-value-in-list/
    # using filter()
    # to find indices for 3
    try:
        x2i = list(filter(lambda lx: x_vector[lx] >= x, range(len(x_vector))))
    # y_vector = BoatData.Polare.wendewinkel.upwind;
    #x2i = x2i < 1 ? 1 : x2i
        if(len(x2i) > 0):
           x2i = 1 if x2i[0] < 1 else x2i[0]
           x2 = x_vector[x2i]
           y2 = y_vector[x2i]
           x1i = x2i - 1
           x1 = x_vector[x1i]
           y1 = y_vector[x1i]
           y = ((x2 - x) / (x2 - x1)) * y1 + ((x - x1) / (x2 - x1)) * y2
        else:
            y=y_vector[len(y_vector)-1]
    except:
        self.api.error(" error calculating linear interpolation "+ "\n")
        return 0
    return y

def calc_Laylines(self,gpsdata):# // [grad]
    
    
    if (self.Polare and 'TWA' in gpsdata):
        # LAYLINES
        if (math.fabs(gpsdata['TWA']) > 120 and math.fabs(gpsdata['TWA']) < 240): 
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_downwind']) * 2
        else:
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_upwind']) * 2

        #LL_SB = (gpsdata['TWD'] + wendewinkel / 2) % 360
        #LL_BB = (gpsdata['TWD'] - wendewinkel / 2) % 360

        LL_SB = (gpsdata['TWDF'] + wendewinkel / 2) % 360
        LL_BB = (gpsdata['TWDF'] - wendewinkel / 2) % 360
        
        
        self.api.addData(self.PATHTLL_SB,LL_SB)
        self.api.addData(self.PATHTLL_BB,LL_BB)


        gpsdata['TWA']=gpsdata['TWA']%360
        anglew = math.fabs(self.normalize(gpsdata['TWA'], -180, 180 ))  
        #360 - gpsdata['TWA'] if gpsdata['TWA'] > 180 else gpsdata['TWA']
        #in kn
        if not self.polare['boatspeed']:
            return False
        SOGPOLvar = bilinear(self,  \
            self.polare['windspeedvector'],    \
            self.polare['windanglevector'],    \
            self.polare['boatspeed'],  \
            (gpsdata['TWS'] / 0.514), \
            anglew  \
        )
        self.api.addData(self.PATHTLL_VPOL,SOGPOLvar*0.514444)
        #self.api.ALLOW_KEY_OVERWRITE=True
        #allowKeyOverwrite=True
        #self.api.addData(self.PATHTLL_speed,SOGPOLvar*0.514444)
        return True
        
        # http://forums.sailinganarchy.com/index.php?/topic/132129-calculating-vmc-vs-vmg/
#VMG = BS * COS(RADIANS(TWA))
#VMC = BS * COS(RADIANS(BRG-HDG))
      
        #rueckgabewert = urllib.request.urlopen('http://localhost:8081/viewer/avnav_navi.php?request=route&command=getleg')
        #route=rueckgabewert.read()
        #inhalt_text = route.decode("UTF-8")
        #d = json.loads(inhalt_text)
        #VMCvar = ((gpsdata['speed'] * 1.94384) * math.cos((xx-gpsdata['track']) * math.pi) / 180)
    #print(d)

    
    
def calcFilteredWind(self, gpsdata):
    rt=gpsdata
    #self.twdf=self.awdf=0
    if not 'track' in gpsdata or not 'AWD' in gpsdata:
        return False
    if gpsdata['windAngle'] is None or gpsdata['windSpeed'] is None or gpsdata['speed'] is None or gpsdata['track'] is None :
        self.api.setStatus('ERROR', 'Missing Input of windAngle and/or windSpeed, cannot compute Laylines')
        return False

    try:
        fgrenz=float(self.getConfigValue('TWD_filtFreq'))
        t_abtast=(time.time()-self.oldtime)
        freq=1/t_abtast
        self.oldtime=time.time()
        gpsdata['AWD']=self.normalize(gpsdata['AWD'],0,360)
        gpsdata['TWD']=self.normalize(gpsdata['TWD'],0,360)
        gpsdata['track']=self.normalize(gpsdata['track'],0,360)
        #if not 'speedf' in gpsdata:
        #    gpsdata['speedf']=0
        #gpsdata['speedf']=self.PT_1funk(fgrenz, t_abtast, gpsdata['speedf'],gpsdata['speed'])

        KaW=polar(gpsdata['AWS'], gpsdata['AWD']).toKartesisch()
        # KaB = polar(gpsdata['speed'], gpsdata['track']).toKartesisch()
        KaB = polar(gpsdata['speed'], (gpsdata['track'] or 0)).toKartesisch()

      

        self.twdf=self.PT_1funk(fgrenz, t_abtast, self.twdf+360,gpsdata['TWD']+360)-360 
        self.awdf=self.PT_1funk(fgrenz, t_abtast, self.awdf+360,gpsdata['AWD']+360)-360 
        
        
        self.TrueWindDirection_filtered['x']=self.PT_1funk(fgrenz, t_abtast, self.TrueWindDirection_filtered['x'], KaW['x'] - KaB['x'])
        self.TrueWindDirection_filtered['y']=self.PT_1funk(fgrenz, t_abtast, self.TrueWindDirection_filtered['y'], KaW['y'] - KaB['y'])

        self.ApparentWindDirection_filtered['x']=self.PT_1funk(fgrenz, t_abtast, self.ApparentWindDirection_filtered['x'], KaW['x'])
        self.ApparentWindDirection_filtered['y']=self.PT_1funk(fgrenz, t_abtast, self.ApparentWindDirection_filtered['y'], KaW['y'])
      
      # zurück in Polaren Winkel
        self.TrueWindDirection_filtered['alpha']=kartesisch(self.TrueWindDirection_filtered['x'],self.TrueWindDirection_filtered['y']).toPolar()
        self.ApparentWindDirection_filtered['alpha']=kartesisch(self.ApparentWindDirection_filtered['x'],self.ApparentWindDirection_filtered['y']).toPolar()
        self.TrueWindDirection_filtered['alpha']=self.normalize(self.TrueWindDirection_filtered['alpha'],0,360)
        self.ApparentWindDirection_filtered['alpha']=self.normalize(self.ApparentWindDirection_filtered['alpha'],0,360)
        
        
        gpsdata['AWDF']=self.ApparentWindDirection_filtered['alpha']
        gpsdata['TWDF']=self.TrueWindDirection_filtered['alpha']
        return True
    except Exception as err:
        self.api.error(" error in calcFilteredWind ")
        return False
    
def calcTrueWind(self, gpsdata):
    # https://www.rainerstumpe.de/HTML/wind02.html
    # https://www.segeln-forum.de/board1-rund-ums-segeln/board4-seemannschaft/46849-frage-zu-windberechnung/#post1263721      
        source='SegelDisplay'

        if not 'track' in gpsdata or not 'windAngle' or not 'speed' in gpsdata:
            return False
        if gpsdata['windAngle'] is None or gpsdata['windSpeed'] is None or gpsdata['speed'] is None or gpsdata['track'] is None :
            self.api.setStatus('ERROR', 'Missing Input of windAngle and/or windSpeed, cannot compute Laylines')
            return False

        gpsdata['AWA']=gpsdata['windAngle']
        gpsdata['AWS']=gpsdata['windSpeed']
        try:
            gpsdata['AWD'] = (gpsdata['AWA'] + (gpsdata['track'] or 0)) % 360
            KaW=polar(gpsdata['AWS'], gpsdata['AWD']).toKartesisch()
            KaB = polar(gpsdata['speed'], (gpsdata['track'] or 0)).toKartesisch()
            if(gpsdata['speed'] == 0 or gpsdata['AWS'] == 0):
                gpsdata['TWD'] = gpsdata['AWD'] 
            else:
                gpsdata['TWD'] = kartesisch(KaW['x'] - KaB['x'], KaW['y'] - KaB['y']).toPolar() % 360
            gpsdata['TWS'] = math.sqrt((KaW['x'] - KaB['x']) * (KaW['x'] - KaB['x']) + (KaW['y'] - KaB['y']) * (KaW['y'] - KaB['y']))
            gpsdata['TWA'] = self.normalize((gpsdata['TWD'] - gpsdata['track'])or 0, -180, 180 )  
            return True
        except Exception as err:
            self.api.error(" error calculating TrueWind-Data " + str(gpsdata) + "\n")
        return False
    

class polar(object):
    def __init__(self,r, alpha):  # [alpha in deg] 
        self.r=r
        self.alpha=alpha
    def toKartesisch(self):
        K = {}
        K['x'] = self.r*math.cos((self.alpha * math.pi) / 180)
        K['y'] = self.r*math.sin((self.alpha * math.pi) / 180)
        return(K)    
        
class kartesisch(object):
    def __init__(self,x, y):  # [alpha in deg] 
        self.x=x
        self.y=y
    def toPolar(self):
        return(180 * math.atan2(self.y, self.x) / math.pi)
        K = {}
        K['x'] = self.r*math.cos((self.alpha * math.pi) / 180)
        K['y'] = self.r*math.sin((self.alpha * math.pi) / 180)
        return(K)    







try:
  import numpy as np
  from scipy.interpolate import InterpolatedUnivariateSpline

  def quadratic_spline_roots(self,spl):
    roots = []
    knots = spl.get_knots()
    for a, b in zip(knots[:-1], knots[1:]):
        u, v, w = spl(a), spl((a+b)/2), spl(b)
        t = np.roots([u+w-2*v, w-u, 2*v])
        t = t[np.isreal(t) & (np.abs(t) <= 1)]
        roots.extend(t*(b-a)/2 + (b+a)/2)
    return np.array(roots)

       

    
  def best_vmc_angle(self, gps):
    try:
      router=AVNWorker.findHandlerByName(AVNRouter.getConfigName())
      if router is None:
        return False
      wpData=router.getWpData()
      if wpData is None:
        return False
      if not wpData.validData and self.ownWpOffSent:
        return True
    except:
        return False

    try:
        self.cWendewinkel_upwind=[]
        self.cWendewinkel_downwind=[]
    
        lastindex=len(self.polare['windanglevector'])
    
        x = np.array(self.polare['boatspeed'])
        BRG=wpData.dstBearing
        windanglerad=np.deg2rad(BRG-gps['TWD']+np.array(self.polare['windanglevector']))
        coswindanglerad=np.cos(windanglerad)
    
        self.cWendewinkel_upwind=[]
        vmc=[]
        for i in range(len(self.polare['windspeedvector'])):
            updownindexvalue=next(z for z in self.polare['windanglevector'] if z >=90)
            updownindex=self.polare['windanglevector'].index(updownindexvalue, 0, lastindex)
            spalte=i
            # vmc=v*cos(BRG-HDG)
            # HDG = TWD +/- TWA
            # test: BRG = , TWD=0 --> HDG=-TWA --> vmc=v*cos(BRG+TWA)
            vmc.append(np.array(x[0:lastindex,spalte])*coswindanglerad[0:lastindex])
            f=InterpolatedUnivariateSpline(self.polare['windanglevector'], vmc[spalte][:], k=3)
            cr_pts = quadratic_spline_roots(self, f.derivative())
            cr_vals = f(cr_pts)
            min_index = np.argmin(cr_vals)
            max_index = np.argmax(cr_vals)
        #print("Maximum value {} at {}\nMinimum value {} at {}".format(cr_vals[max_index], cr_pts[max_index], cr_vals[min_index], cr_pts[min_index]))
            self.cWendewinkel_upwind.append(cr_pts[max_index])
        #Der TWA mit der höschsten VMC
        spl=InterpolatedUnivariateSpline(self.polare['windspeedvector'], self.cWendewinkel_upwind, k=3)
        wendewinkel = linear((gps['TWS'] / 0.514),self.polare['windspeedvector'],self.cWendewinkel_upwind)
        opttwa=spl(gps['TWS'] / 0.514)
        opthdg=(gps['TWD']-opttwa)%360
        diff1=abs((gps['TWD']-wendewinkel)%360-(gps['TWD']-opttwa)%360)
        # aus WA=WD-HDG folgt HDG = WD-WA
        #self.api.addData(self.PATHTLL_OPTVMC, (gps['TWD']-wendewinkel)%360,source='SegelDisplay')
        self.api.addData(self.PATHTLL_OPTVMC, (opthdg)%360,source='SegelDisplay')
    except:
        pass

    return(True)



except:
  def best_vmc_angle(self,gps):
      return False;
  pass    
    
