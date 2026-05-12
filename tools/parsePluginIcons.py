#! /usr/bin/env python3
import getopt
import os
import pprint
import re
import sys

import css_parser
from css_parser.css import CSSStyleRule


def parseFile(fname:str):
    content=css_parser.parseFile(fname)
    return content

def urlToFile(url:str,base:str=None):
    if not url:
        return
    name=re.sub(r'^ *url\(', '', url)
    name=re.sub(r'\).*', '', name)
    name=re.sub(r'^["\']', '', name)
    name = re.sub(r'["\']$', '', name)
    if base:
        return os.path.join(base,name)
    return name

def printPlainIcon(icon:str,file:str):
    print(f"{icon} {file}")

def xjoin(base:str,file:str):
    if not base:
        return file
    return os.path.join(base,file)
def printTable(icon:str,file:str,base:str,format:str):
    if format == 'pandoc':
        print(f"| {icon} | {file} |![{icon}]({xjoin(base,file)})"+'{width=40px}|')
    else:
        print(f"| {icon} | {file} | <img alt=\"{icon}\" src=\"{xjoin(base,file)}\" width=\"40px\"/>|")

def printRule(rule:CSSStyleRule,regex:re.Pattern,base:str,format:str,useBase:bool=False):
    if rule.selectorText is None:
        return
    matches = regex.search(rule.selectorText)
    if matches:
        icon = matches.group(1)
        url = rule.style.backgroundImage
        if not url:
            return
        file = urlToFile(url)
        completeFile=xjoin(base,file)
        if not os.path.exists(completeFile):
            print(f"##{file}: {completeFile} not found",file=sys.stderr)
        if format == 'plain':
            printPlainIcon(icon, file)
        else:
            printTable(icon, file, base if useBase else None, format)

rebuttontxt=re.compile(r'\.button\.(\w+):after')
relongbuttontxt = re.compile(r'\.longText\.button\.(\w+):after')
def textFromRule(rule:CSSStyleRule):
    if rule.selectorText is None:
        return [None,None,None]
    id=0
    for regexp in [relongbuttontxt,rebuttontxt]:
        id+=1
        match = regexp.search(rule.selectorText)
        if match:
            rt = [match.group(1),None,None]
            txt=rule.style.content
            if txt:
                if txt.startswith('"'):
                    txt=txt[1:]
                if txt.endswith('"'):
                    txt=txt[:-1]
            rt[id]=txt
            return rt
    return [None,None,None]


if __name__=='__main__':
    ALL_FORMATS = ['plain', 'table', 'pandoc', 'button2icon', 'iconusage']
    # after creating the "pandoc" markdow convert to odt
    # from within the docs dir with
    # pandoc -o buttonUsage.odt --embed-resources=true buttonUsage.md
    format = ALL_FORMATS[0]
    usePath=False
    optlist, args = getopt.getopt(sys.argv[1:], 'f:p')
    for o, a in optlist:
        if o == '-f':
            if not a in ALL_FORMATS:
                raise RuntimeError(f'invalid format {a}, allowed formats are {",".join(ALL_FORMATS)}')
            format = a
        if o == '-p':
            usePath=True
    filename=args[0]
    if not os.path.isfile(filename):
        raise Exception("%s not found" % filename)
    dir=os.path.dirname(filename)
    data=parseFile(filename)
    reicon=re.compile(r'\.icon\.(\w+)')
    rebutton=re.compile(r'\.button\.(\w+)')
    if format == 'table' or format == 'pandoc':
        print("Icons")
        print("====")
        print("|Name|IconFile|Icon|")
        print("| --- | --- | --- |")
    else:
        print("###Icons")
    for rule in data.cssRules:
        if isinstance(rule,css_parser.css.CSSStyleRule):
            printRule(rule,reicon,dir,format,useBase=usePath)

    if format == 'table' or format == 'pandoc':
        print("")
        print("Buttons")
        print("====")
        print("|Name|IconFile|Icon|")
        print("| --- | --- | --- |")
    else:
        print("###Buttons")
    for rule in data.cssRules:
        if isinstance(rule,css_parser.css.CSSStyleRule):
            printRule(rule,rebutton,dir,format,useBase=usePath)
    buttonTexts={}
    for rule in data.cssRules:
        if isinstance(rule,css_parser.css.CSSStyleRule):
            (name,long,short)=textFromRule(rule)
            if name:
                if buttonTexts.get(name) is None:
                    buttonTexts[name]={'short':short,'long':long}
                else:
                    if short:
                        buttonTexts[name]['short']=short
                    if long:
                        buttonTexts[name]['long']=long
    if format == 'table' or format == 'pandoc':
        print("")
        print("ButtonTexts")
        print("====")
        print("|Name|Short|Long|")
        print("| --- | --- | --- |")
    for button in sorted(buttonTexts.keys()):
        texts=buttonTexts[button]
        if format == 'table' or format == 'pandoc':
            print(f"|{button}|{texts.get('short')}|{texts.get('long')}|")
        else:
            print(f"{button},{texts.get('short') or '<None>'},{texts.get('long') or '<None'}")
    #pprint.pprint(data)