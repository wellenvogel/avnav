/**
 * Created by andreas on 03.05.14.
 */


import navobjects from '../nav/navobjects';
import OverlayDialog from '../components/OverlayDialog.jsx';
import AisLayer from './aislayer';
import NavLayer from './navlayer';
import TrackLayer from './tracklayer';
import RouteLayer from './routelayer';
import {Drawing,DrawingPositionConverter} from './drawing';
import Formatter from '../util/formatter';
import keys,{KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import Promise from 'promise';
import Requests from '../util/requests.js';
import base from '../base.js';
import PubSub from 'PubSub';
import helper from '../util/helper.js';
import northImage from '../images/nadel_mit.png';
import KeyHandler from '../util/keyhandler.js';
import assign from 'object-assign';
import AvNavChartSource from './avnavchartsource.js';
import GpxChartSource from './gpxchartsource.js';
import CryptHandler from './crypthandler.js';


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
    SELECTWP: 2
};


/**
 * the holder for our olmap
 * the holer remains alive all the time whereas the map could be recreated on demand
 * @constructor
 */
const MapHolder=function(){

    DrawingPositionConverter.call(this);
    /** @private
     * @type {ol.Map}
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

    /**
     * factor for moving average for the course
     * @type {number}
     */
    this.movingAveragefactor=0.5;

    this.transformFromMap=ol.proj.getTransform("EPSG:3857","EPSG:4326");
    this.transformToMap=ol.proj.getTransform("EPSG:4326","EPSG:3857");

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
    this.drawing=new Drawing(this);

    this.northImage=new Image();
    this.northImage.src=northImage;
    /**
     * is the routing display visible? (no AIS selection...)
     * @private
     * @type {boolean}
     */
    this.routingActive=false;
    /**
     * the brightness
     * @type {number}
     */
    this.opacity=0;
    /**
     * last set opacity
     * @type {number}
     */
    this.lastOpacity=-1;
    this.compassOffset=0;
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
        self._chartbase=undefined;
        self._url=undefined;
        self._sequence=undefined;
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



    /**
     * the chart description as received from the server
     * @type {undefined}
     * @private
     */
    this._chartEntry={};
    /**
     * the list of currently active sources (index 0: base, othe: overlays)
     * @type {Array}
     * @private
     */
    this.sources=[];

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
    this.pubSub=new PubSub();
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
};

base.inherits(MapHolder,DrawingPositionConverter);

MapHolder.prototype.EventTypes=EventTypes;

/**
 * register for map events
 * @param callback a callback function, will be called with data and topic
 *        data is {type:EventTypes,...}
 * @returns {number} a token to be used for unsubscribe
 */
MapHolder.prototype.subscribe=function(callback){
    return this.pubSub.subscribe(PSTOPIC,callback);
};

/**
 * deregister from map events
 * @param token - the value obtained from register
 */
MapHolder.prototype.unsubscribe=function(token){
    return this.pubSub.unsubscribe(token);
};
/**
 * @inheritDoc
 * @param {ol.Coordinate} point
 * @returns {ol.Coordinate}
 */
MapHolder.prototype.coordToPixel=function(point){
    return this.olmap.getPixelFromCoordinate(point);
};
/**
 * @inheritDoc
 * @param {ol.Coordinate} pixel
 * @returns {ol.Coordinate}
 */
MapHolder.prototype.pixelToCoord=function(pixel){
    return this.olmap.getCoordinateFromPixel(pixel);
};


/**
 * get the 2Dv view
 * @returns {ol.View2D}
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
    this.olmap.updateSize();
};



MapHolder.prototype.setChartEntry=function(entry){
    this._chartEntry=assign({},entry);
};

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
                        let overlayLayers = [];
                        for (let ovi = 1; ovi < this.sources.length; ovi++) {
                            overlayLayers = overlayLayers.concat(this.sources[ovi].getLayers());
                        }
                        this.initMap(this.sources[0].getLayers(), this.sources[0].getChartKey(), overlayLayers);
                        this.setBrightness(globalStore.getData(keys.properties.nightMode) ?
                        globalStore.getData(keys.properties.nightChartFade, 100) / 100
                            : 1);
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

MapHolder.prototype.loadMap=function(div){
    this._lastMapDiv=div;
    let self=this;
    return new Promise((resolve,reject)=> {
        let url=this._chartEntry.url;
        if (!url) {
            reject("no map selected");
            return;
        }
        let chartSource=new AvNavChartSource(this,this._chartEntry);
        /**
         * finally prepare all layer sources and when done
         * create the map
         * @param overlayLayers
         */
        let newSources=[chartSource];
        let prepareAndCreate=(newSources)=>{
            this.prepareSourcesAndCreate(newSources)
                .then((res)=>{resolve(res)})
                .catch((error)=>{reject(error)});
        };
        let checkChanges=()=>{
            if (this.sources.length != newSources.length ){
                prepareAndCreate(newSources);
                return;
            }
            for (let i=0;i<this.sources.length;i++){
                if (!this.sources[i].isEqual(newSources[i])){
                    prepareAndCreate(newSources);
                    return;
                }
            }
            this.renderTo(div);
            resolve(0);
        };
        let overlayParam = {
            request: 'api',
            type: 'chart',
            url: chartSource.getChartKey(),
            command: 'getOverlays'
        };
        Requests.getJson("", {}, overlayParam)
            .then((overlays)=> {
                let overlayList = overlays.data;
                for (let k in overlayList){
                    let overlaySource=new GpxChartSource(this,{
                        url: "/overlays/"+overlayList[k].name,
                        iconBase: overlayList[k].icons?"/overlays/icons/"+overlayList[k].icons:undefined
                    });
                    newSources.push(overlaySource);
                }
                checkChanges();
            })
            .catch((error)=> {
                checkChanges();
            })

    });

};

MapHolder.prototype.getBaseLayer=function(){
    var styles = {
        'MultiPolygon': new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'blue',
                width: 1
            }),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 0.1)'
            })
        }),
        'Polygon': new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'blue',
                width: 1
            }),
            fill: new ol.style.Fill({
                color: 'rgba(0, 0, 255, 0.1)'
            })
        })
    };

    var styleFunction = function(feature) {
        return styles[feature.getGeometry().getType()];
    };
    var vectorSource = new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: 'countries-110m.json',
        wrapX: false
    });

    var vectorLayer = new ol.layer.Vector({
        source: vectorSource,
        style: styleFunction
    });
    return vectorLayer;

};


MapHolder.prototype.getMapOutlineLayer = function (layers) {
    let style = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: 'red',
            width: 2
        })
    });

    let source = new ol.source.Vector({
        wrapX: false
    });
    if (layers && layers.length > 0) {
        let extent = ol.extent.createEmpty();
        layers.forEach((layer)=> {
            if (layer.avnavOptions && layer.avnavOptions.extent) {
                let e = layer.avnavOptions.extent;
                extent = ol.extent.extend(extent, e);
            }
        });
        let feature = new ol.Feature(new ol.geom.Polygon([
            [
                ol.extent.getBottomLeft(extent),
                ol.extent.getBottomRight(extent),
                ol.extent.getTopRight(extent),
                ol.extent.getTopLeft(extent)

            ]
        ]));
        feature.setStyle(style);
        source.addFeature(feature);
    }
    ;
    return new ol.layer.Vector({
        source: source
    });
};

/**
 * init the map (deinit an old one...)
 * @param {String} div
 * @param {Array} layers - the chart layers (ol layers)
 * @param {string} baseurl - the baseurl to be used
 * @param {Array} overlayList - list of overlays to load
 */

MapHolder.prototype.initMap=function(layers,baseurl,overlayList){
    let div=this._lastMapDiv;
    let self=this;
    let layersreverse=[];
    this.minzoom=32;
    this.mapMinZoom=this.minzoom;
    this.maxzoom=0;
    for (let i=layers.length- 1;i>=0;i--){
        layersreverse.push(layers[i]);
        if (layers[i].avnavOptions.minZoom < this.minzoom){
            this.minzoom=layers[i].avnavOptions.minZoom;
        }
        if (layers[i].avnavOptions.maxZoom > this.maxzoom){
            this.maxzoom=layers[i].avnavOptions.maxZoom;
        }
    }
    for (let oi in overlayList){
        let overlay=overlayList[oi];
        layersreverse.push(overlay);
    }
    this.mapMinZoom=this.minzoom;
    let hasBaseLayers=globalStore.getData(keys.properties.layers.base,true);
    if (hasBaseLayers) {
        this.minzoom = 2;
    }
    if (this.olmap){
        let oldlayers=this.olmap.getLayers();
        if (oldlayers && oldlayers.getArray().length){
            let olarray=[];
            //make a copy of the layerlist
            //as the original array is modified when deleting...
            let olarray_in=oldlayers.getArray();
            olarray=olarray_in.slice(0);
            for(let i=0;i<olarray.length;i++){
                this.olmap.removeLayer(olarray[i]);
            }
        }
        if (hasBaseLayers) {
            this.olmap.addLayer(this.getBaseLayer());
            if (layers.length > 0) {
                this.olmap.addLayer(this.getMapOutlineLayer(layers))
            }
        }
        for (let i=0;i< layersreverse.length;i++){
            this.olmap.addLayer(layersreverse[i]);
        }
        this.renderTo(div);
    }
    else {
        let base=[];
        if (hasBaseLayers) {
            base.push(this.getBaseLayer());
            if (layers.length > 0) {
                base.push(this.getMapOutlineLayer(layers))
            }
        }
        this.olmap = new ol.Map({
            target: div?div:self.defaultDiv,
            layers: base.concat(layersreverse),
            interactions: ol.interaction.defaults({
                altShiftDragRotate:false,
                pinchRotate: false
            }),
            controls: [],
            view: new ol.View({
                center: ol.proj.transform([ 13.8, 54.1], 'EPSG:4326', 'EPSG:3857'),
                zoom: 9,
                extent: this.transformToMap([-200,-89,200,89])
            })

        });
        this.olmap.on('moveend',function(evt){
           return self.onMoveEnd(evt);
        });
        this.olmap.on('postrender',function(evt){
            //more or less similar top ol2 move
            return self.onMoveEnd(evt);
        });
        this.olmap.on('postcompose',function(evt){
            return self.onPostCompose(evt);
        });
        this.olmap.on('click', function(evt) {
            return self.onClick(evt);
        });
        this.olmap.on('dblclick', function(evt) {
            return self.onDoubleClick(evt);
        });
        this.olmap.getView().on('change:resolution',function(evt){
            return self.onZoomChange(evt);
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
        if (this.zoom >= (this.minzoom+globalStore.getData(keys.properties.slideLevels))){
            this.zoom-=globalStore.getData(keys.properties.slideLevels);
            this.doSlide(globalStore.getData(keys.properties.slideLevels));
        }
        this.requiredZoom=this.zoom;
        this.setZoom(this.zoom);
        recenter=false;
        let lext=undefined;
        if (layers.length > 0) {
            lext=layers[0].avnavOptions.extent;
            if (lext !== undefined && !ol.extent.containsCoordinate(lext,this.pointToMap(this.center))){
                let ok=OverlayDialog.confirm("Position outside map, center to map now?");
                ok.then(function(){
                    if (layers.length > 0) {
                        let view = self.getView();
                        lext = layers[0].avnavOptions.extent;
                        if (lext !== undefined) view.fit(lext,self.olmap.getSize());
                        self.setZoom(self.minzoom);
                        self.center = self.pointFromMap(view.getCenter());
                        self.zoom = view.getZoom();


                    }
                    self.saveCenter();
                    let newCenter = self.pointFromMap(self.getView().getCenter());
                    self.setCenterFromMove(newCenter, true);
                });
            }
        }
    }
    if (recenter) {
        if (layers.length > 0) {
            view = this.getView();
            let lextx=layers[0].avnavOptions.extent;
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
    if (this._lastSequenceQuery < (now -5000)){
        this._lastSequenceQuery=now;
        if (this.sources.length > 0 && this._lastMapDiv) {
            for (let k in this.sources){
                this.sources[k].checkSequence()
                    .then((res)=>{
                        if (res){
                            self.prepareSourcesAndCreate();
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
MapHolder.prototype.changeZoom=function(number,opt_force){
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
        font: '12px Calibri,sans-serif',
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

/**
 * called with updates from nav
 *
 */
MapHolder.prototype.navEvent = function () {

    let gps = globalStore.getMultiple(keys.nav.gps);
    if (!gps.valid) return;
    if (this.gpsLocked) {
        this.setCenter(gps);
        if (this.courseUp) {
            let diff = (gps.course - this.averageCourse);
            let tol = globalStore.getData(keys.properties.courseAverageTolerance);
            if (diff < tol && diff > -tol) diff = diff / 30; //slower rotate the map
            this.averageCourse += diff * globalStore.getData(keys.properties.courseAverageFactor);
            this.setMapRotation(this.averageCourse);
        }
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
            if (!source || ! (source instanceof ol.source.XYZ)) continue;
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
 * @param {ol.Coordinate} point
 * @returns {Array.<number>|*}
 */
MapHolder.prototype.pointToMap=function(point){
    return this.transformToMap(point);
};

/**
 * convert a point from map projection to EPSG:4326
 * @param {ol.Coordinate} point
 * @returns {Array.<number>|*}
 */
MapHolder.prototype.pointFromMap=function(point){
    return this.transformFromMap(point);
};

/**
 * set the map center
 * @param {navobjects.Point} point
 */
MapHolder.prototype.setCenter=function(point){
    if (! point) return;
    if (this.gpsLocked){
        let p=navobjects.WayPoint.fromPlain(point);
        globalStore.storeData(keys.map.centerPosition,p);
    }
    if (! this.getView()) return;
    this.getView().setCenter(this.pointToMap([point.lon,point.lat]))
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
 * @returns {boolean} the newl set value
 */
MapHolder.prototype.setCourseUp=function(on){
    let old=this.courseUp;
    if (old == on) return on;
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

MapHolder.prototype.setGpsLock=function(lock){
    if (lock == this.gpsLocked) return;
    if (! globalStore.getData(keys.nav.gps.valid) && lock) return;
    //we do not lock if the nav layer is not visible
    if (! globalStore.getData(keys.properties.layers.boat) && lock) return;
    this.gpsLocked=lock;
    globalStore.storeData(keys.map.lockPosition,lock);
    if (lock) this.setCenter(globalStore.getData(keys.nav.gps.position));
    this.checkAutoZoom();
};

/**
 * click event handler
 * @param {ol.MapBrowserEvent} evt
 */
MapHolder.prototype.onClick=function(evt){
    let wp=this.routinglayer.findTarget(evt.pixel);
    if (wp){
        this.pubSub.publish(PSTOPIC,{type:this.EventTypes.SELECTWP,wp:wp})
    }
    evt.preventDefault();
    if (this.routingActive || wp) return false;
    let aisparam=this.aislayer.findTarget(evt.pixel);
    if (aisparam) {
        this.pubSub.publish(PSTOPIC,{type:EventTypes.SELECTAIS,aisparam:aisparam});
    }
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
    }
    return true;
};

/**
 *
 * @param {ol.render.Event} evt
 */
MapHolder.prototype.onPostCompose=function(evt){
    if (this.opacity != this.lastOpacity){
        evt.context.canvas.style.opacity=this.opacity;
        this.lastOpacity=this.opacity;
    }
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
        this.changeZoom(1);
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

MapHolder.prototype.setBrightness=function(brightness){
    this.opacity=brightness;
};


MapHolder.prototype.setCompassOffset=function(y){
   this.compassOffset=y;
};

MapHolder.prototype.getCurrentChartEntry=function(){
    return assign({},this._chartEntry);
};

MapHolder.prototype.setImageStyles=function(styles){
    if (! styles || typeof(styles) !== 'object') return;
    this.navlayer.setImageStyles(styles);
    this.aislayer.setImageStyles(styles);
    this.routinglayer.setImageStyles(styles);
    this.tracklayer.setImageStyles(styles);
};

module.exports=new MapHolder();

