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
                    setStatus(`${data.data?.nmea?.numused||0}/${data.data?.nmea?.numsat||0} ${data.data?.nmea?.source||''}`);
                })
                timer.startTimer(seq);
            })
            .catch(()=>{
                setStatus('0/0');
                timer.startTimer(seq)
            })
    },3000,true,true);
    let time="--:--:--";
    if (props.time !== undefined){
        time=Formatter.formatTime(props.time);
    }
    return (
        <WidgetFrame {...props} addClass="timeStatusWidget" unit={undefined}>
            <div className="rowBase">
                <Icon className={iconClasses.Satellite}/>
                <div className="value">{status}</div>
            </div>
            <div className="rowBase">
                <StatusIcon type={props.gpsValid?'green':'red'}/>
                <div className="widgetData">{time}</div>
            </div>
        </WidgetFrame>
    );
};

TimeStatusWidget.storeKeys=STORE_KEYS;

export default TimeStatusWidget;