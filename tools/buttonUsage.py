#! /usr/bin/env python3
import getopt
import logging
import os.path
import pprint
import re
import subprocess
import sys


logger = logging.getLogger(__name__)
logging.basicConfig(encoding='utf-8', level=logging.DEBUG)

class Usage:
    def __init__(self, file,line):
        self.file=file
        self.line=line

class BtDef:
    def __init__(self,name):
        self.name=name
        self.usages = []
    def add(self,file,line):
        self.usages.append(Usage(file,line))

def grep(dir:str,args:list=None):
    cmd=["grep","-rHn","--exclude-dir=build","--exclude-dir=.gradle", "--exclude-dir=.idea"]
    if args is not None:
        cmd=cmd+args
    cmd.append(r'[^[]ButtonDefs\.')
    cmd.append(dir)
    logger.info(cmd)
    proc = subprocess.Popen(cmd,stdout=subprocess.PIPE,encoding="utf-8")
    s1='ButtonDefs'
    re1=re.compile(r'ButtonDefs\.(\w+)')
    buttonDefs={}
    for line in proc.stdout:
        line = line.strip()
        parts=line.split(':',3)
        if len(parts)  < 3:
            continue
        match=re1.search(line)
        if match is not None:
            for bname in match.groups():
                if buttonDefs.get(bname) is None:
                    buttonDefs[bname]=BtDef(bname)
                buttonDefs[bname].add(parts[0],parts[1])
    return buttonDefs

def grepIcons(dir:str,args:list=None):
    cmd=["grep","-rHn","--exclude-dir=build","--exclude-dir=.gradle",
         "--exclude-dir=.idea","--exclude=ButtonDefs.ts","--exclude=icons.less"]
    if args is not None:
        cmd=cmd+args
    cmd.append(r'[^[]iconClasses\.')
    cmd.append(dir)
    logger.info(cmd)
    proc = subprocess.Popen(cmd,stdout=subprocess.PIPE,encoding="utf-8")
    re1=re.compile(r'iconClasses\.(\w+)')
    iconDefs={}
    for line in proc.stdout:
        line = line.strip()
        parts=line.split(':',3)
        if len(parts)  < 3:
            continue
        match=re1.search(line)
        if match is not None:
            for bname in match.groups():
                if iconDefs.get(bname) is None:
                    iconDefs[bname]=BtDef(bname)
                iconDefs[bname].add(parts[0],parts[1])
    return iconDefs

class Bt:
    def __init__(self,name:str,txt:str,icon:str,line:int):
        self.name=name
        self.txt=txt
        self.icon=icon
        self.line=line

'''
const ButtonDefinitions= {
    MOB:{
        name:btdef.MOB,
        iconClass: iconClasses.MOB,
    },
'''

def readButtons(fname):
    buttons={}
    state=0 #0: waiting for const,1 waiting for name, 2 in name
    name=None
    btname=None
    icon=None
    btline=None
    lnr=0
    rec=re.compile(r'//.*')
    re0=re.compile(r'^ *const +ButtonDefinitions *= *{')
    re1=re.compile(r'^ *(\w+) *: *{')
    reClose=re.compile(r'} *,*')
    rename=re.compile(r'^ *name *: *btdef\.(\w.+)')
    reicon=re.compile(r'^ *iconClass *: *iconClasses\.(\w+)')
    with open(fname,'r') as fb:
        for line in fb:
            lnr+=1
            line = line.strip()
            line=rec.sub('',line)
            if state == 0:
                if re0.match(line):
                    state=1
            elif state == 1:
                match=re1.match(line)
                if match is not None and match.group(1) is not None:
                    state=2
                    name=match.group(1)
                    btline=lnr
            elif state == 2:
                nmatch=rename.match(line)
                if nmatch is not None and nmatch.group(1) is not None:
                    btname=nmatch.group(1)
                imatch=reicon.match(line)
                if imatch is not None and imatch.group(1) is not None:
                    icon=imatch.group(1)
                if reClose.match(line) is not None:
                    state=1
                    buttons[name] = Bt(name, btname, icon, btline)
                    name=None
                    btname=None
                    icon=None
                    btline=None
    return buttons
'''
.icon {
  //general
  &.Images{
    .icon('image-icon.svg');
  }
'''
class IconDef:
    def __init__(self,name:str,icon:str,line:int):
        self.name=name
        self.icon=icon
        self.line=line
    def __str__(self):
        return self.__repr__()
def readIcons(fname):
    icons={}
    state=0
    name=None
    icon=None
    lnr=0
    restart=re.compile(r'^ *.icon *{')
    rename=re.compile(r'^ *&\.(\w+) *{')
    reicon=re.compile(r'^ *\.icon *\( *[\'"]([\w.-]+)')
    reClose = re.compile(r'} *,*')
    with open(fname,'r') as fb:
        for line in fb:
            lnr+=1
            line = line.strip()
            if state == 0:
                if restart.match(line) is not None:
                    state=1
            elif state == 1:
                match=rename.match(line)
                if match is not None and match.group(1) is not None:
                    icline=lnr
                    name=match.group(1)
                    state=2
            elif state == 2:
                match=reicon.match(line)
                if match is not None and match.group(1) is not None:
                    icon=match.group(1)
                if reClose.match(line) is not None:
                    state=1
                    icons[name] = IconDef(name, icon, icline)
                    name=None
                    icon=None
                    icline=None
        return icons

class TextDef:
    def __init__(self,name:str,line:int,tshort:str,tlong:str=None):
        self.name=name
        self.line=line
        self.tshort=tshort
        self.tlong=tlong
'''
.button{
  &.MOB{
    .btTxt('MOB','man over board')
  }
}
...
.dialogButton{
  &.DBOk{
    .btTxt('Ok');
  }
  
'''
def readTexts(fname):
    texts={}
    state=0
    name=None
    tshort=None
    tlong=None
    lnr=0
    restart1=re.compile(r'^ *.button *{')
    restart2 = re.compile(r'^ *.dialogButton *{')
    rename=re.compile(r'^ *&\.(\w+) *{')
    reshort=re.compile(r'^ *\.btTxt *\( *[\'"]([^\'"]+)')
    relong = re.compile(r'^ *\.btTxt *\( *[\'"]([^\'"]*)[\'"] *, *[\'"]([^\'"]*)')
    reClose = re.compile(r'} *,*')
    with open(fname,'r') as fb:
        for line in fb:
            lnr+=1
            line = line.strip()
            if state == 0:
                if restart1.match(line) is not None or restart2.match(line) is not None:
                    state=1
            elif state == 1:
                if reClose.match(line) is not None:
                    state=0
                    continue
                match=rename.match(line)
                if match is not None and match.group(1) is not None:
                    icline=lnr
                    name=match.group(1)
                    state=2
            elif state == 2:
                match=reshort.match(line)
                if match is not None and match.group(1) is not None:
                    tshort=match.group(1)
                match=relong.match(line)
                if match is not None and match.group(1) is not None and match.group(2) is not None:
                    tshort=match.group(1)
                    tlong=match.group(2)
                if reClose.match(line) is not None:
                    state=1
                    texts[name] = TextDef(name, icline,tshort,tlong)
                    name=None
                    tshort=None
                    tlong=None
                    icline=None
        return texts

#pathes relative to viewer
TDEFS=os.path.join('components','ButtonDefs.ts')
TICONS=os.path.join('style','icons.less')
TTEXTS=os.path.join('style','button_text.less')
ICONBASE=os.path.join('images','icons-new')

WORKDIR=wd=os.path.join(os.path.dirname(__file__),'..','docs')

def relPath(path=None):
    '''
    path from workdir
    :param path:
    :return:
    '''
    if path is None:
        return os.path.join('..', 'viewer')
    return os.path.join('..','viewer',path)

def iconPath(icon):
    base=relPath(ICONBASE)
    return os.path.join(base,icon)

def usage():
    print("usage: python buttonUsage.py [<args>...]",file=sys.stderr)
def err(msg):
    print(msg,file=sys.stderr)
    sys.exit(1)

def usageEntry(file:str,line:str):
    uname=file
    if uname.startswith(FILEPRFX):
        uname = uname[len(FILEPRFX):]
    return f"[{uname}]({file}#L{line})"

def iconEntry(name,iconDef:IconDef,format='table'):
    base=""
    if name:
        base=f"{name}|"
    if iconDef is not None:
        iconStr = f"[{iconDef.icon}]({relPath(TICONS)}#L{iconDef.line})"
        iconFile=''
        if format == 'pandoc':
            iconFile = f"![{iconDef.icon}]({iconPath(iconDef.icon)})"+'{width=40px}'
            pass
        else:
            iconFile = f"<img alt=\"{iconDef.icon}\" src=\"{iconPath(iconDef.icon)}\" width=\"40px\"/>"
        return base+f"{iconStr}|{iconFile}"
    return base+"|"
def defEntry(dfile:str,dname:str,dline:str,bold:bool=False):
    name=dname if not bold else f"__{dname}__"
    if dline is not None:
        return f"[{name}]({dfile}#L{dline})"
    return f"{name}"
if len(sys.argv) < 1:
    usage()
    sys.exit(1)

ALL_FORMATS=['plain','table','sparse','pandoc']
#after creating the "pandoc" markdow convert to odt
#from within the docs dir with
#pandoc -o buttonUsage.odt --embed-resources=true buttonUsage.md
format=ALL_FORMATS[0]

FILEPRFX='../viewer/'

optlist,args =getopt.getopt(sys.argv[1:],'f:')
for o, a in optlist:
    if o == '-f':
        if not a in ALL_FORMATS:
            raise RuntimeError(f'invalid format {a}, allowed formats are {",".join(ALL_FORMATS)}')
        format=a


dir=os.path.dirname(__file__)
wd=os.path.join(dir,'..','docs')
os.chdir(wd)
defs=grep(relPath())
buttonDefs=readButtons(relPath(TDEFS))
iconDefs=readIcons(relPath(TICONS))
textDefs=readTexts(relPath(TTEXTS))
iconGreps=grepIcons(relPath())
if format == 'plain':
    pprint.pprint(defs)
    pprint.pprint(iconGreps)
    pprint.pprint(buttonDefs)
    pprint.pprint(iconDefs)
    pprint.pprint(textDefs)
    sys.exit(0)
if format == 'table' or format == 'sparse' or format == 'pandoc':
    handleFirst=format == 'sparse' or format == 'pandoc'
    print("Buttons")
    print("====")
    print("|Name|File|IconName|IconFile|Icon|shortText|longText|")
    print("| --- | --- | --- | --- | --- | --- | --- |")
    for k in sorted(defs.keys()):
        buttonFound=defs[k]
        buttonDef = buttonDefs.get(k)
        first=True
        for usage in buttonFound.usages:
            bstr = f"|{defEntry(relPath(TDEFS), k, buttonDef.line if buttonDef else None,first and handleFirst)}|"
            lstr=bstr+f"{usageEntry(usage.file,usage.line)}"
            short = ''
            long = ''
            if buttonDef is not None and first:
                first=not handleFirst
                iconDef=iconDefs.get(buttonDef.icon)
                lstr+="|"+iconEntry(buttonDef.icon,iconDef,format=format)
                txt=textDefs.get(buttonDef.name)
                if txt is not None:
                    short=f"[{txt.tshort}]({relPath(TTEXTS)}#L{txt.line})"
                    long=txt.tlong or ''
            else:
                lstr+="||"
            print(f"{lstr}|{short}|{long}|")
    print("")
    print("Icons")
    print("====")
    print("|Name|Usage|IconFile|Icon|")
    print("| --- | --- | --- | --- |")
    for k in sorted(iconGreps.keys()):
        iconUsages=iconGreps.get(k)
        iconDef = iconDefs.get(k)
        first=True
        for iconUsage in iconUsages.usages:
            bstr = f"|{defEntry(relPath(ICONBASE), k, iconDef.line if iconDef else None,first and handleFirst)}|"
            lstr=bstr+f"{usageEntry(iconUsage.file,iconUsage.line)}"
            short = ''
            long = ''
            if iconDef is not None and first:
                first=not handleFirst
                lstr+="|"+iconEntry(None,iconDef,format=format)
            print(f"{lstr}")
    sys.exit(0)
raise RuntimeError(f'invalid format {format}')
