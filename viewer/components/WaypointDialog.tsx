/**
 * Created by andreas on 24.11.16.
 * 
 */

import React, {useState} from 'react';
import navobjects, {Point, WayPoint} from '../nav/navobjects';
import {DialogButtonProps} from './DialogButton';
import {Checkbox, Input} from './Inputs';
import Dms from "geodesy/dms";
import {DialogButtons, DialogFrame} from "./OverlayDialog";
import {useDialogContext} from "./DialogContext";
import ButtonDefs from "./ButtonDefs";
// @ts-ignore
import navcompute from '../nav/navcompute';
import {setav} from "../util/helper";

const strLonToLon=(val:string|number)=>{
    if (val === undefined) return;
    if (typeof(val) === 'string') return Dms.parse(val.replace(/o/i, 'e'))
    return Dms.parse(val);
}
const strLatToLat=(val:string|number)=>{
    if (val === undefined) return;
    return Dms.parse(val);
}
const lonCheck=(val:string|number)=>{
    const dv=(typeof(val) === "string" )?strLonToLon(val):val;
    return (-180<= dv && dv <= 180) ;
}
const latCheck=(val:string|number)=>{
    const dv=(typeof(val) === "string" )?strLatToLat(val):val;
    return (-90 <= dv && dv <= 90);
}
const formatLon=(val:number|string,keep?:boolean)=>{
    if (val === undefined) return "";
    if (keep) return Number(val).toFixed(8);
    return  Dms.toLon(Number(val), 'dm', 4);
}
const formatLat=(val:number|string,keep?:boolean)=>{
    if (val === undefined) return "";
    if (keep) return Number(val).toFixed(8);
    return Dms.toLat(Number(val), 'dm', 4);
}
/**
 * a waypoint dialog
 * property: waypoint: the waypoint to be edited
 *           okCallback: function to be called ok ok with the new waypoint as parameter, return true to close
 *           hideCallback: function to be called when the dialog is hidden (but not on unmount)
 */
export interface WaypointDialogProps{
    waypoint: WayPoint,
    mapCenter?: Point,
    okCallback: (wp:WayPoint)=>boolean,
    deleteCallback?: (wp:WayPoint)=>boolean,
    addonButtons?:DialogButtonProps[],
    readOnly?: boolean,
    showDecimal?:boolean,
}

const WaypointDialog=(props:WaypointDialogProps)=> {
    const dialogContext = useDialogContext();
    const waypoint:WayPoint=props.waypoint||new WayPoint();
    const [name, setName] = useState(waypoint.name);
    const [lat, setLat] = useState<number|string>(formatLat(waypoint.lat));
    const [lon, setLon] = useState<number|string>(formatLon(waypoint.lon));
    const [decimal, setDecimal] = useState(props.showDecimal || false);
    if (!props.waypoint) return null;

    const okFunction = (plat?:number,plon?:number,doClose?:boolean) => {
        const data = {
            name: name,
            lat: (plat !== undefined)?plat: strLatToLat(lat),
            lon: (plon !== undefined)?plon: strLonToLon(lon)
        };
        if (!lonCheck(data.lon) || !latCheck(data.lat)) {
            return;
        }
        const wp = props.waypoint.clone();
        wp.update(data);
        if(props.okCallback(wp)){
            if (doClose)dialogContext.closeDialog();
            return wp;
        }
    }
    const ok = lonCheck(lon) && latCheck(lat);
    const hasCenterDistance=()=>{
        if (! props.mapCenter) return false;
        try {
            const vlon = strLonToLon(lon);
            const vlat = strLatToLat(lat);
            if (!lonCheck(vlon) || !latCheck(vlat)) return true;
            const dst = navcompute.computeDistance(new Point(vlon, vlat), props.mapCenter);
            return dst.dts > 20;
        }catch (e){ /* empty */ }
        return true;
    }
    const addonButtons:DialogButtonProps[]=[];
    if (props.addonButtons){
        for (const bt of props.addonButtons){
            addonButtons.push({
                ...bt,
                onClick:(ev)=>{
                    if (! bt.onClick) return;
                    const wp=okFunction(); //do not close
                    if (! wp) return;
                    setav(ev,{waypoint:wp,dialogContext:dialogContext});
                    bt.onClick(ev);
                }
            })
        }
    }
    let buttons:DialogButtonProps[]=[
        {
            ...ButtonDefs.NavToCenter,
            visible: hasCenterDistance() && !props.readOnly,
            onClick: () => {
                //set the values any way to have them if the okFunction fails
                if (decimal) {
                    setLat(props.mapCenter.lat);
                    setLon(props.mapCenter.lon);
                } else {
                    setLat(formatLat(props.mapCenter.lat));
                    setLon(formatLon(props.mapCenter.lon));
                }
                //directly call the okFunction with the new values
                okFunction(props.mapCenter.lat, props.mapCenter.lon,true);
            }
        }];
        buttons=buttons.concat(addonButtons,[
            {
                ...ButtonDefs.DBDelete,
                onClick: () => {
                    if (props.deleteCallback) {
                        if (props.deleteCallback(props.waypoint)) {
                            dialogContext.closeDialog();
                        }
                    }
                },
                visible: props.deleteCallback !== undefined && !props.readOnly,
                close: false
            },
            {
                ...ButtonDefs.DBCancel
            },

            {
                ...ButtonDefs.DBOk,
                onClick: () => okFunction(undefined,undefined,true),
                disabled: !ok || props.readOnly,
                close: false
            }
        ])
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
            <DialogButtons
                buttonList={buttons}/>
        </DialogFrame>
    )

}
export const updateWaypoint=(oldWp:WayPoint,
                             newWp:WayPoint,
                             errorFunction?:(error:string)=>void)=> {
            const wp = oldWp.clone();
            const data = newWp;
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



export default WaypointDialog;