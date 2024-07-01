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
import LeaveHandler from "./leavehandler";
import assign from 'object-assign';
import localStorageManager,{UNPREFIXED_NAMES} from "./localStorageManager";
class SplitSupport{
    constructor() {
        this.pubSub=new PubSub();
        window.addEventListener('message',(ev)=>{
            if (ev.origin !== window.location.origin) return;
            if (typeof(ev.data) !== 'object') return;
            if (ev.data.type === undefined) return;
            this.pubSub.publish(ev.data.type,ev.data);
        })
        this.urlParameters={};
    }
    addUrlParameter(name,value){
        this.urlParameters[name]=value;
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
    activateSplitMode(){
        LeaveHandler.stop();
        var location=window.location.href+'';
        location=location.replace('avnav_viewer','viewer_split').replace(/\?.*/,'');
        let delim='?';
        for (let k in this.urlParameters){
            location+=delim+encodeURIComponent(k)+"="+encodeURIComponent(this.urlParameters[k]);
            delim='&';
        }
        window.location.replace(location);
    }
    deactivateSplitMode(){
        LeaveHandler.stop();
        this.sendToFrame('finishSplit');
    }
    toggleSplitMode(){
        if (globalStore.getData(keys.gui.global.splitMode)){
            localStorageManager.setItem(UNPREFIXED_NAMES.SPLITMODE,undefined,"off");
            this.deactivateSplitMode();
        }
        else{
            localStorageManager.setItem(UNPREFIXED_NAMES.SPLITMODE,undefined,"on");
            this.activateSplitMode();
        }
    }

    setSplitFromLast(){
        let current=globalStore.getData(keys.gui.global.splitMode);
        if (!globalStore.getData(keys.properties.startLastSplit)){
            if (! current) {
                localStorageManager.setItem(UNPREFIXED_NAMES.SPLITMODE, undefined, "off");
                return false;
            }
            if (! globalStore.getData(keys.gui.global.preventAlarms)){
                //only handle this in one frame
                localStorageManager.setItem(UNPREFIXED_NAMES.SPLITMODE, undefined, "on");
                return false;
            }
        }
        let wanted=localStorageManager.getItem(UNPREFIXED_NAMES.SPLITMODE);
        if (wanted === 'on' && ! current){
            this.activateSplitMode();
            return true;
        }
        if (wanted !== 'on' && current){
            if (!globalStore.getData(keys.gui.global.preventAlarms)) {
                this.deactivateSplitMode();
                return true;
            }
        }
        return false;
    }

    buttonDef(options) {
        return assign(
            {
                name: 'Split',
                storeKeys: {
                    toggle: keys.gui.global.splitMode,
                    visible: keys.properties.showSplitButton
                },
                editDisable: true,
                onClick: () => {
                    this.toggleSplitMode();
                }
            },options);

    }

}

export default new SplitSupport();