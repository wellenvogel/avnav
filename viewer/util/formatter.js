/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.util.Formatter');


/**
 *
 * @constructor
 */
avnav.util.Formatter=function(){};

/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
avnav.util.Formatter.prototype.formatLonLatsDecimal=function(coordinate,axis){
    coordinate = (coordinate+540)%360 - 180; // normalize for sphere being round

    var abscoordinate = Math.abs(coordinate);
    var coordinatedegrees = Math.floor(abscoordinate);

    var coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);

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
    str += coordinateminutes.toFixed(2) + "'";
    if (axis == "lon") {
        str += coordinate < 0 ? "W" :"E";
    } else {
        str += coordinate < 0 ? "S" :"N";
    }
    return str;
};

/**
 *
 * @param {avnav.nav.navdata.Point} lonlat
 * @returns {string}
 */
avnav.util.Formatter.prototype.formatLonLats=function(lonlat){
    if (isNaN(lonlat.lat) || isNaN(lonlat.lon)){
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

avnav.util.Formatter.prototype.formatDecimal=function(number,fix,fract,addSpace){
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
            rt="0"+rt;
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
avnav.util.Formatter.prototype.formatTime=function(curDate){
    var datestr=this.formatDecimal(curDate.getHours(),2,0)+":"+
        this.formatDecimal(curDate.getMinutes(),2,0)+":"+
        this.formatDecimal(curDate.getSeconds(),2,0);
    return datestr;
};