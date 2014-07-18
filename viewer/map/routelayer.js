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
     * the current route points
     * @type {Array}
     */
    this.currentRoutePoints=[];

    /**
     * the current route
     */
    this.currentRoute={};

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
    this.markerStyle={};
    this.courseStyle={};
    this.setStyle();
    var self=this;
    this.getRoute();
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
            width: this.mapholder.properties.getProperties().routeWidth
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

};
/**
 * read the route from the route data
 * @private
 */
avnav.map.RouteLayer.prototype.getRoute=function(){
    this.currentRoutePoints=[];
    //for now only the points
    var route=this.routingDate.getCurrentRoute();
    this.currentRoute=new avnav.nav.Route(route.name,route.points.slice(0));
    this.currentRoute.active=route.active;
    this.currentRoute.currentTarget=route.currentTarget;
    var i;
    for (i in this.currentRoute.points){
        var p=this.mapholder.pointToMap(this.currentRoute.points[i].toCoord());
        this.currentRoutePoints.push(p);
    }
};
/**
 * the handler for new data
 * @param evdata
 */
avnav.map.RouteLayer.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
    if (! this.visible) {
        this.currentRoutePoints=[];
        return;
    }
    if (evdata.type == avnav.nav.NavEventType.ROUTE) {
        this.getRoute();
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
    var prop=this.mapholder.getProperties().getProperties();
    var drawNav=prop.layers.boat&&prop.layers.nav;
    if (! drawNav) {
        this.routePixel=[];
        return;
    }
    if (leg.active && gps.valid ){
        var line=[this.mapholder.pointToMap(gps.toCoord()),to];
        drawing.drawLineToContext(line,this.courseStyle);
    }
    if (this.currentRoute.active || this.mapholder.getRoutingActive()) {
        this.routePixel = drawing.drawLineToContext(this.currentRoutePoints, this.lineStyle);
        var active = this.navobject.getRoutingData().getActiveWpIdx();
        var i;
        for (i = 0; i < this.currentRoutePoints.length; i++) {
            drawing.drawBubbleToContext(this.currentRoutePoints[i], 5,
                (i == active) ? this.activeWpStyle : this.normalWpStyle);
        }
    }
    else {
        this.routePixel=[];

    }
    if (to && ! this.currentRoute.active && leg.active){
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
        this.navobject.getRoutingData().setActiveWp(idx);
    }
    if (idx <= this.currentRoute.points.length) return this.currentRoute.points[idx];
    return undefined;
};
avnav.map.RouteLayer.prototype.propertyChange=function(evdata) {
    this.visible=this.mapholder.getProperties().getProperties().layers.nav;
    this.setStyle();
};
