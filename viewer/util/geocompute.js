/**
 * Created by Andreas on 14.05.2014.
 */
goog.provide('avnav.util.GeoCompute');
goog.require('avnav.util.geo.Distance');
goog.require('avnav.util.geo.Point');
goog.require('avnav.util.geo.Cpa');
goog.require('avnav.util.geo.GpsInfo');

avnav.util.GeoCompute=function(){
};


/**
 * compute the distances between 2 points
 * @param {avnav.util.geo.Point} src
 * @param {avnav.util.geo.Point} dst
 * @returns {avnav.util.geo.Distance}
 */
avnav.util.GeoCompute.computeDistance=function(src,dst){
    var srcll=src;
    var dstll=dst;
    var rt=new avnav.util.geo.Distance();
    //use the movable type stuff for computations
    var llsrc=new LatLon(srcll.lat,srcll.lon);
    var lldst=new LatLon(dstll.lat,dstll.lon);
    rt.dts=llsrc.distanceTo(lldst,5)*1000;
    rt.dtsnm=rt.dts/1852; //NM
    rt.course=llsrc.bearingTo(lldst);
    return rt;
};
/**
 * compute the CPA point
 * returns src.lon,src.lat,dst.lon,dst.lat,cpa(m),cpanm(nm),tcpa(s),front (true if src reaches intersect point first)
 * each of the objects must have: lon,lat,course,speed
 * lon/lat in decimal degrees, speed in kn
 * we still have to check if the computed tm is bigger then our configured one
 * @param src
 * @param dst
 * @returns {avnav.util.geo.Cpa}
 */
avnav.util.GeoCompute.computeCpa=function(src,dst){
    var NM=1852;
    var rt = new avnav.util.geo.Cpa();
    if (dst.speed < properties.minAISspeed) {
        return rt;
    }
    var llsrc = new LatLon(src.lat, src.lon);
    var lldst = new LatLon(dst.lat, dst.lon);
    var intersect = LatLon.intersection(llsrc, src.course, lldst, dst.course);
    if (!intersect) return rt;
    var da = llsrc.distanceTo(intersect, 5) * 1000; //m
    var timeIntersectSrc = 0;
    if (src.speed) timeIntersectSrc = da / src.speed; //strange unit: m/nm*h -> does not matter as we only compare
    var db = lldst.distanceTo(intersect, 5) * 1000; //m
    var timeIntersectDest = 0;
    if (dst.speed) timeIntersectDest = db / dst.speed; //strange unit: m/nm*h -> does not matter as we only compare
    if (timeIntersectSrc < timeIntersectDest) rt.front = true;
    var a = (src.course - dst.course) * Math.PI / 180;
    var va = src.speed * NM; //m/h
    var vb = dst.speed * NM;
    var tm = avnav.util.GeoCompute.computeTPA(a, da, db, va, vb); //tm in h
    if (tm < 0) return rt;
    var cpasrc = llsrc.destinationPoint(src.course, src.speed * NM / 1000 * tm);
    var cpadst = lldst.destinationPoint(dst.course, dst.speed * NM / 1000 * tm);
    rt.tcpa = tm * 3600;
    rt.cpa = cpasrc.distanceTo(cpadst, 5) * 1000;
    rt.cpanm = rt.cpa / NM;
    rt.src.lon = cpasrc._lon;
    rt.src.lat = cpasrc._lat;
    rt.dst.lon = cpadst._lon;
    rt.dst.lat = cpadst._lat;
    return rt;
};

/**
 * cpa/tcpa computation
 hard to find some sources - best at
 https://www.google.de/url?sa=t&rct=j&q=&esrc=s&source=web&cd=12&ved=0CDgQFjABOAo&url=http%3A%2F%2Forin.kaist.ac.kr%2Fboard%2Fdownload.php%3Fboard%3Dpublications%26no%3D32%26file_no%3D130&ei=2yaqUbb5GJPV4ASm9oDoBg&usg=AFQjCNFZA1OZGnJvY4USs5buqe8-BCsAiQ&sig2=fbsksaJ3sYIIO3intM-iZw&cad=rja
 basically assume courses being straight lines (should be fine enough for our 20nm....)
 if we have the intersection point, we have:
 a=angle between courses,
 da=initial distance from ship a to intersect
 db=initial distance from ship b to intersect
 va=speed a
 vb=speed b
 we can now simply use a coord system having the origin at current b position , x pointing towards the intersect
 xa=(da-va*t)*cos(a)
 ya=(da-va*t)*sin(a)
 xb=(db-vb*t)
 yb=0
 For the distance we get:
 s=sqrt((xa-xb)^^2+(ya-yb)^^2))
 with inserting and differentiating against t + finding null (tm being the time with minimal s)
 tm=((va*da+vb*db)-cos(a)*(va*db+vb*da))/(va^^2+vb^^2-2*va*vb*cos(a))
 we need to consider some limits...
 we return -1 if no meaningfull tpa
 @private
 */
avnav.util.GeoCompute.computeTPA=function(a,da,db,va,vb){
    var n=va*va+vb*vb-2*va*vb*Math.cos(a);
    if (n < 1e-6 && n > -1e-6) return -1;
    var tm=((va*da+vb*db)-Math.cos(a)*(va*db+vb*da))/n;
    return tm;
};






