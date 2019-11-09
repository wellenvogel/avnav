import NavData from '../nav/navdata.js';
import Toast from '../util/overlay.js';
import PropertyHandler from '../util/propertyhandler.js';
import OverlayDialog from '../components/OverlayDialog.jsx';


const anchorWatchDialog = (overlayContainer)=> {
    let router = NavData.getRoutingHandler();
    if (router.getAnchorWatch()) {
        router.anchorOff();
        return;
    }
    let pos = NavData.getCurrentPosition();
    if (!pos) {
        Toast.Toast("no gps position");
        return;
    }
    let def = PropertyHandler.getProperties().anchorWatchDefault;
    OverlayDialog.valueDialogPromise("Set Anchor Watch", def, overlayContainer, "Radius(m)")
        .then(function (value) {
            router.anchorOn(pos, value);
        })
};

const resizeElementFont=(el)=>{
    if (!el) return;
    el.style.fontSize = "100%";
    if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
        //scale down
        for (let size = 100; (el.scrollHeight > el.clientHeight ||  el.scrollWidth > el.clientWidth) && size > 10 ; size -= 10) {
            el.style.fontSize = size + '%';
        }
    }
    else{
        let lastSize=100;
        for (let size = 100; el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight && size <= 250 ; size += 10) {
            lastSize=size;
            el.style.fontSize = size + '%';
        }
        if (lastSize > 100){
            //maybe we went multi-line...
            lastSize-=10;
            el.style.fontSize = lastSize + '%';
        }
    }
};

const resizeByQuerySelector=(querySelector)=>{
    let elements  = document.querySelectorAll(querySelector);
    if (elements.length < 0) {
        return;
    }
    for (let i = 0; i < elements.length; i++) {
        resizeElementFont(elements[i]);
    } 
};


module.exports={
    anchorWatchDialog,
    resizeElementFont,
    resizeByQuerySelector
    
};