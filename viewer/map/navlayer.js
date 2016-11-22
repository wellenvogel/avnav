/**
 * Created by andreas on 18.05.14.
 */

avnav.provide('avnav.map.NavLayer');
var NavCompute=require('../nav/navcompute');
var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navobjects');



/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {avnav.map.MapHolder} mapholder
 * @param {NavData} navobject
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
     * @type {NavData}
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
    this.circleStyle={};
    this.setStyle();


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


    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};

/**
 * set the style(s)
 * @private
 */
avnav.map.NavLayer.prototype.setStyle=function() {
    this.circleStyle={
            color: this.mapholder.properties.getProperties().navCircleColor,
            width: this.mapholder.properties.getProperties().navCircleWidth
    };
};


/**
 * draw the marker and course
 * we rely on the move end to really set the marker pos to the cookie and to the navobject
 * @param {ol.Coordinate} center in map coordinates
 * @param {avnav.map.Drawing} drawing
 */
avnav.map.NavLayer.prototype.onPostCompose=function(center,drawing){
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
    if (!this.mapholder.getGpsLock()) {
        drawing.drawImageToContext(center, this.centerStyle.image, this.centerStyle);
    }


};

/**
 * compute a target point in map units from a given point
 * for drawing the circles
 * assumes "flatted" area around the point
 * @param {ol.Coordinate} pos in map coordinates
 * @param {number} course in degrees
 * @param {number} dist in m
 */
avnav.map.NavLayer.prototype.computeTarget=function(pos,course,dist){
    var point=new navobjects.Point();
    point.fromCoord(this.mapholder.transformFromMap(pos));
    var tp=NavCompute.computeTarget(point,course,dist);
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


avnav.map.NavLayer.prototype.propertyChange=function(evdata){
    this.setStyle();
};
