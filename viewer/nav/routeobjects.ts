/**
 * Created by andreas on 28.04.16.
 */

import {PlainPoint, Point, WayPoint} from './navobjects' ;
// @ts-ignore
import NavCompute from './navcompute' ;
import Formatter from '../util/formatter' ;
import helper from '../util/helper';
import base from '../base';
// @ts-ignore
import XmlWriter from "xml-writer";



export const RoutingMode={
    WP: 0,         //route to current standalone WP
    ROUTE:  1,      //route to the currently selected Point of the route
    WPINACTIVE: 2  //set the target waypoint but do not activate routing
};

export const LOCAL_PREFIX="local@";
export const SERVER_PREFIX:string="";


export const nameToBaseName=(name:string)=>{
    if (!name) return;
    if (LOCAL_PREFIX && helper.startsWith(name,LOCAL_PREFIX)) return name.substring(LOCAL_PREFIX.length);
    if (SERVER_PREFIX && helper.startsWith(name,SERVER_PREFIX)) return name.substring(SERVER_PREFIX.length);
    return name;
}


export const isServerName=(name:string)=>{
    if (!name) return false;
    return (!name.startsWith(LOCAL_PREFIX) && name.startsWith(SERVER_PREFIX));
}

const compareWp=(wp1?:WayPoint,wp2?:WayPoint)=>{
    if (!wp1) {
        if (wp2) return false;
        return true;
    }
    return wp1.compare(wp2);
}

export class Leg {
    from:WayPoint;
    to:WayPoint;
    active:boolean;
    approach:boolean=false;
    approachDistance:number=0;
    currentRoute:Route;
    anchorDistance:number=0;
    server:boolean=false;
    constructor(from?:Point|WayPoint, to?:Point|WayPoint, active?:boolean) {
        /**
         * start of leg
         * @type {WayPoint}
         */
        this.from = WayPoint.fromPlain(from)
        /**
         * current target waypoint
         * @type {WayPoint}
         */
        this.to = WayPoint.fromPlain(to);
        /**
         * is the leg active?
         * @type {boolean}
         */
        this.active = active || false;
        /**
         * whether we are currently approaching
         * @type {boolean}
         */
        this.approach = false;
        /**
         * the approach distance (in m)
         * @type {number}
         */
        this.approachDistance = 0; //to be set from properties

        /**
         * the current route
         * @type {Route}
         */
        this.currentRoute = undefined;

        /**
         * if this is set - ignore any to, route, approach
         * and handle anchor watch
         * @type {undefined}
         */
        this.anchorDistance = undefined;
        /**
         * is this a leg from the server
         * @type {boolean}
         */
        this.server = false;


    }

    clone() {
        const rt = new Leg(this.from ? this.from.clone() : undefined, this.to ? this.to.clone() : undefined, this.active);
        rt.approach = this.approach;
        rt.approachDistance = this.approachDistance;
        rt.currentRoute = this.currentRoute ? this.currentRoute.clone() : undefined;
        rt.anchorDistance = this.anchorDistance;
        rt.server = this.server;
        return rt;
    }

    /**
     * convert the leg into a json string
     * @returns {string}
     */
    toJsonString() {
        return JSON.stringify(this.toJson());
    }

    toJson() {
        const rt:Record<string,any> = {
            from: this.from,
            to: this.to,
            name: this.getRouteName(),
            active: this.active,
            currentTarget: this.getCurrentTargetIdx(),
            approach: this.approach,
            approachDistance: this.approachDistance,
            currentRoute: this.currentRoute ? this.currentRoute.toJson() : undefined
        };
        if (this.anchorDistance) {
            rt.anchorDistance = this.anchorDistance;
        }
        return rt;
    }

    /**
     * fill a leg object from a json string
     * @param jsonString
     * @returns {Leg}
     */
    fromJsonString(jsonString:string):Leg {
        const raw = JSON.parse(jsonString);
        return this.fromJson(raw);
    }

    /**
     * fill the leg from json
     * @param raw
     * @returns {Leg}
     */
    fromJson(raw:Record<string, any>):Leg {
        this.from = WayPoint.fromPlain(raw.from);
        if (raw.to) this.to = WayPoint.fromPlain(raw.to);
        this.active = raw.active || false;
        this.approach = raw.approach;
        this.approachDistance = raw.approachDistance;
        if (raw.currentRoute) {
            this.currentRoute = new Route(raw.currentRoute.name);
            this.currentRoute.fromJson(raw.currentRoute);
        }
        if (this.currentRoute) {
            this.to.routeName = this.currentRoute.name;
            if (raw.currentTarget !== undefined) {
                const rp = this.currentRoute.getPointAtIndex(raw.currentTarget);
                if (rp) {
                    this.to = rp;
                } else {
                    //this is some error - set the to to be outside of the route...
                    base.log("invalid leg with currentTarget, to outside route, deleting route");
                    this.currentRoute = undefined;
                    this.to.routeName = undefined;
                }
            } else {
                const idx = this.currentRoute.getIndexFromPoint(this.to);
                if (idx < 0) {
                    base.log("invalid leg, to outside route, deleting route");
                    this.currentRoute = undefined;
                    this.to.routeName = undefined;
                }
            }
        } else {
            this.to.routeName = undefined;
        }
        if (raw.anchorDistance) {
            this.anchorDistance = raw.anchorDistance;
            this.active = false;
        }
        return this;
    }

    /**
     * check if the leg differs from another leg
     * we do not consider the approach distance
     * @param {Leg} leg2
     * @returns {boolean} true if differs
     */
    differsTo(leg2:Leg) {
        if (!leg2) return true;
        if (leg2.anchorDistance && !this.anchorDistance) return true;
        if (!leg2.anchorDistance && this.anchorDistance) return true;
        if (leg2.server !== this.server) return true;
        if (this.anchorDistance && leg2.anchorDistance && this.anchorDistance != leg2.anchorDistance) return true;
        let changed = false;
        if (!compareWp(this.from,leg2.from)) changed = true;
        if (! changed &&  !compareWp(this.to,leg2.to)) changed = true;
        if (this.active != leg2.active) changed = true;
        if (this.approach != leg2.approach) changed = true;
        if ((this.currentRoute && !leg2.currentRoute) || (!this.currentRoute && leg2.currentRoute)) changed = true;
        if (this.currentRoute && leg2.currentRoute && !changed) changed = this.currentRoute.differsTo(leg2.currentRoute);
        return changed;
    }

    /**
     * get the index of the current to in the route, -1 if not there
     * @returns {*}
     */
    getCurrentTargetIdx() {
        if (this.to && this.currentRoute) {
            return this.currentRoute.getIndexFromPoint(this.to);
        }
        return -1;
    }

    isRouting() {
        return this.active && !this.anchorDistance;
    }
    getRoute(){
        if (! this.isRouting()) return;
        return this.currentRoute;
    }
    hasRoute() {
        if (!this.isRouting()) return false;
        return this.currentRoute !== undefined;
    }

    isCurrentTarget(wp:Point|WayPoint) {
        if (!this.isRouting()) return false;
        if (this.to.compare(wp)) return true;
    }

    setNewTargetIndex(index:number, opt_from?:WayPoint) {
        if (index === undefined || index < 0) return false;
        if (!this.hasRoute()) return false;
        const newTarget = this.currentRoute.getPointAtIndex(index);
        if (!newTarget) return false;
        this.to = newTarget;
        if (opt_from) this.from = opt_from;
        return true;
    }

    getRouteName() {
        if (!this.hasRoute()) return;
        return this.currentRoute.name;
    }


    setAnchorWatch(start:Point|WayPoint, distance:number) {
        this.from = WayPoint.fromPlain(start);
        this.to = undefined;
        this.active = false;
        this.approach = false;
        this.currentRoute = undefined;
        this.anchorDistance = distance;
    }

    anchorWatch() {
        return this.anchorDistance;
    }

    isApproaching() {
        return this.active && this.approach;
    }
}





/**
 *
 * @param {string} name
 * @param {Array.<WayPoint>} opt_points
 * @constructor
 */
export class Route {
    name:string;
    points: WayPoint[];
    time:number;
    static TYPE={
        route:1,
        measure:2,
        points:3
    }
    constructor(name?:string, opt_points?:WayPoint[]) {

        /**
         * the route name
         * @type {string}
         */
        this.name = name;
        if (!this.name) this.name = "default";

        /**
         * the route points
         * @type {WayPoint[]}
         */
        this.points = opt_points || [];
        /**
         * the timestamp of last modification in seconds
         * @type {number}
         */
        this.time = new Date().getTime()/1000;

    }

    getType(){
        return Route.TYPE.route;
    }

    /**
     * fill a route from a Json string
     * @param jsonString
     * @returns {*}
     */
    fromJsonString(jsonString:string) {
        const parsed = JSON.parse(jsonString);
        return this.fromJson(parsed);
    }

    /**
     * fill the route from json
     * @param parsed
     */
    fromJson(parsed:Record<string,any>) {
        this.name = parsed.name || "default";
        this.time = parsed.time || 0;
        this.points = [];
        let i;
        let wp;
        if (parsed.points) {
            for (i = 0; i < parsed.points.length; i++) {
                wp = WayPoint.fromPlain(parsed.points[i]);
                if (!wp.name) {
                    wp.name = this.findFreeName();
                }
                if (wp.name == WayPoint.MOB) {
                    wp.name = this.findFreeName();
                }
                wp.routeName = this.name.slice(0);
                this.points.push(wp);
            }
        }
        return this;
    }

    toJson() {
        const rt:Record<string, any> = {};
        rt.name = this.name;
        rt.time = this.time;
        rt.points = [];
        let i;
        for (i = 0; i < this.points.length; i++) {
            const rp = this.points[i].clone();
            rp.routeName = undefined;
            rt.points.push(rp);
        }
        return rt;
    }

    toJsonString() {
        return JSON.stringify(this.toJson());
    }

    /**
     * check if a route differs to another route (does not consider the server flag)
     * @param {Route} route2
     * @param opt_ignoreName
     * @returns {boolean} true if differs
     */
    differsTo(route2:Route,opt_ignoreName?:boolean) {
        if (!route2) return true;
        if (! opt_ignoreName && this.name != route2.name) return true;
        if (this.points.length != route2.points.length) return true;
        let i;
        for (i = 0; i < this.points.length; i++) {
            if (this.points[i].lon != route2.points[i].lon) return true;
            if (this.points[i].lat != route2.points[i].lat) return true;
            if (this.points[i].name != route2.points[i].name) return true;
        }
        return false;
    }

    /**
     * deep copy
     * @returns {Route}
     */
    clone() {
        const str = this.toJsonString();
        const rt = new Route();
        rt.fromJsonString(str);
        return rt;
    }

    /**
     * fill a route from an xml doc
     * @param xml
     */
    fromXml(xml:string) {
        this.name = undefined;
        const doc = helper.parseXml(xml);
        const routes = doc.getElementsByTagName('rte');
        if (routes.length > 0) {
            return this.fromXmlNode(routes[0]);
        }
    }

    fromXmlNode(rte:Element) {
        this.name = undefined;
        this.points = [];
        if (rte) {
            const children=rte.children;
            for (let i=0;i<children.length;i++){
                if (children[i].tagName === 'name'){
                    this.name = children[i].textContent;
                }
            }
            Array.from(rte.getElementsByTagName('rtept')).forEach((el) => {
                const pt = new WayPoint(0, 0);
                pt.lon = parseFloat(el.getAttribute('lon'));
                pt.lat = parseFloat(el.getAttribute('lat'));
                const pname = el.getElementsByTagName('name')[0];
                if (pname) pt.name = pname.textContent;
                pt.routeName = this.name?this.name.slice(0):undefined;
                if (!pt.name) {
                    pt.name = this.findFreeName();
                }
                this.points.push(pt);
            })
        }
        return this;
    }

    parseRouteXml = (xmltext:string) => {
        const doc = helper.parseXml(xmltext);
        const routes = doc.getElementsByTagName('rte');
        const rt = [];
        for (let i = 0; i < routes.length; i++) {
            const route = new Route();
            route.fromXmlNode(routes[i]);
            rt.push(route);
        }
        return rt;
    }

    toXml() {
        const writer = new XmlWriter(true);
        writer.startDocument('1.0', 'UTF-8');
        const rte = writer.startElement('gpx').startElement('rte');
        rte.startElement('name').text(this.name).endElement();
        for (let i = 0; i < this.points.length; i++) {
            const point = rte.startElement('rtept');
            point.writeAttribute('lon', this.points[i].lon);
            point.writeAttribute('lat', this.points[i].lat);
            point.startElement('name').text(this.points[i].name).endElement();
            point.endElement();
        }
        return writer.toString();
    }

    /**
     * delete a point from the route
     * return the next point if there is still one behind
     * @param idx - the index starting at 0
     * @returns {*}
     */
    deletePoint(idx:number) {
        if (idx < 0 || idx >= this.points.length) return undefined;
        this.points.splice(idx, 1);
        if (idx < this.points.length) return this.points[idx];
        return undefined;
    }

    /**
     * get the point at index
     * @param idx
     * @returns {*}
     */
    getPointAtIndex(idx:number) {
        if (idx < 0 || idx >= this.points.length) return undefined;
        return this.points[idx];
    }

    /**
     * get the index of a wp in the route
     * @param {WayPoint} point
     * @param opt_nameOnly {boolean} if set - compare names instead of coords
     * @returns {number} - -1 if not found
     */
    getIndexFromPoint(point:WayPoint, opt_nameOnly?:boolean) {
        if (!point || point.name === undefined) return -1;
        if (point.routeName === undefined || point.routeName != this.name) return -1;
        let i;
        for (i = 0; i < this.points.length; i++) {
            if (opt_nameOnly) {
                if (this.points[i].name == point.name) return i;
            } else {
                if (this.points[i].compare(point)) return i;
            }
        }
        return -1;
    }

    /**
     * return a point at a given offset to the current point
     * @param {WayPoint} point
     * @param {number} offset
     * @returns {WayPoint}
     */

    getPointAtOffset(point:WayPoint, offset:number) {
        const idx = this.getIndexFromPoint(point);
        if (idx < 0) return undefined;
        if ((idx + offset) < 0 || (idx + offset) >= this.points.length) return undefined;
        return this.points[idx + offset];
    }

    /**
     * change a waypoint in the route
     * @param {WayPoint} oldPoint
     * @param {WayPoint}newPoint
     * @returns {WayPoint|undefined} the new point or undefined if no change (e.g. name already exists or point not in route)
     */
    changePoint(oldPoint:WayPoint, newPoint:WayPoint) {
        const idx = this.getIndexFromPoint(oldPoint);
        return this.changePointAtIndex(idx, newPoint);
    }

    /**
     * change a waypoint in the route
     * @param {number} idx
     * @param {WayPoint}newPoint
     * @returns {WayPoint|undefined} the new point or undefined if no change (e.g. name already exists or point not in route)
     */
    changePointAtIndex(idx:number, newPoint:WayPoint) {
        if (idx < 0 || idx >= this.points.length) return undefined;
        newPoint = this._toWayPoint(newPoint);
        const oldPoint = this.points[idx].clone();
        if (newPoint.name && newPoint.name != oldPoint.name) {
            if (this.checkName(newPoint.name)) return undefined;
        }
        if (newPoint.routeName && newPoint.routeName != this.name) return undefined;
        this.points[idx].update(newPoint);
        return this.points[idx];
    }

    /**
     *
     * @param idx
     * @param {WayPoint} newWp
     * @returns {boolean}
     */
    checkChangePossible(idx:number, newWp:WayPoint) {
        if (idx < 0 || idx > this.points.length) return false;
        const current = this.points[idx];
        if (current.name == newWp.name) return true;
        let i = 0;
        for (i = 0; i < this.points.length; i++) {
            if (i == idx) continue;
            if (this.points[i].name == newWp.name) return false;
        }
        return true;
    }

    /**
     * check if a given name already exists in the route
     * @param name
     */
    checkName(name:string) {
        let i = 0;
        for (i = 0; i < this.points.length; i++) {
            if (this.points[i].name == name) return true;
        }
        return false;
    }

    _createNameFromId(id:number) {
        return "WP" + Formatter.formatDecimal(id, 2, 0);
    }

    renumber(offset:number) {
        for (let i = 0; i < this.points.length; i++) {
            this.points[i].name = this._createNameFromId(i + offset);
        }
    }

    findFreeName() {
        let i = this.points.length;
        let j = 0;
        for (j = 0; j < this.points.length; j++) {
            try {
                if (this.points[j].name) {
                    const nameVal = this.points[j].name.replace(/^[^0-9]*/, "").replace(/ .*/, "");
                    const nameNum = parseInt(nameVal);
                    if (nameNum > i) i = nameNum;
                }
            } catch (e) {
            }
        }
        i++;
        for (j = 0; j < this.points.length + 1; j++) {
            const name = this._createNameFromId(i);
            if (!this.checkName(name)) return name;
            i++;
        }
        base.log("no free name found for wp");
        return "no free name found";
    }

    addPoint(idx:number, ipoint:Point, opt_before?:boolean) {
        const point = this._toWayPoint(ipoint);
        const rp = point.clone();
        if (rp.name) {
            if (this.checkName(rp.name)) {
                base.log("name " + rp.name + " already exists in route, create a new one");
                rp.name = undefined;
            }
        }
        if (!rp.name) {
            rp.name = this.findFreeName();
        }
        rp.routeName = this.name.slice(0);
        let rt = opt_before ? idx : idx + 1;
        if (rt < 0 || rt >= this.points.length) {
            this.points.push(rp);
            rt = this.points.length - 1;
        } else {
            this.points.splice(rt, 0, rp);
        }
        return rt;
    }

    setName(name:string) {
        this.name = name;
        this.points.forEach(function (p) {
            p.routeName = name.slice(0)
        })
    }
    isSameRoute(other?:Route){
        if (! other) return false;
        return other.name === this.name;
    }
    displayName(){
        return nameToBaseName(this.name);
    }
    isServer(){
        return isServerName(this.name);
    }

    /**
     * invert the route
     */
    swap() {
        for (let i = 0; i < this.points.length / 2; i++) {
            const swap = this.points.length - i - 1;
            const old = this.points[i];
            this.points[i] = this.points[swap];
            this.points[swap] = old;
        }
        return this;
    }
    /**
     *
     * @param {Point} newPoint
     * @returns {WayPoint}
     * @private
     */
    _toWayPoint(newPoint:WayPoint|{lat:number,lon:number}):WayPoint {
        if (newPoint instanceof WayPoint) return newPoint;
        return  WayPoint.fromPlain(newPoint);
    }
    /**
     * get a list of waypoint info
     * extended by distance, index and course
     * @returns {routeobjects.RoutePoint[]}
     */
    getRoutePoints(opt_selectedIdx?:number,opt_useRhumbLine?:boolean){
        const rt=[];
        let i=0;
        for (i=0;i<this.points.length;i++){
            const formatted=new RoutePoint(this.points[i]);
            formatted.idx=i;
            formatted.name=this.points[i].name?this.points[i].name:i+"";
            formatted.routeName=this.name;
            if (i>0) {
                const dst=NavCompute.computeDistance(this.points[i-1],this.points[i],opt_useRhumbLine);
                formatted.course=dst.course;
                formatted.distance=dst.dts;
            }
            if (i == opt_selectedIdx){
                formatted.selected=true;
            }
            rt.push(formatted);
        }
        return rt;
    }
    /**
     * compute the length
     * @param {number} startIdx - the point to start from
     * @param opt_useRhumbLine - if true - use rhum line computations
     * @returns {number}
     */
    computeLength(startIdx:number,opt_useRhumbLine?:boolean,opt_endIdx?:number):number {
        let rt=0;
        if (startIdx < 0) startIdx=0;
        if (this.points.length < (startIdx+2)) return rt;
        let end=this.points.length-1;
        if (opt_endIdx && opt_endIdx >0 && opt_endIdx < this.points.length) {
            end=opt_endIdx;
        }
        let last=this.points[startIdx];
        startIdx++;
        for (;startIdx<=end;startIdx++){
            const next=this.points[startIdx];
            const dst=NavCompute.computeDistance(last,next,opt_useRhumbLine);
            rt+=dst.dts;
            last=next;
        }
        return rt;
    }
    /**
     * find the point that is closest to the provided point
     *
     * @param {Point} point
     * @returns {number} -1 if there are no points in the route
     */
    findBestMatchingIdx(point:Point){
        let idx;
        let mindistance=undefined;
        let bestPoint=-1;
        if (! point) return bestPoint;
        let dst;
        for (idx=0;idx<this.points.length;idx++){
            dst=NavCompute.computeDistance(point,this.points[idx]);
            if (bestPoint == -1 || dst.dts<mindistance){
                bestPoint=idx;
                mindistance=dst.dts;
            }
        }
        return bestPoint;
    }
}
export class Measure extends Route{
    constructor(name:string,opt_points?:WayPoint[]) {
        super(name,opt_points);
    }

    getType() {
        return Route.TYPE.measure;
    }
}
export interface IRouteInfo{
    type:string;
    name:string;
    server:boolean;
    length:number;
    numpoints:number;
    time:number;
    active:boolean;
    extension:string;
    displayName:string;
    downloadName:string;
    canDownload:boolean;
    canDelete:boolean;
    isEditing:boolean;
    checkPrefix:string;
}
export interface IRouteInfoWithStatus extends IRouteInfo{
    status?:string,
    serverName?:string
}
export class RouteInfo implements IRouteInfo {
    type:string;
    name:string;
    server:boolean;
    length:number;
    numpoints:number;
    time:number;
    active:boolean;
    extension:string;
    displayName:string;
    downloadName:string;
    canDownload:boolean;
    canDelete:boolean;
    isEditing:boolean;
    checkPrefix:string;
    constructor(name?:string, opt_server?:boolean) {
        this.type = "route";
        /**
         * the name of the route
         * @type {string}
         */
        this.name = name;
        /**
         * is this a route from the server
         * @type {boolean}
         */
        this.server = opt_server || false;
        /**
         * the length in nm
         * @type {number}
         */
        this.length = 0;
        /**
         * the number of waypoints
         * @type {number}
         */
        this.numpoints = 0;
        /**
         * UTC timestamp in seconds
         * @type {number}
         */
        this.time = 0;
        /**
         * active route (at the time of info creation...)
         * @type {boolean}
         */
        this.active = false;
        this.extension='.gpx'
        this.displayName=undefined;
        this.downloadName=undefined;
        this.canDownload=true;
        this.canDelete=true;
        this.isEditing=false;
        this.checkPrefix='';
    }
    compute(){
        if (! this.displayName) this.displayName=nameToBaseName(this.name);
        if (! this.downloadName) this.downloadName=nameToBaseName(this.name)+this.extension;
        this.checkPrefix=isServerName(this.name)?SERVER_PREFIX:LOCAL_PREFIX;
    }
    assign(raw:Record<string,any>){
        if ('name' in raw){this.name=raw.name;}
        if ('server' in raw){this.server=raw.server;}
        if ('length' in raw){this.length=raw.length;}
        if ('numpoints' in raw){this.numpoints=raw.numpoints;}
        if ('active' in raw){this.active=raw.active;}
        if ('displayName' in raw){this.displayName=raw.displayName;}
        if ('downloadName' in raw){this.downloadName=raw.downloadName;}
        if ('time' in raw){this.time=raw.time;}
        if ('canDownload' in raw){this.canDownload=raw.canDownload;}
        if ('canDelete' in raw){this.canDelete=raw.canDelete;}
        if ('checkPrefix' in raw){this.checkPrefix=raw.checkPrefix;}
    }
}

export class RoutePoint extends WayPoint {
    idx:number;
    course:number;
    distance:number;
    selected:boolean
    constructor(waypoint?:PlainPoint) {
        super();
        this.update(waypoint);
        this.idx = waypoint.idx || 0;
        this.course = waypoint.course;
        this.distance = waypoint.distance;
        this.selected = false;
    }
}

export default {
    RoutingMode: RoutingMode,
    LOCAL_PREFIX:LOCAL_PREFIX,
    SERVER_PREFIX:SERVER_PREFIX,
    nameToBaseName:nameToBaseName,
    isServerName:isServerName,
    Leg:Leg,
    RoutePoint:RoutePoint,
    Route:Route,
    RouteInfo:RouteInfo,
    isSameRoute:(route?: { name:string },other?: { name:string })=>{
        if (!!route !== !!other) return false;
        if (!route) return false;
        return (route.name === other.name);
    }
}
