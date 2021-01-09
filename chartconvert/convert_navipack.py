#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai

###############################################################################
# Copyright (c) 2012,2013,2014 Andreas Vogel andreas@wellenvogel.net
# Copyright (c) 2017 free-x 1073657+free-x@users.noreply.github.com
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

def navipack_connect(navipack_file):
    try:
        con = sqlite3.connect(navipack_file)
        return con
    except Exception as e:
        logger.error("Could not connect to database")
        logger.exception(e)
        raise e


def convertnavipack(nameOut,namesIn):
  gemf=create_gemf.GemfWriter(nameOut);
  source="default"
  for nameIn in namesIn:
    con=navipack_connect(nameIn)
    logger.info("importing navipack (header) from %s to %s",nameIn,nameOut)
    #write header data
    tiles = con.execute("SELECT zyx, png FROM tiles")
    t = tiles.fetchone()
    while t:
      izyx = int(t[0])
      x = izyx & 0b11111111111111111111
      y = (izyx & ( 0b11111111111111111111 << 20)) >> 20
      z = (izyx & ( 0b11111111111111111111 << 40)) >> 40
      logger.debug("tile z=%d,x=%d,y=%d",z,x,y)
      ts=set([(z,x,y)])
      gemf.addTileSet(source,ts)
      t=tiles.fetchone()
    con.close()
  logger.info("creating gemf header for %s",nameOut)
  gemf.finishHeader()
  logger.info("gemf has %d ranges",len(gemf.ranges))
  for nameIn in namesIn:
    con=navipack_connect(nameIn)
    logger.info("importing navipack (data) from %s to %s",nameIn,nameOut)
    tiles = con.execute("SELECT zyx, png FROM tiles")
    t = tiles.fetchone()
    while t:
      izyx = int(t[0])
      x = izyx & 0b11111111111111111111
      y = (izyx & ( 0b11111111111111111111 << 20)) >> 20
      z = (izyx & ( 0b11111111111111111111 << 40)) >> 40
      data = t[1]
      logger.debug("tile data z=%d,x=%d,y=%d",z,x,y)
      gemf.addTile(source,(z,x,y),data)
      t=tiles.fetchone()
    con.close()
  logger.info("closing gemf file %s",nameOut)
  gemf.closeFile()

if __name__ == "__main__":
  if len(sys.argv) < 3:
    raise Exception("missing parameter, usage: %s gemfname navipack [navipack]..."%(sys.argv[0]))
  convertnavipack(sys.argv[1],sys.argv[2:])

      
