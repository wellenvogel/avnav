#!/usr/bin/env python
# -*- coding: utf-8 -*-

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

from __future__ import with_statement

import os
import logging
import locale
import csv

from tiler_functions import *

try:
    from osgeo import gdal
    from osgeo import osr
    from osgeo.gdalconst import *
    gdal.TermProgress = gdal.TermProgress_nocb
except ImportError:
    import osr
    import gdal
    from gdalconst import *

def dms2dec(degs='0',mins='0',ne='E',sec='0'):
    return (float(degs)+float(mins)/60+float(sec)/3600)*(-1 if ne in ('W','S') else 1 )

def dst_path(src,dst_dir,ext='',template='%s'):
    src_dir,src_file=os.path.split(src)
    base,sext=os.path.splitext(src_file)
    dest=(template % base)+ext
    if not dst_dir:
        dst_dir=src_dir
    if dst_dir:
        dest='%s/%s' % (dst_dir,dest)
    ld('base',base,'dest',dest,'src',src)
    return dest

class Opt(object):
    def __init__(self,**dictionary):
        self.dict=dictionary
    def __getattr__(self, name):
        return self.dict.setdefault(name,None)

###############################################################################

class RefPoints(object):
    'source geo-reference points and polygons'

###############################################################################
    @staticmethod
    def transpose(ref_lst): # helper function for children classes
        return [list(i) for i in zip(*ref_lst)]
    
    def __init__(self,owner,
            ids=None,pixels=None,latlong=None,cartesian=None,zone=None,hemisphere=None):
        self.owner=owner
        self.ids=ids
        self.pixels=pixels
        self.latlong=latlong
        self.cartesian=cartesian
        self.zone=zone
        self.hemisphere=hemisphere

        ld('RefPoints',self.__dict__)

        nrefs=len(filter(None,(self.pixels,self.latlong,self.cartesian))[0])
        if not self.ids:
            self.ids=map(str,range(1,nrefs+1))

        if nrefs == 2:
            logging.warning(' Only 2 reference points: assuming the chart is north alligned')
            self.ids += ['Extra03','Extra04']
            for i in filter(None,(self.pixels,self.latlong,self.cartesian,self.zone,self.hemisphere)):
                try: # list of coordinates? -- swap x and y between them
                    i.append((i[0][0],i[1][1]))
                    i.append((i[1][0],i[0][1]))
                except IndexError: # just copy them
                    i.append(i[0])
                    i.append(i[1])
            ld('RefPoints extra',self.__dict__)

        self.ids=[s.encode('utf-8') for s in self.ids]

    def srs(self):
        return self.owner.srs

    def __iter__(self):
        for i in zip(self.ids,self.pix_coords(),self.proj_coords()):
            yield i
    
    def pix_coords(self,dataset=None):
        if self.pixels:
            return self.pixels
        p_dst=self.proj_coords()
        ld(p_dst)
        pix_tr=MyTransformer(dataset,METHOD='GCP_TPS')
        p_pix=pix_tr.transform(p_dst,inv=True)
        ld(p_pix)
        return [(p[0],p[1]) for p in p_pix]

    def grid2coord(self): # to re-implemented by children if applicable
        return self.cartesian
        
    def proj_coords(self):
        if self.cartesian:
            return self.grid2coord()
        dtm=self.owner.dtm
        if not dtm:
            dtm=[0,0]
        latlong=[(lon+dtm[0],lat+dtm[1]) for lon,lat in self.latlong]
        srs_tr=MyTransformer(SRC_SRS=proj_cs2geog_cs(self.owner.srs),DST_SRS=self.owner.srs)
        coords=srs_tr.transform(latlong)
        return coords

    def over_180(self):
        if not self.cartesian: # refs are lat/long
            leftmost=min(zip(self.pixels,self.latlong),key=lambda r: r[0][0])
            rightmost=max(zip(self.pixels,self.latlong),key=lambda r: r[0][0])
            ld('leftmost',leftmost,'rightmost',rightmost)
            if leftmost[1][0] > rightmost[1][0]:
                return leftmost[1][0]
        return None

###############################################################################

class LatLonRefPoints(RefPoints):
    'geo-reference points with geodetic coordinates initialised with a sigle list'

###############################################################################
    def __init__(self,owner,ref_lst):
        super(LatLonRefPoints,self).__init__(
            owner,
            **dict(zip(
                ['ids','pixels','latlong'],
                self.transpose(ref_lst)[:3]))
            )

###############################################################################

class SrcMap(object):

###############################################################################
    def __init__(self,src_file,options=None):
        self.options=options
        gdal.UseExceptions()

        self.load_data() # load datum definitions, ellipses, projections
        self.file=src_file.decode(locale.getpreferredencoding(),'ignore')
        self.header=self.get_header()       # Read map header

    def load_csv(self,csv_file,csv_map):
        'load datum definitions, ellipses, projections from a file'
        csv.register_dialect('strip', skipinitialspace=True)
        with open(os.path.join(data_dir(),csv_file),'rb') as data_f:
            data_csv=csv.reader(data_f,'strip')
            for row in data_csv:
                row=[s.decode('utf-8') for s in row]
                #ld(row)
                try:
                    dct,unpack=csv_map[row[0]]
                    unpack(dct,row)
                except IndexError:
                    pass
                except KeyError:
                    pass
        for dct,func in csv_map.values():
            ld(dct)

    def ini_lst(self,dct,row):
        dct[row[1]]=row[2:]

    def ini_map(self,dct,row):
        dct[row[1]]=dict((i.split(':',1) for i in row[2:] if ':' in i))

#    def get_layers(self):
#        pass

###############################################################################

class SrcLayer(object):

###############################################################################

    def __init__(self,src_map,data):
        self.map=src_map
        self.data=data
        self.name=self.get_name()

        self.img_file=self.get_raster()
        logging.info(' %s : %s (%s)' % (self.map.file,self.name,self.img_file))
        self.raster_ds = gdal.Open(self.img_file.encode(locale.getpreferredencoding()),GA_ReadOnly)
        
        self.dtm=None
        self.refs=self.get_refs()           # fetch reference points
        self.srs,self.dtm=self.get_srs()    # estimate SRS
        
    def __del__(self):
        del self.raster_ds

    def get_srs(self): # redefined in reader_kml.py
        'returns srs for the map, and DTM shifts if any'
        options=self.map.options
        if options.srs:
            return(options.srs,None)
        dtm=None
        proj4=[]
        logging.info(' %s, %s' % (self.get_datum_id(),self.get_proj_id()))
        
        # compute chart's projection
        if options.proj:
            proj4.append(options.proj)
        else:
            proj4=self.get_proj()

        # setup a central meridian artificialy to allow charts crossing meridian 180
        leftmost=self.refs.over_180()
        if leftmost and '+lon_0=' not in proj4[0]:
            proj4.append(' +lon_0=%i' % int(leftmost))
        
        # compute chart's datum
        if options.datum: 
            proj4.append(options.datum)
        elif options.force_dtm or options.dtm_shift:
            dtm=self.get_dtm() # get northing, easting to WGS84 if any
            proj4.append('+datum=WGS84')
        elif not '+proj=' in proj4[0]: 
            pass # assume datum is defined already
        else:
            datum=self.get_datum()
            proj4.extend(datum)
        proj4.extend(['+nodefs']) # '+wktext',
        ld('proj4',proj4)
        return ' '.join(proj4).encode('utf-8'),dtm

    def convert(self,dest=None):
        options=self.map.options
        
        if dest:
            base=os.path.split(dest)[0]
        else:
            if options.after_name:
                name_patt=self.name
            elif options.after_map:
                name_patt=self.map.file
            else:
                name_patt=self.img_file
            base=dst_path(name_patt,options.dst_dir)
            if options.long_name:
                base+=' - ' +  "".join([c for c in self.name 
                                    if c .isalpha() or c.isdigit() or c in '-_.() '])
        dst_dir=os.path.split(base)[0]
        out_format='VRT'
        ext='.'+out_format.lower()
        dst_file= os.path.basename(base+ext) # output file

        try:
            start_dir=os.getcwd()
            if dst_dir:
                os.chdir(dst_dir)

            dst_drv = gdal.GetDriverByName(out_format)
            dst_ds = dst_drv.CreateCopy(dst_file.encode(locale.getpreferredencoding()),
                                        self.raster_ds,0)
            dst_ds.SetProjection(self.srs)

            #double x = 0.0, double y = 0.0, double z = 0.0, double pixel = 0.0, 
            #double line = 0.0, char info = "", char id = ""
            gcps=[gdal.GCP(c[0],c[1],0,p[0],p[1],'',i) for i,p,c in self.refs]
            dst_ds.SetGCPs(gcps,self.refs.srs())
            dst_geotr=gdal.GCPsToGeoTransform(gcps) # if len(gcps) < 5 else (0.0, 1.0, 0.0, 0.0, 0.0, 1.0)
            dst_ds.SetGeoTransform(dst_geotr)
            poly,gmt_data=self.cut_poly(dst_ds)
            if poly:
                dst_ds.SetMetadataItem('CUTLINE',poly)
            if self.name:
                dst_ds.SetMetadataItem('DESCRIPTION',self.name.encode('utf-8'))

            del dst_ds # close dataset
#            re_sub_file(dst_file, [
#                    ('^.*<GeoTransform>.*\n',''),
#                    ('^.*<SRS>.*\n','')
#                    ])
        finally:
            os.chdir(start_dir)

        if options.get_cutline: # print cutline then return
            print poly
            return
        if gmt_data and options.cut_file: # create shapefile with a cut polygon
            with open(base+'.gmt','w+') as f:
                f.write(gmt_data)

    gmt_templ='''# @VGMT1.0 @GPOLYGON
# @Jp"%s"
# FEATURE_DATA
>
# @P
%s
'''

    def cut_poly(self,dst_ds):
        plys=self.get_plys()
        if not plys:
            return '',''

        pix_lst=plys.pix_coords(dst_ds)

        # check if the raster really needs cutting
        width=dst_ds.RasterXSize
        height=dst_ds.RasterYSize
        inside=[i for i in pix_lst # check if the polygon is inside the image border
            if (i[0] > 0 or i[0] < width) or (i[1] > 0 or i[1] < height)]
        if not inside:
            return '',''

        # Create cutline
        poly_shape=self.gmt_templ % (self.refs.srs(),'\n'.join(
                                ['%r %r' % (i[0],i[1]) for i in plys.proj_coords()]))
        poly_wkt='MULTIPOLYGON(((%s)))' % ','.join(['%r %r' % tuple(i) for i in pix_lst]) # Create cutline
        return poly_wkt,poly_shape
# SrcLayer

###############################################################################

