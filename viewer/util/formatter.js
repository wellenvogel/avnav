/**
 * Created by andreas on 04.05.14.
 */

import navcompute from '../nav/navcompute.js';
import {extendCoordinate} from "ol/extent";
import Helper from "./helper.js";
import {OpenLocationCode} from "open-location-code";

function pad(num, size) {
    var s = '000000' + num;
    return s.substr(s.length-size);
}

/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
const formatLonLatsDecimal=function(coordinate,axis,format='DDM'){
    coordinate = Helper.to180(coordinate); // normalize to ±180°
    var deg = Math.abs(coordinate);
    if (axis == "lon") {
        var padding = 3;
        var str = coordinate < 0 ? "W" :"E";
    } else {
        var padding = 2;
        var str = coordinate < 0 ? "S\u00A0" :"N\u00A0";
    }
    if(format=='DD') {
      str += pad(deg.toFixed(5),padding+6) + "\u00B0";
    } else if(format=='DMS') {
      let DEG = Math.floor(deg);
      let min = 60*(deg-DEG);
      let MIN = Math.floor(min);
      let sec = 60*(min-MIN);
      if (sec.toFixed(1).startsWith('60.')){
          MIN+=1;
          sec=0;
          if(MIN==60){
            MIN=0;
            DEG+=1;
          }
      }
      str += pad(DEG,padding) + "\u00B0" + pad(MIN,2) + "'" + pad(sec.toFixed(1),4) + '"';
    } else {
      let DEG = Math.floor(deg);
      let min = 60*(deg-DEG);
      if (min.toFixed(3).startsWith('60.')){
          DEG+=1;
          min=0;
      }
      str += pad(DEG,padding) + "\u00B0" + pad(min.toFixed(3),6) + "'";
    }
    return str;
};

/**
 *
 * @param {Point} lonlat
 * @returns {string}
 */
const formatLonLats=function(lonlat,format='DDM'){
    if (! lonlat || isNaN(lonlat.lat) || isNaN(lonlat.lon)){
        return "-----";
    }
    if(format=='OLC') {
      return new OpenLocationCode().encode(lonlat.lat,lonlat.lon);
    }
    let lat=this.formatLonLatsDecimal(lonlat.lat, 'lat', format);
    let lon=this.formatLonLatsDecimal(lonlat.lon, 'lon', format);
    return lat + ' ' + lon;
};
formatLonLats.parameters=[
    {name:'format',type:'SELECT',list:['DD','DDM','DMS','OLC'],default:'DDM'}
];

/**
 * format a number with a fixed number of fractions
 * @param number
 * @param fix
 * @param fract
 * @param addSpace if set - add a space for positive numbers
 * @param prefixZero if set - use 0 instead of space to fill the fixed digits
 * @returns {string}
 */

const formatDecimal=function(number,fix,fract,addSpace,prefixZero){
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
    let rt=(prefixZero?"":sign)+number.toFixed(fract);
    let v=10;
    fix-=1;
    while (fix > 0){
        if (number < v){
            if (prefixZero) rt="0"+rt;
            else  rt=" "+rt;
        }
        v=v*10;
        fix-=1;
    }
    return prefixZero?(sign+rt):rt;
};
formatDecimal.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'},
    {name: 'prefixZero',type:'BOOLEAN'}
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
    {name:'fract',type:'NUMBER'},
    {name:'addSpace',type:'BOOLEAN'}
];

/**
 * format a distance
 * show 99.9 for values < 100, show 999 for values >= 100, max 5
 * @param distance in m
 * @param unit: one of nm,m,km
 */
const formatDistance=function(distance,opt_unit){
    let number=parseFloat(distance);
    if (isNaN(number)) return "---";
    let factor=navcompute.NM;
    if (opt_unit == 'ft') factor=1/3.280839895; // feet
    if (opt_unit == 'yd') factor=3/3.280839895; // yards
    if (opt_unit == 'm') factor=1;
    if (opt_unit == 'km') factor=1000;
    number/=factor;
    if (number < 1){
        return formatDecimal(number,3,2);
    }
    if (number < 100){
        return formatDecimal(number,4,1);
    }
    return formatDecimal(number,5,0);
};
formatDistance.parameters=[
    {name:'unit',type:'SELECT',list:['nm','m','km','ft','yd'],default:'nm'}
];

/**
 *
 * @param speed in m/s
 * @param opt_unit one of kn,ms,kmh,bft
 * @returns {*}
 */

const formatSpeed=function(speed,opt_unit){
    let number=parseFloat(speed);
    if (isNaN(number)) return "---";
    if (opt_unit == 'bft') {
      let v=number*3600/navcompute.NM;
      if(v<=1) return '0';
      if(v<=3) return '1';
      if(v<=6) return '2';
      if(v<=10) return '3';
      if(v<=16) return '4';
      if(v<=21) return '5';
      if(v<=27) return '6';
      if(v<=33) return '7';
      if(v<=40) return '8';
      if(v<=47) return '9';
      if(v<=55) return '10';
      if(v<=63) return '11';
      return '12';
    }
    let factor=3600/navcompute.NM;
    if (opt_unit == 'ms' || opt_unit == 'm/s') factor=1;
    if (opt_unit == 'kmh' || opt_unit == 'km/h') factor=3.6;
    number*=factor;
    if (number < 100){
        return formatDecimal(number,2,1);
    }
    return formatDecimal(number,3,0);
};

formatSpeed.parameters=[
    {name:'unit',type:'SELECT',list:['kn','ms','kmh','bft','m/s','km/s'],default:'kn'}
];

const formatDirection=function(dir,opt_rad,opt_180=false){
    dir=opt_rad ? Helper.degrees(dir) : dir;
    dir=opt_180 ? Helper.to180(dir) : Helper.to360(dir);
    return formatDecimal(dir,3,0);
};
formatDirection.parameters=[
    {name:'inputRadian',type:'BOOLEAN',default:false},
    {name:'range180',type:'BOOLEAN',default:false}
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
        this.formatDecimal(curDate.getMonth()+1,2,0,false,true)+"/"+
        this.formatDecimal(curDate.getDate(),2,0,false,true)+" "+
        this.formatDecimal(curDate.getHours(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getMinutes(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getSeconds(),2,0,false,true);
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

const skTemperature=formatTemperature;
const skPressure=formatPressure;
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
    formatTemperature,
    skTemperature,
    skPressure
};
