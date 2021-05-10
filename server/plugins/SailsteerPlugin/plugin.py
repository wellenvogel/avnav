#the following import is optional
#it only allows "intelligent" IDEs (like PyCharm) to support you in using it
from avnav_api import AVNApi
import math
import time
import os
from datetime import date
import xml.etree.ElementTree as ET
#from xml.etree import cElementTree as ElementTree
#import xmltodict
#import numpy as np
import urllib.request, urllib.parse, urllib.error
import json


class XmlListConfig(list):
    def __init__(self, aList):
        for element in aList:
            if element:
                # treat like dict
                if len(element) == 1 or element[0].tag != element[1].tag:
                    self.append(XmlDictConfig(element))
                # treat like list
                elif element[0].tag == element[1].tag:
                    self.append(XmlListConfig(element))
            elif element.text:
                text = element.text.strip()
                if text:
                    self.append(text)


class XmlDictConfig(dict):
    '''
    Example usage:

    >>> tree = ElementTree.parse('your_file.xml')
    >>> root = tree.getroot()
    >>> xmldict = XmlDictConfig(root)

    Or, if you want to use an XML string:

    >>> root = ElementTree.XML(xml_string)
    >>> xmldict = XmlDictConfig(root)

    And then use xmldict for what it is... a dict.
    '''
    def __init__(self, parent_element):
        if parent_element.items():
            self.update(dict(parent_element.items()))
        for element in parent_element:
            if element:
                # treat like dict - we assume that if the first two tags
                # in a series are different, then they are all different.
                if len(element) == 1 or element[0].tag != element[1].tag:
                    aDict = XmlDictConfig(element)
                # treat like list - we assume that if the first two tags
                # in a series are the same, then the rest are the same.
                else:
                    # here, we put the list in dictionary; the key is the
                    # tag name the list elements all share in common, and
                    # the value is the list itself 
                    aDict = {element[0].tag: XmlListConfig(element)}
                # if the tag has attributes, add those to the dict
                if element.items():
                    aDict.update(dict(element.items()))
                self.update({element.tag: aDict})
            # this assumes that if you've got an attribute in a tag,
            # you won't be having any text. This may or may not be a 
            # good idea -- time will tell. It works for the way we are
            # currently doing XML configuration files...
            elif element.items():
                self.update({element.tag: dict(element.items())})
            # finally, if there are no child tags and no attributes, extract
            # the text
            else:
                self.update({element.tag: element.text})


class Plugin(object):
  PATHTWDSS="gps.TSS"
  PATHTLL_SB="gps.LLSB"
  PATHTLL_BB="gps.LLBB"
  PATHTLL_VPOL="gps.VPOL"


  
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
      'data': [

        {
          'path': cls.PATHTWDSS,
          'description': 'TWD PT1 for sailsteer',
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
    #we register an handler for API requests
    self.api.registerRequestHandler(self.handleApiRequest)
    self.count=0
    self.windAngleSailsteer={'x':0,'y':0, 'alpha':0}
    self.api.registerRestart(self.stop)
    self.oldtime=0
    self.polare={}
    self.Polare('polare.xml')

  def changeParam(self,param):
    self.api.saveConfigValues(param)
    self.startSequence+=1  
  
  def stop(self):
    pass

  def PT_1funk(self, f_grenz, t_abtast, oldvalue, newvalue):
    #const t_abtast= globalStore.getData(keys.properties.positionQueryTimeout)/1000 //[ms->s]
    T = 1 / (2*math.pi*f_grenz)
    tau = 1 / ((T / t_abtast) + 1)
    return(oldvalue + tau * (newvalue - oldvalue))


  def run(self):
    """
    the run method
    @return:
    """
    seq=0
    self.api.log("started")
    self.api.setStatus('SAILSTEER','running')
    while not self.api.shouldStopMainThread():
      gpsdata=self.api.getDataByPrefix('gps')
      if 'windSpeed' in gpsdata :
        if gpsdata['windReference'] == 'R':
            if(calcSailsteer(self, gpsdata)):
                self.api.addData(self.PATHTWDSS,gpsdata['TSS'])
                calc_Laylines(self,gpsdata)  


    self.api.log("no more running")

  
  
  
  def Polare(self, f_name):
    polare_filename = os.path.join(os.path.dirname(__file__), f_name)
    tree = ET.parse(polare_filename)
    root = tree.getroot()
    xmldict = XmlDictConfig(root)
    x=ET.tostring(root, encoding='utf8').decode('utf8')

    x=root.find('windspeedvector').text
    # whitespaces entfernen
    x="".join(x.split())
    self.polare['windspeedvector']=list(map(float,x.strip('][').split(',')))
    x=root.find('windanglevector').text
    # whitespaces entfernen
    x="".join(x.split())
    self.polare['windanglevector']=list(map(float,x.strip('][').split(',')))
        
    x=root.find('boatspeed').text
    # whitespaces entfernen
    z="".join(x.split())
    
    z=z.split('],[')
    boatspeed=[]
    for elem in z:
        zz=elem.strip('][').split(',')
        boatspeed.append(list(map(float,zz)))
    self.polare['boatspeed']=boatspeed
    x=root.find('wendewinkel')
    y=x.find('upwind').text
    # whitespaces entfernen
    y="".join(y.split())
    self.polare['ww_upwind']=list(map(float,y.strip('][').split(',')))
    y=x.find('downwind').text
    # whitespaces entfernen
    y="".join(y.split())
    self.polare['ww_downwind']=list(map(float,y.strip('][').split(',')))
    
    
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
    if url == 'test':
      return {'status':'OK'}
    if url == 'reset':
      self.count=0
      self.api.addData(self.PATH, self.count)
      return {'status': 'OK'}
    return {'status','unknown request'}

def toPolWinkel(self, x,y): # [grad]
    return(180*math.atan2(y,x)/math.pi)


def toKartesisch(self, alpha):# // [grad]
  K={}
  K['x']=math.cos((alpha * math.pi) / 180)
  K['y']=math.sin((alpha * math.pi) / 180)
  return(K)    
  
  

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
        if (math.fabs(gpsdata['TWA']) > 90 and math.fabs(gpsdata['TWA']) < 270): 
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_downwind']) * 2
        else:
            wendewinkel = linear((gpsdata['TWS'] / 0.514),self.polare['windspeedvector'],self.polare['ww_upwind']) * 2

        LL_SB = (gpsdata['TWD'] + wendewinkel / 2) % 360
        LL_BB = (gpsdata['TWD'] - wendewinkel / 2) % 360
        self.api.addData(self.PATHTLL_SB,LL_SB)
        self.api.addData(self.PATHTLL_BB,LL_BB)


        gpsdata['TWA']=gpsdata['TWA']%360
        anglew = 360 - gpsdata['TWA'] if gpsdata['TWA'] > 180 else gpsdata['TWA']
        #in kn
        SOGPOLvar = bilinear(self,  \
            self.polare['windspeedvector'],    \
            self.polare['windanglevector'],    \
            self.polare['boatspeed'],  \
            (gpsdata['TWS'] / 0.514), \
            anglew  \
        )
        self.api.addData(self.PATHTLL_VPOL,SOGPOLvar*0.514444)
        # for testing puposes replace measured speed by calc. speed from polare
        #        (this.gps.speed * 1.94384) = (this.gps.speed * 1.94384) = this.BoatData.SOGPOLvar

    ## avnav_navi.php?request=route&command=getleg
    #//      Route: {latlon: 0, active: false, dir:0,dist: 0, name:"",wp_name:"",}
        VMGvar = ((gpsdata['speed'] * 1.94384) * math.cos(gpsdata['TWA'] * math.pi) / 180)
    rueckgabewert = urllib.request.urlopen('http://localhost:8081/viewer/avnav_navi.php?request=route&command=getleg')
    route=rueckgabewert.read()
    inhalt_text = route.decode("UTF-8")
    d = json.loads(inhalt_text)
    #print(d)
    """

    if (this.Route.active) {
        mySVG.get('pathWP').style('display', null)
        this.Route.dir = this.Position.bearingTo(this.Route.latlonTo)
        this.Route.dist =
            this.Position.distanceTo(this.Route.latlonTo) * 0.539957
        this.Route.VMCvar =
            (this.gps.speed * 1.94384) *
            Math.cos(((this.Route.dir - this.gps.course) * Math.PI) / 180)
    } else {
        //      mySVG.get('pathWP').style('display', 'none')
        this.Route.VMCvar = NaN
    }
    //    console.log(this.BoatData)
}

    """

    
    
    
def calcSailsteer(self, gpsdata):
    rt=gpsdata
    if not 'track' in gpsdata or not 'AWD' in gpsdata:
        return False
    try:
        KaW=toKartesisch(self,gpsdata['AWD']);
        KaW['x'] *= gpsdata['windSpeed'] #'m/s'
        KaW['y'] *= gpsdata['windSpeed'] #'m/s'
        KaB=toKartesisch(self, gpsdata['track']);
        KaB['x'] *= gpsdata['speed']  #'m/s'
        KaB['y'] *= gpsdata['speed']  #'m/s'

        t_abtast=(time.time()-self.oldtime)
        freq=1/t_abtast
        self.oldtime=time.time()
        fgrenz=0.02
        self.windAngleSailsteer['x']=self.PT_1funk(fgrenz, t_abtast, self.windAngleSailsteer['x'], KaW['x'] - KaB['x'])
        self.windAngleSailsteer['y']=self.PT_1funk(fgrenz, t_abtast, self.windAngleSailsteer['y'], KaW['y'] - KaB['y'])
      # zurück in Polaren Winkel
        self.windAngleSailsteer['alpha']=toPolWinkel(self,self.windAngleSailsteer['x'],self.windAngleSailsteer['y']) # [grad]
        gpsdata['TSS']=self.windAngleSailsteer['alpha']
        
        return True
    except Exception:
        gpsdata['TSS']=0
        self.api.error(" error calculating TSS " + str(gpsdata) + "\n")
        return False
    
    """


        var anglew = this.gps.TWA > 180 ? 360 - this.gps.TWA : this.gps.TWA
        this.SOGPOLvar = this.bilinear(
            this.Polare.windspeedvector,
            this.Polare.windanglevector,
            this.Polare.boatspeed,
            (this.gps.TWS / 0.514),
            anglew
        )
        // for testing puposes replace measured speed by calc. speed from polare
        //        (this.gps.speed * 1.94384) = (this.gps.speed * 1.94384) = this.BoatData.SOGPOLvar

    }
    //      Route: {latlon: 0, active: false, dir:0,dist: 0, name:"",wp_name:"",}
    this.VMGvar = ((this.gps.speed * 1.94384) * Math.cos(this.gps.TWA * Math.PI) / 180)
    if (this.Route.active) {
        mySVG.get('pathWP').style('display', null)
        this.Route.dir = this.Position.bearingTo(this.Route.latlonTo)
        this.Route.dist =
            this.Position.distanceTo(this.Route.latlonTo) * 0.539957
        this.Route.VMCvar =
            (this.gps.speed * 1.94384) *
            Math.cos(((this.Route.dir - this.gps.course) * Math.PI) / 180)
    } else {
        //      mySVG.get('pathWP').style('display', 'none')
        this.Route.VMCvar = NaN
    }
    //    console.log(this.BoatData)
}
    """

