/**
 * Created by andreas on 04.05.14.
 */


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
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach+0;

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
    if (avnav.android){
        var data=avnav.android.getLeg();
        if (data && data != ""){
            log("android: get leg from server");
            try {
                var nLeg = new avnav.nav.Leg();
                nLeg.fromJsonString(data);
                this.currentLeg=nLeg;
            }catch (e){
                log("unable to get leg from server");
            }
        }
    }
    /**
     * @private
     * @type {boolean}
     */
    this.connectMode=this.propertyHandler.getProperties().connectedMode;

    /**
     * the current coordinates of the active WP (if set)
     * @private
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.editingWp=this.currentLeg.to;
    /**
     * the current route that we edit
     * if undefined all functions will directly work on the active route
     * @private
     * @type {avnav.nav.Route}
     */
    this.editingRoute=undefined;

    /**
     * the last received route from server
     * initially we set this to our route to get the route from the server if it differs
     * @type {avnav.nav.Route}
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
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    var self=this;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
    this.startQuery();
};


/**
 * set the current route from the active leg (if we have an active route)
 * this stops the editing mode
 */
avnav.nav.RouteData.prototype.cloneActiveToEditing=function() {
    var hasChanged=false;
    if (this.currentLeg.currentRoute){
        this.editingRoute=this.currentLeg.currentRoute.clone();
        hasChanged=true;
    }
    else {
        if (! this.editingRoute){
            this.editingRoute=new avnav.nav.Route();
            hasChanged=true;
        }
    }
    if (hasChanged) {
        this.findBestMatchingPoint();
        this.saveRoute();
        this.navobject.routeEvent();
    }
};

/**
 * reset the editing route to the active route
 * also setting the active WP
 */
avnav.nav.RouteData.prototype.resetToActive=function(){
    if (this.isEditingActiveRoute()) return;
    this.editingRoute=undefined;
    this.editingWp=this.currentLeg.to;
};


/**
 * compute the length of the route from the given startpoint
 * @param {number} startIdx
 * @returns {number} distance in nm
 */
avnav.nav.RouteData.prototype.computeLength=function(startIdx,opt_route){
    var rt=0;
    if (! opt_route) opt_route=this.getEditingRoute();
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
            this.saveLegLocal();
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
    var url = this.propertyHandler.getProperties().navUrl + "?request=routing&command=" + operation;
    var type="GET";
    var data=undefined;
    if (operation == "getroute" || operation=="deleteroute") {
        url += "&name=" + encodeURIComponent(param.name);
    }
    if(operation=="setroute"){
        if (avnav.android){
            log("android: setRoute");
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
    var responseType="json"
    log("remoteRouteOperation, operation="+operation+", response="+responseType+", type="+type);
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
                log("query route error: " + data.status);
                if (param.errorcallback){
                    param.errorcallback(data.status,param);
                }
                return;
            }
            if (param.okcallback) {
                if (responseType=="text" && operation=="getroute"){
                    log("convert route from xml: "+data);
                    var route=new avnav.nav.Route();
                    route.fromXml(data);
                    data=route.toJson();
                    log("converted Route: "+route.toJsonString());
                }
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
    if (! this.connectMode || avnav.android){
        self.timer=window.setTimeout(function() {
            self.startQuery();
        },timeout);
        return;
    }
    else {
        $.ajax({
            url: url,
            dataType: 'json',
            cache: false,
            success: function (data, status) {
                var change = self.handleLegResponse(data);
                log("leg data change=" + change);
                self.timer = window.setTimeout(function () {
                    self.startQuery();
                }, timeout);
            },
            error: function (status, data, error) {
                log("query leg error");
                this.routeErrors++;
                if (this.routeErrors > 10) {
                    log("lost route");
                    this.serverConnected = false;
                }
                self.timer = window.setTimeout(function () {
                    self.startQuery();
                }, timeout);
            },
            timeout: 10000
        });
    }
    //we only query the route separately if it is currently not active
    if (! this.isEditingActiveRoute()) {
        if (! this.editingRoute) return;
        if (! this.connectMode) return;
        if (! this.editingRoute.server) return;
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
avnav.nav.RouteData.prototype.getCurrentLeg=function(){
    return this.currentLeg;
};

/**
 * return the current route
 * @returns {avnav.nav.Route}
 */
avnav.nav.RouteData.prototype.getEditingRoute=function(){
    if (this.isEditingActiveRoute()){
        return this.currentLeg.currentRoute;
    }
    if (! this.editingRoute) this.editingRoute=new avnav.nav.Route();
    return this.editingRoute;
};
/**
 * change the name of the route
 * this will stop our active mode and move us to edit mode
 * @param name {string}
 * @param setLocal {boolean} if set make the route a local route
 */
avnav.nav.RouteData.prototype.changeRouteName=function(name,setLocal){
    if (this.isEditingActiveRoute()){
        this.currentLeg.name=name.slice(0);
        this.currentLeg.currentRoute.name=name.slice(0);
        this.legChanged();
        return;
    }
    if (! this.editingRoute){
        this.editingRoute=new avnav.nav.Route();
    }
    this.editingRoute.name=name;
    if (setLocal) this.editingRoute.server=false;
    log("switch to new route "+name);
    this.saveRoute();
    this.navobject.routeEvent();
};

/**
 * @private
 */
avnav.nav.RouteData.prototype.saveRouteLocal=function(opt_route,opt_keepTime) {
    var route = opt_route;
    if (!route) {
        route = this.getEditingRoute();
        if (!route) return route;

    }
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime();
    if (! route.server) {
        var str = route.toJsonString();
        localStorage.setItem(this.propertyHandler.getProperties().routeName + "." + route.name, str);
    }
    return route;
};

avnav.nav.RouteData.prototype.saveRoute=function(route,opt_callback) {
    var route=this.saveRouteLocal(route);
    if (! route ) return;
    if (avnav.android){
        avnav.android.storeRoute(route.toJsonString());
    }
    if (this.connectMode) this.sendRoute(route, opt_callback);
    else {
        if (opt_callback) setTimeout(function () {
            opt_callback(true);
        }, 0);
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
avnav.nav.RouteData.prototype.saveLegLocal=function(){
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
    var bestPoint=undefined;
    var dst;
    for (idx=0;idx<this.editingRoute.points.length;idx++){
        dst=avnav.nav.NavCompute.computeDistance(this.editingWp,this.editingRoute.points[idx]);
        if (bestPoint === undefined || dst.dts<mindistance){
            bestPoint=this.editingRoute.points[idx];
            mindistance=dst.dts;
        }
    }
    this.editingWp=bestPoint;
};


/**
 * send the route
 * @param {avnav.nav.Route} route
 * @param opt_callback -. will be called on result, param: true on success
 */
avnav.nav.RouteData.prototype.sendRoute=function(route,opt_callback){
    //send route to server
    var self=this;
    var sroute=route.clone();
    if (sroute.time) sroute.time=sroute.time/1000;
    this.remoteRouteOperation("setroute",{
        route:route,
        self:self,
        okcallback:function(data,param){
            log("route sent to server");
            if (opt_callback)opt_callback(true);
        },
        errorcallback:function(status,param){
            if (param.self.propertyHandler.getProperties().routingServerError) alert("unable to send route to server:" + errMsg);
            if (opt_callback) opt_callback(false);
        }
    });
};
/**
 * check if the current route is active
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.isEditingActiveRoute=function(){
    if (! this.currentLeg.name) return false;
    if (! this.editingRoute) return true;
    return false;
};

/**
 * leg has changed - save it and reset approach data
 * @returns {boolean}
 * @private
 */
avnav.nav.RouteData.prototype.legChanged=function(){
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    this.saveLegLocal();
    this.navobject.routeEvent();
    var self=this;
    if (avnav.android){
        avnav.android.setLeg(this.currentLeg.toJsonString());
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
    this.currentLeg.approachDistance=this.propertyHandler.getProperties().routeApproach+0;
    this.currentLeg.active=true;
    var pfrom;
    var gps=this.navobject.getGpsHandler().getGpsData();
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
        this.currentLeg.active=true;
        this.legChanged();
        return true;
    }
    if (mode == avnav.nav.RoutingMode.ROUTE){
        if (this.editingRoute){
            this.currentLeg.currentRoute=this.editingRoute.clone();
            this.currentLeg.name=this.editingRoute.name;
            this.currentLeg.to=this.editingWp;
            this.editingRoute=undefined;
        }
        else {
            if (this.editingWp){
                this.currentLeg.to=this.editingWp;
            }
        }
        this.currentLeg.active=true;
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
    var route=this.getEditingRoute();
    this.editingWp=route.getPointAtIndex(id);
    this.navobject.routeEvent();
};

avnav.nav.RouteData.prototype.moveEditingWp=function(diff){
    var route=this.getEditingRoute();
    var cur=route.getIndexFromPoint(this.editingWp);
    var next=cur+diff;
    if (next <0 || next >= route.points.length) return;
    this.editingWp=route.getPointAtIndex(next);
    this.navobject.routeEvent();
};




/**
 * get the current routing target index - -1 if not active
 * @returns {*}
 */
avnav.nav.RouteData.prototype.getCurrentLegTargetIdx=function(){
    if (! this.currentLeg.name) return -1;
    return this.currentLeg.getCurrentTargetIdx();
};
/**
 * get the current route target wp (or undefined)
 * @returns {avnav.nav.navdata.WayPoint|undefined}
 */
avnav.nav.RouteData.prototype.getCurrentLegTarget=function(){
    var rt=avnav.nav.navdata.WayPoint.fromPlain(this.currentLeg.to);
    if (! rt.name){
        if (this.currentLeg.currentRoute){
            rt.name=this.currentLeg.getCurrentTargetIdx()+"";
        }
        else {
            rt.name="Marker";
        }
    }
    return rt;
};

avnav.nav.RouteData.prototype.getCurrentLegNextWp=function(){
    if (! this.currentLeg.currentRoute) return undefined;
    var next=this.currentLeg.getCurrentTargetIdx()+1;
    if (next >= this.currentLeg.currentRoute.points.length) return undefined;
    var rt=avnav.nav.navdata.WayPoint.fromPlain(this.currentLeg.currentRoute.points[next]);
    if (!rt.name) {
        var num = this.currentLeg.getCurrentTargetIdx() + 1;
        rt.name = num + "";
    }
    return rt;
};

/**
 * get the active wp
 * @returns {avnav.nav.navdata.WayPoint}
 */
avnav.nav.RouteData.prototype.getEditingWp=function(){
    return this.editingWp;
};

/**
 * get the index of the active wp from the current route
 * @return {number}
 */
avnav.nav.RouteData.prototype.getEditingWpIdx=function(){
    var wp=this.getEditingWp();
    if (! wp) return -1;
    if (wp.id === undefined ) -1;
    var i=0;
    var route=this.getEditingRoute();
    for (i in route.points){
        if (route.points[i].id == wp.id) return i;
    }
    return -1;
};

/**
 * returns the waypoint with the given index from the editing route
 * @param {number} idx
 * @returns {avnav.nav.navdata.WayPoint}
 */

avnav.nav.RouteData.prototype.getWp=function(idx){
    return this.getEditingRoute().getPointAtIndex(idx);
};
/**
 * check if a wp change will change the current routing target
 * @param compareWp
 * @param newWp
 * @returns {boolean}
 * @private
 */
avnav.nav.RouteData.prototype._checkCurrentTargetChanged=function(compareWp,newWp){
    if (compareWp && this.currentLeg.to.id == compareWp.id){
        //target changed
        if (newWp){
            this.currentLeg.to=newWp;
            this.routeOn(avnav.nav.RoutingMode.ROUTE);
            return true;
        }
        else{
            this.routeOff();
        }
    }
    return false;
};

/**
 * delete a point from the current route
 * @param {number} id - the index, -1 for active
 */
avnav.nav.RouteData.prototype.deleteWp=function(id){
    if (this.isEditingActiveRoute()){
        var oldPoint=this.currentLeg.currentRoute.getPointAtIndex(id);
        var newPoint=this.currentLeg.route.deletePoint(id);
        this._checkCurrentTargetChanged(oldPoint,newPoint);
        this.legChanged();
        return;
    }
    if (! this.editingRoute) return;
    this.editingWp=this.editingRoute.deletePoint(id);
    this.saveRoute(this.editingRoute);
    this.navobject.routeEvent();
};
/**
 * change a point in the route
 * @param {number} id the index, -1 for current
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.changeWp=function(id,point){
    if (this.isEditingActiveRoute()){
        var oldWp=this.currentLeg.currentRoute.getPointAtIndex(id);
        if (! oldWp) return;
        var changed=oldWp.update(point);
        if (changed){
            this._checkCurrentTargetChanged(oldWp,oldWp);
        }
        this.legChanged();
        return;
    }
    if (! this.editingRoute) return;
    var wp=this.editingRoute.getPointAtIndex(id);
    if (! wp) return;
    wp.update(point);
    this.saveRoute(this.editingRoute);
    this.navobject.routeEvent();
};
/**
 * add a point to the route
 * @param {number} id the index, -1 for current - point is added after
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.addWp=function(id,point){
    if (this.isEditingActiveRoute()){
        this.editingWp=this.currentLeg.currentRoute.addPoint(id,point);
        this.legChanged();
        return;
    }
    if (! this.editingRoute) return;
    this.editingWp=this.editingRoute.addPoint(id,point);
    this.saveRoute(this.editingRoute);
    this.navobject.routeEvent();
};
/**
 * delete all points from the route
 */
avnav.nav.RouteData.prototype.emptyRoute=function(){
    this.editingWp=undefined;
    if (this.isEditingActiveRoute()){
        this.currentLeg.name=undefined;
        this.currentLeg.currentTarget=-1;
        this.currentLeg.active=false;
        this.currentLeg.currentRoute=undefined;
        this.legChanged();
        return;
    }
    if (! this.editingRoute) return;
    this.editingRoute.points=[];
    this.saveRoute();
    this.navobject.routeEvent();
};

/**
 * invert the order of waypoints in the route
 */
avnav.nav.RouteData.prototype.invertRoute=function(){
    if (this.isEditingActiveRoute()){
        this.currentLeg.currentRoute.swap();
        this.legChanged();
        return;
    }
    if (! this.editingRoute) return;
    this.editingRoute.swap();
    this.saveRoute(this.editingRoute);
    this.navobject.routeEvent();
};

/**
 * check whether the editing route is writable
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.isRouteWritable=function(){
    if (this.connectMode) return true;
    if (this.isEditingActiveRoute()) return ! this.currentLeg.currentRoute.server;
    if (! this.editingRoute) return false;
    return ! this.editingRoute.server;
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
avnav.nav.RouteData.prototype.deleteRoute=function(name,opt_okcallback,opt_errorcallback,opt_localonly){
    try{
        localStorage.removeItem(this.propertyHandler.getProperties().routeName+"."+name);
    }catch(e){}
    if (this.connectMode && ! opt_localonly){
        this.remoteRouteOperation("deleteroute",{
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

avnav.nav.RouteData.prototype.fetchRoute=function(name,localOnly,okcallback,opt_errorcallback){
    var route;
    if (localOnly){
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
            rt.server=true;
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
    var boat=this.navobject.getGpsHandler().getGpsData();
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
            var nextWpNum=this.currentLeg.getCurrentTargetIdx()+1;
            var nextWp=this.currentLeg.currentRoute.getPointAtIndex(nextWpNum);
            if (nextWp){
                nextDst=avnav.nav.NavCompute.computeDistance(boat, nextWp);
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
            if (nextWp) {
                this.currentLeg.to=nextWp;
                this.routeOn(avnav.nav.RoutingMode.ROUTE);
                if (this.isEditingActiveRoute()) {
                    this.editingWp = nextWp;
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
        }
        this.navobject.routeEvent();
    }
};

