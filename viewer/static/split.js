(function(){
    var PNAME="avnavsplit.percent";
    var dragPosition=-1;
    var dragstartX=-1;
    var mover=document.getElementById('mover');
    var f1=document.getElementById('left');
    var f2=document.getElementById('right');
    var frame=document.getElementById('split_main');
    var setMover=function(opt_pos){
        if (opt_pos === undefined) {
            var rect = f1.getBoundingClientRect();
            opt_pos=rect.width;
        }
        var mrect=mover.getBoundingClientRect();
        mover.style.left=(opt_pos-mrect.width/2)+'px';
    }
    var setSplit=function(percent){
        f1.style.width=(percent)+"%";
        f2.style.width=(100-percent)+"%";
        setMover();
        if (window.localStorage){
            window.localStorage.setItem(PNAME,percent+"");
        }
        window.setTimeout(function(){
            mover.style.opacity=0.3;
        },5000)
    }
    var setSplitFromPos=function(pos){
        var r=frame.getBoundingClientRect();
        var percent=pos*100/r.width;
        if (percent < 0) percent=0;
        if (percent >= 99.999) percent=99.999;
        setSplit(percent);
    }
    mover.addEventListener('dragstart',function(ev){
        dragstartX=ev.screenX;
        mover.style.opacity=0.6;
    });
    mover.addEventListener('touchstart',function(ev){
        ev.preventDefault();
        var touchobj = ev.changedTouches[0];    // erster Finger des touchstart-Events
        dragPosition = parseInt(touchobj.screenX);
        mover.style.opacity=0.6;
        setMover(dragPosition);
    });
    mover.addEventListener('touchmove',function(ev){
        var touchobj = ev.changedTouches[0];
        dragPosition = parseInt(touchobj.screenX);
        setMover(dragPosition);
    })
    mover.addEventListener('touchend',function(ev){
        var touchobj = ev.changedTouches[0];
        dragPosition = parseInt(touchobj.screenX);
        setSplitFromPos(dragPosition);
    })
    mover.addEventListener('dragend',function(ev){
        ev.preventDefault();
        var left=f1.getBoundingClientRect().width;
        if (dragstartX < 0) return;
        left += ev.screenX - dragstartX;
        dragstartX=-1;
        setSplitFromPos(left);
    })

    var percent=50;
    if (window.localStorage){
        var ps=window.localStorage.getItem(PNAME);
        if (ps){
            percent=parseInt(ps);
        }
    }
    var location=window.location.href+'';
    location=location.replace('viewer_split','avnav_viewer');
    var singleLocation=location;
    singleLocation=singleLocation.replace(/\?.*/,'');
    if (! location.match(/[?]/)) location+='?';
    location+="&fullscreen=parent";
    if (window.location.search.match(/split=/)){
        var np=window.location.search.replace(/.*split=/,'').replace(/[^0-9].*/,'');
        if (! isNaN(np)){
            percent=np;
        }
    }
    setSplit(percent);
    f1.src=location+"&storePrefix=1";
    f2.src=location+"&storePrefix=2";
    window.addEventListener('resize',function(){setMover()});
    window.addEventListener('message',function(ev){
        if (ev.data === 'fullscreen'){
            if (document.fullscreenElement){
                document.exitFullscreen()
            }
            else {
                document.body.requestFullscreen();
            }
        }
        if (ev.data === 'settingsChanged'){
            [f1,f2].forEach(function(frm){
                frm.contentWindow.postMessage('reloadSettings',window.location.origin);
            })
        }
        if (ev.data === 'finishSplit'){
            window.location.href=singleLocation;
        }
        if (ev.data === 'querySplitMode'){
            [f1,f2].forEach(function(frm){
                frm.contentWindow.postMessage('isSplitMode',window.location.origin);
            })
        }
    })
})();