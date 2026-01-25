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
import Requests from '../util/requests.js';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Helper, {avitem, getav, setav} from '../util/helper.js';
import ChartSourceBase, {CHARTBASE} from './chartsourcebase.js';
import {CHARTAV, layerFactory} from './chartlayers';
import navobjects from "../nav/navobjects";
import {ChartFeatureInfo} from "./featureInfo";
import { getUrlWithBase} from "../util/itemFunctions";
import CryptHandler from './crypthandler.js';


class AvnavChartSource extends ChartSourceBase{
    constructor(mapholer, chartEntry) {
        super(mapholer,chartEntry);
        this.destroySequence=0;
        /**
         * @protected
         * @type {undefined}
         */
        this.encryptFunction = undefined;
    }

    isChart() {
        return true;
    }

    /**
     * return a complete URL for the chart overview that also can be used as base URL
     * @returns {string}
     */
    getOverviewUrl(){
        let overview=getUrlWithBase(this.chartEntry,CHARTAV.OVERVIEW);
        if (!overview) {
            overview = getUrlWithBase(this.chartEntry, CHARTAV.URL);
            if (!overview) return;
            overview += "/avnav.xml";
        }
        return new URL(overview,window.location.href).toString();
    }
    hasValidConfig(){
        return !!this.chartEntry[CHARTBASE.NAME] ;
    }
    async prepareInternal() {
        let url = this.chartEntry[CHARTAV.URL]||this.chartEntry[CHARTAV.OVERVIEW];
        let layerConfig;
        let ovUrl;
        if (this.chartEntry[CHARTAV.LAYERS]) {
            if (url) throw new Error("either provide an url or a layers config for a chart");
            layerConfig=this.chartEntry[CHARTAV.LAYERS];
            const baseUrl=this.chartEntry[CHARTAV.BASEURL];
            if (baseUrl){
                ovUrl=(new URL(baseUrl,window.location)).toString();
            }
            else {
                ovUrl = window.location.href;
            }
        }
        else {
            if (!url) {
                throw new Error("no map url for " + (this.chartEntry[CHARTAV.NAME]));
            }
            ovUrl = this.getOverviewUrl();
            const data = await Requests.getHtmlOrText(ovUrl, {
                useNavUrl: false,
                timeout: parseInt(globalStore.getData(keys.properties.chartQueryTimeout || 10000))
            })
            layerConfig=this.parseOverviewXml(data);
        }
        let layers = await this.parseLayerlist(layerConfig, ovUrl);
        //the sequence initially had been fetched before prepareInternal
        //but this was without the layers
        this.sequence = await this.addLayerSequences(this.sequence,layers);
        return layers;
    }
    encryptUrl(url){
        if (!this.encryptFunction) {
            return url;
        }
        else {
            let encryptPart = url.replace(/.*##encrypt##/, "");
            let basePart = url.replace(/##encrypt##.*/, "");
            let finalSrc = basePart + this.encryptFunction(encryptPart);
            return finalSrc;
        }
    }

    parseXmlNode(node){
        let rt = {};
        if (! node.tagName) return;
        for (let i=0;i<node.attributes.length;i++) {
            const attr=node.attributes.item(i);
            let v = attr.value;
            if (v instanceof String) {
                if (v.toLowerCase() === 'true') v=true;
                else if (v.toLowerCase() === 'false') v=false;
            }
            rt[attr.name.toLowerCase()] = v;
        }
        const children={}
        Array.from(node.childNodes).forEach((child)=>{
            let name=child.tagName;
            if (! name) return;
            name=name.toLowerCase();
            const childConfig=this.parseXmlNode(child);
            if (!children[name]) children[name]=childConfig;
            else{
                if (!Array.isArray(children[name])){
                    children[name]=[children[name]];
                }
                children[name].push(childConfig);
            }
        })
        for (let cn in children){
            if (rt[cn] !== undefined){
                throw new Error(`attribute and child with same name ${cn} in ${node.tagName} `);
            }
            rt[cn] = children[cn];
        }
        return rt;
    }
    parseOverviewXml(layerdata){
        const layers=[];
        let xmlDoc = Helper.parseXml(layerdata);
        Array.from(xmlDoc.getElementsByTagName('TileMap')).forEach((tm)=> {
            const layerconfig = this.parseXmlNode(tm);
            layers.push(layerconfig);
        });
        return layers;
    }
    async parseLayerlist(newConfig,ovurl) {
        let ll = [];
        if (! Array.isArray(newConfig) || newConfig.length < 1) {
            throw new Error("unable to parse a valid chart config - no layers")
        }
        let lnum=1;
        for (let layerConfig of newConfig){
            let type=layerConfig.profile;
            if (this.chartEntry[CHARTAV.TOKENURL] && (! type || ! type.startsWith('encrypted-'))) type='encrypted-'+(type||'zxy');
            const layerCreator=layerFactory.layerClass(type,{
                ...this.chartEntry,
                overviewUrl:ovurl
            });
            if (! layerCreator){
                throw new Error(`unable to create layer ${lnum}, no layer profile ${type}`);
            }
            const adaptedConfig=await layerCreator.prepare(layerConfig,this);
            const olLayer=layerCreator.createOL(adaptedConfig);
            if (this.chartEntry[CHARTAV.OPACITY] && olLayer && olLayer.setOpacity){
                const opacity=parseFloat(this.chartEntry[CHARTAV.OPACITY]);
                olLayer.setOpacity(opacity);
            }
            setav(olLayer,{
                chartSource: this,
                isBase: this.isBaseChart(),
                creator:layerCreator,
                name:layerConfig.name||layerConfig.title||"layer"+lnum,
                layerProfile: type||"zxy"
            })
            ll.push(olLayer);
            lnum++;
        }
        return ll.reverse();
    }


    featureListToInfo(allFeatures, pixel) {
        const layerList={};
        for (let featureConfig of allFeatures){
            const layerName=avitem(featureConfig.layer,'name');
            if (! layerName)continue;
            if (! layerList[layerName]) layerList[layerName]=[];
            layerList[layerName].push(featureConfig);
        }
        const collectedInfos=[];
        for (let layerName in layerList){
            const entries=layerList[layerName];
            if (entries.length < 1) continue;
            const creator=avitem(entries[0].layer,'creator');
            if (! creator)continue;
            const layerInfos=creator.featureListToInfo(entries,pixel,entries[0].layer,this)
            if (! layerInfos) continue;
            if (!Array.isArray(layerInfos)){
                collectedInfos.push(layerInfos);
            }
            else{
                layerInfos.forEach(layerInfo=>{
                    collectedInfos.push(layerInfo);
                })
            }
        }
        return collectedInfos;
    }

    featureToInfo(feature, pixel, layer,allFeatures) {
        const creator=avitem(layer,'creator');
        if (!creator) return;
        return creator.featureToInfo(feature, pixel, layer,allFeatures,this);
    }
    async addLayerSequences(sequence,layers){
        if (! layers) return sequence;
        if (sequence == undefined) sequence="";
        for (let layer of layers){
            const creator=getav(layer).creator;
            if (creator && creator.getSequenceFunction()){
                const add=await creator.getSequenceFunction()();
                if (add == undefined) add="";
                sequence+="#"+add;
            }
        }
        return sequence;
    }

    async _fetchChartSequence(){
        let newSequence;
        try {
            let sequenceUrl=getUrlWithBase(this.chartEntry,CHARTAV.SEQUENCEURL);
            if (! sequenceUrl) {
                const chartUrl=getUrlWithBase(this.chartEntry,CHARTAV.URL);
                if (chartUrl) {
                    sequenceUrl=chartUrl+"/sequence?_="+encodeURIComponent((new Date()).getTime());
                }
            }
            if (sequenceUrl) {
                newSequence = await Requests.getJson(sequenceUrl,{useNavUrl:false,checkOK:false,noCache:false})
                    .then((json)=>json.sequence);
            }
            else if (this.getOverviewUrl()){
                //fall through to last modified of overview
                throw {code:404};
            }
            else{
                newSequence = 0; //no sequence handling
            }
        }catch (e){
            if (e && e.code === 404){
                newSequence = await Requests.getLastModified(this.getOverviewUrl());
            }
            else{
                newSequence=0;
            }
        }
        return newSequence;
    }
    async checkSequence(force) {
        //prevent from triggering a reload if we already have been destroyed
        let destroySequence = this.destroySequence;
        if ((!this.isReady() &&! force)|| destroySequence !== this.destroySequence) return false;
        let newSequence=await this._fetchChartSequence();
        newSequence = await this.addLayerSequences(newSequence, this.layers);
        if (this.destroySequence !== destroySequence) {
            return false;
        }
        if (newSequence !== this.sequence) {
            base.log("Sequence changed from " + this.sequence + " to " + newSequence + " reload map");
            this.sequence = newSequence;
            return true;
        }
        return false;
    }

    async destroy() {
        for (let layer of this.layers) {
            const creator=getav(layer).creator;
            try {
                if (creator) await creator.destroy();
            }catch (e){
                base.log(`error destroying creator "${layer}": ${e}`);
            }
        }
        await super.destroy();
        CryptHandler.removeChartEntry(this.getChartKey());
        this.destroySequence++;
    }

    /**
     * build a list of featureInfoObjects
     * by external queries
     * @param pixel
     * @return {Promise<unknown>}
     */
    getChartFeaturesAtPixel(pixel) {
        return new Promise((resolve,reject)=>{
            //if (! this.chartEntry.hasFeatureInfo) resolve([]);
            if (! this.isReady()) resolve([]);
            const finalFeatureInfos=[];
            let mapcoordinates=this.mapholder.pixelToCoord(pixel);
            let lonlat=this.mapholder.transformFromMap(mapcoordinates);
            let offsetPoint=this.mapholder.pixelToCoord([pixel[0]+globalStore.getData(keys.properties.clickTolerance)/2,pixel[1]])
            let offsetLatlon=this.mapholder.transformFromMap(offsetPoint);
            let tolerance=Math.abs(offsetLatlon[0]-lonlat[0]);
            let layerActions=[];
            for (let i=this.layers.length-1;i>=0;i--){
                let layer=this.layers[i];
                if (! layer.getVisible()) continue;
                const avLayerOptions=getav(layer);
                if (! avLayerOptions.isTileLayer) continue;
                let res=this.mapholder.getView().getResolution();
                let tile=layer.getSource().getTileGrid()
                    .getTileCoordForCoordAndResolution(mapcoordinates,res);
                let url=layer.getSource().getTileUrlFunction()(tile);
                let action=new Promise((aresolve,areject)=>{
                    const computeUrl=avLayerOptions.finalUrl;
                    const layerName=(this.layers.length>1)?": "+(avLayerOptions.name):'';
                    let finalUrl=computeUrl?computeUrl(url):url;
                    Requests.getJson(finalUrl,{useNavUrl:false,noCache:false},{
                        featureInfo:1,
                        lat:lonlat[1],
                        lon:lonlat[0],
                        tolerance: tolerance
                    })
                        .then((result)=>{
                            if (result.data) {
                                let topInfo;
                                if (Array.isArray(result.data)){
                                    if(result.data.length>0) {
                                        topInfo = result.data[0];
                                    }
                                }
                                else{
                                    topInfo = result.data;
                                }
                                if (!topInfo) aresolve();
                                let info=new ChartFeatureInfo({
                                    name: this.getChartKey(),
                                    title:this.getName()+layerName,
                                    isOverlay: ! this.isBaseChart()
                                });
                                info.userInfo=topInfo;
                                info.overlaySource=this;
                                delete info.userInfo.name;
                                if (topInfo.nextTarget){
                                    let nextTarget;
                                    if (topInfo.nextTarget instanceof Array){
                                        //old style coordinate lon,lat
                                        nextTarget=new navobjects.Point();
                                        nextTarget.fromCoord(topInfo.nextTarget);
                                    }
                                    else if (topInfo.nextTarget instanceof Object){
                                        nextTarget=new navobjects.Point();
                                        nextTarget.fromPlain(topInfo.nextTarget);
                                    }
                                    info.point=nextTarget;
                                }
                                if (! info.validPoint()){
                                    info.point=new navobjects.Point(lonlat[0],lonlat[1])
                                }
                                aresolve(info)
                            }
                            else{
                                aresolve();
                            }
                        })
                        .catch((error)=>aresolve()); //TODO
                });
                layerActions.push(action);
            }
            if (layerActions.length < 1) resolve([]);
            Promise.all(layerActions)
                .then((results)=>{
                    for (let i=0;i<results.length;i++){
                        const info=results[i];
                        if (! info) continue;
                        finalFeatureInfos.push(info)
                    }
                    resolve(finalFeatureInfos);
                })
                .catch((error)=>reject(error));

        });
    }

}

export default  AvnavChartSource;