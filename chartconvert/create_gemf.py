#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai

###############################################################################
# Copyright (c) 2012,2013,2014 Andreas Vogel andreas@wellenvogel.net
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

import os
import struct
import sys
import ctypes
import threading

# a class for writing to a GEMF file
# in a first phase all tiles infos (source,z,x,y) must be added to prepare the header
# in a second phase tiles can be written "stream like"
# logwriter must be a class having a log(string) method for writing infos
# tiles are tuples (z,x,y)
class GemfWriter(object):
  def __init__(self,filename,logwriter=None):
    self.filename=filename
    self.headerComplete=False
    #each source is a dict of index,name,tiles (tiles being tuples z,x,y)
    self.sources=[]
    #each range is a dict of xmin,xmax,ymin,ymax,zoom,source_index,offset
    self.ranges=[]
    self.offsetbuffer=[] #a buffer for the offsets that will be filled on writing tiles
    self.logwriter=logwriter
    self.filehandle=None
    self.firsthandle=None #a copy of the filehandle for the first file - do not close this one...
    self.bytesWritten=0
    self.lastFileStart=0 #bytes written at last start of a file
    self.firstoffset=0 #offset to be substracted from file offset for offsetbuffer
    self.numextrafiles=0
    self.numtilesheader=0
    self.numtileswritten=0
    self.lock=threading.Lock()

  def log(self,txt):
    if self.logwriter is not None:
      self.logwriter.log(txt)
    else:
      print("GemfWriter(%s): %s" %(self.filename,txt))
  #check if we are still in the header phase
  def headerOpen(self):
    if self.headerComplete:
      raise Exception("GEMF file %s: header already closed" %(self.filename))

  def headerReady(self):
    if not self.headerComplete:
      raise Exception("GEMF file %s: header not yet complete" %(self.filename))
  #add a set of tiles (during preparing the header)
  def addTileSet(self,source,tileset):
    self.headerOpen()
    for s in self.sources:
      if s['name']==source:
        s['tiles'] |= tileset
        #self.log("adding %d tiles to source %s" %(len(tileset),source))
        return
    self.log("adding new source %s with %d tiles" %(source,len(tileset)))
    s={'name':source,'index':len(self.sources),'tiles':tileset}
    self.sources.append(s)
  #finish the header 
  #this will compute the ranges
  #create all header data and a buffer for the offsets
  #open the file and write the header
  def finishHeader(self):
    self.headerOpen()
    if len(self.sources) == 0:
      raise Exception("GEMF file %s - empty" %(self.filename))
    numtiles=0
    for source in self.sources:
      results={}
      self.log("finishHeader: handling source %s with %d tiles" %(source['name'],len(source['tiles'])))
      numtiles+=len(source['tiles'])
      for tile in source['tiles']:
        z,x,y=tile
        if results.get(z) is None:
          results[z]={}
        if (results[z]).get(x) is None:
          results[z][x]=set()
        results[z][x].add(y)
      #now we have the sorted list for this source in results
      #take the code fro the original generate_efficient_map_file...
      # Build a list of tile rectangles that may have missing slices, but have square corners.

      # A record representing a square of 1-5 tiles at zoom 10
      # unique_sets[zoom][Y values key] = [X values array]
      # unique_sets[10]["1-2-3-4-5"] = [1,2,3,4,5]
      unique_sets = {}
      for zoom_level in list(results.keys()):
        unique_sets[zoom_level] = {}
        for x_val in list(results[zoom_level].keys()):

            # strkey: Sorted list of Y values for a zoom/X, eg: "1-2-3-4"
            strkey = "-".join(["%d" % i for i in sorted(results[zoom_level][x_val])])
            if strkey in list(unique_sets[zoom_level].keys()):
                unique_sets[zoom_level][strkey].append(x_val)
            else:
                unique_sets[zoom_level][strkey] = [x_val,]

      # Find missing X rows in each unique_set record 
      split_xsets = {}
      for zoom_level in list(results.keys()):
        split_xsets[zoom_level] = []
        for xset in list(unique_sets[zoom_level].values()):
            setxmin = min(xset)
            setxmax = max(xset)
            last_valid = None
            for xv in range(setxmin, setxmax+2):
                if xv not in xset and last_valid is not None:
                    split_xsets[zoom_level].append({'xmin': last_valid, 'xmax': xv-1})
                    last_valid = None
                elif xv in xset and last_valid is None:
                    last_valid = xv

      #pprint.pprint(split_xsets)

      # Find missing Y rows in each unique_set chunk, create full_sets records for each complete chunk

      full_sets = {}
      for zoom_level in list(split_xsets.keys()):
        full_sets[zoom_level] = []
        for xr in split_xsets[zoom_level]:
            yset = results[zoom_level][xr['xmax']]
            if yset is None or len(yset) == 0:
                continue
            setymin = min(yset)
            setymax = max(yset)
            last_valid = None
            for yv in range(setymin, setymax+2):
                if yv not in yset and last_valid is not None:
                    full_sets[zoom_level].append({'xmin': xr['xmin'], 'xmax': xr['xmax'],
                        'ymin': last_valid, 'ymax': yv-1,
                        'source_index': source['index']})
                    last_valid = None
                elif yv in yset and last_valid is None:
                    last_valid = yv

      #now we have in full_sets the complete ranges for this source
      numranges=0
      for zoom in list(full_sets.keys()):
        for ri in full_sets[zoom]:
          rangedata=ri.copy()
          rangedata['zoom']=zoom
          self.ranges.append(rangedata)
          numranges+=1
      self.log("finishHeader: created %d ranges for source %s" %(numranges,source['name']))
    self.log("finishHeader: created %d ranges, %d sources, %d tiles" %(len(self.ranges),len(self.sources),numtiles))
    self.numtilesheader=numtiles
    self.numtileswritten=0
    self.log("finishHeader: start writing header data")

    #OK - we have now all ranges being filled - start writing the header
    self.filehandle=open(self.filename,"wb")
    if self.filehandle is None:
      raise Exception("GemfWriter %s: unable to open file" %(self.filename))
    self.firsthandle=self.filehandle
    self.bytesWritten=0
    sourcelist=b""
    for source in self.sources:
      sourcelist+=struct.pack("!l",source['index'])
      l=len(source['name'])
      sourcelist+=struct.pack("!l",l)
      sourcelist+=struct.pack("!%ds" % (l),str(source['name']).encode('utf-8'))
    hdr=b""
    hdr+=struct.pack("!3l",4,256,len(self.sources)) #GEMF version, tilesize,srclen
    hdr+=sourcelist
    hdr+=struct.pack("!l",len(self.ranges))
    rangelistlen=len(self.ranges)*32 #zoom,xmin,xmax,ymin,ymax,srcidx,offset#8
    self.filehandle.write(hdr)
    rbuffer=ctypes.create_string_buffer(rangelistlen)
    offsetposition=len(hdr)+rangelistlen  #the start of the offset/len data for the ranges
    self.log("finishHeader: header len %d" %(offsetposition))
    self.firstoffset=offsetposition
    rangeoffset=0
    for rangedata in self.ranges:
      rdatalen=(rangedata['ymax']-rangedata['ymin']+1)*(rangedata['xmax']-rangedata['xmin']+1)*12
      struct.pack_into("!6lq",rbuffer,rangeoffset,rangedata['zoom'],
          rangedata['xmin'],rangedata['xmax'],rangedata['ymin'],rangedata['ymax'],
          rangedata['source_index'],offsetposition)
      rangedata['offset']=offsetposition
      offsetposition+=rdatalen
      rangeoffset+=32
    self.filehandle.write(rbuffer)
    self.log("finishHeader: header len %d, offsetbuffer len %d, start of data %d"%(len(hdr),offsetposition-self.firstoffset,rangeoffset))
    self.offsetbuffer=ctypes.create_string_buffer(offsetposition-self.firstoffset) #buffer to be filled during writing the tiles
    self.filehandle.write(self.offsetbuffer)
    self.bytesWritten=offsetposition
    self.headerComplete=True
    self.log("finishHeader: header successfully written")


  #close the file after all tiles have been written
  def closeFile(self):
    self.headerReady()
    self.log("closeFile: writing offsets at position %d (len %d)" %(self.firstoffset,len(self.offsetbuffer)))
    self.firsthandle.seek(self.firstoffset)
    self.firsthandle.write(self.offsetbuffer)
    if self.firsthandle.fileno() != self.filehandle.fileno():
      self.filehandle.close()
    self.firsthandle.close()
    self.log("closeFile: file successfully closed after %d bytes, %d tiles (%d tiles defined in header)" % (self.bytesWritten,self.numtileswritten,self.numtilesheader))

  #helper functions for adding tiles
  #find a range for a tile
  #a tile is a tuple zxy
  #source - the name of the source
  #return the range data
  def findRangeForTile(self,tile,source):
    idx=-1
    for s in self.sources:
      if s['name'] == source:
        idx=s['index']
        break
    if idx < 0:
      return None
    return self.findRangeForTileByIdx(tile,idx)

  #find a range for a tile given the source idx
  def findRangeForTileByIdx(self,tile,idx):
    z,x,y=tile
    for rdata in self.ranges:
      if idx != rdata['source_index']:
        continue
      if z != rdata['zoom']:
        continue
      if x > rdata['xmax'] or x < rdata['xmin']:
        continue
      if y > rdata['ymax'] or y < rdata['ymin']:
        continue
      return rdata
    return None

  #get the tile offset
  #this is the offset in the offsetbuffer
  def getTileOffset(self,tile,source):
    rdata=self.findRangeForTile(tile,source)
    if rdata is None:
      return None
    z,x,y=tile
    ynum=rdata['ymax']-rdata['ymin']+1;
    idxy=y-rdata['ymin']
    idxx=x-rdata['xmin']
    idxr=idxx*ynum+idxy;
    #each range entry has 12 bytes (offset 8 , len 4)
    offset=12*idxr+rdata['offset'] - self.firstoffset
    return offset

  #add a tile
  def addTile(self,source,tile,tiledata):
    z,x,y=tile
    self.headerReady()
    offset=self.getTileOffset(tile,source)
    if offset is None:
      raise Exception("GemfWriter %s: unknown tile %s:%s,%s,%s" %(self.filename,source,z,x,y))
    try:
      dlen=len(tiledata)
      self.lock.acquire()
      struct.pack_into("!ql",self.offsetbuffer,offset,self.bytesWritten,dlen)
      #self.log("writing offset %d, len %d at buffer pos %d" %(self.bytesWritten,dlen,offset))
      self.filehandle.write(tiledata)
      self.bytesWritten+=dlen
      self.lock.release()
      self.numtileswritten+=1
    except:
      self.lock.release()
      raise


#some simple test function
def gemfTest(mapdir,outfile):
  import traceback
  print("creating gemf file %s from mapdir %s" %(outfile,mapdir))
  wr=GemfWriter(outfile)
  for r in range(2):
    srclist=os.listdir(mapdir)
    for source in srclist:
      sdir=os.path.join(mapdir,source)
      if os.path.isdir(sdir):
        zs=os.listdir(sdir)
        for z in zs:
          zpath=os.path.join(sdir,z)
          if os.path.isdir(zpath):
            xs=os.listdir(zpath)
            for x in xs:
              xpath=os.path.join(zpath,x)
              if os.path.isdir(xpath):
                ys=os.listdir(xpath)
                for y in ys:
                  ypath=os.path.join(xpath,y)
                  if ypath.endswith(".png"):
                    yv=y.replace(".png","")
                    try:
                      tile=(int(z),int(x),int(yv))
                      print("(%d)adding tile %s %d %d %d" %(r,source,tile[0],tile[1],tile[2]))
                      if r==0:
                        wr.addTileSet(source,set([tile,]))
                      else:
                        h=open(ypath,"rb")
                        buf=h.read()
                        h.close()
                        wr.addTile(source,tile,buf)
                    except:
                      print("Exception for %s: %s" % (ypath,traceback.format_exc()))
    if r == 0:
      wr.finishHeader()
    else:
      wr.closeFile()
              
if __name__ == "__main__":
  gemfTest(sys.argv[1],sys.argv[2])

