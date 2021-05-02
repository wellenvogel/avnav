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
const PSTOPIC="remote.";
class RemoteChannel{
    constructor(props) {
        this.timerCall=this.timerCall.bind(this);
        this.timer=undefined;
        this.websocket=undefined;
        this.pubsub=new PubSub();
    }
    timerCall(){
        if (this.websocket === undefined){
            this.openWebSocket();
        }
        globalstore.storeData(keys.gui.global.remoteChannelState,{
            connected: this.websocket !== undefined
        })
    }
    start(){
        this.openWebSocket();
        this.timer=window.setInterval(this.timerCall,1000);
    }
    onMessage(data){
        console.log("message",data);
        if (! globalstore.getData(keys.properties.remoteChannelRead,false)) return;
        let parts=data.split(/  */);
        if (parts.length < 2) return;
        window.setTimeout(()=> {
            this.pubsub.publish(PSTOPIC + parts[0], data);
        },0);
    }
    openWebSocket(){
        this.websocket=undefined;
        let url='ws://'+window.location.host+
            "/remotechannels/"+globalstore.getData(keys.properties.remoteChannelName)
        try{
            this.websocket=new WebSocket(url);
            this.websocket.addEventListener('message',(msg)=>{
                this.onMessage(msg.data);
            });
            this.websocket.addEventListener('close',()=>{
                console.log("websocket closed");
                this.websocket=undefined;
            })
            this.websocket.addEventListener('error',()=>{
                console.log("websocket error");
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
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer=undefined;
        }
        if (this.websocket){
            try{
                this.websocket.close();
            }catch (e){}
            this.websocket=undefined;
        }
    }
    sendMessage(msg){
        if (! this.websocket) return;
        if (! globalstore.getData(keys.properties.remoteChannelWrite,false)) return;
        try {
            this.websocket.send(msg);
        }catch (e){

        }
    }
    subscribe(type,callback){
        return this.pubsub.subscribe(PSTOPIC+type,callback);
    }
    unsubscribe(token){
        return this.pubsub.unsubscribe(token);
    }
}

export default new RemoteChannel()