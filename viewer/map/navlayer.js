/**
 * Created by andreas on 18.05.14.
 */

var NavCompute=require('../nav/navcompute');
var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navdata');
var anchor=require('../images/icons-new/anchor.svg');
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';




/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {MapHolder} mapholder
 * @constructor
 */
const NavLayer=function(mapholder){
    var self=this;
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;
    /**
     * @private
     * @type {NavData}
     */
    this.navobject=NavData;
    
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
    this.anchorCircleStyle={};
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

    this.anchorStyle={
        anchor: [20, 20],
        size: [40, 40],
        src: anchor,
        image: new Image()
    };
    this.anchorStyle.image.src=this.anchorStyle.src;
    /**
     * the boat position in map coordinates
     * @type {ol.Coordinate}
     */
    this.boatPosition=[0,0];

    globalStore.register(this,keys.gui.global.propertySequence);

};

/**
 * set the style(s)
 * @private
 */
NavLayer.prototype.setStyle=function() {
    this.circleStyle={
            color: this.mapholder.properties.getProperties().navCircleColor,
            width: this.mapholder.properties.getProperties().navCircleWidth
    };
    this.anchorCircleStyle={
        color: this.mapholder.properties.getProperties().anchorCircleColor,
        width: this.mapholder.properties.getProperties().anchorCircleWidth
    };
};


/**
 * draw the marker and course
 * we rely on the move end to really set the marker pos to the cookie and to the navobject
 * @param {ol.Coordinate} center in map coordinates
 * @param {avnav.map.Drawing} drawing
 */
NavLayer.prototype.onPostCompose=function(center,drawing){
    var prop=this.mapholder.getProperties().getProperties();
    var anchorDistance=this.navobject.getRoutingHandler().getAnchorWatch();
    if (prop.layers.boat) {
        drawing.drawImageToContext(this.boatPosition, this.boatStyle.image, this.boatStyle);
        var pos = this.boatPosition;
        var other;
        if (! anchorDistance) {
            var radius1 = parseInt(prop.navCircle1Radius);
            if (radius1 > 10) {
                other = this.computeTarget(pos, this.lastBoatCourse, radius1);
                drawing.drawCircleToContext(pos, other, this.circleStyle);
            }
            var radius2 = parseInt(prop.navCircle2Radius);
            if (radius2 > 10 && radius2 > radius1) {
                other = this.computeTarget(pos, this.lastBoatCourse, radius2);
                drawing.drawCircleToContext(pos, other, this.circleStyle);
            }
            var radius3 = parseInt(prop.navCircle3Radius);
            if (radius3 > 10 && radius3 > radius2 && radius3 > radius1) {
                other = this.computeTarget(pos, this.lastBoatCourse, radius3);
                drawing.drawCircleToContext(pos, other, this.circleStyle);
            }
        }
    }
    if (!this.mapholder.getGpsLock()) {
        drawing.drawImageToContext(center, this.centerStyle.image, this.centerStyle);
    }
    if (anchorDistance){
        var p=this.navobject.getRoutingHandler().getCurrentLeg().from;
        if (p){
            var c=this.mapholder.transformToMap(p.toCoord());
            drawing.drawImageToContext(c,this.anchorStyle.image,this.anchorStyle);
            var other=this.computeTarget(c,0,anchorDistance);
            drawing.drawCircleToContext(c,other,this.anchorCircleStyle);
        }
        var x=p;

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
NavLayer.prototype.computeTarget=function(pos,course,dist){
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
NavLayer.prototype.setBoatPosition=function(pos,course) {
    if (course === undefined) course=0;
    this.boatStyle.rotation=course*Math.PI/180;
    this.lastBoatCourse=course;
    this.boatPosition = this.mapholder.transformToMap(pos);
};


NavLayer.prototype.dataChanged=function(){
    this.setStyle();
};

module.exports=NavLayer;