/**
 * Created by andreas on 04.05.14.
 */

import routeobjects from './routeobjects';
import navobjects from './navobjects';
import Formatter from '../util/formatter';
import NavCompute from './navcompute';
import Overlay from '../util/overlay';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import RoutEdit from './routeeditor.js';
import Requests from '../util/requests.js';
import assign from 'object-assign';

const activeRoute=new RoutEdit(RoutEdit.MODES.ACTIVE);
const editingRoute=new RoutEdit(RoutEdit.MODES.EDIT);

class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}
/**
 * sync handling with the server
 * basically the server has priority, i.e. we always wait until we got the info
 * from the server before we send
 * we sync:
 *      * the current leg (activeRoute)
 *      * the editingRoute (only if not equal to the activeRoute)
 * we have 2 local members:
 *      * lastSentLeg
 *      * lastSentRoute
 *      * lastReceivedLeg
 *      * lastReceivedRoute
 * if we are not connected:
 *      * reset all members to undefined, do not send/receive
 * if we are connected:
 *      * query the current leg
 *      * do not send the leg until we received one (lastReceivedLeg is set)
 *      * only send the leg if different to lastSentLeg
 *      * on errors reset lastSent/lastReceived leg
 *
 *      * if active and editing are equal:
 *        - reset lastSentRoute/lastReceivedRoute
 *        - do not send query for route, do not send route
 *        - ignore answers for route
 *      * if not equal:
 *        - if lastReceivedRoute is empty or not our name
 *          - send with "ignore existing"
 *        - do route query
 *  if we change to connected:
 *      * trigger send for editing route with ignore existing
 *
 */
/**
 * the handler for the routing data
 * query the server...
 * basically it can work in 2 modes:
 * active route mode - the currentleg and the editingRoute will kept in sync
 * editing mode      - the editing route is different from the one in the leg
 * @constructor
 */
var RouteData=function(){
    /** @private
     * @type {routeobjects.Leg}
     * */
    this.serverLeg=new routeobjects.Leg();
    //ensure that there is always a current leg and read from local storage
    activeRoute.modify((data)=>{
        let changed=false;
        if (! data.leg){
            data.leg=new routeobjects.Leg(
                new navobjects.WayPoint(0,0),
                new navobjects.WayPoint(0,0),
                false);
            data.leg.approachDistance=globalStore.getData(keys.properties.routeApproach)+0;
            changed=true;
        }
        try {
            let raw=localStorage.getItem(globalStore.getData(keys.properties.routingDataName));
            if (raw){
                data.leg.fromJsonString(raw);
                changed=true;
            }
        }catch(e){
            avnav.log("Exception reading currentLeg "+e);
        }
        if (data.leg.name && ! data.leg.currentRoute){
            //migrate from old stuff
            var route=this._loadRoute(data.leg.name,true);
            if (route){
                data.leg.currentRoute=route;
                delete data.leg.name;
                changed=true;
            }
            else {
                data.leg.currentRoute=new routeobjects.Route(data.leg.name);
                delete data.leg.name;
                changed=true;
            }
        }
        data.route=data.leg.currentRoute;
        return changed;
    });
    /**
     * name of the default route
     * @type {string}
     */
    this.DEFAULTROUTE="default";
    this.FALLBACKROUTENAME="avnav.defaultRoute"; //a fallback name for the default route





    /**
     * @private
     * @type {boolean}
     */
    this.connectMode=globalStore.getData(keys.properties.connectedMode);

    /**
     * if set all routes are not from the server....
     * @private
     * @type {boolean}
     */

    this.readOnlyServer=globalStore.getData(keys.properties.readOnlyServer);
    /**
     * this route is the editing route
     * @type {routeobjects.Route}
     */
    this.serverRoute=undefined;

    /**
     *
     */
    this.serverLeg=undefined;


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

    this.lastSendLeg=undefined;

    var self=this;
    globalStore.register(this,keys.gui.global.propertySequence);

    this.activeRouteChanged=new Callback(()=>{
        let raw=activeRoute.getRawData();
        self._legChanged(raw.leg);
        if (editingRoute.getRouteName() == activeRoute.getRouteName() && activeRoute.getRouteName() !== undefined){
            editingRoute.setRouteAndIndex(raw.route,raw.index);
        }
    });
    this.editingRouteChanged=new Callback(()=>{
        let route=editingRoute.getRoute();
        self.saveRoute(route);
    });
    globalStore.register(this.activeRouteChanged,activeRoute.getStoreKeys());
    globalStore.register(this.editingRouteChanged,editingRoute.getStoreKeys());

    this._startQuery();
};
/*---------------------------------------------------------
 get raw data functions
 ----------------------------------------------------------*/







/**
 * check if a route is the current active one
 * @param {string} name
 * @returns {boolean}
 */
RouteData.prototype.isActiveRoute=function(name){
    return name == activeRoute.getRouteName();
};



/**
 * save the route (locally and on the server)
 * @param {routeobjects.Route|undefined} rte
 * @param {function} opt_callback
 */
RouteData.prototype.saveRoute=function(rte,opt_callback,opt_localOnly) {
    var route=this._saveRouteLocal(rte);
    if (! route ) return;
    if (avnav.android){
        avnav.android.storeRoute(route.toJsonString());
    }
    if (this.connectMode && ! opt_localOnly) this._sendRoute(route, opt_callback);
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
    return activeRoute.getRouteName() == editingRoute.getRouteName();
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
 state changes (edit on/route on/off...)
 ----------------------------------------------------------*/


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
        var rt=this._loadRoute(wp.routeName);
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
 * @param {number} distance
 */

RouteData.prototype.anchorOn=function(wp,distance){
    if (! wp) return;
    if (! (wp instanceof navobjects.WayPoint)){
        var nwp=new navobjects.WayPoint();
        nwp.update(wp);
        wp=nwp;
    }
    activeRoute.modify((data)=> {
        if (data.leg) data.leg.setAnchorWatch(wp, distance);
        return true;
    });
};
RouteData.prototype.anchorOff=function(){
    activeRoute.modify((data)=> {
        if (!data.leg) return;
        data.leg.anchorDistance = undefined;
        data.leg.to = new navobjects.WayPoint(0, 0);
        data.leg.active = false;
    });
};
/**
 *
 * @param mode
 * @param {navobjects.WayPoint} newWp
 * @param {boolean} opt_keep_from
 * @returns {boolean}
 * @private
 */
RouteData.prototype._startRouting = function (mode, newWp, opt_keep_from) {
    activeRoute.modify((data)=> {
        if (data.leg) data.leg = new routeobjects.Leg();
        data.leg.approachDistance = globalStore.getData(keys.properties.routeApproach) + 0;
        var pfrom;
        var gps = globalStore.getData(keys.nav.gps.position);
        var center = globalStore.getData(keys.map.centerPosition);
        if (globalStore.getData(keys.nav.gps.valid)) {
            pfrom = new navobjects.WayPoint(gps.lon, gps.lat);
        }
        else {
            pfrom = new navobjects.WayPoint();
            center.assign(pfrom);
        }
        //check if we change the mode - in this case we always set a new from
        if (!data.leg.active) {
            opt_keep_from = false;
        }
        else {
            if (data.leg.hasRoute()) {
                //we had a route
                if (mode == routeobjects.RoutingMode.WP || mode == routeobjects.RoutingMode.WPINACTIVE) {
                    opt_keep_from = false;
                }
                else {
                    if (newWp && newWp.routeName != data.leg.getRouteName()) {
                        //we switched to a new route
                        opt_keep_from = false;
                    }
                }
            }
            else {
                if (mode == routeobjects.RoutingMode.ROUTE) {
                    opt_keep_from = false;
                }
            }
        }
        if (!opt_keep_from) data.leg.from = pfrom;
        data.leg.active = false;
        if (mode == routeobjects.RoutingMode.WP) {
            data.leg.to = newWp;
            data.leg.name = undefined;
            data.route=undefined;
            data.leg.currentRoute = undefined;
            data.leg.active = true;
            data.leg.anchorDistance = undefined;
            return true;
        }
        if (mode == routeobjects.RoutingMode.WPINACTIVE) {
            data.leg.to = newWp;
            data.leg.name = undefined;
            data.leg.currentRoute = undefined;
            data.leg.active = false;
            data.leg.anchorDistance = undefined;
            data.route=undefined;
            return true;
        }
        if (mode == routeobjects.RoutingMode.ROUTE) {
            if (!newWp || !newWp.routeName) return;
            var route = this._loadRoute(newWp.routeName);
            if (!route) return;
            var idx = route.getIndexFromPoint(newWp);
            if (idx < 0) return;
            data.leg.currentRoute = route;
            data.route=route;
            data.leg.name = undefined;
            data.leg.to = newWp;
            data.leg.active = true;
            data.leg.anchorDistance = undefined;
            return true;
        }
        return false;
    });
};


RouteData.prototype.routeOff=function(){
    if (! activeRoute.hasActiveTarget()) return; //is already off
    activeRoute.modify((data)=> {
        data.leg.active = false;
        data.leg.name = undefined;
        data.leg.currentRoute = undefined;
        data.leg.to.routeName = undefined;
        return true;
    });
};

/*---------------------------------------------------------
 route management functions (list, remove...)
 ----------------------------------------------------------*/

/**
 * list functions for routes
 * works async
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
    var routeprfx=globalStore.getData(keys.properties.routeName)+".";
    for (i=0;i<localStorage.length;i++){
        key=localStorage.key(i);
        if (key.substr(0,routeprfx.length)==routeprfx){
            rtinfo=new routeobjects.RouteInfo(key.substr(routeprfx.length));
            try {
                route=new routeobjects.Route();
                route.fromJsonString(localStorage.getItem(key));
                if (route.points) rtinfo.numpoints=route.points.length;
                rtinfo.length=route.computeLength(0);
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
        localStorage.removeItem(globalStore.getData(keys.properties.routeName)+"."+name);
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
    activeRoute.modify((data)=> {
        if (!data.leg) return;
        if (!data.leg.hasRoute()) {
            data.leg.approach = false;
            this.isApproaching = false;
            return true;
        }
        var boat = globalStore.getData(keys.nav.gps.position);
        //TODO: switch of routing?!
        if (!globalStore.getData(keys.nav.gps.valid)) return;
        var nextWpNum = data.leg.getCurrentTargetIdx() + 1;
        var nextWp = data.route.getPointAtIndex(nextWpNum);
        var approach = globalStore.getData(keys.properties.routeApproach) + 0;
        var tolerance = approach / 10; //we allow some position error...
        try {
            var dst = NavCompute.computeDistance(boat, data.leg.to);
            //TODO: some handling for approach
            if (dst.dts <= approach) {
                this.isApproaching = true;
                data.leg.approach = true;
                var nextDst = new navobjects.Distance();
                if (nextWp) {
                    nextDst = NavCompute.computeDistance(boat, nextWp);
                }
                if (this.lastDistanceToCurrent < 0 || this.lastDistanceToNext < 0) {
                    //seems to be the first time
                    this.lastDistanceToCurrent = dst.dts;
                    this.lastDistanceToNext = nextDst.dts;
                    return;
                }
                //check if the distance to own wp increases and to the nex decreases
                var diffcurrent = dst.dts - this.lastDistanceToCurrent;
                if (diffcurrent <= tolerance) {
                    //still decreasing
                    if (diffcurrent <= 0) {
                        this.lastDistanceToCurrent = dst.dts;
                        this.lastDistanceToNext = nextDst.dts;
                    }
                    return;
                }
                var diffnext = nextDst.dts - this.lastDistanceToNext;
                if (nextWp && (diffnext > -tolerance)) {
                    //increases to next
                    if (diffnext > 0) {
                        this.lastDistanceToCurrent = dst.dts;
                        this.lastDistanceToNext = nextDst.dts;
                    }
                    return;
                }
                //should we wait for some time???
                if (nextWp) {
                    data.leg.to = nextWp;
                    avnav.log("switching to next WP");
                }
                else {
                    window.setTimeout(()=> {
                        this.routeOff();
                    },0);
                    avnav.log("end of route reached");
                }
            }
            else {
                this.isApproaching = false;
                data.leg.approach = false;
            }
        } catch (ex) {
        } //ignore errors
        return true;
    });
};

/*---------------------------------------------------------
 internal helpers
 ----------------------------------------------------------*/


/**
 *
 * @param data
 * @private
 * @return {Boolean} - true if data has changed
 */
RouteData.prototype._handleLegResponse=function(serverData) {
    if (!serverData) {
        this.serverConnected = false;
        return false;
    }
    this.routeErrors=0;
    this.serverConnected=true;
    if (! serverData.from) return false;
    var nleg=new routeobjects.Leg();
    nleg.fromJson(serverData);
    if (!nleg.differsTo(this.serverLeg)) {
        return false;
    }
    this.serverLeg=nleg;

    let self=this;

    if (this.connectMode) {
        activeRoute.modify((data)=> {
            if (this.serverLeg.differsTo(data.leg)) {
                data.leg = this.serverLeg.clone();
                if (data.leg.name) {
                    if (!data.leg.currentRoute) {
                        var route = this._loadRoute(data.leg.name);
                        if (route) {
                            data.leg.currentRoute = route;
                            delete data.leg.name;
                        }
                        else {
                            data.leg.currentRoute = new routeobjects.Route(data.leg.name);
                            delete data.leg.name;
                        }
                    }
                }
                data.route=data.leg.currentRoute;
                return true;
            }

        });
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
    var url = "?request=routing&command=" + operation;
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
        data=param.route.toJson();
    }
    avnav.log("remoteRouteOperation, operation="+operation);
    param.operation=operation;
    let promise=undefined;
    if (operation != "setroute"){
        promise=Requests.getJson(url,{checkOk:false})
    }
    else{
        promise=Requests.postJson(url,data);
    }
    promise.then(
        (data)=>{
           param.okcallback(data,param);
        }
    ).catch(
        (error)=>{
           param.errorcallback(error,param);
        }
    );
};

/**
 * @private
 */
RouteData.prototype._startQuery=function() {
    this._checkNextWp();
    var url = "?request=routing&command=getleg";
    var timeout =globalStore.getData(keys.properties.routeQueryTimeout); //in ms!
    var self = this;
    if (! this.connectMode ){
        self.timer=window.setTimeout(function() {
            self._startQuery();
        },timeout);
        return;
    }
    else {
        Requests.getJson(url,{checkOk:false}).then(
            (data)=>{
                var change = self._handleLegResponse(data);
                avnav.log("leg data change=" + change);
                self.timer = window.setTimeout(function () {
                    self._startQuery();
                }, timeout);
            }
        ).catch(
            (error)=>{
                avnav.log("query leg error");
                self.routeErrors++;
                if (self.routeErrors > 10) {
                    avnav.log("lost route");
                    self.serverConnected = false;
                }
                self.timer = window.setTimeout(function () {
                    self._startQuery();
                }, timeout);
            }
        );
    }
    //we only query the route separately if it is currently not active
    if (! this.isEditingActiveRoute()) {
        if (! editingRoute.hasRoute()) return;
        if (! this.connectMode) return;
        //we always query the server to let him overwrite what we have...
        //if (! this.editingRoute.server) return;
        this._remoteRouteOperation("getroute",{
            name:editingRoute.getRouteName(),
            okcallback:function(data,param){
                if (self.isEditingActiveRoute()) return;
                var nRoute = new routeobjects.Route();
                nRoute.fromJson(data);
                nRoute.server=true;
                var change = nRoute.differsTo(self.serverRoute);
                avnav.log("route data change=" + change);
                if (change) {
                    self.serverRoute = nRoute;
                    editingRoute.modify((data)=> {
                        if (data.route.differsTo(self.serverRoute)) {
                            let oldPoint=data.route.getPointAtIndex(data.index);
                            data.route = self.serverRoute.clone();
                            data.index=data.route.findBestMatchingIdx(oldPoint);
                            if (data.index < 0) data.index=0;
                            return true;
                        }
                    });

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
        route = activeRoute.getRoute();
        if (!route) return route;

    }
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime();
    var str = route.toJsonString();
    localStorage.setItem(globalStore.getData(keys.properties.routeName) + "." + route.name, str);
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
        var raw=localStorage.getItem(globalStore.getData(keys.properties.routeName)+"."+name);
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
            if (globalStore.getData(keys.properties.routingServerError)) Overlay.Toast("unable to send route to server:" + errMsg);
            if (opt_callback) opt_callback(false);
        }
    });
};


/**
 * leg has changed - save it and reset approach data
 * @returns {boolean}
 * @private
 */
RouteData.prototype._legChanged=function(leg){
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    var raw=leg.toJsonString();
    localStorage.setItem(globalStore.getData(keys.properties.routingDataName),raw);
    var self=this;
    if (avnav.android){
        var rt=avnav.android.setLeg(leg.toJsonString());
        if (rt){
            try{
                rt=JSON.parse(rt);
                if (rt.status && rt.status === "OK") return;
            }catch(e){}
        }
        Overlay.Toast("unable to save leg: "+((rt && rt.status)?rt.status:""));
        return;
    }
    if (! leg.differsTo(this.lastSendLeg)) return;
    let legJson=leg.toJson();
    if (this.connectMode){
        this.lastSendLeg=leg;
        Requests.postJson("?request=routing&command=setleg",legJson).then(
            (data)=>{
                avnav.log("new leg sent to server");
            }
        ).catch(
            (error)=>{
                self.lastSendLeg=undefined;
                if (globalStore.getData(keys.properties.routingServerError)) Overlay.Toast("unable to send leg to server:" +errMsg);
            }
        );
    }
    return true;
};


/**
 * @private
 * @param evdata
 */
RouteData.prototype.dataChanged=function() {
    var oldcon=this.connectMode;
    this.connectMode=globalStore.getData(keys.properties.connectedMode);
    this.readOnlyServer=globalStore.getData(keys.properties.readOnlyServer);
    if (oldcon != this.connectMode && this.connectMode){
        //newly connected
        var oldActive;
        if (this.serverConnected && this.serverRoute) {
            this.editingRoute = this.serverRoute.clone();
        }
        if (this.serverConnected && this.serverLeg){
            this.currentLeg=this.serverLeg.clone();
        }

    }
};


module.exports=RouteData;

