/**
 * Created by Andreas on 14.05.2014.
 */
var navdata={};
/**
 * a point lon,lat
 * @param lon
 * @param lat
 * @constructor
 */
navdata.Point=function(lon,lat){
    this.lon=lon;
    this.lat=lat;
};
/**
 * convert ol3 coordinates to a point
 * @param coord
 * @returns {navdata.Point}
 */
navdata.Point.prototype.fromCoord=function(coord){
    this.lon=coord[0];
    this.lat=coord[1];
    return this;
};
/**
 * assign my values to the target point
 * @param point
 * @returns {*}
 */
navdata.Point.prototype.assign=function(point){
    point.lon=this.lon;
    point.lat=this.lat;
    return point;
};

navdata.Point.prototype.compare=function(point){
    if (! point) return false;
    if (point.lon == this.lon && point.lat == this.lat)return true;
    return false;
};

/**
 * convert to ol3 coordinates
 * @returns {*[]}
 */
navdata.Point.prototype.toCoord=function(){
    var rt=[this.lon,this.lat];
    return rt;
};
/**
 * a waypoint (to interact with the server)
 * @param {number} lon
 * @param {number} lat
 * @param {string} opt_name
 * @constructor
 */
navdata.WayPoint=function(lon,lat,opt_name){
    navdata.Point.call(this,lon,lat);
    /**
     * the name of the waypoint
     * @type {string}
     */
    this.name=opt_name;

    /**
     * if this waypoint belongs to a route
     * this parameter will be set
     * @type {string}
     */
    this.routeName=undefined;
};

avnav.inherits(navdata.WayPoint,navdata.Point);

navdata.WayPoint.prototype.compare=function(point){
    if (! point) return false;
    var rt= this.super_.compare.call(this,point);
    if (! rt) return rt;
    if (point instanceof navdata.WayPoint ){
        return this.routeName == point.routeName;
    }
    return true;
};
/**
 * create a waypoint from aplain (json) object
 * @param plain
 * @returns {navdata.WayPoint}
 */
navdata.WayPoint.fromPlain=function(plain){
    return new navdata.WayPoint(plain.lon,plain.lat,plain.name);
};

navdata.WayPoint.prototype.clone=function(){
    var rt=new navdata.WayPoint(this.lon,this.lat,this.name?this.name.slice(0):null);
    rt.routeName=(this.routeName!==undefined)?this.routeName.slice(0):undefined;
    return rt;
};
/**
 * update lat/lon/name/id of a wp, return true if the lat/lon/id has changed
 * @param point
 * @returns {boolean}
 */
navdata.WayPoint.prototype.update=function(point){
    var rt=false;
    if (point.lon !== undefined){
        if (point.lon != this.lon) rt=true;
        this.lon=point.lon;
    }
    if (point.lat !== undefined){
        if (point.lat != this.lat) rt=true;
        this.lat=point.lat;
    }
    if (point.name !== undefined){
        this.name=point.name.slice(0);
    }
    if (point.routeName !== undefined){
        this.routeName=point.routeName.slice(0);
    }
    return rt;
};

/**
 * a track point
 * @param {number} lon
 * @param {number} lat
 * @param {number} ts timestamp in seconds (float)
 * @param opt_speed
 * @param opt_course
 * @constructor
 */
navdata.TrackPoint=function(lon,lat,ts,opt_speed,opt_course){
    navdata.Point.call(this,lon,lat);
    this.ts=ts;
    this.speed=opt_speed||0;
    this.opt_course=opt_course||0;
};
avnav.inherits(navdata.TrackPoint,navdata.Point);


/**
 * a distance between 2 points (distance+course)
 * @constructor
 */

navdata.Distance=function(){
    /**
     * the distance in meters
     * @type {number}
     */
    this.dts=0;
    /**
     * the distance in nm
     * @type {number}
     */
    this.dtsnm=0;
    /**
     * the course
     * @type {number}
     */
    this.course=0
};

/**
 *
 * @constructor
 * @extends {navdata.Point}
 */
navdata.GpsInfo=function(){
    navdata.Point.call(this,0,0);
    /**
     * speed in NM/H (kn)
     * @type {number}
     */
    this.speed=0;
    /**
     *
     * @type {number}
     */
    this.course=0;
    /**
     * data is only valid if this is true
     * @type {boolean}
     */
    this.valid=false;
    /**
     *
     * @type {Date}
     */
    this.rtime=null;
    /**
     * the raw data (status and nmea objects)
     * @type {Object}
     */
    this.raw=null;
};
avnav.inherits(navdata.GpsInfo,navdata.Point);

/**
 * a CPA point for AIS data, contains the point + the time and the info whether we pass front or back
 * @constructor
 *
 */
navdata.Cpa=function(){

    /**
     * the source position at CPA
     * @type {navdata.Point}
     */
    this.src=new navdata.Point(0,0);
    /**
     * the destination position at CPA
     * @type {navdata.Point}
     */
    this.dst=new navdata.Point(0,0);
    /**
     * distance in m
     * @type {number}
     */
    this.cpa=0;
    /**
     * cpa in NM
     * @type {number}
     */
    this.cpanm=0;
    /**
     * time till cpa in s
     * @type {number}
     */
    this.tcpa=-1;
    /**
     *
     * @type {boolean}
     */
    this.front=false;
};

navdata.Ais=function(){

};

module.exports=navdata;