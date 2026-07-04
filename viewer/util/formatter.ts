/**
 * Created by andreas on 04.05.14.
 */

// @ts-ignore
import navcompute, { unitToFactor} from '../nav/navcompute';
import Helper, {stringEnumValues} from "./helper";
import {ParametersWithName} from "../api/api.interface";

export type AxisType='lat'|'lon';
export type CoordinateFormat='DDM'|'DD'|'DMS';

function pad(num:number|string, size:number, pad:string='0') {
    return (''+num).trim().padStart(size,pad);
}
/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
const formatLonLatsDecimal=function(coordinate:number,axis:AxisType,format:CoordinateFormat='DDM',hemFirst:boolean=false){
    if(coordinate==null) {
      let str="____\u00B0__.___'";
      if(format=='DD') str="____._____\u00B0"; // use _ to prevent line breaks
      if(format=='DMS') str="____\u00B0__'__._\"";
      return hemFirst?'_'+str:str+'_';
    }
    coordinate = Helper.to180(coordinate); // normalize to ±180°
    const deg = Math.abs(coordinate);
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
      const min = 60*(deg-DEG);
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

export interface LonLatPoint{
    lon:number;
    lat:number;
}
/**
 *
 * @param {Point} lonlat
 * @returns {string}
 */
export interface FormatterBase{
    parameters?:ParametersWithName[]
}
export type TFormatLonLats = FormatterBase & {
    (lonlat:LonLatPoint):string
}
const formatLonLats:TFormatLonLats=function(lonlat:LonLatPoint,format:CoordinateFormat='DDM',hemFirst:boolean=false):string{
    const ns=this.formatLonLatsDecimal(lonlat?.lat, 'lat',format,hemFirst);
    const ew=this.formatLonLatsDecimal(lonlat?.lon, 'lon',format,hemFirst);
    return ns + ' ' + ew;
};
formatLonLats.parameters=[
    {name:'format',type:'SELECT',list:['DD','DDM','DMS'],
        default:'DDM',
        description: 'Format of the position display\nDDM: 54°10,85N\nDMS: 54°10\'40.1N\nDD: 54,17°N'
    },
    {name:'hemFirst',type:'BOOLEAN',
        default:false,
        description: 'Write the hemisphere (N/S/E/W) in front of the position',
    }
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
export type TFormatDecimal=FormatterBase & {
    (number:number|string,fix?:number,fract?:number,addSpace?:boolean,prefixZero?:boolean):string
}
const formatDecimal:TFormatDecimal=function(number:number|string,fix?:number,fract?:number,addSpace?:boolean,prefixZero?:boolean){
    number=Number(number);
    if (!isFinite(number)) return '-'.repeat(fix)+(fract?'.'+'-'.repeat(fract):'');
    let sign = addSpace ? ' ' : '';
    if (number < 0) { number=-number; sign='-'; }
    const str = number.toFixed(fract); // formatted number w/o sign
    const n = fix+fract+(fract?1:0); // expected length of string w/o sign
    if(prefixZero || fix<0) {
        return sign+'0'.repeat(Math.max(0,n-str.length))+str;  // add sign and padding zeroes
    } else {
        return ' '.repeat(Math.max(0,n-str.length))+sign+str;  // add padding spaces and sign
    }
};
const decimalFormatterParameters:ParametersWithName[]=[
    {name:'fix',type:'NUMBER',description:'number of integer digits (before .)'},
    {name:'fract',type:'NUMBER',description:'number of fractional digits (after .)'},
    {name:'addSpace',type:'BOOLEAN',description:'add single padding space for sign'},
    {name:'prefixZero',type:'BOOLEAN',description:'add leading zeroes'}
];
formatDecimal.parameters=decimalFormatterParameters;
export type TFormatDecimalOpt= FormatterBase & {
    (number:number|string,fix:number,fract:number,addSpace?:boolean,prefixZero?:boolean):string;
}
const formatDecimalOpt:TFormatDecimalOpt=function(number:number|string,fix:number,fract:number,addSpace?:boolean,prefixZero?:boolean):string{
    number=parseFloat(number as unknown as string);
    if (isNaN(number)) return formatDecimal(number,fix,fract,addSpace,prefixZero);
    if (Math.floor(number) == number){
        return formatDecimal(number,fix,0,addSpace,prefixZero);
    }
    return formatDecimal(number,fix,fract,addSpace,prefixZero);
};
formatDecimalOpt.parameters=decimalFormatterParameters;

// clamp x to a<=x<=b
function clamp(a:number,x:number,b:number) {
  return Math.max(a,Math.min(x,b));
}

/**
 * format number with N significant digits
 * naming: the number 12.345 has 5 TOTAL digits, 2 INTEGER digits, 3 FRACTIONAL digits
 * at max N-1 digits after decimal point
 * there are at least N total digits and the decimal point at a variable position and and optional sign
 * it's like the display of a multimeter in auto-range mode
 * bigger numbers: more integer digits are appended to the left if necessary, fractional digits are removed
 * smaller numbers: up to maxFrac fractional digits are added (can get rounded to zero)
 * negative numbers: minus sign is added if necessary
 * @param digits = number of total digits, negative: single padding space is added for sign
 * @param maxFrac = max. number of fractional digits (default = digits-1), negative: fixed value of fractional digits
 * @param leadingZeroes = use leading zeroes instead of spaces
 * returns string with at least digits (+1 if digits<0) (+1 if maxFrac!=0) characters
 */
export type TFormatFloat = FormatterBase &{
    (number:number,digits:number,maxPlaces?:number,leadingZeroes?:boolean):string;
}
const formatFloat:TFormatFloat=function(number, digits, maxFrac, leadingZeroes=false) {
    if (!digits) digits=3;
    const signed = digits<0;
    digits = Math.abs(digits);
    if(maxFrac==null) maxFrac=digits-1;
    maxFrac=clamp(0,maxFrac,digits-1);
    number=Number(number); // null-->NaN
    if(!isFinite(number)) return '-'.repeat(digits+(signed?1:0)-maxFrac)+(maxFrac?'.'+'-'.repeat(maxFrac):'');
    if(digits==0) return number.toFixed(0);
    if(number<0 && !signed) digits-=1; // make room for unexpected sign
    const sign = number<0 ? '-' : signed ? ' ' : '';
    number = Math.abs(number);
    let decPlaces = digits-1-Math.floor(Math.log10(number));
    decPlaces = clamp(0,decPlaces,maxFrac);
    const str = number.toFixed(decPlaces);
    const n = digits+(str.includes('.')?1:0); // expected length of string w/o sign
    if(leadingZeroes) {
        return sign+'0'.repeat(Math.max(0,n-str.length))+str;  // -001.23
    } else {
        return ' '.repeat(Math.max(0,n-str.length))+sign+str;  // __-1.23
    }
};
formatFloat.parameters=[
    {name:'digits',type:'NUMBER',default:3,description:"number of (significant) digits in total, negative: padding space is added for sign"},
    {name:'maxFrac',type:'NUMBER',default:2,list:[0,20],description:"max. number of decimal places (after the decimal point, default = digits-1)"},
    {name:'leadingZeroes',type:'BOOLEAN',description: "use leading zeroes instead of spaces"}
];
/**
 * format a distance
 * show 99.9 for values < 100, show 999 for values >= 100, max 5
 * @param distance in m
 * @param opt_unit one of nm,m,km
 * @param opt_fixed if > 0 set this much digits at min
 * @param opt_fillRight if set - extend the fractional part
 */
enum TDEPTH_UNITS {
    NM = 'nm',
    M='m',
    KM= 'km',
    FT='ft',
    YD='yd'
}
type TFormatDistance=FormatterBase &{
    (distance:number,opt_unit?:TDEPTH_UNITS,opt_fixed?:number,opt_fillRight?:boolean):string
}
const formatDistance:TFormatDistance=function(distance,opt_unit,opt_fixed,opt_fillRight){
    let number=parseFloat(distance as unknown as string);
    if (isNaN(number)) return "    -"; //4 spaces
    const factor=unitToFactor(opt_unit||TDEPTH_UNITS.NM);
    number=number/factor;
    let fract=0;
    let fixed=undefined;
    if (number < 1) {
        fract = 2;
        fixed = 1;
    }
    else if (number < 10){
        fract=1;
        fixed=1;
    }
    else if (number < 100){
        fract=1;
        fixed=2;
    }
    else{
        fixed=1+Math.floor(Math.log10(Math.abs(number)));
    }
    if (opt_fixed == null || opt_fixed < (fixed+fract)){
        fixed=undefined;
    }
    if (fixed != null){
        if (opt_fillRight){
            fract+=opt_fixed-(fixed+fract);
        }
        else{
            fixed+=opt_fixed-(fixed+fract);
        }
    }
    return formatDecimal(number,fixed,fract,false,true);
};
formatDistance.parameters=[
    {name:'unit',type:'SELECT',list:stringEnumValues(TDEPTH_UNITS),default:'nm'},
    {name:'numDigits', type: 'NUMBER',default: 0, description:'Always show at least this number of digits. Leave at 0 to have this flexible.'},
    {name:'fillRight', type: 'BOOLEAN',default: false, description:'let the fractional part extend to have the requested number of digits (only if numDigits > 0)'}
];

/**
 *
 * @param speed in m/s
 * @param opt_unit one of kn,ms,kmh
 * @returns {*}
 */
export enum TSPEED_UNITS{
    KN='kn',
    MS='ms',
    KMH='kmh'
}
export type TFormatSpeed=FormatterBase &{
    (speed:number,opt_unit?:TSPEED_UNITS):string
}
const formatSpeed:TFormatSpeed=function(speed,opt_unit){
    let number=parseFloat(speed as unknown as string);
    if (isNaN(number)) return "  -"; //2 spaces
    let factor=3600/navcompute.NM;
    if (opt_unit == TSPEED_UNITS.MS) factor=1;
    if (opt_unit == TSPEED_UNITS.KMH) factor=3.6;
    number=number*factor;
    if (number < 100){
        return formatDecimal(number,undefined,1,false);
    }
    return formatDecimal(number,undefined,0,false);
};

formatSpeed.parameters=[
    {name:'unit',type:'SELECT',list:stringEnumValues(TSPEED_UNITS),default:TSPEED_UNITS.KN}
];

export type TFormatDirection=FormatterBase &{
    (dir:number,opt_rad?:boolean,opt_180?:boolean,opt_lz?:boolean):string
}
const formatDirection:TFormatDirection=function(dir,opt_rad,opt_180,opt_lz){
    dir=opt_rad ? Helper.degrees(dir) : dir;
    dir=opt_180 ? Helper.to180(dir) : Helper.to360(dir);
    return formatDecimal(dir,3,0,(!!opt_lz && !!opt_180),!!opt_lz);
};
formatDirection.parameters=[
    {name:'inputRadian',type:'BOOLEAN',default:false},
    {name:'range180',type:'BOOLEAN',default:false},
    {name:'leadingZero',type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
];
export type TFormatDirection360 = FormatterBase &{
    (dir:number,opt_lz?:boolean):string
}
const formatDirection360=function(dir:number,opt_lz?:boolean):string{
    return formatDecimal(dir,3,0,false,!!opt_lz);
};
formatDirection360.parameters=[
    {name:'leadingZero',type:'BOOLEAN',default: false,description:'show leading zeroes (012)'}
];

/**
 *
 * @param {Date} curDate
 * @returns {string}
 */
export type TFormatTime=FormatterBase &{
    (curDate:Date):string
}
const formatTime:TFormatTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "--:--:--";
    const datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
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
const formatClock:TFormatTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "--:--";
    const datestr=this.formatDecimal(curDate.getHours(),2,0).replace(" ","0")+":"+
        this.formatDecimal(curDate.getMinutes(),2,0).replace(" ","0");
    return datestr;
};
formatClock.parameters=[]
/**
 * format date and time
 * @param {Date} curDate
 * @returns {string}
 */
const formatDateTime:TFormatTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "----/--/-- --:--:--";
    const datestr=this.formatDecimal(curDate.getFullYear(),4,0,false,true)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0,false,true)+"/"+
        this.formatDecimal(curDate.getDate(),2,0,false,true)+" "+
        this.formatDecimal(curDate.getHours(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getMinutes(),2,0,false,true)+":"+
        this.formatDecimal(curDate.getSeconds(),2,0,false,true);
    return datestr;
};
formatDateTime.parameters=[];

const formatDate:TFormatTime=function(curDate){
    if (! curDate || ! (curDate instanceof Date)) return "----/--/--";
    const datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
        this.formatDecimal(curDate.getMonth()+1,2,0)+"/"+
        this.formatDecimal(curDate.getDate(),2,0);
    return datestr;
};
formatDate.parameters=[];

export type TFormatTimeDiff=FormatterBase &{
    (tdiff:number):string;  //tdiff in seconds
}
const formatTimeDiff:TFormatTimeDiff=function (tdiff:number):string{
    const invalid= "--:--:--";
    if (tdiff == null) return invalid;
    if (isNaN(tdiff)) tdiff=Number(tdiff);
    if (isNaN(tdiff)) return invalid;
    const hrs=Math.floor(tdiff/3600);
    const min=Math.floor((tdiff-3600*hrs)/60);
    const sec=Math.floor((tdiff-3600*hrs-60*min));
    return formatDecimal(hrs,2,0,false,true)+":"+formatDecimal(min,2,0,false,true)+":"+formatDecimal(sec,2,0,false,true);
}
export type TFormatString = FormatterBase &{
    (data:string):string
}
const formatString:TFormatString=function(data){
    return data;
};
formatString.parameters=[];
export enum TPressure{
    PA='pa',
    HPA='hpa',
    BAR='bar'
}
export type TFormatPressure=FormatterBase & {
    (data:number,opt_unit?:TPressure):string
}
const formatPressure:TFormatPressure=function(data,opt_unit){
    try {
        if (!opt_unit || opt_unit.toLowerCase() === TPressure.PA) return formatDecimal(data);
        if (opt_unit.toLowerCase() === TPressure.HPA) {
            return (parseFloat(data as unknown as string)/100).toFixed(2)
        }
        if (opt_unit.toLowerCase() === TPressure.BAR) {
            return formatDecimal(parseFloat(data as unknown as string)/100000,2,4,false);
        }
    }catch(e){
        return "-----";
    }
}
formatPressure.parameters=[
    {name:'unit',type:'SELECT',list: stringEnumValues(TPressure),default:TPressure.PA},
]
export enum TTempUnit{
    C='celsius',
    K='kelvin',
    F='fahrenheit'
}
export type TFormatTemperature=FormatterBase &{
    (data:number,opt_unit?:TTempUnit,fract?:number):string
}
const KELVIN=273.15;
const formatTemperature:TFormatTemperature=function(data,opt_unit?,fract=1){
    const value=Number(data);
    const defv='-----';
    if (isNaN(value)) return defv;
    try{
        if (! opt_unit || opt_unit.toLowerCase().match(/^k/)){
            return formatDecimal(value,3,fract);
        }
        if (opt_unit.toLowerCase().match(/^c/)){
            return formatDecimal(value-KELVIN,3,fract)
        }
        if (opt_unit.toLowerCase().match(/^f/)){
            return formatDecimal((value-KELVIN)*9/5+32,3,fract)
        }
    }catch(e){
        return defv;
    }
}
formatTemperature.parameters=[
    {name:'unit',type:'SELECT',list:stringEnumValues(TTempUnit),default:TTempUnit.K},
    {name:'fract',type:'NUMBER',list:[0,4],default:1,description:'number of fractional digits'},
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
    skPressure,
    formatTimeDiff
};
