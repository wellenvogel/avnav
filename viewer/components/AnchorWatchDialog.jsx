import React from 'react';
import NavData from '../nav/navdata.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Toast from '../components/Toast.jsx';
import AlarmHandler from '../nav/alarmhandler.js';
import RouteEdit from '../nav/routeeditor.js';
import {Input} from "./Inputs";
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
            let target = NavCompute.computeTarget(cv.refPoint, cv.bearing, cv.distance);
            cv.refPoint = target;
        }
        return cv;
    }
    render(){
    return <div className="AnchorWatchDialog flexInner" >
        <h3 className="dialogTitle">Set Anchor Watch</h3>
        <Input dialogRow={true}
               type='number'
               value={this.state.radius}
               onChange={(v)=>this.setState({radius:parseFloat(v)})}
               label="Radius(m)"
               />
        <Input dialogRow={true}
               type="number"
               value={this.state.distance}
               onChange={(v)=>this.setState({distance:parseFloat(v)})}
               label="Distance(m)"
               />
        <Input dialogRow={true}
               type="number"
               value={this.state.bearing}
               onChange={(v)=>this.setState({bearing:parseFloat(v)})}
               label="Bearing(°)"
        />
        < div className="dialogButtons">
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
                <DialogButton name={'cancel'}
                          onClick={()=>this.props.closeCallback()}
                          >Cancel</DialogButton>
        </div>
    </div>
    }
}

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
    OverlayDialog.dialog((props)=>{
        return <WatchDialog
            {...props}
            setCallback={(values)=>{
                router.anchorOn(values.refPoint,values.radius);
            }}
            />
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