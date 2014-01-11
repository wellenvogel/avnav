#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-03-01 16:32:36 

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
import locale

from optparse import OptionParser

from tiler_functions import *
from reader_backend import *

class GeoNosMap(SrcMap):
    magic='[MainChart]'
    data_file='reader_geo_data.csv'
    
    def load_data(self):
        'load datum definitions, ellipses, projections from a file'
        self.datum_dict={}
        self.proj_dict={}
        csv_map={
            'datum': (self.datum_dict,self.ini_lst),
            'proj': (self.proj_dict,self.ini_lst),
            }
        self.load_csv(self.data_file,csv_map)

    def get_header(self): 
        'read map header'
        with open(self.file, 'rU') as f:
            hdr=[[i.strip() for i in l.decode('iso8859-1','ignore').split('=')] for l in f]
        if not (hdr and hdr[0][0] == '[MainChart]'): 
            raise Exception(" Invalid file: %s" % self.file)
        ld(hdr)
        return hdr

    def get_layers(self):
        return [GeoNosLayer(self,self.header)]
#GeoNosMap

class GeoNosLayer(SrcLayer):

    def hdr_parms(self, patt): 
        'filter header for params starting with "patt"'
        plen=len(patt)
        return [('%s %s' % (i[0][plen:],i[1]) if len(i[0]) > plen else i[1])
                    for i in self.data if i[0].startswith(patt)]

    def hdr_parms2list(self, patt):
        return [s.split() for s in self.hdr_parms(patt)]
        
    def get_dtm(self):
        'get DTM northing, easting'
        dtm_parm=self.options.dtm_shift
        denominator=3600 # seconds if options.dtm_shift
        if dtm_parm is None:
            denominator=1 # degrees otherwise
            try:
                dtm_parm=[self.hdr_parms(i)[0] for i in ('Longitude Offset','Latitude Offset')]
                ld('DTM',dtm_parm)
            except IndexError: # DTM not found
                ld('DTM not found')
                dtm_parm=[0,0]
        dtm=[float(s)/denominator for s in dtm_parm]
        return dtm if dtm != [0,0] else None

    def get_refs(self):
        'get a list of geo refs in tuples'
        refs=LatLonRefPoints(self,[(
            i[0],                                   # id
            (int(i[4]),int(i[3])),                  # pixel
            (float(i[1]),float(i[2]))               # lat/long
            ) for i in self.hdr_parms2list('Point')])
        return refs

    def get_plys(self):
        'boundary polygon'
        plys=RefPoints(self,latlong=[
                (float(i[2]),float(i[1]))           # lat/long
            for i in self.hdr_parms2list('Vertex')])
        return plys

    def get_proj_id(self):
        return self.hdr_parms('Projection')[0]
        
    def get_proj(self):
        proj_id=self.get_proj_id()
        try:
            proj=[self.map.proj_dict[proj_id][0]]
        except KeyError: 
            raise Exception("*** Unsupported projection (%s)" % proj_id)
        return proj

    def get_datum_id(self):
        return self.hdr_parms('Datum')[0]

    def get_datum(self):
        datum_id=self.get_datum_id()
        try:
            datum=self.map.datum_dict[datum_id][0]
        except KeyError: 
            dtm=self.get_dtm() # get northing, easting to WGS84 if any
            datum='+datum=WGS84'
            if dtm: 
                logging.warning(' Unknown datum %s, trying WGS 84 with DTM shifts' % datum_id)
            else: # assume DTM is 0,0
                logging.warning(' Unknown datum %s, trying WGS 84' % datum_id)
        return datum.split(' ')

    def get_raster(self):
        name_patt=self.hdr_parms('Bitmap')[0].lower()
        map_dir,map_fname=os.path.split(self.map.file)
        dir_lst=os.listdir(map_dir if map_dir else u'.')
        match=[i for i in dir_lst if i.lower() == name_patt]
        try:
            fn=match[0]
            ld(map_dir, fn)
            img_file=os.path.join(map_dir, fn)
        except:
            raise Exception("*** Image file not found: %s" % img_path)
        return img_file

    def get_size(self):
        with open(self.img_file) as img:
            hdr=img.readline()
        assert hdr.startswith('NOS/')
        patt='RA='
        sz=hdr[hdr.index(patt)+len(patt):].split(',')[2:4]
        return map(int,sz)

    def get_name(self):
        return self.hdr_parms('Name')[0]

# GeoNosLayer

if __name__=='__main__':

    print('\nPlease use convert2gdal.py\n')
    sys.exit(1)

