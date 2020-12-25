import fullscreen from 'fullscreen-polyfill';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';

try {
    globalStore.storeData(keys.gui.global.isFullScreen,!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', () => {
        globalStore.storeData(keys.gui.global.isFullScreen,!!document.fullscreenElement);
    });

}catch (e){
    console.log("unable to install fullscreen handler")
}


const toggleFullscreen=()=>{
    let element=document.fullscreenElement;
    if (! element) {
        document.body.requestFullscreen();
    }
    else{
        document.exitFullscreen();
    }
};

const fullScreenAvailable=()=>{
   return !!document.fullscreenEnabled
}

const fullScreenDefinition={
    name: "FullScreen",
    storeKeys: {visible:keys.properties.showFullScreen, toggle:keys.gui.global.isFullScreen},
    updateFunction:(state)=>{
        return {
            toggle: state.toggle,
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