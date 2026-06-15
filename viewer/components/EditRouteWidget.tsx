/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import keys from '../util/keys'
import Formatter from '../util/formatter'
import routeobjects from '../nav/routeobjects';
import RouteEdit,{StateHelper} from '../nav/routeeditor';
import {WidgetFrame} from "./WidgetBase";
import {IWidgetProps} from "../util/types";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);

const STORE_KEYS=editor.getStoreKeys({
    remain:keys.nav.route.remain,
    ttgsog: keys.nav.route.ttgsog,
    ttgvmg: keys.nav.route.ttgvmg,
    epochms: keys.nav.gps.epochms,
    isApproaching: keys.nav.route.isApproaching,
    useRhumbLine: keys.nav.routeHandler.useRhumbLine
});
const EDITABLE={
    sog:{
        type:'BOOLEAN',
        displayName:'use sog',
        default:false,
        description: "use SOG to compute the ETA (use VMG if unchecked)"
    }
}

interface EditingRouteWidgetProps extends IWidgetProps,
    Record<keyof typeof STORE_KEYS, any>,
    Record<keyof typeof EDITABLE, boolean>{}
const EditRouteWidget = (props:EditingRouteWidgetProps) => {
    const [route, _notUsed, isActive] = StateHelper.getRouteIndexFlag(props);
    let classes = "editRouteWidget";
    if (isActive) classes += " activeRoute ";
    if (!route) {
        return (
            <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined}>
                <div className="routeName">No Route</div>
            </WidgetFrame>
        )
    }
    const numPoints = route.points.length;
    const len = route.computeLength(0, props.useRhumbLine);
    const remain = isActive ? props.remain : undefined;
    let eta = undefined;
    if (isActive) {
        const ttg = props.sog ? props.ttgsog : props.ttgvmg;
        if (props.epochms != null && ttg != null && ttg > 0) {
            const dt = new Date(props.epochms + ttg * 1000);
            eta = Formatter.formatTime(dt);
        }
    }
    const isServer=routeobjects.isServerName(route.name);
    return (
        <WidgetFrame {...props} addClass={classes} caption="RTE" unit={isServer?'server':'local'} disconnect={!route.isServer()}>
            <div className="routeName widgetData">{route.displayName()}</div>
            <div className="widgetData">
                <span className="label">PTS:</span>
                <span className="routeInfo">{Formatter.formatDecimal(numPoints, 3)}</span>
            </div>
            <div className="widgetData">
                <span className="label">DST:</span>
                <span className="routeInfo">{Formatter.formatDistance(len)}</span>
            </div>
            {props.mode !== "horizontal" ?
                <div className="widgetData">
                    <span className="label">RTG:</span>
                    <span className="routeInfo">{Formatter.formatDistance(remain)}</span>
                </div> : null}
            {props.mode !== "horizontal" && eta != null &&
                <div className="widgetData">
                    <span className="label">{props.sog?'ETAS:':'ETAV:'}</span>
                    <span className="routeInfo">{eta}</span>
                </div>}
        </WidgetFrame>
    );
}


EditRouteWidget.storeKeys=STORE_KEYS;
EditRouteWidget.editableParameters=EDITABLE;

export default EditRouteWidget;