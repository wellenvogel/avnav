import React from 'react';
import PropTypes from 'prop-types';
import NavData from '../nav/navdata.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Toast from '../components/Toast.jsx';
import AlarmHandler from '../nav/alarmhandler.js';
import RouteEdit from '../nav/routeeditor.js';

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);
export const anchorWatchDialog = (overlayContainer)=> {
    let router = NavData.getRoutingHandler();
    if (activeRoute.anchorWatch() !== undefined) {
        router.anchorOff();
        //alarms will be stopped anyway by the server
        //but this takes some seconds...
        AlarmHandler.stopAlarm('anchor');
        AlarmHandler.stopAlarm('gps');
        return;
    }
    let pos = NavData.getCurrentPosition();
    if (!pos) {
        Toast("no gps position");
        return;
    }
    let def = globalStore.getData(keys.properties.anchorWatchDefault);
    OverlayDialog.valueDialogPromise("Set Anchor Watch", def, overlayContainer, "Radius(m)")
        .then(function (value) {
            router.anchorOn(pos, value);
        })
};

export default  ()=>{
    return{
        name: "AnchorWatch",
        storeKeys: {watchDistance:keys.nav.anchor.watchDistance},
        updateFunction:(state)=>{
            return {toggle:state.watchDistance !== undefined}
        },
        onClick: ()=>{
            anchorWatchDialog(undefined);
        },
        editDisable:true
    }
}