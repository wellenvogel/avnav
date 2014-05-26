/**
 * Created by Andreas on 14.05.2014.
 */
goog.provide('avnav.nav.navdata.Distance');
goog.provide('avnav.nav.navdata.Point');
goog.provide('avnav.nav.navdata.TrackPoint');
goog.provide('avnav.nav.navdata.Cpa');
goog.provide('avnav.nav.navdata.GpsInfo');

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
goog.inherits(avnav.nav.navdata.TrackPoint,avnav.nav.navdata.Point);


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
     * @type {goog.date.DateTime}
     */
    this.rtime=null;
};
goog.inherits(avnav.nav.navdata.GpsInfo,avnav.nav.navdata.Point);

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
