/**
 * Created by Andreas on 14.05.2014.
 */
import base from '../base.js';
import assign from 'object-assign';
let navobjects={};



/**
 * the center mode for ais
 * @type {{NONE: number, GPS: number, MAP: number}}
 */
navobjects.AisCenterMode={
    NONE:0,
    GPS:1,
    MAP:2
};







/**
 * a point lon,lat
 * @param lon
 * @param lat
 * @constructor
 */
navobjects.Point=function(lon,lat){
    this.lon=lon||0;
    this.lat=lat||0;
};
/**
 * convert ol3 coordinates to a point
 * @param coord
 * @returns {navobjects.Point}
 */
navobjects.Point.prototype.fromCoord=function(coord){
    this.lon=coord[0];
    this.lat=coord[1];
    return this;
};
/**
 * assign my values to the target point
 * @param point
 * @returns {*}
 */
navobjects.Point.prototype.assign=function(point){
    point.lon=this.lon;
    point.lat=this.lat;
    return point;
};

navobjects.Point.prototype.fromPlain=function(point){
    this.lon=point.lon;
    this.lat=point.lat;
    return this;
};

navobjects.Point.prototype.compare=function(point){
    if (! point) return false;
    if (point.lon == this.lon && point.lat == this.lat)return true;
    return false;
};

/**
 * convert to ol3 coordinates
 * @returns {*[]}
 */
navobjects.Point.prototype.toCoord=function(){
    let rt=[this.lon,this.lat];
    return rt;
};

navobjects.Point.prototype.clone=function(){
    return new navobjects.Point(this.lon,this.lat);
};
/**
 * a waypoint (to interact with the server)
 * @param {number} lon
 * @param {number} lat
 * @param {string} opt_name
 * @constructor
 */
navobjects.WayPoint=function(lon,lat,opt_name){
    navobjects.Point.call(this,lon,lat);
    /**
     * the name of the waypoint
     * @type {string}
     */
    this.name=opt_name;

    /**
     * if this waypoint belongs to a route
     * this parameter will be set<script type="text/javascript" src="libraries/geo.js"></script>
     * @type {string}
     */
    this.routeName=undefined;
};

base.inherits(navobjects.WayPoint,navobjects.Point);

navobjects.WayPoint.prototype.compare=function(point){
    if (! point) return false;
    let rt= navobjects.Point.prototype.compare.call(this,point);
    if (! rt) return rt;
    if (point instanceof navobjects.WayPoint ){
        return this.routeName == point.routeName;
    }
    return true;
};
/**
 * create a waypoint from aplain (json) object
 * @param plain
 * @returns {navobjects.WayPoint}
 */
navobjects.WayPoint.fromPlain=function(plain){
    if (! plain) return new navobjects.WayPoint();
    return new navobjects.WayPoint(plain.lon,plain.lat,plain.name);
};

navobjects.WayPoint.prototype.clone=function(){
    let rt=new navobjects.WayPoint(this.lon,this.lat,this.name?this.name.slice(0):null);
    rt.routeName=(this.routeName!==undefined)?this.routeName.slice(0):undefined;
    return rt;
};
/**
 * update lat/lon/name/id of a wp, return true if the lat/lon/id has changed
 * @param point
 * @returns {boolean}
 */
navobjects.WayPoint.prototype.update=function(point){
    let rt=false;
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

navobjects.WayPoint.MOB="MOB";

/**
 * a track point
 * @param {number} lon
 * @param {number} lat
 * @param {number} ts timestamp in seconds (float)
 * @param opt_speed
 * @param opt_course
 * @constructor
 */
navobjects.TrackPoint=function(lon,lat,ts,opt_speed,opt_course){
    navobjects.Point.call(this,lon,lat);
    this.ts=ts;
    this.speed=opt_speed||0;
    this.opt_course=opt_course||0;
};
navobjects.TrackPoint.prototype.clone=function(){
    let rt=new navobjects.TrackPoint();
    assign(rt,this);
    return rt;
}
base.inherits(navobjects.TrackPoint,navobjects.Point);


/**
 * a distance between 2 points (distance+course)
 * @constructor
 */

navobjects.Distance=function(){
    /**
     * the distance in meters
     * @type {number}
     */
    this.dts=0;
    /**
     * the course
     * @type {number}
     */
    this.course=0
};




/**
 * a CPA point for AIS data, contains the point + the time and the info whether we pass front or back
 * @constructor
 *
 */
navobjects.Cpa=function(){

    /**
     * the source position at CPA
     * @type {navobjects.Point}
     */
    this.src=new navobjects.Point(0,0);
    /**
     * the destination position at CPA
     * @type {navobjects.Point}
     */
    this.dst=new navobjects.Point(0,0);
    /**
     *
     * @type {undefined|navobjects.Point}
     */
    this.crosspoint=undefined;
    /**
     * distance in m
     * @type {number}
     */
    this.cpa=0;

    /**
     * time till cpa in s
     * @type {number}
     */
    this.tcpa=-1;
    /**
     *
     * @type {number|undefined}: 0-back,1-front,-1 parallel,undefined-parallel crossed
     */
    this.front=undefined;
};

navobjects.Ais=function(){

};

export default navobjects;