/**
 * Created by andreas on 04.05.14.
 */

var navobjects=require('../nav/navobjects');

/**
 *
 * @constructor
 */
var Formatter=function(){};

/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
Formatter.prototype.formatLonLatsDecimal=function(coordinate,axis){
    coordinate = (coordinate+540)%360 - 180; // normalize for sphere being round

    var abscoordinate = Math.abs(coordinate);
    var coordinatedegrees = Math.floor(abscoordinate);

    var coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);
    var numdecimal=2;
    //correctly handle the toFixed(x) - will do math rounding
    if (coordinateminutes.toFixed(numdecimal) == 60){
        coordinatedegrees+=1;
        coordinateminutes=0;
    }
    if( coordinatedegrees < 10 ) {
        coordinatedegrees = "0" + coordinatedegrees;
    }
    if (coordinatedegrees < 100 && axis == 'lon'){
        coordinatedegrees = "0" + coordinatedegrees;
    }
    var str = coordinatedegrees + "\u00B0";

    if( coordinateminutes < 10 ) {
        str +="0";
    }
    str += coordinateminutes.toFixed(numdecimal) + "'";
    if (axis == "lon") {
        str += coordinate < 0 ? "W" :"E";
    } else {
        str += coordinate < 0 ? "S" :"N";
    }
    return str;
};

/**
 *
 * @param {navobjects.Point} lonlat
 * @returns {string}
 */
Formatter.prototype.formatLonLats=function(lonlat){
    if (! lonlat || isNaN(lonlat.lat) || isNaN(lonlat.lon)){
        return "-----";
    }
    var ns=this.formatLonLatsDecimal(lonlat.lat, 'lat');
    var ew=this.formatLonLatsDecimal(lonlat.lon, 'lon');
    return ns + ', ' + ew;
};

/**
 * format a number with a fixed number of fractions
 * @param number
 * @param fix
 * @param fract
 * @param addSpace if set - add a space for positive numbers
 * @returns {string}
 */

Formatter.prototype.formatDecimal=function(number,fix,fract,addSpace){
    var sign="";
    number=parseFloat(number);
    if (isNaN(number)){
        rt="";
        while (fix > 0) {
            rt+="-";
            fix--;
        }
        return rt;
    }
    if (addSpace != null && addSpace) sign=" ";
    if (number < 0) {
        number=-number;
        sign="-";
    }
    var rt=number.toFixed(fract);
    var v=10;
    fix-=1;
    while (fix > 0){
        if (number < v){
            rt=" "+rt;
        }
        v=v*10;
        fix-=1;
    }
    return sign+rt;
};

/**
 *
 * @param {Date} curDate
 * @returns {string}
 */
Formatter.prototype.formatTime=function(curDate){
    if (! curDate) return "--:--:--";
    var datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};

/**
 *
 * @param {Date} curDate
 * @returns {string} hh:mm
 */
Formatter.prototype.formatClock=function(curDate){
    var datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0");
    return datestr;
};
/**
 * format date and time
 * @param {Date} curDate
 * @returns {string}
 */
Formatter.prototype.formatDateTime=function(curDate){
    var datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0)+"/"+
        this.formatDecimal(curDate.getDate(),2,0)+" "+
        this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};

module.exports=Formatter;