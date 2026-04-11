// @ts-ignore
import 'fullscreen-polyfill';
import globalStore from './globalstore';
import keys from './keys';
// @ts-ignore
import defaultFullScreenIcon from '../images/icons-new/fullscreen.svg';
import Requests from './requests';
import Toast from "../components/Toast";
// @ts-ignore
import splitsupport from "../util/splitsupport";
import Helper from "./helper";
import {getServerCommand} from "./UiHelper";

let fullScreenBlocked=false;
let fullScreenIcon=defaultFullScreenIcon;
const userAgent=navigator.userAgent;
//it seems that fullscreen does not work on older android versions (at least tested to work since 6/chrome44)
if (userAgent.match(/Chrome/)){
    const chromeVersion=userAgent.replace(/.*Chrome[/]*/,'').replace(/ .*/,'');
    if (chromeVersion){
        const chromeVersionI=parseInt(chromeVersion.replace(/\..*/,''));
        if (chromeVersionI < 44){
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
    const element=document.fullscreenElement;
    if (! element) {
        document.body.requestFullscreen();
    }
    else{
        document.exitFullscreen();
    }
};

let toggleFullscreen=toggleFullscreenDefault;

const handleSplitMode=()=>{
    if (globalStore.getData(keys.gui.global.splitMode)){
        // @ts-ignore
        fullScreenAvailable=()=> ! window.avnavAndroid;
        isFullScreen=()=>{return globalStore.getData(keys.gui.global.isFullScreen)};
        toggleFullscreen=()=>{
            splitsupport.sendToFrame('fullscreen');
        }
        splitsupport.subscribe('fullScreenChanged',(data:{isFullScreen?:boolean})=>{
            globalStore.storeData(keys.gui.global.isFullScreen,data.isFullScreen);
        })
    }
}

const init=()=>{
    try {
        globalStore.register(()=>{
            handleSplitMode();
        },[keys.gui.global.splitMode]);
        handleSplitMode();
        const mode=Helper.getParam("fullscreen");
        if (mode) {
            splitsupport.addUrlParameter("fullscreen", mode);
            if (mode.match(/^server:/)) {
                const command = mode.replace(/^server:/, '');
                getServerCommand(command)
                    .then((serverCommand) => {
                        if (serverCommand) {

                            if (serverCommand.icon) fullScreenIcon = serverCommand.icon;
                            fullScreenAvailable = () => true;
                        } else {
                            fullScreenBlocked = true;
                        }

                        const current = globalStore.getData(keys.gui.global.isFullScreen);
                        //toggle this to triger button redraw
                        globalStore.storeData(keys.gui.global.isFullScreen, !current);
                        globalStore.storeData(keys.gui.global.isFullScreen, current);
                    })
                    .catch((e) => {
                        Toast(e)
                    });
                fullScreenAvailable = () => false;
                isFullScreen = () => {
                    return undefined
                };
                toggleFullscreen = () => {
                    Requests.getJson({
                        request: 'api',
                        type: 'command',
                        command: 'runCommand',
                        name: command
                    })
                        .then(() => {
                        })
                        .catch((e) => Toast(e));
                }
            } else {
                fullScreenBlocked = true;
            }
        }
        globalStore.storeData(keys.gui.global.isFullScreen, fullScreenAvailable() && !!document.fullscreenElement);
        if (!fullScreenBlocked) {
            document.addEventListener('fullscreenchange', () => {
                globalStore.storeData(keys.gui.global.isFullScreen, isFullScreen());
            });
        }
    } catch (e) {
        console.log("unable to install fullscreen handler")
    }
}



const fullScreenDefinition={
    name: "FullScreen",
    displayName:"full screen",
    storeKeys: {
        visible:keys.properties.showFullScreen,
        toggle:keys.gui.global.isFullScreen,
        split: keys.gui.global.splitMode
    },
    updateFunction:(state:Record<string,any>)=>{
        return {
            toggle: isFullScreen(), //we directly query here again as IE does not seem to fire the event...
            // @ts-ignore
            visible: state.visible && fullScreenAvailable() && ! window.avnavAndroid,
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
    toggleFullscreen,
    init
};