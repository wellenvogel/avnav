#! /usr/bin/env python
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012,2020 Andreas Vogel andreas@wellenvogel.net
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
# read mbtiles files and provide them for access via http
import sqlite3
import sys
import os
import struct
import threading
import time

import create_overview
from avnav_util import AVNLog, AVNUtil


#mbtiles:
#zoom_level => z
#tile_column => x
#tile_row => 2^^z-1-y
class ConnectionMapEntry:
  def __init__(self,threadid,connection):
    self.threadid=threadid
    self.connection=connection
    self.time=AVNUtil.utcnow()
  def getConnection(self):
    self.time=AVNUtil.utcnow()
    return self.connection


class MBTilesFile():
  def __init__(self,filename,timeout=300):
    self.filename=filename
    self.isOpen=False
    self.lock=threading.Lock()
    self.connection=None
    self.zoomlevels=[]
    self.zoomLevelBoundings={}
    self.schemeXyz=True
    self.connectionMap={}
    self.timeout=timeout
    self.stop=False
    self.closer=threading.Thread(target=self.closeConnections)
    self.closer.setDaemon(True)
    self.closer.start()

  def closeConnections(self):
    while not self.stop:
      closeTime=AVNUtil.utcnow()-self.timeout
      for c in self.connectionMap.keys():
        con=self.connectionMap[c]
        if con.time < closeTime:
          self.lock.acquire()
          try:
            con.connection.close()
            del self.connectionMap[c]
          except Exception as e:
            AVNLog.debug("error closing connection %s",e.message)
          self.lock.release()
      time.sleep(5)



  #tile is (z,x,y)
  def zxyToZoomColRow(self,tile):
    if self.schemeXyz:
      return [tile[0],tile[1],pow(2,tile[0])-1-tile[2]]
    else:
      return [tile[0],tile[1],tile[2]]

  def rowToY(self, z, row):
    if self.schemeXyz:
      return pow(2,z)-1-row
    else:
      return row
  def colToX(self, z, col):
    return col
  #open the file and prepare the overview
  def open(self):
    if self.isOpen:
      raise Exception("mbtiles file %s already open" % (self.filename))
    if not os.path.isfile(self.filename):
      raise Exception("mbtiles file %s not found" %(self.filename))
    self.connection=sqlite3.connect(self.filename)
    if self.connection is None:
      raise Exception("unable to open mbtiles file %s" %(self.filename))
    AVNLog.info("opening mbtiles file %s",self.filename)
    cu=None
    try:
      cu=self.connection.cursor()
      for zl in cu.execute("select distinct zoom_level from tiles;"):
        self.zoomlevels.append(zl[0])
      for zl in self.zoomlevels:
        el={}
        for rowmima in cu.execute("select min(tile_row),max(tile_row) from tiles where zoom_level=?",[zl]):
          #names must match getGemfInfo in create_overview
          if self.schemeXyz:
            el['ymin']=self.rowToY(zl, rowmima[1])
            el['ymax']=self.rowToY(zl, rowmima[0])
          else:
            el['ymin'] = self.rowToY(zl, rowmima[0])
            el['ymax'] = self.rowToY(zl, rowmima[1])
        for colmima in cu.execute("select min(tile_column),max(tile_column) from tiles where zoom_level=?",[zl]):
          el['xmin'] = self.colToX(zl, colmima[0])
          el['xmax'] = self.colToX(zl, colmima[1])
        self.zoomLevelBoundings[zl]=el
    except Exception as e:
      AVNLog.error("error reading base info from %s:%s",self.filename,e.message)
    if cu is not None:
      cu.close()
    self.connection.close()
    self.isOpen=True

  #tile is (z,x,y)
  def getTileData(self,tile,source):
    if not self.isOpen:
      raise Exception("not open")
    self.lock.acquire()
    id=threading.current_thread().ident
    entry=self.connectionMap.get(id)
    if entry is None:
      try:
        entry=ConnectionMapEntry(id,sqlite3.connect(self.filename))
      except Exception as e:
        AVNLog.error("unable to open connection for %s:$s",self.filename,e.message)
        self.lock.release()
        return None
      self.connectionMap[id]=entry
    cu=None
    try:
      cu=entry.getConnection().execute("select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?",self.zxyToZoomColRow(tile))
      t=cu.fetchone()
      cu.close()
      self.lock.release()
      return t[0]
    except Exception as e:
      if cu is not None:
        try:
          cu.close()
        except:
          pass
        self.lock.release()
    return None

  def getAvnavXml(self):
    if not self.isOpen:
      return None
    ranges=[]
    for zl in self.zoomlevels:
      de=self.zoomLevelBoundings[zl].copy()
      de['zoom']=zl
      ranges.append(de)
    #create a single source with one range for each zoomlevel
    data=[{"name":"mbtiles","ranges":ranges}]
    return create_overview.getGemfInfo(data,{})



  def close(self):
    if not self.isOpen:
      return
    self.stop=True
    for me in self.connectionMap.values():
      try:
        me.connection.close()
      except:
        pass

  def deleteFiles(self):
    self.close()
    if os.path.isfile(self.filename):
      os.unlink(self.filename)

  def __unicode__(self):
    rt="mbtiles %s " %(self.filename)
    return rt


if __name__ == "__main__":
  f=MBTilesFile(sys.argv[1])
  f.open()
  print "read file %s" %(f,)
  print f.getAvnavXml()


