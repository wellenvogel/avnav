import React from 'react';
import NavData from '../nav/navdata.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Toast from '../components/Toast.jsx';
import AlarmHandler from '../nav/alarmhandler.js';
import RouteEdit from '../nav/routeeditor.js';
import {Input, InputReadOnly} from "./Inputs";
import DialogButton from "./DialogButton";
import assign from "object-assign";
import MapHolder from '../map/mapholder';
import NavCompute from "../nav/navcompute";


const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);

class WatchDialog extends React.Component{
    constructor(props) {
        super(props);
        let defDistance = globalStore.getData(keys.properties.anchorWatchDefault);
        this.state={
            radius: defDistance,
            bearing: 0,
            distance: 0,
            refPoint: undefined
        }
    }
    computeRefPoint(sv,fromCenter){
        let cv=assign({},sv);
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
    render(){
        let title=this.props.active?"Update Anchor Watch":"Start Anchor Watch";
        let hasPosition=this.props.position !== undefined;
    return <div className="AnchorWatchDialog flexInner" >
        <h3 className="dialogTitle">{title}</h3>
        {hasPosition &&
        <React.Fragment>
            <Input dialogRow={true}
                   type='number'
                   value={this.state.radius}
                   onChange={(v) => this.setState({radius: parseFloat(v)})}
                   label="Radius(m)"
            />
            <Input dialogRow={true}
                   type="number"
                   value={this.state.distance}
                   onChange={(v) => this.setState({distance: parseFloat(v)})}
                   label="Distance(m)"
            />
            <Input dialogRow={true}
                   type="number"
                   value={this.state.bearing}
                   onChange={(v) => this.setState({bearing: parseFloat(v)})}
                   label="Bearing(°)"
            />
        </React.Fragment>}
        {!hasPosition && <InputReadOnly
            label="No Position"
            dialogRow={true}
        />}
        < div className="dialogButtons">
            {hasPosition && <React.Fragment>
            <DialogButton name={'boat'}
                          onClick={()=>{
                              this.props.closeCallback();
                              this.props.setCallback(this.computeRefPoint(this.state,false));
                          }}>Boat</DialogButton>
                <DialogButton name={'center'}
                              onClick={()=>{
                                  this.props.closeCallback();
                                  this.props.setCallback(this.computeRefPoint(this.state,true));
                              }}>Center</DialogButton>
            </React.Fragment>}
            {this.props.active && <DialogButton name={'stop'}
                                     onClick={() => {
                                         OverlayDialog.confirm("Really stop the anchor watch?")
                                             .then(() => {
                                                 this.props.stopCallback();
                                                 this.props.closeCallback();
                                             })
                                             .catch(() => {
                                             })

                                     }}>Stop</DialogButton>
            }
                <DialogButton name={'cancel'}
                          onClick={()=>this.props.closeCallback()}
                          >Cancel</DialogButton>
        </div>
    </div>
    }
}

export const anchorWatchDialog = (overlayContainer)=> {
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
    OverlayDialog.dialog((props)=>{
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
    watchDistance:keys.nav.anchor.watchDistance
};
export const isWatchActive=(state)=>{
    return state.watchDistance !== undefined;
};
export default  (opt_hide)=>{
    return{
        name: "AnchorWatch",
        storeKeys: AnchorWatchKeys,
        updateFunction:(state)=>{
            let rt={toggle:isWatchActive(state)};
            if (opt_hide){
                rt.visible= isWatchActive(state);
            }
            return rt;
        },
        onClick: ()=>{
            anchorWatchDialog(undefined);
        },
        editDisable:true
    }
}