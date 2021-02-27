import fullscreen from 'fullscreen-polyfill';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';

let fullScreenBlocked=false;
let userAgent=navigator.userAgent;
//it seems that fullscreen does not work on older android versions (at least tested to work since 6/chrome44)
if (userAgent.match(/Chrome/)){
    let chromeVersion=userAgent.replace(/.*Chrome[/]*/,'').replace(/ .*/,'');
    if (chromeVersion){
        chromeVersion=chromeVersion.replace(/\..*/,'');
        if (chromeVersion < 44){
            fullScreenBlocked=true;
        }
    }
}

try {
    globalStore.storeData(keys.gui.global.isFullScreen,! fullScreenBlocked && !!document.fullscreenElement);
    if (! fullScreenBlocked) {
        document.addEventListener('fullscreenchange', () => {
            globalStore.storeData(keys.gui.global.isFullScreen, !!document.fullscreenElement);
        });
    }

}catch (e){
    console.log("unable to install fullscreen handler")
}


const toggleFullscreen=()=>{
    if (! fullScreenAvailable()) return;
    let element=document.fullscreenElement;
    if (! element) {
        document.body.requestFullscreen();
    }
    else{
        document.exitFullscreen();
    }
};

const fullScreenAvailable=()=>{
   return ! fullScreenBlocked && !!document.fullscreenEnabled
}

const fullScreenDefinition={
    name: "FullScreen",
    storeKeys: {visible:keys.properties.showFullScreen, toggle:keys.gui.global.isFullScreen},
    updateFunction:(state)=>{
        return {
            toggle: !!document.fullscreenElement, //we directly query here again as IE does not seem to fire the event...
            visible: state.visible && fullScreenAvailable()
        }
    },
    onClick:()=>{
        toggleFullscreen();
    },
    editDisable:true,
    overflow: true
};


export default {
    fullScreenAvailable,
    fullScreenDefinition,
    toggleFullscreen
};