/**
 * Created by andreas on 04.05.14.
 */



/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
const formatLonLatsDecimal=function(coordinate,axis){
    coordinate = (coordinate+540)%360 - 180; // normalize for sphere being round

    let abscoordinate = Math.abs(coordinate);
    let coordinatedegrees = Math.floor(abscoordinate);

    let coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);
    let numdecimal=2;
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
    let str = coordinatedegrees + "\u00B0";

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
 * @param {Point} lonlat
 * @returns {string}
 */
const formatLonLats=function(lonlat){
    if (! lonlat || isNaN(lonlat.lat) || isNaN(lonlat.lon)){
        return "-----";
    }
    let ns=this.formatLonLatsDecimal(lonlat.lat, 'lat');
    let ew=this.formatLonLatsDecimal(lonlat.lon, 'lon');
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

const formatDecimal=function(number,fix,fract,addSpace){
    let sign="";
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
    let rt=number.toFixed(fract);
    let v=10;
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
const formatDecimalOpt=function(number,fix,fract,addSpace){
    number=parseFloat(number);
    if (isNaN(number)) return formatDecimal(number,fix,fract,addSpace);
    if (Math.floor(number) == number){
        return formatDecimal(number,fix,0,addSpace);
    }
    return formatDecimal(number,fix,fract,addSpace);
};

/**
 * format a distance
 * show 99.9 for values < 100, show 999 for values >= 100, max 5
 * @param distance
 */
const formatDistance=function(distance){
    let number=parseFloat(distance);
    if (isNaN(number)) return "    -"; //4 spaces
    if (number < 100){
        return formatDecimal(number,4,1);
    }
    return formatDecimal(number,5,0);
};

const formatSpeed=function(speed){
    let number=parseFloat(speed);
    if (isNaN(number)) return "  -"; //2 spaces
    if (number < 100){
        return formatDecimal(number,2,1);
    }
    return formatDecimal(number,3,0);
};

const formatDirection=function(dir){
    return formatDecimal(dir,3,0);
};

/**
 *
 * @param {Date} curDate
 * @returns {string}
 */
const formatTime=function(curDate){
    if (! curDate) return "--:--:--";
    let datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};

/**
 *
 * @param {Date} curDate
 * @returns {string} hh:mm
 */
const formatClock=function(curDate){
    if (! curDate) return "--:--";
    let datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0");
    return datestr;
};
/**
 * format date and time
 * @param {Date} curDate
 * @returns {string}
 */
const formatDateTime=function(curDate){
    let datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0)+"/"+
        this.formatDecimal(curDate.getDate(),2,0)+" "+
        this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};

module.exports={
    formatDateTime,
    formatClock,
    formatTime,
    formatDecimalOpt,
    formatDecimal,
    formatLonLats,
    formatLonLatsDecimal,
    formatDistance,
    formatDirection,
    formatSpeed
};