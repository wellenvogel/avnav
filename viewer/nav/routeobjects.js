/**
 * Created by andreas on 28.04.16.
 */
avnav.provide('avnav.nav.RouteData');
avnav.provide('avnav.nav.Route');
avnav.provide('avnav.nav.Leg');
avnav.provide('avnav.nav.RouteInfo');
avnav.provide('avnav.nav.RoutingMode');
avnav.provide('avnav.nav.WpInfo');


avnav.nav.RoutingMode={
    WP: 0,         //route to current standalone WP
    ROUTE:  1      //route to the currently selected Point of the route
};

avnav.nav.Leg=function(from,to,active,opt_routeName){
    /**
     * start of leg
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.from=from|| new avnav.nav.navdata.WayPoint();
    if (! (this.from instanceof avnav.nav.navdata.WayPoint))
        this.from=avnav.nav.navdata.WayPoint.fromPlain(this.from);
    /**
     * current target waypoint
     * @type {avnav.nav.navdata.WayPoint}
     */
    this.to=to||new avnav.nav.navdata.WayPoint();
    if (! (this.to instanceof avnav.nav.navdata.WayPoint))
        this.to=avnav.nav.navdata.WayPoint.fromPlain(this.to);
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
     * @type {avnav.nav.Route}
     */
    this.currentRoute=undefined;

};

avnav.nav.Leg.prototype.clone=function(){
    var rt=new avnav.nav.Leg(this.from.clone(),this.to.clone(),this.active,
        this.name?this.name.slice(0):undefined);
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
        currentTarget: this.getCurrentTargetIdx(),
        approach: this.approach,
        approachDistance: this.approachDistance+0,
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
    this.name=raw.name;
    this.approach=raw.approach;
    this.approachDistance=raw.approachDistance;
    if (raw.currentRoute){
        this.currentRoute=new avnav.nav.Route(raw.currentRoute.name);
        this.currentRoute.fromJson(raw.currentRoute);
        this.name=this.currentRoute.name;
    }
    if (this.currentRoute){
        if (raw.currentTarget !== undefined ){
            var rp=this.currentRoute.getPointAtIndex(raw.currentTarget);
            if (rp){
                this.to=rp;
            }
            else{
                //this is some error - set the to to be outside of the route...
                this.to.id=this.currentRoute.findFreeId();
            }
        }
    }
    else{
        this.to.id=undefined;
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
avnav.nav.Leg.prototype.getCurrentTargetIdx=function(){
    if (this.to && this.currentRoute ){
        return this.currentRoute.getIndexFromPoint(this.to);
    }
    return -1;
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
    this.server=parsed.server||false;
    this.points=[];
    var i;
    var wp;
    if (parsed.points){
        for (i in parsed.points){
            wp=avnav.nav.navdata.WayPoint.fromPlain(parsed.points[i]);
            if (parsed.points[i].id !== undefined) wp.id=parsed.points[i].id;
            else wp.id=i;  //a simple id - only unique within the route
            if (! wp.name){
                wp.name="WP"+avnav.util.Formatter.prototype.formatDecimal(wp.id+1,2,0);
            }
            wp.routeName=this.name.slice(0);
            this.points.push(wp);
        }
    }
    return this;
};
avnav.nav.Route.prototype.toJson=function(){
    var rt={};
    rt.name=this.name;
    rt.time=this.time;
    rt.server=this.server;
    rt.points=[];
    var i;
    for (i in this.points){
        var rp=this.points[i].clone();
        rp.routeName=undefined;
        rt.points.push(rp);
    }
    return rt;
};

avnav.nav.Route.prototype.toJsonString=function(){
    return JSON.stringify(this.toJson());
};
/**
 * check if a route differs to another route (does not consider the server flag)
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
        if (this.points[i].id != route2.points[i].id) return true;
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
    rt.server=this.server;
    return rt;
};
/**
 * fill a route from an xml doc
 * @param xml
 */
avnav.nav.Route.prototype.fromXml=function(xml){
    this.name=undefined;
    var doc= $.parseXML(xml);
    var self=this;
    var i=0;
    $(doc).find('rte:first').each(function(id,el){
        self.name=$(el).find('>name').text();
        $(el).find('rtept').each(function(pid,pel){
            var pt=new avnav.nav.navdata.WayPoint(0,0);
            pt.lon=parseFloat($(pel).attr('lon'));
            pt.lat=parseFloat($(pel).attr('lat'));
            pt.name=$(pel).find('>name').text();
            pt.id=i;
            pt.routeName=self.name.slice(0);
            if (! pt.name){
                pt.name="WP"+avnav.util.Formatter.prototype.formatDecimal(pt.id+1,2,0);
            }
            i++;
            self.points.push(pt);
        })
    });
    return this;
};

avnav.nav.Route.prototype.toXml=function(noUtf8){
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
avnav.nav.Route.prototype.deletePoint=function(idx){
    if (idx <0 || idx >= this.points.length) return undefined;
    this.points=this.points.splice(idx,1);
    if (idx < this.points.length) return this.points[idx];
    return undefined;
};

/**
 * get the point at index
 * @param idx
 * @returns {*}
 */
avnav.nav.Route.prototype.getPointAtIndex=function(idx){
    if (idx < 0 || idx >= this.points.length) return undefined;
    return this.points[idx];
};

/**
 * get the index of a wp in the route
 * @param {avnav.nav.navdata.WayPoint} point
 * @returns {number} - -1 if not found
 */
avnav.nav.Route.prototype.getIndexFromPoint=function(point){
    if (! point || point.id === undefined) return -1;
    if (point.routeName === undefined || point.routeName != this.name) return -1;
    var i;
    for (i=0;i<this.points.length;i++){
        if (this.points[i].id == point.id) return i;
    }
    return -1;
};
avnav.nav.Route.prototype.findFreeId=function(){
    var rt=0;
    var i;
    for (i=0;i< this.points.length;i++){
        if (this.points[i].id !== undefined && this.points[i].id > rt) rt=this.points[i].id;
    }
    return rt+1;
};
avnav.nav.Route.prototype.addPoint=function(idx,point){
    var nid=this.findFreeId();
    if (! (point instanceof avnav.nav.navdata.WayPoint)){
        point=new avnav.nav.navdata.WayPoint(point.lon,point.lat);
    }
    var rp=point.clone();
    rp.id=nid;
    rp.routeName=this.name.slice(0);
    if (! rp.name) rp.name="WP"+avnav.util.Formatter.prototype.formatDecimal(rp.id+1,2,0);
    if (idx < 0 || idx >= (this.points.length-1)) {
        this.points.push(rp);
    }
    else{
        this.points.splice(idx,0,rp);
    }
    return rp;
};

avnav.nav.Route.prototype.setName=function(name){
    this.name=name;
    this.points.forEach(function(p){p.routeName=name.slice(0)})
};

/**
 * invert the route
 */
avnav.nav.Route.prototype.swap=function() {
    for (var i = 0; i < this.points.length / 2; i++) {
        var swap = this.points.length - i - 1;
        var old = this.points[i];
        this.points[i] = this.points[swap];
        this.points[swap] = old;
    }
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

