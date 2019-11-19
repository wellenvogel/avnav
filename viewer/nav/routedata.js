/**
 * Created by andreas on 04.05.14.
 */

var routeobjects=require('./routeobjects');
var navobjects=require('./navobjects');
var Formatter=require('../util/formatter');
var NavCompute=require('./navcompute');
var Overlay=require('../util/overlay');
var globalStore=require('../util/globalstore.jsx');
var keys=require('../util/keys.jsx').default;

/**
 * the handler for the routing data
 * query the server...
 * basically it can work in 2 modes:
 * active route mode - the currentleg and the editingRoute will kept in sync
 * editing mode      - the editing route is different from the one in the leg
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {NavData} navobject
 * @constructor
 */
var RouteData=function(propertyHandler,navobject){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navobject;
    /** @private
     * @type {routeobjects.Leg}
     * */
    this.serverLeg=new routeobjects.Leg();
    this.currentLeg=new routeobjects.Leg(
            new navobjects.WayPoint(0,0),
            new navobjects.WayPoint(0,0),
            false);
    /**
     * name of the default route
     * @type {string}
     */
    this.DEFAULTROUTE="default";
    this.FALLBACKROUTENAME="avnav.defaultRoute"; //a fallback name for the default route
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach+0;
    /**
     * the name of the last route that we edited
     * @private
     * @type {string}
     */
    this.lastEditingName=this.DEFAULTROUTE;

    try {
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routingDataName);
        if (raw){
            this.currentLeg.fromJsonString(raw);
        }
    }catch(e){
        avnav.log("Exception reading currentLeg "+e);
    }

    if (this.currentLeg.name && ! this.currentLeg.currentRoute){
        //migrate from old stuff
        var route=this._loadRoute(this.currentLeg.name,true);
        if (route){
            this.currentLeg.currentRoute=route;
            this.currentLeg.name=route.name;
        }
        else {
            this.currentLeg.currentRoute=new routeobjects.Route(this.currentLeg.name);
        }
    }

    /**
     * @private
     * @type {boolean}
     */
    this.connectMode=this.propertyHandler.getProperties().connectedMode;

    /**
     * if set all routes are not from the server....
     * @private
     * @type {boolean}
     */

    this.readOnlyServer=this.propertyHandler.getProperties().readOnlyServer;

    /**
     * the current coordinates of the active WP (if set)
     * @private
     * @type {navobjects.WayPoint}
     */
    this.editingWp=this.currentLeg.to;

    /**
     * the current route that we edit
     * the route is either the active route (in this case it is a ref to the active route) or another route
     * or none if we do not have an active route
     * @private
     * @type {routeobjects.Route}
     */
    this.editingRoute=undefined;

    /**
     * the last received route from server
     * initially we set this to our route to get the route from the server if it differs
     * @type {routeobjects.Route}
     */
    this.serverRoute=undefined;


    /**legChanged
     * @private
     * @type {null}
     */
    this.timer=null;
    /**
     * @private
     * @type {number}
     */
    this.routeErrors=0;
    this.serverConnected=false;

    /**
     * last distance to current WP
     * @private
     * @type {number}
     */
    this.lastDistanceToCurrent=-1;
    /**
     * last distance to next wp
     * @private
     * @type {number}
     */
    this.lastDistanceToNext=-1;
    /**
     * approaching next wp in route
     * @private
     * @type {boolean}
     */
    this.isApproaching=false;
    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=Formatter;

    var self=this;
    globalStore.register(this,keys.gui.global.propertySequence);


    this._startQuery();
    globalStore.storeData(keys.nav.routeHandler.currentLeg,this.currentLeg.clone());
};
/*---------------------------------------------------------
 get raw data functions
 ----------------------------------------------------------*/
/**
 * return the current leg - never modify this directly
 * @returns {routeobjects.Leg}
 */
RouteData.prototype.getCurrentLeg=function(){
    return this.currentLeg;
};
/**
 * get the current lock state (i.e. are we routing?)
 * @returns {boolean}
 */
RouteData.prototype.getLock=function(){
    return this.currentLeg.active && ! this.currentLeg.anchorDistance;
};

/**
 * the anchor watch distance or undefined
 * @returns {*|boolean}
 */

RouteData.prototype.getAnchorWatch=function(){
    return this.currentLeg.anchorDistance;
};

/**
 * check if we currently have an active route
 * @returns {boolean}
 */
RouteData.prototype.hasActiveRoute=function(){
    if (this.currentLeg.anchorDistance) return false;
    if (! this.currentLeg.active) return false;
    if (! this.currentLeg.name) return false;
    if (! this.currentLeg.currentRoute) return false;
    return true;
};

/**
 * get the current route target wp (or undefined)
 * @returns {navobjects.WayPoint|undefined}
 */
RouteData.prototype.getCurrentLegTarget=function(){
    return this.currentLeg.anchorDistance?undefined:this.currentLeg.to;
};
/**
 * get the next wp if there is one
 * @returns {navobjects.WayPoint|undefined}
 */
RouteData.prototype.getCurrentLegNextWp=function(){
    if (! this.currentLeg.currentRoute) return undefined;
    return this.currentLeg.currentRoute.getPointAtIndex(this.currentLeg.getCurrentTargetIdx()+1);
};

/**
 * get the start wp of the current leg (if any)
 * @returns {navobjects.WayPoint}
 */
RouteData.prototype.getCurrentLegStartWp=function(){
    if (! this.currentLeg) return undefined;
    if (! this.currentLeg.from) return undefined;
    return this.currentLeg.from;
};

/**
 * get the remaining length of the active route
 * @returns {Number} length in nm
 */
RouteData.prototype.getRemain=function(){
    if (this.hasActiveRoute()) return 0;
    var startIdx=this.currentLeg.getCurrentTargetIdx();
    return this.currentLeg.currentRoute.computeLength(startIdx);
};

RouteData.prototype.getApproaching=function(){
    return this.isApproaching;
};

/**
 * check if a waypoint is the current target
 * @param {navobjects.WayPoint} compare
 * @returns {boolean}
 */
RouteData.prototype.isCurrentRoutingTarget=function(compare){
    if (! compare ) return false;
    if (! this.currentLeg.to) return false;
    if (! this.currentLeg.active) return false;
    return this.currentLeg.to.compare(compare);
};

/**
 * get a waypoint at a given offset to the point (if it belongs to a route)
 * @param {navobjects.WayPoint} wp
 * @param {number }offset
 * @returns {navobjects.WayPoint|undefined}
 */
RouteData.prototype.getPointAtOffset=function(wp,offset){
    var rn=wp.routeName;
    if (! rn) return undefined;
    var route=this.getRouteByName(rn);
    if (! route) return undefined;
    return route.getPointAtOffset(wp,offset);
};

/**
 * return the current route (if any)
 * @returns {routeobjects.Route}
 */

RouteData.prototype.getRoute=function(){
    if (this.editingRoute) return this.editingRoute;
    if (! this.getLock()) return undefined;
    return this.currentLeg.currentRoute;
};

/**
 * return either the active route or the editing route if their name match
 * @param {string} name
 * @returns {routeobjects.Route}
 */

RouteData.prototype.getRouteByName=function(name){
    if (! name) return undefined;
    if (this.editingRoute && this.editingRoute.name == name) return this.editingRoute;
    if (! this.currentLeg.currentRoute) return undefined;
    if (this.currentLeg.currentRoute.name == name) return this.currentLeg.currentRoute;
    return undefined;
};

/**
 * check if the waypoint is still valid
 * either it is the current target
 * or it belongs to either the active or the editing route
 * @param {navobjects.WayPoint} wp
 * @returns {boolean}
 */
RouteData.prototype.checkWp=function(wp){
    if (! wp) return false;
    if (wp.compare(this.currentLeg.to)) return true;
    var rt=this.getRouteByName(wp.routeName);
    if (! rt) return false;
    return (rt.getIndexFromPoint(wp)>=0);
};

/**
 * compute the length of the route from the given startpoint
 * @param {number} startIdx
 * @param {routeobjects.Route} route
 * @returns {number} distance in nm
 */
RouteData.prototype.computeLength=function(startIdx,route){
    if (startIdx == -1) startIdx=this.currentLeg.getCurrentTargetIdx();
    if (! route) return 0;
    return route.computeLength(startIdx);
};
/**
 * check if a route is the current active one
 * @param {string} name
 * @returns {boolean}
 */
RouteData.prototype.isActiveRoute=function(name){
    if (! this.currentLeg.currentRoute) return false;
    return (this.currentLeg.currentRoute.name == name);
};

/**
 * check if a route is the current editing route
 * @param {string} name
 * @returns {boolean}
 */
RouteData.prototype.isEditingRoute=function(name){
    if (! this.editingRoute) return false;
    return (this.editingRoute.name == name);
};
/*---------------------------------------------------------
  editing functions - only if editingRoute is set
 ----------------------------------------------------------*/


/**
 * save the route (locally and on the server)
 * @param {routeobjects.Route|undefined} rte
 * @param {function} opt_callback
 */
RouteData.prototype.saveRoute=function(rte,opt_callback) {
    var route=this._saveRouteLocal(rte);
    if (! route ) return;
    if (avnav.android){
        avnav.android.storeRoute(route.toJsonString());
    }
    if (this.connectMode) this._sendRoute(route, opt_callback);
    else {
        if (opt_callback) setTimeout(function () {
            opt_callback(true);
        }, 0);
    }

};

/**
 * check if the current route is active
 * @returns {boolean}
 */
RouteData.prototype.isEditingActiveRoute=function(){
    if (! this.editingRoute) return false;
    if (! this.currentLeg.currentRoute) return false;
    return this.editingRoute.name == this.currentLeg.currentRoute.name;
};

/**
 *
 * @param {number} id the index in the route
 */
RouteData.prototype.setEditingWpIdx=function(id){
    var route=this.editingRoute;
    if (! route) return;
    this.editingWp=route.getPointAtIndex(id);
    this.navobject.routeEvent();
};
/**
 * set the editing waypoint
 * TODO: currently no check if it matches the route
 * @param {navobjects.WayPoint} wp
 */
RouteData.prototype.setEditingWp=function(wp){
    this.editingWp=wp;
    this.navobject.routeEvent();
};
RouteData.prototype.moveEditingWp=function(diff){
    var route=this.getRoute();
    if (! route) return;
    var nwp=route.getPointAtOffset(this.editingWp,diff);
    if (! nwp) return;
    this.editingWp=nwp;
    this.navobject.routeEvent();
};

/**
 * get the active wp
 * @returns {navobjects.WayPoint}
 */
RouteData.prototype.getEditingWp=function(){
    return this.editingWp;
};

/**
 * get the index of the active wp from the current route
 * @returns {number}
 */
RouteData.prototype.getEditingWpIdx=function(){
    var wp=this.getEditingWp();
    if (! wp) return -1;
    var route=this.getRoute();
    if (! route) return -1;
    return route.getIndexFromPoint(wp);
};

/**
 * returns the waypoint with the given index from the editing route
 * @param {number} idx
 * @returns {navobjects.WayPoint}
 */

RouteData.prototype.getWp=function(idx){
    var route=this.editingRoute;
    if (! route) return undefined;
    return route.getPointAtIndex(idx);
};
/**
 *
 * @param id
 * @returns {number}
 */
RouteData.prototype.getIdForMinusOne=function(id){
    if (id >= 0) return id;
    if (! this.editingRoute) return -1;
    return this.editingRoute.getIndexFromPoint(this.getEditingWp());
};
/**
 * delete a point from the current route
 * @param {number} id - the index, -1 for active
 */
RouteData.prototype.deleteWp=function(id){
    id=this.getIdForMinusOne(id);
    if (id < 0) return;
    if (! this.editingRoute) return;
    var old=this.editingRoute.getPointAtIndex(id);
    var newWp=this.editingRoute.deletePoint(id); //this returns the next point
    if (newWp){
        this.editingWp=newWp;
    }
    else{
        this._findBestMatchingPoint();
    }
    return this._saveChanges(old, newWp);
};
/**
 * change a point in the route
 * @param {number} id the index, -1 for current
 * @param {navobjects.Point|navobjects.WayPoint} point
 */
RouteData.prototype.changeWpByIdx=function(id, point){
    id=this.getIdForMinusOne(id);
    if (id < 0) return undefined;
    if (! this.editingRoute) return undefined;
    var old=this.editingRoute.getPointAtIndex(id);
    if (! old) return;
    old=old.clone();
    var wp=this.editingRoute.changePointAtIndex(id,point);
    if (! wp) return undefined;
    this.editingWp=wp;
    this._saveChanges(old, wp);
    return wp;
};

/**
 * add a point to the route
 * @param {number} id the index, -1 for current - point is added after
 * @param {navobjects.Point|navobjects.WayPoint} point
 */
RouteData.prototype.addWp=function(id,point){
    id=this.getIdForMinusOne(id);
    if (! this.editingRoute) return;
    this.editingWp=this.editingRoute.addPoint(id,point);
    return this._saveChanges();
};
/**
 * delete all points from the route
 */
RouteData.prototype.emptyRoute=function(){
    this.editingWp=undefined;
    if (! this.editingRoute) return;
    this.editingRoute.points=[];
    return this._saveChanges();
};

/**
 * invert the order of waypoints in the route
 */
RouteData.prototype.invertRoute=function(){
    if (! this.editingRoute) return;
    this.editingRoute.swap();
    return this._saveChanges();
};

/**
 * set a new route to be edited
 * @param {routeobjects.Route} route
 */

RouteData.prototype.setNewEditingRoute=function(route,opt_force_activate){
    if (! route) return;
    var keepActive=opt_force_activate||this.isActiveRoute(route.name);
    var currentTarget=undefined;
    if (! keepActive){
        this.editingRoute=route.clone();
    }
    else {
        currentTarget = this.getCurrentLegTarget();
        this.startEditingRoute(); //this will set the editing to be equal the active
        this.editingRoute.assignFrom(route);
    }
    this._findBestMatchingPoint();
    if (currentTarget){
        var newTarget=this.editingRoute.getPointAtIndex(this.editingRoute.findBestMatchingIdx(currentTarget));
        this.wpOn(newTarget,true);
    }
    this._saveChanges();
    this.lastEditingName=this.editingRoute.name;
};

/**
 * check whether the editing route is writable
 * @returns {boolean}
 */
RouteData.prototype.isRouteWritable=function(){
    if (this.connectMode) return true;
    if (! this.editingRoute) return false;
    return ! this.editingRoute.server;
};


/*---------------------------------------------------------
 editing functions - always
 ----------------------------------------------------------*/
/**
 * change a waypoint
 * the old point can be:
 *   - a point from the current (editing) route
 *   - the currentLeg to point
 * @param {navobjects.WayPoint} oldPoint
 * @param {navobjects.WayPoint} point
 * @returns undefined if the point cannot be changed
 */
RouteData.prototype.changeWp=function(oldPoint, point){
    if (oldPoint.routeName) {
        var route = this.getRouteByName(oldPoint.routeName);
        if (route) {
            var idx = route.getIndexFromPoint(oldPoint);
            if (idx < 0) return undefined; //cannot find old point
            route.changePointAtIndex(idx,point);
        }
        else {
            return undefined; //old point is from a route - but we do not have one
        }
    }
    else{
        if (! oldPoint.compare(this.currentLeg.to)) return undefined; //the old point is not the current target
    }
    this._saveChanges(oldPoint, point);
    return true;
};
/*---------------------------------------------------------
 state changes (edit on/route on/off...)
 ----------------------------------------------------------*/


/**
 * get the currently editing route, undefined if none
 * @returns {routeobjects.Route|*}
 */
RouteData.prototype.getEditingRoute=function(){
    return this.editingRoute;
};
/**
 * stop the route editing mode (throw away the editing route)
 * and reset it to the active route if we have one
 * also setting the editing WP
 */
RouteData.prototype.stopEditingRoute=function(){
    this.editingRoute=this.hasActiveRoute()?this.currentLeg.currentRoute:undefined;
    this.editingWp=this.currentLeg.to;
};
/**
 * start the route edit mode
 * if we already have a route (either active or editing) only the waypoint will be set
 */
RouteData.prototype.startEditingRoute=function(){
    if (this.hasActiveRoute()){
        this.editingWp=this.currentLeg.to.clone();
        this.editingRoute=this.currentLeg.currentRoute;
        this.lastEditingName=this.editingRoute.name;
        globalStore.storeData(keys.nav.routeHandler.editingRoute,this.editingRoute.clone());
        return;
    }
    if (! this.editingRoute){
        this.editingRoute=this._loadRoute(this.lastEditingName);
        this.serverRoute=this.editingRoute.clone();
        this.editingWp=this.editingRoute.getPointAtIndex(0);
        this.lastEditingName=this.editingRoute.name;
        globalStore.storeData(keys.nav.routeHandler.editingRoute,this.editingRoute.clone());
        return;
    }
    this._findBestMatchingPoint();
    this.lastEditingName=this.editingRoute.name;
    globalStore.storeData(keys.nav.routeHandler.editingRoute,this.editingRoute.clone());
    return;
};
/**
 *
 * @param {navobjects.WayPoint} wp
 * @param opt_keep_from
 */
RouteData.prototype.wpOn=function(wp,opt_keep_from) {
    if (! wp) {
        this.routeOff();
        return;
    }
    var stwp=new navobjects.WayPoint.fromPlain(wp);
    if (wp.routeName){
        //if the waypoint seems to be part of a route
        //check if this is our current active/editing one - if yes, start routing mode
        stwp.routeName=wp.routeName;
        var rt=this.getRouteByName(wp.routeName);
        if (!(rt  && rt.getIndexFromPoint(stwp) >= 0)){
            stwp.routeName=undefined;
        }
    }
    if (stwp.routeName){
        this.editingWp=stwp.clone();
        this._startRouting(routeobjects.RoutingMode.ROUTE, stwp, opt_keep_from);
    }
    else {
        this._startRouting(routeobjects.RoutingMode.WP, stwp, opt_keep_from);
    }
};

/**
 *
 * @param {navobjects.WayPoint} wp
 * @param opt_keep_from
 */
RouteData.prototype.wpOnInactive=function(wp,opt_keep_from) {
    var stwp=new navobjects.WayPoint.fromPlain(wp);
    this._startRouting(routeobjects.RoutingMode.WPINACTIVE,stwp,opt_keep_from);
};

/**
 *
 * @param {navobjects.WayPoint} wp
 * @param {number} distance
 */

RouteData.prototype.anchorOn=function(wp,distance){
    this.currentLeg.setAnchorWatch(wp,distance);
    this._legChanged();
};
RouteData.prototype.anchorOff=function(){
    this.currentLeg.anchorDistance=undefined;
    this.currentLeg.to=new navobjects.Point(0,0);
    this.currentLeg.active=false;
    this._legChanged();
};
/**
 *
 * @param mode
 * @param {navobjects.WayPoint} newWp
 * @param {boolean} opt_keep_from
 * @returns {boolean}
 * @private
 */
RouteData.prototype._startRouting=function(mode,newWp,opt_keep_from){
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach+0;
    var pfrom;
    var gps=this.navobject.getGpsHandler().getGpsData();
    var center=this.navobject.getMapCenter();
    if (gps.valid){
        pfrom=new navobjects.WayPoint(gps.lon,gps.lat);
    }
    else{
        pfrom=new navobjects.WayPoint();
        center.assign(pfrom);
    }
    //check if we change the mode - in this case we always set a new from
    if (!this.currentLeg.active){
        opt_keep_from=false;
    }
    else{
        if (this.currentLeg.name){
            //we had a route
            if (mode == routeobjects.RoutingMode.WP || mode == routeobjects.RoutingMode.WPINACTIVE){
                opt_keep_from=false;
            }
            else{
                if (newWp && newWp.routeName != this.currentLeg.name){
                    //we switched to a new route
                    opt_keep_from=false;
                }
            }
        }
        else{
            if (mode == routeobjects.RoutingMode.ROUTE){
                opt_keep_from=false;
            }
        }
    }
    if (! opt_keep_from) this.currentLeg.from=pfrom;
    this.currentLeg.active=false;
    if (mode == routeobjects.RoutingMode.WP){
        this.currentLeg.to=newWp;
        this.currentLeg.name=undefined;
        this.currentLeg.currentRoute=undefined;
        this.currentLeg.active=true;
        this.currentLeg.anchorDistance=undefined;
        this._legChanged();
        return true;
    }
    if (mode == routeobjects.RoutingMode.WPINACTIVE){
        this.currentLeg.to=newWp;
        this.currentLeg.name=undefined;
        this.currentLeg.currentRoute=undefined;
        this.currentLeg.active=false;
        this.currentLeg.anchorDistance=undefined;
        this._legChanged();
        return true;
    }
    if (mode == routeobjects.RoutingMode.ROUTE){
        if (! newWp || ! newWp.routeName) return;
        var route=this.getRouteByName(newWp.routeName);
        if (! route) return;
        var idx=route.getIndexFromPoint(newWp);
        if (idx <0) return;
        this.currentLeg.currentRoute = route;
        this.currentLeg.name = route.name;
        this.currentLeg.to = newWp;
        this.currentLeg.active=true;
        this.currentLeg.anchorDistance=undefined;
        this._legChanged();
        return true;
    }
    return false;
};


RouteData.prototype.routeOff=function(){
    if (! this.getLock()) return; //is already off
    this.currentLeg.active=false;
    this.currentLeg.name=undefined;
    this.currentLeg.currentRoute=undefined;
    this.currentLeg.to.routeName=undefined;
    this._legChanged(); //send deactivate
};

/*---------------------------------------------------------
 route management functions (list, remove...)
 ----------------------------------------------------------*/

/**
 * list functions for routes
 * works async
 * @param server
 * @param okCallback function that will be called with a list of RouteInfo
 * @param opt_failCallback
 */
RouteData.prototype.listRoutesServer=function(okCallback,opt_failCallback,opt_callbackData){
    var self=this;
    return this._remoteRouteOperation("listroutes",{
        okcallback:function(data,param){
            if ((data.status && data.status!='OK') || (!data.items)) {
                if (opt_failCallback) {
                    opt_failCallback(data.status || "no items", param.callbackdata)
                    return;
                }
            }
            var items = [];
            var i;
            for (i = 0; i < data.items.length; i++) {
                var ri = new routeobjects.RouteInfo();
                avnav.assign(ri, data.items[i]);
                ri.server = true;
                ri.time=ri.time*1e3; //we receive TS in s
                if (self.isActiveRoute(ri.name)) ri.active=true;
                items.push(ri);
            }
            okCallback(items, param.callbackdata);

        },
        errorcallback:function(err,param){
            if (opt_failCallback){
                opt_failCallback(err,param.callbackdata)
            }
        },
        callbackdata:opt_callbackData

    });
};
/**
 * list local routes
 * returns a list of RouteInfo
 */
RouteData.prototype.listRoutesLocal=function(){
    var rt=[];
    var i=0;
    var key,rtinfo,route;
    var routeprfx=this.propertyHandler.getProperties().routeName+".";
    for (i=0;i<localStorage.length;i++){
        key=localStorage.key(i);
        if (key.substr(0,routeprfx.length)==routeprfx){
            rtinfo=new routeobjects.RouteInfo(key.substr(routeprfx.length));
            try {
                route=new routeobjects.Route();
                route.fromJsonString(localStorage.getItem(key));
                if (route.points) rtinfo.numpoints=route.points.length;
                rtinfo.length=this.computeLength(0,route);
                rtinfo.time=route.time;
                if (this.isActiveRoute(rtinfo.name)) rtinfo.active=true;

            } catch(e){}
            rt.push(rtinfo);
        }

    }
    return rt;
};
/**
 * delete a route both locally and on server
 * @param name
 * @param opt_errorcallback
 */
RouteData.prototype.deleteRoute=function(name,opt_okcallback,opt_errorcallback,opt_localonly){
    var rt=this._loadRoute(name,true);
    if ((! rt || rt.server) && ! this.connectMode && ! opt_localonly){
        if (opt_errorcallback){
            setTimeout(function(){
                opt_errorcallback("server route and we are disconnected");
            },0);
        }
        return false;
    }
    try{
        localStorage.removeItem(this.propertyHandler.getProperties().routeName+"."+name);
    }catch(e){}
    if (this.connectMode && ! opt_localonly){
        this._remoteRouteOperation("deleteroute",{
            name:name,
            errorcallback:opt_errorcallback,
            okcallback:opt_okcallback
        });
    }
    else {
        if (opt_okcallback){
            setTimeout(function(){
                opt_okcallback();
            },0);
        }
    }
};
/**
 *
 * @param name
 * @param localOnly - force local only access even if we are connected
 * @param okcallback
 * @param opt_errorcallback
 */
RouteData.prototype.fetchRoute=function(name,localOnly,okcallback,opt_errorcallback){
    var route;
    if (localOnly || ! this.connectMode){
        route=this._loadRoute(name,true);
        if (route){
            setTimeout(function(){
                okcallback(route);
            },0);
        }
        else if (opt_errorcallback){
            setTimeout(function(){
                opt_errorcallback(name);
            },0);
        }
        return;
    }
    this._remoteRouteOperation("getroute",{
        name:name,
        self:this,
        f_okcallback:okcallback,
        f_errorcallback:opt_errorcallback,
        okcallback: function(data,param){
            var rt=new routeobjects.Route(param.name);
            rt.fromJson(data);
            rt.server=true;
            if (rt.time) rt.time=rt.time*1000;
            param.self._saveRouteLocal(rt,true);
            if (param.f_okcallback){
                param.f_okcallback(rt);
            }
        },
        errorcallback:function(status,param){
            if (param.f_errorcallback){
                param.f_errorcallback(param.name);
            }
        }
    });
};

/*---------------------------------------------------------
 routing (next wp...)
 ----------------------------------------------------------*/

/**
 * @private
 * check if we have to switch to the next WP
 */
RouteData.prototype._checkNextWp=function(){
    if (! this.currentLeg.active || ! this.currentLeg.name || ! this.currentLeg.currentRoute) {
        this.currentLeg.approach=false;
        this.isApproaching=false;
        return;
    }
    var boat=this.navobject.getGpsHandler().getGpsData();
    //TODO: switch of routing?!
    if (! boat.valid) return;
    var nextWpNum=this.currentLeg.getCurrentTargetIdx()+1;
    var nextWp=this.currentLeg.currentRoute.getPointAtIndex(nextWpNum);
    var approach=this.propertyHandler.getProperties().routeApproach;
    var tolerance=approach/10; //we allow some position error...
    try {
        var dst = NavCompute.computeDistance(boat, this.currentLeg.to);
        //TODO: some handling for approach
        if (dst.dts <= approach){
            this.isApproaching=true;
            this.currentLeg.approach=true;
            var nextDst=new navobjects.Distance();
            if (nextWp){
                nextDst=NavCompute.computeDistance(boat, nextWp);
            }
            if (this.lastDistanceToCurrent < 0 || this.lastDistanceToNext < 0){
                //seems to be the first time
                this.lastDistanceToCurrent=dst.dts;
                this.lastDistanceToNext=nextDst.dts;
                return;
            }
            //check if the distance to own wp increases and to the nex decreases
            var diffcurrent=dst.dts-this.lastDistanceToCurrent;
            if (diffcurrent <= tolerance){
                //still decreasing
                if (diffcurrent <= 0) {
                    this.lastDistanceToCurrent = dst.dts;
                    this.lastDistanceToNext = nextDst.dts;
                }
                return;
            }
            var diffnext=nextDst.dts-this.lastDistanceToNext;
            if (nextWp && (diffnext > -tolerance)){
                //increases to next
                if (diffnext > 0) {
                    this.lastDistanceToCurrent = dst.dts;
                    this.lastDistanceToNext = nextDst.dts;
                }
                return;
            }
            //should we wait for some time???
            if (nextWp) {
                this.currentLeg.to=nextWp;
                this._legChanged();
                if (this.isEditingActiveRoute()) {
                    this.editingWp = nextWp;
                }
                avnav.log("switching to next WP");
                //TODO: should we fire a route event?
            }
            else {
                this.routeOff();
                avnav.log("end of route reached");
            }
        }
        else{
            this.isApproaching=false;
            this.currentLeg.approach=false;
        }
    } catch (ex){} //ignore errors
};

/*---------------------------------------------------------
 internal helpers
 ----------------------------------------------------------*/

/**
 * save the changes we did - either to the current leg or to the editing route
 * if oldWp and newWp are given we check if the old wp was the current target
 * and update this accordingly
 * @param {navobjects.WayPoint|undefined} oldWp - if set - compare this to the current "to" and set a new destination (new WP) if equal
 * @param {navobjects.WayPoint|undefined} newWp - if set make this the new routing target
 * @returns {boolean} true if we already saved, otherwise saveRoute must be called
 * @private
 */
RouteData.prototype._saveChanges= function (oldWp, newWp){
    var changeActive=this.isEditingActiveRoute();
    var routeName;
    if (newWp && newWp.routeName){
        if (! oldWp){
            avnav.log("missing oldwp in _saveChanges");
            return false;
        }
        if (! oldWp.routeName || oldWp.routeName != newWp.routeName){
            avnav.log("cannot transfer wp between routes in _saveChanges");
            return false;
        }
        routeName=newWp.routeName;
    }
    if (routeName) {
        if (!this.isEditingRoute(routeName)) {
            avnav.log("trying to change a waypoint of an inactive route, ignore");
            return false;
        }
    }
    if (oldWp){
        if (oldWp.compare(this.currentLeg.to)){
            if (newWp) this.wpOn(newWp,true);
            else this.routeOff();
        }
    }
    if (changeActive && this.currentLeg.currentRoute){
        if (this.currentLeg.to.routeName !=this.currentLeg.currentRoute.name){
            this.currentLeg.to.routeName =this.currentLeg.currentRoute.name;
        }
        if (this.currentLeg.currentRoute.points.length ==0){
            this.routeOff();
        }
    }
    globalStore.storeData(keys.nav.routeHandler.editingRoute,this.editingRoute.clone());
    this.saveRoute();
    if (changeActive) this._legChanged();
    else {
        this.navobject.routeEvent();
    }
    return true;
};

/**
 *
 * @param data
 * @private
 * @return {Boolean} - true if data has changed
 */
RouteData.prototype._handleLegResponse=function(data) {
    if (!data) {
        this.serverConnected = false;
        return false;
    }
    this.routeErrors=0;
    this.serverConnected=true;
    if (! data.from) return false;
    var nleg=new routeobjects.Leg();
    nleg.fromJson(data);
    if (!nleg.differsTo(this.serverLeg)) {
        return false;
    }
    this.serverLeg=nleg;

    if (this.connectMode ) {
        if (this.serverLeg.differsTo(this.currentLeg)) {
            var editActive=this.isEditingActiveRoute();
            this.currentLeg = this.serverLeg.clone();
            if (this.currentLeg.name){
                if (! this.currentLeg.currentRoute){
                    var route=this._loadRoute(this.currentLeg.name);
                    if (route){
                        this.currentLeg.currentRoute=route;
                        this.currentLeg.name=route.name;
                    }
                    else{
                        this.currentLeg.currentRoute=new routeobjects.Route(this.currentLeg.name);
                    }
                }
            }
            if (editActive){
                this.editingRoute=this.currentLeg.currentRoute;
            }
            this._saveLegLocal();
            if (this.isEditingActiveRoute()){
                this._findBestMatchingPoint();
            }
            this.navobject.routeEvent();
        }
    }
};
/**
 *
 * @param operation: getroute,listroutes,setroute,deleteroute
 * @param param {object}
 *        okcallback(data,param)
 *        errorcallback(errdata,param)
 *        name for operation load
 *        route for operation save
 * @private
 *
 */
RouteData.prototype._remoteRouteOperation=function(operation, param) {
    var url = this.propertyHandler.getProperties().navUrl + "?request=routing&command=" + operation;
    var type="GET";
    var data=undefined;
    if (operation == "getroute" || operation=="deleteroute") {
        url += "&name=" + encodeURIComponent(param.name);
    }
    if(operation=="setroute"){
        if (avnav.android){
            avnav.log("android: setRoute");
            var status=avnav.android.storeRoute(param.route.toJsonString());
            var jstatus=JSON.parse(status);
            if (jstatus.status == "OK" && param.okcallback){
                setTimeout(function(){
                   param.okcallback(jstatus,param);
                },0);
            }
            if (param.errorcallback){
                setTimeout(function(){
                    param.errorcallback(jstatus.status,param);
                },0);
            }
            return;
        }
        type="POST";
        data=param.route.toJsonString();
    }
    var responseType="json";
    avnav.log("remoteRouteOperation, operation="+operation+", response="+responseType+", type="+type);
    param.operation=operation;
    $.ajax({
        url: url,
        type: type,
        data: data?data:undefined,
        dataType: responseType,
        contentType: "application/json; charset=utf-8",
        cache: false,
        success: function (data, status) {
            if (responseType == "json" && data.status && data.status != "OK") {
                //seems to be some error
                avnav.log("query route error: " + data.status);
                if (param.errorcallback){
                    param.errorcallback(data.status,param);
                }
                return;
            }
            if (param.okcallback) {
                if (responseType=="text" && operation=="getroute"){
                    avnav.log("convert route from xml: "+data);
                    var route=new routeobjects.Route();
                    route.fromXml(data);
                    data=route.toJson();
                    avnav.log("converted Route: "+route.toJsonString());
                }
                param.okcallback(data, param);
            }
        },
        error: function (status, data, error) {
            avnav.log("query route error");
            if (param.errorcallback){
                param.errorcallback(error,param);
            }
        },
        timeout: 10000
    });
};

/**
 * @private
 */
RouteData.prototype._startQuery=function() {
    this._checkNextWp();
    var url = this.propertyHandler.getProperties().navUrl+"?request=routing&command=getleg";
    var timeout = this.propertyHandler.getProperties().routeQueryTimeout; //in ms!
    var self = this;
    if (! this.connectMode ){
        self.timer=window.setTimeout(function() {
            self._startQuery();
        },timeout);
        return;
    }
    else {
        $.ajax({
            url: url,
            dataType: 'json',
            cache: false,
            success: function (data, status) {
                var change = self._handleLegResponse(data);
                avnav.log("leg data change=" + change);
                self.timer = window.setTimeout(function () {
                    self._startQuery();
                }, timeout);
            },
            error: function (status, data, error) {
                avnav.log("query leg error");
                this.routeErrors++;
                if (this.routeErrors > 10) {
                    avnav.log("lost route");
                    this.serverConnected = false;
                }
                self.timer = window.setTimeout(function () {
                    self._startQuery();
                }, timeout);
            },
            timeout: 10000
        });
    }
    //we only query the route separately if it is currently not active
    if (! this.isEditingActiveRoute()) {
        if (! this.editingRoute) return;
        if (! this.connectMode) return;
        //we always query the server to let him overwrite what we have...
        //if (! this.editingRoute.server) return;
        this._remoteRouteOperation("getroute",{
            name:this.editingRoute.name,
            okcallback:function(data,param){
                var nRoute = new routeobjects.Route();
                nRoute.fromJson(data);
                nRoute.server=true;
                var change = nRoute.differsTo(self.serverRoute)
                avnav.log("route data change=" + change);
                if (change) {
                    self.serverRoute = nRoute;
                    if (!self.isEditingActiveRoute() && self.editingRoute && self.editingRoute.differsTo(self.serverRoute)) {
                        self.editingRoute = self.serverRoute.clone();
                        self.saveRoute();
                        self._findBestMatchingPoint();
                        self.navobject.routeEvent();
                    }

                }
            },
            errorcallback: function(status,param){

            }
        });

    }
};



/**
 * @private
 */
RouteData.prototype._saveRouteLocal=function(opt_route, opt_keepTime) {
    var route = opt_route;
    if (!route) {
        route = this.getRoute();
        if (!route) return route;

    }
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime();
    var str = route.toJsonString();
    localStorage.setItem(this.propertyHandler.getProperties().routeName + "." + route.name, str);
    return route;
};


/**
 * load a locally stored route
 * @private
 * @param name
 * @param opt_returnUndef - if set, return undef instead of an empty route if not found
 * @returns {routeobjects.Route}
 */
RouteData.prototype._loadRoute=function(name,opt_returnUndef){
    var rt=new routeobjects.Route(name);
    try{
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routeName+"."+name);
        if (! raw && name == this.DEFAULTROUTE){
            //fallback to load the old default route
            raw=localStorage.getItem(this.FALLBACKROUTENAME);
        }
        if (raw) {
            avnav.log("route "+name+" successfully loaded");
            rt.fromJsonString(raw);
            if (this.readOnlyServer) rt.server=false;
            return rt;
        }
        if (opt_returnUndef){
            return undefined;
        }
    }catch(ex){
        if (opt_returnUndef) return undefined;
    }
    return rt;
};

/**
 * save the current leg info
 * @private
 */
RouteData.prototype._saveLegLocal=function(){
    var raw=this.currentLeg.toJsonString();
    localStorage.setItem(this.propertyHandler.getProperties().routingDataName,raw);
};

/**
 * @private
 * try to set the active waypoint to the one that is closest to the position
 * we had before
 */
RouteData.prototype._findBestMatchingPoint=function(){
    if (! this.editingRoute) return;
    if (! this.editingWp) return;
    var idx=this.editingRoute.findBestMatchingIdx(this.editingWp);
    this.editingWp=this.editingRoute.getPointAtIndex(idx);
};


/**
 * send the route
 * @private
 * @param {routeobjects.Route} route
 * @param {function} opt_callback -. will be called on result, param: true on success
 */
RouteData.prototype._sendRoute=function(route, opt_callback){
    //send route to server
    var self=this;
    var sroute=route.clone();
    if (sroute.time) sroute.time=sroute.time/1000;
    this._remoteRouteOperation("setroute",{
        route:route,
        self:self,
        okcallback:function(data,param){
            avnav.log("route sent to server");
            if (opt_callback)opt_callback(true);
        },
        errorcallback:function(status,param){
            if (param.self.propertyHandler.getProperties().routingServerError) Overlay.Toast("unable to send route to server:" + errMsg);
            if (opt_callback) opt_callback(false);
        }
    });
};


/**
 * leg has changed - save it and reset approach data
 * @returns {boolean}
 * @private
 */
RouteData.prototype._legChanged=function(){
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    this._saveLegLocal();
    let old=globalStore.getData(keys.nav.routeHandler.currentLeg);
    if (!old || old.differsTo(this.currentLeg)){
        globalStore.storeData(keys.nav.routeHandler.currentLeg,this.currentLeg.clone());
    }
    this.navobject.routeEvent();
    var self=this;
    this.checkPageRouteActive();
    if (avnav.android){
        var rt=avnav.android.setLeg(this.currentLeg.toJsonString());
        if (rt){
            try{
                rt=JSON.parse(rt);
                if (rt.status && rt.status === "OK") return;
            }catch(e){}
        }
        Overlay.Toast("unable to save leg: "+((rt && rt.status)?rt.status:""));
        return;
    }
    if (this.connectMode){
        $.ajax({
            type: "POST",
            url: this.propertyHandler.getProperties().navUrl+"?request=routing&command=setleg",
            data: this.currentLeg.toJsonString(),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data){
                if (data && data.status && data.status !== "OK"){
                    Overlay.Toast("unable to send leg to server:" + data.status);
                }
                avnav.log("new leg sent to server");
            },
            error: function(errMsg,x) {
                if (self.propertyHandler.getProperties().routingServerError) Overlay.Toast("unable to send leg to server:" +errMsg);
            }
        });
    }
    return true;
};


/**
 * @private
 * @param evdata
 */
RouteData.prototype.dataChanged=function() {
    var oldcon=this.connectMode;
    this.connectMode=this.propertyHandler.getProperties().connectedMode;
    this.readOnlyServer=this.propertyHandler.getProperties().readOnlyServer;
    if (oldcon != this.connectMode && this.connectMode){
        //newly connected
        var oldActive;
        if (this.serverConnected && this.serverRoute) {
            this.editingRoute = this.serverRoute.clone();
        }
        if (this.serverConnected && this.serverLeg){
            this.currentLeg=this.serverLeg.clone();
        }
        this.navobject.routeEvent();
    }
};

RouteData.prototype.setRouteForPage=function(opt_route){
    let route=opt_route||this.editingRoute;
    globalStore.storeData(keys.nav.routeHandler.routeForPage,route?route.clone():undefined);
    this.checkPageRouteActive();
};

RouteData.prototype.checkPageRouteActive=function(){
    let pageRoute=globalStore.getData(keys.nav.routeHandler.routeForPage);
    globalStore.storeData(keys.nav.routeHandler.pageRouteIsActive,pageRoute && this.isActiveRoute(pageRoute.name));
};
module.exports=RouteData;

