import navobjects from "./navobjects";
import LatLon from "geodesy/latlon-spherical";
import keys from "../util/keys";
import NavCompute from "./navcompute";
import aisformatter from "./aisformatter";

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
export class AISItem {
    constructor(received) {
        this.received = received;
        this.estimated = undefined;
        this.cpadata = new navobjects.Cpa();
        this.timestamp = undefined; //last computed
        this.warning = false;
        this.nextWarning = false; //the warning target with the lowest tcps
        this.nearest = false;
        this.tracking = false;
        this.age = undefined; //age in seconds at the last computation
        this.distance = undefined; //distance to boat in m
        this.headingTo = undefined;
        this.shouldHandle = false;
        this.hidden = false;
        this.priority = undefined; //lowest
    }

    /**
     * reset all attributes except for the received data
     * @param item
     */
    static reset(item) {
        let helper = new AISItem();
        for (let k in helper)
            if (k !== 'received') item[k] = helper[k];
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
    minAISspeed: {key:keys.properties.minAISspeed,f:parseFloat},
    minDisplaySpeed: {key: keys.properties.aisMinDisplaySpeed,f: parseFloat},
    useRhumbLine: keys.nav.routeHandler.useRhumbLine,
    onlyShowMoving: keys.properties.aisOnlyShowMoving,
    showA: keys.properties.aisShowA,
    showB: keys.properties.aisShowB,
    showOther:keys.properties.aisShowOther,
    hideTime: {key: keys.properties.aisHideTime,f:parseFloat},
    cpaEstimated: keys.properties.aisCpaEstimated,
    warningDist: keys.properties.aisWarningCpa,
    warningTime: keys.properties.aisWarningTpa
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
const computeApproach=(courseToTarget,curdistance,srcCourse,srcSpeed,dstCourse,dstSpeed,minAisSpeed,maxDistance)=>{
    //courses
    let rt={};
    let ca=(courseToTarget-srcCourse)/180*Math.PI; //rad
    let cb=(courseToTarget-dstCourse)/180*Math.PI;
    let cosa=Math.cos(ca);
    let sina=Math.sin(ca);
    let cosb=Math.cos(cb);
    let sinb=Math.sin(cb);
    if (dstSpeed > minAisSpeed && srcSpeed > minAisSpeed ){
        //compute crossing
        try {
            rt.td = curdistance / (dstSpeed * (cosa / sina * sinb - cosb));
            rt.ts=curdistance/(srcSpeed*(cosa-sina*cosb/sinb));
        }catch(e){
            //TODO: exception handling
        }
        if (rt.td !== undefined && rt.ts !== undefined){
            rt.ds=srcSpeed*rt.ts; //in m
            rt.dd=dstSpeed*rt.td; //in m
            if (maxDistance !== undefined){
                if (Math.abs(rt.ds) > maxDistance || Math.abs(rt.dd) > maxDistance){
                    rt.td=undefined;
                    rt.ts=undefined;
                    rt.ds=undefined;
                    rt.dd=undefined;
                }
            }
        }
    }
    let quot=(srcSpeed*srcSpeed+dstSpeed*dstSpeed-2*srcSpeed*dstSpeed*(cosa*cosb+sina*sinb));
    if (quot < 1e-6 && quot > -1e-6){
        rt.tm=undefined;
        return rt;
    }
    rt.tm=curdistance*(cosa*srcSpeed-cosb*dstSpeed)/quot;
    rt.dms=srcSpeed*rt.tm;
    rt.dmd=dstSpeed*rt.tm;
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
const computeCpa=(src,dst,options)=>{
    let rt = new Cpa();
    let llsrc = new LatLon(src.lat, src.lon);
    let lldst = new LatLon(dst.lat, dst.lon);
    let curdistance=options.useRhumbLine?llsrc.rhumbDistanceTo(lldst):llsrc.distanceTo(lldst); //m
    rt.curdistance=curdistance;
    let courseToTarget=options.useRhumbLine?
        llsrc.rhumbBearingTo(lldst):
        llsrc.initialBearingTo(lldst); //in deg
    //default to our current distance
    rt.tcpa=0;
    rt.cpa=curdistance;
    let maxDistance=6371e3*1000*Math.PI; //half earth
    let appr=computeApproach(courseToTarget,curdistance,src.course,src.speed,dst.course,dst.speed,options.minAISspeed,maxDistance);
    if (appr.dd !== undefined && appr.ds !== undefined) {
        let xpoint = options.useRhumbLine?
            llsrc.rhumbDestinationPoint(appr.dd,src.course):
            llsrc.destinationPoint(appr.dd,src.course);
        rt.crosspoint = new navobjects.Point(xpoint.lon, xpoint.lat);
    }
    if (!appr.tm){
        rt.tcpa=undefined;
        rt.cpa=curdistance;
        rt.passFront=undefined;
        return rt;
    }

    let cpasrc = options.useRhumbLine?
        llsrc.rhumbDestinationPoint(appr.dms,src.course):
        llsrc.destinationPoint(appr.dms,src.course );
    let cpadst = options.useRhumbLine?
        lldst.rhumbDestinationPoint(appr.dms,dst.course):
        lldst.destinationPoint(appr.dmd,dst.course);
    rt.src.lon=cpasrc.lon;
    rt.src.lat=cpasrc.lat;
    rt.dst.lon=cpadst.lon;
    rt.dst.lat=cpadst.lat;
    rt.tcpa = appr.tm;
    rt.cpa = options.useRhumbLine?
        cpasrc.rhumbDistanceTo(cpadst):
        cpasrc.distanceTo(cpadst);
    rt.bcpa = options.useRhumbLine?
        cpasrc.rhumbBearingTo(cpadst):
        cpasrc.initialBearingTo(cpadst);
    rt.passFront=Cpa.PASS_BACK;
    if (appr.td !==undefined && appr.ts!==undefined){
        if(appr.ts>=0 && appr.ts<appr.td) rt.passFront=Cpa.PASS_FRONT; // we will cross track of target in front of target
        else if(appr.ts>=0 && appr.ts>appr.td) rt.passFront=Cpa.PASS_PASS; // we will cross track of target astern of target
        else rt.passFront=Cpa.PASS_BACK; // we have crossed the track of the target already
    }
    if (rt.passFront===Cpa.PASS_BACK && appr.tm<0) rt.passFront=Cpa.PASS_DONE; // we have crossed the track and have passed CPA
    return rt;
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
        if (! (aisItem.received instanceof Object)){
            return;
        }
        let ais=aisItem.received;
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
        let aispos = new navobjects.Point(parseFloat(ais.lon || 0), parseFloat(ais.lat || 0));
        let aisCourse = parseFloat(ais.course || 0);
        if (aisSpeed >= options.minDisplaySpeed) {
            aisItem.estimated = NavCompute.computeTarget(aispos, aisCourse, aisItem.age * aisSpeed, options.useRhumbLine);
        }
        if (boatPos.lat === undefined || boatPos.lon === undefined || boatCog === undefined || boatSpeed === undefined) returh;
        let targetPos=(options.cpaEstimated && aisItem.estimated)?aisItem.estimated:aispos;
        let dst=NavCompute.computeDistance(boatPos,targetPos,options.useRhumbLine);
        aisItem.distance=dst.dts;
        aisItem.headingTo=dst.course;
        aisItem.cpadata=computeCpa({
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
        if (aisItem.cpadata  && aisItem.cpadata.cpa !== undefined){
            if (aisItem.cpadata.cpa <= options.warningDist && aisItem.cpadata.tcpa <= options.warningTime && 0 <= aisItem.cpadata.tcpa) {
                aisItem.warning = true;
                if (aisWarningAis) {
                    if (Math.abs(aisItem.cpadata.tcpa) < Math.abs(aisWarningAis.cpadata.tcpa)) aisWarningAis = aisItem;
                } else aisWarningAis = aisItem;
            }
        }
    })
    if (aisWarningAis !== undefined) aisWarningAis.nextWarning=true;
    aisData.sort(aisSort);
    if (aisData.length) aisData[0].nearest=true;
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