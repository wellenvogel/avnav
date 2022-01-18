/**
 * Created by andreas on 04.05.14.
 */

import navcompute from '../nav/navcompute.js';
import {extendCoordinate} from "ol/extent";

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
formatLonLats.parameters=[];

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
    if (addSpace !== undefined && addSpace) sign=" ";
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
formatDecimal.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'}
];
const formatDecimalOpt=function(number,fix,fract,addSpace){
    number=parseFloat(number);
    if (isNaN(number)) return formatDecimal(number,fix,fract,addSpace);
    if (Math.floor(number) == number){
        return formatDecimal(number,fix,0,addSpace);
    }
    return formatDecimal(number,fix,fract,addSpace);
};

formatDecimalOpt.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'}
];

/**
 * format a distance
 * show 99.9 for values < 100, show 999 for values >= 100, max 5
 * @param distance in m
 * @param unit: one of nm,m,km
 */
const formatDistance=function(distance,opt_unit){
    let number=parseFloat(distance);
    if (isNaN(number)) return "    -"; //4 spaces
    let factor=navcompute.NM;
    if (opt_unit == 'm') factor=1;
    if (opt_unit == 'km') factor=1000;
    number=number/factor;
    if (number < 1){
        return formatDecimal(number,3,2);
    }
    if (number < 100){
        return formatDecimal(number,4,1);
    }
    return formatDecimal(number,5,0);
};
formatDistance.parameters=[
    {name:'unit',type:'SELECT',list:['nm','m','km'],default:'nm'}
];

/**
 *
 * @param speed in m/s
 * @param opt_unit one of kn,ms,kmh
 * @returns {*}
 */

const formatSpeed=function(speed,opt_unit){
    let number=parseFloat(speed);
    if (isNaN(number)) return "  -"; //2 spaces
    let factor=3600/navcompute.NM;
    if (opt_unit == 'ms') factor=1;
    if (opt_unit == 'kmh') factor=3.6;
    number=number*factor;
    if (number < 100){
        return formatDecimal(number,2,1);
    }
    return formatDecimal(number,3,0);
};

formatSpeed.parameters=[
    {name:'unit',type:'SELECT',list:['kn','ms','kmh'],default:'kn'}
];

const formatDirection=function(dir,opt_rad){
    if (opt_rad){
        dir=180*dir/Math.PI;
    }
    return formatDecimal(dir,3,0);
};
formatDirection.parameters=[
    {name:'inputRadian',type:'BOOLEAN',default:false}
];

/**
 *
 * @param {Date} curDate
 * @returns {string}
 */
const formatTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "--:--:--";
    let datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};
formatTime.parameters=[]
/**
 *
 * @param {Date} curDate
 * @returns {string} hh:mm
 */
const formatClock=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "--:--";
    let datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0");
    return datestr;
};
formatClock.parameters=[]
/**
 * format date and time
 * @param {Date} curDate
 * @returns {string}
 */
const formatDateTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "----/--/-- --:--:--";
    let datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0)+"/"+
        this.formatDecimal(curDate.getDate(),2,0)+" "+
        this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getSeconds(),2,0).replace(" ","0");
    return datestr;
};
formatDateTime.parameters=[];

const formatDate=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "----/--/--";
    let datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0)+"/"+
        this.formatDecimal(curDate.getDate(),2,0);
    return datestr;
};
formatDate.parameters=[];

const formatString=function(data){
    return data;
};
formatString.parameters=[];
const formatPressure=function(data,opt_unit){
    try {
        if (!opt_unit || opt_unit.toLowerCase() === 'pa') return formatDecimal(data);
        if (opt_unit.toLowerCase() === 'hpa') {
            return (parseFloat(data)/100).toFixed(2)
        }
        if (opt_unit.toLowerCase() === 'bar') {
            return formatDecimal(parseFloat(data)/100000,2,4);
        }
    }catch(e){
        return "-----";
    }
}
formatPressure.parameters=[
    {name:'unit',type:'SELECT',list:['pa','hpa','bar'],default:'pa'}
]

const formatTemperature=function(data,opt_unit){
    try{
        if (! opt_unit || opt_unit.toLowerCase().match(/^k/)){
            return formatDecimal(data,3,1);
        }
        if (opt_unit.toLowerCase().match(/^c/)){
            return formatDecimal(parseFloat(data)-273.15,3,1)
        }
    }catch(e){
        return "-----"
    }
}
formatTemperature.parameters=[
    {name:'unit',type:'SELECT',list:['celsius','kelvin'],default:'kelvin'}
]

export default {
    formatDateTime,
    formatClock,
    formatTime,
    formatDecimalOpt,
    formatDecimal,
    formatLonLats,
    formatLonLatsDecimal,
    formatDistance,
    formatDirection,
    formatSpeed,
    formatString,
    formatDate,
    formatPressure,
    formatTemperature
};