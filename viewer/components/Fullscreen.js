import fullscreen from 'fullscreen-polyfill';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import defaultFullScreenIcon from '../images/icons-new/fullscreen.svg';
import Requests from '../util/requests';
import Toast from "./Toast";
import piIcon from '../images/rpi.png';
import splitsupport from "../util/splitsupport";

let fullScreenBlocked=false;
let fullScreenIcon=defaultFullScreenIcon;
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

const fullScreenAvailableDefault=()=>{
    return ! fullScreenBlocked && !!document.fullscreenEnabled
}

let fullScreenAvailable=fullScreenAvailableDefault;

let isFullScreen=()=>{
    return !!document.fullscreenElement
}


const toggleFullscreenDefault=()=>{
    if (! fullScreenAvailable()) return;
    let element=document.fullscreenElement;
    if (! element) {
        document.body.requestFullscreen();
    }
    else{
        document.exitFullscreen();
    }
};

let toggleFullscreen=toggleFullscreenDefault;

try {
    globalStore.register(()=>{
        if (globalStore.getData(keys.gui.global.splitMode)){
            fullScreenAvailable=()=> ! window.avnavAndroid;
            isFullScreen=()=>{return globalStore.getData(keys.gui.global.isFullScreen)};
            toggleFullscreen=()=>{
                splitsupport.sendToFrame('fullscreen');
            }
            splitsupport.subscribe('fullScreenChanged',(data)=>{
                globalStore.storeData(keys.gui.global.isFullScreen,data.isFullScreen);
            })
        }
    },[keys.gui.global.splitMode]);
    if (window.location.search.match(/[?&]fullscreen=/)){
        let mode=window.location.search.replace(/.*[?&]fullscreen=/,'').replace(/[&].*/,'');
        if (mode.match(/^server:/)){
            let command=mode.replace(/^server:/,'');
            Requests.getJson('',undefined,{
                request:'api',
                type:'command',
                action:'getCommands'
            })
                .then((data)=>{
                    if (! data.data) return;
                    let found=false;
                    data.data.forEach((serverCommand)=>{
                        if (serverCommand.name === command){
                            if (serverCommand.icon) fullScreenIcon=serverCommand.icon;
                            found=true;
                        }
                    });
                    if (!found){
                        fullScreenBlocked=true;
                    }
                    else{
                        fullScreenAvailable=()=>true;
                    }
                    let current=globalStore.getData(keys.gui.global.isFullScreen);
                    //toggle this to triger button redraw
                    globalStore.storeData(keys.gui.global.isFullScreen,!current);
                    globalStore.storeData(keys.gui.global.isFullScreen,current);
                })
                .catch((e)=>Toast(e));
            fullScreenAvailable=()=>false;
            isFullScreen=()=>{return undefined};
            toggleFullscreen=()=>{
                Requests.getJson('',undefined,{
                    request: 'api',
                    type: 'command',
                    action: 'runCommand',
                    name: command
                })
                    .then(()=>{})
                    .catch((e)=> Toast(e));
            }
        }
        else{
            fullScreenBlocked=true;
        }
    }

    globalStore.storeData(keys.gui.global.isFullScreen,fullScreenAvailable() && !!document.fullscreenElement );
    if (! fullScreenBlocked) {
        document.addEventListener('fullscreenchange', () => {
            globalStore.storeData(keys.gui.global.isFullScreen, isFullScreen());
        });
    }

}catch (e){
    console.log("unable to install fullscreen handler")
}



const fullScreenDefinition={
    name: "FullScreen",
    storeKeys: {
        visible:keys.properties.showFullScreen,
        toggle:keys.gui.global.isFullScreen,
        split: keys.gui.global.splitMode
    },
    updateFunction:(state)=>{
        return {
            toggle: isFullScreen(), //we directly query here again as IE does not seem to fire the event...
            visible: state.visible && fullScreenAvailable() && ! window.avnavAndroid,
            dummy: state.toggle,
            icon: fullScreenIcon
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