#! /usr/bin/env python3
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

class Converter(MarkdownConverter):
    def __init__(self, imagePath=None,baseDir=None,**options):
        super().__init__(**options)
        self.imagePath = imagePath
        self.baseDir = baseDir

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
                src=os.path.join(imagepath,src)
                if self.baseDir is not None:
                    isrc=os.path.join(self.baseDir,src)
                    if not os.path.exists(isrc):
                        warn(f"Image src '{isrc}' not found.")
                el.attrs['src']=src
        rt=super().convert_img(el,text,parent_tags)
        return rt

ARGS='i:'
USAGE=f"usage: {sys.argv[0]} -i imageDir infile outfile"
if __name__ == "__main__":
    optlist,args=getopt.getopt(sys.argv[1:],ARGS)
    imagepath=None
    for o,a in optlist:
        if o=='-i':
            imagepath=a
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
    if imagepath is not None:
        #compute relpath
        imagepath=os.path.relpath(imagepath,outdir)
        log(f"imagepath: {imagepath}")
    with open(infile, "r") as f:
        out=Converter(imagePath=imagepath,baseDir=outdir).convert(f.read())
        with open(outfile, "w") as fo:
            fo.write(out)



