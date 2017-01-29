/**
 * Created by Andreas on 14.05.2014.
 */
var navobjects=require('./navobjects');
var NavCompute={
};


/**
 * compute the distances between 2 points
 * @param {navobjects.Point} src
 * @param {navobjects.Point} dst
 * @returns {navobjects.Distance}
 */
NavCompute.computeDistance=function(src,dst){
    var srcll=src;
    var dstll=dst;
    var rt=new navobjects.Distance();
    //use the movable type stuff for computations
    var llsrc=new LatLon(srcll.lat,srcll.lon);
    var lldst=new LatLon(dstll.lat,dstll.lon);
    rt.dts=llsrc.distanceTo(lldst,5)*1000;
    rt.dtsnm=rt.dts/1852; //NM
    rt.course=llsrc.bearingTo(lldst);
    return rt;
};

NavCompute.computeXte=function(start,destination,current){
    //use the movable type stuff for computations
    var llsrc=new LatLon(start.lat,start.lon);
    var lldst=new LatLon(destination.lat,destination.lon);
    var llcur=new LatLon(current.lat,current.lon);
    var xte=llsrc.xte(lldst,llcur)*1000/1852;
    return xte;
};

/**
 * check if a course is closer to our own course or to ownCourse + 180
 * return 1 if closer to own or -1 if closer to +180
 * @param myCourse
 * @param otherCourse
 */
NavCompute.checkInverseCourse=function(myCourse,otherCourse){
    var inversCourse=(myCourse+180) % 360;
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
 * @returns {navobjects.Cpa}
 */
NavCompute.computeCpa=function(src,dst,properties){
    var NM=properties.NM;
    var msFactor=NM/3600.0;
    var rt = new navobjects.Cpa();
    var llsrc = new LatLon(src.lat, src.lon);
    var lldst = new LatLon(dst.lat, dst.lon);
    var curdistance=llsrc.distanceTo(lldst,5)*1000; //m
    if (curdistance < 0.1){
        var x=curdistance;
    }
    var courseToTarget=llsrc.bearingTo(lldst); //in deg
    //default to our current distance
    rt.tcpa=0;
    rt.cpa=curdistance;
    rt.cpanm=rt.cpa/NM;
    //courses
    var ca=(courseToTarget-src.course)/180*Math.PI; //rad
    var cb=(courseToTarget-dst.course)/180*Math.PI;
    var cosa=Math.cos(ca);
    var sina=Math.sin(ca);
    var cosb=Math.cos(cb);
    var sinb=Math.sin(cb);
    var td=undefined;
    var ts=undefined;
    if (dst.speed > properties.minAISspeed && src.speed > properties.minAISspeed && Math.abs(src.course-dst.course)> 5){
        //compute crossing
        try {
            td = curdistance / (dst.speed * msFactor * (cosa / sina * sinb - cosb));
            ts=curdistance/(src.speed*msFactor*(cosa-sina*cosb/sinb));
        }catch(e){
            //TODO: exception handling
        }
        if (td !== undefined && ts !== undefined){
            var da=src.speed*msFactor*ts; //in m
            var db=dst.speed*msFactor*td; //in m
            var xpoint = llsrc.destinationPoint(src.course, da/1000);
            rt.crosspoint=new navobjects.Point(xpoint._lon,xpoint._lat);
        }
    }
    var quot=msFactor*msFactor*(src.speed*src.speed+dst.speed*dst.speed-2*src.speed*dst.speed*(cosa*cosb+sina*sinb));
    if (quot < 1e-6 && quot > -1e-6){
        rt.tcpa=0; //better undefined
        rt.cpa=curdistance;
        rt.cpanm = rt.cpa / NM;
        rt.front=undefined;
        return rt;
    }
    var tm=curdistance*msFactor*(cosa*src.speed-cosb*dst.speed)/quot; //in s
    var dma=src.speed*msFactor*tm;
    var dmb=dst.speed*msFactor*tm;
    var cpasrc = llsrc.destinationPoint(src.course, dma/1000);
    var cpadst = lldst.destinationPoint(dst.course, dmb/1000);
    rt.src.lon=cpasrc._lon;
    rt.src.lat=cpasrc._lat;
    rt.dst.lon=cpadst._lon;
    rt.dst.lat=cpadst._lat;
    rt.cpa = cpasrc.distanceTo(cpadst, 5) * 1000;
    rt.tcpa = tm;
    if (rt.cpa > curdistance || tm < 0){
        rt.cpa=curdistance;
        rt.tcpa=0;
    }
    if (rt.cpa < 200){
        x=rt.cpa;
    }
    rt.cpanm = rt.cpa / NM;
    if (td !==undefined && ts!==undefined){
        rt.front=(ts<td)?0:1;
    }
    else{
        if (tm >0) rt.front=-1;
        else rt.front=undefined;
    }
    return rt;
};


/**
 * compute a new point (in lon/lat) traveling from a given point
 * @param {navobjects.Point} src
 * @param {number} brg in degrees
 * @param {number} dist in m
*/
NavCompute.computeTarget=function(src,brg,dist){
    var llsrc = new LatLon(src.lat, src.lon);
    var llrt=llsrc.destinationPoint(brg,dist/1000);
    var rt=new navobjects.Point(llrt.lon(),llrt.lat());
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
    var rt={
        markerCourse:undefined,
        markerDistance: undefined,
        markerVmg: undefined,
        markerEta: undefined,
        markerXte: undefined
    };
    rt.markerWp=target;
    if (gps.valid) {
        var markerdst = NavCompute.computeDistance(gps, target);
        rt.markerCourse = markerdst.course;
        rt.markerDistance = markerdst.dtsnm;
        var coursediff = Math.min(Math.abs(markerdst.course - gps.course), Math.abs(markerdst.course + 360 - gps.course),
            Math.abs(markerdst.course - (gps.course + 360)));
        if (gps.rtime && coursediff <= 85) {
            //TODO: is this really correct for VMG?
            var vmgapp = gps.speed * Math.cos(Math.PI / 180 * coursediff);
            //vmgapp is in kn
            var targettime = gps.rtime.getTime();
            rt.markerVmg = vmgapp;
            if (vmgapp > 0) {
                targettime += rt.markerDistance / vmgapp * 3600 * 1000; //time in ms
                var targetDate = new Date(Math.round(targettime));
                rt.markerEta = targetDate;
            }
            else {
                rt.markerEta = null;
            }
        }
        else {
            rt.markerEta = null;
            rt.markerVmg = 0;
        }
        if (opt_start) {
            rt.markerXte = NavCompute.computeXte(opt_start,target, gps);
        }
        else{
            rt.markerXte=0;
        }
    }
    return rt;
};

module.exports=NavCompute;


