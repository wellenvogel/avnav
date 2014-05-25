/**
 * Created by andreas on 18.05.14.
 */

goog.provide('avnav.map.NavLayer');
goog.require('avnav.nav.GpsData');
goog.require('avnav.nav.NavObject');

/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.NavLayer=function(mapholder,navobject){
    /**
     * @private
     * @type {avnav.map.MapHolder}
     */
    this.mapholder=mapholder;
    /**
     * @private
     * @type {avnav.nav.NavObject}
     */
    this.navobject=navobject;
    var self=this;
    this.maplayer=new ol.layer.Vector({
        source: new ol.source.Vector({
        }),
        style: function(feature,resolution){
            return self.styleFunction(feature,resolution);
        }
    });
    this.maplayer.avnavOptions={};

    /**
     * the last boat course
     * @private
     * @type {number}
     */
    this.lastBoatCourse=0;
    /**
     * the initial course must be different from 0 to create a style...
     * @private
     * @type {ol.style.Style}
     */
    this.boatStyle=this.setBoatStyle(20);
    /**
     * @private
     * @type {ol.style.Style}
     */
    this.courseStyle={};
    this.setCourseStyle();

    /**
     * @private
     * @type {ol.style.style}
     */
    this.markerStyle={};
    this.setMarkerStyle();

    /**
     * our features: 0-boat
     * we only use normal features for the boat
     * for the course line and the marker we draw them by our own in postCompose
     * as otherwise we cannot have them during dragging...
     * @private
     * @type {Array.<ol.Feature>}
     */
    this.features=[];
    /* boat */
    this.features.push(new ol.Feature({
        'geometry': new ol.geom.Point([0,0])
    }));

    /**
     * the boat position in map coordinates
     * @type {ol.Coordinate}
     */
    this.boatPosition=[0,0];



    /**
     * the marker position when locked - we rely on the mapholder to set this...
     * in map coordinates
     * @private
     * @type {ol.Coordinate}
     */
    this.markerPosition=[0,0];

    this.maplayer.getSource().addFeatures(this.features);
    this.maplayer.avnavOptions.type=avnav.map.LayerTypes.TNAV;


};
/**
 * feature index
 * @type {number}
 */
avnav.map.NavLayer.IDXBOAT=0;


/**
 * get the new boat style (as we have to change this for the rotation...)
 * @private
 * @param rotation
 */
avnav.map.NavLayer.prototype.setBoatStyle=function(rotation){
    //rotation=30;
    if (rotation == this.lastBoatCourse) return this.boatStyle;
    this.boatStyle=new ol.style.Style({

        image: new ol.style.Icon( ({
            anchor: [15, 72],
            size: [30,120],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            opacity: 1,
            src: 'images/Boat2.png',
            rotation: rotation/180*Math.PI
        }))
    /*
        image: new ol.style.Circle({
         radius: 10,
         fill: new ol.style.Fill({color: 'red'})
         })
         */
    });
    this.lastBoatCourse=rotation;
    return this.boatStyle;
};

/**
 * set the course style
 * @private
 */
avnav.map.NavLayer.prototype.setCourseStyle=function(){
    this.courseStyle=new ol.style.Stroke({
           color:this.mapholder.properties.getProperties().bearingColor,
           width:this.mapholder.properties.getProperties().bearingWidth

    });
};

avnav.map.NavLayer.prototype.setMarkerStyle=function(){
    this.markerStyle=
        /*new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({color: 'red'})
        });
        */
        new ol.style.Icon({
            anchor: [20, 20],
            size: [40, 40],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            opacity: 1,
            src: 'images/Marker1.png'
        });
    this.markerStyle.load();
};


/**
 * get the maplayer
 * @returns {ol.layer.Vector|*}
 */
avnav.map.NavLayer.prototype.getMapLayer=function(){
    return this.maplayer;
};

/**
 * draw the marker and course
 * we rely on the move end to really set the marker pos to the cookie and to the navobject
 * @param {oli.render.Event} evt
 */
avnav.map.NavLayer.prototype.onPostCompose=function(evt){
    //return;
    var vectorContext = evt.vectorContext;
    var marker=new ol.geom.Point(null);
    if (!this.mapholder.getMarkerLock()) {
        marker.setCoordinates(evt.frameState.view2DState.center);
        log("draw marker without lock");
    }
    else {
        marker.setCoordinates(this.markerPosition);
        log("draw marker with lock");
    }
    vectorContext.setImageStyle(this.markerStyle);
    vectorContext.drawPointGeometry(marker);
    if (this.mapholder.getMarkerLock()){
        //draw the course to the marker
        var line=new ol.geom.LineString([this.boatPosition,this.markerPosition]);
        vectorContext.setFillStrokeStyle(null,this.courseStyle);
        vectorContext.drawLineStringGeometry(line);
    }
    //vectorContext.drawFeature(marker, this.boatStyle);
};

/**
 * set the boat position
 * @param {ol.Coordinate} pos
 * @param {number} course
 */
avnav.map.NavLayer.prototype.setBoatPosition=function(pos,course){
    this.setBoatStyle(course);
    this.boatPosition=this.mapholder.transformToMap(pos);
    this.features[avnav.map.NavLayer.IDXBOAT].setGeometry(new ol.geom.Point(this.boatPosition));
};

/**
 * set the marker position
 * @param {ol.Coordinate} pos (lon/lat)
 */
avnav.map.NavLayer.prototype.setMarkerPosition=function(pos){
    this.markerPosition=this.mapholder.transformToMap(pos);
};


/**
 * get the style for one of the features
 * @param {ol.Feature} feature
 * @param resolution
 * @returns {*}
 */
avnav.map.NavLayer.prototype.styleFunction=function(feature,resolution){
    if (feature == this.features[avnav.map.NavLayer.IDXBOAT]){
        return [this.boatStyle];
    }
    if (feature == this.markerFeature){
        return [this.markerStyle];
    }
    return undefined;
};