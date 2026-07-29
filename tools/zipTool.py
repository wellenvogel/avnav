#! /usr/bin/env python3
import getopt
import os
import traceback
from zipfile import ZipFile,ZIP_DEFLATED

import sys
def usage():
    print("Usage: zipTool.py [-p prefix] [-x excluded] outfile dirOrFile [...]",file=sys.stderr)
def err(msg,pusage=False):
    print(f"ERROR: {msg}",file=sys.stderr)
    if pusage:
        usage()
    sys.exit(1)

def zip_path(name,prefix):
    if not prefix:
        return name
    return os.path.join(prefix,name)
def main(flist,outfile,prefix=None,excluded=None):
    createdDirs={}
    with ZipFile(outfile,"w",compression=ZIP_DEFLATED) as zip:
        for f in flist:
            f=os.path.relpath(f)
            if os.path.isfile(f):
                bd=os.path.dirname(f)
                if not createdDirs.get(bd):
                    createdDirs[bd]=True
                    zip.mkdir(zip_path(bd,prefix))
                zip.write(f,zip_path(f,prefix))
            elif os.path.isdir(f):
                for root,dirs,files in os.walk(f):
                    if excluded:
                        for i in range(len(dirs)-1,0,-1):
                            if dirs[i] in excluded:
                                del dirs[i]
                    if not createdDirs.get(root):
                        zip.mkdir(zip_path(root,prefix))
                        createdDirs[root] = True
                    for filename in files:
                        fname=os.path.join(root,filename)
                        zip.write(fname,zip_path(fname,prefix))
            else:
                raise Exception(f"file {f} is no file or directory")


if __name__ == '__main__':
    OPTS="p:x:"
    prefix=None
    excluded=[]
    try:
        opts, args = getopt.getopt(sys.argv[1:], OPTS)
        for opt, arg in opts:
            if opt == '-p':
                prefix = arg
            elif opt == '-x':
                for p in arg.split(','):
                    excluded.append(p)
            else:
                assert False, "unhandled option"
        if len(args) < 2:
            err("missing parameters",pusage=True)
        outfile=args[0]
        main(args[1:],outfile,prefix=prefix,excluded=excluded)
    except getopt.GetoptError as e:
        err(str(e), pusage=True)
    except Exception as e:
        traceback.print_exc()
        err(str(e))
