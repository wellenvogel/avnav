#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-01-27 11:32:42 

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

import sys
import os
import os.path
import math
import shutil
import logging
from optparse import OptionParser
#from PIL import Image
import zlib
import mmap
import operator
import struct
import glob

from tiler_functions import *

class OzfImg(object):

#ozf_header_1:
#  short magic;         // set it to 0x7780 for ozfx3 and 0x7778 for ozf2
#  long locked;         // if set to 1, than ozi refuses to export the image (doesn't seem to work for ozfx3 files though); just set to 0
#  short tile_width;    // set always to 64
#  short version;       // set always to 1
#  long old_header_size;// set always to 0x436; this has something to do with files having magic 0x7779 
#                       // (haven't seen any of those, they are probably rare, but ozi has code to open them)
    hdr1_fmt='<HIHHI'
    hdr1_size=struct.calcsize(hdr1_fmt)
    hdr1_fields=('magic','locked','tile_width','version','old_header_size')

#ozf_header_2:
#	int header_size;	// always 40
#	int image_width;	// width of image in pixels
#	int image_height;	// height of image in pixels
#	short depth;		// set to 1
#	short bpp;			// set to 8
#	int reserved1;		// set to 0
#	int memory_size;	// height * width; probably not used and contains junk if it exceeds 0xFFFFFFFF (which is perfectly ok)
#	int reserved2;		// set to 0
#	int reserved3;		// set to 0
#	int unk2;			// set to 0x100
#	int unk2;			// set to 0x100

    hdr2_fmt='<iIIhhiiiiii'
    hdr2_size=struct.calcsize(hdr2_fmt)
    hdr2_fields=('header_size','image_width','image_height','depth','bpp',
        'reserved1','memory_size','reserved2','reserved3','unk2','unk3')

#zoom_level_hdr:
#   uint width;
#   uint height;
#   ushort tiles_x;
#   ushort tiles_y;

    def __init__(self,img_fname,ignore_decompression_errors=False):
        self.ignore_decompression_errors=ignore_decompression_errors
        self.errors=[]
        self.fname=img_fname
        self.f=open(img_fname,'r+b')
        self.mmap=mmap.mmap(self.f.fileno(),0,access=mmap.ACCESS_READ)
        self.mmap_pos=0
        long_fmt='<I'
        long_size=4
        oziread=self.read

        # header 1
        hdr1=oziread(self.hdr1_fmt,self.hdr1_fields)
        ld('hdr1',hex(0),hdr1)
        magic=hdr1['magic']
        try:
            self.ozfx3 = { 0x7780: True, 0x7778: False}[magic]
        except KeyError:
            raise Exception('Invalid file: %s' % img_fname)
            
        hdr2_ofs=self.tell() # remember current pos
        
        if self.ozfx3: # initialize descrambling
            magic_size=oziread('<B')[0]
            magic_lst=oziread('<%dB' % magic_size)
            self.new_seed(magic_lst[0x93])
            ld('seed',hex(self.seed))
            magic2=oziread(long_fmt)[0]
            if magic2 != 0x07A431F1:
                pf('m',end='')
            try:
                magic2_prog={
                    0x07A431F1: 'Ozf2Img 3.00+', # ; unrestricted saving; encryption depth: 16',
                    0xE592C118: 'MapMerge 1.05+',# ; no saving; encryption depth: 16',
                    0xC208F454: 'MapMerge 1.04', # ; no saving; encryption depth: full',
                    }[magic2]
            except:
                magic2_prog='?'
            ld('magic2',hex(magic2),magic2_prog)
            # re-read hdr1
            hdr2_ofs=self.tell() # remember current pos
            self.seek(0)
            hdr1=oziread(self.hdr1_fmt,self.hdr1_fields)
            ld('hdr1',hex(0),hdr1)

            # find a seed which decodes hdr2 
            pattern=struct.pack('<I',self.hdr2_size) # 1st dword is hdr2 size
            src=self.mmap[hdr2_ofs:hdr2_ofs+4]
            for i in range(256):
                seed=(i+magic_lst[0x93]+0x8A) & 0xFF # start from the well known seed
                if self.descramble(src,seed=seed) == pattern :
                    break
            else:
                raise Exception('seed not found')
            foo=seed - magic_lst[0x93]
            if foo < 0: foo+=256
            if foo not in magic_lst:
                pf('s',end='')                
            ld('seed found',map(hex,(self.seed,magic_lst[0x93],foo)),foo in magic_lst,i)
            self.new_seed(seed)
            
        # continue with header 1
        tw=hdr1['tile_width']
        self.tile_sz=(tw,tw)
        assert tw == 64
        assert hdr1['version'] == 1
        assert hdr1['old_header_size'] == 0x436
        
        # header 2
        self.seek(hdr2_ofs)
        hdr2=oziread(self.hdr2_fmt,self.hdr2_fields)
        ld('hdr2',hex(hdr2_ofs),hdr2)
        assert hdr2['header_size'] == self.hdr2_size
        assert hdr2['bpp'] == 8
        assert hdr2['depth'] == 1

        # pointers to zoom level tilesets 
        self.seek(self.mmap.size()-long_size)
        zoom_lst_ofs=oziread(long_fmt)[0]
        zoom_cnt=(self.mmap.size()-zoom_lst_ofs)//long_size-1
        ld('zoom_lst_ofs',hex(zoom_lst_ofs),zoom_cnt)
        self.seek(zoom_lst_ofs)
        zoom0_ofs=oziread(long_fmt)[0]
        ld('zoom0_ofs',hex(zoom0_ofs))       

        # zoom 0 level hdr, unscramble individually 
        self.seek(zoom0_ofs)
        w,h,tiles_x,tiles_y=[oziread('<'+f)[0] for f in 'IIHH']
        ld('zoom0',w,h,tiles_x,tiles_y,tiles_x*tiles_y)
        self.size=(w,h)
        self.t_range=(tiles_x,tiles_y)

        # palette
        p_raw=oziread('<%dB' % (256*long_size))
        self.palette=flatten(zip(p_raw[2::4],p_raw[1::4],p_raw[0::4]))
        try:
            assert not any(p_raw[3::4]), 'pallete pad is not zero'
        except:
            pf('p',end='')
            ld('p_raw[3::4]',map(hex,p_raw[3::4]))
        #self.max_color=0
        #ld('palette',self.palette)

        # tile offsets, unscramble individually
        self.tile_ofs=[oziread(long_fmt)[0] for i in range(self.t_range[0]*self.t_range[1]+1)]
        #ld(self.tile_ofs)
        pf('.',end='')

    def close(self):
        self.mmap.close()
        self.f.close()
        return self.fname,self.errors
        
    def tile_data(self,x,y,flip=True):
        idx=x+y*self.t_range[0]
        ofs=self.tile_ofs[idx]
        nofs=self.tile_ofs[idx+1]
        try:
            tile=zlib.decompress(self.descramble(self.mmap[ofs:nofs],descr_len=16))
        except zlib.error as exc:
            err_msg='tile %d,%d %s' % (x,y,exc.args[0])
            self.errors.append(err_msg)
            if self.ignore_decompression_errors:
                logging.error(' %s: %s' % (self.fname,err_msg))
                tx,ty=self.tile_sz
                tile='\x00'*(tx*ty)
            else: 
                ld('src tile',x,y)
                raise exc
        #self.max_color=max(self.max_color,max(tile))
        if flip:
            tx,ty=self.tile_sz
            tile=''.join([tile[i*tx:(i+1)*ty] for i in range(ty-1,-1,-1)])
        return tile

    def read(self,fmt,fields=None):
        sz=struct.calcsize(fmt)
        src=self.mmap[self.mmap_pos:self.mmap_pos+sz]
        res=struct.unpack(fmt,self.descramble(src))
        self.mmap_pos+=sz
        return dict(zip(fields,res)) if fields else res 
        
    def tell(self):
        return self.mmap_pos

    def seek(self,pos):
        self.mmap_pos=pos
        
    ozfx3_key=bytearray('\x2D\x4A\x43\xF1\x27\x9B\x69\x4F\x36\x52\x87\xEC\x5F'
                	    '\x42\x53\x22\x9E\x8B\x2D\x83\x3D\xD2\x84\xBA\xD8\x5B')
    ozfx3_key_ln=len(ozfx3_key)

    def descramble(self,src,descr_len=None,seed=None):
        return src

    def ozfx3_descramble(self,src,descr_len=None,seed=None):
        if seed is None:
            seed=self.seed
        if descr_len is None:
            descr_len=len(src)
        res=bytearray(src[:descr_len])
        key=self.ozfx3_key
        kln=self.ozfx3_key_ln
        for i in range(descr_len):
            res[i] ^= (key[i % kln] + seed) & 0xFF
        return str(res)+src[descr_len:]

    def new_seed(self,seed):
        self.seed=seed
        self.descramble=self.ozfx3_descramble

#    def tile(self,x,y):
#        data=self.tile_data(x,y)#,flip=False)
#        img=Image.fromstring('L',self.tile_sz,data,'raw','L',0,1)
#        #img.putpalette(self.palette)
#        return img

#    def image(self):
#        img=Image.new('L',self.size)
#        for x in range(self.t_range[0]):
#            for y in range(self.t_range[1]):
#                tile=self.tile(x,y)
#                img.paste(tile,(x*self.tile_sz[0],y*self.tile_sz[1]))
#        img.putpalette(self.palette)
#        return img
 
class TiffImg(object):
    tag_map={
        'ImageWidth':                   (256, 'LONG'),      # SHORT or LONG
        'ImageLength':                  (257, 'LONG'),      # SHORT or LONG
        'BitsPerSample':                (258, 'SHORT'),     # 4 or 8
        'Compression':                  (259, 'SHORT'),     # 1 or 32773
        'PhotometricInterpretation':    (262, 'SHORT'),     # 3
        'StripOffsets':                 (273, 'LONG'),
        'SamplesPerPixel':              (277, 'SHORT'),
        'RowsPerStrip':                 (278, 'LONG'),      # SHORT or LONG
        'StripByteCounts':              (279, 'LONG'),      # SHORT or LONG
        'XResolution':                  (282, 'RATIONAL'),
        'YResolution':                  (283, 'RATIONAL'),  
        'PlanarConfiguration':          (284, 'SHORT'),
        'ResolutionUnit':               (296, 'SHORT'),     # 1 or 2 or 3
        'ColorMap':                     (320, 'SHORT'),
        'TileWidth':                    (322, 'LONG'),      # SHORT or LONG
        'TileLength':                   (323, 'LONG'),      # SHORT or LONG
        'TileOffsets':                  (324, 'LONG'),
        'TileByteCounts':               (325, 'LONG'),      # SHORT or LONG
        'SampleFormat':                 (339, 'SHORT'),
        }

    type_map={
        'BYTE':     (1, 'B'),   # 8-bit unsigned integer.
        'ASCII':    (2, 's'),   # 8-bit byte that contains a 7-bit ASCII code; the last byte must be NUL (binary zero).
        'SHORT':    (3, 'H'),   # 16-bit (2-byte) unsigned integer.
        'LONG':     (4, 'I'),   # 32-bit (4-byte) unsigned integer.
        'RATIONAL': (5, 'II'),  # Two LONGs: the first represents the numerator of a fraction; the second, the denominator.
        }

    hdr='II*\x00'
    null_ptr='\x00\x00\x00\x00'
    ptr_size=len(null_ptr)

    ptr_fmt=struct.Struct('<I')
    tag_fmt='<HHI4s'

    def add_tag(self,name,val):
        tag_id,type_name=self.tag_map[name]
        type_id,type_fmt=self.type_map[type_name]
        if type_name == 'ASCII':
            val+='\x00'
        try:
            n_items=len(val)
        except TypeError:
            n_items=1
            val=(val,)
        fmt='<%d%s' %(n_items,type_fmt)
        data_size=struct.calcsize(fmt)
        if data_size <= self.ptr_size: # pack data into tag
            ofs_val=(struct.pack(fmt,*val)+self.null_ptr)[0:self.ptr_size]
            ofs=0
        else: # store data separately
            ofs=self.f.tell()
            self.f.write(struct.pack(fmt,*val)+(self.null_byte if data_size % 2 else ''))
            ofs_val=self.ptr_fmt.pack(ofs)
        ld(name,fmt,hex(ofs),n_items,val[:20])
        self.ifd.append((tag_id,type_id,n_items,ofs_val))

    def write_ifd(self):
        ofs=self.f.tell()
        self.f.seek(self.prev_ifd)
        self.f.write(self.ptr_fmt.pack(ofs))
        self.f.seek(ofs)
        self.ifd.sort(None,lambda i: i[0])
        self.f.write(struct.pack('<H',len(self.ifd)))
        for t in self.ifd:
            #ld(self.tag_fmt,t)
            self.f.write(struct.pack(self.tag_fmt,*t))
        self.prev_ifd=self.f.tell()
        self.f.write(self.null_ptr)

    count=0
    tick_rate=5000    
    
    def counter(self):
        self.count+=1
        if self.count % self.tick_rate == 0:
            pf('.',end='')
            return True
        else:
            return False
            
class TiledTiff(TiffImg):

    def __init__(self,fname,size,t_size,palette,compression):
        self.size=size
        self.t_size=t_size
        self.t_range=[(pix-1)//tsz+1 for pix,tsz in zip(size,t_size)]
        
        self.fname=fname
        self.f=open(fname,'w+b')
        self.f.write(self.hdr)
        self.prev_ifd=self.f.tell()
        self.f.write(self.null_ptr)
        self.ifd=[]
        self.add_tag('ImageWidth',self.size[0])
        self.add_tag('ImageLength',self.size[1])
        self.add_tag('BitsPerSample',8)
        self.compression=compression
        if self.compression:
            self.add_tag('Compression',8)
        else:
            self.add_tag('Compression',1)
        self.add_tag('PhotometricInterpretation',3)
        self.add_tag('SamplesPerPixel',1)
        self.add_tag('PlanarConfiguration',1)
        self.add_tag('SampleFormat',1)
        ld('t_size',self.t_size)
        self.add_tag('TileWidth',self.t_size[0])
        self.add_tag('TileLength',self.t_size[1])
        self.tile_ofs=[]
        self.tile_lengths=[]
        p=flatten([palette[i::3] for i in range(3)])
        self.add_tag('ColorMap',[c<<8 for c in p])
        pf('.',end='')

    def close(self):
        self.add_tag('TileOffsets',self.tile_ofs)
        self.add_tag('TileByteCounts',self.tile_lengths)
        self.write_ifd()
        self.f.close()
        ld("%s done" % self.fname)

    def add_tile(self,tile,flip=False):
        self.counter()
        if self.compression:
            tile=zlib.compress(tile,self.compression)
        ofs=self.f.tell()
        assert not (ofs % 2)
        self.f.write(tile)
        if len(tile) % 2:
            self.f.write('\x00')
        self.tile_ofs.append(ofs)
        self.tile_lengths.append(len(tile))

    def store_tiles(self,get_tile):
        ld('tiff tiles',self.t_range,self.t_range[0]*self.t_range[1])
        for y in range(self.t_range[1]):
            for x in range(self.t_range[0]):
                self.add_tile(get_tile(x,y))
        
def make_new_map(src,dest,map_dir):
    base,ext=os.path.splitext(src)
    img_dir,img_file=os.path.split(src)
    if not img_dir:
        img_dir='.'
    if map_dir is None:
        map_dir=img_dir
    dir_lst=flatten(map(glob.glob,(
        '%s/%s*.map' % (map_dir,base),
        '%s/%s*.MAP' % (map_dir,base),
        '%s/*.map' % (map_dir,),
        '%s/*.MAP' % (map_dir,))))
    ld(img_file,dir_lst)

    patt=img_file.decode('utf_8','ignore').lower()
    try_enc=('utf_8','iso-8859-1','iso-8859-2','cp1251')
    for fn in dir_lst:
        with open(fn) as f:
            map_lines=[f.readline() for i in range(3)]
            match_patt=[map_lines[2].decode(i,'ignore').lower() for i in try_enc]
            if any([patt in m for m in match_patt]):
                map_lines[2]=os.path.split(dest)[1]+'\r\n'
                map_lines.extend(f.readlines())
                dest_map=dest+'.map'
                with open(dest_map,'w+') as d:
                    d.writelines(map_lines)
                return dest_map,None
    else:
        err_msg='%s: map file not found' % src
        logging.warning(err_msg)
        return None,err_msg
        
def ozf2tiff(src,dest,compression=6,ignore_decompression_errors=False):
    ozf=OzfImg(src,ignore_decompression_errors)

    tiff=TiledTiff(dest,ozf.size,ozf.tile_sz,ozf.palette,compression)
    tiff.store_tiles(ozf.tile_data)
    tiff.close()
    return ozf.close()

def convert(src):
    src_dir,src_file=os.path.split(src)
    base,ext=os.path.splitext(src_file)
    dest=base+'.tiff'
    dest_dir=options.dest_dir
    if not dest_dir:
        dest_dir=src_dir
    if dest_dir:
        dest='%s/%s' % (dest_dir,dest)
    pf('\n%s.' % src,end='')
    ozi_file,ozi_err = ozf2tiff(src,dest,
        options.compression,options.ignore_decompression_errors)
    if not options.no_map_conversion:
        map_file,map_err = make_new_map(src,dest,options.map_dir)
        if map_err:
            ozi_err.append(map_err)
#        pf(map_file)
    if ozi_err:
        with open(ozi_file+'.errors','w+') as f:
            f.write('\n'.join(ozi_err))
        return ozi_file,ozi_err
    else: 
        return None
    
if __name__=='__main__':

    parser = OptionParser(
        usage="usage: %prog <options>... input_file...",
        version=version,
        description='ozf2, ozfx3 files converter')
    parser.add_option("-t", "--dest-dir", dest="dest_dir", default=None,
        help='destination directory (default: source)')
    parser.add_option("-n", "--no-map-conversion", 
        action="store_true",
        help='do not convert map files')
    parser.add_option("-m", "--map-dir", default=None,
        help='directory with the map files')
    parser.add_option("-c", "--compression",
        default=6,type='int',
        help='compression level (default 6)')
    parser.add_option("-e", "--ignore-decompression-errors", 
        action="store_true",
        help='do not convert map files')
    parser.add_option("-q", "--quiet", action="store_const", 
        const=0, default=1, dest="verbose")
    parser.add_option("-w", "--warning", action="store_const", 
        const=2, dest="verbose")
    parser.add_option("-d", "--debug", action="store_const", 
        const=3, dest="verbose")

    (options, args) = parser.parse_args()
    
    logging.basicConfig(
        level={
            0: logging.ERROR,
            1: logging.INFO,
            2: logging.WARNING,
            3: logging.DEBUG,
            }[options.verbose]
        )

    ld(os.name)
    ld(options)

    if not args:
        parser.error('No input file(s) specified')
    try:
        sources=args
    except:
        raise Exception("No source specified")
            
    err_lst=filter(None,parallel_map(convert,sources))
    pf('')
    if not err_lst:
        sys.exit(0)
    else:
        logging.warning('Errors during execution')
        for fname,msg_lst in err_lst:
            logging.warning(' %s: %s' % (fname,msg_lst[0]))
#            for msg in msg_lst:
#                logging.warning(' %s: %s' % (fname,msg))

