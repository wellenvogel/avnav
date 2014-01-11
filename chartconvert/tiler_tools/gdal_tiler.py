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

from __future__ import print_function
import sys
import os
import os.path
import logging
import shutil
from optparse import OptionParser
import math
from PIL import Image
import pickle
import mmap
import operator
import struct

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

from tiler_functions import *

#############################

class BaseImg(object):
    '''Tile feeder for a base zoom level'''
#############################

    def __init__(self,dataset,tile_size,tile_first,tile_last,transparency=None):
        self.ds=dataset
        self.tile_first=tile_first
        self.tile_last=tile_last
        self.transparency=transparency

        self.size=self.ds.RasterXSize,self.ds.RasterYSize
        self.tile_sz=tile_size

        self.bands=[self.ds.GetRasterBand(i+1) for i in range(self.ds.RasterCount)]

    def __del__(self):
        del self.bands
        del self.ds
                
    def get_tile(self,tile):
        tile_sz=self.tile_sz
        n_bands=len(self.bands)

        assert (tile[0] >= self.tile_first[0] and tile[0] <= self.tile_last[0] and 
                tile[1] >= self.tile_first[1] and tile[1] <= self.tile_last[1]
                ), 'tile %s is out of range' % (tile,) 
        ul_pix=[(tile[0]-self.tile_first[0])*tile_sz[0],(tile[1]-self.tile_first[1])*tile_sz[1]]

        tile_bands=[band.ReadRaster(ul_pix[0],ul_pix[1],tile_sz[0],tile_sz[1],tile_sz[0],tile_sz[1],GDT_Byte)
                    for band in self.bands]
        if n_bands == 1:
            opacity=1
            mode='L'
            if self.transparency is not None:
                if chr(self.transparency) in tile_bands[0]:
                    colorset=set(tile_bands[0])
                    if len(colorset) == 1:  # fully transparent
                        return None,0
                    else:                   # semi-transparent
                        opacity=-1
            img=Image.frombuffer('L',tile_sz,tile_bands[0],'raw','L',0,1)
        else:
            aplpha=tile_bands[-1]
            if min(aplpha) == '\xFF':       # fully opaque
                opacity=1
                tile_bands=tile_bands[:-1]
                mode='RGB' if n_bands > 2 else 'L'
            elif max(aplpha) == '\x00':     # fully transparent
                return None,0
            else:                           # semi-transparent
                opacity=-1
                mode='RGBA' if n_bands > 2 else 'LA'
            img=Image.merge(mode,[Image.frombuffer('L',tile_sz,b,'raw','L',0,1) for b in tile_bands])
        return img,opacity

# BaseImg
    
#----------------------------

# templates for VRT XML

#----------------------------

def xml_txt(name,value=None,indent=0,**attr_dict):
    attr_txt=''.join((' %s="%s"' % (key,attr_dict[key]) for key in attr_dict))
    val_txt=('>%s</%s' % (value,name)) if value else '/'
    return '%s<%s%s%s>' % (' '*indent,name,attr_txt,val_txt)

warp_vrt='''<VRTDataset rasterXSize="%(xsize)d" rasterYSize="%(ysize)d" subClass="VRTWarpedDataset">
  <SRS>%(srs)s</SRS>
%(geotr)s%(band_list)s
  <BlockXSize>%(blxsize)d</BlockXSize>
  <BlockYSize>%(blysize)d</BlockYSize>
  <GDALWarpOptions>
    <!-- <WarpMemoryLimit>6.71089e+07</WarpMemoryLimit> -->
    <ResampleAlg>%(wo_ResampleAlg)s</ResampleAlg>
    <WorkingDataType>Byte</WorkingDataType>
    <SourceDataset relativeToVRT="0">%(wo_src_path)s</SourceDataset>
%(warp_options)s
    <Transformer>
      <ApproxTransformer>
        <MaxError>0.125</MaxError>
        <BaseTransformer>
          <GenImgProjTransformer>
%(wo_src_transform)s
%(wo_dst_transform)s
            <ReprojectTransformer>
              <ReprojectionTransformer>
                <SourceSRS>%(wo_src_srs)s</SourceSRS>
                <TargetSRS>%(wo_dst_srs)s</TargetSRS>
              </ReprojectionTransformer>
            </ReprojectTransformer>
          </GenImgProjTransformer>
        </BaseTransformer>
      </ApproxTransformer>
    </Transformer>
    <BandList>
%(wo_BandList)s
    </BandList>
%(wo_DstAlphaBand)s%(wo_Cutline)s  </GDALWarpOptions>
</VRTDataset>
'''
warp_band='  <VRTRasterBand dataType="Byte" band="%d" subClass="VRTWarpedRasterBand"%s>'
warp_band_color='>\n    <ColorInterp>%s</ColorInterp>\n  </VRTRasterBand'
warp_dst_alpha_band='    <DstAlphaBand>%d</DstAlphaBand>\n'
warp_cutline='    <Cutline>%s</Cutline>\n'
warp_dst_geotr= '            <DstGeoTransform> %r, %r, %r, %r, %r, %r</DstGeoTransform>'
warp_dst_igeotr='            <DstInvGeoTransform> %r, %r, %r, %r, %r, %r</DstInvGeoTransform>'
warp_src_geotr= '            <SrcGeoTransform> %r, %r, %r, %r, %r, %r</SrcGeoTransform>'
warp_src_igeotr='            <SrcInvGeoTransform> %r, %r, %r, %r, %r, %r</SrcInvGeoTransform>'
warp_band_mapping='      <BandMapping src="%d" dst="%d"%s>'
warp_band_src_nodata='''
        <SrcNoDataReal>%d</SrcNoDataReal>
        <SrcNoDataImag>%d</SrcNoDataImag>'''
warp_band_dst_nodata='''
        <DstNoDataReal>%d</DstNoDataReal>
        <DstNoDataImag>%d</DstNoDataImag>'''
warp_band_mapping_nodata='''>%s%s
      </BandMapping'''
warp_src_gcp_transformer='''            <SrcGCPTransformer>
              <GCPTransformer>
                <Order>%d</Order>
                <Reversed>0</Reversed>
                <GCPList>
%s
                </GCPList>
              </GCPTransformer>
            </SrcGCPTransformer>'''
warp_src_tps_transformer='''            <SrcTPSTransformer>
              <TPSTransformer>
                <Reversed>0</Reversed>
                <GCPList>
%s
                </GCPList>
              </TPSTransformer>
            </SrcTPSTransformer>'''

gcp_templ='    <GCP Id="%s" Pixel="%r" Line="%r" X="%r" Y="%r" Z="%r"/>'
gcplst_templ='  <GCPList Projection="%s">\n%s\n  </GCPList>\n'
geotr_templ='  <GeoTransform> %r, %r, %r, %r, %r, %r</GeoTransform>\n'
meta_templ='  <Metadata>\n%s\n  </Metadata>\n'
band_templ='''  <VRTRasterBand dataType="Byte" band="%(band)d">
    <ColorInterp>%(color)s</ColorInterp>
    <ComplexSource>
      <SourceFilename relativeToVRT="0">%(src)s</SourceFilename>
      <SourceBand>%(srcband)d</SourceBand>
      <SourceProperties RasterXSize="%(xsize)d" RasterYSize="%(ysize)d" DataType="Byte" BlockXSize="%(blxsize)d" BlockYSize="%(blysize)d"/>
      <SrcRect xOff="0" yOff="0" xSize="%(xsize)d" ySize="%(ysize)d"/>
      <DstRect xOff="0" yOff="0" xSize="%(xsize)d" ySize="%(ysize)d"/>
      <ColorTableComponent>%(band)d</ColorTableComponent>
    </ComplexSource>
  </VRTRasterBand>
'''
srs_templ='  <SRS>%s</SRS>\n'
vrt_templ='''<VRTDataset rasterXSize="%(xsize)d" rasterYSize="%(ysize)d">
%(metadata)s%(srs)s%(geotr)s%(gcp_list)s%(band_list)s</VRTDataset>
'''

# telmplate for tilemap.xml
tilemap_templ='''<?xml version="1.0" encoding="UTF-8" ?>

<!-- Generated by gdal_tiler.py (http://code.google.com/p/tilers-tools/) -->

<TileMap version="1.0.0" tilemapservice="http://tms.osgeo.org/1.0.0">
  <Title>%(title)s</Title>
  <Abstract>%(description)s</Abstract>
  <SRS>%(tms_srs)s</SRS>
  <BoundingBox minx="%(minx).11G" miny="%(miny).11G" maxx="%(maxx).11G" maxy="%(maxy).11G" />
  <Origin x="%(origin_x).11G" y="%(origin_y).11G" />
  <TileFormat width="%(tile_width)d" height="%(tile_height)d" mime-type="%(tile_mime)s" extension="%(tile_ext)s" />
  <TileSets profile="%(tms_profile)s">
%(tilesets)s
  </TileSets>
</TileMap>
'''

tile_set_templ='    <TileSet href="%(href)s" units-per-pixel="%(units_per_pixel).11G" order="%(order).11G" />'

resampling_map={
    'near':     Image.NEAREST,
    'nearest':  Image.NEAREST,
    'bilinear': Image.BILINEAR,
    'bicubic':  Image.BICUBIC,
    'antialias':Image.ANTIALIAS,
    }
def resampling_lst(): return resampling_map.keys()
    
base_resampling_map={
    'near':         'NearestNeighbour', 
    'nearest':      'NearestNeighbour', 
    'bilinear':     'Bilinear',
    'cubic':        'Cubic',
    'cubicspline':  'CubicSpline',
    'lanczos':      'Lanczos',
    }
def base_resampling_lst(): return base_resampling_map.keys()

#############################

class Pyramid(object):
    '''Tile pyramid generator and utilities'''
#############################

    tile_sz=(256,256) # tile resolution in pixels

    #----------------------------

    def __init__(self,src=None,dest=None,options=None):

    #----------------------------
        gdal.UseExceptions()

        self.src=src
        self.dest=dest
        self.options=options

        self.temp_files=[]
        self.palette=None
        self.transparency=None
        self.zoom_range=None

        self.init_tile_grid()

    #----------------------------

    def __del__(self):

    #----------------------------
        try:
            if self.options.verbose < 2:
                for f in self.temp_files:
                    os.remove(f)
        except: pass

    #----------------------------

    def init_tile_grid(self):
        # init tile grid parameters
    #----------------------------

        self.proj=self.srs # self.proj may be changed later to avoid crossing longitude 180 
        self.longlat=proj_cs2geog_cs(self.proj)
        ld('proj,longlat',self.proj,self.longlat)

        self.proj2geog=MyTransformer(SRC_SRS=self.proj,DST_SRS=self.longlat)
        max_x=self.proj2geog.transform_point((180,0),inv=True)[0] # Equator's half length 

        # dimentions of a tile at zoom 0
        res0=max_x*2/(self.zoom0_tiles[0]*self.tile_sz[0])
        self.zoom0_res=[res0,-res0]

        # coordinates of the upper left corner of the world raster
        self.pix_origin=[ -max_x, -self.zoom0_res[1]*self.tile_sz[1]*self.zoom0_tiles[1]/2 ]

        self.tile_origin=self.pix2coord(0,self.zoom0_origin)
        ld('zoom0_tiles',self.zoom0_tiles,'pix_origin',self.pix_origin,'tile_direction',self.tile_direction)

        # set map bounds to the maximum values
        self.bounds=[self.pix2coord(0,(0,0)), # upper left
                    self.pix2coord(0,(self.zoom0_tiles[0]*self.tile_sz[0],
                                      self.zoom0_tiles[1]*self.tile_sz[1])) # lower right
                    ]
    
    #----------------------------

    def init_map(self,zoom_parm):
        'initialize geo-parameters and generate base zoom level'
    #----------------------------

        # init variables
        self.src_path=self.src
        self.tiles_prefix=options.tiles_prefix
        self.tile_ext=options.tile_format.lower()        
        self.src_dir,src_f=os.path.split(self.src)
        self.base=os.path.splitext(src_f)[0]
        self.base_resampling=base_resampling_map[options.base_resampling]
        self.resampling=resampling_map[options.overview_resampling]

        pf('\n%s -> %s '%(self.src,self.dest),end='')

        if os.path.isdir(self.dest):
#            if options.noclobber and os.path.exists(os.path.join(self.dest,'merge-cache')):
            if options.noclobber and os.path.exists(self.dest):
                pf('*** Target already exists: skipping',end='')
                return False
            else:
                shutil.rmtree(self.dest,ignore_errors=True)

        # connect to src dataset
        self.get_src_ds()

        # calculate zoom range
        self.calc_zoom(zoom_parm)
        self.max_zoom=self.zoom_range[0]        
             
        # shift target SRS to avoid crossing 180 meridian
        shifted_srs=self.shift_srs(self.max_zoom)
        shift_x=MyTransformer(SRC_SRS=shifted_srs,DST_SRS=self.proj).transform_point((0,0))[0]
        if shift_x != 0:
            ld('new_srs',shifted_srs,'shift_x',shift_x,'pix_origin',self.pix_origin)
            self.pix_origin[0]-=shift_x
            self.proj=shifted_srs
            self.proj2geog=MyTransformer(SRC_SRS=self.proj,DST_SRS=self.longlat)

        # get corners at the target SRS
        target_ds=gdal.AutoCreateWarpedVRT(self.src_ds,None,proj4wkt(shifted_srs))
        target_bounds=MyTransformer(target_ds).transform([
            (0,0),
            (target_ds.RasterXSize,target_ds.RasterYSize)])

        # clip to the max tileset area (set at the __init__)

        self.bounds[0][0]=max(self.bounds[0][0],target_bounds[0][0])
        self.bounds[0][1]=min(self.bounds[0][1],target_bounds[0][1])
        self.bounds[1][0]=min(self.bounds[1][0],target_bounds[1][0])
        self.bounds[1][1]=max(self.bounds[1][1],target_bounds[1][1])

#        ld('target raster')
#        ld('Upper Left',self.bounds[0],target_bounds[0],self.proj2geog.transform([self.bounds[0],target_bounds[0]]))
#        ld('Lower Right',self.bounds[1],target_bounds[1],self.proj2geog.transform([self.bounds[1],target_bounds[1]]))
        
        return True
        
    #----------------------------

    def get_src_ds(self):
        'get src dataset, convert to RGB(A) if required'
    #----------------------------
        override_srs=self.options.srs
        
        if os.path.exists(self.src):
            self.src_path=os.path.abspath(self.src)

        # check for source raster type
        src_ds=gdal.Open(self.src_path,GA_ReadOnly)
        self.src_ds=src_ds
        self.description=self.src_ds.GetMetadataItem('DESCRIPTION')

        # source is successfully opened, then create destination dir
        os.makedirs(self.dest)

        src_geotr=src_ds.GetGeoTransform()
        src_proj=wkt2proj4(src_ds.GetProjection())
        gcps=src_ds.GetGCPs()
        if gcps:
            ld('src GCPsToGeoTransform',gdal.GCPsToGeoTransform(gcps))

        if not src_proj and gcps :
            src_proj=wkt2proj4(src_ds.GetGCPProjection())

        if self.options.srs is not None:
            src_proj=self.options.srs

        ld('src_proj',src_proj,'src geotr',src_geotr)
        assert src_proj, 'The source does not have a spatial reference system assigned'

        src_bands=src_ds.RasterCount
        band1=src_ds.GetRasterBand(1)
        if src_bands == 1 and band1.GetColorInterpretation() == GCI_PaletteIndex : # source is a paletted raster
            transparency=None
            if self.base_resampling == 'NearestNeighbour' and self.resampling == Image.NEAREST :
                # check if src can be rendered in paletted mode
                color_table=band1.GetColorTable()
                ncolors=color_table.GetCount()
                palette=[color_table.GetColorEntry(i) for i in range(ncolors)]
                r,g,b,a=zip(*palette)
                pil_palette=flatten(zip(r,g,b))             # PIL doesn't support RGBA palettes
                if self.options.dst_nodata is not None:
                    transparency=int(self.options.dst_nodata.split(',')[0])
                elif min(a) == 0:
                    transparency=a.index(0)
                elif ncolors < 256:
                    pil_palette+=[0,0,0]                   # the last color added is for transparency
                    transparency=len(pil_palette)/3-1

            ld('transparency',transparency)
            if transparency is not None: # render in paletted mode
                self.transparency=transparency
                self.palette=pil_palette
                ld('self.palette',self.palette)

            else: # convert src to rgb VRT
                if not src_geotr or src_geotr == (0.0, 1.0, 0.0, 0.0, 0.0, 1.0):
                    geotr_txt=''
                else:
                    geotr_txt=geotr_templ % src_geotr

                gcplst_txt=''
                if gcps:
                    gcp_lst='\n'.join((gcp_templ % (g.Id,g.GCPPixel,g.GCPLine,g.GCPX,g.GCPY,g.GCPZ) 
                                        for g in gcps))
                    if self.options.srs is None:
                        gcp_proj=wkt2proj4(src_ds.GetGCPProjection())
                    else:
                        gcp_proj=src_proj
                    gcplst_txt=gcplst_templ % (gcp_proj,gcp_lst)

                metadata=src_ds.GetMetadata()
                if metadata:
                    mtd_lst=[xml_txt('MDI',metadata[mdkey].encode('utf-8'),4,key=mdkey) for mdkey in metadata]
                    meta_txt=meta_templ % '\n'.join(mtd_lst)
                else:
                    meta_txt=''

                xsize,ysize=(src_ds.RasterXSize,src_ds.RasterYSize)
                blxsize,blysize=band1.GetBlockSize()

                band_lst=''.join((band_templ % {
                    'band':     band,
                    'color':    color,
                    'src':      self.src_path,
                    'srcband':  1,
                    'xsize':    xsize,
                    'ysize':    ysize,
                    'blxsize':  blxsize,
                    'blysize':  blysize,
                    } for band,color in ((1,'Red'),(2,'Green'),(3,'Blue'))))
                vrt_txt=vrt_templ % {
                    'xsize':    xsize,
                    'ysize':    ysize,
                    'metadata': meta_txt,
                    'srs':      (srs_templ % src_proj) if src_proj else '',
                    'geotr':    geotr_txt,
                    'gcp_list': gcplst_txt,
                    'band_list':band_lst,
                    }

                src_vrt=os.path.join(self.dest,self.base+'.src.vrt') # auxilary VRT file
                self.temp_files.append(src_vrt)
                self.src_path=src_vrt
                with open(src_vrt,'w') as f:
                    f.write(vrt_txt)

                self.src_ds=gdal.Open(src_vrt,GA_ReadOnly)
                return # rgb VRT created
            # finished with a paletted raster

        if override_srs is not None: # src SRS needs to be relpaced
            src_vrt=os.path.join(self.dest,self.base+'.src.vrt') # auxilary VRT file
            self.temp_files.append(src_vrt)
            self.src_path=src_vrt

            vrt_drv = gdal.GetDriverByName('VRT')
            self.src_ds = vrt_drv.CreateCopy(src_vrt,src_ds) # replace src dataset

            self.src_ds.SetProjection(proj4wkt(override_srs)) # replace source SRS
            gcps=self.src_ds.GetGCPs()
            if gcps :
                self.src_ds.SetGCPs(gcps,proj4wkt(override_srs))

        # debug print
#        src_origin,src_extent=MyTransformer(src_ds).transform([(0,0),(src_ds.RasterXSize,src_ds.RasterYSize)])
#        src_proj=wkt2proj4(src_ds.GetProjection())
#        src_proj2geog=MyTransformer(SRC_SRS=src_proj,DST_SRS=proj_cs2geog_cs(src_proj))
#        ld('source_raster')
#        ld('Upper Left',src_origin,src_proj2geog.transform([src_origin]))
#        ld('Lower Right',src_extent,src_proj2geog.transform([src_extent]))        

    #----------------------------

    def shift_srs(self,zoom=None):
        'change prime meridian to allow charts crossing 180 meridian'
    #----------------------------
        ul,lr=MyTransformer(self.src_ds,DST_SRS=self.longlat).transform([
            (0,0),
            (self.src_ds.RasterXSize,self.src_ds.RasterYSize)])
        ld('shift_srs ul',ul,'lr',lr)
        if lr[0] <= 180 and ul[0] >=-180 and ul[0] < lr[0]:
            return self.proj

        left_lon=ul[0]
        if zoom is not None: # adjust to a tile boundary
            left_xy=self.proj2geog.transform_point((left_lon,0),inv=True)
            tile_left_xy=self.tile_bounds(self.coord2tile(zoom,left_xy))[0]
            left_lon=self.proj2geog.transform_point(tile_left_xy)[0]
        lon_0=left_lon+180
        ld('left_lon',left_lon,'lon_0',lon_0)
        new_srs='%s +lon_0=%d' % (self.proj,lon_0)
        if not (lr[0] <= 180 and ul[0] >=-180):
            new_srs+=' +over +wktext' # allow for a map to span beyond -180 -- +180 range
        return new_srs

    #----------------------------

    def calc_zoom(self,zoom_parm):
        'determine and set a list of zoom levels to generate'
    #----------------------------

        # check raster parameters to find default zoom range
        ld('automatic zoom levels')

        # modify target srs to allow charts crossing meridian 180
        shifted_srs=self.shift_srs()

        t_ds=gdal.AutoCreateWarpedVRT(self.src_ds,None,proj4wkt(shifted_srs))
        geotr=t_ds.GetGeoTransform()
        res=(geotr[1], geotr[5])
        max_zoom=max(self.res2zoom_xy(res))

        # calculate min_zoom
        ul_c=(geotr[0], geotr[3])
        lr_c=gdal.ApplyGeoTransform(geotr,t_ds.RasterXSize,t_ds.RasterYSize)
        wh=(lr_c[0]-ul_c[0],lr_c[1]-ul_c[1])
        ld('ul_c,lr_c,wh',ul_c,lr_c,wh)
        min_zoom=min(self.res2zoom_xy([wh[i]/self.tile_sz[i]for i in (0,1)]))

        self.set_zoom_range(zoom_parm,(min_zoom,max_zoom))

    #----------------------------

    def make_raster(self,zoom):

    #----------------------------

        # adjust raster extents to tile boundaries
        tile_ul,tile_lr=self.corner_tiles(zoom)
        ld('base_raster')
        ld('tile_ul',tile_ul,'tile_lr',tile_lr)
        ul_c=self.tile_bounds(tile_ul)[0]
        lr_c=self.tile_bounds(tile_lr)[1]
        ul_pix=self.tile_pixbounds(tile_ul)[0]
        lr_pix=self.tile_pixbounds(tile_lr)[1]

        # base zoom level raster size
        dst_xsize=lr_pix[0]-ul_pix[0] 
        dst_ysize=lr_pix[1]-ul_pix[1]        

        ld('target Upper Left',self.bounds[0],ul_c,self.proj2geog.transform([self.bounds[0],ul_c]))
        ld('target Lower Right',self.bounds[1],lr_c,self.proj2geog.transform([self.bounds[1],lr_c]))
        ld('pix_origin',self.pix_origin,'ul_c+c_off',map(operator.add,ul_c,self.pix_origin))

        # create VRT for base image warp

        # generate warp transform
        src_geotr=self.src_ds.GetGeoTransform()
        src_proj=wkt2proj4(self.src_ds.GetProjection())
        gcp_proj=None

        if not self.options.tps and src_geotr and src_geotr != (0.0, 1.0, 0.0, 0.0, 0.0, 1.0):
            ok,src_igeotr=gdal.InvGeoTransform(src_geotr)
            assert ok
            src_transform='%s\n%s' % (warp_src_geotr % src_geotr,warp_src_igeotr % src_igeotr)
        else:
            gcps=self.src_ds.GetGCPs()
            assert gcps, 'Neither geotransform, nor gpcs are in the source file %s' % self.src

            gcp_lst=[(g.Id,g.GCPPixel,g.GCPLine,g.GCPX,g.GCPY,g.GCPZ) for g in gcps]
            ld('src_proj',self.src_ds.GetProjection())
            ld('gcp_proj',self.src_ds.GetGCPProjection())
            gcp_proj=wkt2proj4(self.src_ds.GetGCPProjection())
            if src_proj and gcp_proj != src_proj:
                coords=MyTransformer(SRC_SRS=gcp_proj,DST_SRS=src_proj).transform([g[3:6] for g in gcp_lst])
                gcp_lst=[tuple(p[:3]+c) for p,c in zip(gcp_lst,coords)]

            gcp_txt='\n'.join((gcp_templ % g for g in gcp_lst))
            #src_transform=warp_src_gcp_transformer % (0,gcp_txt)
            src_transform=warp_src_tps_transformer % gcp_txt

        res=self.zoom2res(zoom)
        #ul_ll,lr_ll=self.coords2longlat([ul_c,lr_c])
        ld('max_zoom',zoom,'size',dst_xsize,dst_ysize,'-tr',res[0],res[1],'-te',ul_c[0],lr_c[1],lr_c[0],ul_c[1],'-t_srs',self.proj)
        dst_geotr=( ul_c[0], res[0],   0.0,
                    ul_c[1],    0.0, res[1] )
        ok,dst_igeotr=gdal.InvGeoTransform(dst_geotr)
        assert ok
        dst_transform='%s\n%s' % (warp_dst_geotr % dst_geotr,warp_dst_igeotr % dst_igeotr)

        # generate warp options
        warp_options=[]
        def w_option(name,value): # warp options template
            return '    <Option name="%s">%s</Option>' % (name,value)

        warp_options.append(w_option('INIT_DEST','NO_DATA'))

        # generate cut line
        if self.options.cut or self.options.cutline:
            cut_wkt=self.get_cutline()
        else:
            cut_wkt=None
        if cut_wkt:
            warp_options.append(w_option('CUTLINE',cut_wkt))
            if self.options.blend_dist:
                warp_options.append(w_option('CUTLINE_BLEND_DIST',self.options.blend_dist))

        src_bands=self.src_ds.RasterCount
        ld('src_bands',src_bands)

        # process nodata info
        src_nodata=None
        if self.options.src_nodata:
            src_nodata=map(int,options.src_nodata.split(','))
            assert len(src_nodata) == src_bands, 'Nodata must match the number of bands'
            if src_bands > 1:
                warp_options.append(w_option('UNIFIED_SRC_NODATA','YES'))
        dst_nodata=None
        if self.palette is not None:
            dst_nodata=[self.transparency]
        ld('nodata',src_nodata,dst_nodata)
        
        # src raster bands mapping
        vrt_bands=[]
        wo_BandList=[]
        for i in range(src_bands):
            vrt_bands.append(warp_band % (i+1,'/'))
            if src_nodata or dst_nodata:
                band_mapping_info=warp_band_mapping_nodata % (
                        warp_band_src_nodata % (src_nodata[i],0) if src_nodata else '',
                        warp_band_dst_nodata % (dst_nodata[i],0) if dst_nodata else '')
            else:
                band_mapping_info='/'
            wo_BandList.append(warp_band_mapping % (i+1,i+1,band_mapping_info))

        if src_bands < 4 and self.palette is None:
            vrt_bands.append(warp_band % (src_bands+1,warp_band_color % 'Alpha'))

        block_sz=self.tile_sz

        vrt_text=warp_vrt % {
            'xsize':            dst_xsize,
            'ysize':            dst_ysize,
            'srs':              self.proj,
            'geotr':            geotr_templ % dst_geotr,
            'band_list':        '\n'.join(vrt_bands),
            'blxsize':          block_sz[0],
            'blysize':          block_sz[1],
            'wo_ResampleAlg':   self.base_resampling,
            'wo_src_path':      self.src_path,
            'warp_options':     '\n'.join(warp_options),
            'wo_src_srs':       gcp_proj if gcp_proj else src_proj,
            'wo_dst_srs':       self.proj,
            'wo_src_transform': src_transform,
            'wo_dst_transform': dst_transform,
            'wo_BandList':      '\n'.join(wo_BandList),
            'wo_DstAlphaBand':  warp_dst_alpha_band % (src_bands+1) if src_bands < 4  and self.palette is None else '',
            'wo_Cutline':       (warp_cutline % cut_wkt) if cut_wkt else '',
            }

        temp_vrt=os.path.join(self.dest,self.base+'.tmp.vrt') # auxilary VRT file
        self.temp_files.append(temp_vrt)
        with open(temp_vrt,'w') as f:
            f.write(vrt_text)

        # warp base raster
        base_ds = gdal.Open(vrt_text,GA_ReadOnly)
        pf('.',end='')
        
        # close datasets in a proper order
        del self.src_ds

        # create base_image raster
        self.base_img=BaseImg(base_ds,self.tile_sz,tile_ul[1:],tile_lr[1:],self.transparency)

    #----------------------------

    def get_cutline(self):

    #----------------------------
        cutline=self.src_ds.GetMetadataItem('CUTLINE')
        ld('cutline',cutline)
        if cutline and not self.options.cutline:
            return cutline

        # try to find an external cut line
        if self.options.cutline:
            cut_file=self.options.cutline
        else: # try to find a file with a cut shape
            for ext in ('.gmt','.shp','.kml'):
                cut_file=os.path.join(self.src_dir,self.base+ext)
                if os.path.exists(cut_file):
                    break
            else:
                return None

        feature_name=self.base if self.options.cutline_match_name else None
        return shape2cutline(cut_file,self.src_ds,feature_name)

    #----------------------------

    def walk_pyramid(self):
        'generate pyramid'
    #----------------------------

        if not self.init_map(options.zoom):
            return

        # create a raster source for a base zoom
        self.make_raster(self.max_zoom)

        self.name=os.path.basename(self.dest)

        # map 'logical' tiles to 'physical' tiles
        self.tile_map={}
        for zoom in self.zoom_range:
            tile_ul,tile_lr=self.corner_tiles(zoom)
            zoom_tiles=flatten([[(zoom,x,y) for x in range(tile_ul[1],tile_lr[1]+1)] 
                                           for y in range(tile_ul[2],tile_lr[2]+1)])
            #ld('zoom_tiles',zoom_tiles,tile_ul,tile_lr)

            ntiles_x,ntiles_y=self.tiles_xy(zoom)

            zoom_tiles_map=dict([((z,x%ntiles_x,y),(z,x,y)) for z,x,y in zoom_tiles])
            self.tile_map.update(zoom_tiles_map)

        ld('min_zoom',zoom,'tile_ul',tile_ul,'tile_lr',tile_lr,'tiles',zoom_tiles_map)
        self.all_tiles=frozenset(self.tile_map)
        top_results=filter(None,map(self.proc_tile,zoom_tiles_map.keys()))

        # write top-level metadata (html/kml)
        self.write_metadata(None,[ch for img,ch,opacities in top_results])
        self.write_tilemap()
        
        # cache back tiles opacity
        file_opacities=[(self.tile_path(tile),opc)
            for tile,opc in flatten([opacities for img,ch,opacities in top_results])]
        try:
            pickle.dump(dict(file_opacities),open(os.path.join(self.dest, 'merge-cache'),'w'))
        except:
            logging.warning("opacity cache save failed")

    #----------------------------

    def proc_tile(self,tile):

    #----------------------------

        ch_opacities=[]
        ch_results=[]
        zoom,x,y=tile
        if zoom==self.max_zoom: # get from the base image
            src_tile=self.tile_map[tile]
            tile_img,opacity=self.base_img.get_tile(src_tile[1:])
            if tile_img and self.palette:
                tile_img.putpalette(self.palette)
        else: # merge children
            opacity=0
            child_zoom=self.zoom_range[self.zoom_range.index(zoom)-1] # child's zoom
            dz=int(2**(child_zoom-zoom))

            ch_mozaic=dict(flatten(
                [[((child_zoom,x*dz+dx,y*dz+dy),(dx*self.tile_sz[0]//dz,dy*self.tile_sz[1]//dz))
                               for dx in range(dz)]
                                   for dy in range(dz)]))
            children=self.all_tiles & frozenset(ch_mozaic)
            ch_results=filter(None,map(self.proc_tile,children))
            #ld('tile',tile,'children',children,'ch_results',ch_results)
            if len(ch_results) == 4 and all([opacities[0][1]==1 for img,ch,opacities in ch_results]):
                opacity=1
                mode_opacity=''
            else:
                opacity=-1
                mode_opacity='A'

            tile_img=None
            for img,ch,opacity_lst in ch_results:
                ch_img=img.resize([i//dz for i in img.size],self.resampling)
                ch_mask=ch_img.split()[-1] if 'A' in ch_img.mode else None

                if tile_img is None:
                    if 'P' in ch_img.mode:
                        tile_mode='P'
                    else:
                        tile_mode=('L' if 'L' in ch_img.mode else 'RGB')+mode_opacity

                    if self.transparency is not None:
                        tile_img=Image.new(tile_mode,self.tile_sz,self.transparency)
                    else:
                        tile_img=Image.new(tile_mode,self.tile_sz)
                    if self.palette is not None:
                        tile_img.putpalette(self.palette)

                tile_img.paste(ch_img,ch_mozaic[ch],ch_mask)
                ch_opacities.extend(opacity_lst)

        if tile_img is not None and opacity != 0:
            self.write_tile(tile,tile_img)
            
            # write tile-level metadata (html/kml)            
            self.write_metadata(tile,[ch for img,ch,opacities in ch_results])
            return tile_img,tile,[(tile,opacity)]+ch_opacities

    #----------------------------

    def write_tile(self,tile,tile_img):

    #----------------------------
        rel_path=self.tile_path(tile)
        full_path=os.path.join(self.dest,rel_path)
        try:
            os.makedirs(os.path.dirname(full_path))
        except: pass

        if self.options.paletted and self.tile_ext == 'png':
            try:
                tile_img=tile_img.convert('P', palette=Image.ADAPTIVE, colors=255)
            except ValueError:
                #ld('tile_img.mode',tile_img.mode)
                pass

        if self.transparency is not None:
            tile_img.save(full_path,transparency=self.transparency)
        else:
            tile_img.save(full_path)
        
        self.counter()

    #----------------------------

    def map_tiles2longlat_bounds(self,tiles):
        'translate "logical" tiles to latlong boxes'
    #----------------------------
        # via 'logical' to 'physical' tile mapping
        return self.bounds_lst2longlat([self.tile_bounds(self.tile_map[t]) for t in tiles])

    #----------------------------

    def tile_path(self,tile):
        'relative path to a tile'
    #----------------------------
        z,x,y=tile
        return '%i/%i/%i.%s' % (z,x,y if self.tile_direction[1]==-1 else self.tiles_xy(z)[1]-1-y,self.tile_ext)

    #----------------------------

    def write_metadata(self,tile,children=[]): 

    #----------------------------
        pass # 'virtual'

    #----------------------------

    def write_tilemap(self):
        '''Generate xml with pseudo-tms tileset description'''
    #----------------------------
        tile_mime={
            'png':  'image/png',
            'jpeg': 'image/jpeg',
            'jpg':  'image/jpeg',
            } [self.tile_ext]

        # reproject extents back to the origina SRS
        bounds=MyTransformer(DST_SRS=self.srs,SRC_SRS=self.proj).transform(self.bounds)

        tilesets=[tile_set_templ % dict(
                href=str(zoom),
                order=zoom,
                units_per_pixel=self.zoom2res(zoom)[0],
                ) for zoom in reversed(self.zoom_range)]

        tilemap_txt=tilemap_templ % dict(
            title=      self.name,
            description=self.description,
            tms_srs=    self.tms_srs,
            tms_profile=self.tms_profile,
            tile_width= self.tile_sz[0],
            tile_height=self.tile_sz[1],
            tile_ext=   self.tile_ext,
            tile_mime=  tile_mime,
            origin_x=   self.tile_origin[0],
            origin_y=   self.tile_origin[1],
            minx=       bounds[0][0],
            miny=       bounds[1][1],
            maxx=       bounds[1][0],
            maxy=       bounds[0][1],
            tilesets=   '\n'.join(tilesets),
            )
        open(os.path.join(self.dest,'tilemap.xml'),'w').write(tilemap_txt)

    #----------------------------
    #
    # utility functions
    #    
    #----------------------------

    @staticmethod
    def profile_class(profile_name):
        for cls in profile_map:
            if cls.profile == profile_name:
                return cls
        else:
            raise Exception("Invalid profile: %s" % profile_name)

    @staticmethod
    def profile_lst(tty=False):
        if not tty:
            return [c.profile for c in profile_map]    
        print('\nOutput profiles and compatibility:\n')
        [print('%10s - %s' % (c.profile,c.__doc__)) for c in profile_map]
        print()

    def zoom2res(self,zoom):
        return map(lambda res: res/2**zoom, self.zoom0_res)

    def res2zoom_xy(self,res):
        'resolution to zoom levels (separate for x and y)'
        z=[int(math.floor(math.log(self.zoom0_res[i]/res[i],2))) for i in (0,1)]
        return [v if v>0 else 0 for v in z]

    def pix2tile(self,zoom,pix_coord):
        'pixel coordinates to tile (z,x,y)'
        return [zoom]+[pix_coord[i]//self.tile_sz[i] for i in (0,1)]

    def pix2tile_new(self,zoom,pix_coord):
        'pixel coordinates to tile (z,x,y)'
        res=self.zoom2res(zoom)
        ld(res)
        tile_xy=[int(round(
                    (pix_coord[i]*res[i]-self.pix_origin[i]-self.tiles_origin[i])/res[i]
                )) // self.tile_sz[i] for i in (0,1)]
        return [zoom]+[(tile_xy[i] if self.tile_direction[i] != -1 else -tile_xy[i]+1) for i in (0,1)]

#    pix2tile=pix2tile_new
    
    def tile2pix(self,tile):
        'pixel coordinates of the upper left corner of a tile'
        return map(operator.mul,self.tile_sz,tile[1:])

    def tile2pix_new(self,tile):
        'pixel coordinates of the upper left corner of a tile'
        res=self.zoom2res(zoom)
        tile_xy=[xy if d != -1 else -xy+1 for xy,d in zip(tile[1:],self.tile_direction)]
        pix=[tile_xy[i]*self.tile_sz[i]*res[i] for i in (0,1)]
        return zzzzz

#    tile2pix=tile2pix_new
    
    def coord2tile(self,zoom,coord):
        'cartesian coordinates to tile numbers'
        return self.pix2tile(zoom,self.coord2pix(zoom,coord))

    def tile_pixbounds(self,tile):
        'pixel coordinates of a tile'
        z,x,y=tile
        return [self.tile2pix((z,x,y)),self.tile2pix((z,x+1,y+1))]

    def tile_bounds(self,tile):
        "cartesian coordinates of a tile's corners"
        z=tile[0]
        return map(self.pix2coord,(z,z),self.tile_pixbounds(tile))

    def coord2pix(self,zoom,coord):
        'cartesian coordinates to pixel coordinates'
        res=self.zoom2res(zoom)
        return [int(round((coord[i]-self.pix_origin[i])/res[i])) for i in (0,1)]

    def pix2coord(self,zoom,pix_coord):
        res=self.zoom2res(zoom)
        return [pix_coord[i]*res[i]+self.pix_origin[i] for i in (0,1)]

    def tiles_xy(self,zoom):
        'number of tiles along X and Y axes'
        return map(lambda v: v*2**zoom,self.zoom0_tiles)

    def coords2longlat(self,coords):
        longlat=[i[:2] for i in self.proj2geog.transform(coords)]
        return longlat

    def bounds_lst2longlat(self,box_lst):
        deg_lst=self.coords2longlat(flatten(box_lst))
        ul_lst=deg_lst[0::2]
        lr_lst=deg_lst[1::2]
        return [[
            (ul[0] if ul[0] <  180 else ul[0]-360,ul[1]),
            (lr[0] if lr[0] > -180 else lr[0]+360,lr[1]),
            ] for ul,lr in zip(ul_lst,lr_lst)]

    def corner_tiles(self,zoom):
        p_ul=self.coord2pix(zoom,self.bounds[0])
        t_ul=self.pix2tile(zoom,(p_ul[0],p_ul[1]))

        p_lr=self.coord2pix(zoom,self.bounds[1])
        t_lr=self.pix2tile(zoom,(p_lr[0],p_lr[1]))

        nztiles=self.tiles_xy(zoom)
        box_ul,box_lr=[self.tile_bounds(t) for t in (t_ul,t_lr)]
        ld('corner_tiles zoom',zoom,
            'zoom tiles',nztiles,
            'zoom pixels',map(lambda zt,ts:zt*ts,nztiles,self.tile_sz),
            'p_ul',p_ul,'p_lr',p_lr,'t_ul',t_ul,'t_lr',t_lr,
            'longlat', self.coords2longlat([box_ul[0],box_lr[1]])
            )
        return t_ul,t_lr

    def set_zoom_range(self,zoom_parm,defaults=(0,22)):
        'set a list of zoom levels from a parameter list'

        if not zoom_parm:
            zoom_parm='%d:%d' % defaults

        zchunk_lst=[z.split(':') for z in zoom_parm.split(',')]
        zlist=[]
        for zchunk in zchunk_lst:
            if len(zchunk) == 1:
                zlist.append(int(zchunk[0]))
            else:
                # calculate zoom range
                zrange=[]
                for n,d in zip(zchunk,defaults):
                    if n == '':              # set to default
                        z=d
                    elif n.startswith('-'): # set to default - n
                        z=d-int(n[1:])
                    elif n.startswith('+'): # set to default + n
                        z=d+int(n[1:])
                    else:                   # set to n
                        z=int(n)
                    zrange.append(z)
                
                # update range list
                zlist+=range(min(zrange),max(zrange)+1)
                
        self.zoom_range=list(reversed(sorted(set(zlist))))
        ld('zoom_range',self.zoom_range,defaults)

    def belongs_to(self,tile):
        zoom,x,y=tile
        if self.zoom_range and zoom not in self.zoom_range:
            return False
        t_ul,t_lr=self.corner_tiles(zoom)
        return x>=t_ul[1] and y>=t_ul[2] and x<=t_lr[1] and y<=t_lr[2]

    def set_region(self,point_lst,source_srs=None):
        if source_srs and source_srs != self.proj:
            point_lst=MyTransformer(SRC_SRS=source_srs,DST_SRS=self.proj).transform(point_lst)

        x_coords,y_coords=zip(*point_lst)[0:2]
        upper_left=min(x_coords),max(y_coords)
        lower_right=max(x_coords),min(y_coords)
        self.bounds=[upper_left,lower_right]

    def load_region(self,datasource):
        if not datasource:
            return
        point_lst=flatten(shape2mpointlst(datasource,self.proj))
        self.set_region(point_lst)

    # progress display
    tick_rate=50
    count=0
    def counter(self):
        self.count+=1
        if self.count % self.tick_rate == 0:
            pf('.',end='')
            return True
        else:
            return False
# Pyramid        

#############################

class GenericMap(Pyramid):
    'full profile options are to be specified'
#############################
    profile='generic'
    defaul_ext='.generic'
    
    def __init__(self,src=None,dest=None,options=None):
        self.srs=options.t_srs
        assert self.proj, 'Target SRS is not specified'
        self.tile_sz=tuple(map(int,options.tile_size.split(',')))
        self.zoom0_tiles=map(int,options.zoom0_tiles.split(','))
        if options.tms:
            tile_direction=(1,1)
        else:
            tile_direction=(1,-1)

        super(GenericMap, self).__init__(src,dest,options)

#############################

class TilingScheme(object):

#############################
    pass

class ZXYtiling(TilingScheme):
    tile_direction=(1,-1)

class TMStiling(TilingScheme):
    tile_direction=(1,1)


#############################

class PlateCarree(Pyramid):
    'Plate Carrée, top-to-bottom tile numbering  (a la Google Earth)'
#############################
    zoom0_tiles=[2,1] # tiles at zoom 0

    tms_srs='EPSG:4326'

    # http://earth.google.com/support/bin/static.py?page=guide.cs&guide=22373&topic=23750
    # "Google Earth uses Simple Cylindrical projection for its imagery base. This is a simple map 
    # projection where the meridians and parallels are equidistant, straight lines, with the two sets 
    # crossing at right angles. This projection is also known as Lat/Lon WGS84"    
    
    # Equirectangular (EPSG:32662 aka plate carrée, aka Simple Cylindrical)
    # we use this because the SRS might be shifted later to work around 180 meridian
    srs = '+proj=eqc +datum=WGS84 +ellps=WGS84'

    # set units to degrees, this makes this SRS essentially equivalent to EPSG:4326
    srs += ' +to_meter=%f' % (
        MyTransformer(DST_SRS=srs,SRC_SRS=proj_cs2geog_cs(srs)
        ).transform_point((1,0))[0])

    def kml_child_links(self,children,parent=None,path_prefix=''):
        kml_links=[]
        # convert tiles to degree boxes
        longlat_boxes=self.map_tiles2longlat_bounds(children)
        
        for tile,longlat in zip(children,longlat_boxes):
            #ld(tile,longlat)
            w,n,e,s=['%.11f'%v for v in flatten(longlat)]
            name=os.path.splitext(self.tile_path(tile))[0]
            # fill in kml link template
            kml_links.append( kml_link_templ % { 
                'name':    name,
                'href':    path_prefix+'%s.kml' % name,
                'west':    w, 'north':    n,
                'east':    e, 'south':    s,
                'min_lod': 128,
                'max_lod': 2048 if parent else -1,
                })
        return ''.join(kml_links)

    def write_kml(self,rel_path,name,links='',overlay=''):
        kml= kml_templ % {
            'name':      name,
            'links':     links,
            'overlay':   overlay,
            'dbg_start': '' if options.verbose < 2 else '    <!--\n',
            'dbg_end':   '' if options.verbose < 2 else '      -->\n',
            }
        open(os.path.join(self.dest,rel_path+'.kml'),'w+').write(kml)

    def write_metadata(self,tile,children=[]):
        if not tile: # create top level kml
            self.write_kml(os.path.basename(self.base),os.path.basename(self.base),self.kml_child_links(children))
            return
        # fill in kml templates
        rel_path=self.tile_path(tile)
        name=os.path.splitext(rel_path)[0]
        kml_links=self.kml_child_links(children,tile,'../../')
        tile_box=self.map_tiles2longlat_bounds([tile])[0]
        w,n,e,s=['%.11G'%v for v in flatten(tile_box)]
        kml_overlay = kml_overlay_templ % {
            'name':    name,
            'href':    os.path.basename(rel_path),
            'min_lod': 128,
            'max_lod': 2048 if kml_links else -1,
            'order':   tile[0],
            'west':    w, 'north':    n,
            'east':    e, 'south':    s,
            }
        self.write_kml(name,name,kml_links,kml_overlay)
# PlateCarree

#############################

class PlateCarreeZXY(PlateCarree,ZXYtiling):
    'Plate Carrée, top-to-bottom tile numbering  (a la Google Earth)'
#############################
    profile='zxy-geo'
    defaul_ext='.geo'
    zoom0_origin=(0,0)
    tms_profile='zxy-geodetic' # non-standard profile

#############################

class PlateCarreeTMS(PlateCarree,TMStiling):
    'Plate Carrée, TMS tile numbering (bottom-to-top, global-geodetic - compatible tiles)'
#############################
    profile='tms-geo'
    defaul_ext='.tms-geo'
    zoom0_origin=(0,256)
    tms_profile='global-geodetic'

# PlateCarreeTMS

kml_templ='''<?xml version="1.0" encoding="utf-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">

<!-- Generated by gdal_tiler.py (http://code.google.com/p/tilers-tools/) -->

    <Document>
%(dbg_start)s        <Style> 
            <ListStyle id="hideChildren"> <listItemType>checkHideChildren</listItemType> </ListStyle>
        </Style>
%(dbg_end)s        <name>%(name)s</name>%(overlay)s%(links)s
    </Document>
</kml>
'''

kml_overlay_templ='''
        <Region> 
            <Lod> 
                <minLodPixels>%(min_lod)s</minLodPixels> 
                <maxLodPixels>%(max_lod)s</maxLodPixels>
            </Lod>
            <LatLonAltBox>
            	<west>%(west)s</west> <north>%(north)s</north>
            	<east>%(east)s</east> <south>%(south)s</south>
            </LatLonAltBox>
        </Region>
        <GroundOverlay>
            <name>%(name)s</name>
            <drawOrder>%(order)s</drawOrder>
            <Icon> <href>%(href)s</href> </Icon>
            <LatLonBox>
                <west>%(west)s</west> <north>%(north)s</north>
                <east>%(east)s</east> <south>%(south)s</south>
            </LatLonBox>
        </GroundOverlay>'''

kml_link_templ='''
        <NetworkLink>
            <name>%(name)s</name>
            <Region> 
                <Lod> 
                    <minLodPixels>%(min_lod)s</minLodPixels> 
                    <maxLodPixels>%(max_lod)s</maxLodPixels>
                </Lod>
                <LatLonAltBox>
                    <west>%(west)s</west> <north>%(north)s</north>
                    <east>%(east)s</east> <south>%(south)s</south>
                </LatLonAltBox>
            </Region>
            <Link> <viewRefreshMode>onRegion</viewRefreshMode>
                <href>%(href)s</href>
            </Link>
        </NetworkLink>'''

##############################

#class Yandex(Pyramid):
#    'Yandex Maps (WGS 84 / World Mercator, epsg:3395)'
##############################
#    profile='yandex'
#    defaul_ext='.yandex'
#    srs='+proj=merc +datum=WGS84 +ellps=WGS84'
## Yandex

#############################

class GMercator(Pyramid):
    'base class for Global Mercator'
#############################

    zoom0_tiles=[1,1] # tiles at zoom 0

    # Global Mercator (EPSG:3857)
    srs='+proj=merc +a=6378137 +b=6378137 +nadgrids=@null +wktext'

    tms_srs='OSGEO:41001' # http://wiki.osgeo.org/wiki/Tile_Map_Service_Specification
    
    def write_metadata(self,tile,children=[]): 
        if not tile: # create top level html
            self.write_html()

    def write_html(self):
        shutil.copy(os.path.join(data_dir(),'viewer-google.html'),self.dest)
        shutil.copy(os.path.join(data_dir(),'viewer-openlayers.html'),self.dest)

#############################

class GMercatorZXY(GMercator,ZXYtiling):
    'Global Mercator, top-to-bottom tile numbering (a la Google Maps, OSM etc)'
#############################
    profile='zxy'
    defaul_ext='.zxy'
    tms_profile='zxy-mercator' # non-standard profile

    zoom0_origin=(0,0)
    
#############################

class GMercatorTMS(GMercator,TMStiling):
    'Global Mercator, TMS tile numbering'
#############################
    profile='tms'
    defaul_ext='.tms'
    tms_profile='global-mercator'

    zoom0_origin=(0,256)

# GMercatorTMS

profile_map=(
    GMercatorZXY,
    GMercatorTMS,
    PlateCarreeZXY,
    PlateCarreeTMS,
#    Yandex,
    GenericMap,
    )

def proc_src(src):
    cls=Pyramid.profile_class(options.profile)
    ext= cls.defaul_ext if options.strip_dest_ext is None else ''
    dest=dest_path(src,options.dest_dir,ext)
    #
    cls(src,dest,options).walk_pyramid()

#----------------------------

def main(argv):

#----------------------------
    
    parser = OptionParser(
        usage = "usage: %prog <options>... input_file...",
        version=version,
        description='Tile cutter for GDAL-compatible raster maps')
    parser.add_option('-p','--profile','--to',dest="profile",metavar='PROFILE',
        default='zxy',choices=Pyramid.profile_lst(),
        help='output tiles profile (default: zxy)')
    parser.add_option("-l", "--list-profiles", action="store_true",
        help='list tile profiles')
    parser.add_option("-z", "--zoom", default=None,metavar="ZOOM_LIST",
        help='list of zoom ranges to generate')
    parser.add_option("--t-srs", default=None,metavar="TARGET_SRS",
        help='generic profile: PROJ.4 definition for target srs (default: None)')
    parser.add_option("--tile-size", default='256,256',metavar="SIZE_X,SIZE_Y",
        help='generic profile: tile size (default: 256,256)')
    parser.add_option("--zoom0-tiles", default='1,1',metavar="NTILES_X,NTILES_Y",
        help='generic profile: number of tiles along the axis at the zoom 0 (default: 1,1)')
    parser.add_option("--tms", action="store_true", 
        help='generic profile: generate TMS tiles (default: google)')
    parser.add_option("--srs", default=None,metavar="PROJ4_SRS",
        help="override source's spatial reference system with PROJ.4 definition")
    parser.add_option('--overview-resampling', default='nearest',metavar="METHOD1",
        choices=resampling_lst(),
        help='overview tiles resampling method (default: nearest)')
    parser.add_option('--base-resampling', default='nearest',metavar="METHOD2",
        choices=base_resampling_lst(),
        help='base image resampling method (default: nearest)')
    parser.add_option('-r','--release', action="store_true",
        help='set resampling options to (antialias,bilinear)')
    parser.add_option('--tps', action="store_true",
        help='Force use of thin plate spline transformer based on available GCPs)')
    parser.add_option("-c", "--cut", action="store_true", 
        help='cut the raster as per cutline provided')
    parser.add_option("--cutline", default=None, metavar="DATASOURCE",
        help='cutline data: OGR datasource')
    parser.add_option("--cutline-match-name",  action="store_true", 
        help='match OGR feature field "Name" against source name')
    parser.add_option("--cutline-blend", dest="blend_dist",default=None,metavar="N",
        help='CUTLINE_BLEND_DIST in pixels')
    parser.add_option("--src-nodata", dest="src_nodata", metavar='N[,N]...',
        help='Nodata values for input bands')
    parser.add_option("--dst-nodata", dest="dst_nodata", metavar='N',
        help='Assign nodata value for output paletted band')
    parser.add_option("--tiles-prefix", default='',metavar="URL",
        help='prefix for tile URLs at googlemaps.hml')
    parser.add_option("--tile-format", default='png',metavar="FMT",
        help='tile image format (default: PNG)')
    parser.add_option("--paletted", action="store_true", 
        help='convert tiles to paletted format (8 bit/pixel)')
    parser.add_option("-t", "--dest-dir", dest="dest_dir", default=None,
        help='destination directory (default: source)')
    parser.add_option("--noclobber", action="store_true", 
        help='skip processing if the target pyramyd already exists')
    parser.add_option("-s", "--strip-dest-ext", action="store_true",
        help='do not add a default extension suffix from a destination directory')
    parser.add_option("-q", "--quiet", action="store_const", 
        const=0, default=1, dest="verbose")
    parser.add_option("-d", "--debug", action="store_const", 
        const=2, dest="verbose")

    global options
    (options, args) = parser.parse_args(argv[1:])
    
    logging.basicConfig(level=logging.DEBUG if options.verbose==2 else 
        (logging.ERROR if options.verbose==0 else logging.INFO))

    ld(os.name)
    ld(options)
    
    if options.list_profiles:
        Pyramid.profile_lst(tty=True)
        sys.exit(0)

    if options.release:
        options.overview_resampling,options.base_resampling=('antialias','bilinear')

    if not args:
        parser.error('No input file(s) specified')
    try:
        sources=args
    except:
        raise Exception("No sources specified")

    parallel_map(proc_src,sources)
    pf('')

# main()

if __name__=='__main__':

    main(sys.argv)

