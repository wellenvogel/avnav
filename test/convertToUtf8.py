#!/usr/bin/env python3

import sys
import os
import codecs

incode="utf-8"
outcode="utf-8"
outfile=None
if len(sys.argv) > 3:
	outfile=sys.argv[3]	
if len(sys.argv) > 2:
	incode=sys.argv[2]	
if len(sys.argv) > 4:
	outcode=sys.argv[4]	
if len(sys.argv) < 2:
	raise Exception("usage: convertToUtf8.py infile [incode] [outfile]  [outcode]")
f = codecs.open(sys.argv[1], encoding=incode)
fout=None
if outfile is not None:
  fout=codecs.open(outfile,"w",encoding=outcode)
for line in f:
	if fout is not None:
    		fout.write(line)
	else:
		print(line)



