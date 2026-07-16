# mkdocs macros
import os
import sys
import json
BTJSON='docs/generated/buttons.json' #source path
BTDOC='generated/buttons.md'
def define_env(env):
    print("macro script loading...")
    buttons={}
    btf=os.path.join(env.project_dir,BTJSON)
    if not os.path.exists(btf):
        print(f"WARNING: buton defs {btf} not found")
    else:
        with open(btf,"r") as bh:
            buttons=json.load(bh)
    @env.macro
    def test(name):
        rel=os.path.relpath(env.project_dir,os.path.dirname(env.page.file.src_path))
        return f"![{name}]({rel}/img/{name})"+'{ .icon-default }'
    
    @env.macro
    def BT(name):
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
            