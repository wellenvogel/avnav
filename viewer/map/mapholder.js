/**
 * Created by andreas on 03.05.14.
 */

avnav.provide('avnav.map.MapEvent');

var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navdata');
var OverlayDialog=require('../components/OverlayDialog.jsx');
var PropertyHandler=require('../util/propertyhandler');
var AisLayer=require('./aislayer');
var NavLayer=require('./navlayer');
var TrackLayer=require('./tracklayer');
var RouteLayer=require('./routelayer');
var Drawing=require('./drawing').Drawing;
var DrawingPositionConverter=require('./drawing').DrawingPositionConverter;
var Formatter=require('../util/formatter');






/**
 * the types of the layers
 * @type {{TCHART: number, TNAV: number}}
 */
const LayerTypes={
    TCHART:0,
    TNAV:1,
    TTRACK:2,
    TAIS:3
};

avnav.map.EventType={
    MOVE:0,
    SELECTAIS:1,
    SELECTWP: 2
};

/**
 *
 * @param {avnav.map.EventType} type
 * @param opt_parameter
 * @constructor
 */
avnav.map.MapEvent=function(type,opt_parameter){
    /**
     *
     * @type {avnav.map.EventTypes}
     */
    this.type=type;
    /**
     *
     * @type {*|{}}
     */
    this.parameter=opt_parameter||{};
};
avnav.map.MapEvent.EVENT_TYPE="mapevent";

/**
 * the holder for our olmap
 * the holer remains alive all the time whereas the map could be recreated on demand
 * @param {avnav.util.PropertyHandler} properties
 * @param navobject
 * @constructor
 */
const MapHolder=function(){

    DrawingPositionConverter.call(this);
    /** @private
     * @type {ol.Map}
     * */
    this.olmap=null;
    /** @private
     * @type {NavData}
     * */
    this.navobject=NavData;
    /** @private
     *  @type {avnav.properties.PropertyHandler}
     *  */
    this.properties=PropertyHandler;
    
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
    this.maxzoom=0;
    this.center=[0,0];
    this.zoom=-1;
    this.requiredZoom=-1;
    this.mapZoom=-1; //the last zoom we required from the map
    try {
        var currentView = localStorage.getItem(this.properties.getProperties().centerName);
        if (currentView) {
            var decoded = JSON.parse(currentView);
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
    this.northImage.src='images/nadel_mit.png';
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
    var self=this;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    /**
     * the last base url
     * @type {String}
     * @private
     */
    this._chartbase=undefined;

};

avnav.inherits(MapHolder,DrawingPositionConverter);
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
 * get the property handler
 * @returns {avnav.properties.PropertyHandler}
 */
MapHolder.prototype.getProperties=function(){
    return this.properties;
};


/**
 * get the 2Dv view
 * @returns {ol.View2D}
 */

MapHolder.prototype.getView=function(){
    if (!this.olmap)return null;
    var mview=this.olmap.getView();
    return mview;
};
/**
 * get the current map zoom level
 * @returns {number|Number|*}
 */
MapHolder.prototype.getZoom=function(){
    var v=this.olmap?this.olmap.getView():undefined;
    if (! v ) return {required:this.requiredZoom,current: this.zoom};
    return {required:this.requiredZoom,current: v.getZoom()};
};

/**
 * render the map to a new div
 * @param div if null - render to a default div (i.e. invisible)
 */
MapHolder.prototype.renderTo=function(div){
    if (! this.olmap) return;
    if (!div) div=this.defaultDiv;
    this.olmap.setTarget(div);
    this.olmap.updateSize();
};


MapHolder.prototype.loadMap=function(options,opt_force){
    var self=this;
    var chartbase = options.charturl;
    var list = options.url;
    if (!chartbase) {
        chartbase = list;
    }
    if (! chartbase){
        list=this._chartbase;
        chartbase=this._chartbase;
    }
    if (! list){
        throw Error("missing charturl when loading rteditpage");
    }
    if (!list.match(/^http:/)) {
        if (list.match(/^\//)) {
            list = window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/, '$1') + list;
        }
        else {
            list = window.location.href.replace(/[?].*/, '').replace(/[^\/]*$/, '') + "/" + list;
        }
    }
    if (list != this._chartbase || opt_force) {
        //chartbase: optional url for charts
        //list: the base url

        var url = list + "/avnav.xml";
        $.ajax({
            url: url,
            dataType: 'xml',
            cache: false,
            success: function (data) {
                self.initMap(self.mapdom, data, chartbase);
            },
            error: function (ev) {
                self.toast("unable to load charts " + ev.responseText);
            }
        });
    }
};
/**
 * init the map (deinit an old one...)
 * @param {String} div
 * @param {Object} layerdata - the data as returned by the query to the description
 * @param {string} baseurl - the baseurl to be used
 */

MapHolder.prototype.initMap=function(div,layerdata,baseurl){
    var self=this;
    var layers=this.parseLayerlist(layerdata,baseurl);
    var layersreverse=[];
    this.minzoom=32;
    this.maxzoom=0;
    for (var i=layers.length- 1;i>=0;i--){
        layersreverse.push(layers[i]);
        if (layers[i].avnavOptions.minZoom < this.minzoom){
            this.minzoom=layers[i].avnavOptions.minZoom;
        }
        if (layers[i].avnavOptions.maxZoom > this.maxzoom){
            this.maxzoom=layers[i].avnavOptions.maxZoom;
        }
    }
    if (this.olmap){
        var oldlayers=this.olmap.getLayers();
        if (oldlayers && oldlayers.getArray().length){
            var olarray=[];
            //make a copy of the layerlist
            //as the original array is modified when deleting...
            var olarray_in=oldlayers.getArray();
            olarray=olarray_in.slice(0);
            for(var i=0;i<olarray.length;i++){
                this.olmap.removeLayer(olarray[i]);
            }
        }
        for (var i=0;i< layersreverse.length;i++){
            this.olmap.addLayer(layersreverse[i]);
        }
    }
    else {
        this.olmap = new ol.Map({
            target: div?div:self.defaultDiv,
            layers: layersreverse,
            interactions: ol.interaction.defaults({
                altShiftDragRotate:false,
                pinchRotate: false
            }),
            controls: [],
            view: new ol.View({
                center: ol.proj.transform([ 13.8, 54.1], 'EPSG:4326', 'EPSG:3857'),
                zoom: 9
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
    var recenter=true;
    var view;
    if (this.requiredZoom) this.zoom=this.requiredZoom;
    if (this.center && this.zoom >0){
        //if we load a new map - try to restore old center and zoom
        view=this.getView();
        view.setCenter(this.pointToMap(this.center));
        if (this.zoom < this.minzoom) this.zoom=this.minzoom;
        if (this.zoom > (this.maxzoom + this.properties.getProperties().maxUpscale))
            this.zoom=this.maxzoom+this.properties.getProperties().maxUpscale;
        if (this.zoom >= (this.minzoom+this.properties.getProperties().slideLevels)){
            this.zoom-=this.properties.getProperties().slideLevels;
            this.doSlide(this.properties.getProperties().slideLevels);
        }
        this.requiredZoom=this.zoom;
        this.setZoom(this.zoom);
        recenter=false;
        var lext;
        if (layers.length > 0) {
            lext=layers[0].avnavOptions.extent;
            if (lext !== undefined && !ol.extent.containsCoordinate(lext,this.pointToMap(this.center))){
                var container=$('.avn_page:visible').find('.avn_left_panel')[0];
                var ok=OverlayDialog.confirm("Position outside map, center to map now?",container);
                ok.then(function(){
                    if (layers.length > 0) {
                        var view = self.getView();
                        var lext = layers[0].avnavOptions.extent;
                        if (lext !== undefined) view.fit(lext,self.olmap.getSize());
                        self.setZoom(self.minzoom);
                        self.center = self.pointFromMap(view.getCenter());
                        self.zoom = view.getZoom();


                    }
                    self.saveCenter();
                    var newCenter = self.pointFromMap(self.getView().getCenter());
                    self.setCenterFromMove(newCenter, true);
                });
            }
        }
    }
    if (recenter) {
        if (layers.length > 0) {
            view = this.getView();
            lext=layers[0].avnavOptions.extent;
            if (lext !== undefined) view.fit(lext,self.olmap.getSize());
            this.setZoom(this.minzoom);
            this.center=this.pointFromMap(view.getCenter());
            this.zoom=view.getZoom();

        }
    }
    this.saveCenter();
    var newCenter= this.pointFromMap(this.getView().getCenter());
    this.setCenterFromMove(newCenter,true);
    if (! this.getProperties().getProperties().layers.boat ) this.gpsLocked=false;
};

/**
 * increase/decrease the map zoom
 * @param number
 */
MapHolder.prototype.changeZoom=function(number){
    var curzoom=this.requiredZoom; //this.getView().getZoom();
    curzoom+=number;
    if (curzoom < this.minzoom ) curzoom=this.minzoom;
    if (curzoom > (this.maxzoom+this.properties.getProperties().maxUpscale) ) {
        curzoom=this.maxzoom+this.properties.getProperties().maxUpscale;
    }
    this.requiredZoom=curzoom;
    this.setZoom(curzoom);
    this.checkAutoZoom();
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
        avnav.log("set new zoom " + newZoom);
        this.olmap.getView().setZoom(newZoom);
    }
};
/**
 * draw the grid
 * @private
 */
MapHolder.prototype.drawGrid=function() {
    if (!this.properties.getProperties().layers.grid) return;
    if (!this.olmap) return;
    var style = {
        width: 1,
        color: 'grey'
    };
    var ctx = this.drawing.getContext();
    if (!ctx) return;
    var pw=ctx.canvas.width;
    var ph=ctx.canvas.height;
    //TODO: css pixel?
    var ul = this.pointFromMap(this.olmap.getCoordinateFromPixel([0, 0]));
    var ur = this.pointFromMap(this.olmap.getCoordinateFromPixel([pw, 0]));
    var ll = this.pointFromMap(this.olmap.getCoordinateFromPixel([0, ph]));
    var lr = this.pointFromMap(this.olmap.getCoordinateFromPixel([pw, ph]));
    var xrange=[Math.min(ul[0],ur[0],ll[0],lr[0]),Math.max(ul[0],ur[0],ll[0],lr[0])];
    var yrange=[Math.min(ul[1],ur[1],ll[1],lr[1]),Math.max(ul[1],ur[1],ll[1],lr[1])];
    var xdiff=xrange[1]-xrange[0];
    var ydiff=yrange[1]-yrange[0];
    var raster= 5/60; //we draw in 5' raster
    if (xdiff/raster > pw/60 ) return; //at most every 50px
    if (ydiff/raster > ph/60 ) return; //at most every 50px
    var drawText=this.drawing.getRotation()?false:true;
    var textStyle={
        color: 'grey',
        font: '12px Calibri,sans-serif',
        offsetY:7, //should compute this from the font...
        fixY:0
    };
    for(var x=Math.floor(xrange[0]);x<=xrange[1];x+=raster){
        this.drawing.drawLineToContext([this.pointToMap([x,yrange[0]]),this.pointToMap([x,yrange[1]])],style);
        if (drawText) {
            var text = Formatter.formatLonLatsDecimal(x, 'lon');
            this.drawing.drawTextToContext(this.pointToMap([x, yrange[0]]), text, textStyle);
        }
    }
    textStyle.offsetY=-7;
    textStyle.offsetX=30; //should compute from font...
    textStyle.fixY=undefined;
    textStyle.fixX=0;
    for (var y=Math.floor(yrange[0]);y <= yrange[1];y+=raster){
        this.drawing.drawLineToContext([this.pointToMap([xrange[0],y]),this.pointToMap([xrange[1],y])],style);
        if (drawText) {
            var text = Formatter.formatLonLatsDecimal(y, 'lat');
            this.drawing.drawTextToContext(this.pointToMap([xrange[0], y]), text, textStyle);
        }
    }

};
/**
 * draw the north marker
 * @private
 */
MapHolder.prototype.drawNorth=function() {
    if (!this.properties.getProperties().layers.compass) return;
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
 * parse a float attribute value
 * @param elem
 * @param {String} attr
 * @private
 */
MapHolder.prototype.e2f=function(elem,attr){
    return parseFloat($(elem).attr(attr));
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
 * @param {navobjects.NavEvent} evdata
 * @constructor
 */
MapHolder.prototype.navEvent=function(evdata){
    if (evdata.source == navobjects.NavEventSource.MAP) return; //avoid endless loop
    if (evdata.type == navobjects.NavEventType.GPS){
        var gps=this.navobject.getGpsHandler().getGpsData();
        if (! gps.valid) return;
        this.navlayer.setBoatPosition(gps.toCoord(),gps.course);
        if (this.gpsLocked) {
            this.setCenter(gps);
            var prop = this.properties.getProperties();
            if (this.courseUp) {
                var diff = (gps.course - this.averageCourse);
                var tol = prop.courseAverageTolerance;
                if (diff < tol && diff > -tol) diff = diff / 30; //slower rotate the map
                this.averageCourse += diff * prop.courseAverageFactor;
                this.setMapRotation(this.averageCourse);
            }
        }
        this.checkAutoZoom();
        if (this.olmap) this.olmap.render();

    }
};

MapHolder.prototype.centerToGps=function(){
    var gps=this.navobject.getGpsHandler().getGpsData();
    if (! gps.valid) return;
    this.setCenter(gps);
};

MapHolder.prototype.checkAutoZoom=function(opt_force){
    var enabled= this.properties.getProperties().autoZoom||opt_force;
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
    var currentZoom=this.olmap.getView().getZoom();
    var centerCoord=this.olmap.getView().getCenter();
    var hasZoomInfo=false;
    var zoomOk=false;
    for (var tzoom=Math.floor(this.requiredZoom);tzoom >= this.minzoom;tzoom--){
        zoomOk=false;
        var layers=this.olmap.getLayers().getArray();
        for (var i=0;i<layers.length && ! zoomOk;i++){
            var layer=layers[i];
            if (! layer.avnavOptions || ! layer.avnavOptions.zoomLayerBoundings) continue;
            var source=layer.get('source');
            if (!source || ! (source instanceof ol.source.XYZ)) continue;
            hasZoomInfo=true;
            var boundings=layer.avnavOptions.zoomLayerBoundings;
            var centerTile=source.getTileGrid().getTileCoordForCoordAndZ(centerCoord,tzoom);
            var z = centerTile[0];
            var x = centerTile[1];
            var y = centerTile[2];
            y=-y-1; //we still have the old counting...
            //TODO: have a common function for this and the tileUrlFunction
            if (!boundings[z]) continue; //nothing at this zoom level
            for (var bindex in boundings[z]) {
                var zbounds = boundings[z][bindex];
                if (zbounds.minx <= x && zbounds.maxx >= x && zbounds.miny <= y && zbounds.maxy >= y) {
                    zoomOk = true;
                    break;
                }
            }
        }
        if (zoomOk){
            if (tzoom != Math.floor(this.olmap.getView().getZoom())) {
                avnav.log("autozoom change to "+tzoom);
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
    if (! zoomOk && hasZoomInfo){
        var nzoom=tzoom+1;
        if (nzoom > this.requiredZoom) nzoom=this.requiredZoom;
        if (nzoom != this.olmap.getView().getZoom) {
            avnav.log("autozoom change to " + tzoom);
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
 * parse the layerdata and return a list of layers
 * @param {Object} layerdata
 * @param {string} baseurl - the baseurl
 * @returns {Array.<ol.layer.Layer>} list of Layers
 */
MapHolder.prototype.parseLayerlist=function(layerdata,baseurl){
    var self=this;
    var ll=[];
    $(layerdata).find('TileMap').each(function(ln,tm){
        var rt={};
        rt.type=LayerTypes.TCHART;
        //complete tile map entry here
        rt.inversy=false;
        rt.wms=false;
        var layer_profile=$(tm).attr('profile');
        if (layer_profile) {
            if (layer_profile != 'global-mercator' && layer_profile != 'zxy-mercator' && layer_profile != 'wms') {
                avnav.util.overlay.Toast('unsupported profile in tilemap.xml ' + layer_profile);
                return null;
            }
            if (layer_profile == 'global-mercator'){
                //our very old style stuff where we had y=0 at lower left
                rt.inversy=true;
            }
            if (layer_profile == 'wms'){
                rt.wms=true;
            }
        }
        rt.url=$(tm).attr('href');
        rt.title = $(tm).attr('title');
        rt.minZoom=parseInt($(tm).attr('minzoom'));
        rt.maxZoom=parseInt($(tm).attr('maxzoom'));
        rt.projection=$(tm).attr('projection'); //currently only for WMS
        //we store the layer region in EPSG:4326
        $(tm).find(">BoundingBox").each(function(nr,bb){
            rt.layerExtent = [self.e2f(bb,'minlon'),self.e2f(bb,'maxlat'),
                self.e2f(bb,'maxlon'),self.e2f(bb,'minlat')];
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
        var boundings=[];
        $(tm).find(">LayerBoundings >BoundingBox").each(function(nr,bb){
            var bounds=[self.e2f(bb,'minlon'),self.e2f(bb,'maxlat'),
                self.e2f(bb,'maxlon'),self.e2f(bb,'minlat')];
            boundings.push(bounds);
        });
        rt.boundings=boundings;

        var zoomLayerBoundings=[];
        $(tm).find(">LayerZoomBoundings >ZoomBoundings").each(function(nr,zb){
            var zoom=parseInt($(zb).attr('zoom'));
            var zoomBoundings=[];
            $(zb).find(">BoundingBox").each(function(nr,bb){
                var bounds={
                    minx:parseInt($(bb).attr('minx')),
                    miny:parseInt($(bb).attr('miny')),
                    maxx:parseInt($(bb).attr('maxx')),
                    maxy:parseInt($(bb).attr('maxy'))
                };
                zoomBoundings.push(bounds);
            });
            if (zoomBoundings.length){
                zoomLayerBoundings[zoom]=zoomBoundings;
            }
        });
        if (zoomLayerBoundings.length){
            rt.zoomLayerBoundings=zoomLayerBoundings;
        }

        //now we have all our options - just create the layer from them
        var layerurl="";
        if (rt.url === undefined){
            avnav.util.overlay.Toast("missing href in layer");
            return null;
        }
        if (! rt.url.match(/^https*:/)){
            layerurl=baseurl+"/"+rt.url;
        }
        else layerurl=rt.url;
        rt.extent=ol.extent.applyTransform(rt.layerExtent,self.transformToMap);
        if (rt.wms){
            var param={};
            $(tm).find(">WMSParameter").each(function(nr,wp){
                var n=$(wp).attr('name');
                var v=$(wp).attr('value');
                if (n !== undefined && v !== undefined){
                    param[n]=v;
                }
            });
            rt.wmsparam=param;
            var layermap={};
            $(tm).find(">WMSLayerMapping").each(function(nr,mapping){
                var zooms=$(mapping).attr('zooms');
                var layers=$(mapping).attr('layers');
                var zarr=zooms.split(/,/);
                var i;
                for (i in zarr){
                    try {
                        var zlevel=parseInt(zarr[i]);
                        layermap[zlevel]=layers;
                    }catch (ex){}
                }
            });
            rt.wmslayermap=layermap;

        }
        //we use a bit a dirty hack here:
        //ol3 nicely shows a lower zoom if the tile cannot be loaded (i.e. has an error)
        //to avoid server round trips, we use a local image url
        //the more forward way would be to return undefined - but in this case
        //ol will NOT show the lower zoom tiles...
        var invalidUrl='data:image/png;base64,i';
        var source=undefined;
        //as WMS support is broken in OL3 (as always ol3 tries to be more intelligent than everybody...)
        //we always use an XYZ layer but directly construct the WMS tiles...
        source = new ol.source.XYZ({
            tileUrlFunction: function (coord) {
                if (!coord) return undefined;
                var zxy = coord;
                var z = zxy[0];
                var x = zxy[1];
                var y = zxy[2];
                y=-y-1; //change for ol3-151 - commit af319c259b349c86a4d164c42cc4eb5884f896fb

                if (rt.zoomLayerBoundings) {
                    var found = false;
                    if (!rt.zoomLayerBoundings[z]) return invalidUrl;
                    for (var bindex in rt.zoomLayerBoundings[z]) {
                        var zbounds = rt.zoomLayerBoundings[z][bindex];
                        if (zbounds.minx <= x && zbounds.maxx >= x && zbounds.miny <= y && zbounds.maxy >= y) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        return invalidUrl;
                    }
                }
                if (rt.wms){
                    //construct the WMS url
                    var grid=rt.source.getTileGrid();
                    //taken from tilegrid.js:
                    //var origin = grid.getOrigin(z);
                    //the xyz source seems to have a very strange origin - x at -... but y at +...
                    //but we rely on the origin being ll
                    //not sure if this is correct for all projections...
                    var origin=[-20037508.342789244,-20037508.342789244]; //unfortunately the ol3 stuff does not export this...
                    var resolution = grid.getResolution(z);
                    var tileSize = grid.getTileSize(z);
                    y = (1 << z) - y - 1;
                    var minX = origin[0] + x * tileSize * resolution;
                    var minY = origin[1] + y * tileSize * resolution;
                    var maxX = minX + tileSize * resolution;
                    var maxY = minY + tileSize * resolution;
                    //now compute the bounding box
                    var converter=ol.proj.getTransform("EPSG:3857",rt.projection||"EPSG:4326");
                    var bbox=converter([minX,minY,maxX,maxY]);
                    var rturl=layerurl+"SERVICE=WMS&REQUEST=GetMap&FORMAT=image/png&WIDTH="+tileSize+"&HEIGHT="+tileSize+"&SRS="+encodeURI(rt.projection);
                    var k;
                    var layers;
                    if (rt.wmslayermap[z]) layers=rt.wmslayermap[z];
                    for (k in rt.wmsparam){
                        var v=rt.wmsparam[k];
                        if (layers && (k == "LAYERS"|| k== "layers")) {
                            v = layers;
                        }
                        rturl+="&"+k+"="+v;
                    }
                    rturl+="&BBOX="+bbox[0]+","+bbox[1]+","+bbox[2]+","+bbox[3];
                    return rturl;
                }
                if (rt.inversy) {
                    y = (1 << z) - y - 1
                }

                return layerurl + '/' + z + '/' + x + '/' + y + ".png";
            },
            extent: rt.extent
            /*
             url:layerurl+'/{z}/{x}/{y}.png'
             */
        });

        rt.source=source;
        var layer=new ol.layer.Tile({
            source: source
        });
        layer.avnavOptions=rt;
        ll.push(layer);
    });
    return ll;

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
    if (! this.getView()) return;
    this.getView().setCenter(this.pointToMap([point.lon,point.lat]))
};

/**
 * get the current center in lat/lon
 * @returns {navobjects.Point}
 */
MapHolder.prototype.getCenter=function(){
    var rt=new navobjects.Point();
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
    var coord1=this.pointToMap(point1.toCoord());
    var coord2=this.pointToMap(point2.toCoord());
    var pixel1=this.coordToPixel(coord1);
    var pixel2=this.coordToPixel(coord2);
    var dx=pixel1[0]-pixel2[0];
    var dy=pixel1[1]-pixel2[1];
    var dst=Math.sqrt(dy*dy+dx*dx);
    return dst;
};


/**
 * set the map rotation
 * @param {number} rotation in degrees
 */
MapHolder.prototype.setMapRotation=function(rotation){
    this.getView().setRotation(rotation==0?0:(360-rotation)*Math.PI/180);
};

/**
 * set the course up display mode
 * @param on
 * @returns {boolean} the newl set value
 */
MapHolder.prototype.setCourseUp=function(on){
    var old=this.courseUp;
    if (old == on) return on;
    if (on){
        var gps=this.navobject.getGpsHandler().getGpsData();
        if (! gps.valid) return false;
        this.averageCourse=gps.course;
        this.setMapRotation(this.averageCourse);
        this.courseUp=on;
        return on;
    }
    else{
        this.courseUp=on;
        this.setMapRotation(0);

    }
};

MapHolder.prototype.setGpsLock=function(lock){
    if (lock == this.gpsLocked) return;
    var gps=this.navobject.getGpsHandler().getGpsData();
    if (! gps.valid && lock) return;
    //we do not lock if the nav layer is not visible
    if (! this.getProperties().getProperties().layers.boat && lock) return;
    this.gpsLocked=lock;
    if (lock) this.setCenter(gps);
    this.checkAutoZoom();
};

/**
 * click event handler
 * @param {ol.MapBrowserEvent} evt
 */
MapHolder.prototype.onClick=function(evt){
    var wp=this.routinglayer.findTarget(evt.pixel);
    if (wp){
        setTimeout(function() {
            $(document).trigger(avnav.map.MapEvent.EVENT_TYPE,
                new avnav.map.MapEvent(avnav.map.EventType.SELECTWP, {wp: wp})
            );
        },0);
    }
    evt.preventDefault();
    if (this.routingActive || wp) return false;
    var aisparam=this.aislayer.findTarget(evt.pixel);
    if (aisparam) {
        setTimeout(function() {
            $(document).trigger(avnav.map.MapEvent.EVENT_TYPE,
                new avnav.map.MapEvent(avnav.map.EventType.SELECTAIS, {aisparam: aisparam})
            );
        },0);

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
    avnav.log("zoom changed");
    if (this.mapZoom >=0){
        var vZoom=this.getView().getZoom();
        if (vZoom != this.mapZoom){
            if (vZoom < this.minzoom) vZoom=this.minzoom;
            if (vZoom > (this.maxzoom+this.properties.getProperties().maxUpscale) ) {
                vZoom=this.maxzoom+this.properties.getProperties().maxUpscale;
            }
            avnav.log("zoom required from map: " + vZoom);
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
 * @param {number}
 * @return {number} the matching index or -1
 */
MapHolder.prototype.findTarget=function(pixel,points,opt_tolerance){
    avnav.log("findTarget "+pixel[0]+","+pixel[1]);
    var tolerance=opt_tolerance||10;
    var xmin=pixel[0]-tolerance;
    var xmax=pixel[0]+tolerance;
    var ymin=pixel[1]-tolerance;
    var ymax=pixel[1]+tolerance;
    var i;
    var rt=[];
    for (i=0;i<points.length;i++){
        var current=points[i];
        if (!(current instanceof Array)) current=current.pixel;
        if (current[0]>=xmin && current[0] <=xmax && current[1] >=ymin && current[1] <= ymax){
            rt.push({idx:i,pixel:current});
        }
    }
    if (rt.length){
        if (rt.length == 1) return rt[0].idx;
        rt.sort(function(a,b){
            var da=(a.pixel[0]-pixel[0])*(a.pixel[0]-pixel[0])+(a.pixel[1]-pixel[1])*(a.pixel[1]-pixel[1]);
            var db=(b.pixel[0]-pixel[0])*(b.pixel[0]-pixel[0])+(b.pixel[1]-pixel[1])*(b.pixel[1]-pixel[1]);
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
    var newCenter= this.pointFromMap(this.getView().getCenter());
    if (this.setCenterFromMove(newCenter)) {
        this.saveCenter();
        avnav.log("moveend:"+this.center[0]+","+this.center[1]+",z="+this.zoom);
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
    this.navobject.setMapCenter(this.center);
    //only fire move events if we are not bound to GPS
    if (! this.gpsLocked) {
        $(document).trigger(avnav.map.MapEvent.EVENT_TYPE,
            new avnav.map.MapEvent(avnav.map.EventType.MOVE, {})
        );
    }
    return true;
};

/**
 *
 * @param {ol.render.Event} evt
 */
MapHolder.prototype.onPostCompose=function(evt){
    var newCenter=this.pointFromMap(evt.frameState.viewState.center);
    if (this.setCenterFromMove(newCenter)) this.saveCenter();
    if (this.opacity != this.lastOpacity){
        $(evt.context.canvas).css('opacity',this.opacity);
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
    var self=this;
    var to=this.properties.getProperties().slideTime;
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
    var raw=JSON.stringify({center:this.center,zoom:this.zoom,requiredZoom: this.requiredZoom});
    localStorage.setItem(this.properties.getProperties().centerName,raw);
};

/**
 * set the visibility of the routing - this controls if we can select AIS targets
 * @param on
 */
MapHolder.prototype.setRoutingActive=function(on){
    var old=this.routingActive;
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

MapHolder.prototype.setBrightness=function(brightness){
    this.opacity=brightness;
};
/**
 * get an AIS icon as data url
 * @param {string} type: nearest,warning,normal
 * @returns {string} the icon as a data url
 */
MapHolder.prototype.getAisIcon=function(type){
    return this.aislayer.getAisIcon(type);
};

MapHolder.prototype.setCompassOffset=function(y){
   this.compassOffset=y;
};

module.exports=new MapHolder();

