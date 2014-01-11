#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-04-11 10:58:17  

###############################################################################
# Copyright (c) 2010, Vadim Shlyakhov
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

from __future__ import with_statement

import os
import logging
import math

from optparse import OptionParser

from tiler_functions import *
from reader_backend import *

def kml_parm(hdr,name,lst=False):
    l=re.split('</?%s>' % name,hdr)
    # return only even elements as they are inside <name> </name> 
    return [i.strip() for i in l[1::2]] if lst else l[1].strip()

class KmlMap(SrcMap):
    magic='<kml xmlns'

    def load_data(self):
        'load datum definitions, ellipses, projections from a file'

        # http://trac.osgeo.org/proj/wiki/FAQ#ChangingEllipsoidWhycantIconvertfromWGS84toGoogleEarthVirtualGlobeMercator
        self.proj="+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs"
        
    def get_header(self): 
        'read map header'
        header=[]
        with open(self.file,'rU') as f:
            header=f.read().decode('utf-8','ignore')
        if '<GroundOverlay>' not in header: 
            raise Exception(" Invalid file: %s" % self.file)
        return header
        
    def get_layers(self):
        for layer_data in kml_parm(self.header,'GroundOverlay', lst=True): # get list of <GroundOverlay> content
            yield KmlLayer(self,layer_data)
# KmlMap

class KmlLayer(SrcLayer):

    def get_refs(self):
        'get a list of geo refs in tuples'

        layer=self.data
        
        if '<gx:LatLonQuad>' in layer:
            src_refs=[map(float,i.split(',')) for i in kml_parm(layer,'coordinates').split()]
        else: # assume LatLonBox
            assert '<LatLonBox>' in layer
            north,south,east,west=[float(kml_parm(layer,parm)) for parm in ('north','south','east','west')]
            src_refs=[(west,south),(east,south),(east,north),(west,north)]

        dst_refs=MyTransformer(SRC_SRS=proj_cs2geog_cs(self.map.proj),DST_SRS=self.map.proj).transform(src_refs)
        if '<rotation>' in layer:
            north,south,east,west=[float(dst_refs[i][j]) for i,j in ((2,1),(0,1),(1,0),(0,0))]
            angle=math.radians(float(kml_parm(layer,'rotation')))
            dx=east-west
            dy=north-south
            xc=(west +east )/2
            yc=(south+north)/2
            x1=dy*math.sin(angle)
            x2=dx*math.cos(angle)
            y1=dy*math.cos(angle)
            y2=dx*math.sin(angle)
            x0=xc-(x1+x2)/2
            y0=yc-(y1+y2)/2
            dst_refs=[(x0+x1,y0),(x0+x1+x2,y0+y2),(x0+x2,y0+y1+y2),(x0,y0+y1)]
        ld(dst_refs)

        w, h=(self.raster_ds.RasterXSize,self.raster_ds.RasterYSize)
        ld('w, h',w, h)
        corners=[(0,h),(w,h),(w,0),(0,0)]
        ids=[str(i+1) for i in range(4)]

        refs=RefPoints(self,
            ids=[str(i+1) for i in range(4)],
            pixels=[(0,h),(w,h),(w,0),(0,0)],
            cartesian=dst_refs)
        return refs

    def get_plys(self):
        'boundary polygon'

        mpointlst=shape2mpointlst(self.map.file,self.map.proj,self.name)
        if not mpointlst:
            return None
            
        plys=RefPoints(self,cartesian=mpointlst[0])
        return plys

    def get_srs(self):
        return self.map.proj, None

    def get_raster(self):
        img_ref=kml_parm(self.data,'href')
        map_dir=os.path.split(self.map.file)[0]
        if not map_dir:
            map_dir=u'.'

        imp_path_slashed=img_ref.replace('\\','/') # replace windows slashes
        imp_path_lst=imp_path_slashed.split('/')
        img_patt=imp_path_lst[-1].lower()
        match=[i for i in os.listdir(map_dir) if i.lower() == img_patt]
        try:
            return os.path.join(map_dir, match[0])
        except IndexError: raise Exception("*** Image file not found: %s" % img_path)
        
    def get_name(self):
        return kml_parm(self.data,'name')

# KmlLayer

if __name__=='__main__':
    print('\nPlease use convert2gdal.py\n')
    sys.exit(1)

