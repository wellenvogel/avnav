/**
 * Created by andreas on 23.02.16.
 */

import React, {useState} from "react";
import keys from "../util/keys";
import Formatter from "../util/formatter";
import {WidgetFrame} from "./WidgetBase";
import {IWidgetProps} from "../util/types";
import {Icon, StatusIcon,iconClasses} from "./Icons";
import {useTimer} from "../util/UiHelper";
import Requests from "../util/requests";
import {ResizeStrings, useStringsChanged} from "../hoc/Resizable";
import Value from "./Value";

const STORE_KEYS={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};
export interface TimeStatusWidgetProps extends IWidgetProps,
    Record<keyof typeof STORE_KEYS,any>
{
    time: Date,
    gpsValid: boolean,
}

const TimeStatusWidget = (props:TimeStatusWidgetProps)=> {
    const [status,setStatus]=useState('0/0');
    const timer=useTimer((seq)=>{
        Requests.getJson({
            type:'decoder',
            command:'nmeaStatusV2'
        })
            .then((data)=>{
                timer.guardedCall(seq,()=>{
                    setStatus(`${data.data?.nmea?.numused||0}/${data.data?.nmea?.numview||0} ${data.data?.nmea?.source||''}`);
                })
                timer.startTimer(seq);
            })
            .catch(()=>{
                setStatus('0/0');
                timer.startTimer(seq)
            })
    },3000,true,true);
    const display:ResizeStrings={
        time:"--:--:--",
        status:status,
    };
    display.time=Formatter.formatTime(props.time);
    const dashMode = props.mode === "gps";
    const resizeSequence = useStringsChanged(display, dashMode);
    return (
        <WidgetFrame {...props}
            resizeSequence={resizeSequence}
                     addClass="timeStatusWidget" unit={undefined}>
            <div className="rowBase">
                <Icon className={iconClasses.Satellite}/>
                <div className="value">{display.status}</div>
            </div>
            <div className="rowBase">
                <StatusIcon type={props.gpsValid?'green':'red'}/>
                <div className="widgetData"><Value value={display.time}/></div>
            </div>
        </WidgetFrame>
    );
};

TimeStatusWidget.storeKeys=STORE_KEYS;

export default TimeStatusWidget;