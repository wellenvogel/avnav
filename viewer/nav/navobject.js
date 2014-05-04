/**
 * Created by andreas on 04.05.14.
 */
goog.provide('avnav.nav.NavObject');
goog.require('avnav.nav.GpsData');

/**
 *
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @constructor
 */
avnav.nav.NavObject=function(propertyHandler){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.gpsdata=new avnav.nav.GpsData(propertyHandler,this);
};

/**
 * get the GPS handler
 * @returns {avnav.nav.GpsData|*}
 */
avnav.nav.NavObject.prototype.getGps=function(){
    return this.gpsdata;
}

avnav.nav.NavObject.GPS_EVENT='gpsevent';