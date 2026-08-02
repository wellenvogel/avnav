
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
    try{
        iconset=localStorage.getItem(LSNAME)
        if (! iconset) iconset='iconset-default';
    }catch (e){};
    if (window.location.search){
        const param=window.location.search.split('&');
        param.forEach((p)=>{
            let [n,v]=p.split("=");
            n=n.replace(/^\?/,'');
            v=decodeURIComponent(v);
            n=decodeURIComponent(n);
            if (n == 'iconset'){
                if (v == 'legacy' || v == 'default'){
                    iconset='iconset-'+v;
                    try{
                        localStorage.setItem(LSNAME,iconset);
                    }catch (e){}
                }
            }

        })
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
})