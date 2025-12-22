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
import Helper, {getav, setav} from '../util/helper.js';
import ChartSourceBase, {CHARTBASE} from './chartsourcebase.js';
import * as olExtent from 'ol/extent';
import {XYZ as olXYZSource} from 'ol/source';
import * as olTransforms  from 'ol/proj/transforms';
import {Tile as olTileLayer} from 'ol/layer';
import {listenOnce,unlistenByKey} from 'ol/events';
import olEventType from 'ol/events/EventType';
import olImageTile from 'ol/src/ImageTile';
import olTileState from 'ol/src/TileState';
import olCanvasTileLayerRenderer from 'ol/renderer/canvas/TileLayer';
import {getUid} from "ol/util";
import navobjects from "../nav/navobjects";
import {ChartFeatureInfo} from "./featureInfo";
import { getUrlWithBase, injectBaseUrl} from "../util/itemFunctions";
import CryptHandler from './crypthandler.js';

const NORMAL_TILE_SIZE=256;

//we use a bit a dirty hack here:
//ol3 nicely shows a lower zoom if the tile cannot be loaded (i.e. has an error)
//to avoid server round trips, we use a local image url
//the more forward way would be to return undefined - but in this case
//ol will NOT show the lower zoom tiles...
const invalidUrl = 'data:image/png;base64,i';
const tileClassCreator=(tileUrlFunction,maxUpZoom,inversy)=>
{
    class AvNavTile extends olImageTile {
        constructor(tileCoord,
                    state,
                    src,
                    crossOrigin,
                    tileLoadFunction,
                    opt_options) {
            super(...arguments);
            this.ownImage = new Image();
            this.ownTileLoadFunction = tileLoadFunction;
            this.ownSrc = src;
            this.listenerKeys = [];
            this.tileUrlFunction=tileUrlFunction;
            this.downZoom=0;
        }

        getModifiedUrl(){
            let coord=this.tileCoord.slice(0);
            for (let dz=0;dz < this.downZoom;dz++){
                coord[0]=coord[0]-1;
                coord[1]=Math.floor(coord[1]/2);
                coord[2]=Math.floor(coord[2]/2);
            }
            return this.tileUrlFunction(coord);
        }
        computeImageProps(){
            let x=this.tileCoord[1];
            let y=this.tileCoord[2];
            let fact=1 << this.downZoom;
            let nx=Math.floor(x/fact);
            let ny=Math.floor(y/fact);
            let xsize=this.ownImage.width;
            let ysize=this.ownImage.height;
            xsize=Math.floor(xsize/fact);
            ysize=Math.floor(ysize/fact);
            let yoffset=inversy?(fact - ((y-ny*fact)%fact)-1)*ysize: ((y-ny*fact)%fact)*ysize;
            return {
                x: ((x-nx*fact)%fact)*xsize,
                y: yoffset,
                w:xsize,
                h:ysize
            }
        }

        getImage() {
            return this.ownImage;
        }
        getImageProps(){
            return this.computeImageProps();
        }

        load() {
            if (this.state === olTileState.ERROR) {
                this.state = olTileState.IDLE;
                this.ownImage = new Image();
            }
            if (this.state === olTileState.IDLE || this.downZoom > 0) {
                this.state = olTileState.LOADING;
                if (! this.downZoom) this.changed();
                this.ownTileLoadFunction(this, this.getModifiedUrl());
                this.listenerKeys = [
                    listenOnce(this.ownImage, olEventType.LOAD, (ev) => {
                        if (this.ownImage.naturalWidth && this.ownImage.naturalHeight) {
                            if (this.downZoom > 0){
                                base.log("downzoom loaded, dz="+this.downZoom+" for "+this.ownSrc+
                                ", "+this.getModifiedUrl());
                            }
                            this.state = olTileState.LOADED;
                        } else {
                            this.state = olTileState.EMPTY;
                        }
                        this.unlisten();
                        this.changed();
                    }),
                    listenOnce(this.ownImage, olEventType.ERROR, (ev) => {
                        this.unlisten();
                        if (this.downZoom < maxUpZoom){
                            this.downZoom++;
                            let help=this.downZoom;
                            base.log("dz: "+help+" for "+this.ownSrc);
                            window.setTimeout(()=>{
                                this.load();
                            },1);
                            return;
                        }
                        this.state = olTileState.ERROR;
                        this.changed();
                    })
                ]
            }
        }

        unlisten() {
            this.listenerKeys.forEach((k) => {
                unlistenByKey(k);
            })
        }
    }
    return AvNavTile;
}

class AvNavLayerRenderer extends olCanvasTileLayerRenderer{
    constructor() {
        super(...arguments);
    }
    drawTileImage(tile, frameState, x, y, w, h, gutter, transition, opacity) {
        const image = this.getTileImage(tile);
        if (!image) {
            return;
        }
        const uid = getUid(this);
        const tileAlpha = transition ? tile.getAlpha(uid, frameState.time) : 1;
        const alpha = opacity * tileAlpha;
        const alphaChanged = alpha !== this.context.globalAlpha;
        if (alphaChanged) {
            this.context.save();
            this.context.globalAlpha = alpha;
        }
        let imageProps={
            x:0,
            y:0,
            w:image.width,
            h:image.height
        };
        if (tile.getImageProps){
          imageProps=tile.getImageProps();
        }
        this.context.drawImage(
            image,
            imageProps.x+gutter,
            imageProps.y+gutter,
            imageProps.w - 2 * gutter,
            imageProps.h - 2 * gutter,
            x,
            y,
            w,
            h
        );

        if (alphaChanged) {
            this.context.restore();
        }
        if (tileAlpha !== 1) {
            frameState.animate = true;
        } else if (transition) {
            tile.endTransition(uid);
        }
    }
}

export const CHARTAV= {
    ...CHARTBASE,
    OVERVIEW: "overviewUrl",
    SEQUENCEURL: "sequenceUrl",
    TOKENURL: "tokenUrl",
    TOKENFUNCTION: "tokenFunction",
    BASEURL:'baseUrl',
    LAYERS:"layers",
}
const mp=(obj,name,text,f)=>{
    if (! (name in obj)) throw new Error(`${text} missing parameter ${name}`)
    const v=obj[name];
    if (! f) return v;
    return f(v);
}
class LayerConfig{
    constructor() {
    }
    getLayerTypes(){
        throw new Error("getLayerType not implemented in base class");
    }
    async prepare(options){
        return true;
    }
    createOL(options){
        throw new Error("createOL not implemented in base class");
    }
    createTileUrlFunction(options){
        throw new Error("createTileUrlFunction not implemented in base class");
    }

    bboxToOlExtent(bbox){
        if (! bbox) return;
        const ext=[];
        ['minlon','minlat','maxlon','maxlat'].forEach((p)=>{
            ext.push(mp(bbox,p,"BoundingBox",parseFloat));
        })
        return olExtent.applyTransform(ext,olTransforms.get("EPSG:4326", "EPSG:3857"))
    }

}

/**
 *
 * @param coord {Array[number]} [z,x,y]
 * @param zoomLayerBoundings {Object||undefined}
 * @return {boolean}
 */
export const checkZoomBounds=(coord,zoomLayerBoundings)=>{
    if (! zoomLayerBoundings) return true;
    //return true;
    if (!zoomLayerBoundings[coord[0]]) return false;
    for (let zbounds of zoomLayerBoundings[coord [0]]) {
        if (zbounds.minx <= coord[1] && zbounds.maxx >= coord[1] &&
            zbounds.miny <= coord[2] && zbounds.maxy >= coord[2]) {
            return true;
        }
    }
    return false;
}

const convertBoundsForZoom=(boundsForZoom)=>{
    if (! boundsForZoom || boundsForZoom.zoom === undefined || ! boundsForZoom.boundingbox) return;
    const boxesOut=[];
    const boxesIn=Array.isArray(boundsForZoom.boundingbox)?boundsForZoom.boundingbox:[boundsForZoom.boundingbox];
    for (let bb of boxesIn){
        const bout={};
        for (let p of ['minx','miny','maxx','maxy']) {
            bout[p]=mp(bb,p,"zoomlayerboundingbox",parseInt);
        }
        boxesOut.push(bout);
    }
    return {[boundsForZoom.zoom]:boxesOut};
}
class LayerConfigXYZ extends LayerConfig{
    constructor({overviewUrl,upzoom}) {
        super();
        this.overviewUrl = overviewUrl;
        this.upzoom = upzoom; //coming from chartEntry if set there
        this.inversy=false;
        this.source=undefined;
        this.layer=undefined;
    }
    getLayerTypes(){
        return [undefined,'zxy-mercator','zxy']
    }
    buildLayerOptions(options){
        if (! options) throw new Error("missing layer properties");
        const layerOptions={
            zoomLayerBoundings: undefined,
            replaceInUrl:false,
            layerUrl:undefined,
            upzoom:this.upzoom
        }
        const url=options.url||options.href;
        if (! url) throw new Error("missing layer url");
        layerOptions.layerUrl=injectBaseUrl(url,this.overviewUrl);
        if (url.indexOf("{x}") >= 0 && url.indexOf("{y}") >= 0 && url.indexOf("{z}") >= 0) {
            layerOptions.replaceInUrl = true;
        }
        if (layerOptions.upzoom == undefined) {
            if (url.match(/^https*[:]/)) {
                layerOptions.upzoom = globalStore.getData(keys.properties.mapOnlineUpZoom);
            } else {
                layerOptions.upzoom = globalStore.getData(keys.properties.mapUpZoom);
            }
        }
        if (options.layerzoomboundings){
            const boundsIn=options.layerzoomboundings.zoomboundings||options.layerzoomboundings;
            if (! Array.isArray(boundsIn)){
                layerOptions.zoomLayerBoundings=convertBoundsForZoom(boundsIn);
            }
            else{
                const zoomLayerBoundings={};
                for (let bb of boundsIn){
                    Object.assign(zoomLayerBoundings,convertBoundsForZoom(bb));
                }
                if (Object.keys(zoomLayerBoundings).length > 0){
                    layerOptions.zoomLayerBoundings=zoomLayerBoundings;
                }
            }
        }
        return layerOptions;
    }
    createTileUrlFunction(options) {
        const layerOptions=this.buildLayerOptions(options);
        return (coord)=>{
            if (!coord) return undefined;
            if (options.minzoom != undefined && coord[0] < options.minzoom) return invalidUrl;
            if (options.maxzoom != undefined && coord[0] > options.maxzoom) return invalidUrl;
            if (! checkZoomBounds(coord,layerOptions.zoomLayerBoundings)) return invalidUrl;
            let z = coord[0];
            let x = coord[1];
            let y = coord[2];

            if (this.inversy) {
                y = (1 << z) - y - 1
            }
            if (!layerOptions.replaceInUrl) {
                let tileUrl = z + '/' + x + '/' + y + ".png";
                return Helper.endsWith(layerOptions.layerUrl,"/")?(layerOptions.layerUrl+tileUrl):(layerOptions.layerUrl + '/' + tileUrl);
            }
            else {
                return layerOptions.layerUrl.replace("{x}", x).replace("{y}", y).replace("{z}", z);
            }

        }
    }
    finalUrl(url) {
        return url;
    }

    createOL(options){
        if (! options) throw new Error("missing options for XYZ layer");
        const layerOptions=this.buildLayerOptions(options);
        const extent=this.bboxToOlExtent(options.boundingbox);
        const tileUrlFunction=this.createTileUrlFunction(options);
        this.source= new olXYZSource({
                tileUrlFunction: (coord) => {
                    return tileUrlFunction(coord);
                },
                tileLoadFunction: (imageTile,src) => {
                    imageTile.getImage().src=this.finalUrl(src);
                },
                tileSize: NORMAL_TILE_SIZE * globalStore.getData(keys.properties.mapScale, 1),
            })
        if (layerOptions.upzoom > 0) {
            this.source.tileClass = tileClassCreator((coord) => {
                    return tileUrlFunction(coord);
                },
                layerOptions.upzoom,
                this.inversy
            )
        }
        this.layer = new olTileLayer({
            source: this.source,
        });
        if (layerOptions.upzoom > 0) {
            this.layer.createRenderer = () => new AvNavLayerRenderer(this.layer);
        }
        setav(this.layer,{
            isTileLayer: true,
            minZoom: parseInt(options.minzoom||1),
            maxZoom: parseInt(options.maxzoom||23),
            extent:extent,
            zoomLayerBoundings: layerOptions.zoomLayerBoundings,
        });
        return this.layer;
    }

}
class LayerConfigTMS extends LayerConfigXYZ{
    constructor(options) {
        super(options);
        this.inversy = true;
    }

    getLayerTypes() {
        return ['global-mercator','tms'];
    }
}
class LayerConfigWMS extends LayerConfigXYZ{
    constructor(props) {
        super(props);
    }

    getLayerTypes() {
        return ['wms'];
    }

    createTileUrlFunction(options) {
        const layerOptions=this.buildLayerOptions(options);
        //use the URL object to easily create the URLs
        const baseUrl=new URL(layerOptions.layerUrl,window.location.href);
        const search=baseUrl.searchParams;
        search.set("SERVICE","WMS");
        search.set("REQUEST","GetMap");
        search.set("FORMAT","image/png");
        search.set("SRS",options.projection||"EPSG:4326");
        let wmsparameter=options.wmsparameter;
        if (wmsparameter){
            wmsparameter=Array.isArray(wmsparameter) ? wmsparameter : [wmsparameter];
            for (let p of wmsparameter){
                const n=mp(p,'name','wmsparameter');
                const v=mp(p,'value','wmsparameter');
                search.set(n,v);
            }
        }
        const layermap={};
        let layermappings=options.wmslayermapping;
        if (layermappings){
            layermappings=Array.isArray(layermappings) ? layermappings : [layermappings];
            for (let lm of layermappings){
                const zooms=mp(lm,'zooms','wmslayermappings');
                const layers=mp(lm,'layers','wmslayermappings');
                const zarr=zooms.split(/,/);
                for (let zoom of zarr){
                    layermap[zoom]=layers;
                }
            }
        }
        return (coord)=> {
            if (! checkZoomBounds(coord,layerOptions.zoomLayerBoundings)){
                return invalidUrl;
            }
            let z=coord[0];
            let x=coord[1];
            let y=coord[2];
            let grid = this.source.getTileGrid();
            //taken from tilegrid.js:
            //let origin = grid.getOrigin(z);
            //the xyz source seems to have a very strange origin - x at -... but y at +...
            //but we rely on the origin being ll
            //not sure if this is correct for all projections...
            let origin = [-20037508.342789244, -20037508.342789244]; //unfortunately the ol3 stuff does not export this...
            let resolution = grid.getResolution(z);
            let tileSize = grid.getTileSize(z);
            y = (1 << z) - y - 1;
            let minX = origin[0] + x * tileSize * resolution;
            let minY = origin[1] + y * tileSize * resolution;
            let maxX = minX + tileSize * resolution;
            let maxY = minY + tileSize * resolution;
            //now compute the bounding box
            let converter = olTransforms.get("EPSG:3857", options.projection || "EPSG:4326");
            let bbox = converter([minX, minY, maxX, maxY]);
            let rturl = new URL(baseUrl);
            rturl.searchParams.set("WIDTH",tileSize);
            rturl.searchParams.set("HEIGHT",tileSize);
            rturl.searchParams.set("BBOX",bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3]);
            const mlayers=layermap[z];
            if (mlayers){
                rturl.searchParams.set('LAYERS',mlayers);
            }
            return rturl.toString();
        }
    }
}

class LayerConfigEncrypt extends LayerConfigXYZ{
    constructor(props) {
        super(props);
        this.props=props;
        this.encryptFunction=undefined
    }
    getLayerTypes() {
        return ['encrypted-zxy','encrypted-zxy-mercator'];
    }
    async prepare(options) {
        if (this.props[CHARTAV.TOKENURL]) {
            const result = await CryptHandler.createOrActivateEncrypt(this.props[CHARTAV.NAME],
                this.props[CHARTAV.TOKENURL], this.props[CHARTAV.TOKENFUNCTION]);
            this.encryptFunction = result.encryptFunction;
        }
        return super.prepare(options);
    }

    createTileUrlFunction(options) {
        const layerOptions=this.buildLayerOptions(options);
        return (coord)=>{
            if (!coord) return undefined;
            if (! checkZoomBounds(coord,layerOptions.zoomLayerBoundings)) return invalidUrl;
            let z = coord[0];
            let x = coord[1];
            let y = coord[2];

            if (this.inversy) {
                y = (1 << z) - y - 1
            }
            let tileUrl = "##encrypt##"+ z + '/' + x + '/' + y + ".png";
            return Helper.endsWith(layerOptions.layerUrl,"/")?(layerOptions.layerUrl+tileUrl):(layerOptions.layerUrl + '/' + tileUrl)
        }
    }
    finalUrl(url) {
        let encryptPart = url.replace(/.*##encrypt##/, "");
        let basePart = url.replace(/##encrypt##.*/, "");
        if (! this.encryptFunction) {
            return basePart+encryptPart;
        }
        return basePart + this.encryptFunction(encryptPart);
    }

    createOL(options) {
        const rt=super.createOL(options);
        setav(rt,{
            finalUrl:(url)=>this.finalUrl(url)
        })
        return rt;
    }
}

class LayerFactory {
    constructor() {
        this.layerClasses={};
    }
    register(layerClass) {
        const keys=layerClass.getLayerTypes();
        for (let k of keys){
            if (this.layerClasses[k]) throw new Error("layer key "+k+" already exists");
            this.layerClasses[k]=(props)=> new layerClass.constructor(props);
        }
    }
    layerClass(type,props){
        const creator=this.layerClasses[type];
        if (! creator) return;
        return creator(props);
    }
}

export const layerFactory=new LayerFactory();
layerFactory.register(new LayerConfigXYZ({}));
layerFactory.register(new LayerConfigTMS({}));
layerFactory.register(new LayerConfigWMS({}));
layerFactory.register(new LayerConfigEncrypt({}));

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

    getOverviewUrl(){
        const overview=getUrlWithBase(this.chartEntry,CHARTAV.OVERVIEW);
        if (overview)return overview;
        const url=getUrlWithBase(this.chartEntry,CHARTAV.URL);
        if (!url) return;
        return url + "/avnav.xml";
    }
    hasValidConfig(){
        return !!this.chartEntry[CHARTAV.URL] ||
            !!this.chartEntry[CHARTAV.OVERVIEW] ||
            !!this.chartEntry[CHARTAV.LAYERS] ;
    }
    async prepareInternal() {
        let url = this.chartEntry[CHARTAV.URL]||this.chartEntry[CHARTAV.OVERVIEW];
        let layerConfig;
        let ovUrl;
        if (this.chartEntry[CHARTAV.LAYERS]) {
            if (url) throw new Error("either provide an url or a layers config for a chart");
            layerConfig=this.chartEntry[CHARTAV.LAYERS];
            ovUrl=this.chartEntry[CHARTAV.BASEURL]||window.location.href;
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
            rt[attr.name.toLowerCase()] = attr.value;
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
                throw new Error(`unable to create layer ${lnum} for profile ${type}`);
            }
            await layerCreator.prepare(layerConfig);
            const olLayer=layerCreator.createOL(layerConfig);
            setav(olLayer,{
                chartSource: this,
                isBase: this.isBaseChart()
            })
            ll.push(olLayer);
        }
        return ll.reverse();
    }


    async checkSequence(force) {
        //prevent from triggering a reload if we already have been destroyed
        let destroySequence = this.destroySequence;
        if ((!this.isReady() &&! force)|| destroySequence !== this.destroySequence) return false;
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
        if (this.destroySequence !== destroySequence) {
            return false;
        }
        if (newSequence !== this.chartEntry[CHARTAV.SEQ]) {
            base.log("Sequence changed from " + this.chartEntry[CHARTAV.SEQ] + " to " + newSequence + " reload map");
            this.chartEntry[CHARTAV.SEQ] = newSequence;
            return true;
        }
        return false;
    }

    destroy() {
        super.destroy();
        CryptHandler.removeChartEntry(this.getChartKey());
        this.destroySequence++;
    }


    getChartFeaturesAtPixel(pixel) {
        return new Promise((resolve,reject)=>{
            //if (! this.chartEntry.hasFeatureInfo) resolve([]);
            if (! this.isReady()) resolve([]);
            let mapcoordinates=this.mapholder.pixelToCoord(pixel);
            let lonlat=this.mapholder.transformFromMap(mapcoordinates);
            let offsetPoint=this.mapholder.pixelToCoord([pixel[0]+globalStore.getData(keys.properties.clickTolerance)/2,pixel[1]])
            let offsetLatlon=this.mapholder.transformFromMap(offsetPoint);
            let tolerance=Math.abs(offsetLatlon[0]-lonlat[0]);
            let layerActions=[];
            for (let i=this.layers.length-1;i>=0;i--){
                let layer=this.layers[i];
                if (! layer.getVisible()) continue;
                if (! getav(layer).isTileLayer) continue;
                let res=this.mapholder.getView().getResolution();
                let tile=layer.getSource().getTileGrid()
                    .getTileCoordForCoordAndResolution(mapcoordinates,res);
                let url=layer.getSource().getTileUrlFunction()(tile);
                let action=new Promise((aresolve,areject)=>{
                    const computeUrl=getav(layer).finalUrl;
                    let finalUrl=computeUrl?computeUrl(url):url;
                    Requests.getJson(finalUrl,{useNavUrl:false,noCache:false},{
                        featureInfo:1,
                        lat:lonlat[1],
                        lon:lonlat[0],
                        tolerance: tolerance
                    })
                        .then((result)=>{
                            if (result.data) {
                                aresolve([result.data])
                            }
                            else{
                                aresolve([]);
                            }
                        })
                        .catch((error)=>aresolve([])); //TODO
                });
                layerActions.push(action);
            }
            if (layerActions.length < 1) resolve([]);
            Promise.all(layerActions)
                .then((results)=>{
                    let topInfo;
                    for (let i=0;i<results.length;i++){
                        if (results[i].length > 0){
                            topInfo=results[i][0];
                            break;
                        }
                    }
                    if (topInfo) {
                        let info=new ChartFeatureInfo({
                            name: this.getChartKey(),
                            title:this.getName(),
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
                        resolve([info]);
                    }
                    else resolve([]);
                })
                .catch((error)=>reject(error));

        });
    }
}

export default  AvnavChartSource;