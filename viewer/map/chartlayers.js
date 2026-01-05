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
import * as olExtent from 'ol/extent';
import {XYZ as olXYZSource} from 'ol/source';
import * as olTransforms  from 'ol/proj/transforms';
import {Tile as olTileLayer} from 'ol/layer';
import {Source as olSource} from 'ol/source';
import MapLibreLayer from "./maplibre/MapLibreLayer";
import {Point as olPoint} from 'ol/geom';
import {injectBaseUrl} from "../util/itemFunctions";
import globalStore from '../util/globalstore.jsx';
import keys from "../util/keys";
import {listenOnce,unlistenByKey} from 'ol/events';
import olEventType from 'ol/events/EventType';
import olTile from 'ol/Tile';
import olTileState from 'ol/TileState';
import olCanvasTileLayerRenderer from 'ol/renderer/canvas/TileLayer';
import {getUid} from "ol/util";
import base from "../base";
import Helper, {setav} from "../util/helper";
import {CHARTBASE} from "./chartsourcebase";
import CryptHandler from './crypthandler';
import {ChartFeatureInfo} from "./featureInfo";
import {featureListFormatter} from "../util/featureFormatter";
import {ApiV2, getFeatureInfoKeys} from "../util/api.impl";
import navobjects from "../nav/navobjects";
const NORMAL_TILE_SIZE=256;
const mp=(obj,name,text,f)=>{
    if (! (name in obj)) throw new Error(`${text} missing parameter ${name}`)
    const v=obj[name];
    if (! f) return v;
    return f(v);
}

//we use a bit a dirty hack here:
//ol3 nicely shows a lower zoom if the tile cannot be loaded (i.e. has an error)
//to avoid server round trips, we use a local image url
//the more forward way would be to return undefined - but in this case
//ol will NOT show the lower zoom tiles...
const invalidUrl = 'data:image/png;base64,i';
const tileClassCreator=(tileUrlFunction,maxUpZoom,minZoom,inversy)=>
{
    class AvNavTile extends olTile {
        constructor(tileCoord,
                    state,
                    src,
                    crossOrigin,
                    tileLoadFunction,
                    opt_options) {
            super(tileCoord,state,opt_options);
            this.ownImage = new Image();
            this.ownTileLoadFunction = tileLoadFunction;
            this.ownSrc = src;
            this.key=src;
            this.listenerKeys = [];
            this.tileUrlFunction=tileUrlFunction;
            this.downZoom=0;
            this.crossOrigin=crossOrigin;
            this.minZoom=minZoom;
            if (this.crossOrigin !== null) this.ownImage.crossOrigin = this.crossOrigin;
        }

        getModifiedUrl(){
            let coord=this.tileCoord.slice(0);
            let dz=0;
            while (this.downZoom <= maxUpZoom) {
                for (; dz < this.downZoom; dz++) {
                    coord[0] = coord[0] - 1;
                    if (coord[0] < this.minZoom){
                        this.downZoom =maxUpZoom +1;
                        return invalidUrl;
                    }
                    coord[1] = Math.floor(coord[1] / 2);
                    coord[2] = Math.floor(coord[2] / 2);
                }
                const url=this.tileUrlFunction(coord);
                if (url !== invalidUrl) return url;
                this.downZoom++;
            }
            return invalidUrl;
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
                if (this.crossOrigin !== null) this.ownImage.crossOrigin = this.crossOrigin;
            }
            if (this.state === olTileState.IDLE || this.downZoom > 0) {
                this.state = olTileState.LOADING;
                if (! this.downZoom) this.changed();
                this.ownTileLoadFunction(this, this.getModifiedUrl());
                this.listenerKeys = [
                    listenOnce(this.ownImage, olEventType.LOAD, (ev) => {
                        if (this.ownImage.naturalWidth && this.ownImage.naturalHeight) {
                            if (this.downZoom > 0){
                                base.log("downzoom loaded, dz="+this.downZoom+" for "+this.tileCoord.join(',')+
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
    drawTile(tile, frameState, x, y, w, h, gutter, transition) {
        const image = this.getTileImage(tile);
        if (!image) {
            return;
        }
        const uid = getUid(this);
        const layerState = frameState.layerStatesArray[frameState.layerIndex];
        const tileAlpha = transition ? tile.getAlpha(uid, frameState.time) : 1;
        const alpha = layerState.opacity * tileAlpha;
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
    featureListToInfo(allFeatures,pixel,layer,source){
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

    createOL(options) {
        if (!options) throw new Error("missing options for XYZ layer");
        const layerOptions = this.buildLayerOptions(options);
        const extent = this.bboxToOlExtent(options.boundingbox);
        const tileUrlFunction = this.createTileUrlFunction(options);
        this.source = new olXYZSource({
            tileUrlFunction: (coord) => {
                return tileUrlFunction(coord);
            },
            tileLoadFunction: (imageTile, src) => {
                imageTile.getImage().src = this.finalUrl(src);
            },
            tileSize: NORMAL_TILE_SIZE * globalStore.getData(keys.properties.mapScale, 1),
        })
        this.source.tileClass = tileClassCreator((coord) => {
                return tileUrlFunction(coord);
            },
            layerOptions.upzoom,
            options.minzoom||1,
            this.inversy
        )
        this.layer = new olTileLayer({
            source: this.source,
        });
        this.layer.createRenderer = () => new AvNavLayerRenderer(this.layer);
        setav(this.layer, {
            isTileLayer: true,
            minZoom: parseInt(options.minzoom || 1),
            maxZoom: parseInt(options.maxzoom || 23) + layerOptions.upzoom,
            extent: extent,
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


const buildHtmlInfo=(allFeatures)=>{
    let rt='<div class="featureInfoListHtml">\n';
    allFeatures.forEach(feature=>{
        if (! feature)return;
            rt+='<div class="featureInfoHtml">\n';
            for (let k in feature){
                if (k.startsWith('_')) continue;
                rt+=`<div class="featureAttr">${k}:${feature[k]}</div>\n`;
            }
            rt+='</div>\n';
    })
    rt+='</div>\n';
    return rt;
}
const defaulMLFeatureListFormatter=(features,point)=>{
        let userInfo={};
        if (features.length > 0) {
            userInfo={...features[0]};
        }
        userInfo.htmlInfo=buildHtmlInfo(features);
        if (userInfo._lat != undefined && userInfo._lon != undefined){
            userInfo.position={lat:userInfo._lat,lon:userInfo._lon};
        }
        return userInfo;
}

class LayerConfigMapLibreVector extends LayerConfigXYZ {
    constructor(props) {
        super(props);
        this.featureListFormatter = undefined;
        this.baseUrl=undefined;
        if (props.baseUrl) {
            this.baseUrl=new URL(props.baseUrl,window.location.href);
        }
    }

    getLayerTypes() {
        return ["maplibreVector", "maplibre"];
    }

    createOL(options) {
        this.featureListFormatter = featureListFormatter[options.featurelistformatter]||defaulMLFeatureListFormatter;
        const layerOptions = this.buildLayerOptions({url: options.styleUrl, ...options});
        const extent = this.bboxToOlExtent(options.boundingbox);
        const mapLibreOptions = {
            style: layerOptions.layerUrl
        }
        if (options.useproxy) {
            const base=this.baseUrl||window.location;
            mapLibreOptions.transformRequest = (url, resourceType) => {
                const completeUrl = new URL(url, base);
                if (completeUrl.origin === base.origin) {
                    //unchanged
                    return {
                        url: completeUrl.toString(),
                    }
                }
                return {
                    url: (new URL("/proxy/" + encodeURIComponent(url), base)).toString()
                }
            }
        }
        this.layer = new MapLibreLayer({
            source: new olSource({
                attributions: () => {
                    return "dummy MapLibre";
                },
            }),
            mapLibreOptions: mapLibreOptions
        })
        setav(this.layer, {
            isTileLayer: true,
            minZoom: parseInt(options.minzoom || 1),
            maxZoom: parseInt(options.maxzoom || 23) + layerOptions.upzoom,
            extent: extent,
            zoomLayerBoundings: layerOptions.zoomLayerBoundings,
        });
        return this.layer;
    }

    //really very basic right now and focused on freenautricalcharts
    //most probably this needs to go to a separate formatter
    featureListToInfo(allFeatures, pixel, layer, source) {
        if (!this.featureListFormatter) return;
        const featureList = []; //the list for an external formatter
        const clickCoord = source.mapholder.pixelToCoord(pixel);
        const result = [];
        allFeatures.forEach(featureConfig => {
            const feature = featureConfig.feature;
            if (!feature) return;
            try {
                const fc = {...feature.getProperties()};
                for (let k in fc) {
                    if (typeof fc[k] !== 'string' && typeof fc[k] !== 'number') {
                        delete fc[k];
                    }
                }
                const geo = feature.getGeometry();
                const type = geo.getType().toLowerCase();
                fc._gtype = type;
                let point;
                if (geo instanceof olPoint) {
                    point = source.mapholder.fromMapToPoint(geo.getCoordinates());
                } else {
                    if (geo) {
                        point = source.mapholder.fromMapToPoint(geo.getClosestPoint(clickCoord));
                    }
                }
                if (point) {
                    fc._lat = point.lat;
                    fc._lon = point.lon;
                }
                featureList.push(fc);
            } catch (e) {
                base.log("unable to translate feature: " + e);
            }
        })
        let formattedFeatures = this.featureListFormatter(featureList,
            source.mapholder.fromMapToPoint(source.mapholder.pixelToCoord(pixel)));
        if (!formattedFeatures) return;
        if (!Array.isArray(formattedFeatures)) formattedFeatures = [formattedFeatures];
        if (formattedFeatures.length < 1) return;
        formattedFeatures.forEach(formatted => {
            let rt = new ChartFeatureInfo({
                title: source.getName(),
                name: source.getChartKey(),
                overlaySource: source,
                isOverlay: !source.isBaseChart()
            });
            const userInfo = {};
            for (let k of getFeatureInfoKeys()) {
                const v = formatted[k];
                if (v != undefined) {
                    userInfo[k] = v;
                }
            }
            rt.userInfo = userInfo;
            if (userInfo.position){
                rt.point=new navobjects.Point();
                rt.point.fromPlain(userInfo.position);
            }
            else{
                rt.point=source.mapholder.fromMapToPoint(clickCoord);
            }
            result.push(rt);
        });
        return result;
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
layerFactory.register(new LayerConfigMapLibreVector({}));
