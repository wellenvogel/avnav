# mkdocs macros
import os
import sys
import json
import yaml
BTJSON='docs/buttons/buttons.json' #source path
BTCSS='docs/generated/buttons.css'
BTDOC='buttons/buttons.md'
VIDEOS='docs/videos.yml'
M_YT='youtube'
M_INTERN='intern'
VMODE=M_YT
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
def toSeconds(v):
    if isinstance(v,str):
        if v.index(":") >= 0:
            parts=v.split(":")
            if len(parts) > 2:
                return int(parts[0])*3600+int(parts[1])*60+int(parts[2])
            if len(parts) > 1:
                return int(parts[0])*60+int(parts[1])
            return int(parts[0])
        return int(v)
    return v
def define_env(env):
    global cssbuild
    print("macro script loading...")
    buttons={}
    videos={}
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
    vf=os.path.join(env.project_dir,VIDEOS)
    if not os.path.exists(vf):
        print(f"WARNING: video config {vf} not found")
    else:
        with open(vf,"r") as vh:
            videos=yaml.load(vh,Loader=yaml.Loader)
        for k,v in videos.items():
            chapters=v.get('chapters')
            if chapters:
                converted=[]
                for c in chapters:
                    if isinstance(c,dict):
                        converted.append(c)
                    else:
                        parts=c.split(" ")
                        if len(parts) != 2:
                            print(f"WARNING: invalid chgapter {c} for {k}")
                        else:
                            seconds=toSeconds(parts[0])
                            cnv={
                                'start': seconds,
                                'title':parts[1],
                            }
                            for vm in [M_YT,M_INTERN]:
                                url=v.get(vm)
                                if not url:
                                    continue
                                if vm == M_YT:
                                    cnv[M_YT]=url+f"?start={seconds}&autoplay=true"
                            converted.append(cnv)
                v['converted']=converted

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

    @env.macro
    def VIDEO(name):
        if not name:
            return ''
        video=videos.get(name)
        if not video:
            return '{# unknown video '+name+'#}'
        url=video.get(VMODE)
        if not url:
            return '{# no url for video '+name+'#}'
        return "![type:video]("+url+"){ #video_"+name+" }"
    
    @env.macro
    def VCALL(name):
        if not name:
            return ''
        video=videos.get(name)
        if not video:
            return '{# unknown video '+name+'#}'
        chapters=v.get('converted')
        if not chapters:
            return '{# no chapters for video '+name+'#}'
        rt='<ul class="videochapters">'
        for c in chapters:
            rt+='<li class="videochapter" data-url="'+c.get(VMODE)+'" data-name="'+name+'">'+c.get('title')+'</li>\n'
        rt+='</ul>'
        return rt
    
    @env.macro
    def VCSINGLE(name,idx,text=None):
        if not name:
            return ''
        video=videos.get(name)
        if not video:
            return '{# unknown video '+name+'#}'
        chapters=v.get('converted')
        if not chapters:
            return '{# no chapters for video '+name+'#}' 
        if idx < 0 or idx >= len(chapters):
            return '{# chapter '+idx+' not found for '+name+'#}'
        c=chapters[idx]
        return '<a class="videochapter" data-url="'+c.get(VMODE)+'" data-name="'+name+'">'+(text or c.get('title'))+'</a>'