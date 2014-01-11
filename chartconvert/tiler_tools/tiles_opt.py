#!/usr/bin/env python

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
import stat
import shutil
import logging
import optparse
from PIL import Image

from tiler_functions import *

tick_rate=50
tick_count=0

def counter():
    global tick_count
    tick_count+=1
    if tick_count % tick_rate == 0:
        pf('.',end='')
        return True
    else:
        return False

def optimize_png(src,dst,dpath):
    'optimize png using pngnq utility'
    command(['pngnq','-n',options.colors,'-e','.png','-d',dpath,src])

def to_jpeg(src,dst,dpath):
    'convert to jpeg'
    dst_jpg=os.path.splitext(dst)[0]+'.jpg'
    img=Image.open(src)
    img.save(dst_jpg,optimize=True,quality=options.quality)

class KeyboardInterruptError(Exception): pass
   
def proc_file(f):
    try:
        src=os.path.join(src_dir,f)
        dst=os.path.join(dst_dir,f)
        dpath=os.path.split(dst)[0]
        if not os.path.exists(dpath):
            os.makedirs(dpath)
        if f.lower().endswith('.png'):
            optimize_png(src,dst,dpath)
        else:
            shutil.copy(src,dpath)
        counter()
    except KeyboardInterrupt: # http://jessenoller.com/2009/01/08/multiprocessingpool-and-keyboardinterrupt/
        pf('got KeyboardInterrupt')
        raise KeyboardInterruptError()
    
if __name__=='__main__':
    logging.basicConfig(level=logging.INFO)
    #logging.basicConfig(level=logging.DEBUG)

    parser = optparse.OptionParser(
        usage="usage: %prog [options] arg",
        version=version,
        )
    parser.add_option("-n", "--colors", dest="colors", default='256',
        help='Specifies  the  number  of colors to quantize to (default: 256)')
    parser.add_option("--jpeg", action="store_true",
        help='convert tiles to JPEG')
    parser.add_option("--quality", dest="quality", type="int", default=75,
        help='JPEG quality (default: 75)')
    parser.add_option("-r", "--remove-dest", action="store_true",
        help='delete destination directory if any')
    parser.add_option("-q", "--quiet", action="store_true")
    parser.add_option("-d", "--debug", action="store_true")
    parser.add_option("--nothreads", action="store_true",
        help="do not use multiprocessing")
        
    (options, args) = parser.parse_args()

    if not args:
        parser.error('No input directory(s) specified')

    if options.nothreads or options.debug:
        set_nothreads()

    if options.jpeg: 
        optimize_png=to_jpeg

    for src_dir in args:
        dst_dir=src_dir+'.opt'
        pf('%s -> %s ' % (src_dir,dst_dir),end='')

        if options.remove_dest: 
            shutil.rmtree(dst_dir,ignore_errors=True)
        elif os.path.exists(dst_dir):
            raise Exception('Destination already exists: %s' % dst_dir)

        # find all source files
        try:
            cwd=os.getcwd()
            os.chdir(src_dir)
            src_lst=flatten([os.path.join(path, name) for name in files] 
                        for path, dirs, files in os.walk('.'))
        finally:
            os.chdir(cwd)

        parallel_map(proc_file,src_lst)

        if options.jpeg:
            tilemap=os.path.join(dst_dir,'tilemap.xml')
            if os.path.exists(tilemap):
                re_sub_file(tilemap,[
                    ('mime-type="[^"]*"','mime-type="image/jpeg"'),                    
                    ('extension="[^"]*"','extension="jpg"'),
                    ])

        pf('')

