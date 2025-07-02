/**
 * Created by andreas on 24.11.16.
 * 
 */

import React, {useState} from 'react';
import PropTypes from 'prop-types';
import navobjects from '../nav/navobjects';
import assign from 'object-assign';
import DB from './DialogButton.jsx';
import {Checkbox, Input} from './Inputs.jsx';
import Dms from "geodesy/dms";
import {DialogButtons, DialogFrame, useDialogContext} from "./OverlayDialog";
import visible from "../hoc/Visible";

const strLonToLon=(val)=>{
    if (val === undefined) return;
    if (typeof(val) === 'string') return Dms.parse(val.replace(/o/i, 'e'))
    return Dms.parse(val);
}
const strLatToLat=(val)=>{
    if (val === undefined) return;
    return Dms.parse(val);
}
const lonCheck=(val)=>{
    let dv=(typeof(val) === "string" )?strLonToLon(val):val;
    return (-180<= dv && dv <= 180) ;
}
const latCheck=(val)=>{
    let dv=(typeof(val) === "string" )?strLatToLat(val):val;
    return (-90 <= dv && dv <= 90);
}
const formatLon=(val,keep)=>{
    if (val === undefined) return "";
    if (keep) return val.toFixed(8);
    return  Dms.toLon(val, 'dm', 4);
}
const formatLat=(val,keep)=>{
    if (val === undefined) return "";
    if (keep) return val.toFixed(8);
    return Dms.toLat(val, 'dm', 4);
}
/**
 * a waypoint dialog
 * property: waypoint: the waypoint to be edited
 *           okCallback: function to be called ok ok with the new waypoint as parameter, return true to close
 *           hideCallback: function to be called when the dialog is hidden (but not on unmount)
 */
const WaypointDialog=(props)=> {
    const dialogContext = useDialogContext();
    const waypoint=props.waypoint||{};
    const [name, setName] = useState(waypoint.name);
    const [lat, setLat] = useState(formatLat(waypoint.lat));
    const [lon, setLon] = useState(formatLon(waypoint.lon));
    const [decimal, setDecimal] = useState(props.showDecimal || false);
    if (!props.waypoint) return null;

    const okFunction = () => {
        let data = {
            name: name,
            lat: strLatToLat(lat),
            lon: strLonToLon(lon)
        };
        if (!lonCheck(data.lon) || !latCheck(data.lat)) {
            return;
        }
        let wp = props.waypoint.clone();
        assign(wp, data);
        if(props.okCallback(wp)){
            dialogContext.closeDialog();
        }
    }
    let ok = lonCheck(lon) && latCheck(lat);
    return (
        <DialogFrame className={"WaypointDialog"} title={"Edit Waypoint"}>
            <Input
                dialogRow={true}
                label="Name"
                value={name}
                onChange={(value) => setName(value)}/>
            <Input
                dialogRow={true}
                label="Lat"
                onChange={(value) => {
                    setLat(value);
                }}
                value={lat}
                checkFunction={latCheck}
            />
            <Input
                dialogRow={true}
                label="Lon"
                onChange={(value) => setLon(value)}
                value={lon}
                checkFunction={lonCheck}
            />
            <Checkbox
                dialogRow={true}
                label={"decimal"}
                onChange={(value) => {
                    if (decimal === value) return;
                    setDecimal(value);
                    if (value) {
                        setLat(strLatToLat(lat));
                        setLon(strLonToLon(lon));
                    } else {
                        setLat(formatLat(lat));
                        setLon(formatLon(lon));
                    }
                }}
                value={decimal}
            />
            <DialogButtons>
                <DB name={'start'}
                    onClick={()=>{
                        if (props.startCallback(props.waypoint)){
                            dialogContext.closeDialog();
                        }
                    }}
                    visible={!!props.startCallback}
                    close={false}
                >Goto</DB>
                <DB name="delete" onClick={()=>{
                    if (props.deleteCallback) {
                        if (props.deleteCallback(props.waypoint)) {
                            dialogContext.closeDialog();
                        }
                    }
                }}
                    visible={props.deleteCallback !== undefined && ! props.readOnly}
                    close={false}>Delete</DB>
                <DB name="cancel" tabIndex="3" >Cancel</DB>
                <DB name="ok" tabIndex="4" onClick={okFunction} disabled={!ok || props.readOnly} close={false}>Ok</DB>
            </DialogButtons>
        </DialogFrame>
    )

}
export const updateWaypoint=(oldWp, newWp, errorFunction)=> {
            let wp = oldWp.clone();
            let data = newWp;
            if (!data) return;
            wp.name = data.name;
            let doChange = true;
            try {
                wp.lon = data.lon;
                if (isNaN(wp.lon) || wp.lon === undefined) {
                    if (errorFunction) errorFunction("invalid lon, cannot convert ");
                    doChange = false;
                }
                wp.lat = data.lat;
                if (isNaN(wp.lat) || wp.lat === undefined) {
                    if (errorFunction) errorFunction("invalid lat, cannot convert ");
                    doChange = false;
                }
            } catch (e) {
                if (errorFunction) errorFunction("invalid coordinate, cannot convert");
                doChange = false;
            }
            let ok = false;
            if (wp.routeName && wp.routeName != oldWp.routeName) {
                if (errorFunction) errorFunction("internal error, route name changed");
                doChange = false;
            }
            if (wp.name == navobjects.WayPoint.MOB) {
                doChange = false;
                if (errorFunction) errorFunction("you cannot use this name");
            }
            if (!doChange) return;
            return wp;
        }


WaypointDialog.propTypes={
    waypoint: PropTypes.instanceOf(navobjects.WayPoint).isRequired,
    okCallback: PropTypes.func.isRequired,
    closeCallback:PropTypes.func,
    deleteCallback: PropTypes.func,
    startCallback: PropTypes.func,
    readOnly: PropTypes.bool
};

export default WaypointDialog;