/**
 * Created by andreas on 04.05.14.
 */

import routeobjects from './routeobjects';
import navobjects from './navobjects';
import Formatter from '../util/formatter';
import NavCompute from './navcompute';
import Toast from '../components/Toast.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import RoutEdit from './routeeditor.js';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import base from '../base.js';

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
let RouteData=function(){
    /** @private
     * @type {routeobjects.Leg}
     * */
    this.lastReceivedLeg=undefined;
    this.lastSentLeg=undefined;
    /**
     * @type {routeobjects.Route}
     */
    this.lastReceivedRoute=undefined;
    this.lastSentRoute=undefined;

    //ensure that there is always a current leg and read from local storage
    activeRoute.modify((data)=>{
        let changed=false;
        if (! data.leg){
            data.leg=new routeobjects.Leg(
                new navobjects.WayPoint(0,0),
                new navobjects.WayPoint(0,0),
                false);
            data.leg.approachDistance=parseFloat(globalStore.getData(keys.properties.routeApproach,-1));
            changed=true;
        }
        try {
            let raw=localStorage.getItem(globalStore.getData(keys.properties.routingDataName));
            if (raw){
                data.leg.fromJsonString(raw);
                changed=true;
            }
        }catch(e){
            base.log("Exception reading currentLeg "+e);
        }
        if (data.leg.currentRoute){
            this._saveRouteLocal(data.leg.currentRoute,true);
        }
        if (data.leg.name && ! data.leg.currentRoute){
            //migrate from old stuff
            let route=this._loadRoute(data.leg.name,true);
            if (route){
                data.leg.currentRoute=route;
            }
            else {
                data.leg.currentRoute=new routeobjects.Route(data.leg.name);
            }
            changed=true;
            delete data.leg.name;
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
    this.connectMode=globalStore.getData(keys.properties.connectedMode)||avnav.android !== undefined;

    /**
     * if set all routes are not from the server....
     * @private
     * @type {boolean}
     */

    this.readOnlyServer=globalStore.getData(keys.properties.readOnlyServer);



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
     * @private
     * @type {Formatter}
     */
    this.formatter=Formatter;


    let self=this;
    globalStore.register(this,keys.gui.global.propertySequence);

    this.activeRouteChanged=new Callback(()=>{
        let raw=activeRoute.getRawData();
        self._legChangedLocally(raw.leg);
        if (self.isEditingActiveRoute()){
            editingRoute.setRouteAndIndex(raw.route,raw.index);
        }
    });
    this.editingRouteChanged=new Callback(()=>{
        let route=editingRoute.getRoute();
        if (! route) return;
        this._saveRouteLocal(route);
        if (this.connectMode && ! this.isEditingActiveRoute()) {
            if (route.differsTo(this.lastSentRoute)){
                this.lastSentRoute=route.clone();
            }
            let ignoreExisting=false;
            if (! this.lastReceivedRoute || this.lastReceivedRoute.name != route.name){
                ignoreExisting=true;
            }
            this._sendRoute(route, ()=>{return false},ignoreExisting); //ignore any errors
        }
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
RouteData.prototype.saveRoute=function(rte,opt_callback) {
    if (! rte) return;
    this._saveRouteLocal(rte);
    if (this.connectMode) this._sendRoute(rte, opt_callback,true);
    else {
        if (opt_callback) setTimeout(function () {
            opt_callback();
        }, 0);
    }

};
/**
 * save a route from an xml encoded string
 * we only use this on android
 * so we first try to upload and onyl store locally if we succeed
 * @param routeString
 * @param opt_callback
 * @returns {string}
 */
RouteData.prototype.saveRouteString=function(routeString,opt_callback){
    let error=undefined;
    if (!this.connectMode){
        if (opt_callback) opt_callback("can only save in connected mode");
        return;
    }
    let route=new routeobjects.Route();
    try {
        route.fromXml(routeString);
    }catch(e){
        if (opt_callback)setTimeout(()=>{opt_callback("error parsing route: "+e)},0);
        return e+"";
    }
    this._sendRoute(route, (error)=>{
        if (opt_callback) opt_callback(error)
    },true);
};

/**
 * check if the current route is active
 * @returns {boolean}
 */
RouteData.prototype.isEditingActiveRoute=function(){
    let activeName=activeRoute.getRouteName();
    return activeName && activeName == editingRoute.getRouteName();
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
    let stwp=new navobjects.WayPoint.fromPlain(wp);
    if (wp.routeName){
        //if the waypoint seems to be part of a route
        //check if this is our current active/editing one - if yes, start routing mode
        stwp.routeName=wp.routeName;
        let rt=this._loadRoute(wp.routeName);
        if (!(rt  && rt.getIndexFromPoint(stwp) >= 0)){
            stwp.routeName=undefined;
        }
    }
    if (stwp.routeName){
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
        let nwp=new navobjects.WayPoint();
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
        return true;
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
        if (!data.leg) data.leg = new routeobjects.Leg();
        data.leg.approachDistance = parseFloat(globalStore.getData(keys.properties.routeApproach,-1));
        let pfrom;
        let gps = globalStore.getData(keys.nav.gps.position);
        let center = globalStore.getData(keys.map.centerPosition);
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
            let route = this._loadRoute(newWp.routeName);
            if (!route) return;
            let idx = route.getIndexFromPoint(newWp);
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
        data.activeName=undefined;
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
    let self=this;
    let canUpload=globalStore.getData(keys.gui.capabilities.uploadRoute,false);
    if (! canUpload){
        //if we cannot upload there should not be any routes on the server
        okCallback([],opt_callbackData);
        return;
    }
    return this._remoteRouteOperation("list",{
        okcallback:function(data,param){
            if ((data.status && data.status!='OK') || (!data.items)) {
                if (opt_failCallback) {
                    opt_failCallback(data.status || "no items", param.callbackdata)
                    return;
                }
            }
            let items = [];
            let i;
            for (i = 0; i < data.items.length; i++) {
                let ri = new routeobjects.RouteInfo();
                assign(ri, data.items[i]);
                ri.server = true;
                ri.time=ri.time*1e3; //we receive TS in s
                ri.canDelete=canUpload;
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
    let rt=[];
    let i=0;
    let key,rtinfo,route;
    let routeprfx=globalStore.getData(keys.properties.routeName)+".";
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
    let rt=this._loadRoute(name,true);
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
        this._remoteRouteOperation("delete",{
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
    let route;
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
    this._remoteRouteOperation("download",{
        format:'json',
        name:name,
        self:this,
        f_okcallback:okcallback,
        f_errorcallback:opt_errorcallback,
        okcallback: function(data,param){
            let rt=new routeobjects.Route(param.name);
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
            return true;
        }
        let boat = globalStore.getData(keys.nav.gps.position);
        //TODO: switch of routing?!
        if (!globalStore.getData(keys.nav.gps.valid)) return;
        let nextWpNum = data.leg.getCurrentTargetIdx() + 1;
        let nextWp = data.route.getPointAtIndex(nextWpNum);
        let approach = globalStore.getData(keys.properties.routeApproach) + 0;
        let tolerance = approach / 10; //we allow some position error...
        try {
            let dst = NavCompute.computeDistance(boat, data.leg.to);
            //TODO: some handling for approach
            if (dst.dts <= approach) {
                data.leg.approach = true;
                let nextDst = new navobjects.Distance();
                if (nextWp) {
                    nextDst = NavCompute.computeDistance(boat, nextWp);
                }
                if (this.lastDistanceToCurrent < 0 || this.lastDistanceToNext < 0) {
                    //seems to be the first time
                    this.lastDistanceToCurrent = dst.dts;
                    this.lastDistanceToNext = nextDst.dts;
                    return true;
                }
                //check if the distance to own wp increases and to the nex decreases
                let diffcurrent = dst.dts - this.lastDistanceToCurrent;
                if (diffcurrent <= tolerance) {
                    //still decreasing
                    if (diffcurrent <= 0) {
                        this.lastDistanceToCurrent = dst.dts;
                        this.lastDistanceToNext = nextDst.dts;
                    }
                    return true;
                }
                let diffnext = nextDst.dts - this.lastDistanceToNext;
                if (nextWp && (diffnext > -tolerance)) {
                    //increases to next
                    if (diffnext > 0) {
                        this.lastDistanceToCurrent = dst.dts;
                        this.lastDistanceToNext = nextDst.dts;
                    }
                    return true;
                }
                //should we wait for some time???
                if (nextWp) {
                    data.leg.from=data.leg.to;
                    data.leg.to = nextWp;
                    base.log("switching to next WP");
                    this.lastDistanceToCurrent=-1;
                    this.lastDistanceToNext=-1;
                    data.leg.approach=false;
                }
                else {
                    window.setTimeout(()=> {
                        this.routeOff();
                    },0);
                    base.log("end of route reached");
                }
            }
            else {
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
RouteData.prototype._handleLegResponse = function (serverData) {
    if (!serverData) {
        return false;
    }
    this.routeErrors = 0;
    if (!this.connectMode) return false;
    let nleg = new routeobjects.Leg();
    nleg.fromJson(serverData);
    if (nleg.currentRoute) nleg.currentRoute.server=true;
    //store locally if we did not send or if the leg changed
    if (this.lastSentLeg && !nleg.differsTo(this.lastReceivedLeg)) {
        return false;
    }
    if (! this.lastSentLeg){
        //we now allow to send our leg
        this.lastSentLeg=nleg;
    }
    this.lastReceivedLeg = nleg;
    activeRoute.modify((data)=> {
        if (this.lastReceivedLeg.differsTo(data.leg)) {
            data.leg = this.lastReceivedLeg.clone();
            if (data.leg.name) {
                if (!data.leg.currentRoute) {
                    let route = this._loadRoute(data.leg.name);
                    if (route) {
                        data.leg.currentRoute = route;
                    }
                    else {
                        data.leg.currentRoute = new routeobjects.Route(data.leg.name);
                    }
                }
                delete data.leg.name;
            }
            data.route = data.leg.currentRoute;
            return true;
        }

    });
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
    let url = "?request="+operation+"&type=route";
    let data=undefined;
    let opt=['name','format','ignoreExisting'];
    opt.forEach((rp)=>{
    if (param[rp] !== undefined)
        url += "&"+rp+"=" + encodeURIComponent(param[rp]);
    });
    base.log("remoteRouteOperation, operation="+operation);
    let promise=undefined;
    if (operation != "upload"){
        promise=Requests.getJson(url,{checkOk:false});
    }
    else{
        if (!globalStore.getData(keys.gui.capabilities.uploadRoute)){
            base.log("route upload disabled by capabilities");
            return;
        }
        data=param.route;
        promise=Requests.postJson(url,data);
    }
    promise.then(
        (data)=>{
            if (data.status !== undefined && data.status != 'OK'){
                param.errorcallback("status: "+data.status,param);
                return;
            }
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
    let url = "?request=routing&command=getleg";
    let timeout = globalStore.getData(keys.properties.routeQueryTimeout); //in ms!
    let self = this;
    if (! this.connectMode ){
        this.lastReceivedLeg=undefined;
        this.lastReceivedRoute=undefined;
        this.lastSentRoute=undefined;
        this.lastSentLeg=undefined;
        self.timer=window.setTimeout(function() {
            self._startQuery();
        },timeout);
        return;
    }
    else {
        Requests.getJson(url,{checkOk:false}).then(
            (data)=>{
                let change = self._handleLegResponse(data);
                base.log("leg data change=" + change);
                self.timer = window.setTimeout(function () {
                    self._startQuery();
                }, timeout);
            }
        ).catch(
            (error)=>{
                base.log("query leg error");
                self.routeErrors++;
                if (self.routeErrors > 10) {
                    base.log("lost route");
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
        //we always query the server to let him overwrite what we have...
        this._remoteRouteOperation("download",{
            format:'json',
            name:editingRoute.getRouteName(),
            okcallback:function(data,param){
                if (self.isEditingActiveRoute()) return;
                let nRoute = new routeobjects.Route();
                nRoute.fromJson(data);
                nRoute.server=true;
                let change = nRoute.differsTo(self.lastReceivedRoute);
                base.log("route data change=" + change);
                if (change) {
                    self.lastReceivedRoute = nRoute;
                    editingRoute.modify((data)=> {
                        //maybe the editing route has changed in between...
                        if (! data.route || data.route.name != nRoute.name) return;
                        if (nRoute.differsTo(data.route)) {
                            let oldPoint=data.route.getPointAtIndex(data.index);
                            data.route = self.lastReceivedRoute.clone();
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
RouteData.prototype._saveRouteLocal=function(route, opt_keepTime) {
    if (! route) return;
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime();
    let str = route.toJsonString();
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
    let rt=new routeobjects.Route(name);
    try{
        let raw=localStorage.getItem(globalStore.getData(keys.properties.routeName)+"."+name);
        if (! raw && name == this.DEFAULTROUTE){
            //fallback to load the old default route
            raw=localStorage.getItem(this.FALLBACKROUTENAME);
        }
        if (raw) {
            base.log("route "+name+" successfully loaded");
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
 * send the route
 * @private
 * @param {routeobjects.Route} route
 * @param {function} opt_callback -. will be called on result, param: true on success
 */
RouteData.prototype._sendRoute=function(route, opt_callback,opt_ignoreExisting){
    //send route to server
    let self=this;
    let sroute=route.clone();
    if (sroute.time) sroute.time=sroute.time/1000;
    this._remoteRouteOperation("upload",{
        route:route,
        self:self,
        okcallback:function(data,param){
            base.log("route sent to server");
            if (opt_callback)opt_callback();
        },
        errorcallback:function(status,param){
            let showError=true;
            if (opt_callback) showError=opt_callback(status);
            if (showError && globalStore.getData(keys.properties.routingServerError)) Toast("unable to send route to server:" + status);
        },
        ignoreExisting:opt_ignoreExisting
    });
};


/**
 * leg has changed - save it and reset approach data
 * @returns {boolean}
 * @private
 */
RouteData.prototype._legChangedLocally=function(leg){
    //reset approach handling
    this.lastDistanceToCurrent=-1;
    this.lastDistanceToNext=-1;
    let raw=leg.toJsonString();
    localStorage.setItem(globalStore.getData(keys.properties.routingDataName),raw);
    if (leg.currentRoute){
        this._saveRouteLocal(leg.currentRoute,true);
    }
    let self=this;
    //do not allow to send until we received something
    //this will sync us to the server when we connect (or connect again...)
    if (! this.lastReceivedLeg) return;
    if (! leg.differsTo(this.lastSentLeg)) return;
    if (avnav.android){
        this.lastSentLeg=leg;
        let rt=avnav.android.setLeg(leg.toJsonString());
        if (rt){
            try{
                rt=JSON.parse(rt);
                if (rt.status && rt.status === "OK") return;
            }catch(e){}
        }
        Toast("unable to save leg: "+((rt && rt.status)?rt.status:""));
        return;
    }
    let legJson=leg.toJson();
    if (this.connectMode){
        this.lastSentLeg=leg;
        if (! globalStore.getData(keys.gui.capabilities.uploadRoute)){
            base.log("upload leg disabled by capabilities");
            return;
        }
        Requests.postJson("?request=routing&command=setleg",legJson).then(
            (data)=>{
                base.log("new leg sent to server");
            }
        ).catch(
            (error)=>{
                self.lastSentLeg=undefined;
                if (globalStore.getData(keys.properties.routingServerError)) Toast("unable to send leg to server:" +errMsg);
            }
        );
    }
    return true;
};


/**
 * @private
 */
RouteData.prototype.dataChanged=function() {
    let oldcon=this.connectMode;
    this.connectMode=globalStore.getData(keys.properties.connectedMode);
    this.readOnlyServer=globalStore.getData(keys.properties.readOnlyServer);
    if (oldcon != this.connectMode && this.connectMode){
        //TODO: send route.... if it was local before
    }
};


module.exports=RouteData;

