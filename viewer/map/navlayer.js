/**
 * Created by andreas on 18.05.14.
 */

goog.provide('avnav.map.NavLayer');
goog.require('avnav.nav.GpsData');
goog.require('avnav.nav.NavObject');
goog.require('avnav.map.Drawing');


/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.NavLayer=function(mapholder,navobject){
    var self=this;

    /**
     * the number of circles we can draw
     * @constant
     * @type {number}
     */
    this.MAXCIRCLES=3;
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
    this.boatStyle={
        anchor: [15, 72],
        size: [30,120],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        opacity: 1,
        src: 'images/Boat2.png',
        rotation: 20/180*Math.PI,
        rotateWithView: true,
        image: new Image()
    };
    this.boatStyle.image.src=this.boatStyle.src;
    /**
     * @private
     * @type {ol.style.Style}
     */
    this.courseStyle={};
    /**
     * @private
     * @type {ol.style.Style}
     */
    this.circleStyle={};
    this.setStyle();

    /**
     * our style properties
     * @private
     * @type {{anchor: number[], size: number[], anchorXUnits: string, anchorYUnits: string, opacity: number, src: string, image: Image}}
     */

    this.markerStyle={
        anchor: [20, 20],
        size: [40, 40],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        opacity: 1,
        src: 'images/Marker1.png',
        image:  new Image()
    };
    this.markerStyle.image.src=this.markerStyle.src;

    /**
     * the properties for the center marker
     * @private
     * @type {{anchor: number[], size: number[], anchorXUnits: string, anchorYUnits: string, opacity: number, src: string, image:Image}}
     */
    this.centerStyle={
        anchor: [20, 20],
        size: [40, 40],
        anchorXUnits: 'pixels',
        anchorYUnits: 'pixels',
        opacity: 1,
        src: 'images/Marker2.png',
        image: new Image()
    };
    this.centerStyle.image.src=this.centerStyle.src;


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
    for (var i=0;i< this.MAXCIRCLES;i++) {
        this.features.push(new ol.Feature({
            'geometry': new ol.geom.Circle([0, 0], 1)
        }));
    }

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
    this.courseStyle = {
        color: this.mapholder.properties.getProperties().bearingColor,
        width: this.mapholder.properties.getProperties().bearingWidth

    };
    this.circleStyle= new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: this.mapholder.properties.getProperties().navCircleColor,
            width: this.mapholder.properties.getProperties().navCircleWidth
        })
    });
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
 * @param {avnav.map.Drawing} drawing
 */
avnav.map.NavLayer.prototype.onPostCompose=function(evt,drawing){
    drawing.drawImageToContext(this.boatPosition,this.boatStyle.image,this.boatStyle);
    if (!this.mapholder.getMarkerLock()) {
        drawing.drawImageToContext(evt.frameState.view2DState.center,this.markerImage, this.markerStyle);
        log("draw marker without lock");
    }
    else {
        drawing.drawImageToContext(this.markerPosition, this.markerStyle.image, this.markerStyle);
        log("draw marker with lock");
        if (! this.mapholder.getGpsLock()) {
           drawing.drawImageToContext(evt.frameState.view2DState.center, this.centerStyle.image, this.centerStyle);
        }
        if (this.mapholder.getProperties().getProperties().layers.nav) {
            //draw the course to the marker
            drawing.drawLineToContext([this.boatPosition, this.markerPosition],this.courseStyle);
        }
    }


};

/**
 * compute a distance in map units fropm a given point
 * for drawing the circles
 * assumes "flatted" area around the point
 * @param {ol.Coordinat} pos in lat/lon
 * @param {number} course in degrees
 * @param {number} dist in m
 */
avnav.map.NavLayer.prototype.computeDistance=function(pos,course,dist){
    var point=new avnav.nav.navdata.Point();
    point.fromCoord(pos);
    var tp=avnav.nav.NavCompute.computeTarget(point,course,dist);
    var spmap=this.mapholder.transformToMap(pos);
    var tpmap=this.mapholder.transformToMap(tp.toCoord());
    var dx=spmap[0]-tpmap[0];
    var dy=spmap[1]-tpmap[1];
    var dst=Math.sqrt(dx*dx+dy*dy);
    return dst;
};

/**
 * set the boat position
 * @param {ol.Coordinate} pos
 * @param {number} course
 */
avnav.map.NavLayer.prototype.setBoatPosition=function(pos,course) {
    this.boatStyle.rotation=course*Math.PI/180;
    this.boatPosition = this.mapholder.transformToMap(pos);
    if (! this.maplayer.getVisible()) return;
    this.updateDisplay();
};

/**
 * update the features
 * @private
 */
avnav.map.NavLayer.prototype.updateDisplay=function(){
    //this.features[avnav.map.NavLayer.IDXBOAT].setGeometry(new ol.geom.Point(this.boatPosition));
    //currently 3 fix circles
    var pos=this.mapholder.transformFromMap(this.boatPosition);
    var course=this.lastBoatCourse;
    this.features[avnav.map.NavLayer.IDXBOAT+1].setGeometry(new ol.geom.Circle(this.boatPosition,
        this.computeDistance(pos,course,this.mapholder.properties.getProperties().navCircle1Radius)));
    this.features[avnav.map.NavLayer.IDXBOAT+2].setGeometry(new ol.geom.Circle(this.boatPosition,
        this.computeDistance(pos,course,this.mapholder.properties.getProperties().navCircle2Radius)));
    this.features[avnav.map.NavLayer.IDXBOAT+3].setGeometry(new ol.geom.Circle(this.boatPosition,
        this.computeDistance(pos,course,this.mapholder.properties.getProperties().navCircle3Radius)));
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
        return undefined;
    }
    var prop=this.mapholder.getProperties().getProperties();
    if (feature == this.features[avnav.map.NavLayer.IDXBOAT+1]) {
        if (prop.navCircle1Radius <= 10) return [];
        return [this.circleStyle];
    }
    if (feature == this.features[avnav.map.NavLayer.IDXBOAT+2]) {
        if (prop.navCircle2Radius <= 10 || prop.navCircle2Radius <= prop.navCircle1Radius ) return [];
        return [this.circleStyle];
    }
    if (feature == this.features[avnav.map.NavLayer.IDXBOAT+3]) {
        if (prop.navCircle3Radius <= 10 || prop.navCircle3Radius <= prop.navCircle1Radius || prop.navCircle3Radius <= prop.navCircle2Radius ) return [];
        return [this.circleStyle];
    }
    return undefined;
};

avnav.map.NavLayer.prototype.propertyChange=function(evdata){
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.boat);
    this.setStyle();
    if (this.maplayer.getVisible()) this.updateDisplay();
};