/**
 * Created by Andreas on 14.05.2014.
 */
goog.provide('avnav.util.geo.Distance');
goog.provide('avnav.util.geo.Point');
goog.provide('avnav.util.geo.Cpa');
goog.provide('avnav.util.geo.GpsInfo');

/**
 * a point lon,lat
 * @param lon
 * @param lat
 * @constructor
 */
avnav.util.geo.Point=function(lon,lat){
    this.lon=lon;
    this.lat=lat;
};
/**
 * convert ol3 coordinates to a point
 * @param coord
 * @returns {avnav.util.geo.Point}
 */
avnav.util.geo.Point.prototype.fromCoord=function(coord){
    this.lon=coord[0];
    this.lat=coord[1];
    return this;
};
/**
 * assign my values to the target point
 * @param point
 * @returns {*}
 */
avnav.util.geo.Point.prototype.assign=function(point){
    point.lon=this.lon;
    point.lat=this.lat;
    return point;
};

/**
 * convert to ol3 coordinates
 * @returns {*[]}
 */
avnav.util.geo.Point.prototype.toCoord=function(){
    var rt=[this.lon,this.lat];
    return rt;
};

/**
 * a distance between 2 points (distance+course)
 * @constructor
 */

avnav.util.geo.Distance=function(){
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
 * @extends {avnav.util.geo.Point}
 */
avnav.util.geo.GpsInfo=function(){
    avnav.util.geo.Point.call(this,0,0);
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
goog.inherits(avnav.util.geo.GpsInfo,avnav.util.geo.Point);

/**
 * a CPA point for AIS data, contains the point + the time and the info whether we pass front or back
 * @constructor
 *
 */
avnav.util.geo.Cpa=function(){

    /**
     * the source position at CPA
     * @type {avnav.util.geo.Point}
     */
    this.src=new avnav.util.geo.Point(0,0);
    /**
     * the destination position at CPA
     * @type {avnav.util.geo.Point}
     */
    this.dst=new avnav.util.geo.Point(0,0);
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
