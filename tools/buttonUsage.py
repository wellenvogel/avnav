#! /usr/bin/env python3
import getopt
import logging
import os.path
import pprint
import re
import subprocess
import sys

F_PLAIN='plain'
F_TABLE='table'
F_SPARSE='sparse'
F_PANDOC='pandoc'
F_BT2ICON='button2icon'
F_ICONUSAGE='iconusage'
F_BTEXT="buttontext"
F_ICONS='icons'
F_BTOVERVIEW='buttonoverview'
F_BTJSON='buttonjson'

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
    logger.info(" ".join(cmd))
    proc = subprocess.Popen(cmd,stdout=subprocess.PIPE,encoding="utf-8")
    s1='ButtonDefs'
    re1=re.compile(r'ButtonDefs\.(\w+)')
    buttonDefs={}
    for line in proc.stdout:
        line = line.strip()
        parts=line.split(':',3)
        if len(parts)  < 3:
            continue
        for bname in re1.findall(line):
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
    logger.info(" ".join(cmd))
    proc = subprocess.Popen(cmd,stdout=subprocess.PIPE,encoding="utf-8")
    re1=re.compile(r'iconClasses\.(\w+)')
    iconDefs={}
    for line in proc.stdout:
        line = line.strip()
        parts=line.split(':',3)
        if len(parts)  < 3:
            continue
        for bname in re1.findall(line):
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
    rename=re.compile(r'^ *name *: *btdef\.(\w+)')
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
    //alt
    .icon('legacy.svg','default.svg');
  }
'''
class IconDef:
    def __init__(self,name:str,icon,line:int):
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
    reicon2 = re.compile(r'^ *\.icon *\( *[\'"]([\w.-]+) *[\'"] *, *[\'"]([\w.-]+)')
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
                match = reicon2.match(line)
                if match is not None and match.group(1) is not None and match.group(2) is not None:
                    icon = ['legacy/'+match.group(1), 'default/'+match.group(2)]
                else:
                    match=reicon.match(line)
                    if match is not None and match.group(1) is not None:
                        icon=['legacy/'+match.group(1)]
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

#if set replace ICONBASE by this in ouput
ICONPATH=None
#the relative path from the output directory
#to the AvNav base dir
RELPATH=".."
def relPath(path=None):
    '''
    path from workdir
    :param path:
    :return:
    '''
    if path is None:
        return os.path.join(RELPATH, 'viewer')
    return os.path.join(RELPATH,'viewer',path)

def iconPath(icon):
    if ICONPATH is not None:
        return os.path.join(ICONPATH,icon)
    base=relPath(ICONBASE)
    return os.path.join(base,icon)

def usage():
    print("usage: python buttonUsage.py [-f format] [-o outfile] [-i iconpath]",file=sys.stderr)
def err(msg):
    print(msg,file=sys.stderr)
    sys.exit(1)

def usageEntry(file:str,line:str):
    uname=file
    if uname.startswith(FILEPRFX):
        uname = uname[len(FILEPRFX):]
    return f"[{uname}]({file}#L{line})"

def iconEntry(name,iconDef:IconDef,format=F_TABLE,omitName=False,addTitle=False):
    if iconDef is not None:
        iconStr = f"[{iconDef.name}]({relPath(TICONS)}#L{iconDef.line})" if not omitName else ""
        iconFile=''
        if iconDef.icon:
            for icon in iconDef.icon:
                if format == F_PANDOC:
                    title=''
                    if addTitle:
                        title=f" title=\"{icon}\""
                    iconFile += f"|![{icon}]({iconPath(icon)})"+'{width=40px'+title+'}'
                else:
                    iconFile += f"|<img alt=\"{icon}\" src=\"{iconPath(icon)}\" width=\"40px\"/>"
        return f"{iconStr}{iconFile}"
    return (name or '')+"||" if not omitName else "||"
def defEntry(dfile:str,dname:str,dline:str,bold:bool=False):
    name=dname if not bold else f"__{dname}__"
    if dline is not None:
        return f"[{name}]({dfile}#L{dline})"
    return f"{name}"

def iconUsage(icon:str,buttonDefs,iconGreps):
    buttons=[]
    for button in buttonDefs.values():
        if button.icon == icon:
            buttons.append(button.name)
    found=iconGreps.get(icon)
    if found is not None:
        code=found.usages
    else:
        code = None
    if code is None:
        code=[]
    return(buttons,code)


if len(sys.argv) < 1:
    usage()
    sys.exit(1)
ALL_FORMATS=[F_PLAIN,F_TABLE,F_SPARSE,F_PANDOC,F_BT2ICON,F_ICONUSAGE,F_BTEXT,F_ICONS,F_BTOVERVIEW,F_BTJSON]
#after creating the "pandoc" markdow convert to odt
#from within the docs dir with
#pandoc -o buttonUsage.odt --embed-resources=true buttonUsage.md
format=ALL_FORMATS[0]

FILEPRFX='../viewer/'
outfile=None
optlist,args =getopt.getopt(sys.argv[1:],'f:o:i:')
for o, a in optlist:
    if o == '-f':
        if not a in ALL_FORMATS:
            raise RuntimeError(f'invalid format {a}, allowed formats are {",".join(ALL_FORMATS)}')
        format=a
    elif o == '-o':
        outfile=a
        logger.info("output to file %s",outfile)
    elif o == '-i':
        ICONPATH=a
dir=os.path.dirname(__file__)
basedir=os.path.realpath(os.path.join(dir,'..'))
stream=sys.stdout
if outfile is not None:
    wd=os.path.dirname(outfile)
    if not os.path.isdir(wd):
        print(f"{wd} is not a directory",file=sys.stderr)
        sys.exit(1)
    stream=open(outfile,'w')
else:
    wd=os.path.join(basedir,'docs')
logger.info("workdir: %s",wd)
RELPATH=os.path.relpath(basedir,wd)
logger.info("relpath: %s",RELPATH)
if ICONPATH is not None:
    ICONPATH=os.path.relpath(ICONPATH,wd)
    logger.info("iconpath: %s",ICONPATH)
os.chdir(wd)
defs=grep(relPath())
buttonDefs=readButtons(relPath(TDEFS))
iconDefs=readIcons(relPath(TICONS))
textDefs=readTexts(relPath(TTEXTS))
iconGreps=grepIcons(relPath())

oprint=print

def print(*args,**kwargs):
    if kwargs and 'file' in kwargs:
        oprint(*args,**kwargs)
        return
    oprint(*args,file=stream,**kwargs)


if format == F_PLAIN:
    pprint.pprint(defs,stream=stream)
    pprint.pprint(iconGreps,stream=stream)
    pprint.pprint(buttonDefs,stream=stream)
    pprint.pprint(iconDefs,stream=stream)
    pprint.pprint(textDefs,stream=stream)
    sys.exit(0)
if format == F_TABLE or format == F_SPARSE or format == F_PANDOC:
    handleFirst=format == F_SPARSE or format == F_PANDOC
    print("Buttons")
    print("====")
    print("|Name|File|IconName|Icon|IconNew|shortText|longText|")
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
                txt=textDefs.get(buttonDef.txt)
                if txt is not None:
                    short=f"[{txt.tshort}]({relPath(TTEXTS)}#L{txt.line})"
                    long=txt.tlong or ''
            else:
                lstr+="||"
            print(f"{lstr}|{short}|{long}|")
    print("")
    print("Icons")
    print("====")
    print("|Name|Usage|Name|Icon|IconNew|")
    print("| --- | --- | --- | --- | --- |")
    for k in sorted(iconGreps.keys()):
        iconUsages=iconGreps.get(k)
        iconDef = iconDefs.get(k)
        first=True
        for usedIcon in iconUsages.usages:
            bstr = f"|{defEntry(relPath(ICONBASE), k, iconDef.line if iconDef else None,first and handleFirst)}|"
            lstr=bstr+f"{usageEntry(usedIcon.file,usedIcon.line)}"
            short = ''
            long = ''
            if iconDef is not None and first:
                first=not handleFirst
                lstr+="|"+iconEntry(None,iconDef,format=format)
            print(f"{lstr}")
    print("")
    print("IconUsage")
    print("====")
    print("|Name|Icon|IconNew|Usage|")
    print("| --- | --- | --- | --- |")
    for k in sorted(iconDefs.keys()):
        iconDef=iconDefs.get(k)
        buttons,code=iconUsage(k,buttonDefs,iconGreps)
        usage=",".join(buttons)
        if len(code)>0:
            usage+=',' if usage else ''
            usage+="code"
        bstr = f"|{iconEntry(k,iconDef,format=format)}|{usage}|"
        print(bstr)
    sys.exit(0)
elif format == F_BTOVERVIEW:
    print("AvNav Buttons")
    print("====")
    print("|Name(Class)|Text|LongText|IconOld|IconNew|")
    print("| --- | --- | --- | --- | --- |")
    for k in sorted(buttonDefs.keys()):
        buttonDef = buttonDefs.get(k)
        textDef = textDefs.get(buttonDef.txt)
        iconDef = iconDefs.get(buttonDef.icon)
        txt=f"{textDef.tshort}|{textDef.tlong}" if textDef else ' | '
        icon=iconEntry(buttonDef.icon,iconDef,format=F_PANDOC,omitName=True,addTitle=True) if iconDef is not None else ''
        print(f"|{k}|{txt}{icon}|")
    sys.exit(0)
elif format == F_BT2ICON:
    '''
    interesting commands afterwards:
    #build an sed command to migrate from old def to new icon based
    #omit the 'p' if you only have the button icons and run the sed without -n
    tools/buttonUsage.py -f button2icon | sed 's/\(\w*\) *\(.*\)/s?\.button.\1 *span?.icon.\2?p/' > ~x.sed
    #combine the old style button icon to one line
    sed -n '/^ *\.button.*span/{x; N; N; s/\n//g; p;}' < plugin.css
    '''
    for k in sorted(buttonDefs.keys()):
        buttonDef = buttonDefs.get(k)
        print(f"{k} {buttonDef.icon}")
    sys.exit(0)
elif format == F_ICONUSAGE:
    for k in sorted(iconDefs.keys()):
        iconDef = iconDefs.get(k)
        buttons, code = iconUsage(k, buttonDefs, iconGreps)
        usage = ",".join(buttons)
        if len(code) > 0:
            usage += ',' if usage else ''
            usage += "code"
        print(f"{k} {usage}")
    sys.exit(0)
elif format == F_BTEXT:
    for k in sorted(buttonDefs.keys()):
        buttonDef = buttonDefs.get(k)
        name=buttonDef.txt
        texts=textDefs.get(name)
        short='---'
        long='---'
        if texts is not None:
            short=texts.tshort
            long=texts.tlong
        print(f"{k},{name},{short},{long},")
    sys.exit(0)
elif format == F_ICONS:
    for k in sorted(iconDefs.keys()):
        iconDef = iconDefs.get(k)
        print(f"{k} {iconDef.icon}")
    sys.exit(0)
raise RuntimeError(f'invalid format {format}')
