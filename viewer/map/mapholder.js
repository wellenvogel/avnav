/**
 * Created by andreas on 03.05.14.
 */


import navobjects from '../nav/navobjects';
import AisLayer from './aislayer';
import NavLayer from './navlayer';
import TrackLayer from './tracklayer';
import RouteLayer from './routelayer';
import {Drawing,DrawingPositionConverter} from './drawing';
import Formatter from '../util/formatter';
import keys,{KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import Requests from '../util/requests.js';
import base from '../base.js';
import northImage from '../images/nadel_mit.png';
import KeyHandler from '../util/keyhandler.js';
import assign from 'object-assign';
import AvNavChartSource from './avnavchartsource.js';
import GpxChartSource from './gpxchartsource.js';
import CryptHandler from './crypthandler.js';
import {Map as olMap,View as olView,
    Feature as olFeature,
    } from 'ol';
import * as olExtent from 'ol/extent';
import * as olCoordinate from 'ol/coordinate';
import * as olInteraction from 'ol/interaction';
import {Polygon as olPolygonGemotery, Point as olPointGeometry} from 'ol/geom';
import {Vector as olVectorSource, XYZ as olXYZSource} from 'ol/source';
import {Vector as olVectorLayer} from 'ol/layer';
import {GeoJSON as olGeoJSONFormat} from 'ol/format';
import {Style as olStyle,Circle as olCircle, Stroke as olStroke, Text as olText, Icon as olIcon, Fill as olFill} from 'ol/style';
import * as olTransforms  from 'ol/proj/transforms';
import OverlayConfig from "./overlayconfig";
import Helper from "../util/helper";
import KmlChartSource from "./kmlchartsource";
import GeoJsonChartSource from "./geojsonchartsource";
import pepjsdispatcher from '@openlayers/pepjs/src/dispatcher';
import pepjstouch from '@openlayers/pepjs/src/touch';
import pepjsmouse from '@openlayers/pepjs/src/mouse';
import remotechannel, {COMMANDS} from "../util/remotechannel";
import {MouseWheelZoom} from "ol/interaction";


const PSTOPIC="mapevent";

class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}


const EventTypes={
    SELECTAIS:1,
    SELECTWP: 2,
    RELOAD: 3,
    LOAD: 4,
    FEATURE: 5
};


/**
 * the holder for our olmap
 * the holer remains alive all the time whereas the map could be recreated on demand
 * @constructor
 */
const MapHolder=function(){

    DrawingPositionConverter.call(this);
    /** @private
     * @type {Map}
     * */
    this.olmap=null;

    
    this.defaultDiv=document.createElement('div');
    
    /**
     * locked to GPS
     * @type {boolean}
     * @private
     */
    this.gpsLocked=false;

    /**
     * course up display
     * @type {boolean}
     */
    this.courseUp=false;

    /**
     * average course for course up
     * in degrees
     * @type {number}
     */
    this.averageCourse=0;
    this.transformFromMap=olTransforms.get("EPSG:3857","EPSG:4326");
    this.transformToMap=olTransforms.get("EPSG:4326","EPSG:3857");

    this.aislayer=new AisLayer(this);
    this.navlayer=new NavLayer(this);
    this.tracklayer=new TrackLayer(this);
    this.routinglayer=new RouteLayer(this);
    this.minzoom=32;
    this.mapMinZoom=32; //for checking in autozoom - differs from minzoom if the baselayer is active
    this.maxzoom=0;
    this.center=[0,0];
    this.zoom=-1;
    this.requiredZoom=-1;
    this.forceZoom=false; //temporarily overwrite autozoom
    this.mapZoom=-1; //the last zoom we required from the map
    try {
        let currentView = localStorage.getItem(globalStore.getData(keys.properties.centerName));
        if (currentView) {
            let decoded = JSON.parse(currentView);
            this.center = decoded.center;
            this.zoom = decoded.zoom;
            this.requiredZoom=decoded.requiredZoom || this.zoom;
        }
    }catch (e){}

    this.slideIn=0; //when set we step by step zoom in
    /**
     * @private
     * @type {Drawing}
     */
    this.drawing=new Drawing(this,globalStore.getData(keys.properties.style.useHdpi,false));

    this.northImage=new Image();
    this.northImage.src=northImage;
    /**
     * is the routing display visible? (no AIS selection...)
     * @private
     * @type {boolean}
     */
    this.routingActive=false;

    this.compassOffset=0;

    this.needsRedraw=false;

    let self=this;
    let storeKeys=KeyHelper.flattenedKeys(keys.nav.gps).concat(
        KeyHelper.flattenedKeys(keys.nav.center),
        KeyHelper.flattenedKeys(keys.nav.wp),
        KeyHelper.flattenedKeys(keys.nav.anchor),
        KeyHelper.flattenedKeys(keys.nav.track)
    );
    this.navChanged=new Callback(()=>{
        self.navEvent();
    });
    this.propertyChange=new Callback(()=>{
        self.drawing.setUseHdpi(globalStore.getData(keys.properties.style.useHdpi,false));
        self.needsRedraw=true;
    });
    this.editMode=new Callback(()=>{
        let isEditing=globalStore.getData(keys.gui.global.layoutEditing);
        if (isEditing){
            self.setCourseUp(false);
            self.setGpsLock(false);
        }
    });
    globalStore.register(this.navChanged,storeKeys);
    globalStore.register(this.propertyChange,keys.gui.global.propertySequence);
    globalStore.register(this.editMode,keys.gui.global.layoutEditing);

    globalStore.register(()=>{
        this.updateSize();
    },keys.gui.global.windowDimensions);

    /**
     *
     * @type {ChartSourceBase}
     * @private
     */
    this._baseChart=undefined;
    /**
     * the list of currently active sources (index 0: base, othe: overlays)
     * @type {Array}
     * @private
     */
    this.sources=[];
    /**
     * @private
     * @type {OverlayConfig}
     */
    this.overlayConfig=new OverlayConfig();

    /**
     * a map with the name as key and override parameters
     * @type {OverlayConfig}
     */
    this.overlayOverrides=this.overlayConfig.copy();

    /**
     * last div used in loadMap
     * @type {undefined}
     * @private
     */
    this._lastMapDiv=undefined;
    /**
     * last sequence query time
     * @type {undefined}
     * @private
     */
    this._lastSequenceQuery=0;


    globalStore.storeData(keys.map.courseUp,this.courseUp);
    globalStore.storeData(keys.map.lockPosition,this.gpsLocked);
    this.timer=undefined;
    KeyHandler.registerHandler(()=>{self.changeZoom(+1)},"map","zoomIn");
    KeyHandler.registerHandler(()=>{self.changeZoom(-1)},"map","zoomOut");
    KeyHandler.registerHandler(()=>{self.setGpsLock(true)},"map","lockGps");
    KeyHandler.registerHandler(()=>{self.setGpsLock(false)},"map","unlockGps");
    KeyHandler.registerHandler(()=>{self.setGpsLock(!self.getGpsLock())},"map","toggleGps");
    KeyHandler.registerHandler(()=>{self.moveCenterPercent(-10,0)},"map","left");
    KeyHandler.registerHandler(()=>{self.moveCenterPercent(10,0)},"map","right");
    KeyHandler.registerHandler(()=>{self.moveCenterPercent(0,-10)},"map","up");
    KeyHandler.registerHandler(()=>{self.moveCenterPercent(0,10)},"map","down");
    KeyHandler.registerHandler(()=>{self.setCourseUp(!self.getCourseUp())},"map","toggleCourseUp");
    KeyHandler.registerHandler(()=>{self.centerToGps()},"map","centerToGps");

    this.remoteChannel=remotechannel;
    this.remoteChannel.subscribe(COMMANDS.setChart,(chartmsg)=>{
        try{
            let entry=JSON.parse(chartmsg);
            this.setChartEntry(entry,true);
        }catch (e){
            base.log("unable to decode chartEntry");
        }
    })
    this.remoteChannel.subscribe(COMMANDS.setCenter,(msg)=>{
        if (this.isInUserActionGuard()) return;
        try{
            let center=new navobjects.Point();
            center.fromPlain(JSON.parse(msg));
            this.setCenter(center,true);
        }catch (e){}
    })
    this.remoteChannel.subscribe(COMMANDS.setZoom,(msg)=>{
        if (this.isInUserActionGuard()) return;
        try{
            let nz=parseFloat(msg);
            let diff=nz-this.requiredZoom;
            this.changeZoom(diff,false,true);
        }catch (e){}
    })
    this.remoteChannel.subscribe(COMMANDS.courseUp,(msg)=>{
        if (this.isInUserActionGuard()) return;
        try{
            this.setCourseUp(msg === 'true',true);
        }catch (e){}
    })
    this.remoteChannel.subscribe(COMMANDS.lock,(msg)=>{
        if (this.isInUserActionGuard()) return;
        try{
            this.setGpsLock(msg === 'true',true);
        }catch (e){}
    })
    /**
     * registered guards will be called back on some handled map events (click,dblclick) with the event type
     * this call is synchronous
     * @private
     * @type {*[]}
     */
    this.eventGuards=[];
    this.mapEventSubscriptionId=0;
    /**
     * list of subscriptions
     * @private
     * @type {{}}
     */
    this.mapEventSubscriptions={};

    /**
     * pepjs polyfill handling for converting touch events to pointer events
     * we need to handle this somehow by our own
     * @type {undefined}
     */
    this.evDispatcher=undefined;
    /**
     * timestamp of the last user action that we detected
     * will be used to guard the remote control stuff
     * only send out map move/center within guard time
     * do not accept remote actions during guard time
     * @type {number}
     */
    this.lastUserAction=0;
    /**
     * the boat position on the display in percent
     * @type {{x: number, y: number}}
     */
    this.boatOffset={
        x:50,
        y:50
    }
};

base.inherits(MapHolder,DrawingPositionConverter);

MapHolder.prototype.EventTypes=EventTypes;

/**
 * register for map events
 * @param callback a callback function, will be called with data and topic
 *        data is {type:EventTypes,...}
 *        return true if the event has been consumed
 * @returns {number} a token to be used for unsubscribe
 */
MapHolder.prototype.subscribe=function(callback){
    for (let k in this.mapEventSubscriptions){
        if (this.mapEventSubscriptions[k] === callback) return k;
    }
    let id=this.mapEventSubscriptionId++;
    this.mapEventSubscriptions[id]=callback;
    return id;
};

MapHolder.prototype._callHandlers=function(eventData){
    for (let k in this.mapEventSubscriptions){
        let rt=this.mapEventSubscriptions[k](eventData);
        if (rt) return rt;
    }
    return false;
}
/**
 * deregister from map events
 * @param token - the value obtained from register
 */
MapHolder.prototype.unsubscribe=function(token){
    if (token === undefined) return;
    delete this.mapEventSubscriptions[token];
};
/**
 * @inheritDoc
 * @param {Coordinate} point
 * @returns {Coordinate}
 */
MapHolder.prototype.coordToPixel=function(point){
    return this.olmap.getPixelFromCoordinate(point);
};
/**
 * @inheritDoc
 * @param {Coordinate} pixel
 * @returns {Coordinate}
 */
MapHolder.prototype.pixelToCoord=function(pixel){
    return this.olmap.getCoordinateFromPixel(pixel);
};


/**
 * get the 2Dv view
 * @returns {View}
 */

MapHolder.prototype.getView=function(){
    if (!this.olmap)return null;
    let mview=this.olmap.getView();
    return mview;
};
/**
 * get the current map zoom level
 * @returns {number|Number|*}
 */
MapHolder.prototype.getZoom=function(){
    let v=this.olmap?this.olmap.getView():undefined;
    if (! v ) return {required:this.requiredZoom,current: this.zoom};
    return {required:this.requiredZoom,current: v.getZoom()};
};

MapHolder.prototype.userAction=function(){
    this.lastUserAction=(new Date()).getTime();
}
MapHolder.prototype.isInUserActionGuard=function(){
    let now=(new Date()).getTime();
    return now <= (this.lastUserAction + globalStore.getData(keys.properties.remoteGuardTime,2)*1000);
}
/**
 * render the map to a new div
 * @param div if null - render to a default div (i.e. invisible)
 */
MapHolder.prototype.renderTo=function(div){
    if (this.timer && ! div){
        window.clearInterval(this.timer);
        this.timer=undefined;
        this._lastMapDiv=undefined;
    }
    if (! this.olmap) return;
    let mapDiv=div||this.defaultDiv;
    this.olmap.setTarget(mapDiv);
    this._lastMapDiv=div;
    let self=this;
    if (! this.timer && div){
        this.timer=window.setInterval(()=>{self.timerFunction()},1000)
    }
    if (div){
        if (! window.PointerEvent) {
            let viewport = document.querySelectorAll('.ol-viewport')[0];
            if (viewport) {
                if (!this.evDispatcher) {
                    this.evDispatcher = pepjsdispatcher;
                    if ('ontouchstart' in window) {
                        this.evDispatcher.registerSource('touch', pepjstouch);
                    }
                    else{
                        this.evDispatcher.registerSource('mouse',pepjsmouse);
                    }
                }
                if (!viewport.hasAttribute('touch-action')) {
                    viewport.setAttribute('touch-action', 'none');
                }
                base.log("register map in pepjs");
                this.evDispatcher.register(document.querySelectorAll('.map')[0]);
            }
        }
        let baseVisible=globalStore.getData(keys.properties.layers.base,false);
        this.olmap.getLayers().forEach((layer)=>{
            if (layer.avnavOptions && layer.avnavOptions.isBase){
                layer.setVisible(baseVisible);
            }
        })
    }
    else{
        if (this.evDispatcher){
            let oldMap=document.querySelectorAll('.map')[0];
            if (oldMap) {
                base.log("unregister map in pepjs");
                this.evDispatcher.unregister(oldMap);
            }
        }
    }
    this.updateSize();
};



MapHolder.prototype.setChartEntry=function(entry,opt_noRemote){
    //set the new base chart
    this._baseChart=this.createChartSource(assign({},entry,{type:'chart',enabled:true,baseChart:true}));
    try{
        localStorage.setItem(globalStore.getData(keys.properties.chartDataName),this._baseChart.getChartKey());
    }catch(e){}
    if (! opt_noRemote){
        try {
            this.remoteChannel.sendMessage(COMMANDS.setChart + " " + JSON.stringify(entry));
        }catch(e){}
    }
};

MapHolder.prototype.getLastChartKey=function (){
    let rt;
    try{
        rt=localStorage.getItem(globalStore.getData(keys.properties.chartDataName));
        return rt;
    }catch (e){}
}


MapHolder.prototype.prepareSourcesAndCreate=function(newSources){
    return new Promise((resolve,reject)=> {
        for (let k in this.sources) {
            this.sources[k].destroy();
        }
        if (newSources) {
            this.sources = newSources;
        }
        CryptHandler.resetHartbeats();
        if (this.sources.length < 1) {
            reject("no sources");
        }
        let readyCount = 0;
        //now trigger all prepares
        for (let k in this.sources) {
            this.sources[k].prepare()
                .then(()=> {
                    //check if all are ready now...
                    readyCount++;
                    let ready = true;
                    for (let idx in this.sources) {
                        if (!this.sources[idx].isReady()) {
                            ready = false;
                            break;
                        }
                    }
                    if (ready) {
                        this.updateOverlayConfig();
                        this.initMap();
                        resolve(1);
                    }
                    else {
                        if (readyCount >= this.sources.length) {
                            reject("internal error: not all sources are ready");
                        }
                    }
                })
                .catch((error)=> {
                    reject(error)
                });
        }
    });
};
/**
 *
 * @param description an object containing:
 *      type: chart || overlay
 *      type: chart:
 *          chartKey
 *          chart: (type chart only) the final chart description
 *      type overlay:
 *          url (mandatory)
 *          other parameter depending on source
 *
 * @returns {*}
 */

MapHolder.prototype.createChartSource=function(description){
    if (description.type=='chart'){
        return new AvNavChartSource(this,description);
    }
    if (! description.url){
        throw Error("missing url for overlay");
    }
    if (description.url.match(/\.gpx$/)){
        return new GpxChartSource(this,description);
    }
    if (description.url.match(/\.kml$/)){
        return new KmlChartSource(this,description);
    }
    if (description.url.match(/\.geojson$/)){
        return new GeoJsonChartSource(this,description);
    }
    throw Error("unsupported overlay: "+description.url)


};

MapHolder.prototype.getBaseChart=function(){
    if (! this.sources || this.sources.length < 1) return;
    for (let i=0;i<this.sources.length;i++){
        if (this.sources[i].getConfig().baseChart){
            return this.sources[i];
        }
    }
}
MapHolder.prototype.loadMap=function(div){
   if (div) this._lastMapDiv=div;
    let self=this;
    return new Promise((resolve,reject)=> {
        let url=this._baseChart.getConfig().url;
        if (!url) {
            reject("no map selected");
            return;
        }
        let chartSource=this._baseChart;
        if (! chartSource){
            reject("chart not set");
        }
        let oldBase=this.getBaseChart();
        let resetOverrides=false;
        if (this.sources.length < 1 ||
            (oldBase && oldBase.getChartKey() !== chartSource.getChartKey() )){
            //new chart - forget all local overlay overrides
            resetOverrides=true;
        }
        let prepareAndCreate=(newSources)=>{
            this.prepareSourcesAndCreate(newSources)
                .then((res)=>{
                    self.updateOverlayConfig(); //update all sources with existing config
                    this._callHandlers({type:this.EventTypes.RELOAD});
                    resolve(res)
                })
                .catch((error)=>{reject(error)});
        };
        let checkChanges=()=>{
            if (this.needsRedraw){
                this.needsRedraw=false;
                prepareAndCreate(newSources);
                return;
            }
            if (this.sources.length !== newSources.length ){
                prepareAndCreate(newSources);
                return;
            }
            for (let i=0;i<this.sources.length;i++){
                if (!this.sources[i].isEqual(newSources[i])){
                    prepareAndCreate(newSources);
                    return;
                }
            }
            this.renderTo(this._lastMapDiv);
            this._callHandlers({type:this.EventTypes.LOAD});
            resolve(0);
        };
        let newSources=[];
        if (! globalStore.getData(keys.gui.capabilities.uploadOverlays)){
            this.overlayConfig=new OverlayConfig();
            this.overlayOverrides=this.overlayConfig.copy();
            newSources.push(chartSource);
            checkChanges();
            return;
        }
        let cfgParam = {
            request: 'api',
            type: 'chart',
            overlayConfig: chartSource.getOverlayConfigName(),
            command: 'getConfig',
            expandCharts: true,
            mergeDefault: true
        };
        Requests.getJson("", {}, cfgParam)
            .then((config)=> {
                config = config.data;
                if (! config){
                    this.overlayConfig=new OverlayConfig();
                    if (resetOverrides) this.overlayOverrides=this.overlayConfig.copy();
                    checkChanges();
                    return;
                }
                this.overlayConfig=new OverlayConfig(config);
                if (resetOverrides){
                    this.overlayOverrides=this.overlayConfig.copy();
                }
                else{
                    let newOverrides=this.overlayConfig.copy();
                    newOverrides.mergeOverrides(this.overlayOverrides);
                    this.overlayOverrides=newOverrides;
                }
                let overlays=this.overlayConfig.getOverlayList();
                overlays.forEach((overlay)=>{
                    if (overlay.type === 'base'){
                        newSources.push(chartSource);
                        return;
                    }
                    let overlaySource = this.createChartSource(overlay);
                    if (overlaySource) newSources.push(overlaySource);
                });
                checkChanges();
            })
            .catch((error)=> {
                reject("unable to query overlays:"+error);
            })

    });

};
MapHolder.prototype.getCurrentMergedOverlayConfig=function(){
    let rt=this.overlayConfig.copy();
    rt.mergeOverrides(this.overlayOverrides);
    return rt;
};
MapHolder.prototype.updateOverlayConfig=function(newOverrides){
    if (newOverrides) {
        this.overlayOverrides=this.overlayConfig.copy();
        this.overlayOverrides.mergeOverrides(newOverrides);
    }
    let merged=this.getCurrentMergedOverlayConfig();
    for (let i=0;i<this.sources.length;i++){
        let source=this.sources[i];
        let currentConfig=source.getConfig();
        let newConfig=assign({},currentConfig,merged.getCurrentItemConfig(currentConfig));
        if (newConfig){
            source.setVisible(newConfig.enabled === undefined || newConfig.enabled);
        }
        else{
            source.resetVisible();
        }
    }
};

MapHolder.prototype.resetOverlayConfig=function(){
    this.overlayOverrides=this.overlayConfig.copy();
    this.updateOverlayConfig();
};

MapHolder.prototype.setEnabled=function(chartSource,enabled,opt_update){
    if (! chartSource) return;
    let changed=this.overlayOverrides.setEnabled(chartSource.getConfig(),enabled);
    if (changed && opt_update) this.updateOverlayConfig();
}

MapHolder.prototype.getBaseLayer=function(visible){
    var styles = {
        'MultiPolygon': new olStyle({
            stroke: new olStroke({
                color: 'blue',
                width: 1
            }),
            fill: new olFill({
                color: 'rgba(0, 0, 255, 0.1)'
            })
        }),
        'Polygon': new olStyle({
            stroke: new olStroke({
                color: 'blue',
                width: 1
            }),
            fill: new olFill({
                color: 'rgba(0, 0, 255, 0.1)'
            })
        })
    };

    var styleFunction = function(feature) {
        return styles[feature.getGeometry().getType()];
    };
    var vectorSource = new olVectorSource({
        format: new olGeoJSONFormat(),
        url: 'countries-110m.json',
        wrapX: false
    });

    var vectorLayer = new olVectorLayer({
        source: vectorSource,
        style: styleFunction,
        visible:visible
    });
    vectorLayer.avnavOptions={isBase:true};
    return vectorLayer;

};


MapHolder.prototype.getMapOutlineLayer = function (layers,visible) {
    let style = new olStyle({
        stroke: new olStroke({
            color: 'red',
            width: 2
        })
    });

    let source = new olVectorSource({
        wrapX: false
    });
    if (layers && layers.length > 0) {
        let extent = olExtent.createEmpty();
        layers.forEach((layer)=> {
            if (layer.avnavOptions && layer.avnavOptions.extent) {
                let e = layer.avnavOptions.extent;
                extent = olExtent.extend(extent, e);
            }
        });
        let feature = new olFeature(new olPolygonGemotery([
            [
                olExtent.getBottomLeft(extent),
                olExtent.getBottomRight(extent),
                olExtent.getTopRight(extent),
                olExtent.getTopLeft(extent)

            ]
        ]));
        feature.setStyle(style);
        source.addFeature(feature);
    }
    let vectorLayer= new olVectorLayer({
        source: source,
        visible: visible
    });
    vectorLayer.avnavOptions={isBase:true};
    return vectorLayer;
};

/**
 * init the map (deinit an old one...)
 */

MapHolder.prototype.initMap=function(){
    let div=this._lastMapDiv;
    let self=this;
    let layers=[];
    let baseLayers=[];
    this.minzoom=32;
    this.mapMinZoom=this.minzoom;
    this.maxzoom=0;
    for (let i=0;i<this.sources.length;i++){
        let sourceLayers=this.sources[i].getLayers();
        sourceLayers.forEach((layer)=> {
            if (this.sources[i].getConfig().baseChart && layer.avnavOptions) {
                if (layer.avnavOptions.minZoom < this.minzoom){
                    this.minzoom=layer.avnavOptions.minZoom;
                }
                if (layer.avnavOptions.maxZoom > this.maxzoom){
                    this.maxzoom=layer.avnavOptions.maxZoom;
                }
                baseLayers.push(layer);
            }
            layers.push(layer);
        });
    }
    let avnavRenderLayer=new olVectorLayer({
        source: new olVectorSource({
            features: [new olFeature(new olPointGeometry([0,0]))]
        }),
        style: new olStyle({
            image: new olCircle({
                radius: 0.6  //we need to set > 0 to avoid errors on small zoom levels
                             //Failed to execute 'drawImage' on 'CanvasRenderingContext2D': The image argument is a canvas element with a width or height of 0
            })
        }),
        renderBuffer: Infinity,
        zIndex: Infinity
    });
    layers.push(avnavRenderLayer);
    this.mapMinZoom=this.minzoom;
    let hasBaseLayers=globalStore.getData(keys.properties.layers.base,true);
    if (hasBaseLayers) {
        this.minzoom = 2;
    }
    if (this.olmap) {
        let oldlayers = this.olmap.getLayers();
        if (oldlayers && oldlayers.getArray().length) {
            let olarray = [];
            //make a copy of the layerlist
            //as the original array is modified when deleting...
            let olarray_in = oldlayers.getArray();
            olarray = olarray_in.slice(0);
            for (let i = 0; i < olarray.length; i++) {
                this.olmap.removeLayer(olarray[i]);
            }
        }
        this.olmap.addLayer(this.getBaseLayer(hasBaseLayers));
        if (baseLayers.length > 0) {
            this.olmap.addLayer(this.getMapOutlineLayer(baseLayers, hasBaseLayers))
        }
        for (let i = 0; i < layers.length; i++) {
            this.olmap.addLayer(layers[i]);
        }
        this.renderTo(div);
    }
    else {
        let base = [];
        base.push(this.getBaseLayer(hasBaseLayers));
        if (baseLayers.length > 0) {
            base.push(this.getMapOutlineLayer(baseLayers, hasBaseLayers))
        }
        let pixelRatio=undefined;
        try{
            if (document.body.style.transform === undefined){
                console.log("browser has no transform feature, keeping pixelRatio at 1");
                pixelRatio=1;
            }
        }catch (e){
            console.log("unable to detect transform feature");
        }
        let interactions=olInteraction.defaults({
            altShiftDragRotate: false,
            pinchRotate: false,
            mouseWheelZoom: false
        });
        interactions.push(new MouseWheelZoom({
           condition: (ev)=>{
               this.userAction();
               return true;
           }
        }));
        this.olmap = new olMap({
            pixelRatio: pixelRatio,
            target: div ? div : self.defaultDiv,
            layers: base.concat(layers),
            interactions: interactions,
            controls: [],
            view: new olView({
                center: this.transformToMap([13.8, 54.1]),
                zoom: 9,
                extent: this.transformToMap([-200, -89, 200, 89])
            })

        });
        this.olmap.on('moveend',function(evt){
           return self.onMoveEnd(evt);
        });
        this.olmap.on('postrender',function(evt){
            //more or less similar top ol2 move
            return self.onMoveEnd(evt);
        });
        this.olmap.on('click', function(evt) {
            self._callGuards('click');
            self.userAction();
            return self.onClick(evt);
        });
        this.olmap.on('dblclick', function(evt) {
            self.userAction();
            self._callGuards('dblclick');
            return self.onDoubleClick(evt);
        });
        this.olmap.on('pointerdrag',()=>self.userAction());
        this.olmap.on('pointermove',()=>self.userAction());
        this.olmap.on('singleclick',()=>self.userAction());
        this.olmap.getView().on('change:resolution',function(evt){
            return self.onZoomChange(evt);
        });
    }
    if (layers.length >0){
        layers[layers.length-1].on('postrender',function(evt){
            return self.onPostCompose(evt);
        });
    }
    this.renderTo(div);
    let recenter=true;
    let view;
    if (this.requiredZoom < 0) this.requiredZoom=this.minzoom;
    if (this.zoom < 0) this.zoom=this.minzoom;
    if (this.requiredZoom) this.zoom=this.requiredZoom;
    if (this.center && this.zoom >0){
        //if we load a new map - try to restore old center and zoom
        view=this.getView();
        view.setCenter(this.pointToMap(this.center));
        if (this.zoom < this.minzoom) this.zoom=this.minzoom;
        if (this.zoom > (this.maxzoom + globalStore.getData(keys.properties.maxUpscale)))
            this.zoom=this.maxzoom+globalStore.getData(keys.properties.maxUpscale);
        let slideLevels=0;
        if (globalStore.getData(keys.properties.mapUpZoom) < globalStore.getData(keys.properties.slideLevels)){
            //TODO: pick the right maxUpZoom depending on the chart
            //but should be good enough as online maps should have all levels
            slideLevels=globalStore.getData(keys.properties.slideLevels)-globalStore.getData(keys.properties.mapUpZoom);
        }
        if (slideLevels > 0) {
            if (this.zoom >= (this.minzoom + slideLevels)) {
                this.zoom -= slideLevels;
                this.doSlide(slideLevels);
            }
        }
        this.requiredZoom=this.zoom;
        this.setZoom(this.zoom);
        recenter=false;
        let lext=undefined;
        if (baseLayers.length > 0) {
            lext=baseLayers[0].avnavOptions.extent;
            if (lext !== undefined && !olExtent.containsCoordinate(lext, this.pointToMap(this.center))) {
                if (baseLayers.length > 0) {
                    let view = self.getView();
                    lext = baseLayers[0].avnavOptions.extent;
                    if (lext !== undefined) view.fit(lext, self.olmap.getSize());
                    self.setZoom(self.minzoom);
                    self.center = self.pointFromMap(view.getCenter());
                    self.zoom = view.getZoom();


                }
                self.saveCenter();
                let newCenter = self.pointFromMap(self.getView().getCenter());
                self.setCenterFromMove(newCenter, true);
            }
        }
    }
    if (recenter) {
        if (baseLayers.length > 0) {
            view = this.getView();
            let lextx=baseLayers[0].avnavOptions.extent;
            if (lextx !== undefined) view.fit(lextx,self.olmap.getSize());
            this.setZoom(this.minzoom);
            this.center=this.pointFromMap(view.getCenter());
            this.zoom=view.getZoom();

        }
    }
    this.saveCenter();
    let newCenter= this.pointFromMap(this.getView().getCenter());
    this.setCenterFromMove(newCenter,true);
    if (! globalStore.getData(keys.properties.layers.boat) ) this.gpsLocked=false;
    globalStore.storeData(keys.map.lockPosition,this.gpsLocked);
};

MapHolder.prototype.timerFunction=function(){
    let xzoom=this.getZoom();
    globalStore.storeMultiple(xzoom,{
        required:keys.map.requiredZoom,
        current:keys.map.currentZoom
    });
    let self=this;
    let now=(new Date()).getTime();
    if (this._lastSequenceQuery < (now - globalStore.getData(keys.properties.mapSequenceTime,5000))){
        this._lastSequenceQuery=now;
        if (this.sources.length > 0 && this._lastMapDiv) {
            for (let k in this.sources){
                this.sources[k].checkSequence()
                    .then((res)=>{
                        if (res){
                            self.prepareSourcesAndCreate(undefined);
                        }
                    })
                    .catch((error)=>{})
            }
        }
    }
}

/**
 * increase/decrease the map zoom
 * @param number
 */
MapHolder.prototype.changeZoom=function(number,opt_force,opt_noUserAction){
    if (! opt_noUserAction) this.userAction();
    let curzoom=this.requiredZoom; //this.getView().getZoom();
    curzoom+=number;
    if (curzoom < this.minzoom ) curzoom=this.minzoom;
    if (curzoom > (this.maxzoom+globalStore.getData(keys.properties.maxUpscale)) ) {
        curzoom=this.maxzoom+globalStore.getData(keys.properties.maxUpscale);
    }
    this.requiredZoom=curzoom;
    this.forceZoom=opt_force||false;
    this.setZoom(curzoom);
    this.checkAutoZoom();
    this.timerFunction();
};
/**
 * set the zoom at the map and remember the zoom we required
 * @private
 * @param newZoom
 * @param opt_noRemo
 */
MapHolder.prototype.setZoom=function(newZoom){
    if (! this.olmap) return;
    this.mapZoom=newZoom;
    if (this.olmap.getView().getZoom() != newZoom) {
        base.log("set new zoom " + newZoom);
        this.olmap.getView().setZoom(newZoom);
    }
};
/**
 * draw the grid
 * @private
 */
MapHolder.prototype.drawGrid=function() {
    if (!globalStore.getData(keys.properties.layers.grid)) return;
    if (!this.olmap) return;
    let style = {
        width: 1,
        color: 'grey'
    };
    let ctx = this.drawing.getContext();
    if (!ctx) return;
    let pw=ctx.canvas.width;
    let ph=ctx.canvas.height;
    //TODO: css pixel?
    let ul = this.pointFromMap(this.olmap.getCoordinateFromPixel([0, 0]));
    let ur = this.pointFromMap(this.olmap.getCoordinateFromPixel([pw, 0]));
    let ll = this.pointFromMap(this.olmap.getCoordinateFromPixel([0, ph]));
    let lr = this.pointFromMap(this.olmap.getCoordinateFromPixel([pw, ph]));
    let xrange=[Math.min(ul[0],ur[0],ll[0],lr[0]),Math.max(ul[0],ur[0],ll[0],lr[0])];
    let yrange=[Math.min(ul[1],ur[1],ll[1],lr[1]),Math.max(ul[1],ur[1],ll[1],lr[1])];
    let xdiff=xrange[1]-xrange[0];
    let ydiff=yrange[1]-yrange[0];
    let raster= 5/60; //we draw in 5' raster
    if (xdiff/raster > pw/60 ) return; //at most every 50px
    if (ydiff/raster > ph/60 ) return; //at most every 50px
    let drawText=this.drawing.getRotation()?false:true;
    let textStyle={
        color: 'grey',
        fontSize: 12,
        fontBase: 'Calibri,sans-serif',
        offsetY:7, //should compute this from the font...
        fixY:0
    };
    for(let x=Math.floor(xrange[0]);x<=xrange[1];x+=raster){
        this.drawing.drawLineToContext([this.pointToMap([x,yrange[0]]),this.pointToMap([x,yrange[1]])],style);
        if (drawText) {
            let text = Formatter.formatLonLatsDecimal(x, 'lon');
            this.drawing.drawTextToContext(this.pointToMap([x, yrange[0]]), text, textStyle);
        }
    }
    textStyle.offsetY=-7;
    textStyle.offsetX=30; //should compute from font...
    textStyle.fixY=undefined;
    textStyle.fixX=0;
    for (let y=Math.floor(yrange[0]);y <= yrange[1];y+=raster){
        this.drawing.drawLineToContext([this.pointToMap([xrange[0],y]),this.pointToMap([xrange[1],y])],style);
        if (drawText) {
            let text = Formatter.formatLonLatsDecimal(y, 'lat');
            this.drawing.drawTextToContext(this.pointToMap([xrange[0], y]), text, textStyle);
        }
    }

};
/**
 * draw the north marker
 * @private
 */
MapHolder.prototype.drawNorth=function() {
    if (!globalStore.getData(keys.properties.layers.compass)) return;
    if (!this.olmap) return;
    this.drawing.drawImageToContext([0,0],this.northImage, {
        fixX: 45, //this.drawing.getContext().canvas.width-120,
        fixY: 45+this.compassOffset, //this.drawing.getContext().canvas.height-120,
        rotateWithView: true,
        size: [80,80],
        anchor: [40,40],
        backgroundCircle: '#333333',
        backgroundAlpha: 0.25
    });
};



/**
 * get the mode of the course up display
 * @returns {boolean}
 */
MapHolder.prototype.getCourseUp=function(){
    return this.courseUp;
};

/**
 * map locked to GPS
 * @returns {boolean}
 */
MapHolder.prototype.getGpsLock=function(){
    return this.gpsLocked;
};

MapHolder.prototype.getBoatOffset=function(){
    return this.boatOffset;
}
MapHolder.prototype.setBoatOffset=function(point){
    if (! point){
        this.boatOffset={
            x:50,
            y:50
        }
        return true;
    }
    let pix=this.olmap.getPixelFromCoordinate(this.pointToMap([point.lon,point.lat]));
    let mapSize=this.olmap.getSize();
    if (pix && mapSize && mapSize[0] > 0 && mapSize[1] > 0){
        if (pix[0] < 0 || pix[0] > mapSize[0]) return;
        if (pix[1] < 0 || pix[1] > mapSize[1]) return;
        let x=pix[0]*100/mapSize[0];
        if (x < 1 ) x=1;
        if (x>99) x=99;
        let y=pix[1]*100/mapSize[1];
        if (y < 1 ) y=1;
        if (y>99) y=99;
        this.boatOffset={
            x:x,
            y:y
        }
        return true;
    }
}
/**
 * called with updates from nav
 *
 */
MapHolder.prototype.navEvent = function () {

    let gps = globalStore.getMultiple(keys.nav.gps);
    if (!gps.valid) return;
    if (this.gpsLocked) {
        if (this.courseUp) {
            let diff = (gps.course - this.averageCourse);
            let tol = globalStore.getData(keys.properties.courseAverageTolerance);
            if (diff < tol && diff > -tol) diff = diff / 30; //slower rotate the map
            this.averageCourse += diff * globalStore.getData(keys.properties.courseAverageFactor);
            this.setMapRotation(this.averageCourse);
        }
        this.setCenter(gps,true,this.getBoatOffset());
    }
    this.checkAutoZoom();
    if (this.olmap) this.olmap.render();

};

MapHolder.prototype.centerToGps=function(){
    if (! globalStore.getData(keys.nav.gps.valid)) return;
    let gps=globalStore.getData(keys.nav.gps.position);
    this.setCenter(gps);
};

MapHolder.prototype.checkAutoZoom=function(opt_force){
    let enabled= globalStore.getData(keys.properties.autoZoom)||opt_force;
    if (this.forceZoom) enabled=false;
    if (! this.olmap) return;
    if (! enabled ||  !(this.gpsLocked||opt_force)) {
        if (this.olmap.getView().getZoom() != this.requiredZoom){
            this.setZoom(this.requiredZoom);
        }
        return;
    }
    if (this.slideIn) {
        return;
    }
    //check if we have tiles available for this zoom
    //otherwise change zoom but leave required as it is
    let centerCoord=this.olmap.getView().getCenter();
    let hasZoomInfo=false;
    let zoomOk=false;
    let tzoom=2;
    for (tzoom=Math.floor(this.requiredZoom);tzoom >= this.mapMinZoom;tzoom--){
        zoomOk=false;
        let layers=this.olmap.getLayers().getArray();
        for (let i=0;i<layers.length && ! zoomOk;i++){
            let layer=layers[i];
            if (! layer.avnavOptions || ! layer.avnavOptions.zoomLayerBoundings) continue;
            let source=layer.get('source');
            if (!source || ! (source instanceof olXYZSource)) continue;
            hasZoomInfo=true;
            let boundings=layer.avnavOptions.zoomLayerBoundings;
            let centerTile=source.getTileGrid().getTileCoordForCoordAndZ(centerCoord,tzoom);
            let z = centerTile[0];
            let x = centerTile[1];
            let y = centerTile[2];
            y=-y-1; //we still have the old counting...
            //TODO: have a common function for this and the tileUrlFunction
            if (!boundings[z]) continue; //nothing at this zoom level
            for (let bindex in boundings[z]) {
                let zbounds = boundings[z][bindex];
                if (zbounds.minx <= x && zbounds.maxx >= x && zbounds.miny <= y && zbounds.maxy >= y) {
                    zoomOk = true;
                    break;
                }
            }
        }
        if (zoomOk){
            if (tzoom != Math.floor(this.olmap.getView().getZoom())) {
                base.log("autozoom change to "+tzoom);
                if (opt_force) this.requiredZoom=tzoom;
                this.setZoom(tzoom); //should set our zoom in the post render
            }
            else{
                if (opt_force && (tzoom != this.requiredZoom)){
                    this.requiredZoom=tzoom;
                }
            }
            break;
        }
    }
    if (! zoomOk && hasZoomInfo && (this.minzoom == this.mapMinZoom)){
        //if we land here, we are down to the min zoom of the map
        //we only set this, if we do not have a base layer
        let nzoom=tzoom+1;
        if (nzoom > this.requiredZoom) nzoom=this.requiredZoom;
        if (nzoom != this.olmap.getView().getZoom) {
            base.log("autozoom change to " + tzoom);
            if (opt_force) this.requiredZoom=nzoom;
            this.setZoom(nzoom);
        }
    }
    if (! hasZoomInfo){
        //hmm - no zoominfo - better go back to the required zoom
        this.setZoom(this.requiredZoom);
    }
};


/**
 * transforms a point from EPSG:4326 to map projection
 * @param {olCoordinate} point
 * @returns {Array.<number>|*}
 */
MapHolder.prototype.pointToMap=function(point){
    return this.transformToMap(point);
};

/**
 * convert a point from map projection to EPSG:4326
 * @param {olCoordinate} point
 * @returns {Array.<number>|*}
 */
MapHolder.prototype.pointFromMap=function(point){
    return this.transformFromMap(point);
};

/**
 * set the map center
 * @param {navobjects.Point} point
 * @param opt_noUserAction
 * @param opt_offset
 */
MapHolder.prototype.setCenter=function(point,opt_noUserAction,opt_offset){
    if (! point) return;
    if (! opt_noUserAction) this.userAction();
    if (this.gpsLocked){
        let p=navobjects.WayPoint.fromPlain(point);
        globalStore.storeData(keys.map.centerPosition,p);
    }
    if (! this.getView()) return;
    let coordinates=this.pointToMap([point.lon,point.lat]);
    let pixel=this.coordToPixel(coordinates);
    let mapSize=this.olmap.getSize();
    if (! opt_offset) {
        this.getView().setCenter(coordinates);
    }
    else{
        if (mapSize != null && (opt_offset.x !== 50 || opt_offset.y !== 50)){
            let tpixel=[mapSize[0]*opt_offset.x/100,mapSize[1]*opt_offset.y/100];
            this.getView().centerOn(coordinates,mapSize,tpixel);
        }
        else {
            this.getView().setCenter(coordinates);
        }
    }
};

/**
 * get the current center in lat/lon
 * @returns {navobjects.Point}
 */
MapHolder.prototype.getCenter=function(){
    let rt=new navobjects.Point();
    rt.fromCoord(this.pointFromMap(this.getView().getCenter()));
    return rt;
};
/**
 * get the distance in css pixel for 2 points
 * @param {navobjects.Point}point1
 * @param {navobjects.Point}point2
 */
MapHolder.prototype.pixelDistance=function(point1,point2){
    if (! this.olmap) return 0;
    let coord1=this.pointToMap(point1.toCoord());
    let coord2=this.pointToMap(point2.toCoord());
    let pixel1=this.coordToPixel(coord1);
    let pixel2=this.coordToPixel(coord2);
    let dx=pixel1[0]-pixel2[0];
    let dy=pixel1[1]-pixel2[1];
    let dst=Math.sqrt(dy*dy+dx*dx);
    return dst;
};


/**
 * set the map rotation
 * @param {number} rotation in degrees
 */
MapHolder.prototype.setMapRotation=function(rotation){
    this.getView().setRotation(rotation==0?0:(360-rotation)*Math.PI/180);
    if (this.gpsLocked){
        let boat=globalStore.getData(keys.map.centerPosition);
        if (boat) {
            this.setCenter(boat,true,this.getBoatOffset());
        }
    }
};

MapHolder.prototype.moveCenterPercent=function(deltax,deltay){
    if (! this.olmap) return;
    let center= this.olmap.getView().getCenter();
    let centerPix=this.coordToPixel(center); //[x,y]
    if (!centerPix) return;
    let size=this.olmap.getSize(); //[width,height]
    if (!size) return;
    let deltaxPix=size[0]*deltax/100;
    let deltayPix=size[1]*deltay/100;
    this.olmap.getView().setCenter(this.pixelToCoord([centerPix[0]+deltaxPix,centerPix[1]+deltayPix]));
};

/**
 * set the course up display mode
 * @param on
 * @param opt_noRemote
 * @returns {boolean} the newl set value
 */
MapHolder.prototype.setCourseUp=function(on,opt_noRemote){
    if (! opt_noRemote){
        remotechannel.sendMessage(COMMANDS.courseUp,on?'true':'false');
    }
    let old=this.courseUp;
    if (old === on) return on;
    if (on){
        let gps=globalStore.getMultiple(keys.nav.gps);
        if (! gps.valid) return false;
        this.averageCourse=gps.course;
        this.setMapRotation(this.averageCourse);
        this.courseUp=on;
        globalStore.storeData(keys.map.courseUp,on);
        return on;
    }
    else{
        this.courseUp=on;
        globalStore.storeData(keys.map.courseUp,on);
        this.setMapRotation(0);

    }
};

MapHolder.prototype.setGpsLock=function(lock,opt_noRemote){
    if (! opt_noRemote){
        remotechannel.sendMessage(COMMANDS.lock,lock?'true':'false');
    }
    if (lock === this.gpsLocked) return;
    if (lock) globalStore.storeData(keys.map.measurePosition,undefined);
    if (! globalStore.getData(keys.nav.gps.valid) && lock) return;
    //we do not lock if the nav layer is not visible
    if (! globalStore.getData(keys.properties.layers.boat) && lock) return;
    this.gpsLocked=lock;
    globalStore.storeData(keys.map.lockPosition,lock);
    if (lock) this.setCenter(globalStore.getData(keys.nav.gps.position),opt_noRemote,this.getBoatOffset());
    this.checkAutoZoom();
};

/**
 * click event handler
 * @param {MapBrowserEvent} evt
 */
MapHolder.prototype.onClick=function(evt){
    evt.preventDefault();
    evt.stopPropagation();
    let wp=this.routinglayer.findTarget(evt.pixel);
    if (wp){
        let rt=this._callHandlers({type:this.EventTypes.SELECTWP,wp:wp});
        if (rt) return false;
    }
    let aisparam=this.aislayer.findTarget(evt.pixel);
    if (aisparam) {
        let rt=this._callHandlers({type:EventTypes.SELECTAIS,aisparam:aisparam});
        if (rt) return false;
    }
    if (! globalStore.getData(keys.properties.featureInfo,true)) return true;
    //if we have a route point we will treat this as a feature info if not handled directly
    if (wp){
        let feature = {
            coordinates: [wp.lon, wp.lat]
        }
        let routeName=wp.routeName;
        if (routeName) {
            if (Helper.getExt(routeName) !== 'gpx') routeName += ".gpx";
            assign(feature,{
                overlayType: 'route',
                overlayName: routeName,
                activeRoute: true,
                nextTarget: [wp.lon, wp.lat],
                name: wp.name
            });
        }
        else{
            assign(feature,{
                overlayType: 'target',
                overlayName: 'current target',
                name: wp.name
            })
        }
        if (this._callHandlers({type:EventTypes.FEATURE,feature:feature})) return false;
    }
    let currentTrackPoint=this.tracklayer.findTarget(evt.pixel);
    if (currentTrackPoint){
        let mapcoordinates=this.pixelToCoord(evt.pixel);
        let lonlat=this.transformFromMap(mapcoordinates);
        let featureInfo={
            overlayType: 'track',
            overlayName: 'current',
            coordinates: lonlat,
            nextTarget: currentTrackPoint
        }
        if (this._callHandlers({type:EventTypes.FEATURE,feature:featureInfo})) return false;
    }
    //detect vector layer features
    let detectedFeatures=[];
    const callForTop=(topFeature)=>{
        if (! topFeature){
            if (globalStore.getData(keys.properties.emptyFeatureInfo)){
                let baseChart=this.getBaseChart();
                if (!baseChart) return;
                let coordinates=this.transformFromMap(this.pixelToCoord(evt.pixel));
                let featureInfo={
                    overlayType: 'chart',
                    overlayName: baseChart.getConfig().name,
                    coordinates: coordinates,
                    nextTarget: coordinates
                };
                this._callGuards('click'); //do this again as some time could have passed
                return this._callHandlers({type:EventTypes.FEATURE,feature:featureInfo})
            }
            else{
                return;
            }
        }
        let featureInfo=topFeature.source.featureToInfo(topFeature.feature,evt.pixel);
        this._callGuards('click'); //do this again as some time could have passed
        return this._callHandlers({type:EventTypes.FEATURE,feature:featureInfo})
    }
    this.olmap.forEachFeatureAtPixel(evt.pixel,(feature,layer)=>{
        if (! layer.avnavOptions || ! layer.avnavOptions.chartSource) return;
        detectedFeatures.push({feature:feature,layer:layer,source:layer.avnavOptions.chartSource});
        },
        {
            hitTolerance: globalStore.getData(keys.properties.clickTolerance)/2
        });
    //sort the detected features by the order of our sources so that we use the topmost
    let topFeature;
    for (let i=this.sources.length-1;i>=0 && ! topFeature;i--){
        for (let fidx=0;fidx<detectedFeatures.length;fidx++){
            if (detectedFeatures[fidx].source === this.sources[i]){
                topFeature=detectedFeatures[fidx];
                break;
            }
        }
    }
    let promises=[];
    //just get chart features on top of the currently detected feature
    for (let i=this.sources.length-1;i>=0;i--) {
        if (topFeature && topFeature.source === this.sources[i]){
            break;
        }
        if (this.sources[i].hasFeatureInfo()) {
            promises.push(this.sources[i].getChartFeaturesAtPixel(evt.pixel));
        }
    }

    if (promises.length < 1){
        return callForTop(topFeature);
    }
    Promise.all(promises)
        .then((promiseFeatures) => {
            /* 3 steps
               (1) - find the topmost "point" feature (i.e. having nextTarget set)
               (2) - check if we have a feature from our base chart
               (3) - use the topmost feature without nextTarget
               This will give us some more info if the charts did have a nice info (e.g. in htmlInfo)
               if we do not find any of them - just fall through to a simple map click in callForTop
             */
            let nextTargetFeature;
            let baseChartFeature;
            let topChartFeature;
            let baseChart=this.getBaseChart();
            for (let pi = 0; pi < promiseFeatures.length; pi++) {
                if (promiseFeatures[pi] === undefined || promiseFeatures[pi].length < 1) continue;
                let feature = promiseFeatures[pi][0];
                if (feature){
                    if (feature.nextTarget){
                        nextTargetFeature=feature;
                        //ok - this wins in any case
                        break;
                    }
                    if (baseChart && baseChart.getChartKey() === feature.chartKey ){
                        baseChartFeature=feature;
                    }
                    if (! topChartFeature && feature.htmlInfo){
                        topChartFeature=feature;
                    }
                }
            }
            let finalFeature=nextTargetFeature;
            if (! finalFeature) finalFeature=topChartFeature;
            if (! finalFeature) finalFeature=baseChartFeature;
            if (finalFeature) {
                if (!finalFeature.nextTarget) {
                    //we always fill the click position
                    //so we could goto
                    let mapcoordinates = this.pixelToCoord(evt.pixel);
                    let lonlat = this.transformFromMap(mapcoordinates);
                    finalFeature.nextTarget = lonlat;
                }
                this._callGuards('click'); //do this again as some time could have passed
                this._callHandlers({type: EventTypes.FEATURE, feature: finalFeature});
                return true;
            }
            return callForTop(topFeature);
       })
        .catch((error) => {
            base.log("error in query features: "+error);
        });
    return false;
};
/**
 * @private
 * @param evt
 */
MapHolder.prototype.onDoubleClick=function(evt){
    evt.preventDefault();
    this.getView().setCenter(this.pixelToCoord(evt.pixel));
};

MapHolder.prototype.onZoomChange=function(evt){
    evt.preventDefault();
    base.log("zoom changed");
    if (this.mapZoom >=0){
        let vZoom=this.getView().getZoom();
        if (vZoom != this.mapZoom){
            if (vZoom < this.minzoom) vZoom=this.minzoom;
            if (vZoom > (this.maxzoom+globalStore.getData(keys.properties.maxUpscale)) ) {
                vZoom=this.maxzoom+globalStore.getData(keys.properties.maxUpscale);
            }
            base.log("zoom required from map: " + vZoom);
            this.requiredZoom = vZoom;
            if (vZoom != this.getView().getZoom()) this.getView().setZoom(vZoom);
        }
        if (this.isInUserActionGuard()){
            this.remoteChannel.sendMessage(COMMANDS.setZoom+" "+vZoom);
        }
    }
};
/**
 * find the nearest matching point from an array
 * @param pixel
 * @param  points in pixel coordinates - the entries are either an array of x,y or an object having the
 *         coordinates in a pixel element
 * @param opt_tolerance {number}
 * @return {number} the matching index or -1
 */
MapHolder.prototype.findTarget=function(pixel,points,opt_tolerance){
    base.log("findTarget "+pixel[0]+","+pixel[1]);
    let tolerance=opt_tolerance||10;
    let xmin=pixel[0]-tolerance;
    let xmax=pixel[0]+tolerance;
    let ymin=pixel[1]-tolerance;
    let ymax=pixel[1]+tolerance;
    let i;
    let rt=[];
    for (i=0;i<points.length;i++){
        let current=points[i];
        if (!(current instanceof Array)) current=current.pixel;
        if (current[0]>=xmin && current[0] <=xmax && current[1] >=ymin && current[1] <= ymax){
            rt.push({idx:i,pixel:current});
        }
    }
    if (rt.length){
        if (rt.length == 1) return rt[0].idx;
        rt.sort(function(a,b){
            let da=(a.pixel[0]-pixel[0])*(a.pixel[0]-pixel[0])+(a.pixel[1]-pixel[1])*(a.pixel[1]-pixel[1]);
            let db=(b.pixel[0]-pixel[0])*(b.pixel[0]-pixel[0])+(b.pixel[1]-pixel[1])*(b.pixel[1]-pixel[1]);
            return (da - db);
        });
        return rt[0].idx; //currently simply the first - could be the nearest...
    }
    return -1;
};
/**
 * event handler for move/zoom
 * stores the center and zoom
 * @param evt
 * @private
 */
MapHolder.prototype.onMoveEnd=function(evt){
    let newCenter= this.pointFromMap(this.getView().getCenter());
    if (this.setCenterFromMove(newCenter)) {
        this.saveCenter();
        base.log("moveend:"+this.center[0]+","+this.center[1]+",z="+this.zoom);
    }
};

/**
 * set the new center during moves
 * write to the navobject for updating computations
 * but still do not write to the cookie
 * @private
 * @param newCenter
 * @param {boolean}force
 */
MapHolder.prototype.setCenterFromMove=function(newCenter,force){
    if (this.center && newCenter && this.center[0]==newCenter[0] && this.center[1] == newCenter[1] &&
        this.zoom == this.getView().getZoom() && ! force) return;
    this.center=newCenter;
    this.zoom=this.getView().getZoom();
    let p=new navobjects.Point();
    p.fromCoord(newCenter);
    if (! this.gpsLocked) {
        //we avoid some heavy redrawing when we move/zoom in locked
        //mode
        //instead we already set the position directly from the gps
        globalStore.storeData(keys.map.centerPosition,p);
        if (this.isInUserActionGuard()) {
            this.remoteChannel.sendMessage(COMMANDS.setCenter + " " + JSON.stringify({lat: p.lat, lon: p.lon}));
        }

    }
    return true;
};

/**
 *
 * @param {RenderEvent} evt
 */
MapHolder.prototype.onPostCompose=function(evt){
    this.drawing.setContext(evt.context);
    this.drawing.setDevPixelRatio(evt.frameState.pixelRatio);
    this.drawing.setRotation(evt.frameState.viewState.rotation);
    this.drawGrid();
    this.drawNorth();
    this.tracklayer.onPostCompose(evt.frameState.viewState.center,this.drawing);
    this.aislayer.onPostCompose(evt.frameState.viewState.center,this.drawing);
    this.routinglayer.onPostCompose(evt.frameState.viewState.center,this.drawing);
    this.navlayer.onPostCompose(evt.frameState.viewState.center,this.drawing);

};

/**
 * this function is some "dirty workaround"
 * ol3 nicely zoomes up lower res tiles if there are no tiles
 * BUT: not when we never loaded them.
 * so we do some guess when we load a map and should go to a higher zoom level:
 * we start at a lower level and then zoom up in several steps...
 * @param start - when set, do not zoom up but start timeout
 */
MapHolder.prototype.doSlide=function(start){
    if (! start) {
        if (! this.slideIn) return;
        this.changeZoom(1,false,true);
        this.slideIn--;
        if (!this.slideIn) return;
    }
    else {
        this.slideIn = start;
    }
    let self=this;
    let to=globalStore.getData(keys.properties.slideTime);
    window.setTimeout(function(){
        self.doSlide();
    },to);
};
/**
 * tell the map that it's size has changed
 */
MapHolder.prototype.updateSize=function(){
    if (this.olmap) this.olmap.updateSize();
};

/**
 * trigger an new map rendering
 */
MapHolder.prototype.triggerRender=function(){
    if (this.olmap) this.olmap.render();
};

/**
 * save the current center and zoom
 * @private
 */
MapHolder.prototype.saveCenter=function(){
    let raw=JSON.stringify({center:this.center,zoom:this.zoom,requiredZoom: this.requiredZoom});
    localStorage.setItem(globalStore.getData(keys.properties.centerName),raw);
};

/**
 * set the visibility of the routing - this controls if we can select AIS targets
 * @param on
 */
MapHolder.prototype.setRoutingActive=function(on){
    let old=this.routingActive;
    this.routingActive=on;
    if (old != on) this.triggerRender();
};

/**
 * check if the routing display is visible
 * @return {boolean}
 */
MapHolder.prototype.getRoutingActive=function(){
    return this.routingActive;
};

/**
 * decide if we should show the editing route or the active route
 * @param on
 */
MapHolder.prototype.showEditingRoute=function(on){
    this.routinglayer.showEditingRoute(on);
};


MapHolder.prototype.setCompassOffset=function(y){
   this.compassOffset=y;
};

MapHolder.prototype.getCurrentChartEntry=function(){
    if (! this._baseChart) return;
    return this._baseChart.getConfig();
};

MapHolder.prototype.setImageStyles=function(styles){
    if (! styles || typeof(styles) !== 'object') return;
    this.navlayer.setImageStyles(styles);
    this.aislayer.setImageStyles(styles);
    this.routinglayer.setImageStyles(styles);
    this.tracklayer.setImageStyles(styles);
};

MapHolder.prototype.registerEventGuard=function(callback){
    if (!callback) return;
    if (this.eventGuards.indexOf(callback) >= 0) return;
    this.eventGuards.push(callback);
}

MapHolder.prototype._callGuards=function(eventName){
    this.eventGuards.forEach((guard)=>{
        guard(eventName);
    })
}


export default new MapHolder();
