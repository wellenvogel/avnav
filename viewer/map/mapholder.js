/**
 * Created by andreas on 03.05.14.
 */
goog.provide('avnav.map.MapHolder');
goog.provide('avnav.map.LayerTypes');
goog.provide('avnav.map.MapEvent');
goog.require('avnav.map.NavLayer');
goog.require('avnav.map.TrackLayer');
goog.require('avnav.map.AisLayer');

/**
 * the types of the layers
 * @type {{TCHART: number, TNAV: number}}
 */
avnav.map.LayerTypes={
    TCHART:0,
    TNAV:1,
    TTRACK:2,
    TAIS:3
};

avnav.map.EventType={
    MOVE:0,
    SELECT:1
};

/**
 *
 * @param {avnav.map.EventTypes} type
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
 * @param {avnav.properties.PropertyHandler} properties
 * @param navobject
 * @constructor
 */
avnav.map.MapHolder=function(properties,navobject){
    /** @private
     * @type {ol.Map}
     * */
    this.olmap=null;
    /** @private
     * @type {avnav.nav.NavObject}
     * */
    this.navobject=navobject;
    /** @private
     *  @type {avnav.properties.PropertyHandler}
     *  */
    this.properties=properties;
    /**
     * @private
     * @type {boolean}
     */
    this.markerLocked=true;
    /**
     * the marker position in lat/lot
     * @private
     * @type {Array.<number>}
     */
    this.markerPosition=[0,0];

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

    this.aislayer=new avnav.map.AisLayer(this,this.navobject);
    this.navlayer=new avnav.map.NavLayer(this,this.navobject);
    this.tracklayer=new avnav.map.TrackLayer(this,this.navobject);
    this.minzoom=32;
    this.maxzoom=0;
    this.center=[0,0];
    this.zoom=-1;
    var currentView=this.properties.getProperties().currentView;
    if (currentView){
        this.center=currentView.center;
        this.zoom=currentView.zoom;
    }
    var marker=this.properties.getProperties().marker;
    if (marker){
        this.markerLocked=marker.markerLocked;
        this.markerPosition=marker.markerPosition;
    }
    //call our set markerPosition as this will update the navlayer and navobject
    if (! this.markerLocked){
        this.setMarkerPosition(this.center,true);
    }
    else {
        this.setMarkerPosition(this.markerPosition,true);
    }
    this.slideIn=0; //when set we step by step zoom in
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
};

/**
 * get the property handler
 * @returns {avnav.properties.PropertyHandler}
 */
avnav.map.MapHolder.prototype.getProperties=function(){
    return this.properties;
};


/**
 * get the 2Dv view
 * @returns {ol.View2D}
 */

avnav.map.MapHolder.prototype.getView=function(){
    if (!this.olmap)return null;
    return this.olmap.getView().getView2D();
};
/**
 * init the map (deinit an old one...)
 * @param {String} div
 * @param {Object} layerdata - the data as returned by the query to the description
 * @param {string} baseurl - the baseurl to be used
 */

avnav.map.MapHolder.prototype.initMap=function(div,layerdata,baseurl){
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
    layersreverse.push(this.aislayer.getMapLayer());
    layersreverse.push(this.navlayer.getMapLayer());
    layersreverse.push(this.tracklayer.getMapLayer());

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
            target: div,
            layers: layersreverse,
            interactions: ol.interaction.defaults({
                altShiftDragRotate:false,
                pinchRotate: false
            }),
            view: new ol.View2D({
                center: ol.proj.transform([ 13.8, 54.1], 'EPSG:4326', 'EPSG:3857'),
                zoom: 9
            })

        });
        this.olmap.on('moveend',function(evt){
           self.onMoveEnd(evt);
        });
        this.olmap.on('postrender',function(evt){
            //more or less similar top ol2 move
            self.onMoveEnd(evt);
        });
        this.olmap.on('postcompose',function(evt){
            self.onPostCompose(evt);
        });
        this.olmap.on('click', function(evt) {
            self.onClick(evt);
        });
    }
    if (this.center && this.zoom >0){
        //if we load a new map - try to restore old center and zoom
        var view=this.getView();
        view.setCenter(this.pointToMap(this.center));
        if (this.zoom < this.minzoom) this.zoom=this.minzoom;
        if (this.zoom > (this.maxzoom + this.properties.getProperties().maxUpscale))
            this.zoom=this.maxzoom+this.properties.getProperties().maxUpscale;
        if (this.zoom >= (this.minzoom+this.properties.getProperties().slideLevels)){
            this.zoom-=this.properties.getProperties().slideLevels;
            this.doSlide(this.properties.getProperties().slideLevels);
        }
        view.setZoom(this.zoom);
    }
    else {
        if (layers.length > 0) {
            var view = this.getView();
            view.fitExtent(layers[0].getSource().getExtent(), this.olmap.getSize());
            if (view.getZoom() < this.minzoom) {
                view.setZoom(this.minzoom);
            }
            this.center=this.pointFromMap(view.getCenter());
            this.zoom=view.getZoom();

        }
    }
    this.properties.setUserData({
        currentView:{center:this.center,zoom:this.zoom}
    });
    var newCenter= this.pointFromMap(this.getView().getCenter());
    this.setCenterFromMove(newCenter,true);
    if (! this.getProperties().getProperties().layers.boat ) this.gpsLocked=false;
};

/**
 * increase/decrease the map zoom
 * @param number
 */
avnav.map.MapHolder.prototype.changeZoom=function(number){
    var curzoom=this.getView().getZoom();
    curzoom+=number;
    if (curzoom < this.minzoom ) curzoom=this.minzoom;
    if (curzoom > (this.maxzoom+this.properties.getProperties().maxUpscale) ) {
        curzoom=this.maxzoom+this.properties.getProperties().maxUpscale;
    }
    this.getView().setZoom(curzoom);
    this.zoom=curzoom;
    this.properties.setUserData({
        currentView:{center:this.center,zoom:this.zoom}
    });
};
/**
 * a workaround for the current unability of ol3 to draw in image in postcompose...
 * @param {ol.render.Event} the event context from postcompose
 * @param {ol.Coordinate} coord the coordinate to draw to in map coordinates
 * @param {Image} the image to display (must be loaded - no check!)
 * @param {{}} opt_options handles the same properties like ol.style.Icon
 *             currently supported:
 *             anchor[x,y] in pixels
 *             size[x,y]
 */
avnav.map.MapHolder.prototype.drawImageToCanvas=function(evt,coord,image,opt_options){
    if (image.naturalHeight == 0 || image.naturalWidth == 0) return; //silently ignore error
    var xy=this.olmap.getPixelFromCoordinate(coord);
    var devpixratio=evt.frameState.pixelRatio;
    if (devpixratio){
        xy[0]=xy[0]*devpixratio;
        xy[1]=xy[1]*devpixratio;
    }
    if (opt_options && opt_options.anchor){
        xy[0]-=opt_options.anchor[0];
        xy[1]-=opt_options.anchor[1];
    }
    /** @type {CanvasRenderingContext2D} */
    var context=evt.context;
    if (opt_options && opt_options.size) {
        context.drawImage(image, xy[0], xy[1], opt_options.size[0], opt_options.size[1]);
    }
    else {
        context.drawImage(image, xy[0], xy[1]);
    }


};

/**
 * parse a float attribute value
 * @param elem
 * @param {String} attr
 * @private
 */
avnav.map.MapHolder.prototype.e2f=function(elem,attr){
    return parseFloat($(elem).attr(attr));
};

/**
 * get the mode of the course up display
 * @returns {boolean}
 */
avnav.map.MapHolder.prototype.getCourseUp=function(){
    return this.courseUp;
};

/**
 * map locked to GPS
 * @returns {boolean}
 */
avnav.map.MapHolder.prototype.getGpsLock=function(){
    return this.gpsLocked;
};
/**
 * get the current marker lock state
 * @returns {boolean|userData.markerLocked|*}
 */
avnav.map.MapHolder.prototype.getMarkerLock=function(){
    return this.markerLocked;
};

/**
 * called with updates from nav
 * @param {avnav.nav.NavEvent} evdata
 * @constructor
 */
avnav.map.MapHolder.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
    if (evdata.type == avnav.nav.NavEventType.GPS){
        var gps=this.navobject.getRawData(evdata.type);
        if (! gps.valid) return;
        this.navlayer.setBoatPosition(gps.toCoord(),gps.course);
        if (! this.gpsLocked) return;
        this.setCenter(gps);
        var prop=this.properties.getProperties();
        if (this.courseUp) {
            var diff=(gps.course-this.averageCourse);
            var tol=prop.courseAverageTolerance;
            if (diff < tol && diff > -tol) diff=diff/30; //slower rotate the map
            this.averageCourse+=diff*prop.courseAverageFactor;
            this.setMapRotation(this.averageCourse);
        }

    }
};

/**
 * parse the layerdata and return a list of layers
 * @param {Object} layerdata
 * @param {string} baseurl - the baseurl
 * @returns {Array.<ol.layer.Layer>} list of Layers
 */
avnav.map.MapHolder.prototype.parseLayerlist=function(layerdata,baseurl){
    var self=this;
    var ll=[];
    $(layerdata).find('TileMap').each(function(ln,tm){
        var rt={};
        rt.type=avnav.map.LayerTypes.TCHART;
        //complete tile map entry here
        rt.inversy=false;
        var layer_profile=$(tm).attr('profile');
        if (layer_profile) {
            if (layer_profile != 'global-mercator' && layer_profile != 'zxy-mercator') {
                alert('unsupported profile in tilemap.xml ' + layer_profile);
                return null;
            }
            if (layer_profile == 'global_mercator'){
                //our very old style stuff where we had y=0 at lower left
                rt.inversy=true;
            }
        }
        rt.url=$(tm).attr('href');
        rt.title = $(tm).attr('title');
        rt.minZoom=parseInt($(tm).attr('minzoom'));
        rt.maxZoom=parseInt($(tm).attr('maxzoom'));
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
            alert("missing href in layer");
            return null;
        }
        if (! rt.url.match(/^http:/)){
            layerurl=baseurl+"/"+rt.url;
        }
        else layerurl=rt.url;
        rt.extent=ol.extent.transform(rt.layerExtent,self.transformToMap);
        //we use a bit a dirty hack here:
        //ol3 nicely shows a lower zoom if the tile cannot be loaded (i.e. has an error)
        //to avoid server round trips, we use a local image url
        //the more forward way would be to return undefined - but in this case
        //ol will NOT show the lower zoom tiles...
        var invalidUrl='data:image/png;base64,i';
        var source=new ol.source.XYZ({
            tileUrlFunction: function(coord){
                if (! coord) return undefined;
                var zxy=coord.getZXY();
                var z=zxy[0];
                var x=zxy[1];
                var y=zxy[2];

                if (rt.zoomLayerBoundings){
                    var found=false;
                    if (! rt.zoomLayerBoundings[z]) return invalidUrl;
                    for (var bindex in rt.zoomLayerBoundings[z]){
                        var zbounds=rt.zoomLayerBoundings[z][bindex];
                        if (zbounds.minx<=x && zbounds.maxx>=x && zbounds.miny<=y && zbounds.maxy>=y){
                            found=true;
                            break;
                        }
                    }
                    if (! found){
                        return invalidUrl;
                    }
                }

                return layerurl+'/'+zxy[0]+'/'+zxy[1]+'/'+zxy[2]+".png";
            },
            extent:rt.extent
            /*
            url:layerurl+'/{z}/{x}/{y}.png'
            */
        });

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
avnav.map.MapHolder.prototype.pointToMap=function(point){
    return this.transformToMap(point);
};

/**
 * convert a point from map projection to EPSG:4326
 * @param {ol.Coordinate} point
 * @returns {Array.<number>|*}
 */
avnav.map.MapHolder.prototype.pointFromMap=function(point){
    return this.transformFromMap(point);
};

/**
 * set the map center
 * @param {avnav.nav.navdata.Point} point
 */
avnav.map.MapHolder.prototype.setCenter=function(point){
    this.getView().setCenter(this.pointToMap([point.lon,point.lat]))
};

/**
 * set the map rotation
 * @param {number} rotation in degrees
 */
avnav.map.MapHolder.prototype.setMapRotation=function(rotation){
    this.getView().setRotation((360-rotation)*Math.PI/180);
};

/**
 * set the course up display mode
 * @param on
 * @returns {boolean} the newl set value
 */
avnav.map.MapHolder.prototype.setCourseUp=function(on){
    var old=this.courseUp;
    if (old == on) return on;
    if (on){
        //switch on only when locked...
        if (! this.gpsLocked) return false;
        var gps=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
        if (! gps.valid) return false;
        this.averageCourse=gps.course;
        this.setMapRotation(this.averageCourse);
        this.courseUp=on;
        return on;
    }
    else{
        this.courseUp=on;
        this.setMapRotation(0);
        return on;
    }
};

avnav.map.MapHolder.prototype.setGpsLock=function(lock){
    if (lock == this.gpsLocked) return;
    var gps=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    if (! gps.valid && lock) return;
    //we do not lock if the nav layer is not visible
    if (! this.getProperties().getProperties().layers.boat && lock) return;
    this.gpsLocked=lock;
    if (lock) this.setCenter(gps);
};
/**
 * set the marker lock state
 * @param lock
 */
avnav.map.MapHolder.prototype.setMarkerLock=function(lock){
    if (this.markerLocked == lock) return;
    this.markerLocked=lock;
    if (!lock){
        this.setMarkerPosition(this.center);
        this.olmap.render(); //is this exported?
    }
    else{
        this.setMarkerPosition(this.markerPosition,true);
        this.olmap.render();
    }

};

/**
 * set the marker position
 * @param {ol.Coordinate} coord (lon/lat)
 * @param {boolean} forceWriting to cookie
 * @private
 */
avnav.map.MapHolder.prototype.setMarkerPosition=function(coord,forceWrite){
    if (! coord) return;
    var notchanged=(this.markerPosition && this.markerPosition[0]==coord[0] && this.markerPosition[1]==coord[1]);
    this.markerPosition=coord.slice(0);
    this.navobject.setMarkerPos(this.markerPosition);
    if (! notchanged || forceWrite){
        this.properties.setUserData({
           marker:{
               markerLocked:this.markerLocked,
               markerPosition:this.markerPosition
           }
        });
        this.navlayer.setMarkerPosition(coord);

    }
};
/**
 * click event handler
 * @param {ol.MapBrowserEvent} evt
 */
avnav.map.MapHolder.prototype.onClick=function(evt){
    //no click actions when gps is locked...
    if (this.gpsLocked) return;
    var features=[];
    this.olmap.forEachFeatureAtPixel(evt.pixel,function(feature,layer){
        features.push(feature);
    });
    //currently only AIS features...
    for (var idx in features){
        var feature=features[idx];
        if (feature.aisparam){
            //only consider the first one...
            $(document).trigger(avnav.map.MapEvent.EVENT_TYPE,
                new avnav.map.MapEvent(avnav.map.EventType.SELECT, {feature:feature})
            );
            break;
        }
    }
};
/**
 * event handler for move/zoom
 * stores the center and zoom
 * @param evt
 * @private
 */
avnav.map.MapHolder.prototype.onMoveEnd=function(evt){
    var newCenter= this.pointFromMap(this.getView().getCenter());
    this.setCenterFromMove(newCenter);
    this.properties.setUserData({
        currentView:{center:this.center,zoom:this.zoom}
    });


    log("moveend:"+this.center[0]+","+this.center[1]+",z="+this.zoom);

};

/**
 * set the new center during moves
 * write to the navobject for updating computations
 * but still do not write to the cookie
 * @private
 * @param newCenter
 * @param {boolean}force
 */
avnav.map.MapHolder.prototype.setCenterFromMove=function(newCenter,force){
    if (this.center && newCenter && this.center[0]==newCenter[0] && this.center[1] == newCenter[1] &&
        this.zoom == this.getView().getZoom() && ! force) return;
    this.center=newCenter;
    this.zoom=this.getView().getZoom();
    this.navobject.setMapCenter(this.center);
    if (!this.markerLocked){
        this.setMarkerPosition(newCenter);
    }
    else {
        this.setMarkerPosition(this.markerPosition);
    }
    //only fire move events if we are not bound to GPS
    if (! this.gpsLocked) {
        $(document).trigger(avnav.map.MapEvent.EVENT_TYPE,
            new avnav.map.MapEvent(avnav.map.EventType.MOVE, {})
        );
    }
};

/**
 *
 * @param {oli.render.Event} evt
 */
avnav.map.MapHolder.prototype.onPostCompose=function(evt){
    var newCenter=this.pointFromMap(evt.frameState.view2DState.center);
    this.setCenterFromMove(newCenter);
    this.navlayer.onPostCompose(evt);
};

/**
 * this function is some "dirty workaround"
 * ol3 nicely zoomes up lower res tiles if there are no tiles
 * BUT: not when we never loaded them.
 * so we do some guess when we load a map and should go to a higher zoom level:
 * we start at a lower level and then zoom up in several steps...
 * @param start - when set, do not zoom up but start timeout
 */
avnav.map.MapHolder.prototype.doSlide=function(start){
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
avnav.map.MapHolder.prototype.updateSize=function(){
    if (this.olmap) this.olmap.updateSize();
};


