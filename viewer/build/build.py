#! /usr/bin/env python
#avnav build script
#read the list of files from loader.js, concat them and call yui to compress
import sys
import re
import shutil
import os
import subprocess

tmpname="avnav_combine.js"
target="avnav_min.js"

#read the filesnames between STARTFILES and ENDFILES markers
def readJsNames(fname):
    f=open(fname,"r")
    rt=[]
    output=False
    while True:
        bytes=f.readline()
        if len(bytes) == 0:
            break
        #print bytes
        if re.match('.*STARTFILES',bytes):
            output=True
            continue
        if re.match('.*ENDFILES',bytes):
            output=False
            continue
        if not output:
            continue
        bytes=bytes.strip();
        bytes=re.sub("'","",bytes);
        bytes=re.sub(",","",bytes);
        if os.path.sep != '/':
            bytes=re.sub("/","\\\\",bytes);
        if re.match('^ *$',bytes):
            continue
        rt.append(bytes)
    f.close()
    return rt;

def runBuild(args):
    base = os.path.dirname(os.path.realpath(__file__))
    dn=os.path.join(base,"..")
    files=readJsNames(os.path.join(dn,'loader.js'))
    tmpfname=os.path.join(dn,tmpname)
    fo=open(tmpfname,"w")
    for fn in files:
        f=open(os.path.join(dn,fn),"r")
        print "collect "+fn
        shutil.copyfileobj(f,fo)
        f.close()
    fo.close()
    os.chdir(dn)
    print "creating "+os.path.join(dn,target)+" from "+tmpfname
    return subprocess.call(['java','-jar',os.path.join(base,'yuicompressor-2.4.8.jar'),'-o',target,'--nomunge',tmpname])


if __name__ == "__main__":
    runBuild(sys.argv)
