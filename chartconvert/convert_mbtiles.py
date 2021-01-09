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
import sqlite3
import logging
import create_gemf

logger=logging.getLogger(__name__)

def mbtiles_connect(mbtiles_file):
    try:
        con = sqlite3.connect(mbtiles_file)
        return con
    except Exception as e:
        logger.error("Could not connect to database")
        logger.exception(e)
        raise e

#currently we are not prepared for any change of the mbtiles data
#between importing the header and importing the data
#mbtiles follow the tms spec - so we have to compute the gemf y by 2^^z-1-y
def mb2gemf(tile,scheme="tms"):
  if scheme.lower() == "tms":
    return (tile[0],tile[1],pow(2,tile[0])-1-tile[2])
  else:
    return (tile[0],tile[1],tile[2])


def convertMbTiles(nameOut,namesIn,scheme="tms"):
  gemf=create_gemf.GemfWriter(nameOut);
  source="default"
  for nameIn in namesIn:
    con=mbtiles_connect(nameIn)
    logger.info("importing mbtiles (header) from %s to %s",nameIn,nameOut)
    #write header data
    tiles = con.execute('select zoom_level, tile_column, tile_row, tile_data from tiles;')
    t = tiles.fetchone()
    while t:
        z = t[0]
        x = t[1]
        y = t[2]
        logger.debug("tile z=%d,x=%d,y=%d",z,x,y)
        ts = set([mb2gemf((z, x, y),scheme.lower()), ])
        gemf.addTileSet(source,ts)
        t=tiles.fetchone()
    con.close()
  logger.info("creating gemf header for %s",nameOut)
  gemf.finishHeader()
  logger.info("gemf has %d ranges",len(gemf.ranges))
  for nameIn in namesIn:
    con=mbtiles_connect(nameIn)
    logger.info("importing mbtiles (data) from %s to %s",nameIn,nameOut)
    tiles = con.execute('select zoom_level, tile_column, tile_row, tile_data from tiles;')
    t = tiles.fetchone()
    while t:
        z = t[0]
        x = t[1]
        y = t[2]
        data=t[3]
        logger.debug("tile data z=%d,x=%d,y=%d",z,x,y)
        gemf.addTile(source,mb2gemf((z,x,y)),data)
        t=tiles.fetchone()
    con.close()
  logger.info("closing gemf file %s",nameOut)
  gemf.closeFile()

if __name__ == "__main__":
  if len(sys.argv) < 2:
    raise Exception("missing parameter, usage: %s [xyz|tms] gemfname mbname [mbname]..."%(sys.argv[0]))
  if sys.argv[1].lower() == "xyz" or sys.argv[1].lower() == "tms":
    if len(sys.argv) < 4:
      raise Exception("missing parameter, usage: %s [xyz|tms] gemfname mbname [mbname]..."%(sys.argv[0]))
    convertMbTiles(sys.argv[2],sys.argv[3:],sys.argv[1])
  else:
    if len(sys.argv) < 3:
      raise Exception("missing parameter, usage: %s [xyz|tms] gemfname mbname [mbname]..."%(sys.argv[0]))
    convertMbTiles(sys.argv[1],sys.argv[2:])

