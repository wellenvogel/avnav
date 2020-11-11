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

import Promise from 'promise';
import base from '../base.js';
import assign from 'object-assign';
import Requests from '../util/requests.js';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Helper from '../util/helper.js';
import CryptHandler from './crypthandler.js';
import shallowcompare from '../util/shallowcompare.js';


class ChartSourceBase {
    /**
     *
     * @param mapholder
     * @param chartEntry
     *        properties: url           - the chart url
     *                    chartKey      - a base name for the chart used as key (opt, defaults to url)
     *                                    used for querying the overlays
     *                    tokenUrl      - the url for a token handler script (opt)
     *                    tokenFunction - the name of the token function we expect from the token handler
     */
    constructor(mapholder, chartEntry) {
        this.mapholder = mapholder;
        this.chartEntry = assign({},chartEntry);
        for (let k in this.chartEntry){
            if (typeof this.chartEntry[k] === 'function'){
                delete this.chartEntry[k];
            }
        }
        this.encryptFunction = undefined;
        this.isReadyFlag = false;
        this.layers = [];
    }
    isReady(){
        return this.isReadyFlag;
    }
    getLayers() {
        if (!this.isReadyFlag) {
            return [];
        }
        return this.layers;

    }

    /**
     * returns a promise that resolves to 1 for changed
     */
    checkSequence(){
        return new Promise((resolve,reject)=>{
           resolve(0);
        });
    }

    isEqual(other){

        if (this.mapholder !== other.mapholder) return false;
        return shallowcompare(this.chartEntry,other.chartEntry);
    }
    getUrl(){
        return this.chartEntry.url;
    }

    getChartKey() {
        let chartBase = this.chartEntry.chartKey;
        if (!chartBase) chartBase = this.chartEntry.url;
        return chartBase;
    }

    prepareInternal(){
        return new Promise((resolve,reject)=>{
            reject("prepareInternal not implemented in base class");
        })
    }

    prepare() {
        return new Promise((resolve, reject)=> {
            if (this.chartEntry.tokenUrl) {
                CryptHandler.createOrActivateEncrypt(this.getChartKey(), this.chartEntry.tokenUrl, this.chartEntry.tokenFunction)
                    .then((result)=> {
                        this.encryptFunction = result.encryptFunction;
                        this.prepareInternal()
                            .then((layers)=> {
                                this.layers = layers;
                                if (! this.chartEntry.enabled){
                                    this.layers.forEach((layer)=>layer.setVisible(false));
                                }
                                this.isReadyFlag = true;
                                resolve(this.layers);
                            })
                            .catch((error)=> {
                                reject(error);
                            })
                    })
                    .catch((error)=> {
                        reject(error)
                    });
                return;
            }
            this.prepareInternal()
                .then((layers)=> {
                    this.layers = layers;
                    if (! this.chartEntry.enabled){
                        this.layers.forEach((layer)=>layer.setVisible(false));
                    }
                    this.isReadyFlag = true;
                    resolve(this.layers);
                })
                .catch((error)=> {
                    reject(error);
                })
        });
    }



    destroy(){
        CryptHandler.removeChartEntry(this.getChartKey());
        this.isReadyFlag=false;
        this.layers=[];
    }

    setVisible(visible){
        if (! this.isReady()) return;
        this.layers.forEach((layer)=>layer.setVisible(visible));
    }

}

export default  ChartSourceBase;