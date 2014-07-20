/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.RouteData');
avnav.provide('avnav.nav.Route');
avnav.provide('avnav.nav.RoutingMode');

avnav.nav.RoutingMode={
    CENTER: 0,      //route to current map center
    ROUTE:  1      //route to the currently selected Point of the route
};

/**
 *
 * @param {string} name
 * @param {Array.<avnav.nav.navdata.WayPoint>} opt_points
 * @constructor
 */
avnav.nav.Route=function(name,opt_points){
    /**
     * is the route active?
     * @type {boolean}
     */
    this.active=false;
    /**
     * index of the currently active WP
     * @type {number}
     */
    this.currentTarget=0;
    /**
     * the route name
     * @type {string}
     */
    this.name=name;
    /**
     * the route points
     * @type {Array.<avnav.nav.navdata.WayPoint>|Array}
     */
    this.points=opt_points||[];
};
avnav.nav.Route.prototype.fromJson=function(jsonString){
    var parsed=JSON.parse(jsonString);
    this.name=parsed.name;
    this.active=parsed.active||false;
    this.currentTarget=parsed.currentTarget||0;
    this.points=[];
    var i;
    var wp;
    if (parsed.points){
        for (i in parsed.points){
            wp=avnav.nav.navdata.WayPoint.fromPlain(parsed.points[i]);
            this.points.push(wp);
        }
    }
};
avnav.nav.Route.prototype.toJsonString=function(){
    var rt={};
    rt.name=this.name;
    rt.points=[];
    rt.active=this.active;
    rt.currentTarget=this.currentTarget;
    var i;
    for (i in this.points){
        rt.points.push(this.points[i]);
    }
    return JSON.stringify(rt);
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
    this.serverLeg={};

    this.currentLeg={
        from: new avnav.nav.navdata.WayPoint(0,0),
        to: new avnav.nav.navdata.WayPoint(0,0),
        name: undefined,
        active: false
    };
    try {
        var raw=localStorage.getItem(this.propertyHandler.getProperties().routingDataName);
        if (raw){
            var nleg=JSON.parse(raw);
            if (nleg.from) this.currentLeg.from=avnav.nav.navdata.WayPoint.fromPlain(nleg.from);
            if (nleg.to) this.currentLeg.to=avnav.nav.navdata.WayPoint.fromPlain(nleg.to);
            if (nleg.name) this.currentLeg.name=nleg.name;
            if (nleg.active !== undefined) this.currentLeg.active=nleg.active;
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
        this.currentRoute.fromJson(raw);
        this.activeWp=this.currentRoute.currentTarget||0;
    }catch(ex){}
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
    this.querySequence=0; //>=0: handle query response when it has the same number, <0: ignore query response

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
 * compare 2 legs
 * @param leg1
 * @param leg2
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.compareLegs=function(leg1,leg2){
    if (! leg1 && ! leg2) return false;
    if (! leg1 && leg2) return true;
    if ( leg1 && ! leg2) return true;
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
    return changed;
};

/**
 * compute the length of the route from the given startpoint
 * @param {number} startIdx
 * @returns {number} distance in nm
 */
avnav.nav.RouteData.prototype.computeLength=function(startIdx){
    var rt=0;
    if (startIdx == -1) startIdx=this.currentRoute.currentTarget;
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
avnav.nav.RouteData.prototype.convertResponse=function(data) {
    if (!data) {
        this.serverConnected = false;
        return true;
    }
    if (! data.to || ! data.from) return false;
    var nleg={
        from: avnav.nav.navdata.WayPoint.fromPlain(data.from),
        to: avnav.nav.navdata.WayPoint.fromPlain(data.to),
        name: data.name,
        active: data.active
    };
    if (this.compareLegs(nleg,this.serverLeg)){
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
    var sequence=this.querySequence;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            if (sequence == self.querySequence && self.querySequence >=0) {
                //ignore response if the query sequence has changed or is < 0
                var change = self.convertResponse(data);
                log("routing data");
                self.handleRouteStatus(true, change);
            }
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            log("query route error");
            self.handleRouteStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });

};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
avnav.nav.RouteData.prototype.handleRouteStatus=function(success,change){
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
    if (this.connectMode && change && success){
        var oldActive=this.currentLeg.active;
        this.currentLeg=this.serverLeg;
        this.currentLeg.active=oldActive;
        this.saveLeg()
    }
    //inform the navobject on any change
    if (change || (oldConnect != this.serverConnected))this.navobject.routeEvent();
};

/**
 * return the current leg
 * @returns {}
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
    //TODO: send to server
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
        var sequence=this.querySequence+1;
        if (sequence < 0) sequence=0;
        var leg=newLeg; //keep this as the server could maybe revert back...
        this.querySequence=-1; //prevent any remote updates
        $.ajax({
            type: "POST",
            url: this.propertyHandler.getProperties().navUrl+"?request=routing&command=setleg",
            data: JSON.stringify(this.currentLeg),
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            success: function(data){
                self.currentLeg=leg;
                self.querySequence=sequence; //re-enable remote update
                log("new leg sent to server");
            },
            error: function(errMsg,x) {
                self.currentLeg=leg;
                self.querySequence=sequence; //re-enable remote update
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
    var nLeg=avnav.clone(this.currentLeg); //make a copy to prevent the remote update from disturbing us
    nLeg.active=true;
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
        this.currentRoute.active=false;
        this.saveRoute();
        nLeg.to=new avnav.nav.navdata.WayPoint();
        center.assign(nLeg.to);
        this.legChanged(nLeg);
        return true;
    }
    if (mode == avnav.nav.RoutingMode.ROUTE){
        this.currentRoute.active=true;
        this.currentRoute.currentTarget=this.getActiveWpIdx();
        this.saveRoute();
        nLeg.to = new avnav.nav.navdata.WayPoint();
        this.getActiveWp().assign(nLeg.to);
        this.legChanged(nLeg);
        return true;
    }
    return false;
};

avnav.nav.RouteData.prototype.routeOff=function(){
    if (! this.getLock()) return; //is already off
    this.currentLeg.active=false;
    this.currentRoute.active=false;
    this.saveLeg();
    this.saveRoute();
    this.navobject.routeEvent();
};


/**
 * get the current lock state
 * @returns {boolean}
 */
avnav.nav.RouteData.prototype.getLock=function(){
    return this.currentLeg.active||this.currentRoute.active;
};
/**
 *
 * @param {number} id the index in the route
 */
avnav.nav.RouteData.prototype.setActiveWp=function(id){
    this.activeWp=id;
    this.navobject.routeEvent();
};
/**
 * get the index of the active wp from the current route
 * @return {number}
 */
avnav.nav.RouteData.prototype.getActiveWpIdx=function(){
    return this.activeWp;
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
 * @returns @returns {avnav.nav.navdata.WayPoint}
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
    var changeTarget=this.currentRoute.active && id == this.currentRoute.currentTarget;
    if (this.currentRoute.points){
        if (id >= this.currentRoute.points.length)id=this.currentRoute.points.length-1;
        this.currentRoute.points.splice(id,1);
        if (id <= this.currentRoute.currentTarget && this.currentRoute.currentTarget > 0) this.currentRoute.currentTarget--;
        if (id <= this.activeWp && this.activeWp > 0) this.activeWp--;
        if (this.activeWp >= this.currentRoute.points.length)this.activeWp=this.currentRoute.points.length-1;
        if (this.currentRoute.currentTarget >= this.currentRoute.points.length)this.currentRoute.currentTarget=this.currentRoute.points.length-1;
    }
    if (changeTarget) this.routeOn(avnav.nav.RoutingMode.ROUTE,true);
    this.saveRoute();
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
        if (! point instanceof avnav.nav.navdata.WayPoint){
            var p=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
            point=p;
        }
        this.currentRoute.points[id]=point;
    }
    if (this.currentRoute.active && id == this.currentRoute.currentTarget){
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
    this.currentRoute.active=false;
    this.currentRoute.currentTarget=0;
    this.activeWp=0;
    this.saveRoute();
    this.navobject.routeEvent();
};

/**
 * check if we have to switch to the next WP
 */
avnav.nav.RouteData.prototype.checkNextWp=function(){
    if (! this.currentRoute.active) return;
    var boat=this.navobject.getRawData(avnav.nav.NavEventType.GPS);
    //TODO: switch of routing?!
    if (! boat.valid) return;
    if (this.currentRoute.currentTarget >= (this.currentRoute.points-length-1)) return;
    var approach=this.propertyHandler.getProperties().routeApproach;
    try {
        var dst = avnav.nav.NavCompute.computeDistance(boat, this.currentRoute.points[this.currentRoute.currentTarget]);
        //TODO: some handling for approach
        if (dst.dts <= approach){
            this.isApproaching=true;
            var nextDst=avnav.nav.NavCompute.computeDistance(boat, this.currentRoute.points[this.currentRoute.currentTarget+1]);
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
            this.activeWp=this.currentRoute.currentTarget+1;
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
        if (this.serverConnected && this.serverLeg){
            var oldActive=this.currentLeg.active;
            this.currentLeg=this.serverLeg;
            this.currentLeg.active=oldActive;
            this.navobject.routeEvent();
        }
    }
};

