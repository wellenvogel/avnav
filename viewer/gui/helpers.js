import NavData from '../nav/navdata.js';
import Toast from '../util/overlay.js';
import PropertyHandler from '../util/propertyhandler.js';
import OverlayDialog from '../components/OverlayDialog.jsx';

const Helper={
    anchorWatchDialog:(overlayContainer)=>{
        let router = NavData.getRoutingHandler();
        if (router.getAnchorWatch()) {
            router.anchorOff();
            return;
        }
        let pos=NavData.getCurrentPosition();
        if (! pos) {
            Toast.Toast("no gps position");
            return;
        }
        let def=PropertyHandler.getProperties().anchorWatchDefault;
        OverlayDialog.valueDialogPromise("Set Anchor Watch",def,overlayContainer,"Radius(m)")
            .then(function(value){
                router.anchorOn(pos,value);
            })
    }
};

Object.freeze(Helper);

module.exports=Helper;