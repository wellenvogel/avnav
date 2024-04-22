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
import boatImageHdg from '../images/BoatHdg.png';
import boatImageSteady from '../images/BoatSteady.png';
import markerImage from '../images/Marker2.png';
import measureImage from '../images/measure.png';
import assign from 'object-assign';
import Formatter from "../util/formatter";
import globalstore from "../util/globalstore";


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
    this.boatStyleHdg=assign({},this.boatStyle,{
        image: new Image(),
        src:boatImageHdg,
        anchor:[15,5]
    })
    this.boatStyleSteady=assign({},this.boatStyle,{
        image: new Image(),
        src:boatImageSteady,
        anchor:[10,10],
        size: [20,20]
    })

    this.boatStyle.image.src=this.boatStyle.src;
    this.boatStyleHdg.image.src=this.boatStyleHdg.src;
    this.boatStyleSteady.image.src=this.boatStyleSteady.src;

    /**
     * @private
     * @type {olStyle}
     */
    this.circleStyle={};
    this.anchorCircleStyle={};
    this.measureLineStyle={};
    this.measureTextStyle={};


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
    this.measureStyle={
        anchor: [17,38],
        size: [40,40],
        src: measureImage,
        image: new Image()
    };
    this.measureStyle.image.src=this.measureStyle.src;
    this.setStyle();
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
        color: this.anchorStyle.courseVectorColor?this.anchorStyle.courseVectorColor:globalStore.getData(keys.properties.anchorCircleColor),
        width: globalStore.getData(keys.properties.anchorCircleWidth)
    };
    this.measureLineStyle={
        color: this.measureStyle.courseVectorColor?this.measureStyle.courseVectorColor:globalStore.getData(keys.properties.measureColor),
        width: globalStore.getData(keys.properties.navCircleWidth)
    }
    this.measureTextStyle={
        stroke: '#fff',
        color: this.measureStyle.courseVectorColor?this.measureStyle.courseVectorColor:globalStore.getData(keys.properties.measureColor),
        width: 3,
        fontSize: globalStore.getData(keys.properties.aisTextSize),
        fontBase: 'Calibri,sans-serif',
        offsetY: -20
    }

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
    stw:        keys.nav.gps.waterSpeed,
    boatDirection: keys.nav.display.boatDirection,
    directionMode: keys.nav.display.directionMode,
    isSteady:   keys.nav.display.isSteady
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
    let boatRotation=gps.boatDirection;
    let useHdg=gps.directionMode !== 'cog';
    let boatStyle=assign({},gps.isSteady?this.boatStyleSteady:(useHdg?this.boatStyleHdg:this.boatStyle));
    let course=gps.course;
    if (course === undefined) course=0;
    if (boatStyle.rotate === false){
        boatStyle.rotation=0;
    }
    else {
        if (boatRotation !== undefined){
            boatStyle.rotation = boatRotation  * Math.PI / 180;
        }
        else{
            boatStyle.rotation = 0;
        }
    }
    let boatPosition = this.mapholder.transformToMap(gps.position.toCoord());
    if (globalStore.getData(keys.properties.layers.boat) && gps.valid) {
        let courseVectorTime=parseInt(globalStore.getData(keys.properties.navBoatCourseTime,600));
        let f=globalStore.getData(keys.properties.boatIconScale,1.0);
        boatStyle.size=[boatStyle.size[0]*f, boatStyle.size[1]*f];
        boatStyle.anchor=[boatStyle.anchor[0]*f,boatStyle.anchor[1]*f];
        drawing.drawImageToContext(boatPosition, boatStyle.image, boatStyle);
        let other;
        if (! gps.isSteady) {
            let courseVectorStyle = assign({}, this.circleStyle);
            if (boatStyle.courseVectorColor !== undefined) {
                courseVectorStyle.color = boatStyle.courseVectorColor;
            }
            if (boatStyle.courseVector !== false) {
                let courseVectorDistance=(gps.speed !== undefined)?gps.speed*courseVectorTime:0;
                if (courseVectorDistance > 0) {
                    other = this.computeTarget(boatPosition, course, courseVectorDistance);
                    drawing.drawLineToContext([boatPosition, other], courseVectorStyle);
                }
                if (useHdg && boatRotation !== undefined && globalStore.getData(keys.properties.boatDirectionVector)) {
                    let headingVectorDistance=(gps.stw !== undefined)?gps.stw*courseVectorTime:courseVectorDistance;
                    if (headingVectorDistance > 0) {
                        other = this.computeTarget(boatPosition, boatRotation, headingVectorDistance);
                        drawing.drawLineToContext([boatPosition, other], assign({dashed: true}, courseVectorStyle));
                    }
                }
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
        let measurePos=globalStore.getData(keys.map.measurePosition);
        if (measurePos && measurePos.lat && measurePos.lon){
            let measureRhumbLine=globalstore.getData(keys.properties.measureRhumbLine);
            let measure=this.mapholder.transformToMap((new navobjects.Point(measurePos.lon,measurePos.lat)).toCoord());
            drawing.drawImageToContext(measure,this.measureStyle.image,this.measureStyle);
            let centerPoint=new navobjects.Point();
            centerPoint.fromCoord(this.mapholder.transformFromMap(center));
            if (measureRhumbLine) {
                drawing.drawLineToContext([measure, center], this.measureLineStyle);
            }
            else{
                let segmentPoints=NavCompute.computeCoursePoints(centerPoint,measurePos,3);
                let line=[];
                segmentPoints.forEach((sp)=>line.push(
                    this.mapholder.transformToMap([sp.lon,sp.lat])
                ));
                drawing.drawLineToContext(line, this.measureLineStyle);
            }
            let distance=NavCompute.computeDistance(measurePos,centerPoint,measureRhumbLine);
            let text=Formatter.formatDirection(distance.course)+"°\n"+
                Formatter.formatDistance(distance.dts)+"nm";
            drawing.drawTextToContext(center,text,this.measureTextStyle);
        }
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
    let tp=NavCompute.computeTarget(point,course,dist,globalstore.getData(keys.nav.routeHandler.useRhumbLine));
    let tpmap=this.mapholder.transformToMap(tp.toCoord());
    return tpmap;
};



NavLayer.prototype.dataChanged=function(){
    this.setStyle();
};

NavLayer.prototype.setImageStyles=function(styles){
    let otherStyles={
        anchorImage:'anchorStyle',
        measureImage:'measureStyle',
        boatImage: 'boatStyle',
        boatImageHdg:'boatStyleHdg',
        boatImageSteady: 'boatStyleSteady'
    };
    for (let style in otherStyles){
        let target=otherStyles[style];
        if (styles[style]){
            let styleDef=styles[style];
            if (typeof(styleDef) === 'object'){
                if (styleDef.src) {
                    this[target].image.src = styleDef.src;
                    this[target].src = styleDef.src;
                }
                if (styleDef.anchor && styleDef.anchor instanceof Array && styleDef.anchor.length===2) this[target].anchor=styleDef.anchor;
                if (styleDef.size && styleDef.size instanceof Array && styleDef.size.length === 2) this[target].size=styleDef.size;
                if (styleDef.rotate !== undefined) this[target].rotate=styleDef.rotate;
                if (styleDef.courseVector !== undefined) this[target].courseVector=styleDef.courseVector;
                if (styleDef.courseVectorColor !== undefined) this[target].courseVectorColor=styleDef.courseVectorColor;
            }
        }
    }
    this.setStyle();
};

export default NavLayer;
