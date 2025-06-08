/**
 * Created by andreas on 04.05.14.
 */

import TrackData from './trackdata';
import GpsData from './gpsdata';
import RouteData from './routedata';
import Formatter from '../util/formatter';
import NavCompute from './navcompute';
import navobjects from './navobjects';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import RouteEdit,{StateHelper} from './routeeditor.js';
import assign from 'object-assign';
import Average, {CourseAverage} from "../util/average.mjs";
import navcompute from "./navcompute";
import AisData from './aisdata';

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
    this.trackHandler=new TrackData();
    /**
     * @type {AisData|exports|module.exports}
     */
    this.routeHandler=new RouteData();

    this.speedAverage=new Average(10); //for steady detection
    this.mapAverageCog=new CourseAverage(globalStore.getData(keys.properties.courseAverageLength)); //for map rotation
    this.mapAverageHdt=new CourseAverage(globalStore.getData(keys.properties.courseAverageLength)); //for map rotation
    this.mapAverageHdm=new CourseAverage(globalStore.getData(keys.properties.courseAverageLength)); //for map rotation
    globalStore.register(()=>{
        this.mapAverageCog.reset(globalStore.getData(keys.properties.courseAverageLength));
        this.mapAverageHdt.reset(globalStore.getData(keys.properties.courseAverageLength));
        this.mapAverageHdm.reset(globalStore.getData(keys.properties.courseAverageLength));
    },[keys.gui.global.propertiesLoaded])
    let self=this;
    this.changeCallback=new Callback((keys)=>{self.computeValues();});
    globalStore.register(this.changeCallback,
        KeyHelper.flattenedKeys(activeRoute.getStoreKeys())
            .concat(
                KeyHelper.flattenedKeys(this.gpsdata.getStoreKeys()),
                [keys.map.centerPosition,
                    keys.nav.routeHandler.useRhumbLine]
            ));
    this.storeKeys=GpsData.getStoreKeys();
    this.aisData=new AisData(this);
};
NavData.prototype.startQuery=function(){
    this.gpsdata.startQuery();
    this.trackHandler.startQuery();
    this.routeHandler.startQuery();
    this.aisData.startQuery();
};
/**
 * compute the raw and formtted valued
 * @private
 */
NavData.prototype.computeValues=function() {
    const storeWriteKeys = assign({
            centerCourse: keys.nav.center.course,
            centerDistance: keys.nav.center.distance,
            markerCourseRhumbLine: keys.nav.wp.courseRhumbLine,
            markerCourseGreatCircle: keys.nav.wp.courseGreatCircle,
            markerCourse: keys.nav.wp.course,
            markerDistanceRhumbLine: keys.nav.wp.distanceRhumbLine,
            markerDistanceGreatCircle: keys.nav.wp.distanceGreatCircle,
            markerDistance: keys.nav.wp.distance,
            markerEta: keys.nav.wp.eta,
            markerXte: keys.nav.wp.xte,
            markerVmg: keys.nav.wp.vmg,
            markerWp: keys.nav.wp.position,
            markerServer: keys.nav.wp.server,
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
            wpName: keys.nav.wp.name
        },
        keys.nav.display);
    let data=assign({},storeWriteKeys);
    for (let k in data){
        data[k]=undefined;
    }
    let gps = globalStore.getMultiple(this.storeKeys);
    //copy the marker to data to make it available extern
    data.markerWp = activeRoute.getCurrentTarget();
    if (data.markerWp){
        data.markerServer=activeRoute.isServerLeg();
    }
    data.routeNextWp = activeRoute.getNextWaypoint();
    let maplatlon=globalStore.getData(keys.map.centerPosition,new navobjects.Point(0,0));
    let rstart = activeRoute.getCurrentFrom();
    let useRhumbLine=globalStore.getData(keys.nav.routeHandler.useRhumbLine);
    if (gps.valid) {
        if (activeRoute.hasActiveTarget()) {
            let legData = NavCompute.computeLegInfo(data.markerWp, gps, rstart);
            assign(data, legData);
        }
        let centerdst = NavCompute.computeDistance(gps, maplatlon,useRhumbLine);
        data.centerCourse = centerdst.course;
        data.centerDistance = centerdst.dts;
        if (activeRoute.anchorWatch() !== undefined) {
            let anchor = activeRoute.getCurrentFrom();
            data.anchorWatchDistance = activeRoute.anchorWatch();
            if (anchor) {
                let aleginfo = NavCompute.computeLegInfo(anchor, gps);
                data.anchorDistance = aleginfo.markerDistance;
                data.anchorDirection = aleginfo.markerCourse;
            }
        }
    }
    //distance between marker and center
    if (data.markerWp) {
        let mcdst = NavCompute.computeDistance(data.markerWp, maplatlon,useRhumbLine);
        data.centerMarkerCourse = mcdst.course;
        data.centerMarkerDistance = mcdst.dts;
    }

    //route data
    let curRoute = activeRoute.hasActiveTarget() ? activeRoute.getRoute() : undefined;
    data.isApproaching = activeRoute.isApproaching();
    if (curRoute) {
        data.routeName = curRoute.name;
        data.routeNumPoints = curRoute.points.length;
        data.routeLen = curRoute.computeLength(0,useRhumbLine);
        let currentIndex = curRoute.getIndexFromPoint(data.markerWp);
        if (currentIndex < 0) currentIndex = 0;
        data.routeRemain = curRoute.computeLength(currentIndex,useRhumbLine) + data.markerDistance;
        let routetime = gps.rtime ? gps.rtime.getTime() : 0;
        if (data.markerVmg && data.markerVmg > 0) {
            routetime += data.routeRemain / data.markerVmg  * 1000; //time in ms
            let routeDate = new Date(Math.round(routetime));
            data.routeEta = routeDate;
        }
        if (gps.valid) {
            if (data.routeNextWp) {
                let dst = NavCompute.computeDistance(gps, data.routeNextWp);
                data.routeNextCourse = dst.course;
            }
        }
    }
    let self=this;
    data.wpName=data.markerWp ? data.markerWp.name : '';
    data.directionMode='cog';
    data.isSteady=false;
    this.speedAverage.add(gps.speed);
    this.mapAverageCog.add(gps.course);
    this.mapAverageHdt.add(gps.headingTrue);
    this.mapAverageHdm.add(gps.headingMag);

    let boatDirectionMode=globalStore.getData(keys.properties.boatDirectionMode,'cog');
    data.boatDirection=gps.course;
    let mapCourse=this.mapAverageCog.val();
    let mapUseHdx=! globalStore.getData(keys.properties.courseUpAlwaysCOG);
    if (boatDirectionMode === 'hdt' && gps.headingTrue !== undefined){
        data.boatDirection=gps.headingTrue;
        data.directionMode=boatDirectionMode;
        if (mapUseHdx) mapCourse=this.mapAverageHdt.val();
    }
    if (boatDirectionMode === 'hdm' && gps.headingMag!== undefined){
        data.boatDirection=gps.headingMag;
        data.directionMode=boatDirectionMode;
        if (mapUseHdx) mapCourse=this.mapAverageHdm.val();
    }
    if (globalStore.getData(keys.properties.boatSteadyDetect)){
        let maxSpeed=parseFloat(globalStore.getData(keys.properties.boatSteadyMax)) * navcompute.NM / 3600.0;
        if (this.speedAverage.val() === undefined || this.speedAverage.val() < maxSpeed){
            data.isSteady=true;
        }
        if (data.boatDirection === undefined){
            data.isSteady=true;
        }
    }
    let tol = globalStore.getData(keys.properties.courseAverageTolerance);
    let mapDirection=globalStore.getData(keys.nav.display.mapDirection,0);
    if (mapCourse !== undefined && ! data.isSteady) {
        let diff=mapCourse-mapDirection;
        if (tol > 0) {
            if (diff < tol && diff > -tol) {
                let red=1-(tol-Math.abs(diff))/tol;
                if (red < 1 && red >= 0.2 ){
                    mapCourse=this.mapAverageCog.fract(mapDirection,mapCourse,red);
                }
                else {
                    mapCourse = mapDirection;
                }
            }
        }
        mapDirection=mapCourse;
    }
    else{
        mapDirection=undefined;
    }
    data.mapDirection=mapDirection;
    //store the data asynchronously to avoid any locks
    window.setTimeout(() => {

        globalStore.storeMultiple(
            data,
            storeWriteKeys
            , self.changeCallback);
    }, 0);
};

/**
 * get the center for AIS queries
 * @returns {[navobjects.Point]}
 */
NavData.prototype.getAisCenter=function(){
    const mode=globalStore.getData(keys.properties.aisCenterMode);
    if (mode === 'boat') {
        if (globalStore.getData(keys.nav.gps.valid)) return [globalStore.getData(keys.nav.gps.position)];
        return undefined;
    }
    else if (mode === 'map') {
        return [globalStore.getData(keys.map.centerPosition)];
    }
    if (globalStore.getData(keys.nav.gps.valid)){
            return [globalStore.getData(keys.map.centerPosition),globalStore.getData(keys.nav.gps.position)]
    }
    return [globalStore.getData(keys.map.centerPosition)];
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


NavData.prototype.resetTrack=function(opt_cleanServer){
    return this.trackHandler.resetTrack(opt_cleanServer);
};



NavData.prototype.getCurrentPosition=function(){
    if (globalStore.getData(keys.nav.gps.valid)){
        return globalStore.getData(keys.nav.gps.position);
    }
};

NavData.prototype.getAisHandler=function(){
    return this.aisData;
}

export default new NavData();




