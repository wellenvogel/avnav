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
        src: 'images/Marker2.png',
        image: new Image()
    };
    this.centerStyle.image.src=this.centerStyle.src;

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
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};

/**
 * set the style(s)
 * @private
 */
avnav.map.NavLayer.prototype.setStyle=function() {
    this.courseStyle = {
        color: this.mapholder.properties.getProperties().bearingColor,
        width: this.mapholder.properties.getProperties().bearingWidth

    };
    this.circleStyle={
            color: this.mapholder.properties.getProperties().navCircleColor,
            width: this.mapholder.properties.getProperties().navCircleWidth
    };
};


/**
 * draw the marker and course
 * we rely on the move end to really set the marker pos to the cookie and to the navobject
 * @param {oli.render.Event} evt
 * @param {avnav.map.Drawing} drawing
 */
avnav.map.NavLayer.prototype.onPostCompose=function(evt,drawing){
    var prop=this.mapholder.getProperties().getProperties();
    if (prop.layers.boat) {
        drawing.drawImageToContext(this.boatPosition, this.boatStyle.image, this.boatStyle);
        var pos = this.boatPosition;
        var other;
        if (prop.navCircle1Radius > 10) {
            other = this.computeTarget(pos, this.lastBoatCourse, prop.navCircle1Radius);
            drawing.drawCircleToContext(pos, other, this.circleStyle);
        }
        if (prop.navCircle2Radius > 10 && prop.navCircle2Radius > prop.navCircle1Radius) {
            other = this.computeTarget(pos, this.lastBoatCourse, prop.navCircle2Radius);
            drawing.drawCircleToContext(pos, other, this.circleStyle);
        }
        if (prop.navCircle3Radius > 10 && prop.navCircle3Radius > prop.navCircle2Radius && prop.navCircle3Radius > prop.navCircle2Radius) {
            other = this.computeTarget(pos, this.lastBoatCourse, prop.navCircle3Radius);
            drawing.drawCircleToContext(pos, other, this.circleStyle);
        }
    }
    if (!this.mapholder.getMarkerLock()) {
        drawing.drawImageToContext(evt.frameState.view2DState.center,this.markerStyle.image, this.markerStyle);
        log("draw marker without lock");
    }
    else {
        drawing.drawImageToContext(this.markerPosition, this.markerStyle.image, this.markerStyle);
        log("draw marker with lock");
        if (! this.mapholder.getGpsLock()) {
           drawing.drawImageToContext(evt.frameState.view2DState.center, this.centerStyle.image, this.centerStyle);
        }
        if (prop.layers.nav && prop.layers.boat) {
            //draw the course to the marker
            drawing.drawLineToContext([this.boatPosition, this.markerPosition],this.courseStyle);
        }
    }


};

/**
 * compute a target point in map units from a given point
 * for drawing the circles
 * assumes "flatted" area around the point
 * @param {ol.Coordinat} pos in map coordinates
 * @param {number} course in degrees
 * @param {number} dist in m
 */
avnav.map.NavLayer.prototype.computeTarget=function(pos,course,dist){
    var point=new avnav.nav.navdata.Point();
    point.fromCoord(this.mapholder.transformFromMap(pos));
    var tp=avnav.nav.NavCompute.computeTarget(point,course,dist);
    var tpmap=this.mapholder.transformToMap(tp.toCoord());
    return tpmap;
};

/**
 * set the boat position
 * @param {ol.Coordinate} pos
 * @param {number} course
 */
avnav.map.NavLayer.prototype.setBoatPosition=function(pos,course) {
    this.boatStyle.rotation=course*Math.PI/180;
    this.lastBoatCourse=course;
    this.boatPosition = this.mapholder.transformToMap(pos);
};

/**
 * set the marker position
 * @param {ol.Coordinate} pos (lon/lat)
 */
avnav.map.NavLayer.prototype.setMarkerPosition=function(pos){
    this.markerPosition=this.mapholder.transformToMap(pos);
};

avnav.map.NavLayer.prototype.propertyChange=function(evdata){
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.boat);
    this.setStyle();
};
