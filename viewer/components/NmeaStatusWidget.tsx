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
import Helper from "../util/helper";
import {ListItem, ListMainSlot, ListSlot} from "./ListItems";

export interface NmeaStatusWidgetProps extends IWidgetProps{
    showAis?:boolean;
    showNmea?:boolean;
}
interface NmeaStatus{
    nmea?:{
        status:string,
        source:string,
        numview?:number,
        numused?:number,
    },
    ais?:{
        status:string,
        source:string,
        numtargets?:number
    }
}
export const NmeaStatusWidget:IWidgetBase = (props:NmeaStatusWidgetProps) => {
    const [status,setStatus]=useState<NmeaStatus>({});
    const [connectionLost] = useStoreState(keys.nav.gps.connectionLost);
    const timer=useTimer((seq:number)=>{
        Requests.getJson({
            type:'decoder',
            command:'nmeaStatusV2'
        }).then((json)=>{
            setStatus(json?.data);
            timer.startTimer(seq)
        },
            ()=>timer.startTimer(seq));
    },1000,true,true);
    const display:Record<string,any>= {
        nmeaColor: connectionLost ? "yellow" : status?.nmea?.status||'grey',
        aisColor: connectionLost ? "yellow" : status?.ais?.status||'grey',
        nmeaInfo: connectionLost ? "connection lost":'',
        aisInfo: connectionLost ? "connection lost":'',
        nmeaSource: status?.nmea?.source||'',
        aisSource: status?.ais?.source||'',
    }
    if (!connectionLost) {
        if (status && status.nmea) {
            display.nmeaInfo = `${status.nmea.numview} visible/${status.nmea.numused} used`;
        }
        if (status && status.ais) {
            display.aisInfo = `${status.ais.numtargets} targets`;
        }
    }
    if (! props.showAis && ! props.showNmea){
        return <WidgetFrame name={props.name} dragId={props.dragId} onClick={props.onClick} className={props.className}></WidgetFrame>
    }
    const resizeSequence=useStringsChanged(display,true);
    return <WidgetFrame {...props} caption={'NMEA status'} className={Helper.concatsp("nmeaStatusWidget",props.className)} resizeSequence={resizeSequence}>
            { props.showNmea &&<ListItem className='nmea'>
                <ListSlot text={'GPS'} className={'kind'}></ListSlot>
                <ListSlot className={"status"}>
                    <StatusIcon type={display.nmeaColor}/>
                </ListSlot>
                <ListMainSlot className={"status"}
                              primary={display.nmeaSource}
                              secondary={display.nmeaInfo}
                />
            </ListItem>}
        {props.showAis && <ListItem className='ais' noBorder={true}>
            <ListSlot text={'AIS'} className={'kind'}></ListSlot>
            <ListSlot className={"status"}>
                <StatusIcon type={display.aisColor}/>
            </ListSlot>
            <ListMainSlot className={"status"}
                          primary={display.aisSource}
                          secondary={display.aisInfo}
            />
        </ListItem>
        }
    </WidgetFrame>
}
NmeaStatusWidget.predefined={
    editableParameters:{
        showNmea:{type:'BOOLEAN',default:true,description:'Show a short nmea sat status'},
        showAis:{type:'BOOLEAN',default:true,description:'Show an AIS status'},
    }
}
