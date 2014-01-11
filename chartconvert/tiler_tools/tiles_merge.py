#!/usr/bin/env python
# -*- coding: utf-8 -*-

###############################################################################
# Copyright (c) 2010,2011 Vadim Shlyakhov
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
#******************************************************************************

import sys
import os
import os.path
import glob
import shutil
import logging
import optparse
from PIL import Image
import pickle

from tiler_functions import *

class KeyboardInterruptError(Exception): 
    pass

def f_approx_eq(a, b, eps):
    return (abs(a-b) / (abs(a)+abs(b))/2) < eps

def transparency(img):
    'estimate transparency of an image'
    (r,g,b,a)=img.split()
    (a_min,a_max)=a.getextrema() # get min/max values for alpha channel
    return 1 if a_min == 255 else 0 if a_max == 0 else -1

class MergeSet:
    
    def __init__(self,src_dir,dst_dir):

        if options.strip_src_ext:
            src_dir = os.path.splitext(src)[0]
        if options.add_src_ext is not None:
            src_dir += options.add_src_ext
        pf(src_dir+' ',end='')

        # copy metadata
        for n in ['viewer-google.html','viewer-openlayers.html','tilemap.xml']:
            src_f=os.path.join(src_dir,n)
            dst_f=os.path.join(dst_dir,n)
            if os.path.exists(src_f) and not os.path.exists(dst_f):
                shutil.copy(src_f,dst_f)

        # read metadata
        self.src=TileSetData(src_dir)
        self.dst=TileSetData(dst_dir)

        # get a list of source tiles
        try:
            cwd=os.getcwd()
            os.chdir(self.src.root)
            self.src_lst=glob.glob('[0-9]*/*/*.%s' % self.src.tile_ext)
            self.max_zoom=max([int(i) for i in glob.glob('[0-9]*')])
        finally:
            os.chdir(cwd)
        #ld(self.src_lst)
        
        # load cached tile transparency data if any
        self.src_transp=dict.fromkeys(self.src_lst,None)
        self.src_cache_path=os.path.join(self.src.root, 'merge-cache')
        try:
            self.src_transp.update(pickle.load(open(self.src_cache_path,'r')))
        except:
            ld("cache load failed")
        #ld(repr(self.src_transp))
        
        # define crop map for underlay function
        tsx,tsy=self.src.tile_size
        if self.src.profile.startswith('zxy'):
            self.underlay_map=[ 
                #  lf    up    rt    lw
                (   0,    0,tsx/2,tsy/2), (tsx/2,    0,  tsx,tsy/2),
                (   0,tsy/2,tsx/2,  tsy), (tsx/2,tsy/2,  tsx,  tsy),
                ]
        else:
            self.underlay_map=[ 
                #  lf    up    rt    lw
                (   0,tsy/2,tsx/2,  tsy), (tsx/2,tsy/2,  tsx,  tsy),
                (   0,    0,tsx/2,tsy/2), (tsx/2,    0,  tsx,tsy/2),
                ]

    def merge_metadata(self):
        'adjust destination metadata'

        src=self.src
        dst=self.dst
        doc=dst.doc

        for prop in ['profile','srs','tile_origin','tile_size','tile_ext','tile_mime']:
            assert src.__dict__[prop] == dst.__dict__[prop]

        title_el=elem0(doc,"Title")
        title_el.replaceChild(doc.createTextNode(os.path.split(dst_dir)[1]),title_el.firstChild)
        abstract_el=elem0(doc,"Abstract")
        if abstract_el.hasChildNodes():
            abstract_el.removeChild(abstract_el.firstChild).unlink()
        abstract_el.appendChild(doc.createTextNode('merged tileset'))

        ld([round(i/1000) for i in src.extent],[round(i/1000) for i in dst.extent])
        box_el = elem0(doc,"BoundingBox")
        for i,name,func in zip(range(4),('minx','miny','maxx','maxy'),(min,min,max,max)):
            box_el.setAttribute(name, repr(func(src.extent[i],dst.extent[i])))

        new_zooms=src.zooms - dst.zooms
        if new_zooms:
            tilesets_el=elem0(doc,"TileSets")
            new_tilesets={}
            for z in dst.zooms & src.zooms:
                ld('tileset_parms',dst.tileset_parms[z],src.tileset_parms[z])
                assert dst.tileset_parms[z][1] == src.tileset_parms[z][1]
                assert f_approx_eq(dst.tileset_parms[z][0], src.tileset_parms[z][0], 1.0e-10)

            for z in dst.zooms: # unlink tilesets from the destination
                new_tilesets[z]=tilesets_el.removeChild(dst.tilesets[z])
            for z in new_zooms: # clone new tilesets from the source
                new_tilesets[z]=src.tilesets[z].cloneNode(False)
            for z in sorted(src.zooms | dst.zooms): # sorted merge of new and old tilsets
                tilesets_el.appendChild(new_tilesets[z])

        with open(dst.tilemap,'w') as f:
            #doc.writexml(f,encoding='UTF-8')
            f.write(doc.toxml('utf-8'))

    def underlay(self,tile,src_path,src_raster,level):
        if level <= 0:
            return
        level -= 1
        (s,ext)=os.path.splitext(tile)
        (s,y)=os.path.split(s)
        (z,x)=os.path.split(s)
        (z,y,x)=map(int,(z,y,x))
        if z < self.max_zoom:
            return

        dz,dx,dy=z+1,x*2,y*2
        dst_tiles=[(dx,dy),  (dx+1,dy),
                   (dx,dy+1),(dx+1,dy+1)]
        for (dst_xy,src_area) in zip(dst_tiles,self.underlay_map):
            dst_tile='%i/%i/%i%s' % (dz,dst_xy[0],dst_xy[1],ext)
            dst_path=os.path.join(self.dst.root,dst_tile)
            if not os.path.exists(dst_path):
                continue
            dst_raster=Image.open(dst_path).convert("RGBA")
            if transparency(dst_raster) == 1: # lower tile is fully opaque
                continue
            if not src_raster: # check if opening was deferred
                src_raster=Image.open(src_path).convert("RGBA")
            out_raster=src_raster.crop(src_area).resize(self.src.tile_size,Image.BILINEAR)
            out_raster=Image.composite(dst_raster,out_raster,dst_raster)
            del dst_raster
            out_raster.save(dst_path)

            if options.debug:
                pf('%i'%level,end='')
            else:
                pf('#',end='')            
            self.underlay(dst_tile,dst_path,out_raster,level)
                
    def __call__(self,tile):
        '''called by map() to merge a source tile into the destination tile set'''
        try:
            src_path=os.path.join(self.src.root,tile)
            dst_tile=os.path.join(self.dst.root,tile)
            dpath=os.path.dirname(dst_tile)
            if not os.path.exists(dpath):
                try: # thread race safety
                    os.makedirs(dpath)
                except os.error: pass 
            src_raster=None
            transp=self.src_transp[tile]
            if transp == None: # transparency value not cached yet
                #pf('!',end='')
                src_raster=Image.open(src_path).convert("RGBA")
                transp=transparency(src_raster)
            if  transp == 0 : # fully transparent
                #pf('-',end='')
                #os.remove(src_path)
                pass
            elif transp == 1 or not os.path.exists(dst_tile): 
                # fully opaque or no destination tile exists yet
                #pf('>',end='')
                shutil.copy(src_path,dst_tile)
            else: # semitransparent, combine with destination (exists! see above)
                pf('+',end='')
                if not src_raster: 
                    src_raster=Image.open(src_path).convert("RGBA")
                dst_raster=Image.composite(src_raster,Image.open(dst_tile).convert("RGBA"),src_raster)
                dst_raster.save(dst_tile)
            if options.underlay and transp != 0:
                self.underlay(tile,src_path,src_raster,options.underlay)
        except KeyboardInterrupt: # http://jessenoller.com/2009/01/08/multiprocessingpool-and-keyboardinterrupt/
            print 'got KeyboardInterrupt'
            raise KeyboardInterruptError()
        return (tile,transp) # send back transparency values for caching

    def upd_stat(self,transparency_data):
        self.src_transp.update(dict(transparency_data))
        try:
            pickle.dump(self.src_transp,open(self.src_cache_path,'w'))
        except:
            ld("cache save failed")
        pf('')

    def merge_dirs(self):
        self.merge_metadata()
        src_transparency=parallel_map(self,self.src_lst)
        self.upd_stat(src_transparency)

# MergeSet end

if __name__=='__main__':
    parser = optparse.OptionParser(
        usage="usage: %prog [--cut] [--dest-dir=DST_DIR] <tile_dirs>... <target_dir>",
        version=version,
        description="")
    parser.add_option("-r", "--remove-dest", action="store_true",
        help='delete destination directory before merging')
    parser.add_option("-l", "--src-list", default=None,
        help='read a list of source directories from a file; if no destination is provided then name destination after the list file without a suffix')
    parser.add_option("-s", "--strip-src-ext", action="store_true",
        help='strip extension suffix from a source parameter')
    parser.add_option("-x", "--add-src-ext", default=None,
        help='add extension suffix to a source parameter')
    parser.add_option('-u',"--underlay", type='int', default=0,
        help="underlay semitransparent tiles with a zoomed-in raster from a higher level")
    parser.add_option("-q", "--quiet", action="store_true")
    parser.add_option("-d", "--debug", action="store_true")
    parser.add_option("--nothreads", action="store_true",
        help="do not use multiprocessing")

    (options, args) = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if options.debug else 
        (logging.ERROR if options.quiet else logging.INFO))
        
    ld(options)

    if options.src_list:
        src_dirs=[i.rstrip('\n') for i in open(options.src_list,'r')]
        try:
            dst_dir=args[-1]
        except:
            dst_dir=os.path.splitext(options.src_list)[0]
    else:
        try:
            src_dirs=args[0:-1]
            dst_dir=args[-1]
        except:
            raise Exception("No source(s) or/and destination specified")

    if options.nothreads or options.debug:
        set_nothreads()

    if options.remove_dest: 
        shutil.rmtree(dst_dir,ignore_errors=True)
        
    if not os.path.exists(dst_dir):
        try:
            os.makedirs(dst_dir)
        except os.error: pass

    for src in src_dirs:
        if not (src.startswith("#") or src.strip() == ''): # ignore sources with names starting with "#" 
            MergeSet(src, dst_dir).merge_dirs()

