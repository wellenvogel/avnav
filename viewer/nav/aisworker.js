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

//workaround to initialize the global store with defaults
//TODO: make navUrl a simple constant
let defaults=KeyHelper.getDefaultKeyValues();
globalstore.storeMultiple(defaults,undefined,true);

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

const queryData=async (distance,center,timeout)=>{
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
    return Requests.getJson(param, {checkOk: false, timeout: timeout}).then(
        (data) => {
            aisErrors=0;
            let now = (new Date()).getTime();
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

const computeResponse=(messageData)=>{
    fillOptionsAndBoatData(messageData);
    let start = (new Date()).getTime();
    let ais = computeAis();
    let done = (new Date()).getTime();
    self.postMessage({
        type: 'data',
        time: done - start,
        sequence: messageData.sequence,
        data: ais
    })
}

self.onmessage=async ({data})=>{
    if (data.type === 'query') {
        let received=await queryData(data.distance,data.center,data.timeout);
        if (received.error){
            self.postMessage({
                type: 'error',
                error: received.error,
                count: aisErrors
            })
            return;
        }
        receivedAisData=received.data;
        computeResponse(data);
    }
    if (data.type === 'boat' ){
        computeResponse(data);
    }
    if (data.type === 'config'){
        computeResponse(data);
    }
}