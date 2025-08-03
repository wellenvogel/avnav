import navobjects from "./navobjects";
import LatLon from "geodesy/latlon-spherical";
import keys from "../util/keys";
import NavCompute from "./navcompute";
import aisformatter from "./aisformatter";
import Helper from "../util/helper";
import Navcompute from "./navcompute";

/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 * AIS computations
 */
export class Cpa{
    static PASS_DONE=undefined;
    static PASS_FRONT=1;
    static PASS_PASS=-1;
    static PASS_BACK=0;
    constructor() {
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
         * the current distnace in m
         * @type {undefined|number}
         */
        this.curdistance=undefined;
        /**
         * distance in m
         * @type {number}
         */
        this.cpa=undefined;

        /**
         * time till cpa in s
         * @type {number}
         */
        this.tcpa=undefined;
        /**
         * bearing to CPA point
         * @type {number|undefined}
         */
        this.bcpa=undefined;
        /**
         *
         * @type {number|undefined}: 0-back,1-front,-1 parallel,undefined-parallel crossed
         */
        this.passFront=undefined;
    }
}
export class CourseVector{
    static T_LINE=0;
    static T_ARC=1;
    constructor() {
        this.type=CourseVector.T_LINE;
        this.start=undefined;
        this.end=undefined;
        this.center=undefined;
        this.startAngle=undefined;
        this.arc=0;
        this.radius=undefined;
        this.offsetDir=undefined;
        this.offsetDst=undefined;
    }
    static reset(item){
        let o=new CourseVector();
        for (let k in o){
            item[k]=o[k];
        }
    }
    clone(){
        let o=new CourseVector();
        for (let k in o){
            o[k]=this[k];
        }
        return o;
    }
}
export class AISItem {
    constructor(received) {
        this.received = received||{};
        this.receivedPos=new navobjects.Point(undefined,undefined);
        /**
         *
         * @type {navobjects.Point}
         */
        this.estimated = undefined;
        /**
         *
         * @type {CourseVector}
         */
        this.courseVector=undefined;
        /**
         *
         * @type {CourseVector}
         */
        this.rmv=undefined;
        this.cpadata = new Cpa();
        this.timestamp = undefined; //last computed
        this.warning = false;
        this.nextWarning = false; //the warning target with the lowest tcps
        this.nearest = false;
        this.tracking = false;
        this.age = undefined; //age in seconds at the last computation
        this.lost=false;
        this.distance = undefined; //distance to boat in m
        this.headingTo = undefined;
        this.shouldHandle = false;
        this.hidden = false;
        this.priority = undefined; //lowest
        this.fromEstimated=false;
        this.courseVector=undefined;
        this.mmsi=this.received.mmsi; //we repeat the mmsi here as this is heavily used and we avoid additional checks
    }

    /**
     * reset all attributes except for the received data
     * @param item
     */
    static reset(item) {
        let helper = new AISItem();
        for (let k in helper)
            if (k !== 'received') item[k] = helper[k];
        item.mmsi=(item.received||{}).mmsi;
    }

}

const aisSort=(a,b)=>{
    try {
         if (a.distance === b.distance) return 0;
         if (a.distance === undefined) return 1;
         if (b.distance === undefined) return -1;
         if (a.distance < b.distance) return -1;
         return 1;
        } catch (err) {
            return 0;
        }
}

export const AisOptionMappings={
    minAISspeed: {key:keys.properties.aisMinDisplaySpeed,f:parseFloat},
    useRhumbLine: keys.nav.routeHandler.useRhumbLine,
    onlyShowMoving: keys.properties.aisOnlyShowMoving,
    showA: keys.properties.aisShowA,
    showB: keys.properties.aisShowB,
    showOther:keys.properties.aisShowOther,
    hideTime: {key: keys.properties.aisHideTime,f:parseFloat},
    cpaEstimated: {key: {useEstimated:keys.properties.aisCpaEstimated,showEstimated:keys.properties.aisShowEstimated},f:(v)=> v.useEstimated && v.showEstimated},
    warningDist: keys.properties.aisWarningCpa,
    warningTime: keys.properties.aisWarningTpa,
    courseVectorTime: keys.properties.navBoatCourseTime,
    useCourseVector: keys.properties.aisUseCourseVector,
    lostTime: keys.properties.aisLostTime,
    curved: keys.properties.aisCurvedVectors,
    rmvRange: {key:keys.properties.aisRelativeMotionVectorRange,f: (v)=>parseFloat(v)*Navcompute.NM},
    navUrl: keys.properties.navUrl,
    markAll: keys.properties.aisMarkAllWarning
}

/**
 * do the computation of the cross point and the closest approach
 * all units are Si units (m, s,...), angles in degrees
 * @param courseToTarget
 * @param curdistance
 * @param srcCourse
 * @param srcSpeed
 * @param dstCourse
 * @param dstSpeed
 * @param minAisSpeed - minimal speed we allow for crossing computation
 * @param maxDistance
 * @returns {object} an object with the properties
 *        td - time dest to crosspoint (if crossing)
 *        ts - time src to crosspoint (if crossing)
 *        dd - distance destination to crosspoint
 *        ds - distance src to crosspoint
 *        tm - TCPA
 *        dms - distance src to cpa point
 *        dmd - distance dest to cpa point
 */
const computeApproach = (courseToTarget, curdistance, srcCourse, srcSpeed, dstCourse, dstSpeed, minAisSpeed, maxDistance) => {
    //courses
    let rt = {};
    if (dstSpeed <= minAisSpeed && srcSpeed <= minAisSpeed) {
        //we consider both as steady
        return rt;
    }
    let ca = (courseToTarget - srcCourse) / 180 * Math.PI; //rad
    let cb = (courseToTarget - dstCourse) / 180 * Math.PI;
    let cosa = Math.cos(ca);
    let sina = Math.sin(ca);
    let cosb = Math.cos(cb);
    let sinb = Math.sin(cb);
    if (dstSpeed <= minAisSpeed) {
        rt.tm = curdistance * cosa / srcSpeed;
        rt.dms = srcSpeed * rt.tm;
        rt.dmd = 0;
        return rt;
    }
    if (srcSpeed <= minAisSpeed) {
        rt.tm = -curdistance * cosb / dstSpeed;
        rt.dmd = dstSpeed * rt.tm;
        rt.dms = 0;
    }
    //compute crossing
    try {
        rt.td = curdistance / (dstSpeed * (cosa / sina * sinb - cosb));
        rt.ts = curdistance / (srcSpeed * (cosa - sina * cosb / sinb));
    } catch (e) {
        //TODO: exception handling
    }
    if (rt.td !== undefined && rt.ts !== undefined) {
        rt.ds = srcSpeed * rt.ts; //in m
        rt.dd = dstSpeed * rt.td; //in m
        if (maxDistance !== undefined) {
            if (Math.abs(rt.ds) > maxDistance || Math.abs(rt.dd) > maxDistance) {
                rt.td = undefined;
                rt.ts = undefined;
                rt.ds = undefined;
                rt.dd = undefined;
            }
        }
    }
    let quot = (srcSpeed * srcSpeed + dstSpeed * dstSpeed - 2 * srcSpeed * dstSpeed * (cosa * cosb + sina * sinb));
    if (quot < 1e-6 && quot > -1e-6) {
        rt.tm = undefined;
        return rt;
    }
    rt.tm = curdistance * (cosa * srcSpeed - cosb * dstSpeed) / quot;
    rt.dms = srcSpeed * rt.tm;
    rt.dmd = dstSpeed * rt.tm;
    return rt;
};

/**
 * compute the CPA point
 * returns src.lon,src.lat,dst.lon,dst.lat,cpa(m),cpanm(nm),tcpa(s),front (true if src reaches intersect point first)
 * each of the objects must have: lon,lat,course,speed
 * lon/lat in decimal degrees, speed in kn
 * we still have to check if the computed tm is bigger then our configured one
 * //update
 * if one of the partners has no real speed minAISSpeed
 * we need to change the computation - just compute the orthogonal distance of the point to the other
 * course line
 * @param src
 * @param dst
 * @param options {object} - useRhumbLine, minAISSpeed
 * @returns {Cpa}
 */
const computeCpa = (src, dst, options) => {
    let rt = new Cpa();
    let llsrc;
    let lldst;
    try {
        llsrc = new LatLon(src.lat, src.lon);
        lldst = new LatLon(dst.lat, dst.lon);
        let curdistance = options.useRhumbLine ? llsrc.rhumbDistanceTo(lldst) : llsrc.distanceTo(lldst); //m
        rt.curdistance = curdistance;
        let courseToTarget = options.useRhumbLine ?
            llsrc.rhumbBearingTo(lldst) :
            llsrc.initialBearingTo(lldst); //in deg
        //default to our current distance
        rt.tcpa = 0;
        rt.cpa = curdistance;
        let maxDistance = 6371e3 * 1000 * Math.PI; //half earth
        let appr;
        const srcCourse = correctedCourse(src.course, src.speed, options.minAISspeed);
        const targetCourse = correctedCourse(dst.course, dst.speed, options.minAISspeed);
        if (srcCourse !== undefined && src.speed !== undefined && targetCourse !== undefined && dst.speed !== undefined) {
            appr = computeApproach(courseToTarget, curdistance, srcCourse, src.speed, targetCourse, dst.speed, options.minAISspeed, maxDistance);
        }
        if (appr && appr.dd !== undefined && appr.ds !== undefined) {
            let xpoint = options.useRhumbLine ?
                llsrc.rhumbDestinationPoint(appr.dd, srcCourse) :
                llsrc.destinationPoint(appr.dd, srcCourse);
            rt.crosspoint = new navobjects.Point(xpoint.lon, xpoint.lat);
        }
        if (!appr || !appr.tm) {
            rt.tcpa = undefined;
            rt.cpa = curdistance;
            rt.passFront = undefined;
            return rt;
        }

        let cpasrc = (appr.dms === 0) ? llsrc : options.useRhumbLine ?
            llsrc.rhumbDestinationPoint(appr.dms, srcCourse) :
            llsrc.destinationPoint(appr.dms, srcCourse);
        let cpadst = (appr.dmd === 0) ? lldst : options.useRhumbLine ?
            lldst.rhumbDestinationPoint(appr.dmd, targetCourse) :
            lldst.destinationPoint(appr.dmd, targetCourse);
        rt.src.lon = cpasrc.lon;
        rt.src.lat = cpasrc.lat;
        rt.dst.lon = cpadst.lon;
        rt.dst.lat = cpadst.lat;
        rt.tcpa = appr.tm;
        rt.cpa = options.useRhumbLine ?
            cpasrc.rhumbDistanceTo(cpadst) :
            cpasrc.distanceTo(cpadst);
        rt.bcpa = options.useRhumbLine ?
            cpasrc.rhumbBearingTo(cpadst) :
            cpasrc.initialBearingTo(cpadst);
        rt.passFront = Cpa.PASS_BACK;
        if (appr.td !== undefined && appr.ts !== undefined) {
            if (appr.ts >= 0 && appr.ts < appr.td) rt.passFront = Cpa.PASS_FRONT; // we will cross track of target in front of target
            else if (appr.ts >= 0 && appr.ts > appr.td) rt.passFront = Cpa.PASS_PASS; // we will cross track of target astern of target
            else rt.passFront = Cpa.PASS_BACK; // we have crossed the track of the target already
        }
        if (rt.passFront === Cpa.PASS_BACK && appr.tm < 0) rt.passFront = Cpa.PASS_DONE; // we have crossed the track and have passed CPA
        return rt;
    } catch (e) {
        //debug only for breakpoints here
        throw e;
    }
}
const pow2=(x)=>{
    return x*x;
}
/**
 *
 * @param aisItem {AISItem}
 * @param boatPos {navobjects.Point}
 * @param boatCog {number}
 * @param boatSog {number}
 * @param options {object} keys are the same as in {@link AisOptionMappings}
 */
const computeCourseVectors=(aisItem,boatPos,boatCog, boatSog, options)=>{
    if (! options.useCourseVector) return;
    let target_sog=aisItem.received.speed||0;
    if (target_sog <=0) return;
    let target_cog=correctedCourse(aisItem.received.course,target_sog,options.minAISspeed);
    let target_rot=Math.abs(aisItem.received.turn||0); // °/min
    const curved = options.curved && isFinite(target_rot) && target_rot>0.5;
    let cvstart=aisItem.fromEstimated?aisItem.estimated:aisItem.receivedPos
    if (! curved){
        aisItem.courseVector=new CourseVector();
        aisItem.courseVector.start=cvstart;
        aisItem.courseVector.end=NavCompute.computeTarget(
            cvstart,
            target_cog,
            target_sog*options.courseVectorTime,
            options.useRhumbLine
        )
    }
    else{
        let target_rot_sgn=Math.sign(aisItem.received.turn||0);
        let turn_radius=target_sog/Helper.radians(target_rot)*60; // m, SOG=[m/s]
        let turn_center=Navcompute.computeTarget(cvstart,target_cog+target_rot_sgn*90,turn_radius);
        let turn_angle=Helper.degrees(target_sog*options.courseVectorTime/turn_radius);
        aisItem.courseVector=new CourseVector();
        aisItem.courseVector.type=CourseVector.T_ARC;
        aisItem.courseVector.start=cvstart;
        aisItem.courseVector.center=turn_center;
        aisItem.courseVector.radius=turn_radius;
        aisItem.courseVector.startAngle=target_cog-target_rot_sgn*90;
        aisItem.courseVector.arc=target_rot_sgn*turn_angle;
    }
    if (options.rmvRange > 0 && aisItem.distance !== undefined && boatSog !== undefined
        && aisItem.distance < options.rmvRange &&
        target_sog > options.minAISspeed &&
        boatSog > options.minAISspeed){
        if (! curved){
            aisItem.rmv=new CourseVector();
            aisItem.rmv.start=cvstart;
            aisItem.rmv.end=NavCompute.computeTarget(aisItem.courseVector.end,
                boatCog,-boatSog*options.courseVectorTime);
        }
        else{
            aisItem.rmv=aisItem.courseVector.clone();
            aisItem.rmv.offsetDir=boatCog;
            aisItem.rmv.offsetDst=-boatSog*options.courseVectorTime;
        }
    }
}
/**
 * it seems that some GPS report an undefined course for very low speeds
 * so we allow an undefined course for speeds below minAISSpeed as this course does not matter any way
 * we just set it to 0 in this case
 * see https://github.com/wellenvogel/avnav/issues/498
 * @param course
 * @param speed
 * @param minSpeed
 * @returns {number|*}
 */
const correctedCourse=(course,speed,minSpeed)=>{
    if (course !== undefined) return course;
    if (speed <= minSpeed) return 0;
    return course;
}
/**
 *
 * @param aisData {Array<AISItem>} this list is filled with the estimated values and the CPA computation
 * @param boatPos {navobjects.Point}
 * @param boatCog {number} in debrees
 * @param boatSpeed {number} in ms/s
 * @param options {object} keys are the same as in {@link AisOptionMappings}
 */
export const computeAis=(aisData,boatPos,boatCog,boatSpeed, options)=>{
    let now=(new Date()).getTime();
    if (aisData === undefined) return;
    if (! (aisData instanceof Array)) throw new Error("invalid ais data");
    let aisWarningAis=undefined; //the most important warning
    aisData.forEach((aisItem)=>{
        AISItem.reset(aisItem);
        aisItem.shouldHandle=false;
        if (! (aisItem.received instanceof Object)){
            return;
        }
        let ais=aisItem.received;
        if (ais.lat === undefined || ais.lon === undefined) return;
        let aisSpeed = parseFloat(ais.speed || 0);
        aisItem.shouldHandle=!options.onlyShowMoving || aisSpeed >= options.minAISspeed;
        if (aisItem.shouldHandle){
            let clazz=aisformatter.format('clazz',aisItem);
            if (clazz === 'A') aisItem.shouldHandle=options.showA;
            else if (clazz === 'B') aisItem.shouldHandle=options.showB;
            else aisItem.shouldHandle=options.showOther;
        }
        if (! aisItem.shouldHandle) return;
        if (ais.heading !== undefined) {
            if (parseInt(ais.heading) === 511) {
                ais.heading = undefined;
            }
        }
        aisItem.age=parseFloat(ais.age || 0);
        if (ais.receiveTime !== undefined) aisItem.age+= (now - ais.receiveTime)/1000;
        if (aisItem.age > options.lostTime) aisItem.lost=true;
        aisItem.receivedPos = new navobjects.Point(parseFloat(ais.lon || 0), parseFloat(ais.lat || 0));
        let aisCourse = parseFloat(ais.course || 0);
        if (aisSpeed >= options.minAISspeed) {
            aisItem.estimated = NavCompute.computeTarget(aisItem.receivedPos, aisCourse, aisItem.age * aisSpeed, options.useRhumbLine);
        }
        aisItem.fromEstimated=(options.cpaEstimated && aisItem.estimated);
        let targetPos=(aisItem.fromEstimated)?aisItem.estimated:aisItem.receivedPos;
        if (boatPos.lat !== undefined && boatPos.lon !== undefined && targetPos.lat !== undefined && targetPos.lon !== undefined) {
            let dst = NavCompute.computeDistance(boatPos, targetPos, options.useRhumbLine);
            aisItem.distance = dst.dts;
            aisItem.headingTo = dst.course;
            aisItem.cpadata = computeCpa({
                    lat: boatPos.lat,
                    lon: boatPos.lon,
                    course: boatCog,
                    speed: boatSpeed
                },
                {
                    lat: targetPos.lat,
                    lon: targetPos.lon,
                    course: aisCourse,
                    speed: aisSpeed
                },
                options
            );
        }
        if (aisItem.cpadata  && aisItem.cpadata.cpa !== undefined){
            if (aisItem.cpadata.cpa <= options.warningDist && aisItem.cpadata.tcpa <= options.warningTime && 0 <= aisItem.cpadata.tcpa) {
                aisItem.warning = true;
                if (aisWarningAis) {
                    if (Math.abs(aisItem.cpadata.tcpa) < Math.abs(aisWarningAis.cpadata.tcpa)) aisWarningAis = aisItem;
                } else aisWarningAis = aisItem;
            }
            //compute priority
            //lower numbers are higher priority
            //if the item has the warning flag set
            //we use the tcpa (will always be >= 0 in this case)
            //otherwise we use the relative dcpa/tcpa to their thresholds
            if (aisItem.warning){
                //aisItems with warning will set a negative priority (-2...-1)
                //if we have a warning tcpa is <= warningTime
                //so tcpa/warningTime is < 1
                //tcpa == 0 will set priority -2
                //other tcpa up to warningTime will set > -2 ... <-1
                //tcpa == warningTime will set -1
                aisItem.priority=-(1-aisItem.cpadata.tcpa/options.warningTime);
            }
            else{
                //aisItems without warning will set priorities >= 0
                if (aisItem.cpadata.tcpa < 0) aisItem.priority=2*(pow2(aisItem.distance/options.warningDist));
                else aisItem.priority= pow2(aisItem.cpadata.tcpa/options.warningTime)+pow2(aisItem.cpadata.cpa/options.warningDist);
            }
        }
        computeCourseVectors(aisItem, boatPos, boatCog, boatSpeed, options);
    })
    if (aisWarningAis !== undefined){
        aisWarningAis.nextWarning=true;
    }
    aisData.sort(aisSort);
    if (aisData.length && aisData[0].distance !== undefined) aisData[0].nearest=true;
}
/**
 *
 * @param jsonData {Array<object>}
 * @param boatPos {navobjects.Point}
 * @param boatCog {number}
 * @param boatSpeed {number}
 * @param options {object} see {@link AisOptionMappings}
 * @returns {*[]}
 */
export const handleReceivedAisData=(jsonData,boatPos, boatCog, boatSpeed, options)=>{
    let aisItems=[];
    jsonData.forEach((item)=>{
        aisItems.push(new AISItem(item))
    })
    computeAis(aisItems,boatPos,boatCog,boatSpeed,options);
    return aisItems;
}