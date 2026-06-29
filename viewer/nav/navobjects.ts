/**
 * Created by Andreas on 14.05.2014.
 */
import {Coordinate as olCoordinate}  from "ol/coordinate";


/**
 * a point lon,lat
 * @param lon
 * @param lat
 * @constructor
 */
export class Point {
    lon: number;
    lat: number;

    constructor(lon?: number, lat?: number) {
        this.lon = lon;
        this.lat = lat;
    }

    /**
     * convert ol3 coordinates to a point
     * @param coord
     * @returns {Point}
     */
    fromCoord(coord: olCoordinate) {
        this.lon = coord[0];
        this.lat = coord[1];
        return this;
    }

    /**
     * assign my values to the target point
     * @param point
     * @returns {*}
     */
    assign(point: Point) {
        point.lon = this.lon;
        point.lat = this.lat;
        return point;
    }

    fromPlain(point: { lat: number, lon: number }): Point {
        this.lon = point.lon;
        this.lat = point.lat;
        return this;
    }

    compare(point: PlainPoint) {
        if (!point) return false;
        if (point.lon == this.lon && point.lat == this.lat) return true;
        return false;
    }

    /**
     * convert to ol3 coordinates
     * @returns {*[]}
     */
    toCoord(): olCoordinate {
        const rt = [this.lon, this.lat];
        return rt;
    }

    clone() {
        return new Point(this.lon, this.lat);
    }

    valid() {
        return !isNaN(Number(this.lat)) && !isNaN(Number(this.lon))
    }
}
export interface PlainPoint{
    lat?: number;
    lon?: number;
    name?: string;
    routeName?: string;
    idx?: number;
    course?:number;
    distance?:number;
}
/**
 * a waypoint (to interact with the server)
 * @param {number} lon
 * @param {number} lat
 * @param {string} opt_name
 * @constructor
 */
export class WayPoint extends Point {
    name?: string;
    routeName?: string;
    server?:boolean=false;
    constructor(lon?: number, lat?: number, opt_name?: string,opt_routeName?:string) {
        super(lon, lat);
        this.name = opt_name;

        /**
         * if this waypoint belongs to a route
         * this parameter will be set<script type="text/javascript" src="libraries/geo.js"></script>
         * @type {string}
         */
        this.routeName = opt_routeName;
    }


    compare(point: PlainPoint) {
        if (!point) return false;
        if (!super.compare(point)) return false;
        if (point instanceof WayPoint) {
            return this.routeName == point.routeName && this.name == point.name;
        }
        return true;
    }

    /**
     * create a waypoint from aplain (json) object
     * @param plain
     * @returns {navobjects.WayPoint}
     */
    static fromPlain(plain: PlainPoint): WayPoint {
        if (!plain) return new WayPoint();
        const rt=new WayPoint(plain.lon, plain.lat, plain.name,plain.routeName);
        return rt;
    }

    clone() {
        const rt = new WayPoint(this.lon, this.lat, this.name ? this.name.slice(0) : null);
        rt.routeName = (this.routeName !== undefined) ? this.routeName.slice(0) : undefined;
        return rt;
    }

    /**
     * update lat/lon/name/id of a wp, return true if the lat/lon/id has changed
     * @param point
     * @returns {boolean}
     */
    update(point: PlainPoint) {
        let rt = false;
        if (point.lon !== undefined) {
            if (point.lon != this.lon) rt = true;
            this.lon = point.lon;
        }
        if (point.lat !== undefined) {
            if (point.lat != this.lat) rt = true;
            this.lat = point.lat;
        }
        if (point.name !== undefined) {
                this.name = point.name.slice(0);
        }
        if (point.routeName !== undefined) {
                this.routeName = point.routeName.slice(0);
        }
        return rt;
    }
    static MOB='MOB'
}


/**
 * a track point
 * @param {number} lon
 * @param {number} lat
 * @param {number} ts timestamp in seconds (float)
 * @param opt_speed
 * @param opt_course
 * @constructor
 */
export class TrackPoint extends Point {
    ts: number;
    speed: number;
    opt_course: number;

    constructor(lon?: number, lat?: number, ts?: number, opt_speed?: number, opt_course?: number) {
        super(lon, lat);
        this.ts = ts;
        this.speed = opt_speed || 0;
        this.opt_course = opt_course || 0;
    }

    clone() {
        const rt = new TrackPoint(this.lon, this.lat, this.ts,this.speed, this.opt_course);
        return rt;
    }
}


/**
 * a distance between 2 points (distance+course)
 * @constructor
 */

export class Distance{

    /**
     * the distance in meters
     * @type {number}
     */
    dts:number=undefined;
    /**
     * the course
     * @type {number}
     */
    course:number=undefined;
    constructor(){}
}


export default {
    Point:Point,
    WayPoint:WayPoint,
    TrackPoint:TrackPoint,
    Distance: Distance,
};