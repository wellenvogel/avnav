#! /usr/bin/env python3
import json
import re
import shutil

from markdownify import markdownify as md, MarkdownConverter, UNDERLINED
import sys
import getopt
import os

def log(s):
    print(f"LOG: {s}")
def warn(s):
    print(f"WARN: {s}")
def error(s):
    print(f"ERROR: {s}")

BTLISTPATH=re.compile('^\.\./images/icons-new/legacy/')
OLDPATH=re.compile('.*viewerimages/icons-new/')
NOCOPY=re.compile('viewerimages')
class Converter(MarkdownConverter):
    def __init__(self, imagePath=None,outDir=None,inDir=None,buttonMappings=None,copyImages=False,**options):
        super().__init__(**options)
        self.imagePath = imagePath
        self.outDir = outDir
        self.inDir = inDir
        self.mappings=buttonMappings
        self.copyImages=copyImages

    def convert_hN(self, n, el, text, parent_tags):
        anchor = None
        for child in el.children:
            if child.name == 'a':
                anchor = child.attrs.get('name')
        style = self.options['heading_style'].lower()
        if style == UNDERLINED:
            if anchor is not None and text:
                text += " {: #" + anchor + "}"
        rt=super().convert_hN(n, el, text, parent_tags)
        if style != UNDERLINED:
            rt+= " {: #" + anchor + "}"
        return rt

    def convert_div(self,el,text,parent_tags):
        cl=el.attrs.get('class')
        if isinstance(cl,list) and len(cl)>0 and 'code' in cl:
            rt='\n```\n'+text.replace(r'\_','_')+'\n```\n'
        else:
            rt=super().convert_div(el,text,parent_tags)
        return rt
    def convert_img(self,el,text,parent_tags):
        src=el.attrs.get('src')
        if src is not None:
            if src.lower().startswith('http') or src.lower().startswith('/'):
                pass
            else:
                if self.mappings and OLDPATH.match(src):
                    icon=OLDPATH.sub('',src)
                    button=self.mappings.get(icon)
                    if button:
                        return '{{BT("'+button+'")}}'
                if not OLDPATH.match(src):
                    tsrc=os.path.join(imagepath,src)
                    if self.outDir is not None:
                        isrc=os.path.join(self.outDir,tsrc)
                        if not os.path.exists(isrc):
                            if self.copyImages and self.inDir is not None:
                                srcFile=os.path.join(self.inDir,src)
                                if os.path.exists(srcFile):
                                    log(f"copying {srcFile} to {isrc}")
                                    shutil.copyfile(srcFile,isrc)
                                else:
                                    warn(f"source {srcFile} does not exist, cannot create {isrc}")
                            else:
                                warn(f"Image src '{isrc}' not found.")
                    el.attrs['src']=tsrc
        rt=super().convert_img(el,text,parent_tags)
        return rt

ARGS='i:b:c'
USAGE=f"usage: {sys.argv[0]} -i imageDir [-c] -b button.json infile outfile"
if __name__ == "__main__":
    optlist,args=getopt.getopt(sys.argv[1:],ARGS)
    imagepath=None
    buttonjson=None
    copyImages=False
    for o,a in optlist:
        if o == '-c':
            copyImages=True
        elif o=='-i':
            imagepath=a
        elif o == '-b':
            buttonjson=a
        else:
            assert False, "unhandled option"
    if len(args)  < 2:
        print(USAGE)
        sys.exit(1)
    infile=args[0]
    outfile=args[1]
    if not os.path.exists(infile):
        print(f"infile {infile} not found",file=sys.stderr)
        sys.exit(1)
    outdir = os.path.dirname(outfile)
    buttons={}
    if imagepath is not None:
        #compute relpath
        imagepath=os.path.relpath(imagepath,outdir)
        imagepath=os.path.normpath(imagepath)
        log(f"imagepath: {imagepath}")
    if buttonjson is not None:
        log(f"reading buttonjson: {buttonjson}")
        with open(buttonjson,"r") as f:
            cfg=json.load(f)
            for k,v in cfg.items():
                icon=v.get('legacy') #only need to compare legacy icons
                if icon is not None:
                    icon=BTLISTPATH.sub("",icon)
                    buttons[icon]=k
    with open(infile, "r") as f:
        indir = os.path.dirname(infile)
        if not os.path.isdir(outdir):
            os.makedirs(outdir)
        if not os.path.isdir(outdir):
            print(f"creating {outdir} failed",file=sys.stderr)
            sys.exit(1)
        out=Converter(imagePath=imagepath,
                      outDir=outdir,
                      inDir=indir,
                      copyImages=copyImages,
                      buttonMappings=buttons
                      ).convert(f.read())
        with open(outfile, "w") as fo:
            fo.write(out)



