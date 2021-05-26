/**
 * Created by andreas on 18.05.14.
 */

import NavCompute from '../nav/navcompute' ;
import navobjects from '../nav/navobjects' ;
import anchor from '../images/icons-new/anchor.png' ;
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import RouteEdit from '../nav/routeeditor.js';
import boatImage from '../images/Boat-NoNeedle.png';
import markerImage from '../images/Marker2.png';
import assign from 'object-assign';

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);




/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {MapHolder} mapholder
 * @constructor
 */
const NavLayer=function(mapholder){
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;


    /**
     * the initial course must be different from 0 to create a style...
     * @private
     * @type {olStyle}
     */
    this.boatStyle={
        anchor: [15, 0],
        size: [30,48],
        src: boatImage,
        rotation: 20/180*Math.PI,
        rotateWithView: true,
        image: new Image()
    };
    this.boatStyle.image.src=this.boatStyle.src;

    /**
     * @private
     * @type {olStyle}
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
        src: markerImage,
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


    globalStore.register(this,keys.gui.global.propertySequence);

};

/**
 * set the style(s)
 * @private
 */
NavLayer.prototype.setStyle=function() {
    this.circleStyle={
            color: globalStore.getData(keys.properties.navCircleColor),
            width: globalStore.getData(keys.properties.navCircleWidth)
    };
    this.anchorCircleStyle={
        color: globalStore.getData(keys.properties.anchorCircleColor),
        width: globalStore.getData(keys.properties.anchorCircleWidth)
    };
};

//we do not explicitely register for those keys as we rely on the mapholder
//triggering a render whenever something changes
const positionKeys={
    course:     keys.nav.gps.course,
    speed:      keys.nav.gps.speed,
    position:   keys.nav.gps.position,
    valid:      keys.nav.gps.valid,
    hdm:        keys.nav.gps.headingMag,
    hdt:        keys.nav.gps.headingTrue,
};
/**
 * draw the marker and course
 * we rely on the move end to really store the marker position
 * @param {olCoordinate} center in map coordinates
 * @param {Drawing} drawing
 */
NavLayer.prototype.onPostCompose=function(center,drawing){
    let anchorDistance=activeRoute.anchorWatch();
    let gps=globalStore.getMultiple(positionKeys);
    let boatDirectionMode=globalStore.getData(keys.properties.boatDirectionMode,'cog');
    let course=gps.course;
    let boatRotation=undefined;
    if (boatDirectionMode === 'hdt' && gps.hdt !== undefined){
        boatRotation=gps.hdt;
    }
    if (boatDirectionMode === 'hdm' && gps.hdm !== undefined){
        boatRotation=gps.hdm;
    }
    if (course === undefined) course=0;
    if (this.boatStyle.rotate === false){
        this.boatStyle.rotation=0;
    }
    else {
        if (boatRotation !== undefined){
            this.boatStyle.rotation = boatRotation  * Math.PI / 180;
        }
        else{
            this.boatStyle.rotation = course  * Math.PI / 180;
        }
    }
    let boatPosition = this.mapholder.transformToMap(gps.position.toCoord());
    if (globalStore.getData(keys.properties.layers.boat) && gps.valid) {
        let courseVectorTime=parseInt(globalStore.getData(keys.properties.navBoatCourseTime,600));
        let courseVetcorDistance=(gps.speed !== undefined)?gps.speed*courseVectorTime:0;
        let boatStyle=assign({},this.boatStyle);
        let f=globalStore.getData(keys.properties.boatIconScale,1.0);
        boatStyle.size=[this.boatStyle.size[0]*f, this.boatStyle.size[1]*f];
        boatStyle.anchor=[this.boatStyle.anchor[0]*f,this.boatStyle.anchor[1]*f];
        drawing.drawImageToContext(boatPosition, this.boatStyle.image, boatStyle);
        let other;
        let courseVectorStyle=assign({},this.circleStyle);
        if (this.boatStyle.courseVectorColor !== undefined) {
            courseVectorStyle.color=this.boatStyle.courseVectorColor;
        }
        if (courseVetcorDistance > 0 && this.boatStyle.courseVector !== false){
            other=this.computeTarget(boatPosition,course,courseVetcorDistance);
            drawing.drawLineToContext([boatPosition,other],courseVectorStyle);
            if (boatRotation !== undefined && globalStore.getData(keys.properties.boatDirectionVector)){
                other=this.computeTarget(boatPosition,boatRotation,courseVetcorDistance);
                drawing.drawLineToContext([boatPosition,other],assign({dashed:true},courseVectorStyle));
            }
        }
        if (! anchorDistance) {
            let radius1 = parseInt(globalStore.getData(keys.properties.navCircle1Radius));
            if (radius1 > 10) {
                other = this.computeTarget(boatPosition, course, radius1);
                drawing.drawCircleToContext(boatPosition, other, this.circleStyle);
            }
            let radius2 = parseInt(globalStore.getData(keys.properties.navCircle2Radius));
            if (radius2 > 10 && radius2 > radius1) {
                other = this.computeTarget(boatPosition, course, radius2);
                drawing.drawCircleToContext(boatPosition, other, this.circleStyle);
            }
            let radius3 = parseInt(globalStore.getData(keys.properties.navCircle3Radius));
            if (radius3 > 10 && radius3 > radius2 && radius3 > radius1) {
                other = this.computeTarget(boatPosition, course, radius3);
                drawing.drawCircleToContext(boatPosition, other, this.circleStyle);
            }
        }
    }
    if (!globalStore.getData(keys.map.lockPosition,false)) {
        drawing.drawImageToContext(center, this.centerStyle.image, this.centerStyle);
    }
    if (anchorDistance){
        let p=activeRoute.getCurrentFrom();
        if (p){
            let c=this.mapholder.transformToMap(p.toCoord());
            drawing.drawImageToContext(c,this.anchorStyle.image,this.anchorStyle);
            let other=this.computeTarget(c,0,anchorDistance);
            drawing.drawCircleToContext(c,other,this.anchorCircleStyle);
        }
    }



};

/**
 * compute a target point in map units from a given point
 * for drawing the circles
 * assumes "flatted" area around the point
 * @param {olCoordinate} pos in map coordinates
 * @param {number} course in degrees
 * @param {number} dist in m
 */
NavLayer.prototype.computeTarget=function(pos,course,dist){
    let point=new navobjects.Point();
    point.fromCoord(this.mapholder.transformFromMap(pos));
    let tp=NavCompute.computeTarget(point,course,dist);
    let tpmap=this.mapholder.transformToMap(tp.toCoord());
    return tpmap;
};



NavLayer.prototype.dataChanged=function(){
    this.setStyle();
};

NavLayer.prototype.setImageStyles=function(styles){
    if (styles.boatImage){
        let boat=styles.boatImage;
        if (typeof(boat) === 'object'){
            if (boat.src) {
                this.boatStyle.image.src=boat.src;
                this.boatStyle.src=boat.src;
            }
            if (boat.anchor && boat.anchor instanceof Array && boat.anchor.length==2) this.boatStyle.anchor=boat.anchor;
            if (boat.size && boat.size instanceof Array && boat.size.length == 2) this.boatStyle.size=boat.size;
            if (boat.rotate !== undefined) this.boatStyle.rotate=boat.rotate;
            if (boat.courseVector !== undefined) this.boatStyle.courseVector=boat.courseVector;
            if (boat.courseVectorColor !== undefined) this.boatStyle.courseVectorColor=boat.courseVectorColor;
        }
    }
};

export default NavLayer;