#! /usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai
###############################################################################
# Copyright (c) 2021 Andreas Vogel andreas@wellenvogel.net
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
'''
convert a geojson downloaded from
https://geo.rijkswaterstaat.nl/services/ogc/gdr/vaarweginformatie/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=maximale_toegestane_afmetingen&outputFormat=json

see:
https://data.overheid.nl/dataset/9454-vaarweg-netwerk-nederland--vnds----maximaal-toegestane-afmetingen
'''
import json
import os
import sys

def collectP(properties,prefix):
  rt=""
  l=len(prefix)
  for k in list(filter(lambda pk: pk.startswith(prefix),properties.keys())):
    pf=k[l+1:]
    if properties.get(k):
      if rt != "":
        rt+=","
      rt+="%s=%.2f"%(pf,properties[k])
  return rt


def convert(ifn,ofn):
  with open(ifn,"r") as fh:
    data=json.load(fh)
    features=data.get('features')
    if features is not None:
      for feature in features:
        properties=feature.get('properties')
        if properties is not None:
          properties['name']=properties.get('VRTNAAM')
          properties['desc']="depth:%s\nheight:%s"%(collectP(properties,'DIEPGANG'),collectP(properties,'HOOGTE') )

    #print(data)
    with open(ofn,"w") as oh:
      oh.write(json.dumps(data))


if len(sys.argv) < 2:
  print("ERROR: usage %s infile [outfile]"%sys.argv[0])
  sys.exit(1)
ifn=sys.argv[1]
ofn=None
if len(sys.argv) > 2:
  ofn=sys.argv[2]
else:
  name,ext = os.path.splitext(ifn)
  ofn=name+"-mod"+ext
convert(ifn,ofn)