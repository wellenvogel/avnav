/*
# Copyright (c) 2022,2025 Andreas Vogel andreas@wellenvogel.net

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
*/

import globalstore from "./globalstore";
import keys from "./keys";
import Requests from "./requests";
import {loadOrUpdateCss} from "./helper";

class WatchEntry{
    constructor(url,id,storeKey) {
        this.url=url;
        this.id=id;
        this.storeKey=storeKey;
        this.lastModified=undefined;
    }
}

export class CssWatcher{
    constructor(){
        this.watches={}
        globalstore.register(()=>this.check(),[keys.nav.gps.updateconfig])
    }
    check(opt_id){
        for (let k in this.watches){
            const entry=this.watches[k];
            if (opt_id !== undefined && opt_id !== entry.id) continue;
            if (!entry.storeKey || globalstore.getData(entry.storeKey)){
                Requests.getLastModified(entry.url)
                    .then((lastModified)=>{
                        if (lastModified !== entry.lastModified){
                            loadOrUpdateCss(undefined,entry.id);
                            entry.lastModified=lastModified;
                        }
                    })
            }
        }
    }
    addWatch(url,id,storeKey){
        if (! id || ! url ) return;
        const entry=new WatchEntry(url,id,storeKey);
        this.watches[id]=entry;
        Requests.getLastModified(url).then((lastModified)=>entry.lastModified=lastModified);
        if (storeKey){
            globalstore.register(()=>{
                //immediately check once if enabling the auto update
                if (globalstore.getData(storeKey)){
                    this.check(entry.id);
                }
            },storeKey)
        }
    }
}
export default new CssWatcher();

export const USERCSSID = 'avnav_usercss';