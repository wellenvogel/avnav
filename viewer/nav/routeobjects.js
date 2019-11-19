/**
 * Created by andreas on 28.04.16.
 */

var navobjects=require('./navobjects');
var NavCompute=require('./navcompute');
var Formatter=require('../util/formatter');
var assign=require('object-assign');
var routeobjects={};


routeobjects.RoutingMode={
    WP: 0,         //route to current standalone WP
    ROUTE:  1,      //route to the currently selected Point of the route
    WPINACTIVE: 2  //set the target waypoint but do not activate routing
};

routeobjects.Leg=function(from, to, active, opt_routeName){
    /**
     * start of leg
     * @type {navobjects.WayPoint}
     */
    this.from=from|| new navobjects.WayPoint();
    if (! (this.from instanceof navobjects.WayPoint))
        this.from=navobjects.WayPoint.fromPlain(this.from);
    /**
     * current target waypoint
     * @type {navobjects.WayPoint}
     */
    this.to=to||new navobjects.WayPoint();
    if (! (this.to instanceof navobjects.WayPoint))
        this.to=navobjects.WayPoint.fromPlain(this.to);
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
     * @type {routeobjects.Route}
     */
    this.currentRoute=undefined;

    /**
     * if this is set - ignore any to, route, approach
     * and handle anchor watch
     * @type {undefined}
     */
    this.anchorDistance=undefined;


};

routeobjects.Leg.prototype.clone=function(){
    var rt=new routeobjects.Leg(this.from.clone(),this.to.clone(),this.active,
        this.name?this.name.slice(0):undefined);
    rt.approach=false;
    rt.approachDistance=this.approachDistance;
    rt.currentRoute=this.currentRoute?this.currentRoute.clone():undefined;
    rt.anchorDistance=this.anchorDistance;
    return rt;
};
/**
 * convert the leg into a json string
 * @returns {string}
 */
routeobjects.Leg.prototype.toJsonString=function(){
    var rt={
        from: this.from,
        to: this.to,
        name: this.name,
        active: this.active,
        currentTarget: this.getCurrentTargetIdx(),
        approach: this.approach,
        approachDistance: this.approachDistance+0,
        currentRoute: this.currentRoute?this.currentRoute.toJson():undefined
    };
    if (this.anchorDistance){
        rt.anchorDistance=this.anchorDistance;
    }
    return JSON.stringify(rt);
};

/**
 * fill a leg object from a json string
 * @param jsonString
 * @returns {routeobjects.Leg}
 */
routeobjects.Leg.prototype.fromJsonString=function(jsonString) {
    var raw = JSON.parse(jsonString);
    return this.fromJson(raw);
};
/**
 * fill the leg from json
 * @param raw
 * @returns {routeobjects.Leg}
 */
routeobjects.Leg.prototype.fromJson=function(raw){
    this.from=navobjects.WayPoint.fromPlain(raw.from);
    if (raw.to) this.to=navobjects.WayPoint.fromPlain(raw.to);
    this.active=raw.active||false;
    this.name=raw.name;
    this.approach=raw.approach;
    this.approachDistance=raw.approachDistance;
    if (raw.currentRoute){
        this.currentRoute=new routeobjects.Route(raw.currentRoute.name);
        this.currentRoute.fromJson(raw.currentRoute);
        this.name=this.currentRoute.name;
    }
    if (this.currentRoute){
        this.to.routeName=this.currentRoute.name;
        if (raw.currentTarget !== undefined ){
            var rp=this.currentRoute.getPointAtIndex(raw.currentTarget);
            if (rp){
                this.to=rp;
            }
            else{
                //this is some error - set the to to be outside of the route...
                avnav.log("invalid leg with currentTarget, to outside route, deleting route");
                this.currentRoute=undefined;
                this.name=undefined;
                this.to.routeName=undefined;
            }
        }
        else{
            var idx=this.currentRoute.getIndexFromPoint(this.to);
            if (idx < 0){
                avnav.log("invalid leg, to outside route, deleting route");
                this.currentRoute=undefined;
                this.name=undefined;
                this.to.routeName=undefined;
            }
        }
    }
    else{
        this.to.routeName=undefined;
    }
    if (raw.anchorDistance) {
        this.anchorDistance=raw.anchorDistance;
        this.active=false;
    }
    return this;
};

/**
 * check if the leg differs from another leg
 * we do not consider the approach distance
 * @param {routeobjects.Leg} leg2
 * @returns {boolean} true if differs
 */
routeobjects.Leg.prototype.differsTo=function(leg2){
    if (! leg2) return true;
    if (leg2.anchorDistance && ! this.anchorDistance) return true;
    if (!leg2.anchorDistance && this.anchorDistance) return true;
    if (this.anchorDistance && leg2.anchorDistance && this.anchorDistance != leg2.anchorDistance) return true;
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
    if (leg1.active != leg2.active) changed=true;
    if (leg1.approach != leg2.approach) changed=true;
    if ((leg1.currentRoute && ! leg2.currentRoute) || (! leg1.currentRoute && leg2.currentRoute)) changed=true;
    if (leg1.currentRoute && leg2.currentRoute && ! changed) changed=leg1.currentRoute.differsTo(leg2.currentRoute);
    return changed;
};
/**
 * get the index of the current to in the route, -1 if not there
 * @returns {*}
 */
routeobjects.Leg.prototype.getCurrentTargetIdx=function(){
    if (this.to && this.currentRoute ){
        return this.currentRoute.getIndexFromPoint(this.to);
    }
    return -1;
};
routeobjects.Leg.prototype.setAnchorWatch=function(start,distance){
    this.from=start;
    this.to=undefined;
    this.active=false;
    this.approach=false;
    this.name=undefined;
    this.currentRoute=undefined;
    this.anchorDistance=distance;
};

routeobjects.Leg.prototype.isRouting=function(){
    return this.active && ! this.anchorWatchDistance;
};

routeobjects.Leg.prototype.hasRoute=function(){
    if (!this.isRouting()) return false;
    return this.currentRoute !== undefined;
};

routeobjects.Leg.prototype.isCurrentTarget=function(wp){
    if (! this.isRouting()) return false;
    if (this.to.compare(wp)) return true;
};


/**
 *
 * @param {string} name
 * @param {Array.<navobjects.WayPoint>} opt_points
 * @constructor
 */
routeobjects.Route=function(name, opt_points){

    /**
     * the route name
     * @type {string}
     */
    this.name=name;
    if (! this.name)this.name="default";

    /**
     * the route points
     * @type {navobjects.WayPoint[]}
     */
    this.points=opt_points||[];
    /**
     * the timestamp of last modification
     * @type {number}
     */
    this.time=new Date().getTime();
    /**
     * if set this is a server route
     * @type {boolean}
     */
    this.server=false;
};

/**
 * fill a route from a Json string
 * @param jsonString
 * @returns {*}
 */
routeobjects.Route.prototype.fromJsonString=function(jsonString) {
    var parsed = JSON.parse(jsonString);
    return this.fromJson(parsed);
};
/**
 * fill the route from json
 * @param parsed
 */
routeobjects.Route.prototype.fromJson=function(parsed) {
    this.name=parsed.name||"default";
    this.time=parsed.time||0;
    this.server=parsed.server||false;
    this.points=[];
    var i;
    var wp;
    if (parsed.points){
        for (i=0;i<parsed.points.length;i++){
            wp=navobjects.WayPoint.fromPlain(parsed.points[i]);
            if (! wp.name){
                wp.name=this.findFreeName();
            }
            wp.routeName=this.name.slice(0);
            this.points.push(wp);
        }
    }
    return this;
};
routeobjects.Route.prototype.toJson=function(){
    var rt={};
    rt.name=this.name;
    rt.time=this.time;
    rt.server=this.server;
    rt.points=[];
    var i;
    for (i=0;i<this.points.length;i++){
        var rp=this.points[i].clone();
        rp.routeName=undefined;
        rt.points.push(rp);
    }
    return rt;
};

routeobjects.Route.prototype.toJsonString=function(){
    return JSON.stringify(this.toJson());
};
/**
 * check if a route differs to another route (does not consider the server flag)
 * @param {routeobjects.Route} route2
 * @returns {boolean} true if differs
 */
routeobjects.Route.prototype.differsTo=function(route2){
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
 * @returns {routeobjects.Route}
 */
routeobjects.Route.prototype.clone=function(){
    var str=this.toJsonString();
    var rt=new routeobjects.Route();
    rt.fromJsonString(str);
    rt.server=this.server;
    return rt;
};
/**
 * fill a route from an xml doc
 * @param xml
 */
routeobjects.Route.prototype.fromXml=function(xml){
    this.name=undefined;
    var doc= $.parseXML(xml);
    var self=this;
    var i=0;
    $(doc).find('rte:first').each(function(id,el){
        self.name=$(el).find('>name').text();
        $(el).find('rtept').each(function(pid,pel){
            var pt=new navobjects.WayPoint(0,0);
            pt.lon=parseFloat($(pel).attr('lon'));
            pt.lat=parseFloat($(pel).attr('lat'));
            pt.name=$(pel).find('>name').text();
            pt.routeName=self.name.slice(0);
            if (! pt.name){
                pt.name=self.findFreeName();
            }
            i++;
            self.points.push(pt);
        })
    });
    return this;
};

routeobjects.Route.prototype.toXml=function(noUtf8){
    var rt='<?xml version="1.0" encoding="UTF-8" standalone="no" ?>'+"\n"+
        '<gpx version="1.1" creator="avnav">'+"\n"+
        '<rte>'+"\n";
    rt+="<name>"+(noUtf8?this.name:unescape(encodeURIComponent(this.name)))+"</name>\n";
    var i;
    for (i=0;i<this.points.length;i++){
        rt+='<rtept lon="'+this.points[i].lon+'" lat="'+this.points[i].lat+'"><name>'+
            (noUtf8?this.points[i].name:unescape(encodeURIComponent(this.points[i].name)))+'</name></rtept>'+"\n";
    }
    rt+="</rte>\n</gpx>\n";
    return rt;
};

/**
 * delete a point from the route
 * return the next point if there is still one behind
 * @param idx - the index starting at 0
 * @returns {*}
 */
routeobjects.Route.prototype.deletePoint=function(idx){
    if (idx <0 || idx >= this.points.length) return undefined;
    this.points.splice(idx,1);
    if (idx < this.points.length) return this.points[idx];
    return undefined;
};

/**
 * get the point at index
 * @param idx
 * @returns {*}
 */
routeobjects.Route.prototype.getPointAtIndex=function(idx){
    if (idx < 0 || idx >= this.points.length) return undefined;
    return this.points[idx];
};

/**
 * get the index of a wp in the route
 * @param {navobjects.WayPoint} point
 * @returns {number} - -1 if not found
 */
routeobjects.Route.prototype.getIndexFromPoint=function(point){
    if (! point || point.name === undefined) return -1;
    if (point.routeName === undefined || point.routeName != this.name) return -1;
    var i;
    for (i=0;i<this.points.length;i++){
        if (this.points[i].compare(point)) return i;
    }
    return -1;
};
/**
 * return a point at a given offset to the current point
 * @param {navobjects.WayPoint} point
 * @param {number} offset
 * @returns {navobjects.WayPoint}
 */

routeobjects.Route.prototype.getPointAtOffset=function(point, offset){
    var idx=this.getIndexFromPoint(point);
    if (idx < 0) return undefined;
    if ((idx+offset) < 0 || (idx+offset)>= this.points.length) return undefined;
    return this.points[idx+offset];
};

/**
 * change a waypoint in the route
 * @param {navobjects.WayPoint} oldPoint
 * @param {navobjects.WayPoint}newPoint
 * @returns {navobjects.WayPoint|undefined} the new point or undefined if no change (e.g. name already exists or point not in route)
 */
routeobjects.Route.prototype.changePoint=function(oldPoint, newPoint){
    var idx=this.getIndexFromPoint(oldPoint);
    return this.changePointAtIndex(idx,newPoint);
};
/**
 * change a waypoint in the route
 * @param {number} idx
 * @param {navobjects.WayPoint}newPoint
 * @returns {navobjects.WayPoint|undefined} the new point or undefined if no change (e.g. name already exists or point not in route)
 */
routeobjects.Route.prototype.changePointAtIndex=function(idx, newPoint){
    if (idx < 0 || idx >= this.points.length) return undefined;
    newPoint=this._toWayPoint(newPoint);
    var oldPoint=this.points[idx].clone();
    if (newPoint.name && newPoint.name != oldPoint.name){
        if (this.checkName(newPoint.name)) return undefined;
    }
    if (newPoint.routeName && newPoint.routeName != this.name) return undefined;
    this.points[idx].update(newPoint);
    return this.points[idx];
};
/**
 *
 * @param idx
 * @param {navobjects.WayPoint} newWp
 * @returns {boolean}
 */
routeobjects.Route.prototype.checkChangePossible=function(idx, newWp){
    if (idx < 0 || idx > this.points.length) return false;
    var current=this.points[idx];
    if (current.name == newWp.name) return true;
    var i=0;
    for (i=0;i<this.points.length;i++){
        if (i == idx ) continue;
        if (this.points[i].name == newWp.name) return false;
    }
    return true;
};
/**
 * check if a given name already exists in the route
 * @param name
 */
routeobjects.Route.prototype.checkName=function(name){
    var i=0;
    for (i=0;i< this.points.length;i++){
        if (this.points[i].name == name) return true;
    }
    return false;
};

routeobjects.Route.prototype._createNameFromId=function(id){
    return "WP"+Formatter.formatDecimal(id,2,0);
};
routeobjects.Route.prototype.findFreeName=function(){
    var i=this.points.length;
    var j=0;
    for (j=0;j< this.points.length;j++){
        try {
            if (this.points[j].name) {
                var nameVal=this.points[j].name.replace(/^[^0-9]*/, "").replace(/ .*/,"");
                var nameNum = parseInt(nameVal);
                if (nameNum > i) i = nameNum;
            }
        }catch (e){}
    }
    i++;
    for (j=0;j< this.points.length+1;j++){
        var name=this._createNameFromId(i);
        if (! this.checkName(name)) return name;
        i++;
    }
    avnav.log("no free name found for wp");
    return "no free name found";
};
routeobjects.Route.prototype.addPoint=function(idx, point){
    point=this._toWayPoint(point);
    var rp=point.clone();
    if (rp.name){
        if (this.checkName(rp.name)){
            avnav.log("name "+rp.name+" already exists in route, create a new one");
            rp.name=undefined;
        }
    }
    if (! rp.name){
        rp.name=this.findFreeName();
    }
    rp.routeName=this.name.slice(0);
    if (idx < 0 || idx >= (this.points.length-1)) {
        this.points.push(rp);
    }
    else{
        this.points.splice(idx+1,0,rp);
    }
    return rp;
};

routeobjects.Route.prototype.setName=function(name){
    this.name=name;
    this.points.forEach(function(p){p.routeName=name.slice(0)})
};

/**
 * invert the route
 */
routeobjects.Route.prototype.swap=function() {
    for (var i = 0; i < this.points.length / 2; i++) {
        var swap = this.points.length - i - 1;
        var old = this.points[i];
        this.points[i] = this.points[swap];
        this.points[swap] = old;
    }
    return this;
};
/**
 * replace a route in place by another route
 * @param {routeobjects.Route} other
 * @returns {boolean}
 */
routeobjects.Route.prototype.assignFrom=function(other){
    if (! other) return false;
    this.name=other.name;
    this.server=other.server;
    this.points=[];
    for (var i=0;i<other.points.length;i++){
        this.points.push(other.points[i].clone());
    }
    return true;
};

/**
 *
 * @param {navobjects.Point} newPoint
 * @returns {navobjects.WayPoint}
 * @private
 */
routeobjects.Route.prototype._toWayPoint=function(newPoint) {
    if (!(newPoint instanceof navobjects.WayPoint)) newPoint = navobjects.WayPoint.fromPlain(newPoint);
    return newPoint;
};

routeobjects.RouteInfo=function(name, opt_server){
    this.type="route";
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
    /**
     * active route (at the time of info creation...)
     * @type {boolean}
     */
    this.active=false;
};
routeobjects.FormattedPoint=function(){
    this.idx=0;
    this.name="";
    this.latlon="---";
    this.course="---";
    this.distance="---";
};

routeobjects.RoutePoint=function(waypoint){
    navobjects.WayPoint.call(this);
    this.update(waypoint);
    this.idx=0;
    this.course=undefined;
    this.distance=undefined;
    this.selected=false;
};
avnav.inherits(routeobjects.RoutePoint,navobjects.WayPoint);
routeobjects.formatRoutePoint=function(routePoint){
    var rt=assign({},routePoint);
    rt.distance=Formatter.formatDistance(routePoint.distance).replace(/^/g,"");
    rt.course=Formatter.formatDirection(routePoint.course).replace(/^ /g,"");
    rt.latlon=Formatter.formatLonLats(routePoint);
    return rt;
};

/**
 * get a list of waypoint info
 * extended by distance, index and course
 * @returns {routeobjects.RoutePoint[]}
 */
routeobjects.Route.prototype.getRoutePoints=function(opt_selectedIdx){
    var rt=[];
    var i=0;
    for (i=0;i<this.points.length;i++){
        var formatted=new routeobjects.RoutePoint(this.points[i]);
        formatted.idx=i;
        formatted.name=this.points[i].name?this.points[i].name:i+"";
        formatted.routeName=this.name;
        if (i>0) {
            var dst=NavCompute.computeDistance(this.points[i-1],this.points[i]);
            formatted.course=dst.course;
            formatted.distance=dst.dtsnm;
        }
        if (i == opt_selectedIdx){
            formatted.selected=true;
        }
        rt.push(formatted);
    }
    return rt;
};
/**
 * compute the length
 * @param {number} startIdx - the point to start from
 * @returns {number}
 */
routeobjects.Route.prototype.computeLength=function(startIdx){
    var rt=0;
    if (startIdx < 0) startIdx=0;
    if (this.points.length < (startIdx+2)) return rt;
    var last=this.points[startIdx];
    startIdx++;
    for (;startIdx<this.points.length;startIdx++){
        var next=this.points[startIdx];
        var dst=NavCompute.computeDistance(last,next);
        rt+=dst.dtsnm;
        last=next;
    }
    return rt;
};
/**
 * find the point that is closest to the provided point
 *
 * @param {navobjects.Point} point
 * @returns {number} -1 if there are no points in the route
 */
routeobjects.Route.prototype.findBestMatchingIdx=function(point){
    var idx;
    var mindistance=undefined;
    var bestPoint=-1;
    if (! point) return bestPoint;
    var dst;
    for (idx=0;idx<this.points.length;idx++){
        dst=NavCompute.computeDistance(point,this.points[idx]);
        if (bestPoint == -1 || dst.dts<mindistance){
            bestPoint=idx;
            mindistance=dst.dts;
        }
    }
    return bestPoint;
};

module.exports=routeobjects;
