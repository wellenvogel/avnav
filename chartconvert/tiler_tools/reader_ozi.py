#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-06-16 18:16:32 

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

###############################################################################

# Helper functions for class OziCartesianRefPoints

###############################################################################

def bng_ofs(square_id,scale,relative_sq=None):
    'converts British/Irish Grid square letter to offset pair in squares: V -> (0,0)'
    sq_idx='ABCDEFGHJKLMNOPQRSTUVWXYZ'.find(square_id) # 'I' skipped
    assert sq_idx >= 0
    ofs = [(sq_idx % 5)*scale, (4 - (sq_idx // 5))*scale]
    if relative_sq:
        rel_ofs=bng_ofs(relative_sq,scale)
        ofs[0]-=rel_ofs[0]
        ofs[1]-=rel_ofs[1]
    return ofs

def bng2coord(grid_coord,zone,hemisphere):
    '(BNG) British National Grid'
    assert len(zone) == 2
    return reduce(lambda x,y: (x[0]+y[0],x[1]+y[1]),[
                grid_coord,
                bng_ofs(zone[0],5*100000,'S'),
                bng_ofs(zone[1],100000)
                ])

def ig2coord(grid_coord,zone,hemisphere):
    '(IG) Irish Grid'
    assert len(zone) == 1
    return reduce(lambda x,y: (x[0]+y[0],x[1]+y[1]),[
                grid_coord,
                bng_ofs(zone,100000)
                ])

def utm2coord(grid_coord,zone,hemisphere):
    '(UTM) Universal Transverse Mercator'
    return (grid_coord[0] - 500000, 
            grid_coord[1] - (0 if hemisphere.upper() == 'N' else 10000000))    
    
grid_map={
    '(BNG) British National Grid': bng2coord,
    '(IG) Irish Grid': ig2coord,
    '(UTM) Universal Transverse Mercator': utm2coord,
}

###############################################################################

class OziCartesianRefPoints(RefPoints):

###############################################################################
    def __init__(self,owner,ref_lst):
        super(OziCartesianRefPoints,self).__init__(
            owner,
            **dict(zip(
                ['ids','pixels','cartesian','zone','hemisphere'],
                self.transpose(ref_lst)[:5]))
            )

    def grid2coord(self):
        try:
            conv2cartesian=grid_map[self.owner.get_proj_id()]
        except KeyError:
            return self.cartesian
        res=[]
        for grid_data in zip(self.cartesian,self.zone,self.hemisphere):
            res.append(conv2cartesian(*grid_data))
        return res        

###############################################################################

class OziMap(SrcMap):

###############################################################################
    magic='OziExplorer Map Data File'
    data_file='reader_ozi_data.csv'

    proj_parms=(
        '+lat_0=', # 1. Latitude Origin
        '+lon_0=', # 2. Longitude Origin
        '+k=',     # 3. K Factor
        '+x_0=',   # 4. False Easting
        '+y_0=',   # 5. False Northing
        '+lat_1=', # 6. Latitude 1
        '+lat_2=', # 7. Latitude 2
        '+h=',     # 8. Height - used in the Vertical Near-Sided Perspective Projection
                   # 9. Sat - not used
                   #10. Path - not used
        )
        
    def load_data(self):
        'load datum definitions, ellipses, projections from a file'
        self.datum_dict={}
        self.ellps_dict={}
        self.proj_dict={}
        csv_map={
            'datum': (self.datum_dict,self.ini_lst),
            'ellps': (self.ellps_dict,self.ini_lst),
            'proj': (self.proj_dict,self.ini_lst),
            }
        self.load_csv(self.data_file,csv_map)

    def get_header(self): 
        'read map header'
        with open(self.file, 'rU') as f:
            lines=f.readlines() # non-Unicode!
        if not (lines and lines[0].startswith('OziExplorer Map Data File')): 
            raise Exception(" Invalid file: %s" % self.map_file)
        hdr=[[l.strip()] for l in lines[:3]] + [[i.strip() for i in l.split(',')] for l in lines[3:]]
        ld(hdr)
        return hdr

    def get_layers(self):
        return [OziLayer(self,self.header)]
# OziMap

class OziLayer(SrcLayer):

    def hdr_parms(self, patt): 
        'filter header for params starting with "patt"'
        return [i for i in self.data if i[0].startswith(patt)]

    def get_refs(self):
        'get a list of geo refs in tuples'
        points=[i for i in self.hdr_parms('Point') if len(i) > 5 and i[4] == 'in' and i[2] != ''] # Get a list of geo refs
        if points[0][14] != '': # refs are cartesian
            refs=OziCartesianRefPoints(self,[(
                    i[0],                               # id
                    (int(i[2]),int(i[3])),              # pixel
                    (float(i[14]),float(i[15])),        # cartesian coords
                    i[13],i[16],                        # zone, hemisphere
                    ) for i in points],
                )
        else:
            refs=LatLonRefPoints(self,[(
                i[0],                                   # id
                (int(i[2]),int(i[3])),                  # pixel
                (dms2dec(*i[9:12]), dms2dec(*i[6:9])),  # lat/long
                ) for i in points])
        return refs

    def get_plys(self):
        'boundary polygon'
        ply_pix=[(int(i[2]),int(i[3])) for i in self.hdr_parms('MMPXY')]    # Moving Map border pixels
        ply_ll=[(float(i[2]),float(i[3])) for i in self.hdr_parms('MMPLL')] # Moving Map border lat,lon
        ids=[i[0] for i in self.hdr_parms('MMPXY')]    # Moving Map border pixels
        if (ply_pix and ply_ll):
            plys=RefPoints(self,ids=ids,pixels=ply_pix,latlong=ply_ll)
        else:
            plys=None
        return plys

    def get_dtm(self):
        'get DTM northing, easting'
        dtm=[float(s)/3600 for s in self.data[4][2:4]]
        return dtm if dtm != [0,0] else None

    def get_proj_id(self):
        return self.hdr_parms('Map Projection')[0][1]
    
    def get_proj(self):
        proj_id=self.get_proj_id()
        parm_lst=self.hdr_parms('Projection Setup')[0]
        try:
            proj=self.map.proj_dict[proj_id][0:1]
        except KeyError: 
            raise Exception("*** Unsupported projection (%s)" % proj_id)
        if '+proj=' in proj[0]: # overwise assume it already has a full data defined
            # get projection parameters
            if self.get_proj_id() == '(UTM) Universal Transverse Mercator':
                assert '+proj=tmerc' in proj[0]
                if self.refs.cartesian:
                    zone=int(self.refs.zone[0])
                else:
                    zone=(self.refs.latlong[0][0]+180) // 6 + 1
                proj.append('+lon_0=%i' % ((zone - 1) * 6 + 3 - 180))
            else:
                proj.extend([ i[0]+i[1] for i in zip(self.map.proj_parms,parm_lst[1:]) 
                                if i[1].translate(None,'0.')])
        return proj

    def get_datum_id(self):
        return self.data[4][0]

    def get_datum(self):
        datum_id=self.get_datum_id()
        try:
            datum_def=self.map.datum_dict[datum_id]
            if datum_def[5]: # PROJ4 datum defined ?
                datum=[datum_def[5]]
            else:
                datum=['+towgs84=%s,%s,%s' % tuple(datum_def[2:5])]               
                ellps_id=datum_def[1]
                ellps_def=self.map.ellps_dict[ellps_id]
                ellps=if_set(ellps_def[2])
                if ellps:
                    datum.append(ellps)
                else:
                    datum.append('+a=%s',ellps_def[0])
                    datum.append('+rf=%s',ellps_def[1])                        
        except KeyError: 
            raise Exception("*** Unsupported datum (%s)" % datum_id)
        return datum

    try_encodings=(locale.getpreferredencoding(),'utf_8','cp1251','cp1252')

    def get_raster(self):
        img_path=self.data[2][0]
        img_path_slashed=img_path.replace('\\','/') # get rid of windows separators
        img_path_lst=os.path.split(img_path_slashed)
        img_fname=img_path_lst[-1]

        map_dir,map_fname=os.path.split(self.map.file)
        dir_lst=os.listdir(map_dir if map_dir else u'.')

        # try a few encodings
        for enc in self.try_encodings:
            name_patt=img_fname.decode(enc,'ignore').lower()
            match=[i for i in dir_lst if i.lower() == name_patt]
            if match:
                fn=match[0]
                ld(map_dir, fn)
                img_file=os.path.join(map_dir, fn)
                break
        else:
            raise Exception("*** Image file not found: %s" % img_path)
        return img_file

    def get_name(self):
        ozi_name=self.data[1][0]
        # guess .map file encoding
        for enc in self.try_encodings:
            try:
                if enc == 'cp1251' and any([ # ascii chars ?
                        ((c >= '\x41') and (c <= '\x5A')) or 
                        ((c >= '\x61') and (c <= '\x7A')) 
                            for c in ozi_name]):
                    continue # cp1251 name shouldn't have any ascii
                ozi_name=ozi_name.decode(enc)
                break
            except:
                pass
        ld('ozi_name',ozi_name)
        return ozi_name

# OziLayer

###############################################################################

if __name__=='__main__':

    print('\nPlease use convert2gdal.py\n')
    sys.exit(1)

