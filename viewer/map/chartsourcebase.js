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

import base from '../base.js';
import assign from 'object-assign';
import Helper from '../util/helper.js';
import CryptHandler from './crypthandler.js';
import shallowcompare from '../util/compare.js';
import featureFormatter from "../util/featureFormatter";
import globalstore from "../util/globalstore";
import keys from '../util/keys';

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
        this.featureFormatter=undefined
        if (chartEntry.featureFormatter){
            let formatter=chartEntry.featureFormatter;
            if (typeof(formatter) === 'string'){
                formatter=featureFormatter[formatter];
            }
            if (formatter) {
                this.featureFormatter=formatter;
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
        this.isReadyFlag = false;
        /**
         * @protected
         * @type {boolean}
         */

        this.layers = [];

        this.sequence='';

        this.removeSequence=0;

        this.visible=true;
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
     * redraw this layer if the sequence has changed
     * return true to let checkSequence always resolve to 0
     * thus preventing a complete redraw of the map
     * @return {boolean}
     */
    redraw(){
        return false;
    }
    getScale(){
        try {
            let view = this.mapholder.olmap.getView();
            let scale = 1;
            let currentZoom = view.getZoom();
            if (this.chartEntry.minScale && currentZoom < this.chartEntry.minScale) {
                scale = 1 / Math.pow(2, this.chartEntry.minScale - currentZoom);
            }
            if (this.chartEntry.maxScale && currentZoom > this.chartEntry.maxScale) {
                scale = Math.pow(2, currentZoom - this.chartEntry.maxScale);
            }
            return scale;
        }catch (e){}
        return 1;
    }

    /**
     * returns a promise that resolves to 1 for changed
     */
    checkSequence(force){
        let lastRemoveSequence=this.removeSequence;
        return new Promise((resolve,reject)=>{
            if (! globalstore.getData(keys.gui.capabilities.fetchHead,false)){
                resolve(0);
                return;
            }
            if (! this.visible){
                resolve(0);
                return;
            }
            fetch(this.getUrl(),{method:'HEAD'})
                .then((response)=>{
                    if (this.removeSequence !== lastRemoveSequence || (! this.isReady() && ! force)) {
                        resolve(0);
                        return;
                    }
                    let newSequence=response.headers.get('last-modified');
                    if (newSequence !== this.sequence) {
                        this.sequence=newSequence;
                        let drawn=this.redraw();
                        resolve(drawn?0:1);
                    }
                    else resolve(0)
                })
                .catch((e)=>resolve(0))
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

        const runPrepare=(resolve,reject)=>{
            this.checkSequence(true)
                .then((r)=> {
                    this.prepareInternal()
                        .then((layers) => {
                            layers.forEach((layer)=>{
                                if (!layer.avnavOptions) layer.avnavOptions={};
                                layer.avnavOptions.chartSource=this;
                            });
                            this.layers = layers;
                            if (!this.chartEntry.enabled) {
                                this.visible=false;
                                this.layers.forEach((layer) => layer.setVisible(false));
                            }
                            this.isReadyFlag = true;
                            resolve(this.layers);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                })
                .catch((e)=>reject(e));
        };
        return new Promise((resolve, reject)=> {
            if (this.chartEntry.tokenUrl) {
                CryptHandler.createOrActivateEncrypt(this.getChartKey(), this.chartEntry.tokenUrl, this.chartEntry.tokenFunction)
                    .then((result)=> {
                        this.encryptFunction = result.encryptFunction;
                        runPrepare(resolve,reject)
                    })
                    .catch((error)=> {
                        reject(error)
                    });
                return;
            }
            runPrepare(resolve,reject);
        });
    }



    destroy(){
        CryptHandler.removeChartEntry(this.getChartKey());
        this.isReadyFlag=false;
        this.layers=[];
        this.removeSequence++;
    }

    setVisible(visible){
        this.visible=visible;
        if (! this.isReady()) return;
        this.layers.forEach((layer)=>layer.setVisible(visible));
    }
    resetVisible(){
        if (! this.isReady()) return;
        this.visible=this.chartEntry.enabled;
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
    formatFeatureInfo(info, feature,coordinates,extended){
       if (! info || ! feature) return {};
        if (this.featureFormatter) {
            try {
                let fProps = assign({}, feature.getProperties());
                for (let k in fProps) {
                    if (typeof (fProps[k]) !== 'string' && typeof (fProps[k]) !== 'number') {
                        delete fProps[k];
                    }
                }
                if (coordinates) {
                    fProps.lat = coordinates[1];
                    fProps.lon = coordinates[0];
                }
                assign(info, Helper.filteredAssign({
                    sym: true,
                    name: true,
                    desc: true,
                    link: true,
                    htmlInfo: true,
                    time: true
                }, this.featureFormatter(fProps, extended)));

            } catch (e) {
                base.log("error in feature info formatter : " + e);
            }
        }
        info.icon=this.getSymbolUrl(info.sym,'.png');
        info.link=this.getLinkUrl(info.link);
        return info;
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

/**
 * a list of known style parameters
 * we do not import EditableWidgetParameter here directly
 * as this could easily create circular dependencies
 * @type {*[]}
 */
ChartSourceBase.StyleParam={
    lineWidth:{type:'NUMBER',list:[1,10],displayName:'line width',default: 3},
    lineColor:{type:'COLOR',displayName:'line color',default:'#000000' },
    fillColor:{type:'COLOR',displayName:'fill color',default: 'rgba(255,255,0,0.4)'},
    strokeWidth:{type:'NUMBER',displayName:'stroke width',default: 3,list:[1,40]},
    circleWidth:{type:'NUMBER',displayName:'circle width',default: 10,list:[1,40]},
    showName:{type:'BOOLEAN',displayName:'show feature name',default: false},
    textSize:{type:'NUMBER',displayName:'font size',default: 16},
    textOffset:{type:'NUMBER',displayName: 'text offset',default: 32}
}
export const getKnownStyleParam=()=>{
    let rt=[];
    for (let k in ChartSourceBase.StyleParam){
        rt.push(assign({},ChartSourceBase.StyleParam[k],{name:'style.'+k}));
    }
    return rt;
}

export default  ChartSourceBase;