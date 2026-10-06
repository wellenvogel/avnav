(function(){
    const setError=(msg)=>{
        const error=document.createElement('div');
        error.textContent=msg;
        error.style.color='red';
        error.style.fontSize='2em';
        error.style.fontWeight='bold';
        document.body.insertBefore(error,document.body.firstChild);
    }
    window.document.addEventListener("DOMContentLoaded",()=>{
        const s=window.location.search;
        let video;
        let track;
        let offset;
        let base;
        let lang;
        if (s){
            const searchparams=new URLSearchParams(s);
            for (const [n,v] of searchparams.entries()){
                if (n == 'videobase'){
                    base=v;
                }
                if (n == 'video'){
                    video=v;
                }
                if (n == 'start'){
                    offset=v;
                }
                if (n == 'lang'){
                    lang=v;
                }
            }
        }
        const ve=document.querySelector('video');
        if (base){
            const vurl=new URL(base+"/"+video,window.location.href);
            if (vurl.origin != window.location.origin){
                setError("video base must be on same origin as this page");
                if (ve) ve.style.display='none';
                return;
            }
            video=vurl.href;
        }
        if (video && !!base){
            const vs=document.querySelector('video source');
            const vurl=video+(offset?'#t='+offset:'');
            if (lang == 'en'){
                    track=document.createElement('track');
                    track.setAttribute("default",true);
                    track.setAttribute("label","English");
                    track.setAttribute("kind","subtitles");
                    track.setAttribute("srclang","en");
                    track.setAttribute("src",video.replace(/\.[^.]*$/,'')+".en.vtt");
            }
            if (ve) {
                ve.addEventListener("error",(e)=>{
                    setError("video not found: "+vurl);    
                });
                if (track) ve.appendChild(track);
                ve.load();
                ve.play();
            }
            vs.addEventListener("error",(e)=>{
                setError("video not found: "+vurl);
            });
            if (vs) vs.setAttribute('src',vurl);
        }
        else{
            if (ve) ve.style.display='none';
            setError("missing parameter video or videobase");
        }
    })
})()