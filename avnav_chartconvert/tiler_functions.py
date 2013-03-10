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
from __future__ import print_function

version='%prog version 2.3'

import sys
import os
import os.path
import logging
from subprocess import *
import itertools
import re
import shutil
import locale
#from optparse import OptionParser

import xml.dom.minidom

try:
    from osgeo import gdal
    from osgeo import osr
    from osgeo import ogr
    from osgeo.gdalconst import *
#    gdal.TermProgress = gdal.TermProgress_nocb
except ImportError:
    import gdal
    import osr
    import ogr
    from gdalconst import *

try:
    import multiprocessing # available in python 2.6 and above

    class KeyboardInterruptError(Exception): 
        pass
except:
    multiprocessing=None

def data_dir():
    return sys.path[0]
    
def set_nothreads():
    global multiprocessing
    multiprocessing=None

def parallel_map(func,iterable):
    if multiprocessing is None or len(iterable) < 2:
        return map(func,iterable)
    else:
        # map in parallel
        mp_pool = multiprocessing.Pool() # multiprocessing pool
        res=mp_pool.map(func,iterable)
        # wait for threads to finish
        mp_pool.close()
        mp_pool.join()
    return res

def ld(*parms):
    logging.debug(' '.join(itertools.imap(repr,parms)))

def ld_nothing(*parms):
    return

def pf(*parms,**kparms):
    end=kparms['end'] if 'end' in kparms else '\n'
    sys.stdout.write(' '.join(itertools.imap(str,parms))+end)
    sys.stdout.flush()

def pf_nothing(*parms,**kparms):
    return

def flatten(two_level_list): 
    return list(itertools.chain(*two_level_list))

try:
    import win32pipe 
except:
    win32pipe=None

def if_set(x,default=None):
    return x if x is not None else default

def path2list(path):
    head,ext=os.path.splitext(path)
    split=[ext]
    while head:
        head,p=os.path.split(head)
        split.append(p)
    split.reverse()
    return split

def command(params,child_in=None):
    cmd_str=' '.join(('"%s"' % i if ' ' in i else i for i in params))
    ld('>',cmd_str,child_in)
    if win32pipe:
        (stdin,stdout,stderr)=win32pipe.popen3(cmd_str,'t')
        if child_in:
            stdin.write(child_in)
        stdin.close()
        child_out=stdout.read()
        child_err=stderr.read()
        if child_err:
            logging.warning(child_err)
    else:
        process=Popen(params,stdin=PIPE, stdout=PIPE, stderr=PIPE, universal_newlines=True)
        (child_out,child_err)=process.communicate(child_in)
        if process.returncode != 0: 
            raise Exception("*** External program failed: %s\n%s" % (cmd_str,child_err))
    ld('<',child_out,child_err)
    return child_out

def dest_path(src,dest_dir,ext='',template='%s'):
    src_dir,src_file=os.path.split(src)
    base,sext=os.path.splitext(src_file)
    dest=(template % base)+ext
    if not dest_dir:
        dest_dir=src_dir
    if dest_dir:
        dest='%s/%s' % (dest_dir,dest)
    ld(base,dest)
    return dest
    
def re_sub_file(fname, subs_list):
    'stream edit file using reg exp substitution list'
    new=fname+'.new'
    with open(new, 'w') as out:
        for l in open(fname, 'rU'):
            for (pattern,repl) in subs_list:
                l=re.sub(pattern,repl,string=l)
            out.write(l)
    shutil.move(new,fname)

#############################
#
# GDAL utility functions
#
#############################

def wkt2proj4(wkt):
    if wkt and wkt.startswith('+'):
        return wkt # already proj4
    srs = osr.SpatialReference()
    srs.ImportFromWkt(wkt)
    return srs.ExportToProj4()

def proj4wkt(proj4):
    srs = osr.SpatialReference()
    srs.ImportFromProj4(proj4)
    return srs.ExportToWkt()

def proj_cs2geog_cs(proj4):
    srs_proj = osr.SpatialReference()
    srs_proj.ImportFromProj4(proj4)
    srs_geo = osr.SpatialReference()
    srs_geo.CopyGeogCSFrom(srs_proj)
    return srs_geo.ExportToProj4()

class MyTransformer(gdal.Transformer):
    def __init__(self,src_ds=None,dst_ds=None,**options):
        for key in ('SRC_SRS','DST_SRS'):
            try:
                srs=options[key]
                if srs.startswith('+'):
                    options[key]=proj4wkt(srs)
            except: pass
        opt_lst=['%s=%s' % (key,options[key]) for key in options]
        super(MyTransformer, self).__init__(src_ds,dst_ds,opt_lst)

    def transform(self,points,inv=False):
        if not points:
            return []
        transformed,ok=self.TransformPoints(inv,points)
        assert ok
        return [i[:2] for i in transformed]

    def transform_point(self,point,inv=False):
        return self.transform([point],inv=inv)[0]
# MyTransformer

def sasplanet_hlg2ogr(fname):
    with open(fname) as f:
        lines=f.readlines(4096)
        if not lines[0].startswith('[HIGHLIGHTING]'):
            return None
        coords=[[],[]]
        for l in lines[2:]:
            val=float(l.split('=')[1].replace(',','.'))
            coords[1 if 'Lat' in l else 0].append(val)
        points=zip(*coords)
        ld('points',points)

    ring = ogr.Geometry(ogr.wkbLinearRing)
    for p in points:
        ring.AddPoint(*p)
    polygon = ogr.Geometry(ogr.wkbPolygon)
    polygon.AddGeometry(ring)

    ds = ogr.GetDriverByName('Memory').CreateDataSource( 'wrk' )
    assert ds is not None, 'Unable to create datasource'

    src_srs = osr.SpatialReference()
    src_srs.ImportFromProj4('+proj=latlong +a=6378137 +b=6378137 +nadgrids=@null +wktext')

    layer = ds.CreateLayer('sasplanet_hlg',srs=src_srs)

    feature = ogr.Feature(layer.GetLayerDefn())
    feature.SetGeometry(polygon)
    layer.CreateFeature(feature)
    
    del feature
    del polygon
    del ring
    
    return ds

def shape2mpointlst(datasource,dst_srs,feature_name=None):
    ds=ogr.Open(datasource.encode(locale.getpreferredencoding()))
    if not ds:
        ds=sasplanet_hlg2ogr(datasource)
    if not ds:
        ld('shape2mpointlst: Invalid datasource %s' % datasource)
        return []

    layer=ds.GetLayer()
    n_features=layer.GetFeatureCount()

    if feature_name is None or n_features == -1:
        feature=layer.GetFeature(0)
    else: # Try to find a feature with the same name as feature_name otherwise return
        for i in range(n_features-1,-1,-1):
            feature=layer.GetFeature(i)
            i_name=feature.GetFieldIndex('Name')
            if i_name != -1 and feature.GetFieldAsString(i_name) == feature_name:
                ld('feature',feature_name)
                break
            feature.Destroy()
        else:
            return []
            
    geom=feature.GetGeometryRef()
    geom_name=geom.GetGeometryName()
    geom_lst={
        'MULTIPOLYGON':(geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())),
        'POLYGON': (geom,),
        }[geom_name]
    
    layer_srs=layer.GetSpatialRef()
    if layer_srs:
        layer_proj=layer_srs.ExportToProj4()
    else:
        layer_proj=dst_srs
    srs_tr=MyTransformer(SRC_SRS=layer_proj,DST_SRS=dst_srs)
    if layer_proj == dst_srs:
        srs_tr.transform=lambda x:x

    multipoint_lst=[]
    for geometry in geom_lst:
        assert geometry.GetGeometryName() == 'POLYGON'
        for ln in (geometry.GetGeometryRef(j) for j in range(geometry.GetGeometryCount())):
            assert ln.GetGeometryName() == 'LINEARRING'
            src_points=[ln.GetPoint(n) for n in range(ln.GetPointCount())]
            dst_points=srs_tr.transform(src_points)
            ld(src_points)
            multipoint_lst.append(dst_points)
    ld('mpointlst',multipoint_lst,layer_proj,dst_srs)

    feature.Destroy()
    return multipoint_lst

def shape2cutline(cutline_ds,raster_ds,feature_name=None):
    mpoly=[]
    raster_proj=wkt2proj4(raster_ds.GetProjection())
    if not raster_proj:
        raster_proj=wkt2proj4(raster_ds.GetGCPProjection())
    ld(raster_proj,raster_ds.GetProjection(),raster_ds)

    pix_tr=MyTransformer(raster_ds)
    for points in shape2mpointlst(cutline_ds,raster_proj,feature_name):
        p_pix=pix_tr.transform(points,inv=True)
        mpoly.append(','.join(['%r %r' % (p[0],p[1]) for p in p_pix]))
    cutline='MULTIPOLYGON(%s)' % ','.join(['((%s))' % poly for poly in mpoly]) if mpoly else None
    ld('cutline',cutline)
    return cutline
    
def elem0(doc,id):
    return doc.getElementsByTagName(id)[0]
    
class TileSetData(object):

    def __init__(self,src_dir):
        
        #src_dir=src_dir.decode('utf-8','ignore')
        src=os.path.join(src_dir,'tilemap.xml')

        try:
            doc=xml.dom.minidom.parse(src)
        except xml.parsers.expat.ExpatError:
            raise Exception('Invalid input file: %s' % src)

        box_el = elem0(doc,"BoundingBox")
        origin_el = elem0(doc,"Origin")
        tile_format_el=elem0(doc,"TileFormat")

        zooms=set([])
        tilesets={}
        tileset_parms={}
        for tileset in doc.getElementsByTagName("TileSet"):
            order = int(tileset.getAttribute('order'))
            res = float(tileset.getAttribute('units-per-pixel'))
            href = tileset.getAttribute('href')
            zooms.add(order)
            tilesets[order] = tileset
            tileset_parms[order] = (res,href)

        self.tilemap=    src
        self.root=       src_dir
        self.doc=        doc
        self.profile=    elem0(doc,"TileSets").getAttribute('profile')
        self.srs=        elem0(doc,"SRS").firstChild.data
        self.title=      elem0(doc,"Title").firstChild.data
        self.abstract=   elem0(doc,"Abstract").firstChild.data
        self.extent=     [float(box_el.getAttribute(attr)) for attr in ('minx','miny','maxx','maxy')]
        self.tile_origin=[float(origin_el.getAttribute(attr)) for attr in ('x','y')]
        self.tile_size=  [int(tile_format_el.getAttribute(attr)) for attr in ('width','height')]
        self.tile_ext=   tile_format_el.getAttribute('extension')
        self.tile_mime=  tile_format_el.getAttribute('mime-type')
        self.zooms=      zooms
        self.tilesets=   tilesets
        self.tileset_parms=tileset_parms

    def __del__(self):    
        self.doc.unlink()

