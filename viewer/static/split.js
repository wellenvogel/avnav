(function(){
    function getParam(key,src)
    {
        // Find the key and everything up to the ampersand delimiter
        let value=RegExp(""+key+"[^&]+").exec(src||window.location.search);

        // Return the unescaped value minus everything starting from the equals sign or an empty string
        return decodeURIComponent(!!value ? value.toString().replace(/^[^=]+./,"") : "");
    }
    var PNAME="avnavsplit.percent";
    var dragstartX=-1;
    var mover=document.getElementById('mover');
    var f1=document.getElementById('left');
    var f2=document.getElementById('right');
    var frame=document.getElementById('split_main');
    var rotation='none';
    var isRotated=()=>{
        return rotation !== 'none';
    }
    var setMover=function(opt_offset){
        var rect = f1.getBoundingClientRect();
        var pos=isRotated()?rect.height: rect.width;
        if (opt_offset) pos+=opt_offset
        var mrect=mover.getBoundingClientRect();
        mover.style.left = (pos - mrect.width / 2) + 'px';

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
    var setSplitFromPos=function(offset){
        var r=frame.getBoundingClientRect();
        var r1=f1.getBoundingClientRect();
        var npos=r1.width;
        if (isRotated()){
            if (rotation === '90ccw') npos=r1.top;
            else npos=r1.height;
        }
        npos+=offset;
        var percent=npos*100/(isRotated()?r.height:r.width);
        if (percent < 0) percent=0;
        if (percent >= 99.999) percent=99.999;
        if (rotation === '90ccw') percent=100-percent
        setSplit(percent);
        window.setTimeout(()=>{
            setMover();
        },100)
    }
    var setRotationClass=()=>{
        const classes={
            "90cw":"rotateCW",
            "90ccw": "rotateCCW"
        };
        for (let k in classes){
            if (rotation === k) {
                if (!document.body.classList.contains(classes[k])) {
                    document.body.classList.add(classes[k]);
                }
            }
            else{
                document.body.classList.remove(classes[k]);
            }
        }
    }
    mover.addEventListener('dragstart',function(ev){
        ev.stopPropagation();
        dragstartX=isRotated()?ev.screenY:ev.screenX;
        mover.style.opacity=0.6;
    });
    mover.addEventListener('touchstart',function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var touchobj = ev.changedTouches[0];    // erster Finger des touchstart-Events
        dragstartX = isRotated()?parseInt(touchobj.screenY):parseInt(touchobj.screenX);
        mover.style.opacity=0.6;
    });
    mover.addEventListener('touchmove',function(ev){
        ev.stopPropagation();
        if (dragstartX < 0) return;
        var touchobj = ev.changedTouches[0];
        var dragPosition = isRotated()?parseInt(touchobj.screenY):parseInt(touchobj.screenX);
        setMover(dragPosition-dragstartX);
    })
    mover.addEventListener('touchend',function(ev){
        ev.stopPropagation();
        if (dragstartX < 0) return;
        var touchobj = ev.changedTouches[0];
        var dragPosition = isRotated()?parseInt(touchobj.screenY):parseInt(touchobj.screenX);
        setSplitFromPos(dragPosition-dragstartX);
        dragstartX=-1;
    })
    mover.addEventListener('dragend',function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (dragstartX < 0) return;
        var  pos= (isRotated()?ev.screenY: ev.screenX);
        //if (rotation === '90ccw') pos=-pos;
        setSplitFromPos(pos-dragstartX);
        dragstartX=-1;
    })

    var percent=50;
    if (window.localStorage){
        var ps=window.localStorage.getItem(PNAME);
        if (ps){
            percent=parseInt(ps);
        }
    }
    var location=window.location.href+'';
    var protation=getParam("rotation",location);
    if (protation){
        rotation=protation
    }
    setRotationClass();
    location=location.replace('viewer_split','avnav_viewer');
    var singleLocation=location;
    var FWPARAM=["fullscreen","dimm"];
    var fwValues={};
    FWPARAM.forEach(function(p){
        var v=getParam(p,singleLocation);
        if (v) fwValues[p]=v;
    })
    singleLocation=singleLocation.replace(/\?.*/,'');
    var i;
    var delim="?";
    for (i in fwValues){
        singleLocation+=delim+encodeURIComponent(i)+"="+encodeURIComponent(fwValues[i]);
        delim="&";
    }
    if (! location.match(/[?]/)) location+='?';
    location+="&splitMode=true";
    if (window.location.search.match(/split=/)){
        var np=window.location.search.replace(/.*split=/,'').replace(/[^0-9].*/,'');
        if (! isNaN(np)){
            percent=np;
        }
    }
    setSplit(percent);
    f1.src=location+"&storePrefix=1&preventAlarms=true&ignoreAndroidBack=true";
    f2.src=location+"&storePrefix=2";
    window.addEventListener('resize',function(){setMover()});
    const msgAll=(msg,opt_omit)=>{
        if (typeof(msg) === 'string'){
            msg={type:msg};
        }
        [f1,f2].forEach(function(frm){
            if (opt_omit && frm.contentWindow === opt_omit) return;
            frm.contentWindow.postMessage(msg,window.location.origin);
        })
    }
    window.addEventListener('message',function(ev){
        let type=ev.data.type;
        const forwards=['dimm'];
        if (forwards.indexOf(type) >= 0){
            msgAll(ev.data,ev.source);
            return;
        }
        if (type === 'fullscreen'){
            let newState=false;
            if (document.fullscreenElement){
                document.exitFullscreen()
            }
            else {
                document.body.requestFullscreen();
                newState=true;
            }
            msgAll({
                type: 'fullScreenChanged',
                isFullScreen: newState
            })
        }
        if (type === 'settingsChanged'){
            if (ev.data.rotation){
                rotation = ev.data.rotation;
                setRotationClass()
            }
            msgAll('reloadSettings');
        }
        if (type === 'finishSplit'){
            msgAll('stopLeave');
            window.setTimeout(()=>
                window.location.replace(singleLocation),
                100);
        }
    })
    if (window.avnavAndroid) {
        if (!window.avnav) {
            window.avnav = {};
        }
        if (! window.avnav.android){
            window.avnav.android={
                receiveEvent: (key,param)=>{
                    msgAll( {
                        type: 'android',
                        key: key,
                        param: param
                    })
                }
            }
        }
    }
    let finalTitle='AVNav-Web';
    let iv=window.setInterval(function(){
        if ((f1.contentDocument && f1.contentDocument.title.match(finalTitle))
            || (f2.contentDocument && f2.contentDocument.title.match(finalTitle))){
            document.title=finalTitle+"-Split";
        }
        else{
            document.title="AVNav-Split loading...";
        }
    },500);
})();