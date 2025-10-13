/**
 * Created by andreas on 04.05.14.
 */

import navcompute from '../nav/navcompute.js';
import Helper from "./helper.js";

function pad(num, size, pad='0') {
    return (''+num).trim().padStart(size,pad);
}

/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
const formatLonLatsDecimal=function(coordinate,axis,format='DDM',hemFirst=false){
    if(coordinate==null) {
      let str="____\u00B0__.___'";
      if(format=='DD') str="____._____\u00B0"; // use _ to prevent line breaks
      if(format=='DMS') str="____\u00B0__'__._\"";
      return hemFirst?'_'+str:str+'_';
    }
    coordinate = Helper.to180(coordinate); // normalize to ±180°
    let deg = Math.abs(coordinate);
    let padding = 2;
    let str = '\u00A0';
    let hem = coordinate < 0 ? "S" :"N";
    if (axis == "lon") {
        padding = 3;
        str = '';
        hem = coordinate < 0 ? "W" :"E";
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
    return hemFirst?hem+str:str+hem;
};

/**
 *
 * @param {Point} lonlat
 * @returns {string}
 */
const formatLonLats=function(lonlat,format='DDM',hemFirst=false){
    if(format=='OLC') {
      if(!lonlat||lonlat.lat==null||lonlat.lon==null) return "________+__";
      return new OpenLocationCode().encode(lonlat.lat,lonlat.lon);
    }
    let lat=this.formatLonLatsDecimal(lonlat?.lat, 'lat', format, hemFirst);
    let lon=this.formatLonLatsDecimal(lonlat?.lon, 'lon', format, hemFirst);
    return lat + ' ' + lon;
};
formatLonLats.parameters=[
    {name:'format',type:'SELECT',list:['DD','DDM','DMS'],default:'DDM'},
    {name:'hemFirst',type:'BOOLEAN',default:false}
];


/**
 * format number with N digits
 * at max N-1 digits after decimal point
 * there are at least N digits and a decimal point at a variable position
 * like the display of a multimeter in auto-range mode
 * bigger numbers: more digits are appended to the right if necessary
 * smaller numbers: up to maxPlaces decimal places are added or they get rounded to zero
 * negative numbers: minus sign is added if necessary
 * @param digits = number of (significant) digits in total, negative: padding space is added for sign
 * @param maxPlaces = max. number of decimal places (after the decimal point, default = digits-1)
 * @param leadingZeroes = use leading zeroes instead of spaces
 * returns string with at least digits(+1 if digits<0) characters
 */
const formatFloat=function(number, digits, maxPlaces, leadingZeroes=false) {
	let signed = digits<0;
  digits = Math.abs(digits);
  if(maxPlaces==null) maxPlaces=digits-1;
  if(isNaN(number)) return '-'.repeat(digits+(signed?1:0)-maxPlaces)+(maxPlaces?'.'+'-'.repeat(maxPlaces):'');
  if(digits==0) return number.toFixed(0);
  if(number<0 && !signed) digits-=1;
  let sign = number<0 ? '-' : signed ? ' ' : '';
  number = Math.abs(number);
  let decPlaces = digits-1-Math.floor(Math.log10(Math.abs(number)));
  decPlaces = Math.max(0,Math.min(decPlaces,Math.max(0,maxPlaces)));
  let str = number.toFixed(decPlaces);
  let n = digits+(str.includes('.')?1:0); // expected length of string w/o sign
  if(leadingZeroes) {
    return sign+'0'.repeat(Math.max(0,n-str.length))+str;  // add sign and padding zeroes
  } else {
    return ' '.repeat(Math.max(0,n-str.length))+sign+str;  // add padding spaces and sign
  }
};
formatFloat.parameters=[
    {name:'digits',type:'NUMBER'},
    {name:'maxPlaces',type:'NUMBER'},
];

/**
 * format a number with a fixed number of fractions
 * @param number
 * @param fix total # digits
 * @param fract # of fractional digits
 * @param addSpace if set - add a padding space for sign
 * @param prefixZero if set - print leading zeroes, not space
 * @returns {string}
 */

const formatDecimal=function(number,fix,fract,addSpace,prefixZero){
    number=parseFloat(number);
    if (isNaN(number)) return '-'.repeat(fix-fract)+(fract?'.'+'-'.repeat(fract):'');
    let sign = addSpace ? ' ' : '';
    if (number < 0) {
        number=-number;
        sign='-';
    }
    let str = number.toFixed(fract); // formatted number w/o sign
    let n = fix+fract+(fract?1:0); // expected length of string w/o sign
    if(prefixZero || fix<0) {
      return sign+'0'.repeat(Math.max(0,n-str.length))+str;  // add sign and padding zeroes
    } else {
      return ' '.repeat(Math.max(0,n-str.length))+sign+str;  // add padding spaces and sign
    }
};
formatDecimal.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'},
    {name: 'prefixZero',type:'BOOLEAN'}
];
const formatDecimalOpt=function(number,fix,fract,addSpace,prefixZero){
    number=parseFloat(number);
    let isint = Math.floor(number) == number;
    return formatDecimal(number,fix,isint?0:fract,addSpace,prefixZero);
};

formatDecimalOpt.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'},
    {name: 'prefixZero',type:'BOOLEAN'}
];

/**
 * format a distance
 * show 99.9 for values < 100, show 999 for values >= 100, max 5
 * @param distance in m
 * @param opt_unit one of nm,m,km
 */
const formatDistance=function(distance,opt_unit){
    let number=parseFloat(distance);
    let factor=navcompute.NM;
    if (opt_unit == 'ft') factor=1/3.280839895; // feet
    if (opt_unit == 'yd') factor=3/3.280839895; // yards
    if (opt_unit == 'm') factor=1;
    if (opt_unit == 'km') factor=1000;
    number/=factor;
    return formatFloat(number,3);
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
    if (opt_unit == 'bft') {
      let v=number*3600/navcompute.NM;
      if(v<=1)  return ' 0';
      if(v<=3)  return ' 1';
      if(v<=6)  return ' 2';
      if(v<=10) return ' 3';
      if(v<=16) return ' 4';
      if(v<=21) return ' 5';
      if(v<=27) return ' 6';
      if(v<=33) return ' 7';
      if(v<=40) return ' 8';
      if(v<=47) return ' 9';
      if(v<=55) return '10';
      if(v<=63) return '11';
      return '12';
    }
    let factor=3600/navcompute.NM;
    if (opt_unit == 'ms' || opt_unit == 'm/s') factor=1;
    if (opt_unit == 'kmh' || opt_unit == 'km/h') factor=3.6;
    number*=factor;
    return formatFloat(number,3,1);
};

formatSpeed.parameters=[
    {name:'unit',type:'SELECT',list:['kn','ms','kmh','bft','m/s','km/h'],default:'kn'}
];

const formatDirection=function(dir,opt_rad,opt_180,opt_lz){
    dir=opt_rad ? Helper.degrees(dir) : dir;
    dir=opt_180 ? Helper.to180(dir) : Helper.to360(dir);
    return formatDecimal(dir,3,0,opt_180,opt_lz);
};
formatDirection.parameters=[
    {name:'inputRadian',type:'BOOLEAN',default:false},
    {name:'range180',type:'BOOLEAN',default:false},
    {name:'leadingZero',type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
];

const formatDirection360=function(dir,opt_lz){
    return formatDecimal(dir,3,0,false,opt_lz);
};
formatDirection360.parameters=[
    {name:'leadingZero',type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
];

/**
 *
 * @param {Date} curDate
 * @returns {string}
 */
const formatTime=function(curDate, seconds=true){
    if (!(curDate instanceof Date)) return "--:--"+(seconds?':--':'');
    return this.formatDecimal(curDate.getHours(),2,0,false,true)+":"+
           this.formatDecimal(curDate.getMinutes(),2,0,false,true)+(seconds?":"+
           this.formatDecimal(curDate.getSeconds(),2,0,false,true):'');
};
formatTime.parameters=[
    {name:'seconds',type:'BOOLEAN',default:true}
];
/**
 *
 * @param {Date} curDate
 * @returns {string} hh:mm
 */
const formatClock=function(curDate){
    if (!(curDate instanceof Date)) return "--:--";
    return this.formatDecimal(curDate.getHours(),2,0,false,true)+":"+
           this.formatDecimal(curDate.getMinutes(),2,0,false,true);
};
formatClock.parameters=[];
/**
 * format date and time
 * @param {Date} curDate
 * @returns {string}
 */
const formatDateTime=function(curDate){
    if (!(curDate instanceof Date)) return "----/--/-- --:--:--";
    return this.formatDecimal(curDate.getFullYear(),4,0,false,true)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0,false,true)+"/"+
        this.formatDecimal(curDate.getDate(),2,0,false,true)+" "+
        this.formatDecimal(curDate.getHours(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getMinutes(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getSeconds(),2,0,false,true);
};
formatDateTime.parameters=[];

const formatDate=function(curDate){
    if (!(curDate instanceof Date)) return "----/--/--";
    return this.formatDecimal(curDate.getFullYear(),4,0,false,true)+"/"+
           this.formatDecimal(curDate.getMonth()+1,2,0,false,true)+"/"+
           this.formatDecimal(curDate.getDate(),2,0,false,true);
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
            return (parseFloat(data)/100).toFixed(2);
        }
        if (opt_unit.toLowerCase() === 'bar') {
            return formatDecimal(parseFloat(data)/100000,2,4,false);
        }
    }catch(e){
        return "---";
    }
}
formatPressure.parameters=[
    {name:'unit',type:'SELECT',list:['pa','hpa','bar'],default:'pa'}
]

const formatTemperature=function(data,opt_unit){
    try{
        if (! opt_unit || opt_unit.toLowerCase().match(/^k/)){
            return formatFloat(data,3,1);
        }
        if (opt_unit.toLowerCase().match(/^c/)){
            return formatFloat(parseFloat(data)-273.15,3,1)
        }
        if (opt_unit.toLowerCase().match(/^f/)){
            return formatFloat(parseFloat(data)*9/5+32,3,1)
        }
    }catch(e){
        return "---"
    }
}
formatTemperature.parameters=[
    {name:'unit',type:'SELECT',list:['celsius','kelvin','fahrenheit'],default:'kelvin'}
]

const skTemperature=formatTemperature;
const skPressure=formatPressure;
export default {
    formatDateTime,
    formatClock,
    formatTime,
    formatDecimalOpt,
    formatDecimal,
    formatFloat,
    formatLonLats,
    formatLonLatsDecimal,
    formatDistance,
    formatDirection,
    formatDirection360,
    formatSpeed,
    formatString,
    formatDate,
    formatPressure,
    formatTemperature,
    skTemperature,
    skPressure
};
