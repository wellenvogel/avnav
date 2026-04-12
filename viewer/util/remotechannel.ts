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
// @ts-ignore
import PubSub from "PubSub";
import androidEventHandler from "./androidEventHandler";
import dimhandler from "./dimhandler";
import Requests from './requests';

const PSTOPIC="remote.";
export enum COMMANDS{
    setPage='CP', //str page
    key='K', //str key
    setChart= 'CM', //json chartEntry
    setCenter= 'CC', //json lat,lon
    setZoom= 'CZ', //float zoom
    lock= 'CL', //str true|false
    courseUp= 'CU', //str true|false
    gpsNum= 'CN', //num number gpspage number
    addOn= 'CA' //the add on number
}
class RemoteChannel{
    private timer: number;
    private websocket: WebSocket;
    private pubsub: typeof PubSub;
    private channel: string;
    private android: any;
    private androidChannel:number=-1;
    private id: number;
    constructor() {
        this.timerCall=this.timerCall.bind(this);
        this.timer=undefined;
        this.websocket=undefined;
        this.pubsub=new PubSub();
        this.channel=globalstore.getData(keys.properties.remoteChannelName,'0');
        this.channelChanged=this.channelChanged.bind(this);
        // @ts-ignore
        this.android=window.avnavAndroid;
        if (this.android){
            androidEventHandler.subscribe('remoteMessage',()=>{
                window.setTimeout(()=>{
                    for (let i=0;i<100;i++) {
                        const msg = this.android.readChannelMessage(this.androidChannel);
                        if (msg) {
                            this.onMessage(msg);
                        }
                        else{
                            break;
                        }
                    }
                },0);
            })
            androidEventHandler.subscribe('channelClose',(ev)=>{
               if (ev.id === this.androidChannel){
                   this.close();
               }
            });
        }
        this.id=0;
        globalstore.register(()=>{
                this.checkEnabled()
        },[keys.nav.gps.updateconfig]);
    }
    close(){
            if (this.android){
                try{
                    if (this.androidChannel >= 0) {
                        this.android.channelClose(this.androidChannel);
                        this.androidChannel=-1;
                    }
                }catch (e){ /* empty */ }
                this.websocket=undefined;
                return;
            }
        if (this.websocket !== undefined){
            try{
                this.websocket.close();
            }catch (e){ /* empty */ }
            this.websocket=undefined;
        }
    }
    channelChanged(){
       const nc=globalstore.getData(keys.properties.remoteChannelName,'0');
       if (nc !== this.channel){
           this.channel=nc;
           this.close();
           this.openWebSocket();
       }

    }
    queryEnabled(){
       return Requests.getJson({
            request:'api',
            type: 'remotechannels',
            command: 'enabled'
        }).then((json)=> {
            return json.enabled;
       },(e)=>{
           base.log("unable to query websocket enabled state",e)
           return false;
        })
    }
    checkEnabled(){
        this.queryEnabled().then((enabled)=>{
            globalstore.storeData(keys.gui.global.remoteChannelActive,enabled);
        })
    }
    isActive(){
        return globalstore.getData(keys.gui.capabilities.remoteChannel) &&
            globalstore.getData(keys.gui.global.remoteChannelActive)
    }
    timerCall(){
        if (this.websocket === undefined && (this.androidChannel < 0)){
            if (this.isActive()) this.openWebSocket();
        }
        else{
            if (!this.isActive() ){
                this.close();
            }
        }
        globalstore.storeData(keys.gui.global.remoteChannelState,{
            connected: this.websocket !== undefined || this.androidChannel >= 0,
            channel: this.channel,
            read: globalstore.getData(keys.properties.remoteChannelRead),
            write: globalstore.getData(keys.properties.remoteChannelWrite),

        })
    }
    start(){
        if (window.WebSocket === undefined && ! this.android) return;
        globalstore.register(this.channelChanged,[keys.properties.remoteChannelName]);
        this.channel=globalstore.getData(keys.properties.remoteChannelName,'0');
        this.queryEnabled().then((enabled)=> {
            globalstore.storeData(keys.gui.global.remoteChannelActive,enabled)
            if (this.isActive()) {
                this.openWebSocket();
            }
        })
        this.timer=window.setInterval(this.timerCall,1000);
    }
    onMessage(data:string){
        base.log("message",data);
        if (! globalstore.getData(keys.properties.remoteChannelRead,false)) return;
        if (! globalstore.getData(keys.gui.global.connectedMode,false)) return;
        const parts=data.split(/  */);
        if (parts.length < 2) return;
        if (Object.values(COMMANDS).indexOf(parts[0] as COMMANDS) < 0 ) return;
        data=data.replace(/^[^ ]* */,'');
        window.setTimeout(()=> {
            dimhandler.trigger(); //get us out of dim mode
            this.pubsub.publish(PSTOPIC + parts[0], data);
        },0);
    }
    openWebSocket(){
        if (! this.isActive()) return;
        this.close();
        if (this.android){
            if (this.androidChannel>=0) return;
            this.androidChannel=this.android.channelOpen("/remotechannels/"+this.channel);
            return;
        }
        if (this.websocket !== undefined){return}
        this.id++;
        const connectionId=this.id;
        const url='ws://'+window.location.host+
            "/remotechannels/"+this.channel;
        try{
            base.log("opening websocket to ",url);
            this.websocket=new WebSocket(url);
            this.websocket.addEventListener('message',(msg)=>{
                if (connectionId === this.id) {
                    this.onMessage(msg.data);
                }
            });
            this.websocket.addEventListener('close',()=>{
                base.log("websocket closed");
                if (connectionId !== this.id) {
                    return;
                }
                this.websocket = undefined;
            })
            this.websocket.addEventListener('error',()=>{
                base.log("websocket error");
                if (connectionId !== this.id){
                    return;
                }
                try{
                    this.websocket.close();
                }catch (e){ /* empty */ }
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
    sendMessage(msg:string,param?:string|number){
        if (! this.websocket) return;
        if (! globalstore.getData(keys.properties.remoteChannelWrite,false)) return;
        if (! globalstore.getData(keys.gui.global.connectedMode,false)) return;
        try {
            if (param !== undefined) msg+=" "+param;
            if (this.android){
                this.android.sendChannelMessage(this.androidChannel,msg);
            }
            else {
                this.websocket.send(msg);
            }
        }catch (e){ /* empty */ }
    }
    sendJsonMessage(command:string,data:any){
        const p=JSON.stringify(data);
        this.sendMessage(command,p);
    }
    subscribe(type:COMMANDS,callback:(msg:string)=>void   ){
        return this.pubsub.subscribe(PSTOPIC+type,callback);
    }
    unsubscribe(token: string){
        return this.pubsub.unsubscribe(token);
    }
}

export default new RemoteChannel()