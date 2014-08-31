/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.RouteData');
avnav.provide('avnav.nav.Route');
avnav.provide('avnav.nav.Leg');
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
    this.from=from;
    /**
     * current target waypoint
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.to=to;
    /**
     * is the leg active?
     * @type {boolean}
     */
    this.active=active;
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
};

avnav.nav.Leg.prototype.clone=function(){
    var rt=new avnav.nav.Leg(avnav.clone(this.from),avnav.clone(this.to),this.active,
        this.name?this.name.slice(0):undefined,this.currentTarget);
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
        currentTarget: this.currentTarget
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
    return this;
};

/**
 * check if the leg differs from another leg
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
avnav.nav.Route.prototype.toJsonString=function(){
    var rt={};
    rt.name=this.name;
    rt.points=[];
    var i;
    for (i in this.points){
        rt.points.push(this.points[i]);
    }
    return JSON.stringify(rt);
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



/**
 * the handler for the routing data
 * query the server...
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

    try {
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routingDataName);
        if (raw){
            this.currentLeg.fromJson(raw);
        }
    }catch(e){
        log("Exception reading currentLeg "+e);
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
    this.activeWp=0;
    /**
     * the current route
     * @private
     * @type {avnav.nav.Route}
     */
    this.currentRoute=new avnav.nav.Route();
    try{
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routeName);
        if (raw) {
            this.currentRoute.fromJsonString(raw);
        }
    }catch(ex){}
    /**
     * the last received route from server
     * @type {avnav.nav.Route}
     */
    this.serverRoute=new avnav.nav.Route();
    if (this.currentLeg.name) this.activeWp=this.currentLeg.currentTarget;
    if (this.activeWp <0) this.activeWp=0;


    /**
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
    var self=this;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });
};



/**
 * compute the length of the route from the given startpoint
 * @param {number} startIdx
 * @returns {number} distance in nm
 */
avnav.nav.RouteData.prototype.computeLength=function(startIdx){
    var rt=0;
    if (startIdx == -1) startIdx=this.currentLeg.currentTarget;
    if (startIdx < 0) startIdx=0;
    if (this.currentRoute.points.length < (startIdx+2)) return rt;
    var last=this.currentRoute.points[startIdx];
    startIdx++;
    for (;startIdx<this.currentRoute.points.length;startIdx++){
        var next=this.currentRoute.points[startIdx];
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
avnav.nav.RouteData.prototype.convertLegResponse=function(data) {
    if (!data) {
        this.serverConnected = false;
        return true;
    }
    if (! data.to || ! data.from) return false;
    var nleg=new avnav.nav.Leg();
    nleg.fromJson(data);
    if (nleg.differsTo(this.serverLeg)){
        this.serverLeg=nleg;
        return true;
    }
    return false;
};

/**
 * @private
 */
avnav.nav.RouteData.prototype.startQuery=function() {
    this.checkNextWp();
    var url = this.propertyHandler.getProperties().navUrl+"?request=routing&command=getleg";
    var timeout = this.propertyHandler.getProperties().routeQueryTimeout; //in ms!
    var self = this;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            var change = self.convertLegResponse(data);
            log("leg data change="+change);
            self.handleLegStatus(true, change);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            log("query leg error");
            self.handleLegStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });
    url = this.propertyHandler.getProperties().navUrl+"?request=routing&command=getroute&name="+
        encodeURIComponent(this.currentRoute.name);
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            if (data.status){
                //seems to be some error
                log("query route error: "+data.status);
                return;
            }
            var nRoute=new avnav.nav.Route();
            nRoute.fromJson(data);
            var change = nRoute.differsTo(self.serverRoute)
            log("route data change="+change);
            if (change){
                self.serverRoute=nRoute;
                if (self.currentRoute.differsTo(self.serverRoute)) {
                    self.currentRoute = self.serverRoute.clone();
                    self.saveRoute();
                    self.navobject.routeEvent();
                }

            }

        },
        error: function(status,data,error){
            log("query route error");
        },
        timeout: 10000
    });
};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
avnav.nav.RouteData.prototype.handleLegStatus=function(success,change){
    var oldConnect=this.serverConnected;
    if (! success){
        this.routeErrors++;
        if (this.routeErrors > 10){
            log("lost route");
            this.serverConnected=false;
        }
        else{
            return;
        }
    }
    else {
        this.routeErrors=0;
        this.serverConnected=true;
    }
    //if we are in connected mode - set our own data
    //if the data from the server has changed
    if (this.connectMode && change && success){
        if (this.serverLeg.differsTo(this.currentLeg)) {
            this.currentLeg = this.serverLeg.clone();
            this.saveLeg()
        }
    }
    //inform the navobject on any change
    if (change || (oldConnect != this.serverConnected))this.navobject.routeEvent();
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
    return this.currentRoute;
};

avnav.nav.RouteData.prototype.saveRoute=function(){
    var str=this.currentRoute.toJsonString();
    localStorage.setItem(this.propertyHandler.getProperties().routeName,str);
    if (this.connectMode) this.sendRoute(this.currentRoute.toJsonString());
};

/**
 * save the current leg info
 * @private
 */
avnav.nav.RouteData.prototype.saveLeg=function(){
    var raw=JSON.stringify(this.currentLeg);
    localStorage.setItem(this.propertyHandler.getProperties().routingDataName,raw);
};

/**
 * send the route
 * @param {string} route as json string
 */
avnav.nav.RouteData.prototype.sendRoute=function(route){
    //send route to server
    var self=this;
    $.ajax({
        type: "POST",
        url: this.propertyHandler.getProperties().navUrl + "?request=routing&command=setroute",
        data: route,
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        success: function (data) {
            log("route sent to server");
        },
        error: function (errMsg, x) {
            if (self.propertyHandler.getProperties().routingServerError) alert("unable to send route to server:" + errMsg);
        }
    });
};

/**
 * leg has changed
 * @returns {boolean}
 * @private
 */
avnav.nav.RouteData.prototype.legChanged=function(newLeg){
    this.currentLeg=newLeg;
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    this.saveLeg();
    this.navobject.routeEvent();
    var self=this;
    if (this.connectMode){
        if (!newLeg.active){
            return true; //do only send activates to the server
        }
        if (newLeg.name !== undefined) {
            this.sendRoute(self.currentRoute.toJsonString());
        }
        $.ajax({
            type: "POST",
            url: this.propertyHandler.getProperties().navUrl+"?request=routing&command=setleg",
            data: JSON.stringify(this.currentLeg),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data){
                log("new leg sent to server");
            },
            error: function(errMsg,x) {
                if (self.propertyHandler.getProperties().routingServerError) alert("unable to send waypoint to server:" +errMsg);
            }
        });
    }
    return true;
};

/**
 * set the route active state
 * @param {avnav.nav.NavRoutingMode} mode
 * @param {boolean} opt_keep_from if set - do not change from
 * @returns {boolean} true if changed - fires route event
 */
avnav.nav.RouteData.prototype.routeOn=function(mode,opt_keep_from){
    var nLeg=this.currentLeg.clone(); //make a copy to prevent the remote update from disturbing us
    nLeg.active=true;
    nLeg.name=undefined;
    nLeg.currentTarget=-1;
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
    if (! opt_keep_from) nLeg.from=pfrom;
    if (mode == avnav.nav.RoutingMode.CENTER){
        nLeg.to=new avnav.nav.navdata.WayPoint();
        center.assign(nLeg.to);
        this.legChanged(nLeg);
        return true;
    }
    if (mode == avnav.nav.RoutingMode.ROUTE){
        this.saveRoute();
        nLeg.to = new avnav.nav.navdata.WayPoint();
        this.getActiveWp().assign(nLeg.to);
        nLeg.name=this.currentRoute.name;
        nLeg.currentTarget=this.getActiveWpIdx();
        this.legChanged(nLeg);
        return true;
    }
    return false;
};

avnav.nav.RouteData.prototype.routeOff=function(){
    if (! this.getLock()) return; //is already off
    this.currentLeg.active=false;
    this.currentLeg.name=undefined;
    this.saveLeg();
    this.saveRoute();
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
 *
 * @param {number} id the index in the route
 */
avnav.nav.RouteData.prototype.setActiveWp=function(id){
    if (id <0 || id >= this.currentRoute.points.length) return;
    this.activeWp=id;
    this.navobject.routeEvent();
};

/**
 * set the active WP to the one from the route
 * if the route is active
 */
avnav.nav.RouteData.prototype.setActiveWpFromRoute=function(){
    if (this.currentLeg.name){
        if (this.activeWp != this.currentLeg.currentTarget){
            this.activeWp=this.currentLeg.currentTarget;
            this.navobject.routeEvent();
        }
    }
};

/**
 * get the index of the active wp from the current route
 * @return {number}
 */
avnav.nav.RouteData.prototype.getActiveWpIdx=function(){
    return this.activeWp;
};

/**
 * get the current routing target index - -1 if not active
 * @returns {*}
 */
avnav.nav.RouteData.prototype.getCurrentRouteTargetIdx=function(){
    if (! this.currentLeg.name) return -1;
    return this.currentLeg.currentTarget;
};
/**
 * get the current route target wp (or undefined)
 * @returns {avnav.nav.navdata.WayPoint|undefined}
 */
avnav.nav.RouteData.prototype.getCurrentRouteTarget=function(){
    return this.getWp(this.getCurrentRouteTargetIdx());
};
/**
 * get the active wp
 * @returns {avnav.nav.navdata.WayPoint}
 */
avnav.nav.RouteData.prototype.getActiveWp=function(){
    if (this.currentRoute.points) {
        if (this.activeWp<0 ||this.activeWp>=this.currentRoute.points.length) return undefined;
        return this.currentRoute.points[this.activeWp];
    }
    return undefined;
};
/**
 *
 * @param {number} idx
 * @returns {avnav.nav.navdata.WayPoint}
 */

avnav.nav.RouteData.prototype.getWp=function(idx){
    if (idx < 0 || idx >= this.currentRoute.points.length) return undefined;
    return this.currentRoute.points[idx];
};

/**
 * delete a point from the current route
 * @param {number} id - the index, -1 for active
 */
avnav.nav.RouteData.prototype.deleteWp=function(id){
    if (id == -1){
        id=this.activeWp;
    }
    if (id<0)id=0;
    var changeTarget=this.currentLeg.name && id == this.currentLeg.currentTarget;
    if (this.currentRoute.points){
        if (id >= this.currentRoute.points.length)id=this.currentRoute.points.length-1;
        this.currentRoute.points.splice(id,1);
        if (id <= this.currentLeg.currentTarget && this.currentLeg.currentTarget > 0) this.currentLeg.currentTarget--;
        if (id <= this.activeWp && this.activeWp > 0) this.activeWp--;
        if (this.activeWp >= this.currentRoute.points.length)this.activeWp=this.currentRoute.points.length-1;
        if (this.currentLeg.currentTarget >= this.currentRoute.points.length)this.currentLeg.currentTarget=this.currentRoute.points.length-1;
    }
    if (changeTarget) this.routeOn(avnav.nav.RoutingMode.ROUTE,true);
    this.saveRoute();
    if (this.currentLeg.name) this.legChanged(this.currentLeg);
    this.navobject.routeEvent();
};
/**
 * change a point in the route
 * @param {number} id the index, -1 for current
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.changeWp=function(id,point){
    if (id == -1){
        id=this.activeWp;
    }
    if (this.currentRoute.points){
        if (id < 0 || id >= this.currentRoute.points.length) return;
        if (! (point instanceof avnav.nav.navdata.WayPoint)){
            var p=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
            point=p;
            if (this.currentRoute.points[id].name) point.name=this.currentRoute.points[id].name;
        }
        this.currentRoute.points[id]=point;
    }
    if (this.currentLeg.name && id == this.currentLeg.currentTarget){
        this.routeOn(avnav.nav.RoutingMode.ROUTE,true);
    }
    this.saveRoute();
    this.navobject.routeEvent();
};
/**
 * add a point to the route
 * @param {number} id the index, -1 for current - point is added after
 * @param {avnav.nav.navdata.Point|avnav.nav.navdata.WayPoint} point
 */
avnav.nav.RouteData.prototype.addWp=function(id,point){
    if (id == -1){
        id=this.activeWp;
    }
    if (id <0) id=0;
    if (this.currentRoute.points){
        if (! (point instanceof avnav.nav.navdata.WayPoint)){
            var p=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
            point=p;
        }
        if (id >= this.currentRoute.points.length){
            this.currentRoute.points.push(point);
            this.activeWp=this.currentRoute.points.length-1;

        }
        else {
            if (id < 0) return;
            this.currentRoute.points.splice(id+1, 0, point);
            this.activeWp=id+1;
        }
    }
    this.saveRoute();
    this.navobject.routeEvent();
};
/**
 * delete all points from the route
 */
avnav.nav.RouteData.prototype.deleteRoute=function(){
    this.currentRoute.points=[];
    this.activeWp=0;
    this.saveRoute();
    if (this.currentLeg.name){
        this.currentLeg.name=undefined;
        this.currentLeg.currentTarget=-1;
        this.currentLeg.active=false;
    }
    this.navobject.routeEvent();
};

/**
 * check if we have to switch to the next WP
 */
avnav.nav.RouteData.prototype.checkNextWp=function(){
    if (! this.currentLeg.name) return;
    var boat=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    //TODO: switch of routing?!
    if (! boat.valid) return;
    if (this.currentLeg.currentTarget >= (this.currentRoute.points-length-1)) return;
    var approach=this.propertyHandler.getProperties().routeApproach;
    try {
        var dst = avnav.nav.NavCompute.computeDistance(boat, this.currentRoute.points[this.currentLeg.currentTarget]);
        //TODO: some handling for approach
        if (dst.dts <= approach){
            this.isApproaching=true;
            var nextDst=avnav.nav.NavCompute.computeDistance(boat, this.currentRoute.points[this.currentLeg.currentTarget+1]);
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
            this.activeWp=this.currentLeg.currentTarget+1;
            this.routeOn(avnav.nav.RoutingMode.ROUTE);
            log("switching to next WP");
        }
        else{
            this.isApproaching=false;
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
            this.currentRoute = this.serverRoute.clone();
        }
        if (this.serverConnected && this.serverLeg){
            this.currentLeg=this.serverLeg.clone();
            this.navobject.routeEvent();
        }
    }
};

