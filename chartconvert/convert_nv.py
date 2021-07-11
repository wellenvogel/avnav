#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# vim: ts=2 sw=2 et ai

###############################################################################
# Copyright (c) 2012,2021 Andreas Vogel andreas@wellenvogel.net
#  parts of this software are based on tiler_tools (...)
#  the license terms (see below) apply to the complete software the same way
#
###############################################################################
# Copyright (c) 2011, Vadim Shlyakhov
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
from osgeo import gdal
import os
import sys
import re
import subprocess


#------------------------------------------------
#tiler tools map2gdal

def ttConvert(chart,outdir,outname,tilertools):
  args=[sys.executable,os.path.join(tilertools,"map2gdal.py"),"-t",outdir]
  args.append(chart)
  subprocess.call(args)
  
  
def slog(txt):
  print("LOG %s"%(txt,))

def swarn(txt):
  print("WARNING %s"%(txt,))


#------------------------------------------------
#nv converter
def nvConvert(chart,outdir,outname,tilertools,logf,warn,updateOnly=False):

  if updateOnly and os.path.exists(outname):
    ostat=os.stat(outname)
    cstat=os.stat(chart)
    if (ostat.st_mtime >= cstat.st_mtime):
      logf(outname +" newer as "+chart+" no need to recreate")
      return
    else:
      logf(chart +" newer then "+outname+", recreate")
  exename="opencpn.exe"
  if os.name != 'nt':
    warn("converting NV %s only possible on windows"%(chart,))
    return
  dn = os.path.dirname(os.path.realpath(__file__))
  ocpnDir=os.path.join(dn,"..","ocpn")
  callprog=os.path.join(ocpnDir,exename)
  if not os.path.isfile(callprog):
    warn ("unable to find converter %s for %s"%(callprog,chart))
    return
  my_env = os.environ.copy()
  my_env["PATH"] = my_env["PATH"]+";%s"%(ocpnDir)
  #will write <basename>.tif and <basename>_header.kap
  args=[callprog,'-o',outdir,ocpnDir,chart]
  logf("calling %s,%s"%(",".join(args),my_env['PATH']))
  proc=subprocess.Popen(args,env=my_env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,stdin=None)

  while (True):
    line=proc.stdout.readline()
    if line is None or line == '':
      break
    if proc.stdout.closed:
      break
    logf("CONVERTNV: "+line.rstrip(b'\n').decode('utf-8',errors='ignore'))
    if proc.poll() is not None:
      break
  rt=proc.wait()
  base,ext=os.path.splitext(os.path.basename(chart))
  if rt != 0:
    warn("converting %s failed"%(chart,))
    return
  kapname=os.path.join(outdir,base+'_header.kap')
  if not os.path.exists(kapname):
    warn("header %s not found after conversion"%(kapname,))
    return
  tifname=os.path.join(outdir,base+".tif")
  if not os.path.exists(tifname):
    warn("tif file %s does not exist after conversion"%(tifname,))
    return
  logf("file %s successfully decoded"%(chart,))
  #now run tiler tools on the header to create the vrt...
  ttConvert(chart,outdir,outname,tilertools)
  if not os.path.exists(outname):
    warn("VRT %s file not generated with tiler_tools"%(outname,))
    return
  tifvrt=os.path.join(outdir,base+"_tif.vrt")
  #we now create a dummy vrt for the tiff to easily merge this with the one from the header
  try:
    srcds=gdal.Open(tifname)
    if srcds is None:
      warn("unable to read %s with gdal"%(tifname,))
      return
    drv=gdal.GetDriverByName("vrt")
    if drv is None:
      warn("unable to find gdal driver for vrt")
      return
    dstds = drv.CreateCopy( tifvrt, srcds, 0 )
    if dstds is None:
      warn("unable to create %s with gdal"%(tifvrt,))
      return
    srcds=None
    dstds=None
  except:
    warn("error in gdal convert handling")
    return
  if not os.path.exists(tifvrt):
    warn("temp vrt file %s not created"%(tifvrt,))
    return
  #now merge the 2 vrt files
  origvrtdata=None
  with open(outname,"r",encoding='utf-8',errors='ignore') as f:
    origvrtdata=f.read()
  if origvrtdata is None:
    warn("unable to read %s"%(outname,))
    return
  tmpvrtdata=None
  with open(tifvrt,"r",encoding='utf-8') as f:
    tmpvrtdata=f.read()
  if tmpvrtdata is None:
    warn("unable to read %s"%(tifvrt,))
    return
  origvrtdata=re.sub('[<]VRTRasterBand.*','',origvrtdata,flags=re.S)
  doAdd=False
  for mline in tmpvrtdata.splitlines(True):
    if doAdd:
      origvrtdata+=mline
      continue
    else:
      if re.search('[<]VRTRasterBand',mline) is None:
        continue
      mline=re.sub('.*[<]VRTRasterBand','<VRTRasterBand',mline)
      doAdd=True
      origvrtdata+=mline
  os.unlink(outname)
  with open(outname,"w",encoding='utf-8') as f:
    f.write(origvrtdata)
  logf("successfully created merged vrt %s"%(chart,))  
  
if __name__ == '__main__':
  if len(sys.argv) != 4:
    print("usage: %s chartname outdir tilertoolsdir"%(sys.argv[0],))
    sys.exit(1)
  nvConvert(sys.argv[1], sys.argv[2], os.path.join(sys.argv[2],os.path.basename(sys.argv[1])+".vrt"), 
            sys.argv[3],  slog, swarn, False)
