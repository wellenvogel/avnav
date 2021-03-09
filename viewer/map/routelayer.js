/**
 * Created by andreas on 14.07.14.
 */
    
import navobjects from '../nav/navobjects';
import keys,{KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import RouteEdit from '../nav/routeeditor.js';
import orangeMarker from '../images/MarkerOrange.png';

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
    let self=this;


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
    this.navChangedCb=new Callback((keys)=>{
       self.mapholder.triggerRender();
    });
    let navStoreKeys=[keys.nav.gps.position,keys.nav.gps.valid];
    navStoreKeys=navStoreKeys.concat(
        KeyHelper.flattenedKeys(activeRoute.getStoreKeys()),
        KeyHelper.flattenedKeys(editingRoute.getStoreKeys())
    );
    globalStore.register(this.navChangedCb,navStoreKeys);
    globalStore.register(this,keys.gui.global.propertySequence);



};
/**
 * set the styles
 * @private
 */
RouteLayer.prototype.setStyle=function(opt_change) {
    this.lineStyle = {
            color:  globalStore.getData(keys.properties.routeColor),
            width:  globalStore.getData(keys.properties.routeWidth),
            arrow: {
                width:  globalStore.getData(keys.properties.routeWidth)*3,
                length:  globalStore.getData(keys.properties.routeWidth)*7,
                offset: 20,
                open: true
                }
        };
    this.dashedStyle = {
        color:  globalStore.getData(keys.properties.routeColor),
        width:  globalStore.getData(keys.properties.routeWidth),
        dashed: true
    };
    this.normalWpStyle={
        color: "yellow",
        width: 1,
        background: "yellow"
    };
    this.activeWpStyle={
        color: "red",
        width: 1,
        background: "red"
    };
    this.routeTargetStyle={
        color:  globalStore.getData(keys.properties.bearingColor),
        width: 1,
        background:  globalStore.getData(keys.properties.bearingColor)
    };
    if (! opt_change) {
        this.markerStyle = {
            anchor: [20, 20],
            size: [40, 40],
            src: orangeMarker,
            image: new Image()
        };
        this.markerStyle.image.src = this.markerStyle.src;
    }
    this.courseStyle = {
        color:  globalStore.getData(keys.properties.bearingColor),
        width:  globalStore.getData(keys.properties.bearingWidth)

    };
    this.textStyle= {
        stroke: '#fff',
        color: '#000',
        width: 3,
        fontSize: globalStore.getData(keys.properties.routingTextSize),
        fontBase: 'Calibri,sans-serif',
        offsetY: 15
    };

};


RouteLayer.prototype.showEditingRoute=function(on){
    let old=this._displayEditing;
    this._displayEditing=on;
    if (on != old){
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
    let gpsPosition=globalStore.getData(keys.nav.gps.position);
    let gpsValid=globalStore.getData(keys.nav.gps.valid);
    let toPoint=activeRoute.getCurrentTarget();
    let to=toPoint?this.mapholder.pointToMap(toPoint.toCoord()):undefined;
    let fromPoint=activeRoute.getCurrentFrom();
    let from=fromPoint?this.mapholder.pointToMap(fromPoint.toCoord()):undefined;
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
    if (from && to && gpsValid ){
        let line=[this.mapholder.pointToMap(gpsPosition.toCoord()),to];
        drawing.drawLineToContext(line,this.courseStyle);
        if (from){
            line=[from,to];
            drawing.drawLineToContext(line,this.dashedStyle);
        }
    }
    if (to ){
        //only draw the current target wp if we do not have a route
        this.wpPixel.push(drawing.drawImageToContext(to,this.markerStyle.image,this.markerStyle));
        if (toPoint.name){
            drawing.drawTextToContext(to,toPoint.name,this.textStyle);
        }
    }

    let routeTarget=-1;
    if ( route) {
        let currentRoutePoints=[];
        for (let i in route.points){
            let p=this.mapholder.pointToMap(route.points[i].toCoord());
            if (route.points[i].compare(toPoint)) routeTarget=i;
            currentRoutePoints.push(p);
        }
        this.routePixel = drawing.drawLineToContext(currentRoutePoints, this.lineStyle);
        let active = currentEditor.getIndex();
        let i,style;
        for (i = 0; i < currentRoutePoints.length; i++) {
            style=this.normalWpStyle;
            if (i == active) style=this.activeWpStyle;
            else {
                if (i == routeTarget) style=this.routeTargetStyle;
            }
            drawing.drawBubbleToContext(currentRoutePoints[i],wpSize,
                style);
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
        let idx = this.mapholder.findTarget(pixel, this.routePixel, tolerance);
        if (idx >= 0) {
            return currentEditor.getPointAt(idx);
        }
    }
    if (this.wpPixel) {
        let idx = this.mapholder.findTarget(pixel, this.wpPixel, tolerance);
        if (idx == 0) {
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
