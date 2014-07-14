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
     * @private
     * @type {ol.style.Style}
     */
    this.lineStyle={};
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
    if (! this.visible) return;
    drawing.drawLineToContext(this.currentRoutePoints,this.lineStyle);
};
avnav.map.RouteLayer.prototype.propertyChange=function(evdata) {
    this.visible=this.mapholder.getProperties().getProperties().layers.route;
    this.setStyle();
};
