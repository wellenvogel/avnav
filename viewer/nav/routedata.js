/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.RouteData');
avnav.provide('avnav.nav.Route');
avnav.provide('avnav.nav.Leg');
avnav.provide('avnav.nav.RouteInfo');
avnav.provide('avnav.nav.RoutingMode');

avnav.nav.RoutingMode={
    CENTER: 0,      //route to current map center
    ROUTE:  1      //route to the currently selected Point of the route
};

avnav.nav.Leg=function(from,to,active,opt_routeName,opt_routeTarget){
    /**
     * start of leg
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.from=from|| new avnav.nav.navdata.WayPoint();
    /**
     * current target waypoint
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.to=to||new avnav.nav.navdata.WayPoint();
    /**
     * is the leg active?
     * @type {boolean}
     */
    this.active=active||false;
    /**
     * if set the route with this name is active
     * @type {boolean}
     */
    this.name=opt_routeName;
    /**
     * the index of the active waypoint in the route, -1 for none
     * @type {number}
     */
    this.currentTarget=(opt_routeTarget !== undefined)?opt_routeTarget:-1;

    /**
     * whether we are currently approaching
     * @type {boolean}
     */
    this.approach=false;
    /**
     * the approach distance (in m)
     * @type {number}
     */
    this.approachDistance=0; //to be set from properties

    /**
     * the current route
     * @type {avnav.nav.Route}
     */
    this.currentRoute=undefined;
};

avnav.nav.Leg.prototype.clone=function(){
    var rt=new avnav.nav.Leg(avnav.clone(this.from),avnav.clone(this.to),this.active,
        this.name?this.name.slice(0):undefined,this.currentTarget);
    rt.approach=false;
    rt.approachDistance=this.approachDistance;
    rt.currentRoute=this.currentRoute?this.currentRoute.clone():undefined;
    return rt;
};
/**
 * convert the leg into a json string
 * @returns {string}
 */
avnav.nav.Leg.prototype.toJsonString=function(){
    var rt={
        from: this.from,
        to: this.to,
        name: this.name,
        active: this.active,
        currentTarget: this.currentTarget,
        approach: this.approach,
        approachDistance: this.approachDistance,
        currentRoute: this.currentRoute?this.currentRoute.toJson():undefined
    };
    return JSON.stringify(rt);
};

/**
 * fill a leg object from a json string
 * @param jsonString
 * @returns {avnav.nav.Leg}
 */
avnav.nav.Leg.prototype.fromJsonString=function(jsonString) {
    var raw = JSON.parse(jsonString);
    return this.fromJson(raw);
};
/**
 * fill the leg from json
 * @param raw
 * @returns {avnav.nav.Leg}
 */
avnav.nav.Leg.prototype.fromJson=function(raw){
    this.from=avnav.nav.navdata.WayPoint.fromPlain(raw.from);
    this.to=avnav.nav.navdata.WayPoint.fromPlain(raw.to);
    this.active=raw.active||false;
    this.currentTarget=(raw.currentTarget !== undefined)?raw.currentTarget:-1;
    this.name=raw.name;
    this.approach=raw.approach;
    this.approachDistance=raw.approachDistance;
    if (raw.currentRoute){
        this.currentRoute=new avnav.nav.Route(raw.currentRoute.name);
        this.currentRoute.fromJson(raw.currentRoute);
        this.name=this.currentRoute.name;
    }
    return this;
};

/**
 * check if the leg differs from another leg
 * we do not consider the approach distance
 * @param {avnav.nav.Leg} leg2
 * @returns {boolean} true if differs
 */
avnav.nav.Leg.prototype.differsTo=function(leg2){
    if (! leg2) return true;
    var leg1=this;
    var changed = false;
    var i;
    var wps = ['from', 'to'];
    for (i in wps) {
        var wp=wps[i];
        if (leg1[wp]) {
            if (!leg2[wp]) changed = true;
            else {
                if (leg1[wp].lat != leg2[wp].lat ||
                    leg1[wp].lon != leg2[wp].lon ||
                    leg1[wp].name != leg2[wp].name) changed = true
            }
        }
        else if (leg2[wp]) changed = true;
    }
    if (leg1.name != leg2.name) changed=true;
    if (leg1.currentTarget != leg2.currentTarget) changed=true;
    if (leg1.active != leg2.active) changed=true;
    if (leg1.approach != leg2.approach) changed=true;
    if ((leg1.currentRoute && ! leg2.currentRoute) || (! leg1.currentRoute && leg2.currentRoute)) changed=true;
    if (leg1.currentRoute && leg2.currentRoute && ! changed) changed=leg1.currentRoute.differsTo(leg2.currentRoute);
    return changed;
};


/**
 *
 * @param {string} name
 * @param {Array.<avnav.nav.navdata.WayPoint>} opt_points
 * @constructor
 */
avnav.nav.Route=function(name,opt_points){

    /**
     * the route name
     * @type {string}
     */
    this.name=name;
    if (! this.name)this.name="default";

    /**
     * the route points
     * @type {Array.<avnav.nav.navdata.WayPoint>|Array}
     */
    this.points=opt_points||[];
    /**
     * the timestamp of last modification
     * @type {number}
     */
    this.time=new Date().getTime();
};

/**
 * fill a route from a Json string
 * @param jsonString
 * @returns {*}
 */
avnav.nav.Route.prototype.fromJsonString=function(jsonString) {
    var parsed = JSON.parse(jsonString);
    return this.fromJson(parsed);
};
/**
 * fill the route from json
 * @param parsed
 */
avnav.nav.Route.prototype.fromJson=function(parsed) {
    this.name=parsed.name||"default";
    this.time=parsed.time||0;
    this.points=[];
    var i;
    var wp;
    if (parsed.points){
        for (i in parsed.points){
            wp=avnav.nav.navdata.WayPoint.fromPlain(parsed.points[i]);
            this.points.push(wp);
        }
    }
    return this;
};
avnav.nav.Route.prototype.toJson=function(){
    var rt={};
    rt.name=this.name;
    rt.time=this.time;
    rt.points=[];
    var i;
    for (i in this.points){
        rt.points.push(this.points[i]);
    }
    return rt;
};

avnav.nav.Route.prototype.toJsonString=function(){
    return JSON.stringify(this.toJson());
};
/**
 * check if a route differs to another route
 * @param {avnav.nav.Route} route2
 * @returns {boolean} true if differs
 */
avnav.nav.Route.prototype.differsTo=function(route2){
    if (! route2) return true;
    if (this.name != route2.name) return true;
    if (this.points.length != route2.points.length) return true;
    var i;
    for (i=0;i<this.points.length;i++){
        if (this.points[i].lon != route2.points[i].lon) return true;
        if (this.points[i].lat != route2.points[i].lat) return true;
        if (this.points[i].name != route2.points[i].name) return true;
    }
    return false;
};

/**
 * deep copy
 * @returns {avnav.nav.Route}
 */
avnav.nav.Route.prototype.clone=function(){
    var str=this.toJsonString();
    var rt=new avnav.nav.Route();
    rt.fromJsonString(str);
    return rt;
};

avnav.nav.RouteInfo=function(name,opt_server){
    /**
     * the name of the route
     * @type {string}
     */
    this.name=name||"default";
    /**
     * is this a route from the server
     * @type {boolean}
     */
    this.server=opt_server||false;
    /**
     * the length in nm
     * @type {number}
     */
    this.length=0;
    /**
     * the number of waypoints
     * @type {number}
     */
    this.numpoints=0;
    /**
     * UTC timestamp
     * @type {number}
     */
    this.time=0;
};



/**
 * the handler for the routing data
 * query the server...
 * basically it can work in 2 modes:
 * active route mode - the currentleg and the editingRoute will kept in sync
 * editing mode      - the editing route is different from the one in the leg
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.nav.RouteData=function(propertyHandler,navobject){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navobject;
    /** @private
     * @type {}
     * */
    this.serverLeg=new avnav.nav.Leg();
    this.currentLeg=new avnav.nav.Leg(
            new avnav.nav.navdata.WayPoint(0,0),
            new avnav.nav.navdata.WayPoint(0,0),
            false);
    /**
     * name of the default route
     * @type {string}
     */
    this.DEFAULTROUTE="default";
    this.FALLBACKROUTENAME="avnav.defaultRoute"; //a fallback name for the default route
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach;

    try {
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routingDataName);
        if (raw){
            this.currentLeg.fromJsonString(raw);
        }
    }catch(e){
        log("Exception reading currentLeg "+e);
    }
    if (this.currentLeg.name && ! this.currentLeg.currentRoute){
        //migrate from old stuff
        var route=this.loadRoute(this.currentLeg.name);
        if (route){
            this.currentLeg.currentRoute=route;
            this.currentLeg.name=route.name;
        }
        else {
            this.currentLeg.currentRoute=new avnav.nav.Route(this.currentLeg.name);
        }
    }
    /**
     * @private
     * @type {boolean}
     */
    this.connectMode=this.propertyHandler.getProperties().connectedMode;
    /**
     * the index of the active waypoint
     * this is the wp used for editing at the navpage
     * the current routing destination is set at the route
     * @private
     * @type {number}
     */
    this.editingWpIdx=0;

    /**
     * the current coordinates of the active WP (if set)
     * used to find the best matching point if the route changes
     * @private
     * @type {avnav.nav.davdata.WayPoint}
     */
    this.editingWp=undefined;
    /**
     * the current route
     * @private
     * @type {avnav.nav.Route}
     */
    this.editingRoute=this.currentLeg.currentRoute?this.currentLeg.currentRoute:this.loadRoute(this.currentLeg.name||this.DEFAULTROUTE);
    /**
     * the last received route from server
     * initially we set this to our route to get the route from the server if it differs
     * @type {avnav.nav.Route}
     */
    this.serverRoute=this.editingRoute.clone();
    if (this.currentLeg.name) this.editingWpIdx=this.currentLeg.currentTarget;
    if (this.editingWpIdx >= this.editingRoute.points.length) this.editingWp=this.editingRoute.points-length-1;
    if (this.editingWpIdx <0) this.editingWpIdx=0;
    this.editingWp=this.getEditingWp();


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

    this.startQuery();
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
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    var self=this;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};

/**
 * sync the editing route from the leg
 * only if we are in active route mode
 */
avnav.nav.RouteData.prototype.syncRouteFromLeg=function(){
    if (! this.isEditingActiveRoute()) return;
    this.setRouteFromLeg();
};

/**
 * set the current route from the active leg
 * this stops the editing mode
 */
avnav.nav.RouteData.prototype.setRouteFromLeg=function() {
    if (this.currentLeg.currentRoute){
        this.editingRoute=this.currentLeg.currentRoute.clone();
    }
    else {
        this.editingRoute=new avnav.nav.Route();
    }
    this.findBestMatchingPoint();
    this.saveRoute();
    this.navobject.routeEvent();
};
/**
 * set the route currently being edited als the current active one
 * this also set the current target to the active WP
 */
avnav.nav.RouteData.prototype.setLegFromRoute=function(){
    if (this.editingRoute){
        this.currentLeg.currentRoute=this.editingRoute.clone();
        this.currentLeg.name=this.editingRoute.name;
        this.currentLeg.currentTarget=this.editingWpIdx;
        if (this.currentLeg.currentTarget >= this.currentLeg.currentRoute.points.length){
            this.currentLeg.currentTarget = this.currentLeg.currentRoute.points.length-1;
        }
        if (this.currentLeg.currentTarget < 0){
            this.currentLeg.active=false;
        }
        else{
            this.currentLeg.to=this.currentLeg.currentRoute.points[this.currentLeg.currentTarget];
        }
    }
    else {
        this.currentLeg.currentRoute=undefined;
        this.currentLeg.name=undefined;
        this.currentLeg.currentTarget=0;
    }
};
/**
 * sync the route to the leg if we are in active route mode
 */
avnav.nav.RouteData.prototype.syncRouteToLeg=function(){
    if (! this.isEditingActiveRoute()) return;
    this.setLegFromRoute();
};

/**
 * reset the editing route to the active route
 * also setting the active WP
 */
avnav.nav.RouteData.prototype.resetToActive=function(){
    if (this.isEditingActiveRoute()) return;
    this.editingWpIdx=this.currentLeg.currentTarget||0;
    this.setRouteFromLeg();
};


/**
 * compute the length of the route from the given startpoint
 * @param {number} startIdx
 * @returns {number} distance in nm
 */
avnav.nav.RouteData.prototype.computeLength=function(startIdx,opt_route){
    var rt=0;
    if (! opt_route) opt_route=this.editingRoute;
    if (! opt_route) return 0;
    if (startIdx == -1) startIdx=this.currentLeg.currentTarget;
    if (startIdx < 0) startIdx=0;
    if (opt_route.points.length < (startIdx+2)) return rt;
    var last=opt_route.points[startIdx];
    startIdx++;
    for (;startIdx<opt_route.points.length;startIdx++){
        var next=opt_route.points[startIdx];
        var dst=avnav.nav.NavCompute.computeDistance(last,next);
        rt+=dst.dtsnm;
        last=next;
    }
    return rt;
};
/**
 *
 * @param data
 * @private
 * @return {Boolean} - true if data has changed
 */
avnav.nav.RouteData.prototype.handleLegResponse=function(data) {
    if (!data) {
        this.serverConnected = false;
        return false;
    }
    this.routeErrors=0;
    this.serverConnected=true;
    if (! data.to || ! data.from) return false;
    var nleg=new avnav.nav.Leg();
    nleg.fromJson(data);
    if (!nleg.differsTo(this.serverLeg)) {
        return false;
    }
    this.serverLeg=nleg;

    if (this.connectMode ) {
        if (this.serverLeg.differsTo(this.currentLeg)) {
            var activeMode=this.isEditingActiveRoute();
            this.currentLeg = this.serverLeg.clone();
            if (this.currentLeg.name){
                if (! this.currentLeg.currentRoute){
                    var route=this.loadRoute(this.currentLeg.name);
                    if (route){
                        this.currentLeg.currentRoute=route;
                        this.currentLeg.name=route.name;
                    }
                    else{
                        this.currentLeg.currentRoute=new avnav.nav.Route(this.currentLeg.name);
                    }
                }
            }
            this.syncRouteFromLeg();
            this.saveLeg();
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
 *
 */
avnav.nav.RouteData.prototype.remoteRouteOperation=function(operation,param) {
    url = this.propertyHandler.getProperties().navUrl + "?request=routing&command=" + operation;
    var type="GET";
    var data=undefined;
    if (operation == "getroute" || operation=="deleteroute") {
        url += "&name=" + encodeURIComponent(param.name);
    }
    if(operation=="setroute"){
        type="POST";
        data=param.route.toJsonString();
    }
    param.operation=operation;
    $.ajax({
        url: url,
        type: type,
        data: data?data:undefined,
        dataType: 'json',
        contentType: "application/json; charset=utf-8",
        cache: false,
        success: function (data, status) {
            if (data.status && data.status != "OK") {
                //seems to be some error
                log("query route error: " + data.status);
                if (param.errorcallback){
                    param.errorcallback(data.status,param);
                }
                return;
            }
            if (param.okcallback) {
                param.okcallback(data, param);
            }
        },
        error: function (status, data, error) {
            log("query route error");
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
avnav.nav.RouteData.prototype.startQuery=function() {
    this.checkNextWp();
    var url = this.propertyHandler.getProperties().navUrl+"?request=routing&command=getleg";
    var timeout = this.propertyHandler.getProperties().routeQueryTimeout; //in ms!
    var self = this;
    if (! this.connectMode){
        self.timer=window.setTimeout(function() {
            self.startQuery();
        },timeout);
        return;
    }
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            var change = self.handleLegResponse(data);
            log("leg data change="+change);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            log("query leg error");
            this.routeErrors++;
            if (this.routeErrors > 10){
                log("lost route");
                this.serverConnected=false;
            }
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });
    //we only query the route separately if it is currently not active
    if (! this.isEditingActiveRoute()) {
        if (! this.editingRoute) return;
        if (! this.connectMode) return;
        this.remoteRouteOperation("getroute",{
            name:this.editingRoute.name,
            okcallback:function(data,param){
                var nRoute = new avnav.nav.Route();
                nRoute.fromJson(data);
                var change = nRoute.differsTo(self.serverRoute)
                log("route data change=" + change);
                if (change) {
                    self.serverRoute = nRoute;
                    if (self.editingRoute.differsTo(self.serverRoute)) {
                        self.editingRoute = self.serverRoute.clone();
                        self.saveRoute();
                        self.findBestMatchingPoint();
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
 * return the current leg
 * @returns {avnav.nav.Leg}
 */
avnav.nav.RouteData.prototype.getRouteData=function(){
    return this.currentLeg;
};

/**
 * return the current route
 * @returns {avnav.nav.Route}
 */
avnav.nav.RouteData.prototype.getCurrentRoute=function(){
    return this.editingRoute;
};
/**
 * change the name of the route
 * this will stop our active mode and move us to edit mode
 * @param name {string}
 */
avnav.nav.RouteData.prototype.changeRouteName=function(name){
    if (! this.editingRoute){
        this.editingRoute=new avnav.nav.Route();
    }
    this.editingRoute.name=name;
    log("switch to new route");
    this.saveRoute();
    this.navobject.routeEvent();
};

/**
 * @private
 */
avnav.nav.RouteData.prototype.saveRouteLocal=function(opt_route,opt_keepTime) {
    var route = opt_route;
    if (!route) {
        route = this.editingRoute;
        if (!route) return route;

    }
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime();
    var str = route.toJsonString();
    localStorage.setItem(this.propertyHandler.getProperties().routeName + "." + route.name, str);
    return route;
};

avnav.nav.RouteData.prototype.saveRoute=function(opt_route) {
    var route=this.saveRouteLocal(opt_route);
    if (! route ) return;
    //send the route to the server if this is not the active one
    if ( ! this.isEditingActiveRoute()) {
        if (this.connectMode) this.sendRoute(route);
    }
};
/**
 * load a locally stored route
 * @private
 * @param name
 * @returns {avnav.nav.Route}
 */
avnav.nav.RouteData.prototype.loadRoute=function(name){
    var rt=new avnav.nav.Route(name);
    try{
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routeName+"."+name);
        if (! raw && name == this.DEFAULTROUTE){
            //fallback to load the old default route
            raw=localStorage.getItem(this.FALLBACKROUTENAME);
        }
        if (raw) {
            log("route "+name+" successfully loaded");
            rt.fromJsonString(raw);
            return rt;
        }
    }catch(ex){}
    return rt;
};

/**
 * save the current leg info
 * @private
 */
avnav.nav.RouteData.prototype.saveLeg=function(){
    var raw=this.currentLeg.toJsonString();
    localStorage.setItem(this.propertyHandler.getProperties().routingDataName,raw);
};

/**
 * @private
 * try to set the active waypoint to the one that is closest to the position
 * we had before
 */
avnav.nav.RouteData.prototype.findBestMatchingPoint=function(){
    if (! this.editingRoute) return;
    if (! this.editingWp) return;
    var idx;
    var mindistance=undefined;
    var minidx=-1;
    var dst;
    for (idx=0;idx<this.editingRoute.points.length;idx++){
        dst=avnav.nav.NavCompute.computeDistance(this.editingWp,this.editingRoute.points[idx]);
        if (minidx == -1 || dst.dts<mindistance){
            minidx=idx;
            mindistance=dst.dts;
        }
    }
    if (minidx < 0) minidx=0;
    this.editingWpIdx=minidx;
    this.editingWp=this.getEditingWp();
};


/**
 * send the route
 * @param {avnav.nav.Route} route
 */
avnav.nav.RouteData.prototype.sendRoute=function(route){
    //send route to server
    var self=this;
    var sroute=route.clone();
    if (sroute.time) sroute.time=sroute.time/1000;
    this.remoteRouteOperation("setroute",{
        route:route,
        self:self,
        okcallback:function(data,param){
            log("route sent to server");
        },
        errorcallback:function(status,param){
            if (param.self.propertyHandler.getProperties().routingServerError) alert("unable to send route to server:" + errMsg);
        }
    });
};
/**
 * check if the current route is active
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.isEditingActiveRoute=function(){
    if (! this.currentLeg.name) return false;
    if (! this.editingRoute) return false; //TODO: is this really false?
    if (this.currentLeg.name != this.editingRoute.name) return false;
    return true;
};

/**
 * leg has changed
 * @returns {boolean}
 * @private
 */
avnav.nav.RouteData.prototype.legChanged=function(opt_newLeg){
    if (opt_newLeg) this.currentLeg=opt_newLeg;
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    this.saveLeg();
    this.syncRouteFromLeg();
    this.navobject.routeEvent();
    var self=this;
    if (this.connectMode){
        $.ajax({
            type: "POST",
            url: this.propertyHandler.getProperties().navUrl+"?request=routing&command=setleg",
            data: this.currentLeg.toJsonString(),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data){
                log("new leg sent to server");
            },
            error: function(errMsg,x) {
                if (self.propertyHandler.getProperties().routingServerError) alert("unable to send leg to server:" +errMsg);
            }
        });
    }
    return true;
};

/**
 * set the route active state
 * this will also set our active mode
 * @param {avnav.nav.NavRoutingMode} mode
 * @param {boolean} opt_keep_from if set - do not change from
 * @returns {boolean} true if changed - fires route event
 */
avnav.nav.RouteData.prototype.routeOn=function(mode,opt_keep_from){
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach;
    this.currentLeg.active=true;
    var pfrom;
    var gps=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    var center=this.navobject.getMapCenter();
    if (gps.valid){
        pfrom=new avnav.nav.navdata.WayPoint(gps.lon,gps.lat);
    }
    else{
        pfrom=new avnav.nav.navdata.WayPoint();
        center.assign(pfrom);
    }
    if (! opt_keep_from) this.currentLeg.from=pfrom;
    if (mode == avnav.nav.RoutingMode.CENTER){
        this.currentLeg.to=new avnav.nav.navdata.WayPoint();
        center.assign(this.currentLeg.to);
        this.currentLeg.name=undefined;
        this.currentLeg.currentRoute=undefined;
        this.currentLeg.currentTarget=0;
        this.legChanged();
        return true;
    }
    if (mode == avnav.nav.RoutingMode.ROUTE){
        this.setLegFromRoute();
        this.legChanged();
        return true;
    }
    return false;
};

avnav.nav.RouteData.prototype.routeOff=function(){
    if (! this.getLock()) return; //is already off
    this.currentLeg.active=false;
    this.currentLeg.name=undefined;
    this.currentLeg.currentRoute=undefined;
    this.currentLeg.currentTarget=0;
    this.legChanged(); //send deactivate
    this.navobject.routeEvent();
};


/**
 * get the current lock state (i.e. are we routing?)
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.getLock=function(){
    return this.currentLeg.active;
};

/**
 * check if we currently have an active route
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.hasActiveRoute=function(){
    if (! this.currentLeg.active) return false;
    if (! this.currentLeg.name) return false;
    if (! this.currentLeg.currentRoute) return false;
    return true;
};
/**
 *
 * @param {number} id the index in the route
 */
avnav.nav.RouteData.prototype.setEditingWp=function(id){
    if (! this.editingRoute) return;
    if (id <0 || id >= this.editingRoute.points.length) return;
    this.editingWpIdx=id;
    this.editingWp=this.getEditingWp();
    this.navobject.routeEvent();
};

/**
 * set the active WP to the one from the route
 * if the route is active
 */
avnav.nav.RouteData.prototype.setActiveWpFromRoute=function(){
    if (this.isEditingActiveRoute()){
        if (this.editingWpIdx != this.currentLeg.currentTarget){
            this.editingWpIdx=this.currentLeg.currentTarget;
            this.editingWp=this.getEditingWp();
            this.navobject.routeEvent();
        }
    }
};

/**
 * get the index of the active wp from the current route
 * @return {number}
 */
avnav.nav.RouteData.prototype.getActiveWpIdx=function(){
    if (! this.editingRoute) return;
    if (this.editingWpIdx < this.editingRoute.points.length) return this.editingWpIdx;
    else return this.editingRoute.points.length-1;
};

/**
 * get the current routing target index - -1 if not active
 * @returns {*}
 */
avnav.nav.RouteData.prototype.getCurrentLegTargetIdx=function(){
    if (! this.currentLeg.name) return -1;
    if (! this.currentLeg.currentRoute) return -1;
    if (this.currentLeg.currentTarget < this.currentLeg.currentRoute.points.length) return this.currentLeg.currentTarget;
    else return this.currentLeg.currentRoute.points.length-1;
};
/**
 * get the current route target wp (or undefined)
 * @returns {avnav.nav.navdata.WayPoint|undefined}
 */
avnav.nav.RouteData.prototype.getCurrentLegTarget=function(){
    return this.currentLeg.to;
};

avnav.nav.RouteData.prototype.getCurrentLegNextWp=function(){
    if (! this.currentLeg.currentRoute) return undefined;
    if (this.currentLeg.currentTarget >= (this.currentLeg.currentRoute.points.length-1)) return undefined;
    return this.currentLeg.currentRoute.points[this.currentLeg.currentTarget+1];
};

/**
 * get the active wp
 * @returns {avnav.nav.navdata.WayPoint}
 */
avnav.nav.RouteData.prototype.getEditingWp=function(){
    if (! this.editingRoute) return undefined;
    if (this.editingRoute.points) {
        if (this.editingWpIdx<0 ||this.editingWpIdx>=this.editingRoute.points.length) return undefined;
        return this.editingRoute.points[this.editingWpIdx];
    }
    return undefined;
};
/**
 * returns the waypoint with the given index from the editing route
 * @param {number} idx
 * @returns {avnav.nav.navdata.WayPoint}
 */

avnav.nav.RouteData.prototype.getWp=function(idx){
    if (! this.editingRoute) return undefined;
    if (idx < 0 || idx >= this.editingRoute.points.length) return undefined;
    return this.editingRoute.points[idx];
};

/**
 * delete a point from the current route
 * @param {number} id - the index, -1 for active
 */
avnav.nav.RouteData.prototype.deleteWp=function(id){
    if (id == -1){
        id=this.editingWpIdx;
    }
    if (id<0)id=0;
    if (! this.editingRoute) return;
    var changeTarget=this.isEditingActiveRoute() && id == this.currentLeg.currentTarget;
    if (this.editingRoute.points){
        if (id >= this.editingRoute.points.length)id=this.editingRoute.points.length-1;
        this.editingRoute.points.splice(id,1);
        if (id <= this.currentLeg.currentTarget && this.currentLeg.currentTarget > 0) this.currentLeg.currentTarget--;
        if (id <= this.editingWpIdx && this.editingWpIdx > 0) this.editingWpIdx--;
        if (this.editingWpIdx >= this.editingRoute.points.length)this.editingWpIdx=this.editingRoute.points.length-1;
        if (this.currentLeg.currentTarget >= this.editingRoute.points.length)this.currentLeg.currentTarget=this.editingRoute.points.length-1;
    }
    if (changeTarget) this.routeOn(avnav.nav.RoutingMode.ROUTE,true);
    this.editingWp=this.getEditingWp();
    this.saveRoute(); //will only send if we modified not the active one
    if (this.isEditingActiveRoute()) {
        this.currentLeg.currentRoute=this.editingRoute.clone();
        this.legChanged();
    }
    this.navobject.routeEvent();
};
/**
 * change a point in the route
 * @param {number} id the index, -1 for current
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.changeWp=function(id,point){
    if (id == -1){
        id=this.editingWpIdx;
        this.editingWp=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
    }
    if (! this.editingRoute) return;
    if (this.editingRoute.points) {
        if (id < 0 || id >= this.editingRoute.points.length) return;
        if (!(point instanceof avnav.nav.navdata.WayPoint)) {
            var p = new avnav.nav.navdata.WayPoint(point.lon, point.lat);
            point = p;
            if (this.editingRoute.points[id].name) point.name = this.editingRoute.points[id].name;
        }
        this.editingRoute.points[id] = point;
    }
    if (this.isEditingActiveRoute() && id == this.currentLeg.currentTarget){
        this.routeOn(avnav.nav.RoutingMode.ROUTE,true);
    }
    else {

    }
    this.saveRoute();
    if (this.isEditingActiveRoute()) {
        this.currentLeg.currentRoute=this.editingRoute.clone();
        this.legChanged();
    }
    this.navobject.routeEvent();
};
/**
 * add a point to the route
 * @param {number} id the index, -1 for current - point is added after
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.addWp=function(id,point){
    if (id == -1){
        id=this.editingWpIdx;
    }
    if (id <0) id=0;
    var setName=false;
    if (! this.editingRoute) return;
    if (this.editingRoute.points){
        if (! (point instanceof avnav.nav.navdata.WayPoint)){
            point=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
            setName=true;
        }
        if (id >= this.editingRoute.points.length){
            this.editingRoute.points.push(point);
            this.editingWpIdx=this.editingRoute.points.length-1;


        }
        else {
            if (id < 0) return;
            this.editingRoute.points.splice(id+1, 0, point);
            this.editingWpIdx=id+1;
        }
        if (setName){
            //find a free name
            var highest=-1;
            var p;
            for (p=0;p<this.editingRoute.points.length;p++){
                var cp=this.editingRoute.points[p];
                if (cp.name && cp.name.match("^WP[0-9][0-9]")){
                    try {
                        var v=parseInt(cp.name.substr(2));
                        if (v>highest) highest=v;
                    } catch(e){}
                }
            }
            point.name="WP"+this.formatter.formatDecimal(highest+1,2,0);
        }
    }
    this.editingWp=this.getEditingWp();
    this.saveRoute();
    if (this.isEditingActiveRoute()) {
        this.currentLeg.currentRoute=this.editingRoute.clone();
        this.legChanged();
    }
    this.navobject.routeEvent();
};
/**
 * delete all points from the route
 */
avnav.nav.RouteData.prototype.emptyRoute=function(){
    if (! this.editingRoute) return;
    this.editingRoute.points=[];
    this.editingWpIdx=0;
    this.editingWp=undefined;
    if (this.isEditingActiveRoute()){
        this.currentLeg.name=undefined;
        this.currentLeg.currentTarget=-1;
        this.currentLeg.active=false;
        this.currentLeg.currentRoute=undefined;
        this.legChanged();
    }
    this.saveRoute();
    this.navobject.routeEvent();
};

/**
 * invert the order of waypoints in the route
 */
avnav.nav.RouteData.prototype.invertRoute=function(){
    if (! this.editingRoute) return;
    var active=this.editingWpIdx;
    var target=this.currentLeg.currentTarget;
    for (var i=0;i<this.editingRoute.points.length/2;i++){
        var swap=this.editingRoute.points.length-i-1;
        var old=this.editingRoute.points[i];
        this.editingRoute.points[i]=this.editingRoute.points[swap];
        this.editingRoute.points[swap]=old;
    }

    active = this.editingRoute.points.length -1 - active;
    this.editingWpIdx = active;
    this.editingWp=this.getEditingWp();

    this.saveRoute();
    if (this.isEditingActiveRoute()){
        this.currentLeg.currentTarget=this.editingRoute.points.length-target-1;
        this.currentLeg.currentRoute=this.editingRoute.clone();
        this.legChanged();
    }
    else {
        this.navobject.routeEvent();
    }

};

/**
 * list functions for routes
 * works async
 * @param server
 * @param okCallback function that will be called with a list of RouteInfo
 * @param opt_failCallback
 */
avnav.nav.RouteData.prototype.listRoutesServer=function(okCallback,opt_failCallback,opt_callbackData){
    return this.remoteRouteOperation("listroutes",{
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
                var ri = new avnav.nav.RouteInfo();
                avnav.assign(ri, data.items[i]);
                ri.server = true;
                ri.time=ri.time*1e3; //we receive TS in s
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
avnav.nav.RouteData.prototype.listRoutesLocal=function(){
    var rt=[];
    var i=0;
    var key,rtinfo,route;
    var routeprfx=this.propertyHandler.getProperties().routeName+".";
    for (i=0;i<localStorage.length;i++){
        key=localStorage.key(i);
        if (key.substr(0,routeprfx.length)==routeprfx){
            rtinfo=new avnav.nav.RouteInfo(key.substr(routeprfx.length));
            try {
                route=new avnav.nav.Route();
                route.fromJsonString(localStorage.getItem(key));
                if (route.points) rtinfo.numpoints=route.points.length;
                rtinfo.length=this.computeLength(0,route);
                rtinfo.time=route.time;

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
avnav.nav.RouteData.prototype.deleteRoute=function(name,opt_errorcallback){
    try{
        localStorage.removeItem(this.propertyHandler.getProperties().routeName+"."+name);
    }catch(e){}
    if (this.connectMode){
        this.remoteRouteOperation("deleteroute",{
            name:name,
            errorcallback:opt_errorcallback
        });
    }
};

avnav.nav.RouteData.prototype.fetchRoute=function(name,localOnly,okcallback,opt_errorcallback){
    var route;
    if (localOnly || ! this.connectMode){
        route=this.loadRoute(name);
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
    this.remoteRouteOperation("getroute",{
        name:name,
        self:this,
        f_okcallback:okcallback,
        f_errorcallback:opt_errorcallback,
        okcallback: function(data,param){
            var rt=new avnav.nav.Route(param.name);
            rt.fromJson(data);
            if (rt.time) rt.time=rt.time*1000;
            param.self.saveRouteLocal(rt,true);
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

avnav.nav.RouteData.prototype.setNewEditingRoute=function(route){
    this.editingRoute=route.clone();
    this.findBestMatchingPoint();
    this.navobject.routeEvent();
};

/**
 * @private
 * check if we have to switch to the next WP
 */
avnav.nav.RouteData.prototype.checkNextWp=function(){
    if (! this.currentLeg.active || ! this.currentLeg.name || ! this.currentLeg.currentRoute) {
        this.currentLeg.approach=false;
        this.isApproaching=false;
        return;
    }
    var boat=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    //TODO: switch of routing?!
    if (! boat.valid) return;
    if (this.currentLeg.currentTarget >= (this.currentLeg.currentRoute.points-length-1)) return;
    var approach=this.propertyHandler.getProperties().routeApproach;
    try {
        var dst = avnav.nav.NavCompute.computeDistance(boat, this.currentLeg.currentRoute.points[this.currentLeg.currentTarget]);
        //TODO: some handling for approach
        if (dst.dts <= approach){
            this.isApproaching=true;
            this.currentLeg.approach=true;
            var nextDst=new avnav.nav.navdata.Distance();
            var hasNextWp=false;
            var nextWpNum=this.currentLeg.currentTarget+1;
            if (nextWpNum < this.currentLeg.currentRoute.points.length) {
                hasNextWp=true;
                nextDst=avnav.nav.NavCompute.computeDistance(boat, this.currentLeg.currentRoute.points[this.currentLeg.currentTarget+1]);
            }
            if (this.lastDistanceToCurrent < 0 || this.lastDistanceToNext < 0){
                //seems to be the first time
                this.lastDistanceToCurrent=dst.dts;
                this.lastDistanceToNext=nextDst.dts;
                return;
            }
            //check if the distance to own wp increases and to the nex decreases
            var diffcurrent=dst.dts-this.lastDistanceToCurrent;
            if (diffcurrent <= 0){
                //still decreasing
                this.lastDistanceToCurrent=dst.dts;
                this.lastDistanceToNext=nextDst.dts;
                return;
            }
            var diffnext=nextDst.dts-this.lastDistanceToNext;
            if (diffnext > 0){
                //increases to next
                this.lastDistanceToCurrent=dst.dts;
                this.lastDistanceToNext=nextDst.dts;
                return;
            }
            //should we wait for some time???
            if (hasNextWp) {
                if (this.isEditingActiveRoute()) {
                    this.editingWpIdx = this.currentLeg.currentTarget + 1;
                    this.editingWp = this.getEditingWp();
                    this.routeOn(avnav.nav.RoutingMode.ROUTE);
                }
                else {
                    //we cannot use routeOn - so simply change this in the leg
                    this.currentLeg.currentTarget++;
                    this.currentLeg.from.assign(boat);
                    this.currentLeg.to=this.currentLeg.currentRoute.points[this.currentLeg.currentTarget].clone();
                    this.legChanged();
                }
                log("switching to next WP");
                //TODO: should we fire a route event?
            }
            else {
                this.routeOff();
                log("end of route reached");
            }
        }
        else{
            this.isApproaching=false;
            this.currentLeg.approach=false;
        }
    } catch (ex){} //ignore errors
};

avnav.nav.RouteData.prototype.getApproaching=function(){
    return this.isApproaching;
};

/**
 *
 * @param evdata
 */
avnav.nav.RouteData.prototype.propertyChange=function(evdata) {
    var oldcon=this.connectMode;
    this.connectMode=this.propertyHandler.getProperties().connectedMode;
    if (oldcon != this.connectMode && this.connectMode){
        //newly connected
        var oldActive;
        if (this.serverConnected && this.serverRoute) {
            this.editingRoute = this.serverRoute.clone();
        }
        if (this.serverConnected && this.serverLeg){
            this.currentLeg=this.serverLeg.clone();
            this.syncRouteFromLeg();
        }
        this.navobject.routeEvent();
    }
};

