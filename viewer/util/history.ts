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
import remotechannel, {COMMANDS} from "./remotechannel";
import {PAGEIDS, PageType} from "./pageids";
const REMOTE_CMD=COMMANDS.setPage;

export interface HistoryOptions extends Record<string, any> {
    remote?:boolean;
    button?:string;
}
export interface HistoryEntry{
    location:PageType;
    options?:HistoryOptions;
}
interface HistoryEntryInternal extends HistoryEntry{
    back?:HistoryEntryInternal;
}
export type HistoryCallback = (history:HistoryEntry,previous:HistoryEntry) => void;
export interface IHistory{
    //access from useHistory
    fetchOptionValue:(key:string)=>any; //fetch and reset an option value
    replace:(location:string,options?:HistoryOptions)=>void;
    push:(location:string,options?:HistoryOptions)=>void;
    pop:()=>void;
    reset:()=>void;
    setOptions:(options?:HistoryOptions|undefined)=>void;
    currentLocation:(opt_includeOptions?:boolean)=>string|HistoryEntry;
    isPrevious:(location:string)=>boolean;
}
class History implements IHistory{
    private history:HistoryEntryInternal[];
    private callback:HistoryCallback;
    private remoteChannel:any;
    constructor(callback:HistoryCallback,startlocation:string,startoptions?:HistoryOptions){
        this.history=[];
        this.callback=callback;
        this.pop=this.pop.bind(this);
        this.push=this.push.bind(this);
        this.updateCallback=this.updateCallback.bind(this);
        this.reset=this.reset.bind(this);
        this.replace=this.replace.bind(this);
        this.setOptions=this.setOptions.bind(this);
        this.remoteChannel=remotechannel;
        if (startlocation){
            this.push(startlocation,startoptions);
        }
    }

    fetchOptionValue (key: string):any{
        if (this.history.length<1) return;
        const current=this.history[this.history.length-1];
        if (! current || ! current.options){
            return;
        }
        const rt=current.options[key];
        delete current.options[key];
        return rt;
    }
    setCallback(callback:HistoryCallback){
        this.callback=callback;
    }
    setFromRemote(location:string,options?:HistoryOptions){
        const last=this.history[this.history.length-1];
        this.history.splice(1, this.history.length);
        this.history.push({location:location,options:{...options,remote:true}});
        this.updateCallback(last,false, true);
    }
    replace(location:string,options?:HistoryOptions){
        if (this.history.length < 1){
            this.push(location,options);
            return;
        }
        const hentry=this.history[this.history.length - 1];
        //try to find the target in the current history
        //and set this as the topmost entry, update the options
        for (let idx=0;idx<this.history.length;idx++){
            if (this.history[idx].location===location){
                this.history.splice(idx+1,this.history.length)
                this.history[idx].options=options;
                this._tryAnchor();
                this.updateCallback(hentry);
                return;
            }
        }
        //if there is only one entry we make sure to only allow the navpage
        if (this.history.length===1){
            if (location !== PAGEIDS.NAV){
                //execute a push
                this.push(location,options);
                return;
            }
            //if the new location is nav we should have handled it above
            return;
        }
        //if not found replace the topmost entry
        this.history.splice(-1,1,{location:location,options:options||{},back:hentry});
        this._tryAnchor();
        this.updateCallback(hentry);
    }

    setOptions(options?:HistoryOptions|undefined){
        if (this.history.length < 1){
            return false;
        }
        const hentry=this.history[this.history.length - 1];
        hentry.options={...hentry.options,...options}
        this.updateCallback(undefined);
    }
    push(location:string,options?:HistoryOptions){
        const last=this.history[this.history.length - 1];
        this.history.push({location:location,options:options||{}});
        this._tryAnchor();
        this.updateCallback(last);
    }
    pop(){
        let last;
        if (this.history.length > 1) {
            last=this.history[this.history.length - 1];
            this.history.splice(1, this.history.length-1);
        }
        this._tryAnchor();
        this.updateCallback(last,true);
    }
    isPrevious(location:string){
        if (this.history.length < 2) return false;
        return location === this.history[this.history.length-2].location;
    }

    /**
     * cleanup the history if we hit an anchor page
     * will be called before the update callback
     */
    _tryAnchor(){
        if (this.history.length < 1) return false;
        const current=this.history[this.history.length - 1];
        if (current.location === PAGEIDS.NAV){
            this.history.splice(0,this.history.length);
            this.history.push(current);
        }
    }

    currentLocation(opt_includeOptions?:boolean){
        if (this.history.length < 1) return;
        if (! opt_includeOptions) {
            return this.history[this.history.length - 1].location;
        }
        else{
            const hentry=this.history[this.history.length - 1];
            return {location: hentry.location,options:hentry.options};
        }
    }

    /**
     * remove all except the first entries
     */
    reset(){
        const last=this.history[this.history.length - 1];
        this.history.splice(1,this.history.length);
        this.updateCallback(last);
    }

    /**
     *
     * @param last
     * @param opt_returning - legacy support with returning flag
     * @param opt_noremote
     */
    updateCallback(last:HistoryEntry,opt_returning?:boolean, opt_noremote?:boolean){
        let topEntry:HistoryEntry={location:PAGEIDS.NAV};
        if (this.history.length > 0){
            topEntry=this.history[this.history.length-1];
            if (opt_returning){
                if (! topEntry.options){
                    topEntry.options={};
                }
                topEntry.options.returning=true;
            }
        }
        if (this.callback) this.callback(topEntry,last);
        if (! opt_noremote){
            this.remoteChannel.sendMessage(REMOTE_CMD+' '+topEntry.location+' '+JSON.stringify(topEntry.options))
        }
    }

    isTop(){
        return this.history.length <=1;
    }
}
export default History;