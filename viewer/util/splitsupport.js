/*
###############################################################################
# Copyright (c) 2022, Andreas Vogel andreas@wellenvogel.net

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
import PubSub from "PubSub";
import base from "../base";
import globalStore from "./globalstore";
import keys from "./keys";
class SplitSupport{
    constructor() {
        this.pubSub=new PubSub();
        window.addEventListener('message',(ev)=>{
            if (ev.origin !== window.location.origin) return;
            if (typeof(ev.data) !== 'object') return;
            if (ev.data.type === undefined) return;
            this.pubSub.publish(ev.data.type,ev.data);
        })
    }
    subscribe(type,callback){
        return this.pubSub.subscribe(type,callback);
    }
    unsubscribe(token){
        this.pubSub.unsubscribe(token);
    }
    sendToFrame(type,message){
        if (! globalStore.getData(keys.gui.global.splitMode)) return;
        if (! message) message={};
        message.type=type;
        try{
            window.parent.postMessage(message,window.location.origin);
        }catch(e){
            base.log("unable to post message: "+e);
        }
    }

}

export default new SplitSupport();