/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
 ###############################################################################
 * AIS computations
 */


import {handleReceivedAisData} from "./aiscomputations";
import navobjects from "./navobjects";
import formatter from '../util/formatter';
import Requests from "../util/requests";
import {KeyHelper} from "../util/keys";
import globalstore from "../util/globalstore";
import Helper from "../util/helper";


let boatData={
    position: new navobjects.Point(undefined,undefined),
    speed: undefined,
    course: undefined
};

let receivedAisData=[];
let options={};
let aisErrors=0;

const computeAis=()=>{
    if (aisErrors > 10){
        receivedAisData=[];
        aisErrors=10;
    }
    return handleReceivedAisData(receivedAisData,boatData.position,boatData.course,boatData.speed,options);
}

const queryData=async (distance,center,timeout,navUrl)=>{
    let param = {
        request: 'ais',
        distance:  formatter.formatDecimal(distance, 4, 1)
    };
    for (let idx = 0; idx < center.length; idx++) {
        if (!center[idx]) continue;
        let sfx = idx !== 0 ? idx + "" : "";
        param['lat' + sfx] = formatter.formatDecimal(center[idx].lat, 3, 5, false, true);
        param['lon' + sfx] = formatter.formatDecimal(center[idx].lon, 3, 5, false, true);
    }
    return Requests.getJson(navUrl, {
        checkOk: false,
        timeout: timeout/2,
        useNavUrl: false
        },param).then(
        (data) => {
            aisErrors=0;
            let now = Helper.now();
            let aisList = [];
            if (data['class'] && data['class'] == "error") aisList = [];
            else aisList = data;
            aisList.forEach((ais) => {
                ais.receiveTime = now;
            })
            return {data:aisList};
        },
        (error)=>{
            aisErrors++;
            return {error:error}
        }
        );
}

const fillOptionsAndBoatData=(messageData)=>{
    if (messageData.boatPosition !== undefined) {
        boatData.position=new navobjects.Point(messageData.boatPosition.lon,messageData.boatPosition.lat);
        boatData.speed=messageData.boatSpeed;
        boatData.course=messageData.boatCourse;
    }
    if (messageData.options !== undefined) options=messageData.options;

}
let lastResponse=0;
let hiddenTargets={}
const computeResponse=(messageData)=>{
    fillOptionsAndBoatData(messageData);
    let start = Helper.now();
    let ais = computeAis();
    if (ais){
        let hideTime=options.hideTime*1000;
        ais.forEach((aisItem)=>{
            if (! aisItem.warning){
                let hidden=hiddenTargets[aisItem.mmsi];
                if (hidden !== undefined){
                    if ((hidden+hideTime)<Helper.now()){
                        delete hiddenTargets[aisItem.mmsi];
                        hidden=undefined;
                    }
                    if (hidden !== undefined) aisItem.hidden=true;
                }
            }
        })
    }
    let done = Helper.now();
    self.postMessage({
        type: 'data',
        time: done - start,
        sequence: messageData.sequence,
        data: ais
    })
}

const handleError=(error,sequence,inc)=>{
    if (inc) aisErrors++;
    self.postMessage({
        type: 'error',
        error: error,
        count: aisErrors
    })
}

let queryRunning=false;
let overloadCount=0;
self.onmessage=async ({data})=>{
    if (data.type === 'query') {
        if (queryRunning){
            handleError("ais query overload",data.sequence,true);
            return;
        }
        let received;
        try {
            queryRunning=true;
            received = await queryData(data.distance, data.center, data.timeout,options.navUrl);
        }
        catch (e){
            handleError(e,data.sequence,true);
            return;
        }
        finally{
            queryRunning=false;
        }
        if (received.error){
            handleError(received.error,data.sequence)
            return;
        }
        receivedAisData=received.data;
        computeResponse(data);
    }
    if (data.type === 'boat' ){
        let now=Helper.now();
        //we expect at last 10ms idle
        //but we only limit the "boat" requests - all others are limited any way
        if ((now-lastResponse) < 10){
            fillOptionsAndBoatData(data);
            overloadCount++;
            if (overloadCount === 10) {
                handleError("ais compute overload", data.sequence, true);
            }
            return;
        }
        overloadCount=0;
        computeResponse(data);
        lastResponse=now;
    }
    if (data.type === 'config'){
        computeResponse(data);
    }
    if (data.type === 'hidden'){
        if (data.hiddenTargets === undefined) return;
        hiddenTargets=data.hiddenTargets;
        computeResponse(data);
    }
}