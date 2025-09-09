(function(){
    function getParam(key,src)
    {
        // Find the key and everything up to the ampersand delimiter
        let value=RegExp(""+key+"[^&]+").exec(src||window.location.search);

        // Return the unescaped value minus everything starting from the equals sign or an empty string
        return decodeURIComponent(!!value ? value.toString().replace(/^[^=]+./,"") : "");
    }
    let PNAME="avnavsplit.percent";
    let dragstartX=-1;
    let mover=document.getElementById('mover');
    let f1=document.getElementById('left');
    let f2=document.getElementById('right');
    let frame=document.getElementById('split_main');
    let rotation='none';
    let currentPercent=50;
    /**
     * get the screen X offset corrected by rotation
     * none:
     *   screenX - startPos
     * 90cw:
     *   screenY - startPos
     * 90ccw:
     *   screenY if startPos === undefined
     *   - (screenY - startPos)
     * @param event
     * @param startPos
     */
    let getScreeOffsetX=function(event,startPos){
        let val;
        if (rotation === 'none'){
            val=event.screenX;
            if (startPos === undefined) return val;
            return val-startPos;
        }
        if (rotation === '90cw'){
            val=event.screenY;
            if (startPos === undefined) return val;
            return val-startPos;
        }
        if (rotation === '90ccw'){
            val=event.screenY;
            if (startPos === undefined) return val;
            return -(val-startPos);
        }
    }
    let getElementWidth=function(rect){
        if (rotation === 'none'){
            return rect.width;
        }
        return rect.height;
    }
    let setMover=function(opt_offset){
        let rect = f1.getBoundingClientRect();
        let pos=getElementWidth(rect);
        if (opt_offset) pos+=opt_offset
        let mrect=mover.getBoundingClientRect();
        mover.style.left = (pos - getElementWidth(mrect) / 2) + 'px';

    }
    let setSplit=function(percent){
        currentPercent=percent;
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
    let setSplitFromPos=function(offset){
        let r=frame.getBoundingClientRect();
        let width=getElementWidth(r)
        let currentPos=currentPercent*width/100;
        currentPos+=offset;
        let percent=currentPos*100/width;
        if (percent < 0) percent=0;
        if (percent >= 99.999) percent=99.999;
        setSplit(percent);
        window.setTimeout(()=>{
            setMover();
        },100)
    }
    let setRotationClass=()=>{
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
        setMover();
    }
    mover.addEventListener('dragstart',function(ev){
        ev.stopPropagation();
        dragstartX=getScreeOffsetX(ev);
        mover.style.opacity=0.6;
    });
    mover.addEventListener('touchstart',function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        let touchobj = ev.changedTouches[0];    // erster Finger des touchstart-Events
        dragstartX = getScreeOffsetX(touchobj);
        mover.style.opacity=0.6;
    });
    mover.addEventListener('touchmove',function(ev){
        ev.stopPropagation();
        if (dragstartX < 0) return;
        let touchobj = ev.changedTouches[0];
        let dragPosition = getScreeOffsetX(touchobj,dragstartX);
        setMover(dragPosition);
    })
    mover.addEventListener('touchend',function(ev){
        ev.stopPropagation();
        if (dragstartX < 0) return;
        let touchobj = ev.changedTouches[0];
        let dragPosition = getScreeOffsetX(touchobj,dragstartX);
        setSplitFromPos(dragPosition);
        dragstartX=-1;
    })
    mover.addEventListener('dragend',function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        if (dragstartX < 0) return;
        let  pos= getScreeOffsetX(ev,dragstartX);
        setSplitFromPos(pos);
        dragstartX=-1;
    })

    if (window.localStorage){
        let ps=window.localStorage.getItem(PNAME);
        if (ps){
            currentPercent=parseInt(ps);
        }
    }
    let location=window.location.href+'';
    let protation=getParam("rotation",location);
    if (protation){
        rotation=protation
    }
    setRotationClass();
    location=location.replace('viewer_split','avnav_viewer');
    let singleLocation=location;
    let FWPARAM=["fullscreen","dimm"];
    let fwValues={};
    FWPARAM.forEach(function(p){
        let v=getParam(p,singleLocation);
        if (v) fwValues[p]=v;
    })
    singleLocation=singleLocation.replace(/\?.*/,'');
    let i;
    let delim="?";
    for (i in fwValues){
        singleLocation+=delim+encodeURIComponent(i)+"="+encodeURIComponent(fwValues[i]);
        delim="&";
    }
    if (! location.match(/[?]/)) location+='?';
    location+="&splitMode=true";
    if (window.location.search.match(/split=/)){
        let np=window.location.search.replace(/.*split=/,'').replace(/[^0-9].*/,'');
        if (! isNaN(np)){
            percent=np;
        }
    }
    setSplit(currentPercent);
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