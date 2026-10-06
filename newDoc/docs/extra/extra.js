
const iconvariants=['iconset-default','iconset-legacy'];
const LSNAME='iconset';
const update=(initial)=>{
    let activeText='unknown';
    for (const ics of iconvariants){
        const active=document.body.classList.contains(ics);
        const action=document.getElementById('select-'+ics);
        if (action){
            if (initial){
                action.addEventListener('click',()=>{
                    iconvariants.forEach((iv)=>{
                        if (iv === ics){
                            document.body.classList.add(iv);
                            try{
                            localStorage.setItem(LSNAME,iv);
                            }catch (e){}
                        }
                        else{
                            document.body.classList.remove(iv);
                        }
                        update();
                    })
                })
            }
            if (active) action.parentElement.classList.add('selected');
            else action.parentElement.classList.remove('selected');
            if (active) activeText=ics.replace('iconset-','');
        }
    }
    const display=document.getElementById('iconset-current');
    if (display) display.textContent=activeText;
}
document$.subscribe(()=>{
    let iconSet;
    let videobase;
    try{
        iconset=localStorage.getItem(LSNAME)
        if (! iconset) iconset='iconset-default';
    }catch (e){};
    if (window.location.search){
        const searchparams=new URLSearchParams(window.location.search);
        for (const [key,value] of searchparams.entries()){
            if (key == 'iconset'){
                if (value == 'legacy' || value == 'default'){
                    iconset='iconset-'+value;
                    try{
                        localStorage.setItem(LSNAME,iconset);
                    }catch (e){}
                }
            }
            if (key == 'videobase'){
                videobase=value;    
            }
        }
    }
    document.body.classList.add(iconset);
    update(true);
    const links=Array.from(document.querySelectorAll('[data-link]'))
    for (const link of links){
        link.addEventListener('click',()=>{
            window.location.href=link.getAttribute('data-link');
        })
    }
    const videoLinks=Array.from(document.querySelectorAll('a.videolink'))
    for (const a of videoLinks){
        a.setAttribute("target","_blank");
    }
    for (const a of Array.from(document.querySelectorAll('a'))){
        if (a.classList.contains('video')){
            if (videobase){
                const url=a.getAttribute('data-localurl');
                if (url){
                    a.setAttribute('href',url+"&videobase="+encodeURIComponent(videobase));
                }
            }else{
                const url=a.getAttribute('data-yturl');
                if (url){
                    a.setAttribute('href',url);
                }
            }
        }
        const url=new URL(a.getAttribute('href'),window.location.href);
        if (videobase && url.origin == window.location.origin){
            url.searchParams.set('videobase',videobase);
            a.setAttribute('href',url.href);
        }
    }
    const videochapters=Array.from(document.querySelectorAll('.videochapter'));
    for (const vc of videochapters){
        vc.addEventListener('click',()=>{
            const url=vc.getAttribute('data-url');
            const id=vc.getAttribute('data-name');
            if (!url || ! id) return;
            const target=document.getElementById('video_'+id);
            if (! target) return;
            target.src=null;
            target.src=url;
        })
    }
    const ela=Array.from(document.querySelectorAll('a'));
    const img=document.getElementById('linkIcon');
    for (const el of ela){
        const target=el.getAttribute('href');
        if (target){
            const tUrl=new URL(target,window.location.href);
            if (tUrl.origin != window.location.origin){
                el.classList.add('external');
                if (img) {
                    const limg=img.cloneNode(true);
                    limg.classList.remove('hidden');
                    limg.removeAttribute('id');
                    el.appendChild(limg);
                }
            }
        }
    }
})