/**
 * Created by andreas on 14.07.14.
 */
    
var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navdata');
var RouteHandler=require('../nav/routedata');
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';


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
     * @type {NavData}
     */
    this.navobject=NavData;

    /**
     * @private
     * @type {RouteHandler}
     */
    this.routingDate=this.navobject.getRoutingHandler();
    /**
     * @private
     * @type {boolean}
     */
    this.visible=this.mapholder.getProperties().getProperties().layers.nav;
    var self=this;


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
     * @private
     * @type {ol.style.Style}
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
    var self=this;
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    globalStore.register(this,keys.gui.global.propertySequence);



};
/**
 * set the styles
 * @private
 */
RouteLayer.prototype.setStyle=function() {
    this.lineStyle = {
            color: this.mapholder.properties.getProperties().routeColor,
            width: this.mapholder.properties.getProperties().routeWidth,
            arrow: {
                width: this.mapholder.properties.getProperties().routeWidth*3,
                length: this.mapholder.properties.getProperties().routeWidth*7,
                offset: 20,
                open: true
                }
        };
    this.dashedStyle = {
        color: this.mapholder.properties.getProperties().routeColor,
        width: this.mapholder.properties.getProperties().routeWidth,
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
        color: this.mapholder.properties.getProperties().bearingColor,
        width: 1,
        background: this.mapholder.properties.getProperties().bearingColor
    };

    this.markerStyle={
        anchor: [20, 20],
        size: [40, 40],
        src: 'images/MarkerOrange.png',
        image:  new Image()
    };
    this.markerStyle.image.src=this.markerStyle.src;
    this.courseStyle = {
        color: this.mapholder.properties.getProperties().bearingColor,
        width: this.mapholder.properties.getProperties().bearingWidth

    };
    this.textStyle= {
        stroke: '#fff',
        color: '#000',
        width: 3,
        font: this.mapholder.getProperties().getProperties().routingTextSize+'px Calibri,sans-serif',
        offsetY: 15
    };

};

/**
 * the handler for new data
 * @param evdata
 */
RouteLayer.prototype.navEvent=function(evdata){
    if (evdata.source == navobjects.NavEventSource.MAP) return; //avoid endless loop
    if (! this.visible) {
        return;
    }
    this.mapholder.triggerRender();
};

/**
 *
 * @param {ol.Coordinate} center
 * @param {avnav.map.Drawing} drawing
 */
RouteLayer.prototype.onPostCompose=function(center,drawing) {
    this.routePixel = [];
    this.wpPixel=[];
    if (!this.visible) return;
    var leg=this.navobject.getRoutingHandler().getCurrentLeg();
    var gps=this.navobject.getGpsHandler().getGpsData();
    var to=leg.to?this.mapholder.pointToMap(leg.to.toCoord()):undefined;
    var from=leg.from?this.mapholder.pointToMap(leg.from.toCoord()):undefined;
    var prop=this.mapholder.getProperties().getProperties();
    var drawNav=prop.layers.boat&&prop.layers.nav;
    var route=this.navobject.getRoutingHandler().getRoute();
    var text,wp;
    if (! drawNav ) {
        this.routePixel=[];
        return;
    }
    if (leg.active && gps.valid ){
        var line=[this.mapholder.pointToMap(gps.toCoord()),to];
        drawing.drawLineToContext(line,this.courseStyle);
        if (from){
            line=[from,to];
            drawing.drawLineToContext(line,this.dashedStyle);
        }
    }
    if (to ){
        //only draw the current target wp if we do not have a route
        this.wpPixel.push(drawing.drawImageToContext(to,this.markerStyle.image,this.markerStyle));
        if (leg.to.name){
            drawing.drawTextToContext(to,leg.to.name,this.textStyle);
        }
    }

    var routeTarget=-1;
    if ( route) {
        this._routeName=route.name;
        var currentRoutePoints=[];
        var i;
        for (i in route.points){
            var p=this.mapholder.pointToMap(route.points[i].toCoord());
            if (route.points[i].compare(leg.to)) routeTarget=i;
            currentRoutePoints.push(p);
        }
        this.routePixel = drawing.drawLineToContext(currentRoutePoints, this.lineStyle);
        var active = this.navobject.getRoutingHandler().getEditingWpIdx();
        var i,style;
        for (i = 0; i < currentRoutePoints.length; i++) {
            style=this.normalWpStyle;
            if (i == active) style=this.activeWpStyle;
            else {
                if (i == routeTarget) style=this.routeTargetStyle;
            }
            drawing.drawBubbleToContext(currentRoutePoints[i], prop.routeWpSize,
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
    var tolerance=this.mapholder.getProperties().getProperties().aisClickTolerance/2;
    if (! this.routePixel) return undefined;
    var idx=this.mapholder.findTarget(pixel,this.routePixel,tolerance);
    if (idx >= 0){
        var rt=this.navobject.getRoutingHandler().getRouteByName(this._routeName);
        if (! rt) return undefined;
        return rt.getPointAtIndex(idx);
    }
    idx=this.mapholder.findTarget(pixel,this.wpPixel,tolerance);
    if (idx == 0){
        //only one wp...
        var leg=this.navobject.getRoutingHandler().getCurrentLeg();
        if (leg && leg.to){
            return leg.to;
        }
    }
    return undefined;
};
RouteLayer.prototype.dataChanged=function() {
    this.visible=this.mapholder.getProperties().getProperties().layers.nav;
    this.setStyle();
    this.mapholder.triggerRender();
};

module.exports=RouteLayer;
