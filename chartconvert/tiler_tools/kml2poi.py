#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 2011-05-15 17:27:24 

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

import os
import sys
import re
import logging
import optparse
import xml.dom.minidom
import sqlite3
import htmlentitydefs
import csv

from tiler_functions import *

def re_subs(sub_list,l):
    for (pattern,repl) in sub_list:
        l=re.sub(pattern,repl,l)
    return l

htmlentitydefs.name2codepoint['apos']=27

def strip_html(text):
    'Removes HTML markup from a text string. http://effbot.org/zone/re-sub.htm#strip-html'
    
    def replace(match): # pattern replacement function
        text = match.group(0)
        if text == "<br>":
            return "\n"
        if text[0] == "<":
            return "" # ignore tags
        if text[0] == "&":
            if text[1] == "#":
                try:
                    if text[2] == "x":
                        return unichr(int(text[3:-1], 16))
                    else:
                        return unichr(int(text[2:-1]))
                except ValueError:
                    pass
            else:
                return unichr(htmlentitydefs.name2codepoint[text[1:-1]])
        return text # leave as is
        # fixup end

    return re.sub("(?s)<[^>]*>|&#?\w+;", replace, text)

def attr_update(self,**updates):
        self.__dict__.update(updates)

class Category:
    def __init__(self,label):
        attr_update(self,label=label,enabled=1,desc='',cat_id=None,icons={})

    def update(self,enabled=None,desc=None,cat_id=None,icon=None, url=None):
        if icon:
            self.icons[icon]=url
        if desc:
            self.desc=desc
        if cat_id:
            self.cat_id=cat_id
        if enabled is not None:
            self.enabled= 1 if enabled else 0;

class Poi:
    def __init__(self,label=None,lat=None,lon=None,desc='',categ=None):
        if desc is None:
            desc=''
        attr_update(self,label=label,desc=desc,lat=lat,lon=lon,categ=categ.lower())

class Poi2Mapper:
    def __init__ (self,src,dest_db):
        attr_update(self,src=src,categories={},styles={},icons={},pois=[])
        if dest_db:
            self.base=os.path.splitext(dest_db)[0]
            self.dest_db=dest_db
        else:
            self.base=os.path.splitext(src[0])[0]
            self.dest_db=self.base+'.db'
        if os.path.exists(self.dest_db):
            if options.remove_dest:
                os.remove(self.dest_db)
            else:
                raise Exception('Destination already exists: %s' % self.dest_db)

    def categ_add_update(self,label=None,enabled=1,desc=None,cat_id=None,icon=None, url=None):
        if not icon:
            icon=label+'.jpg'
        if not label:
            label=re.sub(r'\.[^.]*$','',icon)
        categ=label.lower()
        ic_id=icon.lower()
        if ic_id not in self.icons:
            self.icons[ic_id]=categ
        else:
            categ=self.icons[ic_id]
        if categ not in self.categories:
            self.categories[categ]=Category(label)
        self.categories[categ].update(enabled=enabled,desc=desc,cat_id=cat_id,icon=icon, url=url)
        return categ

    def load_categ(self,src):
        path=os.path.splitext(src)[0] + '.categories'
        if os.path.exists(path):
            cats_lst=[[unicode(i.strip(),'utf-8') for i in l.split(',',4)] 
                        for l in open(path)]
            for d in cats_lst:
                try:
                    (enabled,icon,categ,desc) = d + [None for i in range(len(d),4)]
                    ld(enabled,icon,categ,desc)
                    if enabled not in ('0','1') or not categ:
                        continue
                    self.categ_add_update(categ,int(enabled),icon=icon,desc=desc)
                except: pass

    def read_db(self,path):
        cat_ids={}
        if os.path.exists(path):
            db=sqlite3.connect(path)
            dbc=db.cursor()
            dbc.execute('select * from category')
            for (cat_id,label,desc,enabled) in dbc:
                self.categ_add_update(label,enabled,desc=desc)
                cat_ids[cat_id]=label

            dbc.execute('select * from poi')
            for (poi_id,lat,lon,name,desc, cat_id) in dbc:
                self.pois.append(Poi(name,lat=lat,lon=lon,desc=desc,categ=cat_ids[cat_id]))
            db.close()

    def read_csv(self,path):
        col_id={
            'name': None,
            'desc': None,
            'lat':  None,
            'lon':  None,
            'categ':None,
            }
        csv.register_dialect('strip', skipinitialspace=True)
        with open(path,'rb') as data_f:
            data_csv=csv.reader(data_f,'strip')
            header=[s.decode('utf-8').lower() for s in data_csv.next()]

            for col in range(len(header)): # find relevant colunm numbers
                for id in col_id:
                    if header[col].startswith(id):
                        col_id[id]=col

            cat_ids={}
            for row in data_csv:
                row=[s.decode('utf-8') for s in row]
                poi_parms={}
                for col in col_id:
                    try:
                        poi_parms[col]=row[col_id[col]]
                    except:
                        poi_parms[col]=''                  
                if poi_parms['categ']:
                    icon=poi_parms['categ'].lower()+'.jpg'
                else:
                    icon='__undefined__.jpg'

                categ=self.categ_add_update(icon=icon)
                self.pois.append(Poi(
                    poi_parms['name'],
                    categ=categ,
                    lat=poi_parms['lat'],
                    lon=poi_parms['lon'],
                    desc=poi_parms['desc']
                    ))
                        
    def handleStyle(self,elm):
        url=None
        style_id=elm.getAttribute('id')
        ld(style_id)
        icon=u'__%s__.jpg' % style_id
        if elm.getElementsByTagName("IconStyle") != []:
            try:
                url=elm.getElementsByTagName("href")[0].firstChild.data
                icon=re.sub('^.*/','',url)
            except: pass
        elif elm.getElementsByTagName("PolyStyle") != []:
            icon=u'__polygon__.jpg'
        elif elm.getElementsByTagName("LineStyle") != []:
            icon=u'__line__.jpg'
        return (style_id, self.categ_add_update(None,icon=icon,url=url))
                    
    def get_coords(self,elm):
        coords=elm.getElementsByTagName("coordinates")[0].firstChild.data.split()
        return [map(float,c.split(',')) for c in coords]
        
    def handlePlacemark(self,pm):
        point=pm.getElementsByTagName("Point")
        if point == []:
            return None
        coords=self.get_coords(point[0])
        (lon,lat)=coords[0][0:2]

        label=pm.getElementsByTagName("name")[0].firstChild.data
        style_id=pm.getElementsByTagName("styleUrl")[0].firstChild.data[1:]
        style=self.styles[style_id]
        ld((label,style_id,style))
        if style.startswith('__') and style.endswith('__'):
            logging.warning(' No icon for "%s"' % label)
        desc=None
        try:
            desc_elm=pm.getElementsByTagName("description")[0]
            if desc_elm.firstChild:
                cdata=(desc_elm.firstChild.nodeType == self.doc.CDATA_SECTION_NODE)
                desc=desc_elm.firstChild.data
                if cdata:
                    desc=strip_html(desc)
        except IndexError:
            pass
        return Poi(label,lat=lat,lon=lon,desc=desc,categ=self.styles[style_id])

    def write_aux(self):
        cat_list=['# enabled, icon, category, desc']
        icon_urls=[]
        icon_aliases=[] #"ln -s '%s.db' 'poi.db'"  % self.base]
        icon_aliase_templ="ln -s '%s' '%s'"
        for (c_key,c) in self.categories.iteritems():
            for i_key in c.icons:
                cat_list.append('%i, %s, %s%s' % (c.enabled,i_key,c.label,((', '+c.desc) if c.desc else '')))
                url=c.icons[i_key]
                if url:
                    icon_urls.append("wget -nc '%s'" % url)
                if c_key+'.jpg' != i_key:
                    icon_aliases.append(icon_aliase_templ % (i_key, c_key+'.jpg'))
        with open(self.base+'.categories.gen','w') as f:
            for s in cat_list:
                print >>f, s
        with open(self.base+'.sh','w') as f:
            for ls in [icon_urls,icon_aliases]:
                for s in ls:
                    print >>f, s

    def proc_category(self,c):
        self.dbc.execute('insert into category (label, desc, enabled) values (?,?,?);',
            (c.label,c.desc,c.enabled))
        c.update(cat_id=self.dbc.lastrowid)
            
    def proc_poi(self,p):
        self.dbc.execute('insert into poi (lat, lon, label, desc, cat_id) values (?,?,?,?,?);',
            (p.lat,p.lon,p.label,p.desc,self.categories[p.categ].cat_id))

    def proc_src(self,src):
        pf(src)
        self.load_categ(src)
        try: # to open as kml file
            self.doc = xml.dom.minidom.parse(src)
            self.name=[n for n in self.doc.getElementsByTagName("Document")[0].childNodes 
                        if n.nodeType == n.ELEMENT_NODE and n.tagName == 'name'][0].firstChild.data

            self.styles=dict(map(self.handleStyle,self.doc.getElementsByTagName("Style")))
            self.pois+=filter(None,map(self.handlePlacemark,self.doc.getElementsByTagName("Placemark")))
            self.doc.unlink()
        except IOError:
            logging.warning(' No input file: %s' % src)
        except xml.parsers.expat.ExpatError:
            try: # to open as db
                self.read_db(src)
            except sqlite3.DatabaseError:
                try: # to open as csv
                    self.read_csv(src)
                except csv.Error:
                    raise Exception('Invalid input file: %s' % src)

    def proc_all(self):
        map(self.proc_src, self.src)

        self.db=sqlite3.connect(self.dest_db)
        self.dbc = self.db.cursor()
        try:
            self.db.execute ('''
                create table category (cat_id integer PRIMARY KEY, label text, desc text, enabled integer);
                ''')
            self.db.execute ('''
                create table poi (poi_id integer PRIMARY KEY, lat real, lon real, label text, desc text, cat_id integer);
                ''')
        except:
            pass

        map(self.proc_category,self.categories.itervalues())
        map(self.proc_poi,self.pois)
        self.db.commit()
        self.db.close()
        self.write_aux()

if __name__=='__main__':
    parser = optparse.OptionParser(
        usage="usage: %prog [-o <output_db>] [<kml_file>]... [<input_db>]...",
        version=version,
        description="makes maemo-mapper POI db from a kml file(s)")
    parser.add_option("-d", "--debug", action="store_true", dest="debug")
    parser.add_option("-q", "--quiet", action="store_true", dest="quiet")
    parser.add_option("-r", "--remove-dest", action="store_true",
        help='delete destination before processing')
    parser.add_option("-o", "--output",dest="dest_db", 
                      type="string",help="output POIs db file")

    (options, args) = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if options.debug else 
        (logging.ERROR if options.quiet else logging.INFO))

    if args == []:
        raise Exception("No source specified")

    Poi2Mapper(args,options.dest_db).proc_all()
