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
    var self=this;
    //use our own drawing to canvas
    //due to broken ol3 IconStyle when drawing to vector context
    this.useOwnDrawing=true;
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
    this.setStyle();

    /**
     * our style properties
     * @private
     * @type {{anchor: number[], size: number[], anchorXUnits: string, anchorYUnits: string, opacity: number, src: string}}
     */

    this.markerStyleProperties={
        anchor: [20, 20],
            size: [40, 40],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        opacity: 1,
        src: 'images/Marker1.png'
    };

    /**
     * the image for the marker
     * @private
     * @type {Image}
     */
    this.markerImage=new Image();
    if (this.useOwnDrawing) {
        this.markerImage.src = this.markerStyleProperties.src;
    }

    /**
     * @private
     * @type {ol.style.style}
     */
    this.markerStyle=
            /*new ol.style.Circle({
             radius: 10,
             fill: new ol.style.Fill({color: 'red'})
             });
             */
            new ol.style.Icon(this.markerStyleProperties);
    if (! this.useOwnDrawing) {
        //we must explicitely load our icon...
        this.markerStyle.load();
    }

    /**
     * the properties for the center marker
     * @private
     * @type {{anchor: number[], size: number[], anchorXUnits: string, anchorYUnits: string, opacity: number, src: string}}
     */
    this.centerStyleProperties={
        anchor: [20, 20],
        size: [40, 40],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        opacity: 1,
        src: 'images/Marker2.png'
    };

    /**
     * @private
     * @type {ol.style.style}
     */
    this.centerStyle =
        new ol.style.Icon(this.centerStyleProperties);
    /**
     * @private
     * @type {Image}
     */
    this.centerImage=new Image();
    if (! this.useOwnDrawing) {
        //we must explicitely load our icon...
        this.centerStyle.load();
    }
    else {
        this.centerImage.src=this.centerStyleProperties.src;
    }

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
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.boat);
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};
/**
 * feature index
 * @type {number}
 */
avnav.map.NavLayer.IDXBOAT=0;

/**
 * set the style(s)
 * @private
 */
avnav.map.NavLayer.prototype.setStyle=function() {
    this.courseStyle = new ol.style.Stroke({
        color: this.mapholder.properties.getProperties().bearingColor,
        width: this.mapholder.properties.getProperties().bearingWidth

    });
}

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
            rotation: rotation/180*Math.PI,
            rotateWithView: true
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
    var center=new ol.geom.Point(null);
    if (!this.mapholder.getMarkerLock()) {
        if (this.useOwnDrawing) {
            this.mapholder.drawImageToCanvas(evt, evt.frameState.view2DState.center, this.markerImage, this.markerStyleProperties);
        }
        else {
            marker.setCoordinates(evt.frameState.view2DState.center);
        }
        log("draw marker without lock");
    }
    else {
        if (this.useOwnDrawing) {
            this.mapholder.drawImageToCanvas(evt, this.markerPosition, this.markerImage, this.markerStyleProperties);
        }
        else {
            marker.setCoordinates(this.markerPosition);
            center.setCoordinates(evt.frameState.view2DState.center);
        }
        log("draw marker with lock");
    }
    if (!this.useOwnDrawing) {
        vectorContext.setImageStyle(this.markerStyle);
        vectorContext.drawPointGeometry(marker);
    }
    if (this.mapholder.getMarkerLock()){
        if (! this.mapholder.getGpsLock()) {
            //draw the center marker
            if (!this.useOwnDrawing) {
                vectorContext.setImageStyle(this.centerStyle);
                vectorContext.drawPointGeometry(center);
            }
            else {
                this.mapholder.drawImageToCanvas(evt, evt.frameState.view2DState.center, this.centerImage, this.centerStyleProperties);
            }
        }
        if (this.mapholder.getProperties().getProperties().layers.nav) {
            //draw the course to the marker
            var line = new ol.geom.LineString([this.boatPosition, this.markerPosition]);
            vectorContext.setFillStrokeStyle(null, this.courseStyle);
            vectorContext.drawLineStringGeometry(line);
        }
    }

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
    return undefined;
};

avnav.map.NavLayer.prototype.propertyChange=function(evdata){
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.boat);
    this.setStyle();
};