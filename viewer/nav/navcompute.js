/**
 * Created by Andreas on 14.05.2014.
 */
import navobjects from './navobjects';
import LatLon from 'geodesy/latlon-spherical';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
let NavCompute={
};


/**
 * compute the distances between 2 points
 * @param {navobjects.Point} src
 * @param {navobjects.Point} dst
 * @param opt_useRhumbLine
 * @returns {navobjects.Distance}
 */
NavCompute.computeDistance=function(src,dst, opt_useRhumbLine){
    let srcll=src;
    let dstll=dst;
    let rt=new navobjects.Distance();
    //use the movable type stuff for computations
    let llsrc=new LatLon(srcll.lat,srcll.lon);
    let lldst=new LatLon(dstll.lat,dstll.lon);
    if (!opt_useRhumbLine) {
        rt.dts = llsrc.distanceTo(lldst);
        rt.course = llsrc.initialBearingTo(lldst);
    }
    else{
        rt.dts = llsrc.rhumbDistanceTo(lldst);
        rt.course = llsrc.rhumbBearingTo(lldst);
    }
    return rt;
};

NavCompute.computeXte=function(start,destination,current){
    //use the movable type stuff for computations
    let llsrc=new LatLon(start.lat,start.lon);
    let lldst=new LatLon(destination.lat,destination.lon);
    let llcur=new LatLon(current.lat,current.lon);
    let xte=llcur.crossTrackDistanceTo(llsrc,lldst);
    return xte;
};
/**
 * compute the rhumb line xte using a simple "flattened" approach
 * like OpenCPN is doing this
 * @param start
 * @param destination
 * @param current
 */
NavCompute.computeRhumbXte=function(start,destination,current){
    let llsrc=new LatLon(start.lat,start.lon);
    let lldst=new LatLon(destination.lat,destination.lon);
    let llcur=new LatLon(current.lat,current.lon);
    let dstFromBrg=lldst.rhumbBearingTo(llsrc);
    let dstCurBrg=lldst.rhumbBearingTo(llcur);
    let dstCurDst=lldst.rhumbDistanceTo(llcur);
    let alpha=dstFromBrg-dstCurBrg;
    return dstCurDst*Math.sin(alpha * Math.PI / 180);
}
/**
 * compute points on a route
 * @param start
 * @param destination
 * @param percentStep
 * @param opt_min minimal distance in m - below no split
 * @return {LatLonSpherical[]}
 */
NavCompute.computeCoursePoints=function (start,destination,percentStep,opt_min){
   let llsrc=new LatLon(start.lat,start.lon);
   let lldst=new LatLon(destination.lat,destination.lon);
   let rt=[llsrc];
   if (isNaN(percentStep) || percentStep < 1){
       rt.push(lldst);
       return rt;
   }
   if (opt_min === undefined){
       opt_min=10*NavCompute.NM;
   }
   let dst=llsrc.distanceTo(lldst);
   if (dst <= opt_min){
       rt.push(lldst);
       return rt;
   }
   //try to make segments of opt_min
   //but at most the given percentage
   let num=dst/opt_min;
   if (num < 2) num=2;
   let numPercent=100.0/num;
   if (percentStep < numPercent) {
       percentStep=numPercent;
   }
   let last=undefined
   for (let fraction=percentStep;fraction <= 100;fraction+=percentStep){
       last=llsrc.intermediatePointTo(lldst,fraction/100.0);
       rt.push(last);
   }
   if (! last || (last.lon !== lldst.lon || last.lat !== lldst.lat)){
       rt.push(lldst);
   }
   return rt;
}

/**
 * check if a course is closer to our own course or to ownCourse + 180
 * return 1 if closer to own or -1 if closer to +180
 * @param myCourse
 * @param otherCourse
 */
NavCompute.checkInverseCourse=function(myCourse,otherCourse){
    let inversCourse=(myCourse+180) % 360;
    if (Math.abs(otherCourse-myCourse) < Math.abs(otherCourse-inversCourse)) return 1;
    return -1;
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
 * @param properties - settings
 * @param opt_useRhumbLine
 * @returns {navobjects.Cpa}
 */
NavCompute.computeCpa=function(src,dst,properties,opt_useRhumbLine){
    let rt = new navobjects.Cpa();
    let llsrc = new LatLon(src.lat, src.lon);
    let lldst = new LatLon(dst.lat, dst.lon);
    let curdistance=opt_useRhumbLine?llsrc.rhumbDistanceTo(lldst):llsrc.distanceTo(lldst); //m
    if (curdistance < 0.1){
        let x=curdistance;
    }
    rt.curdistance=curdistance;
    let courseToTarget=opt_useRhumbLine?
        llsrc.rhumbBearingTo(lldst):
        llsrc.initialBearingTo(lldst); //in deg
    //default to our current distance
    rt.tcpa=0;
    rt.cpa=curdistance;
    let maxDistance=6371e3*1000*Math.PI; //half earth
    let appr=NavCompute.computeApproach(courseToTarget,curdistance,src.course,src.speed,dst.course,dst.speed,properties.minAISspeed,maxDistance);
    if (appr.dd !== undefined && appr.ds !== undefined) {
        let xpoint = opt_useRhumbLine?
            llsrc.rhumbDestinationPoint(appr.dd,src.course):
            llsrc.destinationPoint(appr.dd,src.course);
        rt.crosspoint = new navobjects.Point(xpoint.lon, xpoint.lat);
    }
    if (!appr.tm){
        rt.tcpa=0; //better undefined
        rt.cpa=curdistance;
        rt.front=undefined;
        return rt;
    }

    let cpasrc = opt_useRhumbLine?
        llsrc.rhumbDestinationPoint(appr.dms,src.course):
        llsrc.destinationPoint(appr.dms,src.course );
    let cpadst = opt_useRhumbLine?
        lldst.rhumbDestinationPoint(appr.dms,dst.course):
        lldst.destinationPoint(appr.dmd,dst.course);
    rt.src.lon=cpasrc.lon;
    rt.src.lat=cpasrc.lat;
    rt.dst.lon=cpadst.lon;
    rt.dst.lat=cpadst.lat;
    rt.cpa = opt_useRhumbLine?
        cpasrc.rhumbDistanceTo(cpadst):
        cpasrc.distanceTo(cpadst);
    rt.tcpa = appr.tm;
    if (rt.cpa > curdistance || appr.tm < 0){
        rt.cpa=curdistance;
        //rt.tcpa=0;
    }
    if (appr.td !==undefined && appr.ts!==undefined){
        rt.front=(appr.ts<appr.td)?1:0;
    }
    else{
        if (appr.tm >0) rt.front=-1; //we do not cross but will still aproach
        else rt.front=undefined;
    }
    return rt;
};

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
NavCompute.computeApproach=function(courseToTarget,curdistance,srcCourse,srcSpeed,dstCourse,dstSpeed,minAisSpeed,maxDistance){
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
 * compute a new point (in lon/lat) traveling from a given point
 * @param {navobjects.Point} src
 * @param {number} brg in degrees
 * @param {number} dist in m
*/
NavCompute.computeTarget=function(src,brg,dist,opt_useRhumbLine){
    let llsrc = new LatLon(src.lat, src.lon);
    let llrt= opt_useRhumbLine?
        llsrc.rhumbDestinationPoint(dist,brg):
        llsrc.destinationPoint(dist,brg);
    let rt=new navobjects.Point(llrt.lon,llrt.lat);
    return rt;
};



/**
 * compute the data for a leg
 * @param {navobjects.Point} target the waypoint destination
 * @param {{valid:Boolean,speed:Number,lon:Number, lat: Number, course: Number,rtime: Date}}gps the current gps data
 * @param opt_start
 * @returns {{markerCourse: Number, markerDistance: Number, markerVmg: Number, markerEta: Date, markerXte: Number}}
 */
NavCompute.computeLegInfo=function(target,gps,opt_start){
    let useRhumbLine=globalstore.getData(keys.nav.routeHandler.useRhumbLine);
    let rt={
        markerCourse:undefined,
        markerCourseGreatCircle: undefined,
        markerCourseRhumbLine: undefined,
        markerDistance: undefined,
        markerDistanceGreatCircle: undefined,
        markerDistanceRhumbLine: undefined,
        markerVmg: undefined,
        markerEta: undefined,
        markerXte: undefined
    };
    rt.markerWp=target;
    if (gps.valid) {
        let pos=new LatLon(gps.lat,gps.lon);
        let targetll=new LatLon(target.lat,target.lon);
        rt.markerCourseGreatCircle=pos.initialBearingTo(targetll);
        rt.markerCourseRhumbLine=pos.rhumbBearingTo(targetll);
        rt.markerDistanceGreatCircle=pos.distanceTo(targetll);
        rt.markerDistanceRhumbLine=pos.rhumbDistanceTo(targetll);
        if (useRhumbLine){
            rt.markerCourse=rt.markerCourseRhumbLine;
            rt.markerDistance=rt.markerDistanceRhumbLine;
        }
        else{
            rt.markerCourse=rt.markerCourseGreatCircle;
            rt.markerDistance=rt.markerDistanceGreatCircle;
        }
        // TODO: This is actually VMC not VMG
        rt.markerVmg = gps.speed * Math.cos(Math.PI / 180 * (rt.markerCourse - gps.course));
        if (gps.rtime && rt.markerVmg > 0) {
            let targetTime = gps.rtime.getTime() + rt.markerDistance / rt.markerVmg * 1000;
            let targetDate = new Date(Math.round(targetTime));
                rt.markerEta = targetDate;
            }
            else {
                rt.markerEta = null;
            }
        if (opt_start) {
            rt.markerXte = useRhumbLine?
                NavCompute.computeRhumbXte(opt_start,target,gps):
                NavCompute.computeXte(opt_start,target, gps);
        }
        else{
            rt.markerXte=0;
        }
    }
    return rt;
};
NavCompute.NM=1852; //m per NM

export default NavCompute;


