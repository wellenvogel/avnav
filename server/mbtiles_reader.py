#! /usr/bin/env python3
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

import os
import sqlite3
import sys
import threading

import create_overview
from avnav_util import AVNLog, AVNUtil, ChartFile


#mbtiles:
#zoom_level => z
#tile_column => x
#tile_row => 2^^z-1-y

class QueueEntry(object):
  def __init__(self,tile):
    self.cond=threading.Condition()
    self.tile=tile
    self.data=None
    self.dataAvailable=False

  def waitAndGet(self):
    while True:
      self.cond.acquire()
      if self.dataAvailable:
        self.cond.release()
        return self.data
      self.cond.wait(5)
      self.cond.release()

  def wakeUp(self):
    self.cond.acquire()
    try:
      self.cond.notifyAll()
    finally:
      self.cond.release()
  def setData(self,data):
    self.cond.acquire()
    self.data=data
    self.dataAvailable=True
    self.cond.notify_all()
    self.cond.release()



class MBTilesFile(ChartFile):
  def __init__(self,filename,timeout=300):
    self.filename=filename
    self.isOpen=False
    self.cond=threading.Condition()
    self.connection=None
    self.zoomlevels=[]
    self.zoomLevelBoundings={}
    self.schemeTMS=True
    self.originalScheme=None
    self.schemeInconsistent=False #if there is a scheme entry in the DB but no avnav_schema
    self.requestQueue=[]
    self.timeout=timeout
    self.stop=False
    self.handler=threading.Thread(target=self.handleRequests)
    self.handler.setDaemon(True)
    self.handler.start()
    self.changeCount=AVNUtil.utcnow()

  def getOriginalScheme(self):
    if not self.schemeInconsistent:
      return None
    return self.originalScheme

  def wakeUp(self):
    self.cond.acquire()
    try:
      self.cond.notify_all()
    finally:
      self.cond.release()

  def handleRequests(self):
    connection=sqlite3.connect(self.filename)
    while not self.stop:
      self.cond.acquire()
      request=None
      if len(self.requestQueue) > 0:
        request=self.requestQueue.pop(0)
      else:
        self.cond.wait(5)
      self.cond.release()
      if request is not None:
        data=self.getTileDataInternal(request.tile,connection)
        request.setData(data)
    connection.close()



  #tile is (z,x,y)
  def zxyToZoomColRow(self,tile):
    if self.schemeTMS:
      return [tile[0],tile[1],pow(2,tile[0])-1-tile[2]]
    else:
      return [tile[0],tile[1],tile[2]]

  def rowToY(self, z, row):
    if self.schemeTMS:
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
    self.createOverview()
    self.isOpen=True

  #tile is (z,x,y)
  def getTileData(self,tile,source):
    if not self.isOpen:
      raise Exception("not open")
    request=QueueEntry(tile)
    self.cond.acquire()
    try:
      self.requestQueue.append(request)
      self.cond.notify_all()
    except:
      pass
    self.cond.release()
    AVNLog.debug("waiting for tile")
    data=request.waitAndGet()
    AVNLog.debug("tile received")
    return data

  def getTileDataInternal(self,tile,connection):
    cu=None
    try:
      cu=connection.execute("select tile_data from tiles where zoom_level=? and tile_column=? and tile_row=?",self.zxyToZoomColRow(tile))
      t=cu.fetchone()
      cu.close()
      return t[0]
    except Exception as e:
      if cu is not None:
        try:
          cu.close()
        except:
          pass
    return None

  def getAvnavXml(self,upzoom=2):
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

  def createOverview(self):
    zoomlevels=[]
    zoomLevelBoundings={}
    connection = sqlite3.connect(self.filename)
    if connection is None:
      raise Exception("unable to open mbtiles file %s" % (self.filename))
    AVNLog.info("opening mbtiles file %s", self.filename)
    cu = None
    hasAvnavScheme=False
    try:
      cu = connection.cursor()
      for sr in cu.execute("select value from metadata where name=?",["avnav_scheme"]):
        v=sr[0]
        if v is not None:
          v=v.lower()
          if v in ['tms','xyz']:
            AVNLog.info("setting scheme for %s to %s",self.filename,v)
            self.schemeTMS=False if v == "xyz" else True
            self.schemeInconsistent=False
            hasAvnavScheme=True
      #check if there is a schema entry
      for sr in cu.execute("select value from metadata where name=?",["scheme"]):
        v=sr[0]
        if v is not None:
          v=v.lower()
          self.originalScheme=v
          if not hasAvnavScheme:
            self.schemeInconsistent=True
      for zl in cu.execute("select distinct zoom_level from tiles;"):
        zoomlevels.append(zl[0])
      for zl in zoomlevels:
        el = {}
        for rowmima in cu.execute("select min(tile_row),max(tile_row) from tiles where zoom_level=?", [zl]):
          # names must match getGemfInfo in create_overview
          if self.schemeTMS:
            el['ymin'] = self.rowToY(zl, rowmima[1])
            el['ymax'] = self.rowToY(zl, rowmima[0])
          else:
            el['ymin'] = self.rowToY(zl, rowmima[0])
            el['ymax'] = self.rowToY(zl, rowmima[1])
        for colmima in cu.execute("select min(tile_column),max(tile_column) from tiles where zoom_level=?", [zl]):
          el['xmin'] = self.colToX(zl, colmima[0])
          el['xmax'] = self.colToX(zl, colmima[1])
        zoomLevelBoundings[zl] = el
    except Exception as e:
      AVNLog.error("error reading base info from %s:%s", self.filename, str(e))
    self.zoomlevels=zoomlevels
    self.zoomLevelBoundings=zoomLevelBoundings
    if cu is not None:
      cu.close()
    connection.close()
    self.changeCount=AVNUtil.utcnow()

  def changeScheme(self,schema,createOverview=True):
    if schema not in ['xyz','tms']:
      raise Exception("unknown schema %s"%schema)
    if schema == "xyz":
      if not self.schemeTMS and not self.schemeInconsistent:
        return False
      self.schemeTMS=False
    if schema == "tms":
      if self.schemeTMS and not self.schemeInconsistent:
        return False
      self.schemeTMS=True
    con=sqlite3.connect(self.filename)
    cu = con.cursor()
    try:
      rs=cu.execute("select value from metadata where name=?", ["avnav_scheme"])
      row=rs.fetchone()
      if row is not None:
        cu.execute("update metadata set value=? where name='avnav_scheme'",[schema])
        con.commit()
      else:
        cu.execute("insert into metadata (name,value) values ('avnav_scheme',?)",[schema])
        con.commit()
    except Exception as e:
      cu.close()
      con.close()
      raise
    cu.close()
    con.close()
    if (createOverview):
      self.createOverview()
    return True

  def getScheme(self):
    return "tms" if self.schemeTMS else "xyz"

  def close(self):
    if not self.isOpen:
      return
    self.stop=True
    #cancel all requests by returning None
    self.cond.acquire()
    requests=self.requestQueue
    self.requestQueue=[]
    self.cond.notify_all()
    self.cond.release()
    for rq in requests:
      try:
        rq.setData(None)
      except:
        pass

  def deleteFiles(self):
    self.close()
    if os.path.isfile(self.filename):
      os.unlink(self.filename)

  def getChangeCount(self):
    return self.changeCount

  def getDownloadFile(self):
    return self.filename

  def __str__(self):
    rt="mbtiles %s " %(self.filename)
    return rt


if __name__ == "__main__":
  f=MBTilesFile(sys.argv[1])
  f.open()
  print("read file %s" %(f,))
  print(f.getAvnavXml())


