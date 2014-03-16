#! /usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2013 Andreas Vogel andreas@wellenvogel.net
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
#
###############################################################################
# read gemf files and provide them for access via http
# see http://www.cgtk.co.uk/gemf
import sys
import os
import struct
import threading

class GemfFile():
  def __init__(self,filename):
    self.filename=filename
    self.handles=[]
    self.sources=[]
    self.ranges=[]
    self.lengthes=[]
    self.isOpen=False
    self.numsources=0
    self.rangenum=0
    self.lock=threading.Lock()
  #open the file and read the header
  def open(self):
    if self.isOpen:
      raise Exception("gemf file %s already open" % (self.filename))
    if not os.path.isfile(self.filename):
      raise Exception("gemf file %s not found" %(self.filename))
    handle=open(self.filename,"rb")
    if handle is None:
      raise Exception("unable to open gemf file %s" %(self.filename))
    #version,tilesize
    buf=handle.read(12) 
    version,tilesize,self.numsources=struct.unpack_from("!3l",buf,0)
    if version != 4:
      raise Exception("file %s: invalid gemf version detected %d (expected 4)" %(self.filename,version))
    if tilesize != 256:
      raise Exception("file %s: invalid tilesize detected %d (expected 256)" %(self.filename,tilesize))
    if self.numsources < 0 or self.numsources > 100:
      raise Exception("file %s: invalid number of sources %d (expected 1...100)" %(self.filename,self.numsources))
    for i in range(self.numsources):
      buf=handle.read(8)
      idx,namelen=struct.unpack_from("!2l",buf,0)
      if namelen < 0 or namelen > 10000:
        raise Exception("file %s source #%d (idx=%d) invalid namelen %d (expected 0...10000)" %(self.filename,i,idx,namelen))
      name=""
      if (namelen > 0):
        buf=handle.read(namelen)
        (name,)=struct.unpack_from("!%ds"%namelen,buf,0)
      source={'num':i,'idx':idx,'name':name}
      self.sources.append(source)
    #rangenum
    buf=handle.read(4)
    (self.rangenum,)=struct.unpack_from("!l",buf,0)
    if self.rangenum < 0:
      raise Exception("file %s invalid number of ranges %d - expected > 0" %(self.filename,self.rangenum))
    for ra in range(self.rangenum):
      buf=handle.read(32)
      zoom,xmin,xmax,ymin,ymax,srcidx,offset=struct.unpack_from("!6lq",buf,0)
      #checks???
      idx=-1
      for i in range(len(self.sources)):
        s=self.sources[i]
        if s['idx'] == srcidx:
          idx=i
          break
      if idx < 0:
        raise Exception("file %s, range %d - source idx %d not found"%(self.filename,ra,srcidx))
      rdata={'zoom':zoom,'xmin':xmin,'xmax':xmax,'ymin':ymin,'ymax':ymax,'idx':idx,'offset':offset}
      self.ranges.append(rdata)
    self.handles.append(handle)
    self.isOpen=True
    for i in range(1,100):
      aname=self.filename+"-"+str(i)
      if os.path.isfile(aname):
        h=open(aname,"rb")
        self.handles.append(h)
      else:
        break
    for h in self.handles:
      st=os.fstat(h.fileno())
      self.lengthes.append(st.st_size)


  #find a range for a tile
  #a tile is a tuple zxy
  #source - the name of the source
  #return the range data
  def findRangeForTile(self,tile,source):
    if not self.isOpen:
      return None
    idx=-1
    for s in self.sources:
      if s['name'] == source:
        idx=s['num']
        break
    if idx < 0:
      return None
    return self.findRangeForTileByIdx(tile,idx)

  #find a range for a tile given the source idx
  def findRangeForTileByIdx(self,tile,idx):
    if not self.isOpen:
      return None
    z,x,y=tile
    for rdata in self.ranges:
      if idx != rdata['idx']:
        continue
      if z != rdata['zoom']:
        continue
      if x > rdata['xmax'] or x < rdata['xmin']:
        continue
      if y > rdata['ymax'] or y < rdata['ymin']:
        continue
      return rdata
    return None

  def getTileOffsetLen(self,tile,source):
    rdata=self.findRangeForTile(tile,source)
    if rdata is None:
      return (None,None)
    z,x,y=tile
    ynum=rdata['ymax']-rdata['ymin']+1;
    idxy=y-rdata['ymin']
    idxx=x-rdata['xmin']
    idxr=idxx*ynum+idxy;
    #each range entry has 12 bytes (offset 8 , len 4)
    offset=12*idxr+rdata['offset']
    try:
      self.lock.acquire()
      self.handles[0].seek(offset)
      buf=self.handles[0].read(12)
      self.lock.release()
      offset,flen=struct.unpack_from("!ql",buf,0)
      return (offset,flen)
    except:
      self.lock.release()
      raise
 
  #find the file and offset to fetch data
  def getFileAndOffset(self,offset):
    for i in range(len(self.lengthes)):
      if offset < self.lengthes[i]:
        return (self.handles[i],offset)
      offset-=self.lengthes[i]
    return (None,None)

  def getTileData(self,tile,source):
    offset,flen=self.getTileOffsetLen(tile,source)
    if offset is None or flen is None:
      return None
    try:
      #todo: handle multiple locks
      fhandle,foffset=self.getFileAndOffset(offset)
      if fhandle is None or foffset is None:
        return None
      self.lock.acquire()
      fhandle.seek(foffset)
      buf=fhandle.read(flen)
      self.lock.release()
      return buf
    except:
      self.lock.release()
      raise

  #get a list of sources and their assigned ranges
  def getSources(self):
    if not self.isOpen:
      raise Exception("GEMF file %s not open" %(self.filename))
    rt=[]
    for s in self.sources:
      src=s.copy()
      ranges=[]
      for rdata in self.ranges:
        if rdata['idx'] == src['num']:
          r={'xmin':rdata['xmin'],
            'ymin':rdata['ymin'],
            'xmax':rdata['xmax'],
            'ymax':rdata['ymax'],
            'zoom':rdata['zoom']}
          ranges.append(r)
      src['ranges']=ranges
      rt.append(src)
    return rt

  def close(self):
    if not self.isOpen:
      return
    for h in self.handles:
      h.close()
    self.handles=[]
    self.lengthes=[]
    self.ranges=[]
    self.sources=[]
    self.rangenum=0
    self.isOpen=False


  def __str__(self):
    rt="GEMF %s (srcnum=%d:" %(self.filename,self.numsources)
    for s in self.sources:
      rt+="%(num)d,%(idx)d,%(name)s;" % s
    rt+=")"
    rt+=", %d ranges" % self.rangenum
    rt+=", %d files: " % len(self.handles)
    for l in self.lengthes:
      rt+=" flen=%d," % l
    return rt


if __name__ == "__main__":
  f=GemfFile(sys.argv[1])
  f.open()
  print "read file %s" %(f,)


