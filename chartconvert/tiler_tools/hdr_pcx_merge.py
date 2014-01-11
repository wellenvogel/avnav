#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-01-27 11:38:30 

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
#******************************************************************************

import sys
import os
import shutil
import glob
import logging
import optparse
import string
from PIL import Image

from tiler_functions import *

pcx_tile_w=640
pcx_tile_h=480

class MergeSet:
    def __init__(self,src_lst,dest_dir):
        self.src_lst=src_lst
        self.dest_dir=dest_dir
        self.merge()

    def __call__(self,src_dir):
        pf('.',end='')
        uc=string.ascii_uppercase
        tiles=sorted(glob.glob(os.path.join(src_dir,"*.[A-Z][0-9][0-9]")))
        last_name=os.path.split(tiles[-1])[1]
        (base_name,last_ext)=os.path.splitext(last_name)
        ld([base_name,last_ext])
        y_max=int(last_ext[2:4])
        x_max=uc.find(last_ext[1])+1
        #ld([base_name,y_max,x_max])
        im = Image.new("RGBA", (x_max*pcx_tile_w, y_max*pcx_tile_h))
        for y in range(1,y_max+1):
            for x in range(1,x_max+1):
                src=os.path.join(src_dir,'%s.%s%02d' % (base_name,uc[x-1],y))
                loc=((x-1)*pcx_tile_w,(y-1)*pcx_tile_h)
                ld([src,loc])
                if os.path.exists(src):
                    im.paste(Image.open(src),loc)
                else:
                    logging.warning("%s not found" % src)
        dest=os.path.join(self.dest_dir,base_name+'.png')
        # Get the alpha band http://nadiana.com/pil-tips-converting-png-gif
        alpha = im.split()[3]
        # Convert the image into P mode but only use 255 colors in the palette out of 256
        im = im.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255)
        # Set all pixel values below 128 to 255, and the rest to 0
        mask = Image.eval(alpha, lambda a: 255 if a <=128 else 0)
        # Paste the color of index 255 and use alpha as a mask
        im.paste(255, mask)
        # The transparency index is 255
        im.save(dest, transparency=255, optimize=True)

    def merge(self):
        parallel_map(self,self.src_lst)
# MergeSet end

if __name__=='__main__':
    parser = optparse.OptionParser(
        usage="usage: %prog tiles_dir",
        version=version,
        )
    parser.add_option("-v", "--verbose", action="store_true", dest="verbose")

    (options, args) = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if options.verbose else logging.INFO)

    start_dir=os.getcwd()
    if len(args)==0:
        raise Exception("No source directories specified")

    src_dirs=glob.glob(os.path.join(args[0],"[A-Z]??????[0-9]"))
    MergeSet(src_dirs,start_dir)

