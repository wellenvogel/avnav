import React, {useState} from 'react';
import NavData from '../nav/navdata.js';
import OverlayDialog, {
    DialogButtons,
    DialogFrame,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Toast from '../components/Toast.jsx';
import AlarmHandler from '../nav/alarmhandler.js';
import RouteEdit from '../nav/routeeditor.js';
import {Input, InputReadOnly} from "./Inputs";
import DialogButton from "./DialogButton";
import MapHolder from '../map/mapholder';
import NavCompute from "../nav/navcompute";


const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);

export const stopAnchorWithConfirm=(opt_resolveOnInact,opt_dialogContext)=>{
    return new Promise((resolve,reject)=>{
        if (activeRoute.anchorWatch() === undefined) {
            if (opt_resolveOnInact){
                resolve(true);
            }
            else {
                reject('inactive');
            }
            return;
        }
        showPromiseDialog(opt_dialogContext,OverlayDialog.createConfirmDialog("Really stop the anchor watch?"))
            .then(() => resolve(true))
            .catch((e)=>reject(e));
    })
}
const WatchDialog=(props)=> {
    const [radius,setRadius]=useState(globalStore.getData(keys.properties.anchorWatchDefault));
    const [bearing,setBearing]=useState(0);
    const [distance,setDistance]=useState(0);
    const dialogContext=useDialogContext();
    const computeRefPoint=(sv,fromCenter)=>{
        let cv={radius,bearing,distance,refPoint};
        if (fromCenter){
            cv.refPoint=MapHolder.getCenter();
        }
        else {
            cv.refPoint = NavData.getCurrentPosition();
        }
        if (cv.bearing != 0 || cv.dispatcher != 0) {
            let target = NavCompute.computeTarget(cv.refPoint, cv.bearing, cv.distance,
                globalStore.getData(keys.nav.routeHandler.useRhumbLine));
            cv.refPoint = target;
        }
        return cv;
    }
    let title=props.active?"Update Anchor Watch":"Start Anchor Watch";
        let hasPosition=props.position !== undefined;
    return <DialogFrame className="AnchorWatchDialog" title={title} >
        {hasPosition &&
        <React.Fragment>
            <Input dialogRow={true}
                   type='number'
                   value={radius}
                   onChange={(v) => setRadius(parseFloat(v))}
                   label="Radius(m)"
            />
            <Input dialogRow={true}
                   type="number"
                   value={distance}
                   onChange={(v) => setDistance(parseFloat(v))}
                   label="Distance(m)"
            />
            <Input dialogRow={true}
                   type="number"
                   value={bearing}
                   onChange={(v) => setBearing(parseFloat(v))}
                   label="Bearing(°)"
            />
        </React.Fragment>}
        {!hasPosition && <InputReadOnly
            label="No Position"
            dialogRow={true}
        />}
        < DialogButtons>
            {hasPosition && <React.Fragment>
            <DialogButton name={'boat'}
                          onClick={()=>{
                              props.setCallback(computeRefPoint(false));
                          }}>Boat</DialogButton>
                <DialogButton name={'center'}
                              onClick={()=>{
                                  props.setCallback(computeRefPoint(true));
                              }}>Center</DialogButton>
            </React.Fragment>}
            {props.active && <DialogButton name={'stop'}
                                           close={false}
                                     onClick={() => {
                                         stopAnchorWithConfirm(undefined,dialogContext)
                                             .then(() => {
                                                 props.stopCallback();
                                                 dialogContext.closeDialog();
                                             })
                                             .catch(() => {
                                             })

                                     }}>Stop</DialogButton>
            }
                <DialogButton name={'cancel'}
                          >Cancel</DialogButton>
        </DialogButtons>
    </DialogFrame>
}

export const anchorWatchDialog = (opt_dialogContext)=> {
    let router = NavData.getRoutingHandler();
    let pos = NavData.getCurrentPosition();
    let isActive=false;
    if (activeRoute.anchorWatch() !== undefined) {
        isActive=true;
    }
    if (!pos && ! isActive) {
        Toast("no gps position");
        return;
    }
    const show=opt_dialogContext?opt_dialogContext.showDialog: OverlayDialog.dialog;
    show((props)=>{
        return <WatchDialog
            {...props}
            active={isActive}
            position={pos}
            setCallback={(values)=>{
                AlarmHandler.stopAlarm('anchor');
                router.anchorOn(values.refPoint,values.radius);
            }}
            stopCallback={()=>{
                router.anchorOff();
                //alarms will be stopped anyway by the server
                //but this takes some seconds...
                AlarmHandler.stopAlarm('anchor');
                AlarmHandler.stopAlarm('gps');
            }}
            />
    })
};
export const AnchorWatchKeys={
    watchDistance:keys.nav.anchor.watchDistance,
    connected:keys.properties.connectedMode
};
export const isWatchActive=(state)=>{
    if (state === undefined){
        return activeRoute.anchorWatch() !== undefined;
    }
    return state.watchDistance !== undefined;
};
export default  (opt_hide,opt_dialogContext)=>{
    return{
        name: "AnchorWatch",
        storeKeys: AnchorWatchKeys,
        updateFunction:(state)=>{
            let rt={
                toggle:isWatchActive(state),
                visible: state.connected
            };
            if (opt_hide){
                rt.visible= rt.visible && isWatchActive(state);
            }
            return rt;
        },
        onClick: ()=>{
            anchorWatchDialog(opt_dialogContext);
        },
        editDisable:true
    }
}