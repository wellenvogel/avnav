#! /usr/bin/env python

import sys
import os
import subprocess
import re


def err(str):
  print("ERROR: %s"%(str))
  sys.exit(1)

def info(str):
  print "INFO: %s"%(str)

# replace in a file
# pattern: a list of [re,replace]
def replaceInline(file,pattern):
  compiledPattern=[]
  for p in pattern:
    compiledPattern.append([re.compile(p[0]),p[1]])
  changed=False
  with open(file,'r') as f:
    newlines = []
    for line in f.readlines():
        for p in compiledPattern:
          if p[0].search(line) is not None:
            line=p[0].sub(p[1],line)
            changed=True
        newlines.append(line)
  if changed:
    info("writing back changed file %s"%(file))
    with open(file, 'w') as f:
      for line in newlines:
          f.write(line)


VIEWER_VERSION=os.path.join("viewer","version.js")
WINDOWS_VERSION=os.path.join("windows","AvChartConvert","AvChartConvert","Properties","AssemblyInfo.cs")

dryrun=False
doCommit=False
args=sys.argv
while len(args) >= 2:
  if (args[1].startswith("-")):
    if args[1]=="-n":
      dryrun=True
    else:
      if args[1]=="-c":
        doCommit=True
      else:
        err("invalid option %s"%(args[1]))
    args=args[0:1]+args[2:]
  else:
    break
if len(args) < 2:
  err("usage: %s [-n] [-c] version"%(args[0]))
version=args[1]
git_tag="release-"+version
splittedVersion=version.split("-")
if len(splittedVersion) != 3:
  err("invalid version format, expected 2015-10-18")

base = os.path.dirname(os.path.realpath(__file__))
viewer_version=os.path.join(base,VIEWER_VERSION)
if not os.path.exists(viewer_version):
  err("viewer version file %s not found"%(viewer_version))
info("viewer version file %s found "%(viewer_version))
windows_version=os.path.join(base,WINDOWS_VERSION)
if not os.path.exists(windows_version):
  err("windows version file %s not found"%(windows_version))
info("windows version file %s found "%(windows_version))
hasDiffs=subprocess.check_output(["git","diff","--stat"])
if hasDiffs != '' and hasDiffs is not None:
  err("uncommited changes:\n%s"%hasDiffs)
info("git: no uncomitted changes")
tags=subprocess.check_output(["git","tag"])
if tags is not '':
  taglist=tags.splitlines()
  for tag in taglist:
    if tag.rstrip().lstrip() == git_tag:
      err("git tag %s already existing"%(git_tag))
info("git: tag %s not used yet"%(git_tag))
if dryrun:
  info("dryrun: exit now")
  sys.exit(0)
info("changing version in %s"%(viewer_version))
replaceInline(viewer_version,[["avnav_version *=.*","avnav_version=\""+version+"\";"]])
info("changing version in %s"%(windows_version))
windows_version_string=version.replace("-",".")+".0"
replaceInline(windows_version,[
  ["^ *\[assembly: AssemblyVersion.*","[assembly: AssemblyVersion(\""+windows_version_string+"\")]"],
  ["^ *\[assembly: AssemblyFileVersion.*","[assembly: AssemblyFileVersion(\""+windows_version_string+"\")]"],
  ])
if not doCommit:
  info("nothing comitted due to missing -c flag")
  sys.exit(0)
info("git: commiting")
rt=subprocess.call(["git","commit","-m","set version for release "+version,base])
if rt != 0:
  err("git: commit failed")
info("git: creating tag %s"%(git_tag))
rt=subprocess.call(["git","tag",git_tag])
if rt != 0:
  err("git: tag failed")
info("sucessfully changed versions and created git tag %s"%(git_tag))
