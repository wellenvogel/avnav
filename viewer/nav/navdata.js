/**
 * Created by Andreas on 14.05.2014.
 */
avnav.provide('avnav.nav.navdata.Distance');
avnav.provide('avnav.nav.navdata.Point');
avnav.provide('avnav.nav.navdata.WayPoint');
avnav.provide('avnav.nav.navdata.TrackPoint');
avnav.provide('avnav.nav.navdata.Cpa');
avnav.provide('avnav.nav.navdata.GpsInfo');

/**
 * a point lon,lat
 * @param lon
 * @param lat
 * @constructor
 */
avnav.nav.navdata.Point=function(lon,lat){
    this.lon=lon;
    this.lat=lat;
};
/**
 * convert ol3 coordinates to a point
 * @param coord
 * @returns {avnav.nav.navdata.Point}
 */
avnav.nav.navdata.Point.prototype.fromCoord=function(coord){
    this.lon=coord[0];
    this.lat=coord[1];
    return this;
};
/**
 * assign my values to the target point
 * @param point
 * @returns {*}
 */
avnav.nav.navdata.Point.prototype.assign=function(point){
    point.lon=this.lon;
    point.lat=this.lat;
    return point;
};

avnav.nav.navdata.Point.prototype.compare=function(point){
    if (! point) return false;
    if (point.lon == this.lon && point.lat == this.lat)return true;
    return false;
};

/**
 * convert to ol3 coordinates
 * @returns {*[]}
 */
avnav.nav.navdata.Point.prototype.toCoord=function(){
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
avnav.nav.navdata.WayPoint=function(lon,lat,opt_name){
    avnav.nav.navdata.Point.call(this,lon,lat);
    /**
     * the name of the waypoint
     * @type {string}
     */
    this.name=opt_name;
    /**
     * if this waypoint is part of a route this is a unique identifier within the route
     * @type {number}
     */
    this.id=undefined;
};

avnav.inherits(avnav.nav.navdata.WayPoint,avnav.nav.navdata.Point);
/**
 * create a waypoint from aplain (json) object
 * @param plain
 * @returns {avnav.nav.navdata.WayPoint}
 */
avnav.nav.navdata.WayPoint.fromPlain=function(plain){
    return new avnav.nav.navdata.WayPoint(plain.lon,plain.lat,plain.name);
};

avnav.nav.navdata.WayPoint.clone=function(){
    var rt=new avnav.nav.navdata.WayPoint(this.lon,this.lat,this.name?this.name.slice(0):null);
    rt.id=this.id;
    return rt;
};
/**
 * update lat/lon/name/id of a wp, return true if the lat/lon/id has changed
 * @param point
 * @returns {boolean}
 */
avnav.nav.navdata.WayPoint.update=function(point){
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
avnav.nav.navdata.TrackPoint=function(lon,lat,ts,opt_speed,opt_course){
    avnav.nav.navdata.Point.call(this,lon,lat);
    this.ts=ts;
    this.speed=opt_speed||0;
    this.opt_course=opt_course||0;
};
avnav.inherits(avnav.nav.navdata.TrackPoint,avnav.nav.navdata.Point);


/**
 * a distance between 2 points (distance+course)
 * @constructor
 */

avnav.nav.navdata.Distance=function(){
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
 * @extends {avnav.nav.navdata.Point}
 */
avnav.nav.navdata.GpsInfo=function(){
    avnav.nav.navdata.Point.call(this,0,0);
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
avnav.inherits(avnav.nav.navdata.GpsInfo,avnav.nav.navdata.Point);

/**
 * a CPA point for AIS data, contains the point + the time and the info whether we pass front or back
 * @constructor
 *
 */
avnav.nav.navdata.Cpa=function(){

    /**
     * the source position at CPA
     * @type {avnav.nav.navdata.Point}
     */
    this.src=new avnav.nav.navdata.Point(0,0);
    /**
     * the destination position at CPA
     * @type {avnav.nav.navdata.Point}
     */
    this.dst=new avnav.nav.navdata.Point(0,0);
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

avnav.nav.navdata.Ais=function(){

};