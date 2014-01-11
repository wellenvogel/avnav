#!/usr/bin/env python

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
import shutil
import glob
import logging
import optparse
from PIL import Image

from tiler_functions import *

class ZoomSet:
    def __init__(self,tiles_dir):
        pf('%s ' % tiles_dir,end='')    

        start_dir=os.getcwd()
        os.chdir(tiles_dir)
        self.tiles_root=os.getcwd()
        os.chdir(start_dir)

        self.tileset=TileSetData(self.tiles_root)

        if self.tileset.profile.startswith('zxy'):
            self.tile_offsets=[
                (0,0), (128,0),
                (0,128), (128,128),
                ]
        else:
            self.tile_offsets=[
                (0,128), (128,128),
                (0,0), (128,0)
                ]

    def __call__(self,dest_tile):
        (z,x,y)=dest_tile
        ext=self.tileset.tile_ext
        im = Image.new("RGBA",(256,256),(0,0,0,0))

        tiles_in=[(x*2,y*2),(x*2+1,y*2),
                    (x*2,y*2+1),(x*2+1,y*2+1)]
        for (src_xy,out_loc) in zip(tiles_in,self.tile_offsets):
            if src_xy in self.src_lst:
                src_path='%i/%i/%i.%s' % (z+1,src_xy[0],src_xy[1],ext)
                im.paste(Image.open(src_path).resize((128,128),Image.ANTIALIAS),out_loc)

        dst_path='%i/%i/%i.%s' % (z,x,y,ext)
        im.save(dst_path)
        pf('.',end='')

    def zoom_out(self,target_zoom):
        start_dir=os.getcwd()
        try:

            top_zoom=min(self.tileset.zooms)
            new_zooms=range(top_zoom-1,target_zoom-1,-1)
            if not new_zooms:
                return
            for zoom in new_zooms: # make new zoom tiles
                pf('%i' % zoom,end='')
                
                shutil.rmtree('%i' % zoom,ignore_errors=True)
                os.chdir(os.path.join(self.tiles_root,'%i' % (zoom+1)))

                self.src_lst=set(
                    [tuple(map(int,path2list(f)[:-1])) 
                        for f in glob.glob('*/*.%s' % self.tileset.tile_ext)])

                os.chdir(self.tiles_root)

                if len(self.src_lst) == 0:
                    raise Exception("No tiles in %s" % os.getcwd())

                dest_lst=set([(zoom,src_x/2,src_y/2) for (src_x,src_y) in self.src_lst])

                for i in set([x for z,x,y in dest_lst]):
                    os.makedirs('%i/%i' % (zoom,i))

                parallel_map(self,dest_lst)

            # adjust tilemap.xml
            doc=self.tileset.doc
            #ld(self.tileset.title,self.tileset.abstract)
            tilesets_el=elem0(doc,"TileSets")
            new_tilesets={}
            for z in self.tileset.zooms: # unlink old tilesets
                new_tilesets[z]=tilesets_el.removeChild(self.tileset.tilesets[z])

            tileset_el=self.tileset.tilesets[top_zoom]
            res=self.tileset.tileset_parms[top_zoom][0]
            for zoom in new_zooms: # add new tilesets
                tileset_el=tileset_el.cloneNode(False)
                res=res*2
                tileset_el.setAttribute('units-per-pixel', '%.11G' % res)
                tileset_el.setAttribute('order', str(zoom))
                tileset_el.setAttribute('href', str(zoom))
                new_tilesets[zoom]=tileset_el                
            for z in sorted(new_tilesets): # sorted merge of new and old tilsets
                tilesets_el.appendChild(new_tilesets[z])

            with open(self.tileset.tilemap,'w') as f:
                #doc.writexml(f,encoding='utf-8')
                f.write(doc.toxml('utf-8'))

        finally:
            os.chdir(start_dir)
            pf('')

# ZoomSet end

if __name__=='__main__':
    parser = optparse.OptionParser(
        usage="usage: %prog tiles_dir ...", 
        version=version,
        )
    parser.add_option("-v", "--verbose", action="store_true", dest="verbose")
    parser.add_option("-z", "--zoom", dest="zoom", type='int', 
        help='target zoom level)')
    parser.add_option("-q", "--quiet", action="store_true")
    parser.add_option("-d", "--debug", action="store_true")
        
    (options, args) = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if options.debug else 
        (logging.ERROR if options.quiet else logging.INFO))

    if options.zoom == None:
        parser.error('No target zoom specified')

    start_dir=os.getcwd()
    for tiles_dir in args if len(args)>0 else ['.']:
        ZoomSet(tiles_dir).zoom_out(options.zoom)

