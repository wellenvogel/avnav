#! /usr/bin/env python3
import sys
import os
'''
input is a list of icon defs
build with
join -j 1  -a 1 tmp/icons.txt ~/avnav/plugins/m2buttons2px/icons.txt
IconName legacyFile [defaultFile]
'''
if len(sys.argv) < 2:
    print(f"usage: {sys.argv[0]} inputfile",file=sys.stderr)
    sys.exit(1)

with open(sys.argv[1],'r') as f:
    print('@import "defines";')
    print(".icon{")
    empty='''&.Empty
    {
        dummy: 0; // must set something to export    Empty
    }
    '''
    print(empty)
    for line in f:
        line=line.strip()
        parts=line.split(' ')
        if len(parts) < 2:
            print(f"#invalid line: {line}",file=sys.stderr)
            continue
        print(f"  &.{parts[0]} "+'{')
        if len(parts) == 2:
            print(f"    .icon('{parts[1]}');")
        else:
            print(f"    .icon('{parts[1]}','{parts[2]}');")
        print("  }")
    print("}")