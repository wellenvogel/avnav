# mkdocs macros
import os
import sys
import json
BTJSON='docs/buttons/buttons.json' #source path
BTCSS='docs/generated/buttons.css'
BTDOC='buttons/buttons.md'
cssbuild=False

def buildButtonCss(buttons,btcss):
    print("***Building button css***")    
    cssdir=os.path.dirname(btcss)
    if not os.path.isdir(cssdir):
        os.makedirs(cssdir)
    with open(btcss,"w") as oh:
        for n,v in buttons.items():
            str=""
            for kind in ['legacy','default']:
                img=v.get(kind)
                if img is not None:
                    str+=f".iconset-{kind} .avnav-icon.{n}"+"{\n"
                    str+=f"  background-image: url('{img}');"
                    str+='\n}\n'
            for kind in ['shortText','longText']:
                txt=v.get(kind)
                if txt is not None:
                    kindClass=f".{kind}" if kind != 'shortText' else ''
                    str+=f"{kindClass} .avnav-icon.{n}:after"+"{\n"
                    str+=f"  content: \"{txt}\";"+"\n}\n"
            oh.write(str)

def define_env(env):
    global cssbuild
    print("macro script loading...")
    buttons={}
    btf=os.path.join(env.project_dir,BTJSON)
    if not os.path.exists(btf):
        print(f"WARNING: buton defs {btf} not found")
    else:
        with open(btf,"r") as bh:
            buttons=json.load(bh)
        if not cssbuild:
            btcss=os.path.join(env.project_dir,BTCSS)
            mustBuild=True
            if os.path.exists(btcss):
                csstime=os.stat(btcss).st_mtime
                jsonmtime=os.stat(btf).st_mtime
                ownmtime=os.stat(__file__).st_mtime
                if jsonmtime <= csstime and ownmtime <= csstime:
                    mustBuild=False
            if mustBuild:
                buildButtonCss(buttons,btcss)        
                cssbuild=True

    @env.macro
    def test(name):
        rel=os.path.relpath(env.project_dir,os.path.dirname(env.page.file.src_path))
        return f"![{name}]({rel}/img/{name})"+'{ .icon-default }'
    
    @env.macro
    def BTO(name):
        if not name:
            return ''
        button=buttons.get(name)
        rel=os.path.relpath(env.project_dir,os.path.dirname(env.page.file.src_path))
        btdoc=rel+"/"+BTDOC
        link=f"[{name}]({btdoc}#{name})"
        if button is None:
            return link
        idef=button.get('default')
        ileg=button.get('legacy')
        if idef is None and ileg is None:
            return link
        rt=''
        if idef is not None:
            rt+=f"![{name}]({idef})"+'{ .icon-default } '
        if ileg is not None:
            rt+=f"![{name}]({ileg})"+'{ .icon-legacy } '
        return link+rt
            
    def button(name,dialog=False):
        if not name:
            return ''
        button=buttons.get(name)
        rel=os.path.relpath(env.project_dir,os.path.dirname(env.page.file.src_path))
        btdoc=rel+"/"+BTDOC+"#"+name
        link=f"[{name}]({btdoc})"
        if button is None:
            return link
        btdoc=btdoc.replace('.md','.html')
        addClass='dialog-button' if dialog else ''
        return f"<div class=\"avnav-icon {addClass} {name}\" data-link=\"{btdoc}\" title=\"{name}\"></div>"
    
    @env.macro
    def BT(name):
        return button(name)

    @env.macro
    def DB(name):
        return button(name,True)    