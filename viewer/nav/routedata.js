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
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import LatLon from 'geodesy/latlon-spherical';

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
 *      * whenever we send a leg with a route
 *      * we also upload this route as gpx (with overwrite being set)
 *      * on errors reset lastSent/lastReceived leg
 *
 *      * if active and editing are equal:
 *        - reset lastSentRoute/lastReceivedRoute
 *        - do not send query for route, do not send route
 *        - ignore answers for route
 *      * if not equal:
 *        - if lastReceivedRoute is empty or not our name
 *          - send with "no overwrite"
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
            let raw=LocalStorage.getItem(STORAGE_NAMES.ROUTING);
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
    this.FALLBACKROUTENAME=STORAGE_NAMES.DEFAULTROUTE; //a fallback name for the default route





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
     * last start time for approach (for early switch handling)
     * @type {undefined}
     */
    this.lastApproachStarted=undefined;
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
            let overwrite=true;
            if (! this.lastReceivedRoute || this.lastReceivedRoute.name != route.name){
                overwrite=false;
            }
            this._sendRoute(route, ()=>{return false},overwrite); //ignore any errors
        }
    });
    globalStore.register(this.activeRouteChanged,activeRoute.getStoreKeys());
    globalStore.register(this.editingRouteChanged,editingRoute.getStoreKeys());
    this.lastLegSequence=globalStore.getData(keys.nav.gps.updateleg);
    this.currentRoutePage=undefined; //only if there is a page that handles a route we will query
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
 * @param {routeobjects.Route} rte
 * @param opt_overwrite if true - overwrite route
 */
RouteData.prototype.saveRoute=function(rte,opt_overwrite) {
    return new Promise((resolve,reject)=>{
        if (! rte) reject("no route");
        if (! opt_overwrite && this._localRouteExists(rte)) reject("route already exists");
        this._saveRouteLocal(rte);
        if (this.connectMode) this._sendRoute(rte,(error)=>{
            if (error) reject(error);
            resolve(0);
        },opt_overwrite);
        else {
            resolve(0);
        }
    });


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
 * @param {boolean} opt_useCurrent - if true and wp is undef - use current position
 */

RouteData.prototype.anchorOn=function(wp,distance,opt_useCurrent){
    if (! wp && opt_useCurrent){
        if (! globalStore.getData(keys.nav.gps.valid)) return;
        wp = globalStore.getData(keys.nav.gps.position);
    }
    if (! wp) return;
    if (! (wp instanceof navobjects.WayPoint)){
        let nwp=new navobjects.WayPoint();
        nwp.update(wp);
        wp=nwp;
    }
    if (distance === undefined){
        distance=globalStore.getData(keys.properties.anchorWatchDefault);
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

RouteData.prototype.legRestart=function(){
    activeRoute.modify((data)=> {
        if (!data.leg || !data.leg.active) return false;
        let gps = globalStore.getData(keys.nav.gps.position);
        if (!globalStore.getData(keys.nav.gps.valid)) return false;
        data.leg.from = new navobjects.WayPoint(gps.lon, gps.lat);
        return true;
    });
}

RouteData.prototype.routeOff=function(){
    if (! activeRoute.hasActiveTarget()) return; //is already off
    activeRoute.modify((data)=> {
        data.leg.active = false;
        data.leg.name = undefined;
        data.leg.currentRoute = undefined;
        data.leg.to.routeName = undefined;
        data.activeName=undefined;
        data.route=undefined;
        return true;
    });
};

/*---------------------------------------------------------
 route management functions (list, remove...)
 ----------------------------------------------------------*/

/**
 * list functions for routes
 * works async
 * @param includeServer if set also fetch routes from server
 */
RouteData.prototype.listRoutes=function(includeServer){
    return new Promise((resolve,reject)=>{
        let list=this._listRoutesLocal();
        if (! includeServer || ! globalStore.getData(keys.gui.capabilities.uploadRoute,false)){
            resolve(list);
            return;
        }
        let editingName=editingRoute.getRouteName();
        let canDelete=globalStore.getData(keys.properties.connectedMode,false);
        Requests.getJson('',{},{
            request:'list',
            type:'route'
        })
            .then((data)=>{
                for (let i = 0; i < data.items.length; i++) {
                    let ri = new routeobjects.RouteInfo();
                    assign(ri, data.items[i]);
                    ri.server = true;
                    if (ri.canDelete !== false) ri.canDelete=canDelete;
                    if (ri.name === editingName) ri.canDelete=false;
                    if (this.isActiveRoute(ri.name)) ri.active=true;
                    let replace=false;
                    for (let oi=0;oi<list.length;oi++){
                        if (list[oi].name === ri.name){
                            list[oi]=ri;
                            replace=true;
                            break;
                        }
                    }
                    if (! replace) list.push(ri);
                }
                resolve(list);

            })
            .catch((error)=>{
                reject(error);
            });

    });
};
/**
 *
 * @param route {routeobjects.Route}
 * @returns {routeobjects.RouteInfo}
 */
RouteData.prototype.getInfoFromRoute=function(route){
    if (! route) return;
    let rtinfo=new routeobjects.RouteInfo(route.name);
    try {
        if (route.points) rtinfo.numpoints=route.points.length;
        rtinfo.length=route.computeLength(0,globalStore.getData(keys.nav.routeHandler.useRhumbLine));
        rtinfo.time=route.time;
    } catch(e){}
    return rtinfo;
}
/**
 * list local routes
 * returns a list of RouteInfo
 * @private
 */
RouteData.prototype._listRoutesLocal=function(){
    let rt=[];
    let i=0;
    let key,rtinfo,route;
    let routeKeys=LocalStorage.listByPrefix(STORAGE_NAMES.ROUTE);
    let editingName=editingRoute.getRouteName();
    let useRhumbLine=globalStore.getData(keys.nav.routeHandler.useRhumbLine);
    for (i=0;i<routeKeys.length;i++){
        key=routeKeys[i];
        let routeName=key.substr(STORAGE_NAMES.ROUTE.length);
            rtinfo=new routeobjects.RouteInfo(this._ensureGpx(routeName));
            try {
                route=new routeobjects.Route();
                route.fromJsonString(LocalStorage.getItem(STORAGE_NAMES.ROUTE,routeName));
                if (route.points) rtinfo.numpoints=route.points.length;
                rtinfo.length=route.computeLength(0,useRhumbLine);
                rtinfo.time=route.time;
                if (this.isActiveRoute(rtinfo.name)) rtinfo.active=true;
                if (rtinfo.name === editingName) rtinfo.canDelete=false;
            } catch(e){}
            rt.push(rtinfo);


    }
    return rt;
};
/**
 * delete a route both locally and on server
 * @param name
 * @param opt_errorcallback
 */
RouteData.prototype.deleteRoute=function(name,opt_okcallback,opt_errorcallback,opt_localonly){
    let localName=name.replace(/\.gpx$/,'');
    let rt=this._loadRoute(localName,true);
    if ((! rt || rt.server) && ! this.connectMode && ! opt_localonly){
        if (opt_errorcallback){
            setTimeout(function(){
                opt_errorcallback("server route and we are disconnected");
            },0);
        }
        return false;
    }
    try{
        LocalStorage.removeItem(STORAGE_NAMES.ROUTE,localName);
    }catch(e){}
    if (this.connectMode && ! opt_localonly){
        Requests.getJson('',{},{
            request:'delete',
            type:'route',
            name: this._ensureGpx(name)
        })
            .then((res)=>{
                if (opt_okcallback) opt_okcallback();
            })
            .catch((error)=>{
                if (opt_errorcallback) opt_errorcallback(error);
            })
    }
    else {
        if (opt_okcallback){
            setTimeout(function(){
                opt_okcallback();
            },0);
        }
    }
};

RouteData.prototype.getLocalRouteXml=function(name){
    name=name.replace(/\.gpx$/,"");
    let route=this._loadRoute(name,true)
    if (! route) return;
    return route.toXml();
}

RouteData.prototype._ensureGpx=function(name){
    if (! name.match(/\.gpx$/)) name+=".gpx";
    return name;
}

RouteData.prototype._downloadRoute=function (name,okcallback,opt_errorcallback){
    name=this._ensureGpx(name);
    Requests.getHtmlOrText('',{useNavUrl:true},{
        request:'download',
        type:'route',
        name:name
    })
        .then((xml)=>{
            let newRoute=new routeobjects.Route();
            newRoute.fromXml(xml);
            let routeName=name.replace(/\.gpx$/,'');
            if (newRoute.name !== routeName){
                let error="downloaded route has invalid name expected="+routeName+", current="+newRoute.name;
                if (opt_errorcallback) opt_errorcallback(error);
                else base.log(error);
                return;
            }
            okcallback(newRoute);
        })
        .catch((error)=>{
            if (opt_errorcallback) opt_errorcallback(error);
        })
}
/**
 *
 * @param name
 * @param localOnly - force local only access even if we are connected
 * @param okcallback
 * @param opt_errorcallback
 */
RouteData.prototype.fetchRoute=function(name,localOnly,okcallback,opt_errorcallback){
    let route;
    const loadLocal=(etxt)=>{
        route=this._loadRoute(name,true);
        if (route){
            setTimeout(function(){
                okcallback(route);
            },0);
        }
        else if (opt_errorcallback){
            setTimeout(function(){
                opt_errorcallback(etxt+": "+name);
            },0);
        }
    }
    if (! localOnly){
        this._downloadRoute(name,(route)=>{
            route.server=true;
            this._saveRouteLocal(route,true);
            if (okcallback){
                okcallback(route);
            }
        },(error)=>{
            loadLocal("unable to fetch from server and locally");
        });
    }
    else{
        loadLocal("unable to fetch locally");
    }

};

/*---------------------------------------------------------
 routing (next wp...)
 ----------------------------------------------------------*/
RouteData.prototype._inQuadrant=function(courseStart,course){
    let ranges=[];
    let min=courseStart-90;
    if (min< 0){
        ranges.push([360+min,360]);
        min=0;
    }
    let max=courseStart+90;
    if (max >= 360){
        ranges.push([0,max-360]);
        max=360;
    }
    ranges.push([min,max]);
    for (let i in ranges){
        let mm=ranges[i];
        if (mm[0] <= course && mm[1]> course) return true;
    }
    return false;
};
/**
 * @private
 * check if we have to switch to the next WP
 */
RouteData.prototype._checkNextWp=function(){
    activeRoute.modify((data)=> {
        if (!data.leg) return;
        if (!data.leg.isRouting()) return;
        let lastApproach=data.leg.approach;
        if (data.leg.to && data.leg.to.name == navobjects.WayPoint.MOB){
            return;
        }
        let boat = globalStore.getData(keys.nav.gps.position);
        //TODO: switch of routing?!
        if (!globalStore.getData(keys.nav.gps.valid)) return;
        let useRhumbLine=globalStore.getData(keys.nav.routeHandler.useRhumbLine);
        let nextWpNum = data.leg.getCurrentTargetIdx() + 1;
        let nextWp = data.route?data.route.getPointAtIndex(nextWpNum):undefined;
        let approach = data.leg.approachDistance;
        let tolerance = approach / 10; //we allow some position error...
        try {
            let dst = NavCompute.computeDistance(boat, data.leg.to,useRhumbLine);
            //TODO: some handling for approach
            if (dst.dts <= approach) {
                data.leg.approach = true;
                if (!data.leg.hasRoute()){
                    return data.leg.approach !== lastApproach;
                }
                let now=(new Date()).getTime();
                if (! lastApproach){
                    this.lastApproachStarted=now;
                }
                let mode=globalStore.getData(keys.nav.routeHandler.nextWpMode,'late');
                let doSwitch=false;
                if (mode === 'early'){
                    if (! this.lastApproachStarted || ! nextWp){
                        return data.leg.approach !== lastApproach;
                    }
                    let wpTime=globalStore.getData(keys.nav.routeHandler.nextWpTime,10);
                    if ((this.lastApproachStarted+1000*wpTime) <= now){
                        doSwitch=true;
                    }
                }
                if (mode === '90'){
                    let start=new LatLon(data.leg.from.lat,data.leg.from.lon);
                    let cur=new LatLon(boat.lat,boat.lon);
                    let target=new LatLon(data.leg.to.lat,data.leg.to.lon);
                    let courseFrom=useRhumbLine?
                        target.rhumbBearingTo(start):target.initialBearingTo(start);
                    let courseCur=useRhumbLine?
                        target.rhumbBearingTo(cur):target.initialBearingTo(cur);
                    if (! this._inQuadrant(courseFrom,courseCur)){
                        //90 reached
                        doSwitch=true
                    }
                }
                if (mode === 'late') {
                    let nextDst = new navobjects.Distance();
                    if (nextWp) {
                        nextDst = NavCompute.computeDistance(boat, nextWp, useRhumbLine);
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
                    doSwitch=true;
                }
                if (doSwitch) {
                    //should we wait for some time???
                    if (nextWp) {
                        data.leg.from = data.leg.to;
                        data.leg.to = nextWp;
                        base.log("switching to next WP");
                        this.lastDistanceToCurrent = -1;
                        this.lastDistanceToNext = -1;
                        data.leg.approach = false;
                    } else {
                        window.setTimeout(() => {
                            this.routeOff();
                        }, 0);
                        base.log("end of route reached");
                    }
                }
            }
            else {
                data.leg.approach = false;
                this.lastApproachStarted=undefined;
                return data.leg.approach != lastApproach;
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
    const configKeys=['useRhumbLine','nextWpMode','nextWpTime'];
    configKeys.forEach((k) => {
        if (serverData[k] !== undefined) {
            globalStore.storeData(keys.nav.routeHandler[k], serverData[k]);
            delete serverData[k];
        }
    })
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
    if (this.isEditingActiveRoute() && nleg.currentRoute){
        //if we are editing the active route we are not sending separate
        //route requests and we use the route from the leg
        //so we have to set this as last received route
        //to avoid the server overwriting us when we stop the active route e.g. by empying it
        this.lastReceivedRoute=nleg.currentRoute.clone();
    }
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
 * @private
 */
RouteData.prototype.startQuery=function() {
    this._checkNextWp();
    let url = "?request=route&command=getleg";
    let timeout = globalStore.getData(keys.properties.routeQueryTimeout); //in ms!
    let self = this;
    if (! this.connectMode ){
        this.lastReceivedLeg=undefined;
        this.lastReceivedRoute=undefined;
        this.lastSentRoute=undefined;
        this.lastSentLeg=undefined;
        self.timer=window.setTimeout(function() {
            self.startQuery();
        },timeout);
        return;
    }
    else {
        let currentLegSequence=globalStore.getData(keys.nav.gps.updateleg);
        if (this.lastLegSequence === undefined || this.lastLegSequence !== currentLegSequence) {
            this.lastLegSequence=currentLegSequence;
            Requests.getJson(url, {checkOk: false}).then(
                (data)=> {
                    let change = self._handleLegResponse(data);
                    base.log("leg data change=" + change);
                    self.timer = window.setTimeout(function () {
                        self.startQuery();
                    }, timeout);
                }
            ).catch(
                (error)=> {
                    base.log("query leg error");
                    self.routeErrors++;
                    if (self.routeErrors > 10) {
                        base.log("lost route");
                        self.serverConnected = false;
                    }
                    self.timer = window.setTimeout(function () {
                        self.startQuery();
                    }, timeout);
                }
            );
        }
        else{
            self.timer = window.setTimeout(function () {
                self.startQuery();
            }, timeout);
        }
    }
    //we only query the route separately if it is currently not active
    if (! this.isEditingActiveRoute()) {
        if (! editingRoute.hasRoute()) return;
        if (this.currentRoutePage === undefined) return;
        //we always query the server to let him overwrite what we have...
        this._downloadRoute(editingRoute.getRouteName(),
                (nRoute)=>{
                if (self.isEditingActiveRoute()) return;
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
            (error)=>{}
        );
    }
};



/**
 * @private
 */
RouteData.prototype._saveRouteLocal=function(route, opt_keepTime) {
    if (! route) return;
    if (! opt_keepTime || ! route.time) route.time = new Date().getTime()/1000;
    let str = route.toJsonString();
    LocalStorage.setItem(STORAGE_NAMES.ROUTE,route.name, str);
    return route;
};

/**
 *
 * @param route
 * @returns {boolean}
 * @private
 */
RouteData.prototype._localRouteExists=function(route) {
    if (! route) return false;
    let existing=LocalStorage.getItem(STORAGE_NAMES.ROUTE, route.name);
    return !!existing;
};

/**
 * load a locally stored route
 * @private
 * @param name
 * @param opt_returnUndef - if set, return undef instead of an empty route if not found
 * @returns {routeobjects.Route}
 */
RouteData.prototype._loadRoute=function(name,opt_returnUndef){
    if (name.match(/\.gpx$/)) name=name.replace(/\.gpx$/,'');
    let rt=new routeobjects.Route(name);
    try{
        let raw=LocalStorage.getItem(STORAGE_NAMES.ROUTE,name);
        if (! raw && name == this.DEFAULTROUTE){
            //fallback to load the old default route
            raw=LocalStorage.getItem(this.FALLBACKROUTENAME);
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
RouteData.prototype._sendRoute=function(route, opt_callback,opt_overwrite){
    //send route to server
    let self=this;
    let sroute=route.clone();
    Requests.postPlain('',route.toXml(),{},{
        request:'upload',
        type:'route',
        name: this._ensureGpx(route.name),
        overwrite: opt_overwrite
    })
        .then((res)=>{
            base.log("route sent to server");
            if (opt_callback)opt_callback();
        })
        .catch((error)=>{
            let showError=true;
            if (opt_callback) showError=opt_callback(error);
            if (showError && globalStore.getData(keys.properties.routingServerError)) Toast("unable to send route to server:" + error);
        })
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
    LocalStorage.setItem(STORAGE_NAMES.ROUTING,undefined,raw);
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
        if (leg.hasRoute()){
            this._sendRoute(leg.currentRoute,undefined,true);
        }
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
        if (leg.hasRoute()){
            this._sendRoute(leg.currentRoute,undefined,true);
        }
        Requests.postJson("?request=route&command=setleg",legJson).then(
            (data)=>{
                base.log("new leg sent to server");
            }
        ).catch(
            (error)=>{
                self.lastSentLeg=undefined;
                if (globalStore.getData(keys.properties.routingServerError)) Toast("unable to send leg to server:" +error);
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
    if (oldcon != this.connectMode){
        if(this.connectMode) {
            this.lastLegSequence = undefined;
        }
        else{
            if (activeRoute.anchorWatch()){
                this.anchorOff();
            }
        }
    }
};

RouteData.prototype.setCurrentRoutePage=function(page){
    this.currentRoutePage=page;
};
RouteData.prototype.unsetCurrentRoutePage=function(page){
    if (this.currentRoutePage !== page) return;
    this.currentRoutePage=undefined;
};



export default RouteData;

