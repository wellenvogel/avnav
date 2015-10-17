__author__ = 'andreas'

import sys
import os
import pefile

#call: genVersion exename outname
if len(sys.argv) != 3:
    raise Exception("usage: genVersion exename outname")
exename=sys.argv[1]
outname=sys.argv[2]
if not os.path.exists(exename):
    raise Exception("exe "+exename+" not found")
pe = pefile.PE(exename)
FileVersionLS    = pe.VS_FIXEDFILEINFO.FileVersionLS
FileVersionMS    = pe.VS_FIXEDFILEINFO.FileVersionMS
ProductVersionLS = pe.VS_FIXEDFILEINFO.ProductVersionLS
ProductVersionMS = pe.VS_FIXEDFILEINFO.ProductVersionMS

FileVersion = (FileVersionMS >> 16, FileVersionMS & 0xFFFF, FileVersionLS >> 16, FileVersionLS & 0xFFFF)
ProductVersion = (ProductVersionMS >> 16, ProductVersionMS & 0xFFFF, ProductVersionLS >> 16, ProductVersionLS & 0xFFFF)

fh=open(outname,"w")
if not fh:
    raise Exception("unable to write to "+outname)
fh.write("avnav_version=\"windows-%s-%s-%s-%s\";\n"%ProductVersion)
fh.close()



