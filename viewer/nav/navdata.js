/**
 * Created by andreas on 04.05.14.
 */

import Store from '../util/store';
import TrackData from './trackdata';
import GpsData from './gpsdata';
import RouteData from './routedata';
import Formatter from '../util/formatter';
import NavCompute from './navcompute';
import navobjects from './navobjects';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import PropertyHandler from '../util/propertyhandler';
import RouteEdit,{StateHelper} from './routeeditor.js';
import assign from 'object-assign';

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}

/**
 *
 * @constructor
 */
const NavData=function(){

    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=Formatter;
    /** @type {GpsData}
     * @private
     */
    this.gpsdata=new GpsData();
        /**
     * @private
     * @type {TrackData}
     */
    this.trackHandler=new TrackData(PropertyHandler,this);
    /**
     * @type {AisData|exports|module.exports}
     */
    this.routeHandler=new RouteData(PropertyHandler,this);
    /**
     * @private
     * @type {navobjects.Point}
     */
    this.maplatlon=new navobjects.Point(0,0);

    this.aisMode=navobjects.AisCenterMode.GPS;

    /**
     * @private
     * @type {properties.NM}
     */
    this.NM=globalStore.getData(keys.properties.NM);

    let self=this;
    this.changeCallback=new Callback((keys)=>{self.computeValues();});
    globalStore.register(this.changeCallback,
        KeyHelper.flattenedKeys(activeRoute.getStoreKeys())
            .concat(KeyHelper.flattenedKeys(this.gpsdata.getStoreKeys())));
};

/**
 * compute the raw and formtted valued
 * @private
 */
NavData.prototype.computeValues=function() {
    let data={
        centerCourse:0,
        centerDistance:0,
        centerMarkerCourse:0,
        centerMarkerDistance:0,
        markerCourse:0,
        markerDistance:0,
        markerVmg:0,
        markerEta:null,
        markerXte: 0,
        markerWp:new navobjects.WayPoint(0,0,"Marker"),
        /* data for the active route */
        routeName: undefined,
        routeNumPoints: 0,
        routeLen: 0,
        routeRemain: 0,
        routeEta: null,
        routeNextCourse: 0,
        routeNextWp: undefined,
        /* data for the route we are editing */
        edRouteName: undefined,
        edRouteNumPoints: 0,
        edRouteLen: 0,
        /* the next 2 will only be filled when the editing route is the current */
        edRouteRemain: 0,
        edRouteEta:0,
        anchorWatchDistance: undefined,
        anchorDistance: 0,
        anchorDirection: 0
    };
    var gps = globalStore.getMultiple(GpsData.getStoreKeys());
    //copy the marker to data to make it available extern
    data.markerWp = this.routeHandler.getCurrentLegTarget();
    data.routeNextWp = this.routeHandler.getCurrentLegNextWp();
    var rstart = activeRoute.getCurrentFrom();
    if (gps.valid) {
        if (activeRoute.hasActiveTarget()) {
            var legData = NavCompute.computeLegInfo(data.markerWp, gps, rstart);
            assign(data, legData);
        }
        else {
            data.markerCourse = undefined;
            data.markerDistance = undefined;
            data.markerEta = undefined;
            data.markerXte = undefined;
        }
        var centerdst = NavCompute.computeDistance(gps, this.maplatlon);
        data.centerCourse = centerdst.course;
        data.centerDistance = centerdst.dtsnm;
        if (activeRoute.anchorWatch() !== undefined) {
            let anchor = activeRoute.getCurrentFrom();
            data.anchorWatchDistance = activeRoute.anchorWatch();
            if (anchor) {
                let aleginfo = NavCompute.computeLegInfo(anchor, gps);
                data.anchorDistance = aleginfo.markerDistance * this.NM;
                data.anchorDirection = aleginfo.markerCourse;
            }
            else {
                data.anchorDistance = 0;
                data.anchorDirection = 0;
                data.anchorWatchDistance = undefined;
            }
        }
        else {
            data.anchorWatchDistance = undefined;
        }
    }
    else {
        data.centerCourse = 0;
        data.centerDistance = 0;
        data.markerCourse = 0;
        data.markerDistance = 0;
        data.markerEta = null;
        data.markerXte = undefined;
        data.anchorDistance = 0;
        data.anchorDirection = 0;
        data.anchorWatchDistance = undefined;
    }

    //distance between marker and center
    if (data.markerWp) {
        var mcdst = NavCompute.computeDistance(data.markerWp, this.maplatlon);
        data.centerMarkerCourse = mcdst.course;
        data.centerMarkerDistance = mcdst.dtsnm;
    }
    else {
        data.centerMarkerCourse = undefined;
        data.centerMarkerDistance = undefined;
    }
    //route data
    var curRoute = activeRoute.hasActiveTarget() ? activeRoute.getRoute() : undefined;
    data.isApproaching = activeRoute.isApproaching();
    if (curRoute) {
        data.routeName = curRoute.name;
        data.routeNumPoints = curRoute.points.length;
        data.routeLen = curRoute.computeLength(0, curRoute);
        let currentIndex = curRoute.getIndexFromPoint(data.markerWp);
        if (currentIndex < 0) currentIndex = 0;
        data.routeRemain = curRoute.computeLength(currentIndex) + data.markerDistance;
        var routetime = gps.rtime ? gps.rtime.getTime() : 0;
        if (data.markerVmg && data.markerVmg > 0) {
            routetime += data.routeRemain / data.markerVmg * 3600 * 1000; //time in ms
            var routeDate = new Date(Math.round(routetime));
            data.routeEta = routeDate;
        }
        else {
            data.routeEta = undefined;
        }
        data.routeNextCourse = undefined;
        if (gps.valid) {
            if (data.routeNextWp) {
                var dst = NavCompute.computeDistance(gps, data.routeNextWp);
                data.routeNextCourse = dst.course;
            }
        }
        else {
            data.routeRemain = 0;
            data.routeEta = undefined;
            data.routeNextCourse = undefined;
        }
    }
    else {
        data.routeName = undefined;
        data.routeNumPoints = 0;
        data.routeLen = 0;
        data.routeRemain = 0;
        data.routeEta = undefined;
        data.routeNextCourse = undefined;
    }
    let self=this;
    //store the data asynchronously to avoid any locks
    window.setTimeout(()=> {
        globalStore.storeMultiple(data, {
            centerCourse: keys.nav.center.course,
            centerDistance: keys.nav.center.distance,
            markerCourse: keys.nav.wp.course,
            markerDistance: keys.nav.wp.distance,
            markerEta: keys.nav.wp.eta,
            markerXte: keys.nav.wp.xte,
            markerVmg: keys.nav.wp.vmg,
            markerWp: keys.nav.wp.position,
            anchorDirection: keys.nav.anchor.direction,
            anchorDistance: keys.nav.anchor.distance,
            anchorWatchDistance: keys.nav.anchor.watchDistance,
            centerMarkerCourse: keys.nav.center.markerCourse,
            centerMarkerDistance: keys.nav.center.markerDistance,
            routeName: keys.nav.route.name,
            routeNumPoints: keys.nav.route.numPoints,
            routeLen: keys.nav.route.len,
            routeRemain: keys.nav.route.remain,
            routeEta: keys.nav.route.eta,
            routeNextCourse: keys.nav.route.nextCourse,
            isApproaching: keys.nav.route.isApproaching,
        },self.changeCallback);
        globalStore.storeData(keys.nav.wp.name, data.markerWp ? data.markerWp.name : '',self.changeCallback);
        globalStore.storeData(keys.nav.center.position, self.maplatlon,self.changeCallback);
        this.triggerUpdateEvent(navobjects.NavEventSource.NAV);
    },0);
};
/**
 * get the current map center (lon/lat)
 * @returns {navobjects.Point}
 */
NavData.prototype.getMapCenter=function(){
    return this.maplatlon;
};

/**
 * get the center for AIS queries
 * @returns {navobjects.Point|NavData.maplatlon|*}
 */
NavData.prototype.getAisCenter=function(){
    if (this.aisMode == navobjects.AisCenterMode.NONE) return undefined;
    if (this.aisMode == navobjects.AisCenterMode.GPS) {
        var data=this.gpsdata.getGpsData();
        if (data.valid) return data;
        return undefined;
    }
    return this.maplatlon;
};

/**
 * set the mode for the AIS query
 * @param {navobjects.AisCenterMode} mode
 */
NavData.prototype.setAisCenterMode=function(mode){
    this.aisMode=mode;
};







/**
 * called back from trackhandler
 */
NavData.prototype.trackEvent=function(){
       $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.TRACK,
        [],
        navobjects.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from aishandler
 */
NavData.prototype.aisEvent=function(){
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.AIS,
        [],
        navobjects.NavEventSource.NAV,
        this
    ));
};



/**
 * set the current map center position
 * @param {Array.<number>} lonlat
 */
NavData.prototype.setMapCenter=function(lonlat){
    var p=new navobjects.Point();
    p.fromCoord(lonlat);
    if (p.compare(this.maplatlon)) return;
    p.assign(this.maplatlon);
    this.computeValues();
    this.triggerUpdateEvent(navobjects.NavEventSource.MAP);
};

/**
 * get the routing handler
 * @returns {RouteData|*}
 */
NavData.prototype.getRoutingHandler=function(){
    return this.routeHandler;
};

/**
 * get the gps data handler
 * @returns {GpsData}
 */
NavData.prototype.getGpsHandler=function(){
    return this.gpsdata;
};
/**
 * get the track handler
 * @returns {TrackData}
 */
NavData.prototype.getTrackHandler=function(){
    return this.trackHandler;
};

NavData.prototype.resetTrack=function(){
    return this.trackHandler.resetTrack();
};

/**
 * send out an update event
 * @param {navobjects.NavEventSource} source
 */
NavData.prototype.triggerUpdateEvent=function(source){
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,
        new navobjects.NavEvent(navobjects.NavEventType.GPS,[],source,this)
    );
};

NavData.prototype.getCurrentPosition=function(){
    var gps=this.getGpsHandler().getGpsData();
    if (! gps.valid) return;
    return new navobjects.Point(gps.lon,gps.lat);
};

module.exports=new NavData();




