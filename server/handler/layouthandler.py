# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2012...2021 Andreas Vogel andreas@wellenvogel.net
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
#  parts from this software (AIS decoding) are taken from the gpsd project
#  so refer to this BSD licencse also (see ais.py) or omit ais.py
###############################################################################
import json

import time

import avnav_handlerList
from avnav_worker import AVNWorker
from avnav_manager import AVNHandlerManager
from avndirectorybase import *
from avnav_util import *

TYPE="layout"
PREFIX="/layouts"


class AVNLayoutHandler(AVNScopedDirectoryHandler):
  ALLOWED_EXTENSIONS=['.json']

  def __init__(self, param):
    super().__init__(param, TYPE)
    self.baseDir= AVNHandlerManager.getDirWithDefault(self.param,'userDir',TYPE)
    self.type=TYPE

  @classmethod
  def getAutoScanExtensions(cls):
    return cls.ALLOWED_EXTENSIONS

  @classmethod
  def getPrefix(cls):
    return PREFIX

  def getSystemDir(self):
    return os.path.join(self.httpServer.handlePathmapping("viewer"), TYPE)


avnav_handlerList.registerHandler(AVNLayoutHandler)
