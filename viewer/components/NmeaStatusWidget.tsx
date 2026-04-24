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
import {WidgetFrame} from "./WidgetBase";
import {IWidgetProps} from "../util/types";
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import {useStoreState} from "../hoc/Dynamic";

const getImgSrc=function(color:string){
    if (color == "red") return globalstore.getData(keys.properties.statusErrorImage);
    if (color == "green") return globalstore.getData(keys.properties.statusOkImage);
    if (color == "yellow")return globalstore.getData(keys.properties.statusYellowImage);
};

export interface NmeaStatusWidgetProps extends IWidgetProps{

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
export const NmeaStatusWidget = (props:NmeaStatusWidgetProps) => {
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
    let nmeaColor = connectionLost ? "yellow" : "red";
    let aisColor = connectionLost ? "yellow" : "red";
    let nmeaInfo = connectionLost ? "" : "server connection lost";
    let nmeaSource="";
    let aisInfo = "";
    let aisSource="";
    if (!connectionLost) {
        if (status && status.nmea) {
            nmeaColor = status.nmea.status;
            nmeaSource=status.nmea.source;
            nmeaInfo = status.nmea.info;
        }
        if (status && status.ais) {
            aisColor = status.ais.status;
            aisSource=status.ais.source;
            aisInfo = status.ais.info;
        }
    }
    return <WidgetFrame {...props}>
        <div className='widgetData'>
            <div className={"nmeaStatus"} key={1}>
                <div className={"rowBase status"}>
                    <div className={"label"}>NMEA</div>
                    <img className='status_image' src={getImgSrc(nmeaColor)}/>
                </div>
                <div className={"rowBase"}>
                    <div className={"label"}>Source</div>
                    <div className={"source"}>{nmeaSource}</div>
                </div>
                <div className={"rowBase"}>
                    <div className={"info"}>{nmeaInfo}</div>
                </div>
            </div >
            {!connectionLost ? <div className={"nmeaStatus"} key={2}>
                <div className={"rowBase status"}>
                    <div className={"label"}>AIS</div>
                    <img className='status_image' src={getImgSrc(aisColor)}/>
                </div>
                <div className={"rowBase"}>
                    <div className={"label"}>Source</div>
                    <div className={"source"}>{aisSource}</div>
                </div>
                <div className={"rowBase"}>
                    <div className={"info"}>{aisInfo}</div>
                </div>
            </div> : null
            }
        </div>
    </WidgetFrame>
}
