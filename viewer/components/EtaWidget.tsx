/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import keys from '../util/keys';
import Formatter from '../util/formatter';
import {WidgetFrame} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";
import {IWidgetProps} from "../util/types";
import Value from "./Value";

const STORE_KEYS={
    ttgvmg: keys.nav.wp.ttgvmg,
    ttgsog: keys.nav.wp.ttgsog,
    epochms: keys.nav.gps.epochms,
    wpname: keys.nav.wp.name,
    server: keys.nav.wp.server
};

const EDITABLE={
    sog:{
        type:'BOOLEAN',
        displayName:'useSog',
        default: false,
        description:'use SOG for ETA computation',
    },
    captionVmg:{
        type:'STRING',
        displayName:'caption',
        default:'ETA-VMG',
        condition:{sog:false}
    },
    captionSog:{
        type:'STRING',
        displayName:'caption',
        default:'ETA-SOG',
        condition:{sog:true}
    },
    caption:false

}
interface EtaWidgetProps extends IWidgetProps,
   Record<keyof typeof STORE_KEYS, any>,
    Omit<Record<keyof typeof EDITABLE, any>,'caption'>{}
const EtaWidget = (props:EtaWidgetProps) => {
    let eta='--:--:--';
    const ttg=props.sog?props.ttgsog:props.ttgvmg;
    if (props.epochms != null && ttg != null && ttg > 0){
        const dt=new Date(props.epochms+ttg*1000);
        eta=Formatter.formatTime(dt);
    }
    const display={
        eta: eta,
        name: props.wpname
    };
    const resizeSequence=useStringsChanged(display,props);
    const disconnect=(props.server===false);
    return (
        <WidgetFrame {...props} caption={props.sog?props.captionSog:props.captionVmg} addClass="etaWidget" resizeSequence={resizeSequence} disconnect={disconnect}>
            <div className="widgetData markerEta"><Value value={display.eta}/></div>
            <div className="widgetData markerName">{display.name}</div>
        </WidgetFrame>
    );
};


EtaWidget.storeKeys=STORE_KEYS;
EtaWidget.editableParameters=EDITABLE;
export default EtaWidget;