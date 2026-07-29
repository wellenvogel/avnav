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
pageVariables={}
PV_OLD="avnav_olddoc"
PV_OLDBASE="avnav_oldbase"
PV_LANG="i18nlang"
PV_BASE="base_url"

C_START='start'
C_TITLE='title'
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
def build_chapters(name,video,chapters):
    converted=[]
    for c in chapters:
        cnv={}
        if isinstance(c,dict):
            cnv=c
            for k in [C_START,C_TITLE]:
                v=c.get(k)
                if v is None:
                    raise Exception(f"invalid video config {name}, missing {k} in chapter dict")
                if k == C_START:
                    c[k]=toSeconds(v)
        else:
            parts=c.split(" ",1)
            if len(parts) != 2:
                print(f"WARNING: invalid chapter {c} for {name}")
            else:
                seconds=toSeconds(parts[0])
                cnv={
                    C_START: seconds,
                    C_TITLE:parts[1],
                }
        for vm in [M_YT,M_INTERN]:
            url=video.get(vm)
            if not url:
                continue
            if vm == M_YT:
                cnv[M_YT]=url+f"?start={seconds}&autoplay=true"
        converted.append(cnv)
    return converted
def load_videos(vf):
    with open(vf,"r") as vh:
        videos=yaml.load(vh,Loader=yaml.Loader)
        for k,v in videos.items():
            print(f"loading video info for {k}")
            chapters=v.get('chapters')
            if chapters:
                if isinstance(chapters,dict):
                    #has language codes
                    for ck,cv in chapters.items():
                        v[ck]=build_chapters(k,v,cv)
                else:
                    v['de']=build_chapters(k,v,chapters)
    return videos

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
                    str+=f"{kindClass}.avnav-icon.{n}:after"+"{\n"
                    str+=f"  content: \"{txt}\";"+"\n}\n"
            oh.write(str)


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
        videos=load_videos(vf)

    
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
            
    def button(name,dialog=False,longText=False):
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
        addClass+=' longText' if longText else ''
        return f"<span class=\"avnav-icon {addClass} {name}\" data-link=\"{btdoc}\" title=\"{name}\"></span>"
    
    @env.macro
    def BT(name,longText=False):
        return button(name,longText=longText)

    @env.macro
    def DB(name):
        return button(name,True)
    def chapter_title(chapter):
        #TODO: language
        if not chapter:
            return ''
        return chapter.get('title')
    def video_url(item):
        if not item:
            return ''
        rt=item.get(VMODE)
        if not rt:
            return ''
        if VMODE == M_YT:
            lang=pageVariables.get(PV_LANG)
            if not lang:
                return rt
            chr='&' if rt.find('?') >= 0 else '?'
            if lang == 'de':
                rt+=chr+"cc_load_policy=0"
            else:
                rt+=chr+"cc_lang_pref="+lang+"&cc_load_policy=1"
        return rt
    @env.macro
    def VIDEO(name):
        if not name:
            return ''
        video=videos.get(name)
        if not video:
            return '{# unknown video '+name+'#}'
        url=video_url(video)
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
        chapters=video.get(pageVariables.get(PV_LANG)) or video.get('de')
        if not chapters:
            return '{# no chapters for video '+name+'#}'
        rt='<ul class="videochapters">'
        for c in chapters:
            rt+='<li class="videochapter" data-url="'+ video_url(c)+'" data-name="'+name+'">'+ chapter_title(c)+'</li>\n'
        rt+='</ul>'
        return rt
    
    @env.macro
    def VCSINGLE(name,idx,text=None):
        if not name:
            return ''
        video=videos.get(name)
        if not video:
            return '{# unknown video '+name+'#}'
        chapters=video.get(pageVariables.get(PV_LANG)) or video.get('de')
        if not chapters:
            return '{# no chapters for video '+name+'#}' 
        if idx < 0 or idx >= len(chapters):
            return '{# chapter '+idx+' not found for '+name+'#}'
        c=chapters[idx]
        return '<a class="videochapter" data-url="'+ video_url(c)+'" data-name="'+name+'">'+(text or chapter_title(c))+'</a>'
    
    def add_lang(url,lang):
        if not lang:
            return url
        return url+"?lang="+lang
    
    @env.macro
    def OLDLINK(sub=None):
        old_doc=pageVariables.get(PV_OLD)
        if not old_doc:
            return ''
        lang=pageVariables.get(PV_LANG)
        if not sub:
            return add_lang(old_doc+"/"+env.variables.old_doc_start,lang)
        return add_lang(old_doc+"/"+sub,lang)
    
def on_pre_page_macros(env):
    print(f"on_pre_page {env.page.url}")
    lang=None
    furi=env.page.file.src_uri
    alternates=env.page.file.alternates
    if not furi or not alternates:
        lang=None
    else:
        for k,v in alternates.items():
            if v.src_uri == furi:
                lang=k
                break
    num=env.page.url.count('/')
    base_url=''
    for i in range(0,num):
        base_url+="../"
    old_doc=base_url+env.variables.old_doc_rel if base_url else env.variables.old_doc_rel
    pageVariables[PV_OLD]=old_doc
    pageVariables[PV_BASE]=base_url
    pageVariables[PV_LANG]=lang
    pageVariables[PV_OLDBASE]=old_doc+"/"+env.variables.old_doc_start+"?lang="+lang
    for k,v in pageVariables.items():
        env.variables[k]=v

def on_post_page_macros(env):
    for k,v in pageVariables.items():
        env.page.meta[k]=v