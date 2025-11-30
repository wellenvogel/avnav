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
import requests from "../util/requests.js";

const activeRoute=new RoutEdit(RoutEdit.MODES.ACTIVE);
const editingRoute=new RoutEdit(RoutEdit.MODES.EDIT);
export const KeepFromMode={
    NONE: 0, //use current position or center
    CURRENT: 1, //keep current from
    OLDTO: 2 //use old "to"
}
/**
 * sync handling with the server
 * basically the server has priority, i.e. we always wait until we got the info
 * from the server before we send
 * we strictly separate routes from the server and local routes
 * for local routes we do not send anything to the server
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
class  RouteData {
    constructor() {
        /** @private
         * @type {routeobjects.Leg}
         * */
        this.lastReceivedLeg = undefined;
        this.lastSentLeg = undefined;
        /**
         * @type {routeobjects.Route}
         */
        this.lastReceivedRoute = undefined;
        this.lastSentRoute = undefined;


        //ensure that there is always a current leg and read from local storage
        activeRoute.modify((data) => {
            let changed = false;
            if (!data.leg) {
                data.leg = new routeobjects.Leg(
                    new navobjects.WayPoint(0, 0),
                    new navobjects.WayPoint(0, 0),
                    false);
                data.leg.approachDistance = parseFloat(globalStore.getData(keys.properties.routeApproach, -1));
                changed = true;
            }
            try {
                let raw = LocalStorage.getItem(STORAGE_NAMES.ROUTING);
                if (raw) {
                    data.leg.fromJsonString(raw);
                    changed = true;
                }
            } catch (e) {
                base.log("Exception reading currentLeg " + e);
            }
            if (data.leg.currentRoute) {
                this._saveRouteLocal(data.leg.currentRoute, true);
            }
            if (data.leg.name && !data.leg.currentRoute) {
                //no migration any more for old legs without the route
                delete data.leg.name;
            }
            data.route = data.leg.currentRoute;
            return changed;
        });
        /**
         * name of the default route
         * @type {string}
         */
        this.DEFAULTROUTE = "default";
        this.FALLBACKROUTENAME = STORAGE_NAMES.DEFAULTROUTE; //a fallback name for the default route


        /**
         * @private
         * @type {boolean}
         */
        this.connectMode = !!globalStore.getData(keys.properties.connectedMode);

        /**
         * if set all routes are not from the server....
         * @private
         * @type {boolean}
         */

        this.readOnlyServer = !!globalStore.getData(keys.properties.readOnlyServer);


        /**legChanged
         * @private
         * @type {null}
         */
        this.timer = null;
        /**
         * @private
         * @type {number}
         */
        this.routeErrors = 0;
        /**
         * last distance to current WP
         * @private
         * @type {number}
         */
        this.lastDistanceToCurrent = -1;
        /**
         * last distance to next wp
         * @private
         * @type {number}
         */
        this.lastDistanceToNext = -1;
        /**
         * last start time for approach (for early switch handling)
         * @type {undefined}
         */
        this.lastApproachStarted = undefined;
        /**
         * @private
         * @type {Formatter}
         */
        this.formatter = Formatter;

        globalStore.register(() => {
            let oldcon = !!this.connectMode;
            this.connectMode = !!globalStore.getData(keys.properties.connectedMode);
            this.readOnlyServer = globalStore.getData(keys.properties.readOnlyServer);
            if (oldcon !== this.connectMode) {
                //prevent sending anything to the server
                this.lastReceivedLeg = undefined;
                this.lastReceivedRoute = undefined;
                if (this.connectMode) {
                    this.lastLegSequence = undefined;
                }
                this.routeOff();
                this.anchorOff()
            }
        }, keys.gui.global.propertySequence);
        globalStore.register(()=>{
            let raw = activeRoute.getRawData();
            if (raw.leg) {
                if (raw.leg.server){
                    this._sendleg(raw.leg);
                }
                else {
                    this._legChangedLocally(raw.leg);
                }
            }
            if (this.isEditingActiveRoute()) {
                editingRoute.setRouteAndIndex(raw.route, raw.index);
            }
        }, activeRoute.getStoreKeys());
        globalStore.register(()=>{
            let route = editingRoute.getRoute();
            if (!route) return;
            if (!route.server) {
                this._saveRouteLocal(route);
                return;
            }
            if (this.connectMode && !this.isEditingActiveRoute()) {
                if (route.differsTo(this.lastSentRoute)) {
                    this.lastSentRoute = route.clone();
                }
                let overwrite = true;
                if (!this.lastReceivedRoute || this.lastReceivedRoute.name != route.name) {
                    overwrite = false;
                }
                this._sendRoute(route, () => {
                    return false
                }, overwrite); //ignore any errors
            }
        }, editingRoute.getStoreKeys());
        this.lastLegSequence = globalStore.getData(keys.nav.gps.updateleg);
        this.currentRoutePage = undefined; //only if there is a page that handles a route we will query
    };

    /*---------------------------------------------------------
     get raw data functions
     ----------------------------------------------------------*/


    /**
     * check if a route is the current active one
     * @param {string} routeItem (name,server)
     * @returns {boolean}
     */
    isActiveRoute(routeItem) {
        return activeRoute.isHandling(routeItem);
    };


    /**
     * save the route (locally and on the server)
     * @param {routeobjects.Route} rte
     * @param opt_overwrite if true - overwrite route
     */
    saveRoute(rte, opt_overwrite) {
        if (!rte) throw new Error("no route for save");
        if (!rte.isServer()) {
            if (!opt_overwrite && this._localRouteExists(rte)) throw new Error("local route already exists");
            this._saveRouteLocal(rte);
            return Promise.resolve(true);
        }
        if (! this.connectMode) throw new Error("cannot save server route while disconnected");
        return new Promise((resolve,reject)=>{
            this._sendRoute(rte, (error) => {
                if (error) reject(error);
                resolve(0);
            }, opt_overwrite);
        });


    };
    /**
     * check if the current route is active
     * @returns {boolean}
     */
    isEditingActiveRoute() {
        return editingRoute.isActiveRoute();
    };


    /*---------------------------------------------------------
     state changes (edit on/route on/off...)
     ----------------------------------------------------------*/


    /**
     *
     * @param {navobjects.WayPoint} wp
     * @param {number}[opt_keep_from] KeepFromMode
     */
    async wpOn(wp, opt_keep_from) {
        if (!wp) {
            this.routeOff();
            return;
        }
        if (!opt_keep_from) opt_keep_from = KeepFromMode.NONE;
        if (opt_keep_from === true) opt_keep_from = KeepFromMode.CURRENT;
        let stwp = new navobjects.WayPoint.fromPlain(wp);
        stwp.server=this.connectMode;
        let route;
        if (wp.routeName) {
            //if the waypoint seems to be part of a route
            //check if this is our current active/editing one - if yes, start routing mode
            stwp.routeName = wp.routeName;
            if (routeobjects.isServerName(stwp.routeName) !== stwp.server) {
                if (!stwp.server) throw new Error("can only start routing with a server route in connected mode");
                throw new Error("can only start routing with a local route in disconnected mode");
            }
            route = await this.fetchRoute(wp.routeName);
            if (!(route && route.getIndexFromPoint(stwp) >= 0)) {
                stwp.routeName = undefined;
            }
        }
        if (stwp.routeName) {
            this._startRouting(routeobjects.RoutingMode.ROUTE, stwp, opt_keep_from,route);
        } else {
            this._startRouting(routeobjects.RoutingMode.WP, stwp, opt_keep_from);
        }
    };


    /**
     *
     * @param {navobjects.WayPoint} wp
     * @param {number} distance
     * @param {boolean} opt_useCurrent - if true and wp is undef - use current position
     */

    anchorOn(wp, distance, opt_useCurrent) {
        if (!wp && opt_useCurrent) {
            if (!globalStore.getData(keys.nav.gps.valid)) return;
            wp = globalStore.getData(keys.nav.gps.position);
        }
        if (!wp) return;
        if (!(wp instanceof navobjects.WayPoint)) {
            let nwp = new navobjects.WayPoint();
            nwp.update(wp);
            wp = nwp;
        }
        if (distance === undefined) {
            distance = globalStore.getData(keys.properties.anchorWatchDefault);
        }
        activeRoute.modify((data) => {
            if (data.leg) data.leg.setAnchorWatch(wp, distance);
            return true;
        });
    };

    anchorOff() {
        activeRoute.modify((data) => {
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
     * @param {KeepFromMode} keep_from
     * @param route - if the mode is ROUTE
     * @returns {boolean}
     * @private
     */
    _startRouting(mode, newWp, keep_from,route) {
        activeRoute.modify((data) => {
            let pfrom;
            let gps = globalStore.getData(keys.nav.gps.position);
            let center = globalStore.getData(keys.map.centerPosition);
            if (globalStore.getData(keys.nav.gps.valid)) {
                pfrom = new navobjects.WayPoint(gps.lon, gps.lat);
            } else {
                pfrom = new navobjects.WayPoint();
                center.assign(pfrom);
            }
            let oldFrom;
            //check if we change the mode - in this case we always set a new from
            if (!data.leg || !data.leg.active) {
                keep_from = KeepFromMode.NONE;
            } else {
                if (data.leg.hasRoute()) {
                    //we had a route
                    if (mode == routeobjects.RoutingMode.WP || mode == routeobjects.RoutingMode.WPINACTIVE) {
                        keep_from = KeepFromMode.NONE;
                    } else {
                        if (newWp &&
                            (newWp.routeName != data.leg.getRouteName())) {
                            //we switched to a new route
                            keep_from = KeepFromMode.NONE;
                        }
                    }
                } else {
                    if (mode == routeobjects.RoutingMode.ROUTE) {
                        keep_from = KeepFromMode.NONE;
                    }
                }
                if (keep_from === KeepFromMode.CURRENT) oldFrom = data.leg.from;
                if (keep_from === KeepFromMode.OLDTO) oldFrom = data.leg.to;
            }
            data.leg = new routeobjects.Leg();
            data.leg.server=newWp.server;
            data.leg.approachDistance = parseFloat(globalStore.getData(keys.properties.routeApproach, -1));
            if (oldFrom) data.leg.from = oldFrom;
            else data.leg.from = pfrom;
            data.leg.active = false;
            if (mode == routeobjects.RoutingMode.WP) {
                data.leg.to = newWp;
                data.leg.name = undefined;
                data.route = undefined;
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
                data.route = undefined;
                return true;
            }
            if (mode == routeobjects.RoutingMode.ROUTE) {
                if (!newWp || !newWp.routeName) return;
                if (!route) return;
                if (route.name !== newWp.routeName) throw new Error("internal error, loaded wrong route");
                let idx = route.getIndexFromPoint(newWp);
                if (idx < 0) return;
                data.leg.currentRoute = route;
                data.route = route;
                data.leg.name = undefined;
                data.leg.to = newWp;
                data.leg.active = true;
                data.leg.anchorDistance = undefined;
                data.leg.server=route.isServer();
                return true;
            }
            return false;
        });
    };

    legRestart() {
        activeRoute.modify((data) => {
            if (!data.leg || !data.leg.active) return false;
            let gps = globalStore.getData(keys.nav.gps.position);
            if (!globalStore.getData(keys.nav.gps.valid)) return false;
            data.leg.from = new navobjects.WayPoint(gps.lon, gps.lat);
            return true;
        });
    }

    routeOff() {
        if (!activeRoute.hasActiveTarget()) return; //is already off
        activeRoute.modify((data) => {
            data.leg.active = false;
            data.leg.name = undefined;
            data.leg.currentRoute = undefined;
            data.leg.to.routeName = undefined;
            data.activeName = undefined;
            data.route = undefined;
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
    async listRoutes(includeServer) {
        let list = this._listRoutesLocal();
        if (!includeServer || !globalStore.getData(keys.gui.capabilities.uploadRoute, false)) {
            return list;
        }
        let canDelete = globalStore.getData(keys.properties.connectedMode, false);
        const data = await Requests.getJson({
            request: 'api',
            type: 'route',
            command: 'list'
        });
        for (let i = 0; i < data.items.length; i++) {
            let ri = new routeobjects.RouteInfo();
            assign(ri, data.items[i]);
            ri.server = true;
            if (ri.canDelete !== false) ri.canDelete = canDelete;
            if (editingRoute.isHandling(ri)) {
                ri.canDelete = false;
                ri.isEditing = true;
            }
            if (this.isActiveRoute(ri)) ri.active = true;
            ri.compute();
            list.push(ri);
        }
        return list;
    };

    /**
     *
     * @param route {routeobjects.Route}
     * @returns {routeobjects.RouteInfo}
     */
    getInfoFromRoute(route) {
        if (!route) return;
        let rtinfo = new routeobjects.RouteInfo(route.name);
        try {
            if (route.points) rtinfo.numpoints = route.points.length;
            rtinfo.length = route.computeLength(0, globalStore.getData(keys.nav.routeHandler.useRhumbLine));
            rtinfo.time = route.time;
            rtinfo.server=route.isServer();
            if (this.isActiveRoute(rtinfo)) rtinfo.active = true;
            if (editingRoute.isHandling(rtinfo)) {
                rtinfo.canDelete = false;
                rtinfo.isEditing = true;
            }
            rtinfo.compute();
        } catch (e) {
        }
        return rtinfo;
    }
    /**
     * list local routes
     * returns a list of RouteInfo
     * @private
     */
    _listRoutesLocal() {
        let rt = [];
        let i = 0;
        let key;
        let routeKeys = LocalStorage.listByPrefix(STORAGE_NAMES.ROUTE);
        for (i = 0; i < routeKeys.length; i++) {
            key = routeKeys[i];
            let routeName = key.substr(STORAGE_NAMES.ROUTE.length);
            if (! routeName) continue;
            const rtinfo = this.getInfoFromRoute(this._loadRoute(routeobjects.LOCAL_PREFIX+routeName));
            if (rtinfo) {
                rt.push(rtinfo);
            }
        }
        return rt;
    };

    async getInfo(routeName) {
        if (! routeName) return;
        let info;
        if (routeobjects.isServerName(routeName)) {
            try {
                info = await Requests.getJson({
                    type: 'route',
                    command: 'info',
                    name: routeName
                })
                info.server=true;
                info.type='route';
                info.checkprefix='';
            } catch (e) {
            }
            return info;
        }
        return this.getInfoFromRoute(this._loadRoute(routeName,true));
    }
    /**
     * delete a route both locally and on server
     * @param name
     */
    async deleteRoute(name) {
        if (! name) throw new Error("no route name for delete");
        if (! routeobjects.isServerName(name)) {
            try {
                LocalStorage.removeItem(STORAGE_NAMES.ROUTE, routeobjects.nameToBaseName(name));
            } catch (e) {
            }
            return true;
        }
        if (!this.connectMode || this.readOnlyServer) throw new Error("cannot delete server route "+name+" - not connected");
        return await Requests.getJson({
                request: 'api',
                type: 'route',
                command: 'delete',
                name: name
            })
    };
    async _downloadRoute(name, opt_returnraw) {
        const xml = await Requests.getHtmlOrText({
            request: 'api',
            type: 'route',
            command: 'download',
            name: name
        });
        if (opt_returnraw) {
            return xml;
        }
        let newRoute = new routeobjects.Route();
        newRoute.fromXml(xml);
        let routeName = name;
        if (newRoute.name !== routeName) {
            let error = "downloaded route has invalid name expected=" + routeName + ", current=" + newRoute.name;
            throw new Error(error);
        }
        return newRoute;
    }
    /**
     *
     * @param name
     * @param local - force local only access even if we are connected
     * @param opt_returnraw
     */
    async fetchRoute(name, opt_returnraw) {
        let route;
        if (!name) throw new Error("no route name for fetch");
        if (!routeobjects.isServerName(name)) {
            route = this._loadRoute(name, true, opt_returnraw);
            if (route) {
                return Promise.resolve(route);
            }
            throw new Error("Route " + name + " not found locally");

        }
        const route_1 = await this._downloadRoute(name, opt_returnraw);
        if (route_1 instanceof routeobjects.Route) {
            route_1.setName(name);
        }
        return route_1;
    };

    async renameRoute(routeItem, newName) {
        if (activeRoute.isHandling(routeItem)) throw new Error("cannot rename active route");
        if (editingRoute.isHandling(routeItem)) throw new Error("cannot rename editing route");
        if (routeobjects.isServerName(routeItem.name)) {
            if (! this.connectMode || this.readOnlyServer) throw new Error("cannot rename server route while disconnected");
            await requests.getJson({
                type:'route',
                command:'rename',
                name: routeItem.name,
                newName: newName
            })
            return true;
        }
        const route=this._loadRoute(routeItem.name,true);
        if (! route) throw new Error(`local route ${routeItem.name} not found`);
        try {
            LocalStorage.removeItem(STORAGE_NAMES.ROUTE, routeobjects.nameToBaseName(routeItem.name));
        } catch (e) {
        }
        route.setName(newName);
        this._saveRouteLocal(route,true);
        return true;
    }

    /*---------------------------------------------------------
     routing (next wp...)
     ----------------------------------------------------------*/
    _inQuadrant(courseStart, course) {
        let ranges = [];
        let min = courseStart - 90;
        if (min < 0) {
            ranges.push([360 + min, 360]);
            min = 0;
        }
        let max = courseStart + 90;
        if (max >= 360) {
            ranges.push([0, max - 360]);
            max = 360;
        }
        ranges.push([min, max]);
        for (let i in ranges) {
            let mm = ranges[i];
            if (mm[0] <= course && mm[1] > course) return true;
        }
        return false;
    };

    /**
     * @private
     * check if we have to switch to the next WP
     */
    _checkNextWp() {
        activeRoute.modify((data) => {
            if (!data.leg) return;
            if (data.leg.server && this.connectMode) return;
            if (!data.leg.isRouting()) return;
            let lastApproach = data.leg.approach;
            if (data.leg.to && data.leg.to.name == navobjects.WayPoint.MOB) {
                return;
            }
            let boat = globalStore.getData(keys.nav.gps.position);
            //TODO: switch of routing?!
            if (!globalStore.getData(keys.nav.gps.valid)) return;
            let useRhumbLine = globalStore.getData(keys.nav.routeHandler.useRhumbLine);
            let nextWpNum = data.leg.getCurrentTargetIdx() + 1;
            let nextWp = data.route ? data.route.getPointAtIndex(nextWpNum) : undefined;
            let approach = data.leg.approachDistance;
            let tolerance = approach / 10; //we allow some position error...
            try {
                let dst = NavCompute.computeDistance(boat, data.leg.to, useRhumbLine);
                //TODO: some handling for approach
                if (dst.dts <= approach) {
                    data.leg.approach = true;
                    if (!data.leg.hasRoute()) {
                        return data.leg.approach !== lastApproach;
                    }
                    let now = (new Date()).getTime();
                    if (!lastApproach) {
                        this.lastApproachStarted = now;
                    }
                    let mode = globalStore.getData(keys.nav.routeHandler.nextWpMode, 'late');
                    let doSwitch = false;
                    if (mode === 'early') {
                        if (!this.lastApproachStarted || !nextWp) {
                            return data.leg.approach !== lastApproach;
                        }
                        let wpTime = globalStore.getData(keys.nav.routeHandler.nextWpTime, 10);
                        if ((this.lastApproachStarted + 1000 * wpTime) <= now) {
                            doSwitch = true;
                        }
                    }
                    if (mode === '90') {
                        let start = new LatLon(data.leg.from.lat, data.leg.from.lon);
                        let cur = new LatLon(boat.lat, boat.lon);
                        let target = new LatLon(data.leg.to.lat, data.leg.to.lon);
                        let courseFrom = useRhumbLine ?
                            target.rhumbBearingTo(start) : target.initialBearingTo(start);
                        let courseCur = useRhumbLine ?
                            target.rhumbBearingTo(cur) : target.initialBearingTo(cur);
                        if (!this._inQuadrant(courseFrom, courseCur)) {
                            //90 reached
                            doSwitch = true
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
                        doSwitch = true;
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
                } else {
                    data.leg.approach = false;
                    this.lastApproachStarted = undefined;
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
     * @param serverData
     * @private
     * @return {Boolean} - true if data has changed
     */
    _handleLegResponse(serverData) {
        if (!serverData) {
            return false;
        }
        const configKeys = ['useRhumbLine', 'nextWpMode', 'nextWpTime'];
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
        nleg.server=true;
        //store locally if we did not send or if the leg changed
        if (this.lastSentLeg && !nleg.differsTo(this.lastReceivedLeg)) {
            return false;
        }
        if (!this.lastSentLeg) {
            //we now allow to send our leg
            this.lastSentLeg = nleg;
        }
        this.lastReceivedLeg = nleg;
        if (this.isEditingActiveRoute() && nleg.currentRoute) {
            //if we are editing the active route we are not sending separate
            //route requests and we use the route from the leg
            //so we have to set this as last received route
            //to avoid the server overwriting us when we stop the active route e.g. by empying it
            this.lastReceivedRoute = nleg.currentRoute.clone();
        }
        activeRoute.modify((data) => {
            if (this.lastReceivedLeg.differsTo(data.leg)) {
                data.leg = this.lastReceivedLeg.clone();
                if (data.leg.name) {
                    //no migration any more for very old routing leg
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
    startQuery() {
        this._checkNextWp();
        let timeout = globalStore.getData(keys.properties.routeQueryTimeout); //in ms!
        if (!this.connectMode) {
            this.lastReceivedLeg = undefined;
            this.lastReceivedRoute = undefined;
            this.lastSentRoute = undefined;
            this.lastSentLeg = undefined;
            this.lastLegSequence = undefined;
            this.timer = window.setTimeout(() => {
                this.startQuery();
            }, timeout);
            return;
        } else {
            let currentLegSequence = globalStore.getData(keys.nav.gps.updateleg);
            if (this.lastLegSequence === undefined || this.lastLegSequence !== currentLegSequence || this.lastReceivedLeg === undefined) {
                this.lastLegSequence = currentLegSequence;
                Requests.getJson({
                    request: 'api',
                    type: 'route',
                    command: 'getleg'
                }, {checkOk: false}).then(
                    (data) => {
                        let change = this._handleLegResponse(data);
                        base.log("leg data change=" + change);
                        this.timer = window.setTimeout(() => {
                            this.startQuery();
                        }, timeout);
                    }
                ).catch(
                    (error) => {
                        base.log("query leg error");
                        this.routeErrors++;
                        if (this.routeErrors > 10) {
                            base.log("lost route");
                        }
                        this.timer = window.setTimeout(() => {
                            this.startQuery();
                        }, timeout);
                    }
                );
            } else {
                this.timer = window.setTimeout(() => {
                    this.startQuery();
                }, timeout);
            }
        }
        //we only query the route separately if it is currently not active
        if (!this.isEditingActiveRoute()) {
            if (!editingRoute.hasRoute()) return;
            if (!editingRoute.getRoute().isServer()) return;
            if (this.currentRoutePage === undefined) return;
            //we always query the server to let him overwrite what we have...
            this._downloadRoute(editingRoute.getRoute().name)
                .then((nRoute) => {
                    if (this.isEditingActiveRoute()) return;
                    let change = nRoute.differsTo(this.lastReceivedRoute);
                    base.log("route data change=" + change);
                    if (change) {
                        this.lastReceivedRoute = nRoute;
                        editingRoute.modify((data) => {
                            //maybe the editing route has changed in between...
                            if (!data.route || data.route.name != nRoute.name) return;
                            if (nRoute.differsTo(data.route)) {
                                let oldPoint = data.route.getPointAtIndex(data.index);
                                data.route = this.lastReceivedRoute.clone();
                                data.index = data.route.findBestMatchingIdx(oldPoint);
                                if (data.index < 0) data.index = 0;
                                return true;
                            }
                        });
                    }
                },
                (error) => {
                    base.log("unable to download route "+editingRoute.getRoute().name+": "+error);
                }
            );
        }
    };


    /**
     * @private
     */
    _saveRouteLocal(route, opt_keepTime) {
        if (!route) return;
        route=route.clone();
        if (!opt_keepTime || !route.time) route.time = new Date().getTime() / 1000;
        route.setName(routeobjects.nameToBaseName(route.name));
        let str = route.toJsonString();
        LocalStorage.setItem(STORAGE_NAMES.ROUTE, route.name, str);
        return route;
    };

    /**
     *
     * @param route
     * @returns {boolean}
     * @private
     */
    _localRouteExists(route) {
        if (!route) return false;
        let name=route.name;
        if (! name) return false;
        if (routeobjects.isServerName()) return false;
        let existing = LocalStorage.getItem(STORAGE_NAMES.ROUTE, routeobjects.nameToBaseName(name));
        return !!existing;
    };

    /**
     * load a locally stored route
     * @private
     * @param name
     * @param opt_returnUndef - if set, return undef instead of an empty route if not found
     * @param opt_returnraw return the raw string
     * @returns {routeobjects.Route}
     */
    _loadRoute(name, opt_returnUndef, opt_returnraw) {
        if (! name || routeobjects.isServerName(name)) throw new Error("cannot locally load server route "+name);
        let rt = new routeobjects.Route(name);
        const loadName=routeobjects.nameToBaseName(name);
        try {
            let raw = LocalStorage.getItem(STORAGE_NAMES.ROUTE, loadName);
            if (!raw && name == this.DEFAULTROUTE) {
                //fallback to load the old default route
                raw = LocalStorage.getItem(this.FALLBACKROUTENAME);
            }
            if (raw) {
                base.log("route " + name + " successfully loaded");
                rt.fromJsonString(raw);
                rt.setName(name);
                if (opt_returnraw) {
                    return rt.toXml();
                }
                return rt;
            }
            if (opt_returnUndef) {
                return undefined;
            }
        } catch (ex) {
            if (opt_returnUndef) return undefined;
        }
        return rt;
    };


    /**
     * send the route
     * @private
     * @param {routeobjects.Route} route
     * @param {function} opt_callback -. will be called on result, param: true on success
     * @param opt_overwrite
     */
    _sendRoute(route, opt_callback, opt_overwrite) {
        //send route to server
        Requests.postPlain({
            request: 'api',
            command: 'upload',
            type: 'route',
            name: route.name,
            overwrite: opt_overwrite
        }, route.toXml())
            .then((res) => {
                base.log("route sent to server");
                if (opt_callback) opt_callback();
            })
            .catch((error) => {
                let showError = true;
                if (opt_callback) showError = opt_callback(error);
                if (showError && globalStore.getData(keys.properties.routingServerError)) Toast("unable to send route to server:" + error);
            })
    };


    /**
     * leg has changed - save it and reset approach data
     * @returns {boolean}
     * @private
     */
    _legChangedLocally(leg) {
        if (leg.server) return;
        //reset approach handling
        this.lastDistanceToCurrent = -1;
        this.lastDistanceToNext = -1;
        let raw = leg.toJsonString();
        LocalStorage.setItem(STORAGE_NAMES.ROUTING, undefined, raw);
        if (leg.currentRoute) {
            this._saveRouteLocal(leg.currentRoute, true);
        }
    }

    _sendleg(leg){
        if (! leg || ! leg.server) return;
        //do not allow to send until we received something
        //this will sync us to the server when we connect (or connect again...)
        if (!this.lastReceivedLeg) return;
        if (!leg.differsTo(this.lastSentLeg)) return;
        let legJson = leg.toJson();
        if (this.connectMode) {
            if (!globalStore.getData(keys.gui.capabilities.uploadRoute)) {
                base.log("upload leg disabled by capabilities");
                return;
            }
            if (leg.hasRoute()) {
                if (! leg.currentRoute.isServer()){
                    throw new Error("trying to send a leg with a local route");
                }
                this._sendRoute(leg.currentRoute, undefined, true);
            }
            this.lastSentLeg = leg.clone();
            Requests.postJson({
                request: 'api',
                type: 'route',
                command: 'setleg'
            }, legJson).then(
                (data) => {
                    base.log("new leg sent to server");
                }
            ).catch(
                (error) => {
                    this.lastSentLeg = undefined;
                    if (globalStore.getData(keys.properties.routingServerError)) Toast("unable to send leg to server:" + error);
                }
            );
        }
        return true;
    };

    setCurrentRoutePage(page) {
        this.currentRoutePage = page;
    };

    unsetCurrentRoutePage(page) {
        if (this.currentRoutePage !== page) return;
        this.currentRoutePage = undefined;
    };

}

export default RouteData;

