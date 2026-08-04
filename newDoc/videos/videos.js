(function(){
    window.document.addEventListener("DOMContentLoaded",()=>{
        const s=window.location.search;
        let video;
        let track;
        let offset;
        if (s){
            const parts=s.split("&");
            for (part of parts){
                let [n,v]=part.split('=');
                n=n.replace(/^\?/,'');
                n=decodeURIComponent(n);
                v=decodeURIComponent(v);
                if (n == 'video'){
                    video=v;
                }
                if (n == 'start'){
                    offset=v;
                }
                if (n == 'lang' && v == 'en' && video){
                    const ve=document.querySelector('video');
                    track=document.createElement('track');
                    track.setAttribute("default",true);
                    track.setAttribute("label","English");
                    track.setAttribute("kind","subtitles");
                    track.setAttribute("srclang","en");
                    track.setAttribute("src",video.replace(/\.[^.]*$/,'')+".en.vtt");
                }
            }
        }
        if (video){
            const vs=document.querySelector('video source');
            const vurl=video+(offset?'#t='+offset:'');
            if (vs) vs.setAttribute('src',vurl);
            const ve=document.querySelector('video');
            if (ve) {
                if (track) ve.appendChild(track);
                ve.load();
                ve.play();
            }
        }
    })
})()