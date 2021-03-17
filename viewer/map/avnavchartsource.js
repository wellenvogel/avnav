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
import Helper from '../util/helper.js';
import ChartSourceBase from './chartsourcebase.js';
import * as olExtent from 'ol/extent';
import {XYZ as olXYZSource} from 'ol/source';
import * as olTransforms  from 'ol/proj/transforms';
import {Tile as olTileLayer} from 'ol/layer';
import {listenOnce,unlistenByKey} from 'ol/events';
import olEventType from 'ol/events/EventType';
import olImageTile from 'ol/src/ImageTile';
import olTileState from 'ol/src/TileState';
import assign from 'object-assign';
import olCanvasTileLayerRenderer from 'ol/renderer/canvas/TileLayer';
import {getUid} from "ol/util";

const NORMAL_TILE_SIZE=256;

//we use a bit a dirty hack here:
//ol3 nicely shows a lower zoom if the tile cannot be loaded (i.e. has an error)
//to avoid server round trips, we use a local image url
//the more forward way would be to return undefined - but in this case
//ol will NOT show the lower zoom tiles...
const invalidUrl = 'data:image/png;base64,i';
/**
 * compute the tile url
 * @param layerOptions the avnavOptions from the layer
 * @param coord
 * @returns {string|undefined|*}
 */
const layerUrlFunction=function (layerOptions,coord) {
    if (!coord) return undefined;
    let zxy = coord;
    let z = zxy[0];
    let x = zxy[1];
    let y = zxy[2];
    //y = -y - 1; //revert change back for ol6...change for ol3-151 - commit af319c259b349c86a4d164c42cc4eb5884f896fb

    if (layerOptions.zoomLayerBoundings) {
        let found = false;
        if (!layerOptions.zoomLayerBoundings[z]) return invalidUrl;
        for (let bindex in layerOptions.zoomLayerBoundings[z]) {
            let zbounds = layerOptions.zoomLayerBoundings[z][bindex];
            if (zbounds.minx <= x && zbounds.maxx >= x && zbounds.miny <= y && zbounds.maxy >= y) {
                found = true;
                break;
            }
        }
        if (!found) {
            return invalidUrl;
        }
    }
    if (layerOptions.wms) {
        //construct the WMS url
        let grid = layerOptions.source.getTileGrid();
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
        let converter = olTransforms.get("EPSG:3857", layerOptions.projection || "EPSG:4326");
        let bbox = converter([minX, minY, maxX, maxY]);
        let rturl = layerOptions.layerurl + "SERVICE=WMS&REQUEST=GetMap&FORMAT=image/png&WIDTH=" + tileSize + "&HEIGHT=" + tileSize + "&SRS=" + encodeURI(layerOptions.projection);
        let k;
        let layers;
        if (layerOptions.wmslayermap[z]) layers = layerOptions.wmslayermap[z];
        for (k in layerOptions.wmsparam) {
            let v = layerOptions.wmsparam[k];
            if (layers && (k == "LAYERS" || k == "layers")) {
                v = layers;
            }
            rturl += "&" + k + "=" + v;
        }
        rturl += "&BBOX=" + bbox[0] + "," + bbox[1] + "," + bbox[2] + "," + bbox[3];
        return rturl;
    }
    if (layerOptions.inversy) {
        y = (1 << z) - y - 1
    }
    if (!layerOptions.replaceInUrl) {
        let tileUrl = z + '/' + x + '/' + y + ".png";
        if (layerOptions.encryptFunction) {
            tileUrl = "##encrypt##" + tileUrl;
        }
        return Helper.endsWith(layerOptions.layerurl,"/")?(layerOptions.layerurl+tileUrl):(layerOptions.layerurl + '/' + tileUrl);
    }
    else {
        return layerOptions.layerurl.replace("{x}", x).replace("{y}", y).replace("{z}", z);
    }
}
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
                                ", "+this.tileCoord.join(","));
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

class AvnavChartSource extends ChartSourceBase{
    constructor(mapholer, chartEntry) {
        super(mapholer,chartEntry);
        this.destroySequence=0;
    }

    prepareInternal() {
        let url = this.chartEntry.url;
        let upZoom=0;
        if (this.chartEntry.upzoom !== undefined && this.chartEntry.upzoom !== null && ! this.chartEntry.upzoom) {

        }
        else{
            if (url.match(/^https*[:]/)){
                upZoom=globalStore.getData(keys.properties.mapOnlineUpZoom);
            }
            else{
                upZoom=globalStore.getData(keys.properties.mapUpZoom);
            }
        }
        return new Promise((resolve, reject)=> {
            if (!url) {
                reject("no map url for "+(this.chartEntry.name||this.chartEntry.chartKey));
                return;
            }
            let xmlUrl = url + "/avnav.xml";
            Requests.getHtmlOrText(xmlUrl, {
                useNavUrl: false,
                timeout: parseInt(globalStore.getData(keys.properties.chartQueryTimeout || 10000))
            })
                .then((data)=> {
                    let layers = this.parseLayerlist(data, url,upZoom);
                    resolve(layers);
                })
                .catch((error)=> {
                    reject("unable to load map: " + error);
                })
        });
    }



    /**
     * parse a float attribute value
     * @param elem
     * @param {String} attr
     * @private
     */
    e2f(elem, attr) {
        return parseFloat(elem.getAttribute(attr));
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
;
    parseLayerlist(layerdata, baseurl,upZoom) {
        let self = this;
        let chartKey = baseurl;
        let ll = [];
        let xmlDoc = Helper.parseXml(layerdata);
        Array.from(xmlDoc.getElementsByTagName('TileMap')).forEach(function (tm) {
            let rt = {};
            rt.encryptFunction=self.encryptFunction;
            //complete tile map entry here
            rt.inversy = false;
            rt.wms = false;
            let layer_profile = tm.getAttribute('profile');
            if (layer_profile) {
                if (layer_profile != 'global-mercator' && layer_profile != 'zxy-mercator' && layer_profile != 'wms') {
                    throw new Error('unsupported profile in tilemap.xml ' + layer_profile);
                }
                if (layer_profile == 'global-mercator') {
                    //our very old style stuff where we had y=0 at lower left
                    rt.inversy = true;
                }
                if (layer_profile == 'wms') {
                    rt.wms = true;
                }
            }
            rt.url = tm.getAttribute('href');
            rt.title = tm.getAttribute('title');
            rt.minZoom = parseInt(tm.getAttribute('minzoom'));
            rt.maxZoom = parseInt(tm.getAttribute('maxzoom'));
            rt.projection = tm.getAttribute('projection'); //currently only for WMS
            //we store the layer region in EPSG:4326
            Array.from(tm.childNodes).forEach(function (bb) {
                if (bb.tagName != 'BoundingBox') return;
                rt.layerExtent = [self.e2f(bb, 'minlon'), self.e2f(bb, 'minlat'),
                    self.e2f(bb, 'maxlon'), self.e2f(bb, 'maxlat')];
            });
            //TODO: do wen need the origin stuff?
            /*
             $(tm).find(">Origin").each(function(nr,or){
             rt.tile_origin = new OpenLayers.LonLat(e2f(or,'x'),e2f(or,'y'));
             });
             if (! rt.tile_origin){
             rt.tile_origin=new OpenLayers.LonLat(-20037508.343,-20037508.343);
             }
             */
            //TODO: any non standard form tiles? - not for now
            /*
             $(tm).find(">TileFormat").each(function(nr,tf){
             rt.tile_size= new OpenLayers.Size(
             parseInt($(tf).attr('width')),
             parseInt($(tf).attr('height')));
             rt.tile_ext=$(tf).attr('extension');
             rt.zOffset=parseInt($(tf).attr('zOffset'));
             });
             if (!rt.tile_size) rt.tile_size=new OpenLayers.Size(256,256);
             if (!rt.tile_ext)rt.tile_ext="png";
             */
            //although we currently do not need the boundings
            //we just parse them...
            let boundings = [];
            Array.from(tm.getElementsByTagName("LayerBoundings")).forEach((lb)=> {
                Array.from(lb.getElementsByTagName("BoundingBox")).forEach((bb)=> {
                    let bounds = [self.e2f(bb, 'minlon'), self.e2f(bb, 'maxlat'),
                        self.e2f(bb, 'maxlon'), self.e2f(bb, 'minlat')];
                    boundings.push(bounds);
                });
            });
            rt.boundings = boundings;

            let zoomLayerBoundings = [];
            Array.from(tm.getElementsByTagName("LayerZoomBoundings")).forEach((lzb)=> {
                Array.from(lzb.getElementsByTagName("ZoomBoundings")).forEach((zb)=> {
                    let zoom = parseInt(zb.getAttribute('zoom'));
                    let zoomBoundings = [];
                    Array.from(zb.getElementsByTagName("BoundingBox")).forEach((bb)=> {
                        let bounds = {
                            minx: parseInt(bb.getAttribute('minx')),
                            miny: parseInt(bb.getAttribute('miny')),
                            maxx: parseInt(bb.getAttribute('maxx')),
                            maxy: parseInt(bb.getAttribute('maxy'))
                        };
                        zoomBoundings.push(bounds);
                    });
                    if (zoomBoundings.length) {
                        zoomLayerBoundings[zoom] = zoomBoundings;
                    }
                });
            });
            if (zoomLayerBoundings.length) {
                rt.zoomLayerBoundings = zoomLayerBoundings;
            }

            //now we have all our options - just create the layer from them
            let layerurl = "";
            if (rt.url === undefined) {
                throw new Error("missing href in layer");//scale: 3
            }
            if (!rt.url.match(/^https*:/)) {
                layerurl = baseurl + "/" + rt.url;
            }
            else layerurl = rt.url;
            rt.layerurl=layerurl;
            rt.replaceInUrl = false;
            if (layerurl.indexOf("{x}") >= 0 && layerurl.indexOf("{y}") >= 0 && layerurl.indexOf("{z}") >= 0) {
                rt.replaceInUrl = true;
            }
            rt.extent = olExtent.applyTransform(rt.layerExtent, self.mapholder.transformToMap);
            if (rt.wms) {
                let param = {};
                Array.from(tm.getElementsByTagName("WMSParameter")).forEach((wp)=> {
                    let n = wp.getAttribute('name');
                    let v = wp.getAttribute('value');
                    if (n !== undefined && v !== undefined) {
                        param[n] = v;
                    }
                });
                rt.wmsparam = param;
                let layermap = {};
                Array.from(tm.getElementsByTagName("WMSLayerMapping")).forEach((mapping)=> {
                    let zooms = mapping.getAttribute('zooms');
                    let layers = mapping.getAttribute('layers');
                    let zarr = zooms.split(/,/);
                    let i;
                    for (i in zarr) {
                        try {
                            let zlevel = parseInt(zarr[i]);
                            layermap[zlevel] = layers;
                        } catch (ex) {
                        }
                    }
                });
                rt.wmslayermap = layermap;

            }
            let source = undefined;
            //as WMS support is broken in OL3 (as always ol3 tries to be more intelligent than everybody...)
            //we always use an XYZ layer but directly construct the WMS tiles...
            source = new olXYZSource({
                tileUrlFunction:(coord)=>{
                    return layerUrlFunction(rt,coord);
                } ,
                extent: rt.extent,
                tileLoadFunction: function (imageTile, src) {
                    imageTile.getImage().src=self.encryptUrl(src);
                },
                tileSize: NORMAL_TILE_SIZE*globalStore.getData(keys.properties.mapScale,1),

                /*
                 url:layerurl+'/{z}/{x}/{y}.png'
                 */
            });
            if (upZoom > 0) {
                source.tileClass = tileClassCreator((coord) => {
                    return layerUrlFunction(rt, coord);
                },
                    upZoom,
                    rt.inversy
                )
            }
            rt.source = source;
            let layerOptions={
                source: source
            };
            let extent=rt.extent;
            if (self.chartEntry.opacity !== undefined) layerOptions.opacity=parseFloat(self.chartEntry.opacity);
            let layer = new olTileLayer(layerOptions);
            if (upZoom > 0) {
                layer.createRenderer = () => new AvNavLayerRenderer(layer);
            }
            rt.isTileLayer=true;
            layer.avnavOptions = rt;
            ll.push(layer);
        });
        //our avnav.xml has the layers in inverse order
        //maybe we should better sort based on zoomlevelboundings
        return ll.reverse();
    }


    checkSequence() {
        let self=this;
        //prevent from triggering a reload if we already have been destroyed
        let destroySequence=this.destroySequence;
        return new Promise((resolve,reject)=>{
            if (! self.isReady() || destroySequence !== this.destroySequence) resolve(0);
            let url = this.chartEntry.url + "/sequence?_="+(new Date()).getTime();
            //set noCache to false to avoid pragma in header (CORS...)
            Requests.getJson(url, {useNavUrl: false,noCache:false})
                .then((data)=> {
                    if (!data.sequence || this.destroySequence !== destroySequence) {
                        resolve(0);
                        return;
                    }
                    if (data.sequence !== self.chartEntry.sequence) {
                        base.log("Sequence changed from "+self.chartEntry.sequence+" to "+data.sequence+" reload map");
                        self.chartEntry.sequence=data.sequence;
                        resolve(1);
                        return;
                    }
                    resolve(0);
                })
                .catch((error)=> {
                    reject(error);
                });
        });
    }

    destroy() {
        super.destroy();
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
                if (! layer.avnavOptions) continue;
                if (! layer.avnavOptions.isTileLayer) continue;
                let res=this.mapholder.getView().getResolution();
                let zoom=Math.round(this.mapholder.getView().getZoom());
                let tile=layer.getSource().getTileGrid()
                    .getTileCoordForCoordAndResolution(mapcoordinates,res);
                let url=layerUrlFunction(layer.avnavOptions,tile);
                let action=new Promise((aresolve,areject)=>{
                    let finalUrl=this.encryptUrl(url);
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
                        let info=assign({},topInfo,{
                            overlayType:'chart',
                            chartKey: this.getChartKey(),
                            source: this,
                            overlayName:this.chartEntry.name,
                            coordinates: lonlat},
                            topInfo
                        );
                        resolve([info]);
                    }
                    else resolve([]);
                })
                .catch((error)=>reject(error));

        });
    }
}

export default  AvnavChartSource;