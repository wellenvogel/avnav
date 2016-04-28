/**
 * Created by andreas on 14.07.14.
 */

avnav.provide('avnav.map.RouteLayer');


/**
 * a cover for the layer with routing data
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.RouteLayer=function(mapholder,navobject){
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

    /**
     * @private
     * @type {avnav.nav.RouteData}
     */
    this.routingDate=this.navobject.getRoutingData();
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
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });


};
/**
 * set the styles
 * @private
 */
avnav.map.RouteLayer.prototype.setStyle=function() {
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
        src: 'images/Marker1.png',
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
avnav.map.RouteLayer.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
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
avnav.map.RouteLayer.prototype.onPostCompose=function(center,drawing) {
    this.routePixel = [];
    if (!this.visible) return;
    var leg=this.navobject.getRawData(avnav.nav.NavEventType.ROUTE);
    var gps=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    var to=leg.to?this.mapholder.pointToMap(leg.to.toCoord()):undefined;
    var from=leg.from?this.mapholder.pointToMap(leg.from.toCoord()):undefined;
    var prop=this.mapholder.getProperties().getProperties();
    var drawNav=prop.layers.boat&&prop.layers.nav;
    var route=this.navobject.getRoutingData().getEditingRoute();
    var text,wp;
    if (! drawNav || ! route) {
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
    var routeTarget=this.navobject.getRoutingData().getActiveWpIdx();
    var routeActive=false;
    if (this.mapholder.getRoutingActive() || this.navobject.getRoutingData().hasActiveRoute()) {
        routeActive=true;
        var currentRoutePoints=[];
        var i;
        for (i in route.points){
            var p=this.mapholder.pointToMap(route.points[i].toCoord());
            currentRoutePoints.push(p);
        }
        this.routePixel = drawing.drawLineToContext(currentRoutePoints, this.lineStyle);
        var active = this.navobject.getRoutingData().getActiveWpIdx();
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
    if (to && (! routeActive)){
        drawing.drawImageToContext(to,this.markerStyle.image,this.markerStyle);
    }

};
/**
 * find the waypoint that has been clicked and set this as active
 * @param pixel
 */
avnav.map.RouteLayer.prototype.findTarget=function(pixel){
    //TODO: own tolerance
    var tolerance=this.mapholder.getProperties().getProperties().aisClickTolerance/2;
    if (! this.routePixel) return undefined;
    var idx=this.mapholder.findTarget(pixel,this.routePixel,tolerance);
    if (idx >= 0){
        this.navobject.getRoutingData().setEditingWp(idx);
    }
    return idx;
};
avnav.map.RouteLayer.prototype.propertyChange=function(evdata) {
    this.visible=this.mapholder.getProperties().getProperties().layers.nav;
    this.setStyle();
    this.mapholder.triggerRender();
};
