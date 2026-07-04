/**
 * Created by andreas on 23.02.16.
 */

import React, {SyntheticEvent} from "react";
import keys from '../util/keys';
import PropertyHandler from '../util/propertyhandler';
import AisFormatter, {AisItem} from '../nav/aisformatter';
import {WidgetFrame} from "./WidgetBase";
import {ResizeStrings, useStringsChanged} from "../hoc/Resizable";
import {setav} from "../util/helper";
import {IWidgetProps} from "../util/types";
import {Icon} from "./Icons";

interface AisItemDisplayProps extends ResizeStrings{
    iconColor?:string;
    front?:string
    distance?:string,
    name?:string,
    tcpa?:string,
    cpa?:string,
    headingTo?: string

}
const AisFullDisplay=(display:AisItemDisplayProps)=> {
    return <React.Fragment>
        <div className="aisPart">
            <div className="widgetData">
                <span className="aisData">{display.name}</span>
            </div>
            <div className="widgetData">
                <span className='label'>{AisFormatter.getHeadline('distance')} </span>
                <span className="aisData">{display.distance}</span>
                <span className="unit">{AisFormatter.getUnit('distance')}</span>
            </div>
        </div>
    {
        Number(display.tcpa) > 0 &&
        <div className="aisPart">
            <div className="widgetData">
                <span className='label'>{AisFormatter.getHeadline('cpa')} </span>
                <span className="aisData">{display.cpa}</span>
                <span className="unit">{AisFormatter.getUnit('cpa')}</span>
            </div>
            <div className="widgetData">
                <span className='label'>{AisFormatter.getHeadline('tcpa')} </span>
                <span className="aisData"> {display.tcpa}</span>
                <span className="unit">{AisFormatter.getUnit('tcpa')}</span>
            </div>
        </div>
    }
    {
        !(Number(display.tcpa) > 0) &&
        <div className="aisPart">
            <div className="widgetData">
                <span className='label'>{AisFormatter.getHeadline('headingTo')} </span>
                <span className="aisData">{display.headingTo}</span>
                <span className="unit">{AisFormatter.getUnit('headingTo')}</span>
            </div>
            <div className="widgetData">
                <span className="aisData">&nbsp;</span>
            </div>
        </div>
    }
    <div className="aisPart withIcon">
        {(display.iconColor !== undefined)
            && <Icon color={display.iconColor} />}
        <div className="widgetData">
            <span className='aisFront large aisData'>{display.front}</span>
        </div>
    </div>
    </React.Fragment>
}
const AisSmallDisplay=(display:AisItemDisplayProps)=> {
    return <div className="aisSmall">
        <div className={"upper"}>
        <div className="aisPart">
            <div className="widgetData">
                <span className='aisFront aisData'>{display.front.substring(0, 1)}</span>
            </div>
        </div>
        <div className={"aisParts"}>
        {
            Number(display.tcpa) > 0 &&
            <div className="aisPart">
                <div className="widgetData">
                    <span className='label'>{AisFormatter.getHeadline('dcpa')} </span>
                    <span className="aisData"> {display.dcpa}</span>
                    <span className="unit">{AisFormatter.getUnit('dcpa')}</span>
                </div>
            </div>
        }
        {
            !(Number(display.tcpa) > 0) &&
            <div className="aisPart">
                <div className="widgetData">
                    <span className='label'>{AisFormatter.getHeadline('distance')} </span>
                    <span className="aisData">{display.distance}</span>
                    <span className="unit">{AisFormatter.getUnit('distance')}</span>
                </div>
            </div>
        }
        </div>
        </div>
        {(display.iconColor !== undefined) &&<div className="aisPart withIcon">
            <Icon color={display.iconColor}/>
        </div>
        }
    </div>
}
const STORE_KEYS={
    target: keys.nav.ais.nearest,
    isEditing: keys.gui.global.layoutEditing,
    trackedMmsi: keys.nav.ais.trackedMmsi,
    source: keys.nav.ais.source,
    numtargets: keys.nav.ais.numtargets,
}
const EDITABLE_PARAMETERS={
    legacy:{type:'BOOLEAN',
        displayName:'legacy',
        default:false,
        description:"color the complete widget depending on the target state instead of only a badge"}
}
export interface AisTargetWidgetProps extends IWidgetProps ,
    Record<keyof typeof STORE_KEYS,any>,
    Record<keyof typeof EDITABLE_PARAMETERS,boolean>
{
}
const AisTargetWidget = (props:AisTargetWidgetProps) => {
    const click = (ev:SyntheticEvent) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        props.onClick(setav(ev,{mmsi:props.target ? props.target.mmsi : undefined}));
    }
    const target:AisItem = props.target || {};
    const small = (props.mode === "horizontal");
    let color = undefined;
    if (target.mmsi && target.mmsi !== "") {
        color = PropertyHandler.getAisColor(target);
    }
    const display:AisItemDisplayProps = {};
    display.front = AisFormatter.format('passFront', target);
    display.name = AisFormatter.format('nameOrmmsi', target);
    if (target.tcpa > 0) {
        display.cpa = AisFormatter.format('cpa', target);
        display.tcpa = AisFormatter.format('tcpa', target);
    } else {
        display.headingTo = AisFormatter.format('headingTo', target);
    }
    display.distance=AisFormatter.format('distance', target);
    if (! props.legacy) {
        display.iconColor = color;
    }
    const dashMode = props.mode === "gps";
    const resizeSequence = useStringsChanged(display, dashMode);
    if (target.mmsi !== undefined || props.mode === "gps" || props.isEditing) {
        const style = {...props.style};
        if (props.legacy){
            style.backgroundColor=color;
        }
        return (
            <WidgetFrame {...props}
                         addClass="aisTargetWidget"
                         resizeSequence={resizeSequence}
                         style={style}
                         onClick={click}
                         unit={`${props.numtargets} ${props.source}`}
                         caption='AIS'>
                {! small && <AisFullDisplay
                    {...display}
                />}
                { small && <AisSmallDisplay
                    {...display}
                />}
            </WidgetFrame>
        );
    } else {
        return null;
    }

}

AisTargetWidget.storeKeys = STORE_KEYS;


AisTargetWidget.editableParameters=EDITABLE_PARAMETERS;

export default AisTargetWidget;
