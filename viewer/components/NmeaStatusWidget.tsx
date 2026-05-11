/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
import React, {useState} from "react";
import {useTimer} from '../util/UiHelper';
import Requests from "../util/requests";
import {IWidgetBase, WidgetFrame} from "./WidgetBase";
import {IWidgetProps} from "../util/types";
import keys from "../util/keys";
import {useStoreState} from "../hoc/Dynamic";
import {useStringsChanged} from "../hoc/Resizable";
import {StatusIcon} from "./Icons";

export interface NmeaStatusWidgetProps extends IWidgetProps{
    showAis?:boolean;
    showNmea?:boolean;
}
interface NmeaStatus{
    nmea?:{
        status:string,
        source:string,
        info: string
    },
    ais?:{
        status:string,
        source:string,
        info:string
    }
}
export const NmeaStatusWidget:IWidgetBase = (props:NmeaStatusWidgetProps) => {
    const [status,setStatus]=useState<NmeaStatus>({});
    const [connectionLost] = useStoreState(keys.nav.gps.connectionLost);
    const timer=useTimer((seq:number)=>{
        Requests.getJson({
            type:'decoder',
            command:'nmeaStatus'
        }).then((json)=>{
            setStatus(json?.data);
            timer.startTimer(seq)
        },
            ()=>timer.startTimer(seq));
    },1000,true,true);
    const display:Record<string,any>= {
        nmeaColor: connectionLost ? "yellow" : "red",
        aisColor: connectionLost ? "yellow" : "red",
        nmeaInfo: connectionLost ? "" : "connection lost",
        aisInfo: connectionLost ? "" : "connection lost",
        nmeaSource: "",
        aisSource: ""
    }
    if (!connectionLost) {
        if (status && status.nmea) {
            display.nmeaColor = status.nmea.status;
            display.nmeaSource=status.nmea.source;
            display.nmeaInfo = status.nmea.info;
        }
        if (status && status.ais) {
            display.aisColor = status.ais.status;
            display.aisSource=status.ais.source;
            display.aisInfo = status.ais.info;
        }
    }
    if (! props.showAis && ! props.showNmea){
        return <WidgetFrame name={props.name} dragId={props.dragId} onClick={props.onClick}></WidgetFrame>
    }
    const resizeSequence=useStringsChanged(display,true);
    return <React.Fragment>
        { props.showNmea && <WidgetFrame {...props} caption={'NMEA'} className="nmeaStatusWidget" key={1} style={{height:'50%'}} resizeSequence={resizeSequence}>
            <div className='widgetData nmea'>
                <div className={"rowBase status"}>
                    <StatusIcon type={display.nmeaColor}/>
                    <div className={"source"}>{display.nmeaSource}</div>
                </div>
                <div className={"rowBase"}>
                    <div className={"info"}>{display.nmeaInfo}</div>
                </div>
            </div>
        </WidgetFrame>}
        {props.showAis &&
            <WidgetFrame {...props} className={"nmeaStatusWidget"} caption={'AIS'} key={2} style={{height:'50%'}} resizeSequence={resizeSequence}>
                <div className={"widgetData ais"}>
                    <div className={"rowBase status"}>
                        <StatusIcon type={display.aisColor}/>
                        <div className={"source"}>{display.aisSource}</div>
                    </div>
                    <div className={"rowBase"}>
                        <div className={"info"}>{display.aisInfo}</div>
                    </div>
                </div>
            </WidgetFrame>
        }
    </React.Fragment>
}
NmeaStatusWidget.predefined={
    editableParameters:{
        showNmea:{type:'BOOLEAN',default:true,description:'Show a short nmea sat status'},
        showAis:{type:'BOOLEAN',default:true,description:'Show an AIS status'},
    }
}
