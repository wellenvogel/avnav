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
    this.visible=this.mapholder.getProperties().getProperties().layers.route;
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
 * set the style for the track line
 * @private
 */
avnav.map.RouteLayer.prototype.setStyle=function() {
    this.lineStyle = {
            color: this.mapholder.properties.getProperties().routeColor,
            width: this.mapholder.properties.getProperties().routeWidth
        }
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
        this.currentRoutePoints=[];
        //for now only the points
        var route=this.routingDate.getCurrentRoute();
        this.currentRoute=new avnav.nav.Route(route.name,route.points.slice(0));
        var i;
        for (i in this.currentRoute.points){
            var p=this.mapholder.pointToMap(this.currentRoute.points[i].toCoord());
            this.currentRoutePoints.push(p);
        }
    }
    this.mapholder.triggerRender();
};

/**
 *
 * @param {ol.Coordinate} center
 * @param {avnav.map.Drawing} drawing
 */
avnav.map.RouteLayer.prototype.onPostCompose=function(center,drawing){
    this.routePixel=[];
    if (! this.visible) return;
    this.routePixel=drawing.drawLineToContext(this.currentRoutePoints,this.lineStyle);
    var active=this.navobject.getRoutingData().getActiveWpIdx();
    var i;
    for (i=0;i<this.currentRoutePoints.length;i++){
        drawing.drawBubbleToContext(this.currentRoutePoints[i],5,
            (i==active)?this.activeWpStyle:this.normalWpStyle);
    }
};
/**
 * find the waypoint that has been clicked and set this as active
 * @param pixel
 */
avnav.map.RouteLayer.prototype.findTarget=function(pixel){
    //TODO: own tolerance
    var tolerance=this.mapholder.getProperties().getProperties().aisClickTolerance/2;
    var idx=this.mapholder.findTarget(pixel,this.routePixel,tolerance);
    if (idx >= 0){
        this.navobject.getRoutingData().setActiveWp(idx);
    }
    if (idx <= this.currentRoute.points.length) return this.currentRoute.points[idx];
    return undefined;
};
avnav.map.RouteLayer.prototype.propertyChange=function(evdata) {
    this.visible=this.mapholder.getProperties().getProperties().layers.route;
    this.setStyle();
};
