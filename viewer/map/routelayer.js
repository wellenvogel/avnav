/**
 * Created by andreas on 14.07.14.
 */

import keys,{KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import RouteEdit from '../nav/routeeditor.js';
import orangeMarker from '../images/MarkerOrange.png';
import NavCompute from "../nav/navcompute";

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);
const editingRoute=new RouteEdit(RouteEdit.MODES.EDIT);

class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}
class RouteDisplay{
    constructor(mapholder) {
        this.mapholder=mapholder;
        this.points=[];
        this.segments=[];
        this.filled=false;
        this.targetIndex=undefined;
    }
    reset(){
        this.points=[];
        this.segments=[];
        this.filled=false;
        this.targetIndex=undefined;
    }
    fillIfNeeded(routePoints,opt_target){
        if (this.filled) return;
        this.points=[];
        this.segments=[];
        let lastPoint=undefined;
        this.targetIndex=undefined;
        for (let i in routePoints){
            if (!routePoints[i]) continue;
            if (opt_target !== undefined && routePoints[i].compare(opt_target)){
                this.targetIndex=i;
            }
            let p = this.mapholder.pointToMap(routePoints[i].toCoord());
            this.points.push(p);
            if (lastPoint !== undefined) {
                if (globalStore.getData(keys.nav.routeHandler.useRhumbLine)) {
                    this.segments.push([this.mapholder.pointToMap(lastPoint.toCoord()),p]);
                } else {
                    let nextPart=[];
                    let segments = NavCompute.computeCoursePoints(lastPoint, routePoints[i], 3);
                    for (let s in segments) {
                        nextPart.push(this.mapholder.pointToMap([segments[s].lon, segments[s].lat]));
                    }
                    this.segments.push(nextPart);
                }
            }
            lastPoint = routePoints[i];
        }
        this.filled=true;
    }
    getPoints(){
        return this.points;
    }
    getSegments(){
        return this.segments;
    }
    getTargetIndex(){
        return this.targetIndex;
    }
}
/**
 * a cover for the layer with routing data
 * @param {MapHolder} mapholder
 * @constructor
 */
const RouteLayer=function(mapholder){
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;

    /**
     * @private
     * @type {boolean}
     */
    this.visible=globalStore.getData(keys.properties.layers.nav);
    /**
     * the pixel coordinates of the route points from the last draw
     * @private
     * @type {Array}
     */
    this.routePixel=[];
    /**
     * the list of pixel coordinates for waypoints
     * currently only one element
     * @type {Array}
     */
    this.wpPixel=[];
    /**
     * @private
     * @type {string}
     */
    this._routeName=undefined;

    /**
     * decide whether we should show the editing route or the active
     * @type {boolean}
     * @private
     */
    this._displayEditing=false;

    /**
     * @private
     * @type {olStyle}
     */
    this.lineStyle={};
    this.activeWpStyle={};
    this.normalWpStyle={};
    this.routeTargetStyle={};
    this.markerStyle={};
    this.courseStyle={};
    this.textStyle={};
    this.dashedStyle={};
    this.setStyle();
    let navStoreKeys=[keys.nav.gps.position,keys.nav.gps.valid];
    navStoreKeys=navStoreKeys.concat(
        KeyHelper.flattenedKeys(activeRoute.getStoreKeys()),
        KeyHelper.flattenedKeys(editingRoute.getStoreKeys())
    );
    globalStore.register(()=>this.mapholder.triggerRender(),navStoreKeys);
    globalStore.register(this,keys.gui.global.propertySequence);
    this.routeDisplay=new RouteDisplay(this.mapholder);
    this.currentCourse=new RouteDisplay(this.mapholder);
    globalStore.register(()=>{
        this.routeDisplay.reset();
        this.currentCourse.reset();
    },activeRoute.getStoreKeys(editingRoute.getStoreKeys({seq: keys.gui.global.propertySequence,rl:keys.nav.routeHandler.useRhumbLine})));
    globalStore.register(()=>{
        this.currentCourse.reset();
    },activeRoute.getStoreKeys({lat:keys.nav.gps.lat,lon:keys.nav.gps.lon,
        seq:keys.gui.global.propertySequence,
        rl:keys.nav.routeHandler.useRhumbLine}));
    this.currentLeg=new RouteDisplay(this.mapholder);
    globalStore.register(()=>{
        this.currentLeg.reset();
    },activeRoute.getStoreKeys({seq:keys.gui.global.propertySequence,rl:keys.nav.routeHandler.useRhumbLine}))


};

export const getRouteStyles=(opt_change)=>{
    let rt={};
    rt.lineStyle = {
        color:  globalStore.getData(keys.properties.routeColor),
        width:  globalStore.getData(keys.properties.routeWidth),
        arrow: {
            width:  globalStore.getData(keys.properties.routeWidth)*3,
            length:  globalStore.getData(keys.properties.routeWidth)*7,
            offset: 20,
            open: true
        }
    };
    rt.dashedStyle = {
        color:  globalStore.getData(keys.properties.routeColor),
        width:  globalStore.getData(keys.properties.routeWidth),
        dashed: true
    };
    rt.normalWpStyle={
        color: "yellow",
        width: 1,
        background: "yellow"
    };
    rt.activeWpStyle={
        color: "red",
        width: 1,
        background: "red"
    };
    rt.routeTargetStyle={
        color:  globalStore.getData(keys.properties.bearingColor),
        width: 1,
        background:  globalStore.getData(keys.properties.bearingColor)
    };
    if (! opt_change) {
        rt.markerStyle = {
            anchor: [20, 20],
            size: [40, 40],
            src: orangeMarker,
            image: new Image()
        };
        rt.markerStyle.image.src = rt.markerStyle.src;
    }
    rt.courseStyle = {
        color:  globalStore.getData(keys.properties.bearingColor),
        width:  globalStore.getData(keys.properties.bearingWidth)

    };
    rt.textStyle= {
        stroke: globalStore.getData(keys.properties.fontShadowColor),
        color: globalStore.getData(keys.properties.fontColor),
        width: globalStore.getData(keys.properties.fontShadowWidth),
        fontSize: globalStore.getData(keys.properties.routingTextSize),
        fontBase: globalStore.getData(keys.properties.fontBase),
        offsetY: 15
    };
    return rt;
}

/**
 * set the styles
 * @private
 */
RouteLayer.prototype.setStyle=function(opt_change) {
    const styles=getRouteStyles(opt_change);
    Object.assign(this,styles);
};


RouteLayer.prototype.showEditingRoute=function(on){
    let old=this._displayEditing;
    this._displayEditing=on;
    if (on != old){
        this.routeDisplay.reset();
        this.currentCourse.reset();
        this.mapholder.triggerRender();
    }
};

/**
 *
 * @param {olCoordinate} center
 * @param {Drawing} drawing
 */
RouteLayer.prototype.onPostCompose=function(center,drawing) {
    this.routePixel = [];
    this.wpPixel=[];
    if (!this.visible) return;
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    let showingActive= ! this._displayEditing || currentEditor.getRouteName() === activeRoute.getRouteName();
    let gpsPosition=globalStore.getData(keys.nav.gps.position);
    let gpsValid=globalStore.getData(keys.nav.gps.valid);
    let toPoint=showingActive?activeRoute.getCurrentTarget():undefined;
    let fromPoint=showingActive?activeRoute.getCurrentFrom():undefined;
    let showBoat=globalStore.getData(keys.properties.layers.boat);
    let showNav=globalStore.getData(keys.properties.layers.nav);
    let wpSize=globalStore.getData(keys.properties.routeWpSize);
    let drawNav=showBoat&&showNav;
    let route=currentEditor.getRoute();
    let text,wp;
    if (! drawNav ) {
        this.routePixel=[];
        return;
    }
    if (fromPoint && toPoint && gpsValid ){
        this.currentCourse.fillIfNeeded([gpsPosition,toPoint])
        let line=this.currentCourse.getSegments()[0];
        drawing.drawLineToContext(line,this.courseStyle);
        if (fromPoint){
            this.currentLeg.fillIfNeeded([fromPoint,toPoint]);
            line=this.currentLeg.getSegments()[0];
            drawing.drawLineToContext(line,this.dashedStyle);
        }
    }
    if (toPoint && ! route ){
        let to=this.mapholder.pointToMap(toPoint.toCoord());
        //only draw the current target wp if we do not have a route
        this.wpPixel.push(drawing.drawImageToContext(to,this.markerStyle.image,this.markerStyle));
        if (toPoint.name){
            drawing.drawTextToContext(to,toPoint.name,this.textStyle);
        }
    }
    if ( route) {
        this.routeDisplay.fillIfNeeded(route.points,toPoint);
        let routeTarget=this.routeDisplay.getTargetIndex();
        this.routePixel=[];
        let allSegments=this.routeDisplay.getSegments();
        for (let i in allSegments){
            let currentRoutePoints=allSegments[i];
            drawing.drawLineToContext(currentRoutePoints, this.lineStyle);
        }
        let currentRoutePoints=this.routeDisplay.getPoints();
        let active = currentEditor.getIndex();
        let i,style;
        for (i = 0; i < currentRoutePoints.length; i++) {
            style=this.normalWpStyle;
            if (i == active) style=this.activeWpStyle;
            else {
                if (i == routeTarget) style=this.routeTargetStyle;
            }
            this.routePixel.push(drawing.drawBubbleToContext(currentRoutePoints[i],wpSize,style));
            wp=route.points[i];
            if (wp && wp.name) text=wp.name;
            else text=i+"";
            drawing.drawTextToContext(currentRoutePoints[i],text,this.textStyle);
        }
    }
    else {
        this.routePixel=[];

    }


};
/**
 * find the waypoint that has been clicked and set this as active
 * @param pixel
 * @returns {navobjects.WayPoint} or undefined
 */
RouteLayer.prototype.findTarget=function(pixel){
    //TODO: own tolerance
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
    let currentEditor=this._displayEditing?editingRoute:activeRoute;
    if (this.routePixel) {
        let idx = this.mapholder.findTargets(pixel, this.routePixel, tolerance);
        if (idx.length > 0) {
            return currentEditor.getPointAt(idx[0]);
        }
    }
    if (this.wpPixel) {
        let idx = this.mapholder.findTargets(pixel, this.wpPixel, tolerance);
        if (idx.length> 0) {
            return currentEditor.getCurrentTarget();
        }
    }
    return undefined;
};
RouteLayer.prototype.dataChanged=function() {
    this.visible=globalStore.getData(keys.properties.layers.nav);
    this.setStyle(true);
    this.mapholder.triggerRender();
};
RouteLayer.prototype.setImageStyles=function(styles){
    let markerStyle=styles.markerImage;
    if (typeof(markerStyle) === 'object'){
        if (markerStyle.src) {
            this.markerStyle.src=markerStyle.src;
            this.markerStyle.image.src=markerStyle.src;
        }
        if (markerStyle.size) this.markerStyle.size=markerStyle.size;
        if (markerStyle.anchor) this.markerStyle.anchor=markerStyle.anchor;
    }

};

export default RouteLayer;
