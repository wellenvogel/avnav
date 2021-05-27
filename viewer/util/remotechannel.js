/*
# vim: ts=2 sw=2 et
###############################################################################
# Copyright (c) 2014-2021, Andreas Vogel andreas@wellenvogel.net
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
#  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
#  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
#  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
#  DEALINGS IN THE SOFTWARE.
    ###############################################################################

*/

import globalstore from "./globalstore";
import keys from "./keys";
import base from "../base";
import PubSub from "PubSub";
import androidEventHandler from "./androidEventHandler";
import dimhandler from "./dimhandler";
const PSTOPIC="remote.";
export const COMMANDS={
    setPage:'CP', //str page
    key:'K', //str key
    setChart: 'CM', //json chartEntry
    setCenter: 'CC', //json lat,lon
    setZoom: 'CZ', //float zoom
    lock: 'CL', //str true|false
    courseUp: 'CU', //str true|false
    gpsNum: 'CN', //num number gpspage number
    addOn: 'CA' //the add on number
};
class RemoteChannel{
    constructor(props) {
        this.timerCall=this.timerCall.bind(this);
        this.timer=undefined;
        this.websocket=undefined;
        this.pubsub=new PubSub();
        this.channel=globalstore.getData(keys.properties.remoteChannelName,'0');
        this.channelChanged=this.channelChanged.bind(this);
        this.android=window.avnavAndroid;
        if (this.android){
            this.token=androidEventHandler.subscribe('remoteMessage',(ev)=>{
                window.setTimeout(()=>{
                    while (true) {
                        let msg = this.android.readChannelMessage(this.websocket);
                        if (msg) {
                            this.onMessage(msg);
                        }
                        else{
                            break;
                        }
                    }
                },0);
            })
            this.closeToken=androidEventHandler.subscribe('channelClose',(ev)=>{
               if (ev.id === this.websocket){
                   this.close();
               }
            });
        }
        this.id=0;
    }
    close(){
        if (this.websocket !== undefined){
            if (this.android){
                try{
                    this.android.channelClose(this.websocket);
                }catch (e){}
                this.websocket=undefined;
                return;
            }
            try{
                this.websocket.close();
            }catch (e){}
            this.websocket=undefined;
        }
    }
    channelChanged(){
       let nc=globalstore.getData(keys.properties.remoteChannelName,'0');
       if (nc !== this.channel){
           this.channel=nc;
           this.close();
           this.openWebSocket();
       }

    }
    timerCall(){
        if (this.websocket === undefined){
            this.openWebSocket();
        }
        else{
            if (!globalstore.getData(keys.gui.capabilities.remoteChannel)){
                this.close();
            }
        }
        globalstore.storeData(keys.gui.global.remoteChannelState,{
            connected: this.websocket !== undefined,
            channel: this.channel
        })
    }
    start(){
        if (window.WebSocket === undefined) return;
        globalstore.register(this.channelChanged,[keys.properties.remoteChannelName]);
        this.channel=globalstore.getData(keys.properties.remoteChannelName,'0');
        this.openWebSocket();
        this.timer=window.setInterval(this.timerCall,1000);
    }
    onMessage(data){
        base.log("message",data);
        if (! globalstore.getData(keys.properties.remoteChannelRead,false)) return;
        if (! globalstore.getData(keys.properties.connectedMode,false)) return;
        let parts=data.split(/  */);
        if (parts.length < 2) return;
        if (! parts[0] in COMMANDS) return;
        data=data.replace(/^[^ ]* */,'');
        window.setTimeout(()=> {
            dimhandler.trigger(); //get us out of dim mode
            this.pubsub.publish(PSTOPIC + parts[0], data);
        },0);
    }
    openWebSocket(){
        if (! globalstore.getData(keys.gui.capabilities.remoteChannel)) return;
        this.close();
        if (this.android){
            this.websocket=this.android.channelOpen("/remotechannels/"+this.channel);
            if (this.websocket < 0) this.websocket=undefined;
            return;
        }
        this.id++;
        let connectionId=this.id;
        let url='ws://'+window.location.host+
            "/remotechannels/"+this.channel;
        try{
            console.log("opening websocket to ",url);
            this.websocket=new WebSocket(url);
            this.websocket.addEventListener('message',(msg)=>{
                if (connectionId === this.id) {
                    this.onMessage(msg.data);
                }
            });
            this.websocket.addEventListener('close',()=>{
                console.log("websocket closed");
                if (connectionId !== this.id) {
                    return;
                }
                this.websocket = undefined;
            })
            this.websocket.addEventListener('error',()=>{
                console.log("websocket error");
                if (connectionId !== this.id){
                    return;
                }
                try{
                    this.websocket.close();
                }catch (e){}
                this.websocket=undefined;
            })
        }catch (e){
            base.log("error opening websocket channel")
        }
    }
    stop(){
        globalstore.deregister(this.channelChanged);
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer=undefined;
        }
        this.close();
    }
    sendMessage(msg,param){
        if (! this.websocket) return;
        if (! globalstore.getData(keys.properties.remoteChannelWrite,false)) return;
        if (! globalstore.getData(keys.properties.connectedMode,false)) return;
        try {
            if (param !== undefined) msg+=" "+param;
            if (this.android){
                this.android.sendChannelMessage(this.websocket,msg);
            }
            else {
                this.websocket.send(msg);
            }
        }catch (e){

        }
    }
    sendJsonMessage(command,data){
        let p=JSON.stringify(data);
        this.sendMessage(command,p);
    }
    subscribe(type,callback){
        return this.pubsub.subscribe(PSTOPIC+type,callback);
    }
    unsubscribe(token){
        return this.pubsub.unsubscribe(token);
    }
}

export default new RemoteChannel()