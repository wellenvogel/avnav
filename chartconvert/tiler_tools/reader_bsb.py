#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-04-11 10:58:17  

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

class BsbKapMap(SrcMap):
    magic='KNP/'
    data_file='reader_bsb_data.csv'

    def load_data(self):
        'load datum definitions, ellipses, projections from a file'
        self.datum_dict={}
        self.guess_dict={}
        self.knp_dict={}
        self.knq_dict={}
        csv_map={
            'datum':        (self.datum_dict,self.ini_lst),
            'datum_guess':  (self.guess_dict,self.ini_lst),
            'proj_knp':     (self.knp_dict,self.ini_map),
            'proj_knq':     (self.knq_dict,self.ini_map),
            }
        self.load_csv(self.data_file,csv_map)
            
    def get_header(self): 
        'read map header'
        header=[]
        with open(self.file,'rU') as f:
            for l in f:
                if '\x1A' in l:
                    break
                l=l.decode('iso8859-1','ignore')
                if l.startswith((' ','\t')):
                    header[-1] += ','+l.strip()
                else:
                    header.append(l.strip())
        ld(header)
        if not (header and any(((s.startswith('BSB/') or s.startswith('KNP/')) for s in header))): 
            raise Exception(" Invalid file: %s" % self.file)
        return header
        
    def get_layers(self):
        return [BsbLayer(self,self.header)]
# BsbKapMap

class BsbLayer(SrcLayer):

    def hdr_parms(self, patt): 
        'filter header for params starting with "patt/"'
        if patt != '!': 
            patt += '/'
        return [i[len(patt):] for i in self.data if i.startswith(patt)]

    def hdr_parms2list(self, knd):
        return [i.split(',') for i in self.hdr_parms(knd)]

    def hdr_parm2dict(self, knd):
        out={}
        for i in self.hdr_parms2list(knd)[0]:
            if '=' in i:
                (key,val)=i.split('=')
                out[key]=val
            else:
                out[key] += ','+i
        return out

    def get_dtm(self):
        'get DTM northing, easting'
        if self.map.options.dtm_shift is not None:
            dtm_parm=self.map.options.dtm_shift.split(',')
        else:
            try:
                dtm_parm=self.hdr_parms2list('DTM')[0]
                ld('DTM',dtm_parm)
            except IndexError: # DTM not found
                ld('DTM not found')
                dtm_parm=[0,0]
        dtm=[float(s)/3600 for s in reversed(dtm_parm)]
        return dtm if dtm != [0,0] else None

    def get_refs(self):
        'get a list of geo refs in tuples'
        refs=LatLonRefPoints(self,[(
            i[0],                                   # id
            (int(i[1]),int(i[2])),                  # pixel
            (float(i[4]),float(i[3]))               # lat/long
            ) for i in self.hdr_parms2list('REF')])
        return refs

    def get_plys(self):
        'boundary polygon'
        plys=RefPoints(self,latlong=[
                (float(i[2]),float(i[1]))           # lat/long
            for i in self.hdr_parms2list('PLY')])
        return plys

    def assemble_parms(self,parm_map,parm_info):    
        check_parm=lambda s: (s not in ['NOT_APPLICABLE','UNKNOWN']) and s.replace('0','').replace('.','')
        return ['+%s=%s' % (parm_map[i],parm_info[i]) for i in parm_map
                        if  i in parm_info and check_parm(parm_info[i])]

    def get_proj_id(self):
        return self.hdr_parm2dict('KNP')['PR']

    def get_proj(self):
        knp_info=self.hdr_parm2dict('KNP')
        ld(knp_info)
        proj_id=self.get_proj_id()
        try:            
            knp_parm=self.map.knp_dict[proj_id.upper()]
            ld(knp_parm)
        except KeyError: 
            raise Exception(' Unsupported projection %s' % proj_id)
        # get projection and parameters
        proj=[knp_parm['PROJ4']]
        try: # extra projection parameters for BSB 3.xx, put them before KNP parms
            knq_info=self.hdr_parm2dict('KNQ')
            ld(knq_info)
            knq_parm=self.map.knq_dict[proj_id.upper()]
            proj.extend(self.assemble_parms(knq_parm,knq_info))
        except IndexError:  # No KNQ
            pass
        except KeyError:    # No such proj in KNQ map
            pass
        proj.extend(self.assemble_parms(knp_parm,knp_info))
        return proj

    def get_datum_id(self):
        return self.hdr_parm2dict('KNP')['GD']

    def get_datum(self):
        datum_id=self.get_datum_id()
        try:
            datum=self.map.datum_dict[datum_id.upper()][0]
        except KeyError: 
            # try to guess the datum by comment and copyright string(s)
            crr=' '.join(self.hdr_parms('!')+self.hdr_parms('CRR'))
            try:
                datum=[self.map.guess_dict[crr_patt][0]
                    for crr_patt in self.map.guess_dict if crr_patt in crr][0]
                logging.warning(' Unknown datum "%s", guessed as "%s"' % (datum_id,datum))
            except IndexError:
                # datum still not found
                dtm=self.get_dtm() # get northing, easting to WGS84 if any
                datum='+datum=WGS84'
                if dtm: 
                    logging.warning(' Unknown datum %s, trying WGS 84 with DTM shifts' % datum_id)
                else: # assume DTM is 0,0
                    logging.warning(' Unknown datum %s, trying WGS 84' % datum_id)
        return datum.split(' ')

    def get_raster(self):
        return self.map.file

    def get_name(self):
        bsb_info=self.hdr_parm2dict('BSB') # general BSB parameters
        bsb_name=bsb_info['NA']
        return bsb_name
# BsbLayer

if __name__=='__main__':
    print('\nPlease use convert2gdal.py\n')
    sys.exit(1)

