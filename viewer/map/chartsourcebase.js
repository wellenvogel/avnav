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
import featureFormatter from "../util/featureFormatter";

export const getOverlayConfigName=(chartEntry)=>{
    return chartEntry.overlayConfig || chartEntry.chartKey;
}
class ChartSourceBase {
    /**
     *
     * @param mapholder
     * @param chartEntry
     *        properties: url           - the chart url
     *                    chartKey      - a base name for the chart used as key
     *                    overlayConfig - name of the overlay config assigned to this chart
     *                    tokenUrl      - the url for a token handler script (opt)
     *                    tokenFunction - the name of the token function we expect from the token handler
     */
    constructor(mapholder, chartEntry) {
        this.mapholder = mapholder;
        /**
         * @protected
         */
        this.chartEntry = assign({},chartEntry);
        for (let k in this.chartEntry){
            if (typeof this.chartEntry[k] === 'function'){
                delete this.chartEntry[k];
            }
        }
        /**
         * @protected
         * @type {undefined}
         */
        this.encryptFunction = undefined;
        /**
         * @protected
         * @type {boolean}
         */
        this.isReadyFlag = false
        /**
         * @protected
         * @type {boolean}
         */
        ;
        this.layers = [];
    }
    getConfig(){
        return(assign({},this.chartEntry));
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
    getOverlayConfigName(){
        return getOverlayConfigName(this.chartEntry);
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
                    layers.forEach((layer)=>{
                        if (!layer.avnavOptions) layer.avnavOptions={};
                        layer.avnavOptions.chartSource=this;
                    })
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
    resetVisible(){
        if (! this.isReady()) return;
        this.layers.forEach((layer)=>layer.setVisible(this.chartEntry.enabled));
    }

    featureToInfo(feature,pixel,layer){
        return {};
    }
    getSymbolUrl(sym,opt_ext){
        if (! sym) return;
        if (! sym.match(/\./) && opt_ext) sym+=opt_ext;
        let url;
        if (sym.match(/^https*:/)) return sym;
        if (sym.match(/^\//)) return sym;
        if (this.chartEntry.icons){
            url=this.chartEntry.icons + "/" + sym;
            if (this.chartEntry.defaultIcon) url+="?fallback="+encodeURIComponent(this.chartEntry.defaultIcon);
        }
        else{
            return this.chartEntry.defaultIcon;
        }
        return url;
    }
    getLinkUrl(link){
        if (! link) return;
        if (link.match(/^https*:/)) return link;
        if (link.match(/^\//)) return link;
        if (! this.chartEntry.icons) return;
        return this.chartEntry.icons+"/"+link;
    }
    /**
     * call any user defined formatter with the properties
     * of the feature and merge this with the already fetched items
     * @param info the info to be merged in
     * @param feature the ol feature
     */
    formatFeatureInfo(info, feature,coordinates){
       if (! info || ! feature) return;
        if (this.chartEntry.featureFormatter){
            try{
                let formatter=this.chartEntry.featureFormatter;
                if (typeof(formatter) === 'string'){
                    formatter=featureFormatter[formatter];
                }
                if (formatter) {
                    let fProps=assign({}, feature.getProperties());
                    for (let k in fProps){
                        if (typeof(fProps[k]) !== 'string' && typeof(fProps[k]) !== 'number'){
                            delete fProps[k];
                        }
                    }
                    if (coordinates){
                        fProps.lat=coordinates[1];
                        fProps.lon=coordinates[0];
                    }
                    assign(info,Helper.filteredAssign({
                        sym:true,
                        name: true,
                        desc: true,
                        link: true,
                        htmlInfo: true,
                        time: true
                    },formatter(fProps,true)));
                }
            }catch (e){
                base.log("error in feature info formatter "+this.chartEntry.featureFormatter+": "+e);
            }
        }
        info.icon=this.getSymbolUrl(info.sym,'.png');
        info.link=this.getLinkUrl(info.link);
    }

    setEnabled(enabled,opt_update){
        this.mapholder.setEnabled(this,enabled,opt_update);
    }

    /**
     * resolves to an array of featureInfo
     * @param pixel
     * @returns {ThenPromise<unknown>}
     */
    getChartFeaturesAtPixel(pixel){
        return new Promise((resolve,reject)=>{
            resolve([])
        })
    }

    hasFeatureInfo(){
        if (! this.isReady()) return false;
        return this.chartEntry.hasFeatureInfo||false;
    }

}

export default  ChartSourceBase;