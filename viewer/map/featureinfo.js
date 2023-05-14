/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
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
 */
export default class FeatureInfo{
    constructor(type,title,point) {
        /**
         * @type FeatureInfoTypes
         */
        this.type=type;
        /**
         * @type String
         */
        this.title=title;
        /**
         * coordinates [lon,lat]
         */
        this.coordinates=point;
        /**
         * coordinates [lon,lat]
         * @type {undefined}
         */
        this.nextTarget=undefined; //next target point
        /**
         * type specific key
         * @type {undefined}
         */
        this.key=undefined;

    }
};

export const FeatureInfoTypes={
    AIS:0,
    ROUTE:1,    //point in current route
    TARGET: 2,  //current target
    OV_ROUTE: 3,//overlay route
    OV_TRACK: 4,//overlay track
    OV:5,
    CHART: 6    //vector chart feature
};

export class FeatureInfoList{
    constructor() {
        this.list=[];
        this.callbacks= {};
        this.callbackId=1;
        this.isLoading=true;
    }
    register(callback,opt_immediate){
        let rt=-1;
        for (let k in this.callbacks){
            if (this.callbacks[k] === callback){
                rt=k;
                break;
            }
        }
        if (rt < 0) {
            this.callbackId++;
            rt = this.callbackId;
            this.callbacks[rt]=callback;
        }
        if (opt_immediate){
            callback(this.list,this.isLoading);
        }
        return rt;
    }
    deregister(token){
        delete this.callbacks[token];
    }
    addItems(newItems,opt_finish){
        if (newItems) {
            this.list = this.list.concat(newItems);
        }
        if (opt_finish){
            this.isLoading=false;
        }
        for (let k in this.callbacks){
            this.callbacks[k](this.list,this.isLoading);
        }
    }
    getList(){
        return this.list;
    }
    getLoading(){
        return this.isLoading;
    }
}