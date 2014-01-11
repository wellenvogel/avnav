#!/usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
from compiler.pyassem import CONV

###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
#  parts of this software are based on tiler_tools (...)
#  the license terms (see below) apply to the complete software the same way
#
###############################################################################
# Copyright (c) 2011, Vadim Shlyakhov
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
###############################################################################
# for tile naming see http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
# so we have x from 0 (upper left - 180°W) to 2^^zoom -1
#            y from 0 (upper left - 85.0511 °N) to 2^^zoom -1
#projection Mercator

# read_charts.py:
info="""
 read a list of charts and prepare them for the creation of slippy map (OSM) compatible tiles using GDAL and tiler_tools
 the workflow consists of 3 steps:
 1. creating an tilelist.xml file that contains
    informations about the layers to be created
    it will analyze the charts and try to create a set of layers that are best suited for navigation.
    typically we will have 3 layers:
      overview charts (around zoom level 9, 10 - 350/150 meters/pixel)
      navi charts (around zoom level 14 - 9.5 meters/pixel)
      detailed charts (around zoom level 17++ - < 1.2 meters/pixel)
    For this purpose it will analyse the charts and will sort them into tilelist.xml. The sequence within
    each section in the list will be from higher resolution to lower resolution.
    tilelist.xml will afterwards be the input for the real tile generation process. You can add more sections
    to the file and resort the charts within the file but you should always keep the order as it is, to ensure
    that we will always generate the highest resolution tiles for each layer.
 2. creating the base tiles for each chart using gdal_tiler from tiler-tools
    the tiles will be generated as png files into the basetiles dir at the output directory
 3. merging the tiles and creating the overview tiles (lower zoom level)
    overview tiles will always being generated up to the next layer max zoom level
 You can control the behavior of the script using the -m mode (chartlist,generate,merge,all).
 Additionally the program assumes a suitable mode when you omit the -m mode depending on the parameters given.
 The basic call syntax is:
   read_charts.py outdir [infiles(s)]
 When you provide both outdir and infiles, the mode chartlist is assumed, the file chartlist.xml is created at outdir.
 For infile(s) you can provide a list of files and/or directories that are recursively scanned for charts that can be
 opened with GDAL.
 When you only provide the outdir parameter (or use one of the modes generate or merge) the file chartlist.xml is read
 from the output directory and the tiles are generated at outdir/basetiles and outdir/tiles.

 directory structure of the output:
 <outdir>/tilelist.xml
 <outdir>/temp/xxx.vrt
              /xxx.[png,jpg,...] - converted charts if necessary
 <outdir>/basetiles/...   - the generated tiles for the base zoom level
 <outdir>/tiles/<layername>/...   - the generated tiles 

 Paremeters:
   -d           enable debug
   -m mode      run mode all|chartlist|generate|merge
   -c chartlist filename of the chartlist to be handled
   -l layers    a list of zoomLevel:name separated by , to define the layers to be used (only for chartlist)
   """

LISTFILE="chartlist.xml"
LAYERFILE="layer.xml"
LAYERBOUNDING="boundings.xml"
OVERVIEW="avnav.xml"
BASETILES="basetiles"
OUTTILES="tiles"

#max upscale of a chart when creating base tiles
#this is only used when sorting into layers
MAXUPSCALE=4

#how many levels do we overlap (i.e. produce downscaled tiles) between layers
MAXOVERLAP=1

#tilesize in px
TILESIZE=256

#an xml description of the layers we generated - following the TMS spec
overview_xml='''<?xml version="1.0" encoding="UTF-8" ?>
 <TileMapService version="1.0.0" >
   <Title>avnav tile map service</Title>
   <TileMaps>
   %(tilemaps)s
   </TileMaps>
   %(bounding)s
 </TileMapService>
 '''
overview_tilemap_xml='''
    <TileMap 
       title="%(title)s" 
       srs="OSGEO:41001" 
       profile="%(profile)s" 
       href="%(url)s" 
       minzoom="%(minZoom)d"
       maxzoom="%(maxZoom)d">
       %(bounding)s
       <TileFormat width="%(tile_width)d" height="%(tile_height)d" mime-type="%(tile_mime)s" extension="%(tile_ext)s" />
       %(layerboundings)s
    </TileMap>
       
'''
layer_xml='''<?xml version="1.0" encoding="UTF-8" ?>

<!-- Generated by read_charts.py  and gdal_tiler.py(http://code.google.com/p/tilers-tools/) -->

<TileMap >
  <Title>%(title)s</Title>
  <Abstract>%(description)s</Abstract>
  <SRS>OSGEO:41001</SRS>
  <BoundingBox minlon="%(minlon).11G" minlat="%(minlat).11G" maxlon="%(maxlon).11G" maxlat="%(maxlat).11G"/>
  <TileFormat width="%(tile_width)d" height="%(tile_height)d" mime-type="%(tile_mime)s" extension="%(tile_ext)s" />
  <TileSets profile="global-xyz">
%(tilesets)s
  </TileSets>
</TileMap>
'''
layer_tileset_xml='''
<TileSet href="%(href)s" units-per-pixel="%(units_per_pixel).11G" order="%(order).11G" />
'''
boundingbox_xml='''
<BoundingBox minlon="%(minlon).11G" minlat="%(minlat).11G" maxlon="%(maxlon).11G" maxlat="%(maxlat).11G"
   title="%(title)s"/>
'''
boundings_xml='''
<LayerBoundings>
%(boundings)s
</LayerBoundings>
'''



#the number of pixels the lowest scale layer should fit on its min zoomlevel
MINZOOMPIXEL=600

#use this to split the charts into several layers
#charts with a resolution between 2 levels we go to the lower level
layer_zoom_levels=[(6,"Base"),(10,"World"),(13,"Overview"),(15,"Nav"),(17,"Detail"),(19,"Max")]


#options
options=None


import gdal
import osr
from gdalconst import *
import os
import sys
import logging
import shutil
import itertools
from optparse import OptionParser
import xml.sax as sax 
from PIL import Image
import operator
import math
import shutil
from stat import *
import Queue
import threading
import time
import site
import subprocess
import re

hasNvConvert=False
try:
  import convert_nv
  hasNvConvert=True
except:
  pass

TilerTools=None



def ld(*parms):
    logging.debug(' '.join(itertools.imap(repr,parms)))

def warn(txt):
  logging.warning(txt)
def log(txt):
  logstr=time.strftime("%Y/%m/%d-%H:%M:%S ",time.localtime())+txt
  logging.info(logstr.decode("utf-8","replace"))
  
#---------------------------
#tiler tools stuff
def findTilerTools(ttdir=None):
  if ttdir is None:
    ttdir=os.environ.get("TILERTOOLS")
  if ttdir is None:
    try:
      ttdir=os.path.dirname(os.path.realpath(__file__))
    except:
      pass
  if ttdir is not None:
    if os.path.exists(os.path.join(ttdir,"gdal_tiler.py")):
      log("using tiler tools from "+ttdir)
      return ttdir
  print "unable to find gdal_tiler.py, either set the environment variable TILERTOOLS or use the option -a to point to the tile_tools directory"
  sys.exit(1)


#create a bounding box xml from a bounds tuple
#bounds: ullon,ullat,lrlon,lrlat

def createBoundingsXml(bounds,title):
  return boundingbox_xml % {"title": title,
                                            "minlon": bounds[0],
                                            "maxlat": bounds[1],
                                            "maxlon": bounds[2],
                                            "minlat": bounds[3]}
  
#---------------------------
#a description of a chart to be converted
class ChartEntry():
  #bounds: upperleftlon,upperleftlat,lowerrightlon,lowerrightlat
  def __init__(self,filename,title,mpp,bounds,layer):
    self.filename=filename
    self.title=title
    self.mpp=mpp
    self.bounds=bounds
    self.layer=layer
    self.ultile=None
    self.lrtile=None

  def getBaseZoomLevel(self):
    z,name=layer_zoom_levels[self.layer]
    return z

  #return a dictinary with the parameters
  def getParam(self):
    return { "filename":self.filename,"title":self.title,"mpp":self.mpp,"b1":self.bounds[0],"b2":self.bounds[1],"b3":self.bounds[2],"b4":self.bounds[3],"layer":self.layer}
  def __str__(self):
    rt="Chart: file=%(filename)s, title=%(title)s, layer=%(layer)d, mpp=%(mpp)f, boundsll=(%(b1)f,%(b2)f,%(b3)f,%(b4)f)" % self.getParam()
    return rt

  def toXML(self):
    rt="""<chart filename="%(filename)s" title="%(title)s" mpp="%(mpp)f">""" % self.getParam()
    rt+=createBoundingsXml(self.bounds, self.title)
    rt+="</chart>"
    return rt
  def updateCornerTiles(self,zoom,mercator):
    self.ultile,self.lrtile=mercator.corner_tiles(zoom,self.bounds)
    ld("updateCornerTiles for",self.title,self.ultile,self.lrtile)
  #tile is a tuple z,x,y
  def hasTile(self,tile):
    #ul always has lowest x,y
    if self.ultile is None or self.lrtile is None:
      return False
    if self.ultile[0] != tile[0]:
      return False
    if self.lrtile[0] != tile[0]:
      return False
    if self.ultile[1] > tile[1]:
      return False
    if self.ultile[2] > tile[2]:
      return False
    if self.lrtile[1] < tile[1]:
      return False
    if self.lrtile[2] < tile[2]:
      return False
    return True

  def getTilesSet(self,zoom,mercator):
    self.updateCornerTiles(zoom,mercator)
    if self.ultile is None or self.lrtile is None:
      return set()
    rt=set()
    for ty in range(self.ultile[2],self.lrtile[2]+1):
      rt|=set(map(lambda x: (zoom,x,ty),range(self.ultile[1],self.lrtile[1]+1)))
    ld("getTilesSet for ",self.title,"zoom",zoom,rt)
    return rt


class ChartList():
  def __init__(self,mercator):
    self.tlist=[]
    self.mercator=mercator
  def add(self,entry,noSort=False):
    idx=0
    found=False
    if not noSort:
      for idx in range(len(self.tlist)):
        if (self.tlist[idx].mpp > entry.mpp):
          found=True
          break
    if idx < len(self.tlist) and found:
      #found an entry with lower res (higher mpp) - insert before
      self.tlist.insert(idx,entry)
    else:
      self.tlist.append(entry)

  def __str__(self):
    rt="ChartList len=%d" % (len(self.tlist))
    for te in self.tlist:
      rt+="\n  %s (layer: %d)" % (str(te),te.layer)
    return rt

  def toXML(self):
    layer=0
    lastlayer=-1
    rt="""<?xml version="1.0" encoding="UTF-8"?>"""+"\n"
    rt+="<charts>\n";
    for le in self.tlist:
      layer=le.layer
      if lastlayer != layer:
        if lastlayer != -1:
          rt+="</layer>\n"
        layerzoom=layer_zoom_levels[layer]
        rt+="""<layer zoom="%d" name="%s" mpp="%f">\n""" % (layerzoom[0],layerzoom[1],self.mercator.mppForZoom(layerzoom[0]))
        lastlayer=layer
      rt+=le.toXML()+"\n";
    if lastlayer != -1 :
      rt+="</layer>\n"
    rt+="</charts>\n"
    return rt

  def save(self,fname=None,sdir=None):
    if fname is None:
      fname=LISTFILE
    if sdir is not None:
      ld("sdir",sdir)
      if not os.access(sdir,os.F_OK):
        os.makedirs(sdir,0777)
      fname=os.path.join(sdir,LISTFILE)
    h=open(fname,"w")
    print >>h, self.toXML()
    log("chartlist saved to "+fname)
    h.close()

  def createFromXml(filename,mercator):
    global layer_zoom_levels
    layer_zoom_levels=[]
    if not os.path.isfile(filename):
      warn("unable to find file "+filename)
      return None
    chartlist=ChartList(mercator)
    parser=sax.parse(filename,ChartListHandler(chartlist,layer_zoom_levels))
    return chartlist
  createFromXml=staticmethod(createFromXml)

  def filterByLayer(self,layer):
    rt=ChartList(self.mercator)
    for ce in self.tlist:
      if ce.layer == layer:
        rt.tlist.append(ce)
    return rt

  #create a copy of the list containing entries that
  #have a particular tile
  def filterByTile(self,tile):
    rt=ChartList(self.mercator)
    for ce in self.tlist:
      if ce.hasTile(tile):
        rt.tlist.append(ce)
    return rt
  def getTilesSet(self,zoom):
    rt=set()
    for ce in self.tlist:
      rt=rt| ce.getTilesSet(zoom,self.mercator)
    return rt
  #-------------------------------------
  #get the bounding box for the list of charts
  #in lat/lon - ul has min lon(x),max lat(y)
  def getChartsBoundingBox(self):
    ulx=None
    lrx=None
    uly=None
    lry=None
    for ce in self.tlist:
      bulx,buly,blrx,blry=ce.bounds
      if ulx is None or ulx > bulx:
        ulx=bulx
      if uly is None or uly < buly:
        uly=buly
      if lrx is None or lrx < blrx:
        lrx=blrx
      if lry is None or lry > blry:
        lry=blry
    ld("getChartsBoundingBox",ulx,uly,lrx,lry)
    return (ulx,uly,lrx,lry)

  #get the min and max layer
  def getMinMaxLayer(self):
    minlayer=None
    maxlayer=None
    for ce in self.tlist:
      if minlayer is None or minlayer > ce.layer:
        minlayer=ce.layer
      if maxlayer is None or maxlayer < ce.layer:
        maxlayer=ce.layer
    ld("getMinMaxLayer",minlayer,maxlayer)
    return (minlayer,maxlayer)

  #update the corner tiles for a zoom level
  def updateCornerTiles(self,zoom):
    for ce in self.tlist:
      ce.updateCornerTiles(zoom,self.mercator)
 

#----------------------------
#sax reader for chartlist
class ChartListHandler(sax.handler.ContentHandler): 
  def __init__(self,chartlist,zoom_layers): 
    self.eltype=None
    self.layerZoom=None
    self.layerName=None
    self.fname=None
    self.title=None
    self.mpp=None
    self.box=None
    self.chartlist=chartlist
    self.layer=-1
    self.zoom_layers=zoom_layers
  def startElement(self, name, attrs): 
    self.eltype=name
    if name == "layer": 
      self.layerZoom = int(attrs["zoom"])
      self.layerName = attrs["name"]
      self.layer+=1
      ld("Parser: layer ",self.layer,self.layerZoom,self.layerName)
      self.zoom_layers.append((self.layerZoom,self.layerName))
    elif name == "chart":
      self.fname = attrs["filename"]
      self.title = attrs["title"].encode('ascii','ignore') 
      self.mpp = float(attrs["mpp"])
      ld("Parser chart",self.fname,self.title,self.mpp)
    elif name == "BoundingBox":
      ulx=float(attrs["minlon"])
      uly=float(attrs["maxlat"])
      lrx=float(attrs["maxlon"])
      lry=float(attrs["minlat"])
      assert ulx is not None,"missing value minlon in BoundingBox"
      assert uly is not None,"missing value maxlat in BoundingBox"
      assert lrx is not None,"missing value maxlon in BoundingBox"
      assert lry is not None,"missing value minlat in BoundingBox"
      self.box=(ulx,uly,lrx,lry)
      ld("Parser box",self.box)
  def endElement(self, name): 
    if name == "chart": 
      assert self.box is not None,"missing BoundingBox for "+self.fname
      ce=ChartEntry(self.fname,self.title,self.mpp,self.box,self.layer)
      ld("Parser add entry",str(ce))
      self.chartlist.add(ce,True)
      self.fname=None
      self.box=None
      self.title=None
      self.mpp=None
  def characters(self, content): 
    pass
  

#----------------------------
#store the data for a tile
#the data is either the complete file content as a raw buffer or an PIL image
#mode:
class TileStore:
  NONE='none'
  PIL='pil'
  RAW='raw'
  def __init__(self,tile,initEmpty=0):
    self.tile=tile
    self.mode=TileStore.NONE
    if initEmpty==0:
      self.data=None
    else:
      self.data=Image.new("RGBA",(TILESIZE*initEmpty,TILESIZE*initEmpty),(0,0,0,0))
      self.mode=TileStore.PIL
  def __getFname__(self,basedir):
    return os.path.join(basedir,getTilePath(self.tile))
  def readPILData(self,basedir):
    fname=self.__getFname__(basedir)
    if not os.path.exists(fname):
      ld("unable to load tile ",self.tile,fname)
      return
    self.data=Image.open(fname,"r")
    if self.data.mode != "RGBA":
      self.data=self.data.convert("RGBA")
    self.mode=TileStore.PIL
  def readRawData(self,basedir):
    fname=self.__getFname__(basedir)
    if not os.path.exists(fname):
      ld("unable to load tile ",self.tile,fname)
      return
    fh=os.open(fname, "r")
    self.data=os.read(fh,os.path.getsize(fname))
    os.close(fh)
    self.mode=TileStore.RAW
  def write(self,basedir):
    fname=self.__getFname__(basedir)
    odir=os.path.dirname(fname)
    if not os.path.isdir(odir):
      try:
        os.makedirs(odir, 0777)
      except:
        pass
    if os.path.exists(fname):
      os.unlink(fname)
    if self.mode == TileStore.NONE:
      return
    if self.mode == TileStore.PIL:
      self.data.save(fname)
      return
    fh=os.open(fname,"w")
    os.write(fh, self.data)
    
  def copyin(self,tlist):
    if isinstance(tlist, TileStore):
      self.mode=tlist.mode
      self.tile=tlist.tile
      self.mode=tlist.mode
      self.data=tlist.data
      return
    num=len(tlist)
    if num == 0:
      return
    if num == 1:
      assert(isinstance(tlist[0],TileStore))
      self.copyin(tlist[0])
      return
    self.mode=TileStore.PIL
    self.data=Image.new("RGBA",(TILESIZE,TILESIZE))
    self.tile=tlist[0].tile
    ld("merging ",num,"tiles into",self.tile)
    for item in tlist:
      assert(isinstance(item,TileStore))
      assert(item.mode==TileStore.PIL)
      assert(item.tile==self.tile)
      self.data.paste(item.data,None,item.data)
    
#----------------------------
#a build pyramid
#contains at level 0 one tile of the min zoom level
#and on the higher levels all tiles belonging to the layer up to the max zoom level
class BuildPyramid:    
  def __init__(self,layercharts,layername,outdir):
    self.layercharts=layercharts
    self.layername=layername
    self.outdir=outdir
    self.pyramid=[]
  def addZoomLevelTiles(self,tiles):
    self.pyramid.append(tiles)
  def getNumZoom(self):
    return len(self.pyramid)
  def getZoomLevelTiles(self,level):
    if level < 0 or level >= self.getNumZoom():
      return set()
    else:
      return self.pyramid[level]
  #-------------------------------------
  #create all the png tiles for a buildpyramid
  #this is a pyramid containing one tile on minzoomlevel at index 0 and 
  #the tiles for the higher zoomlevels at the indexes above
  #the tiles are only the ones visible in the layer
  def handlePyramid(self):
    ld("handling buildpyramid",list(self.getZoomLevelTiles(0))[0])
    layerdir=os.path.join(self.outdir,OUTTILES,self.layername)
    #now we go up again an start merging the base level tiles
    buildtiles=self.getZoomLevelTiles(self.getNumZoom()-1)
    ld("merging ",len(buildtiles),"basetiles")
    buildts=[];
    currentLevel=self.getNumZoom()-1;
    for curtile in buildtiles:
      celist=self.layercharts.filterByTile(curtile)
      buildts.append(mergeChartTiles(self.outdir,self.layername,curtile,celist))
    #now we have all the basetiles for this top level tile
    #go up the self now and store the tiles as they are created
    while currentLevel >= 0 :
      ld("saving level ",currentLevel,"num ",len(buildts))
      for ts in buildts:
        ts.write(layerdir)
      if currentLevel <= 0:
        break
      nextbuildts=[]
      #sort the tiles into a dictionary for easy acccess
      builddict={}
      for currenttile in buildts:
        builddict[currenttile.tile]=currenttile
      currentLevel-=1
      buildtiles=self.getZoomLevelTiles(currentLevel)
      ld("build level",currentLevel," num",len(buildtiles))
      for currenttile in buildtiles:
        uppertiles=getUpperTiles(currenttile)
        mergets=[]
        for uppertile in uppertiles:
          ts=builddict.get(uppertile)
          if ts is None:
            ts=TileStore(uppertile)
          mergets.append(ts)
        nextbuildts.append(createUpperTile(currenttile, mergets))
      buildts=nextbuildts
      nextbuildts=None
    

#----------------------------
#handler thread for a pyramid
class PyramidHandler(threading.Thread):
  def __init__(self,queue):
    self.queue=queue
    threading.Thread.__init__(self)
  def run(self):
    while True:
      pyramid=self.queue.get();
      pyramid.handlePyramid()
      ld("handler thread pyramid ready")
      self.queue.task_done()
    
#------------------------------
#handler class for all the projection stuff
#we have to consider the mercator projection (google) - so we need transformations
#between lat/lon and mercator units (m)
#additionally we have to convert our maps onto this mercator projection

class Mercator:
  # create a geotransform towards the target projection
  # Global Mercator (EPSG:3857) - see http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
  TARGET_SRSP4='+proj=merc +a=6378137 +b=6378137 +nadgrids=@null +wktext'
  #number of tiles in zoom level 0
  ZOOM_0_NTILES=1
  #max zoom level
  MAXZOOM=32

  #create the descriptions for our google mercator SRS (and lat/lon)
  #create a transformer from lat/lon to mercator units 
  #fill an array with the mercator units/pixel (mpp) for each zoom level
  def __init__(self):
    srs = osr.SpatialReference()
    srs.ImportFromProj4(self.TARGET_SRSP4)
    self.target_wkt=srs.ExportToWkt();
    srs_geo = osr.SpatialReference()
    srs_geo.CopyGeogCSFrom(srs)
    self.longlat_wkt=srs_geo.ExportToWkt()
    ld("init_srs TARGET_SRSP4:",self.TARGET_SRSP4,"TARGET_SRS",self.target_wkt,"TARGET_LONGLAT",self.longlat_wkt)
    assert self.longlat_wkt is not None,"self.longlat_wkt has not been computed"
    #a transformer for converting lon/lat to the google mercator coordinates
    self.transformer=gdal.Transformer(None,None,[ "SRC_SRS=%s" % (self.getLongLatWkt()),"DST_SRS=%s" % (self.getTargetWkt())])
    assert self.transformer is not None, "unknown transformation"
    max_x=self.transform_point((180,0))[0] # Equator's half length 
    ld("max_x",max_x)
    zoom_0_mpp=max_x*2/(self.ZOOM_0_NTILES*TILESIZE)
    mpp=zoom_0_mpp
    self.zoom_mpp=[]
    for i in range(self.MAXZOOM+1):
      self.zoom_mpp.append(mpp)
      ld("zoom ",i,"mpp",mpp)
      mpp=mpp/2

  #transform a list of points
  def transform(self,points,inv=False):
      if not points:
          return []
      transformed,ok=self.transformer.TransformPoints(inv,points)
      assert ok
      return [i[:2] for i in transformed]

  #transform a single point
  def transform_point(self,point,inv=False):
      return self.transform([point],inv=inv)[0]

  #get the target srs (google mercator) in wkt format
  def getTargetWkt(self):
    return self.target_wkt;
  #get the wkt for coordinates in lat/lon
  def getLongLatWkt(self):
    return self.longlat_wkt
  #-------------------------------------
  #helpers for converting between coordinates(lon/lat) and tiles
  #NW corner is: 
  #longlat: -180 85
  #mercator: -20037508.3427892 19971868.8804086
  #as upper left tile has 0,0
  #SE (lower right) is:
  #longlat: 180 -85
  #mercator: 20037508.3427892 -19971868.8804086

  def latlonToTile(self,latlon,zoom):
    x,y=self.deg2num(latlon[0],latlon[1],zoom)
    return (zoom,x,y)
  def tileToLatlon(self,tile):
    return self.num2deg(tile[1],tile[2],tile[0])
    
  #taken from http://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
  def deg2num(self,lat_deg, lon_deg, zoom):
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.log(math.tan(lat_rad) + (1 / math.cos(lat_rad))) / math.pi) / 2.0 * n)
    return (xtile, ytile)

  def num2deg(self,xtile, ytile, zoom):
    n = 2.0 ** zoom
    lon_deg = xtile / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
    lat_deg = math.degrees(lat_rad)
    return (lat_deg, lon_deg)
  
  #get the list of corner tiles for a given bounding box
  #bounds is ul_lon,ul_lat,lr_lon,lr_lat
  def corner_tiles(self,zoom,bounds):
    t_ul=self.latlonToTile((bounds[1],bounds[0]),zoom)
    t_lr=self.latlonToTile((bounds[3],bounds[2]),zoom)
    ld("corner_tiles for zoom=",zoom,", bounds=",bounds,": ul=",t_ul,", lr=",t_lr)
    return t_ul,t_lr
  #---------------------------
  #get a zoom level from the mpp
  def zoomFromMpp(self,mpp):
    for i in range(self.MAXZOOM,0,-1):
      if mpp < self.zoom_mpp[i]:
        return i
    return self.MAXZOOM

  #get the units per pixel (mpp) for a given zoomlevel
  def mppForZoom(self,zoom):
    if zoom < 0 or zoom > self.MAXZOOM :
      return 0
    return self.zoom_mpp[zoom]
  #-------------------------------------
  #make a best guess for the layer a chart should goto
  #currently we first find the zoom level with the next lower mpp
  #afterwards we check the factor for the next better layer and allow it to go there
  #if this does not exceed 1/3 of the "distance" between the zoom level difference (one zoom level for distance 3)
  #but we limit this factor to MAXUPSCALE (so it only goes to next level if upscaling is below MAXUPSCALE)
  #TODO: find a better algorithm for doing this assignment
  def guessLayerForChart(self,chartMpp,pixelwidth,pixelheight):
    zoom=self.zoomFromMpp(chartMpp)
    layer=0
    for lz in layer_zoom_levels[1:]:
      ld("lz",lz[0],"layer",layer)
      if zoom < lz[0]:
        break
      layer+=1
    if layer >= (len(layer_zoom_levels)-1):
      #we are at the highest zoom level already
      layer=len(layer_zoom_levels)-1
    else:
      #check the zoom level diff to the next layer
      zdiff=layer_zoom_levels[layer+1][0]-layer_zoom_levels[layer][0]
      allowedFactor=2**zdiff
      if (allowedFactor > MAXUPSCALE):
        allowedFactor=MAXUPSCALE
      ld("zoom diff ",zdiff,", allowed ",allowedFactor)
      if (chartMpp <= (allowedFactor * self.zoom_mpp[layer_zoom_levels[layer+1][0]])):
        layer+=1
        ld("going to next layer due to allowed factor")
    ld("zoom",zoom,"layer",layer)
    return layer




#----------------------------
#tiler_tools use a nice approach to shift the geocp
#to allow for charts crossing 180°
#we would have to do this for all charts to get a common reference, so we currently prevent such charts
#in the future we could split such charts into 2 parts...
def checkCross180(dataset,mercator):
  transformer=gdal.Transformer(dataset,None,["DST_SRS=%s" % (mercator.getLongLatWkt()),])
  ld("transformer",transformer)
  transformed,ok=transformer.TransformPoints(False,[ (0,0), (dataset.RasterXSize,dataset.RasterYSize)])
  assert ok
  ld('checkCross180',transformed)
  if transformed[0][0] <= 180 and transformed[1][0] >=-180 and transformed[0][0] < transformed[1][0]:
      return False
  return True

def getTilePath(tile):
  z,x,y=tile
  return '%i/%i/%i.%s' % (z,x,y,"png")


#-------------------------------------
#read out information from GDAL dataset and create a chart entry
#all our boundings are in lat/lon (EPSG:4326)
def createChartEntry(fname,dataset,mercator):
  title=dataset.GetMetadataItem('DESCRIPTION')
  if checkCross180(dataset,mercator):
    warn("the chart "+fname+" crosses 180 - we currently cannot handle this")
    return None
  if title is None:
      title=os.path.basename(fname)
  ld("title",title)
  t_ds=gdal.AutoCreateWarpedVRT(dataset,None,mercator.getTargetWkt())
  ld("Raster X",t_ds.RasterXSize,"Y",t_ds.RasterYSize)
  geotr=t_ds.GetGeoTransform()
  ld("geotr",geotr)
  ul_c=(geotr[0], geotr[3])
  lr_c=gdal.ApplyGeoTransform(geotr,t_ds.RasterXSize,t_ds.RasterYSize)
  wh=(lr_c[0]-ul_c[0],lr_c[1]-ul_c[1])
  #point is alsway lon,lat
  ul_ll=mercator.transform_point((ul_c[0],ul_c[1]),True)
  lr_ll=mercator.transform_point((lr_c[0],lr_c[1]),True)
  ld('ul_c,lr_c,wh',ul_c,lr_c,wh)
  ld('ul_ll,lr_ll',ul_ll,lr_ll)
  pw=geotr[1]
  ph=geotr[5]
  #get mercator units per pixel
  mpp=pw
  if ph > pw:
    mpp=ph
  ld("pw",pw,"ph",ph,"mpp",mpp)
  layer=mercator.guessLayerForChart(mpp, pw, ph)
  rt=ChartEntry(fname,title,mpp,(ul_ll[0],ul_ll[1],lr_ll[0],lr_ll[1]),layer)
  return rt


#-------------------------------------
#read a directory recursively and return the list of files
def readDir(dir):
  ld("reading dir",dir)
  rt=[]
  for f in os.listdir(dir):
    ld("direntry",f)
    path=os.path.join(dir,f)
    if os.path.isfile(path):
      rt.append(path)
    elif os.path.isdir(path):
      rt.extend(readDir(path))
    else:
      warn("entry "+path+" not found")
  return rt

#------------------------------------------------
#nv converter
def nvConvert(chart,outdir,outname):
  opencpn=options.opencpn
  if opencpn is None:
    opencpn=os.environ.get("OPENCPN")
  if hasNvConvert:
    convert_nv.nvConvert(chart,outdir,outname,opencpn,TilerTools,log,warn,options.update==1)
  else:
    warn("no converted installed, unable to handle char %s"%(chart,))

#------------------------------------------------
#tiler tools map2gdal

def ttConvert(chart,outdir,outname):
  args=[sys.executable,os.path.join(TilerTools,"map2gdal.py"),"-t",outdir]
  if options.verbose == 2:
    args.append("-d")
  args.append(chart)
  subprocess.call(args)
  
  

#a list of file extensions that we will convert first with tiler tools to give better results
converters={
            ".kap":ttConvert,
            ".map":ttConvert,
            ".geo":ttConvert,
            ".eap":nvConvert}  
#-------------------------------------
#create a chartlist.xml file by reading all charts
def createChartList(args,outdir,mercator):
  chartlist=[]
  for arg in args:
    ld("handling arg",arg)
    if (os.path.isfile(arg)):
      fname=os.path.abspath(arg)
      ld("file",fname)
      chartlist.append(fname)
    elif (os.path.isdir(arg)):
      fname=os.path.abspath(arg)
      chartlist.extend(readDir(fname))
    else:
      warn("file/dir "+arg+" not found")
  ld("chartlist",chartlist)
  charts=ChartList(mercator)
  for chart in chartlist:
    log("handling "+chart)
    for xt in converters.keys():
      if chart.upper().endswith(xt.upper()):
        oname=chart
        (base,ext)=os.path.splitext(os.path.basename(chart))
        chart=os.path.join(outdir,BASETILES,base+".vrt")
        doSkip=False
        if options.update == 1:
          if os.path.exists(chart):
            ostat=os.stat(oname)
            cstat=os.stat(chart)
            if (cstat.st_mtime >= ostat.st_mtime):
              log(chart +" newer as "+oname+" no need to recreate")
              doSkip=True
        if not doSkip:
          log("converting "+chart)
          if os.path.exists(chart):
            try:
              os.unlink(chart)
            except:
              pass
          converters[xt](oname, os.path.join(outdir,BASETILES),chart)
          if not os.path.exists(chart):
            warn("converting "+oname+" to "+chart+" failed - trying to use native")
            chart=oname
    ld("try to load",chart)
    dataset = gdal.Open( chart, GA_ReadOnly )
    if dataset is None:
      warn("gdal cannot handle file "+chart)
    else:
      log("chart "+chart+" succcessfully opened")
      ce=createChartEntry(chart,dataset,mercator)
      if ce is not None:
        charts.add(ce)
        log("chart "+str(ce)+"added to list")
      else:
        warn("unable to create chart entry from chart "+chart)
  charts.save(LISTFILE,outdir)
#-------------------------------------
#read the chartlist from the xml file
def readChartList(outdir,mercator):
  fname=LISTFILE
  if outdir is not None:
    fname=os.path.join(outdir,LISTFILE)
  chartlist=ChartList.createFromXml(fname,mercator)
  assert chartlist is not None,"unable to read chartlist from "+fname
  return chartlist
#-------------------------------------
#get the directory within outdir that contains the tiles for the base zoom level
#param: chartEntry - the chart entry we look for
#param: outdir - the base output directory
#param: inp - if true, return the directory to be used as outdir for tiler_tools, otherwise directly the dir with the charts
def getTilesDir(chartEntry,outdir,inp):
  out=os.path.join(outdir,BASETILES);
  if not inp:
    b,e=os.path.splitext(os.path.basename(chartEntry.filename))
    out=os.path.join(out,b+".zxy")
  return out




#-------------------------------------
#get the next level (smaller zoom) tile set from a given tileset
def getLowerLevelTiles(tiles):
  rt=set()
  for tile in tiles:
    ntile=(tile[0]-1,int(tile[1]/2),int(tile[2]/2))
    rt.add(ntile)
  return rt

#-------------------------------------
#get the list of higher level tiles that belong to a lower level one
#the sequence is ul,ur,ll,lr
def getUpperTiles(tile):
  rt=[]
  rt.append((tile[0]+1,2*tile[1],2*tile[2])) #ul
  rt.append((tile[0]+1,2*tile[1]+1,2*tile[2])) #ur
  rt.append((tile[0]+1,2*tile[1],2*tile[2]+1)) #ll
  rt.append((tile[0]+1,2*tile[1]+1,2*tile[2]+1)) #lr
  return rt



#merge higher zoom layer tiles into a lower layer tile
#infiles is the sequence from getUpperTiles (ul (x,y), ur(x+1,y),ll(x,y+1),lr(x+1,y+1))
#-------------------------------------
def createUpperTile(outtile,intiles):
  ld("createUpperTile",outtile,intiles)
  assert len(intiles) == 4, "invalid call to createUpperTiles, need exactly 4 tiles"
  #TODO: handle paletted data correctly - currently we convert to RGBA...
  outts=TileStore(outtile,2)
  #TODO: currently we always have PIL type tiles or none - maybe we should be able to convert RAW here
  if intiles[0].mode == TileStore.PIL:
    outts.data.paste(intiles[0].data,(0,0)) #UL
  if intiles[1].mode == TileStore.PIL:
    outts.data.paste(intiles[1].data,(TILESIZE,0)) #UR
  if intiles[2].mode == TileStore.PIL:
    outts.data.paste(intiles[2].data,(0,TILESIZE)) #LL
  if intiles[3].mode == TileStore.PIL:
    outts.data.paste(intiles[3].data,(TILESIZE,TILESIZE)) #LR
  outts.data=outts.data.resize((TILESIZE,TILESIZE))
  return outts
 
#-------------------------------------
#merge the tiles from a set of charts into one destination tile
#param: outdir - the destination directory
#param: layername - subdir for target tiles
#param: outtile - the tile (z,x,y)
#param: celist - ChartList with entries that have this tile
#returns: the tilestore of the outtile (not yet written to disk)
def mergeChartTiles(outdir,layername,outtile,celist, alwaysPil=True):
  if not os.path.isdir(outdir):
    ld("create tile dir",outdir)
    os.makedirs(outdir,0777)
  ld("mergeChartTiles outdir",outdir,"layer",layername,"tile",outtile,"charts",str(celist))
  tiledir=os.path.join(outdir,OUTTILES,layername)
  if not os.path.isdir(tiledir):
    try:
      os.makedirs(tiledir,0777)
    except:
      pass
  outts=TileStore(outtile)
  indirs=[]
  #merge all tiles we have in the list
  #the list has the tile with best resolution (lowest mpp) first, so we revert it
  #to start with the lower resolution tiles and afterwards overwrite them with better solution ones
  #maybe in the future this should be more intelligent to consider which chart we used "around" to avoid
  #changing the chart to often (will not look very nice...)
  for ce in celist.tlist[::-1]:
    indir=getTilesDir(ce,outdir,False)
    tilefile=os.path.join(indir,getTilePath(outtile))
    if os.path.isfile(tilefile):
      indirs.append(indir)
  if len(indirs)== 0:
    ld("no tiles found for",outtile)
    outts=TileStore(outtile) #create an empty tile for the merge
  if len(indirs)==1:
    its=TileStore(outtile)
    #TODO: maybe it would be better to store both the PIL image and the raw data for better top level quality
    if not alwaysPil:
      its.readRawData(indirs[0])
    else:
      its.readPILData(indirs[0])
    outts.copyin(its)
  if len(indirs) > 1:
    inlst=[]
    for idir in indirs:
      its=TileStore(outtile)
      its.readPILData(idir)
      inlst.append(its)
    outts.copyin(inlst)
  return outts
    
#-------------------------------------
#create the base zoom level tiles for a chart
#using tiler_tools
def generateBaseTiles(chartEntry,outdir):
  tdir=getTilesDir(chartEntry, outdir, False)
  if not options.update == 1:
    if os.path.isdir(tdir):
      log("removing old dir "+tdir)
      shutil.rmtree(tdir,True)
  else:
    tilesdir=os.path.join(tdir,str(chartEntry.getBaseZoomLevel()))
    if os.path.isdir(tilesdir):
      fstat=os.stat(chartEntry.filename)
      ld("filestat",chartEntry.filename,fstat)
      dstat=os.stat(tilesdir)
      ld("dirstat",tilesdir,dstat)
      if (fstat.st_mtime <= dstat.st_mtime):
        marker=os.path.join(tdir,"tilemap.xml") #this should have been created by gdal_tiler
        if os.path.exists(marker):
          st=os.stat(marker)
          if st.st_mtime >= dstat.st_mtime:
            log("basetiles dir "+tilesdir+" is up to date, no need to regenerate")
            return
      log(" removing old dir "+tilesdir)
      shutil.rmtree(tilesdir,True)
  opath=getTilesDir(chartEntry,outdir,True)
  args=[sys.executable,os.path.join(TilerTools,"gdal_tiler.py"),"-c","-t",opath,"-p","zxy","-z",str(chartEntry.getBaseZoomLevel())]
  if options.verbose == 2:
    args.append("-d")
  args.append(chartEntry.filename)
  log("running "+" ".join(args))
  ld("gdal_tiler args:",args)
  if subprocess.call(args) != 0:
    raise Exception("unable to convert chart "+chartEntry.filename)

#-------------------------------------
#create the base tiles from the chartlist
def generateAllBaseTiles(outdir,mercator):
  chartlist=readChartList(outdir,mercator)
  ld("chartlist read:",str(chartlist))
  log("layers:"+str(layer_zoom_levels))
  for chartEntry in chartlist.tlist:
    log("creating base tiles for "+chartEntry.filename+" at zoom level "+str(chartEntry.getBaseZoomLevel()))
    generateBaseTiles(chartEntry,outdir)
    log("creating base tiles for "+chartEntry.filename+" finished")


#-------------------------------------
#merge the tiles for a layer
#first build the pyramid of tile ids for all zoom layers
#then for each top level tile (lowest zoom) build all tiles below in one run
#all of them are first loaded into memory and afterwards both saved and merged
def mergeLayerTiles(chartlist,outdir,layer,onlyOverview=False):
  maxfiletime=None
  layername=layer_zoom_levels[layer][1]
  layerminzoom=layer_zoom_levels[layer][0]
  #layers are now sorted reverse...??
  if layer < (len(layer_zoom_levels) -1):
    layerminzoom=layer_zoom_levels[layer+1][0]
  if MAXOVERLAP > 0:
    layerminzoom -=MAXOVERLAP
  if layerminzoom < 1:
    layerminzoom=1
  layercharts=chartlist.filterByLayer(layer)
  layerulx,layeruly,layerlrx,layerlry=layercharts.getChartsBoundingBox()
  ulc_x,ulc_y=layercharts.mercator.transform_point((layerulx,layeruly))
  lrc_x,lrc_y=layercharts.mercator.transform_point((layerlrx,layerlry))
  if layer == (len(layer_zoom_levels)-1):
    #for the layer with the lowest resolution select a minzoom
    #to fit app. into 600px
    xw=lrc_x-ulc_x
    yw=ulc_y-lrc_y
    while layerminzoom > 0:
      mpp=layercharts.mercator.mppForZoom(layerminzoom)
      xpix=xw/mpp
      ypix=yw/mpp
      if xpix < MINZOOMPIXEL or ypix < MINZOOMPIXEL:
        break
      layerminzoom-=1
  layermaxzoom=layer_zoom_levels[layer][0]
  log("collecting base tiles for layer "+str(layer)+" ("+layername+") minzoom="+str(layerminzoom)+", maxzoom="+str(layermaxzoom))
  layerxmlfile=os.path.join(outdir,OUTTILES,layername,LAYERFILE)
  layerboundingsfile=os.path.join(outdir,OUTTILES,layername,LAYERBOUNDING)
  
  layerdir=os.path.join(outdir,OUTTILES,layername)
  if not onlyOverview:
    if options.update == 1:
      for lc in layercharts.tlist:
        if os.path.exists(lc.filename):
          st=os.stat(lc.filename)
          if maxfiletime is None or st.st_mtime > maxfiletime:
            maxfiletime=st.st_mtime
            ld("setting maxtime ",lc.filename,maxfiletime)
      st=os.stat(os.path.join(outdir,LISTFILE))
      if st.st_mtime > maxfiletime:
        maxfiletime=st.st_mtime
      ld("maxfiletime",maxfiletime)
      if os.path.exists(layerxmlfile):
        st=os.stat(layerxmlfile)
        if st.st_mtime >= maxfiletime:
          log("layerinfo "+layerxmlfile+" is newer then all files from layer, skip generation")
          return (layerminzoom,layermaxzoom)
    else:
      if os.path.exists(layerdir):
        log("deleting old layerdata "+layerdir)
        shutil.rmtree(layerdir,True)
    if len(layercharts.tlist) == 0:
      log("layer "+layername+" has no tiles")
      return (layerminzoom,layermaxzoom)
    #TODO: skip if we have no charts at all
    #collect the tiles for the max zoom level
    tilespyramid=[]
    layermaxzoomtiles=layercharts.getTilesSet(layermaxzoom)
    #compute the upper level tiles
    layerztiles=layermaxzoomtiles
    idx=0
    tilespyramid.append(layerztiles)
    numalltiles=len(layerztiles)
    requestQueue=Queue.Queue(0)
    for x in range(int(options.threads)):
      t=PyramidHandler(requestQueue)
      t.setDaemon(True)
      t.start()
    for currentZoom in range(layermaxzoom-1,layerminzoom-1,-1):
      idx+=1
      layerztiles=getLowerLevelTiles(layerztiles)
      numalltiles+=len(layerztiles)
      tilespyramid.append(layerztiles)
    #in tlespyramid we now have all tiles for the layer min. zoom at index idx, maxZoom at index 0
    #now go top down
    #always take one tile of the highest layer and completely compute all tiles for this one
    numminzoom=len(tilespyramid[idx])
    numdone=0
    percent=-1
    numjobs=0
    log("handling "+str(numminzoom)+" pyramids on min zoom "+str(layerminzoom)+" (having: "+str(numalltiles)+" tiles)")
    for topleveltile in tilespyramid[idx]:
      ld("handling toplevel tile ",topleveltile)
      
      buildpyramid=BuildPyramid(layercharts,layername,outdir)
      buildpyramid.addZoomLevelTiles(set([topleveltile]))
      numtiles=1
      for buildidx in range(1,idx+1):
        nextlevel=set()
        for tile in buildpyramid.getZoomLevelTiles(buildidx-1):
          nextlevel.update(getUpperTiles(tile))
        buildpyramid.addZoomLevelTiles(nextlevel & tilespyramid[idx-buildidx])
        numtiles+=len(buildpyramid.getZoomLevelTiles(buildidx))
      ld("handling buildpyramid of len",numtiles)
      requestQueue.put(buildpyramid)
      numjobs+=1
      
    log("waiting for generators with "+str(options.threads)+" threads")
    while not requestQueue.empty():
      npercent=int(requestQueue.qsize()*100/numjobs)
      if npercent != percent and options.verbose != 0:
        percent=npercent
        sys.stdout.write("\r%2d%%" % percent)
        sys.stdout.flush()
      time.sleep(0.05)
    if options.verbose != 0:
      print
    log("all merge jobs started for layer "+layername+", waiting for background threads to finish their jobs")
    requestQueue.join()
    log("tile merge finished for layer "+layername)
  #writing layer.xml
  order=0
  tilesets=""
  for zoom in range(layerminzoom,layermaxzoom+1):
    tilesets=tilesets+(layer_tileset_xml % {
                 "href":str(zoom),
                 "units_per_pixel":chartlist.mercator.mppForZoom(zoom),
                 "order":order   
                                        })
    order+=1
  outstr=layer_xml % {"title":layername,
                      "description":layername,
                      "minlon":layerulx,
                      "minlat":layerlry,
                      "maxlon":layerlrx,
                      "maxlat":layeruly,
                      "tile_width":TILESIZE,
                      "tile_height":TILESIZE,
                      "tile_ext":"png",
                      "tile_mime":"x-png",
                      "tilesets":tilesets}
  
  with open(layerxmlfile,"w") as f:
    f.write(outstr)
  log(layerxmlfile+" written")
  return (layerminzoom,layermaxzoom)
  
#merge the already created base tiles
#-------------------------------------
def mergeAllTiles(outdir,mercator,onlyOverview=False):
  chartlist=readChartList(outdir,mercator)
  ld("chartlist read:",str(chartlist))
  log("layers:"+str(layer_zoom_levels))
  #find the bounding box
  minlayer,maxlayer=chartlist.getMinMaxLayer()
  minzoom=layer_zoom_levels[minlayer][0]
  maxzoom=layer_zoom_levels[maxlayer][0]
  ld("minzoom",minzoom,"maxzoom",maxzoom)
  layerminmax={}
  for layer in range(minlayer,maxlayer+1):
    layerminmax[layer]=mergeLayerTiles(chartlist, outdir, layer,onlyOverview)   
    log("tile merge completely finished")
  overviewfname=os.path.join(outdir,OUTTILES,OVERVIEW)
  tilemaps=""
  for layer in range(minlayer,maxlayer+1):
    layername=layer_zoom_levels[layer][1]
    layercharts=chartlist.filterByLayer(layer)
    boundings=""
    for ce in layercharts.tlist:
      boundings+=createBoundingsXml(ce.bounds, ce.title)
    boundstr=boundings_xml % {"boundings": boundings}
    tilemaps+=overview_tilemap_xml % {
              "profile": "zxy-mercator",
              "title":layername,
              "url":layername,
              "minZoom":layerminmax[layer][0],
              "maxZoom":layerminmax[layer][1],
              "bounding":createBoundingsXml(layercharts.getChartsBoundingBox(), layername),
              "layerboundings":boundstr,
              "tile_width":TILESIZE,
              "tile_height":TILESIZE,
              "tile_ext":"png",
              "tile_mime":"x-png",
              }
  overviewstr=overview_xml % {
              "tilemaps":tilemaps,
              "bounding":createBoundingsXml(chartlist.getChartsBoundingBox(), "avnav")
                              }
  with open(overviewfname,"w") as f:
    f.write(overviewstr)
  log(overviewfname+" written, successfully finished")
  
        
 
def main(argv):
  
  global LISTFILE,layer_zoom_levels,options,MAXUPSCALE,TilerTools,MAXOVERLAP
  usage="usage: %prog <options> outdir indir|infile..."
  parser = OptionParser(
        usage = usage,
        version="1.0",
        description='read gdal compatible raster maps for tile creation')
  parser.add_option("-q", "--quiet", action="store_const", 
        const=0, default=1, dest="verbose")
  parser.add_option("-d", "--debug", action="store_const", 
        const=2, dest="verbose")
  parser.add_option("-c", "--chartlist", dest="chartlist", help="filename of the chartlist file in outdir")
  parser.add_option("-m", "--mode", dest="mode", help="runmode, one of chartlist|generate|merge, default depends on parameters")
  parser.add_option("-l", "--layers", dest="layers", help="list of layers layer:title,layer:title,..., default=%s" % ",".join(["%d:%s" % (lz[0],lz[1]) for lz in layer_zoom_levels]))
  parser.add_option("-s", "--scale", dest="upscale", help="max upscaling when sorting a chart into the layers (default: %f)" % MAXUPSCALE)
  parser.add_option("-o", "--overlap", dest="overlap", help="max overlap of zoomlevels between layers (default: %f)" % MAXOVERLAP)
  parser.add_option("-t", "--threads", dest="threads", help="number of worker threads, default 4")
  parser.add_option("-a", "--add", dest="ttdir", help="directory where to search for tiler tools (if not set use environment TILERTOOLS or current dir)")
  parser.add_option("-n", "--opencpn", dest="opencpn", help="directory where opencpn is installed (if used for conversion) (if not set use environment OPENCPN)")
  parser.add_option("-u", "--update", action="store_const", const=1, dest="update", help="update existing charts (if not set, existing ones are regenerated")
  (options, args) = parser.parse_args(argv[1:])
  logging.basicConfig(level=logging.DEBUG if options.verbose==2 else 
      (logging.ERROR if options.verbose==0 else logging.INFO))
  if options.threads is None:
    options.threads=4
  if options.chartlist is not None:
    LISTFILE=options.chartlist
    ld("chartlist",LISTFILE)
  if options.layers is not None:
    lz=options.layers.split(",")
    layer_zoom_levels=[]
    for lze in lz:
      zoom,text=lze.split(":")
      assert zoom is not None,"invalid layer "+lze
      assert text is not None,"invalid layer "+lze
      layer_zoom_levels.append((int(zoom),text))
  if options.upscale is not None:
    MAXUPSCALE=float(options.upscale)
    ld("upscale ",MAXUPSCALE)
  if options.overlap is not None:
    MAXOVERLAP=int(options.overlap)
    ld("upscale ",MAXOVERLAP)

  ld(os.name)
  ld(options)
  if (len(args) < 1):
    print usage
    sys.exit(1)
  TilerTools=findTilerTools(options.ttdir)
  mercator=Mercator()
  outdir=args.pop(0)
  ld("outdir",outdir)
  mode="generate"
  if len(args) > 0 :
    mode="chartlist"
  if options.mode is not None:
    mode=options.mode
    assert (mode == "chartlist" or mode == "generate" or mode == "all" or mode == "merge" or mode == "overview" or mode == "base"), "invalid mode "+mode+", allowed: chartlist,generate,merge,all,overview,base"
  log("running in mode "+mode)
  if mode == "chartlist" or mode == "all":
    log("layers:"+str(layer_zoom_levels))
  if mode == "chartlist"  or mode == "all":
    basetiles=os.path.join(outdir,BASETILES)
    if not os.path.isdir(basetiles):
      os.makedirs(basetiles, 0777)
    createChartList(args,outdir,mercator)
  if mode == "generate" or mode == "all" or mode == "base":
    assert os.path.isdir(outdir),"the directory "+outdir+" does not exist, run mode chartlist before"
    generateAllBaseTiles(outdir,mercator)
  if mode == "merge" or mode == "all" or mode == "generate" or mode == "overview":
    assert os.path.isdir(outdir),"the directory "+outdir+" does not exist, run mode chartlist before"
    mergeAllTiles(outdir,mercator,(mode == "overview"))



if __name__ == "__main__":
    main(sys.argv)
