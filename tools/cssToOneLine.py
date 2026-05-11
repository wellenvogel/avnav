#! /usr/bin/env python3
import re
import sys

if len(sys.argv) < 3:
    print(f"usage: {sys.argv[0]} <pattern> <input.css>")
    sys.exit(1)

with open(sys.argv[2],'r') as input:
    rec=re.compile(r"//.*")
    rep=re.compile(sys.argv[1])
    state=0
    level=0
    hasContent=False
    buffer=''
    for iline in input:
        iline = iline.strip()
        iline= rec.sub('',iline)
        if state==0:
            if rep.match(iline):
                state=1
        if state == 1:
            level+=iline.count('{')
            if level > 0:
                hasContent=True
            level-=iline.count('}')
            buffer+=iline
        if state == 1 and level <= 0 and hasContent:
            print(buffer)
            level=0
            state=0
            buffer=''
            hasContent=False
