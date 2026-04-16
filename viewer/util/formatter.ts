/**
 * Created by andreas on 04.05.14.
 */

// @ts-ignore
import navcompute, {DEPTH_UNITS, unitToFactor} from '../nav/navcompute';
import Helper, {stringEnumValues} from "./helper";
import {ParametersWithName} from "../api/api.interface";

export type AxisType='lat'|'lon';
/**
 *
 * @param {number} coordinate
 * @param axis
 * @returns {string}
 */
const formatLonLatsDecimal=function(coordinate:number,axis:AxisType):string{
    coordinate = Helper.to180(coordinate); // normalize to ±180°

    const abscoordinate = Math.abs(coordinate);
    let coordinatedegrees:number = Math.floor(abscoordinate);

    let coordinateminutes = (abscoordinate - coordinatedegrees)/(1/60);
    const numdecimal=2;
    //correctly handle the toFixed(x) - will do math rounding
    if (coordinateminutes.toFixed(numdecimal) == '60'){
        coordinatedegrees+=1;
        coordinateminutes=0;
    }
    let degreesTxt:string=coordinatedegrees+"";
    if( coordinatedegrees < 10 ) {
        degreesTxt = "0" + degreesTxt;
    }
    if (coordinatedegrees < 100 && axis == 'lon'){
        degreesTxt = "0" + degreesTxt;
    }
    let str = degreesTxt + "\u00B0";

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
const formatLonLats:TFormatLonLats=function(lonlat:LonLatPoint):string{
    if (! lonlat || isNaN(lonlat.lat) || isNaN(lonlat.lon)){
        return "-----";
    }
    const ns=this.formatLonLatsDecimal(lonlat.lat, 'lat');
    const ew=this.formatLonLatsDecimal(lonlat.lon, 'lon');
    return ns + ', ' + ew;
};
formatLonLats.parameters=[];

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
const formatDecimal:TFormatDecimal=function(number:number|string,fix:number=0,fract:number=0,addSpace?:boolean,prefixZero?:boolean):string{
    let sign="";
    number=parseFloat(number as unknown as string);
    if (isNaN(number)){
        let rt="";
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

formatDecimalOpt.parameters=[
    {name:'fix',type:'NUMBER'},
    {name: 'fract',type:'NUMBER'},
    {name: 'addSpace',type:'BOOLEAN'},
    {name: 'prefixZero',type:'BOOLEAN'}
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
export type TFormatFloat = FormatterBase &{
    (number:number,digits:number,maxPlaces?:number,leadingZeroes?:boolean):string;
}
const formatFloat:TFormatFloat=function(number, digits, maxPlaces, leadingZeroes=false) {
    if (digits == null) digits=3;
    const signed = digits<0;
    digits = Math.abs(digits);
    if(maxPlaces==null) maxPlaces=digits-1;
    if(isNaN(number)) return '-'.repeat(digits+(signed?1:0)-maxPlaces)+(maxPlaces?'.'+'-'.repeat(maxPlaces):'');
    if(digits==0) return number.toFixed(0);
    if(number<0 && !signed) digits-=1;
    const sign = number<0 ? '-' : signed ? ' ' : '';
    number = Math.abs(number);
    let decPlaces = digits-1-Math.floor(Math.log10(Math.abs(number)));
    decPlaces = Math.max(0,Math.min(decPlaces,Math.max(0,maxPlaces)));
    const str = number.toFixed(decPlaces);
    const n = digits+(str.includes('.')?1:0); // expected length of string w/o sign
    if(leadingZeroes) {
        return sign+'0'.repeat(Math.max(0,n-str.length))+str;  // add sign and padding zeroes
    } else {
        return ' '.repeat(Math.max(0,n-str.length))+sign+str;  // add padding spaces and sign
    }
};
formatFloat.parameters=[
    {name:'digits',type:'NUMBER',default: 3,description:"number of (significant) digits in total, negative: padding space is added for sign"},
    {name:'maxPlaces',type:'NUMBER',default:2,description:"max. number of decimal places (after the decimal point, default = digits-1)"},
    {name: 'leadingZeroes', type: 'BOOLEAN',description: "use leading zeroes instead of spaces"}
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
    const datestr=this.formatDecimal(curDate.getFullYear(),4,0)+"/"+
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
    K='kelvin'
}
export type TFormatTemperature=FormatterBase &{
    (data:number,opt_unit?:TTempUnit):string
}
const formatTemperature:TFormatTemperature=function(data,opt_unit){
    try{
        if (! opt_unit || opt_unit.toLowerCase().match(/^k/)){
            return formatDecimal(data,3,1);
        }
        if (opt_unit.toLowerCase().match(/^c/)){
            return formatDecimal(parseFloat(data as unknown as string)-273.15,3,1)
        }
    }catch(e){
        return "-----"
    }
}
formatTemperature.parameters=[
    {name:'unit',type:'SELECT',list:stringEnumValues(TTempUnit),default:TTempUnit.K},
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
