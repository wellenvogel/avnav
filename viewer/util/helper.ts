/**
 * Created by andreas on 04.05.14.

 */

// @ts-ignore
import compare from './compare';
// @ts-ignore
import Version from '../version';
import tinycolor from 'tinycolor2';



export function numericEnumValues<T extends object>(enumObj:T):number[]{
    return Object.values(enumObj).filter(v=>! isNaN(Number(v)));
}
export function stringEnumValues<T extends object>(enumObj:T):string[]{
    return Object.values(enumObj);
}

export type valueof<T> = T[keyof T];
/**
 *
 * @constructor
 */
const Helper=function(){};



Helper.endsWith=function(str:string, suffix:string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

Helper.startsWith=function(str:string, prefix:string) {
    if (! str) return false;
    return (str.indexOf(prefix, 0) === 0);
};

Helper.addEntryToListItem=function(list:any[],keyname:string ,keyvalue:any,key:string,value:any){
  list.forEach(function(item){
      if(item[keyname] === keyvalue){
          item[key]=value;
      }
  })
};

/**
 * helper for shouldComponentUpdate
 * @param oldVals
 * @param newVals
 * @param keyObject
 * @returns {boolean} true if properties differ
 */

Helper.compareProperties=function(oldVals:Record<string, any>,newVals:Record<string, any>,keyObject:Record<string, any>){
    if (! oldVals !== ! newVals) return true;
    for (let k in keyObject){
        if ( ! compare(oldVals[k],newVals[k])) return true;
    }
    return false;
};

Helper.entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;',
    "/": '&#x2F;'
} as Record<string,string>;

Helper.escapeHtml=function(string:any) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return Helper.entityMap[s];
    });
};

Helper.parseXml=function(text:string):Document{
    let xmlDoc=undefined;
    if (window.DOMParser) {
        // code for modern browsers
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(text,"text/xml");
    } else {
        // code for old IE browsers
        // @ts-ignore
        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = false;
        xmlDoc.loadXML(text);
    }
    return xmlDoc;
};


Helper.getExt=(name:string|undefined)=>{
    if (!name) return;
    const rt=name.replace(/.*\./,'').toLocaleLowerCase();
    return rt;
};

Helper.filteredAssign=(...fargs:any[])=>{
    const args = Array.prototype.slice.call(fargs);
    const filter=args.shift();
    const rt:Record<string, any> = {};
    for (const k in args){
        const o=args[k];
        if (! o) continue;
        for (const ok in filter){
            if (ok in o ) rt[ok]=o[ok];
        }
    }
    return rt;
};

Helper.blackListAssign=(...fargs:any[]    )=>{
    const args = Array.prototype.slice.call(fargs);
    const filter=args.shift();
    const rt:Record<string, any> = {};
    for (const k in args){
        const o=args[k];
        if (! o) continue;
        for (const ok in o){
            if (! (ok in filter) ) rt[ok]=o[ok];
        }
    }
    return rt;
};

/**
 * replace any ${name} with the values of the replacement object
 * e.g. templateReplace("test${a} test${zzz}",{a:"Hello",zzz:"World"})
 * will return: "testHello testWorld"
 * @param tstring
 * @param replacements
 * @returns {string}
 */
Helper.templateReplace=function(tstring:string,replacements:Record<string, string>){
    if (typeof(replacements) !== 'object') return tstring;
    for (const k in replacements){
        tstring=tstring.replace("${"+k+"}",replacements[k]);
    }
    return tstring;
};

Helper.keysToStr=(dict:Record<string, any>)=>{
    const rt:Record<string, any> = {};
    for (const k in dict){
        rt[k]=k+"";
    }
    return rt;
};

Helper.getParam=(key:string)=>{
    // Find the key and everything up to the ampersand delimiter
    const value=RegExp("[?&]"+key+"=[^?&]*").exec(window.location.search);

    // Return the unescaped value minus everything starting from the equals sign or an empty string
    return decodeURIComponent(value ? value.toString().replace(/^[^=]+./,"") : "");
};

Helper.to360=(a:number)=>{
    while (a < 0) { a += 360; }
    return a % 360;
};

Helper.to180=(a:number)=>{
    return Helper.to360(a+180)-180;
};

Helper.radians=(a: number)=>{
    return a * Math.PI / 180;
};

Helper.degrees=(a: number)=>{
    return a * 180 / Math.PI;
};

export type HPoint=[number,number];

Helper.toCart=(p:HPoint):HPoint=>{
  return [p[1] * Math.sin(Helper.radians(p[0])),
          p[1] * Math.cos(Helper.radians(p[0]))];
}

Helper.toPol=(c:HPoint)=>{
  return [Helper.to360(90 - Helper.degrees(Math.atan2(c[1], c[0]))),
          Math.sqrt(c[0] * c[0] + c[1] * c[1])];
}

Helper.addPolar=(a:HPoint ,b:HPoint)=>{
  a=Helper.toCart(a);
  b=Helper.toCart(b);
  return Helper.toPol([a[0]+b[0],a[1]+b[1]]);
}
class IdGen{
    private value:number;
    constructor(opt_iv?:number) {
        this.value=opt_iv||0;
    }
    next(){
        this.value++;
        return this.value;
    }
}
Helper.idGen=IdGen;
export const concat=(...args:any[])=>{
    let rt="";
    args.forEach((a)=>{
        if (a !== undefined) rt+=a;
    });
    return rt;
}
export const concatsp=(...args:any[])=>args.filter(i=>i!=null).join(' ');

export const unsetOrTrue=(item:any)=>{
    return !!(item === undefined || item);
}
export const isset=(item:any,opt_empty?:boolean)=>{
    if (item === undefined) return false;
    if (! opt_empty) return true;
    if (item !== '') return true;
    return false;
}
export const now=()=>{
    return (new Date()).getTime();
}
export const iterate=(object: any ,callback:(v:any,key:any)=>void)=>{
    if (object instanceof Array){
        object.forEach((item,index)=>callback(item,index));
        return;
    }
    if (object instanceof Object && object.constructor === Object){
        //just for plain objects
        for (const k in object){
            if (typeof object[k] !== 'function') {
                callback(object[k], k);
            }
        }
        return;
    }
    callback(object,undefined);
}
export const getNameAndExt=(fn:any)=>{
    if (typeof(fn) !== 'string' || ! fn) return [fn+'',''];
    const x=fn.lastIndexOf('.');
    if (x >= 0){
        return [fn.substring(0,x),fn.substring(x+1)]
    }
    return [fn,''];
}
export const injectDateIntoUrl=(oldurl:URL,opt_date?:number)=>{
    let url=oldurl.protocol+"//"+oldurl.host+oldurl.pathname;
    const newTag='_='+encodeURIComponent(opt_date||(new Date).getTime());
    if (oldurl.search){
        let hasReplaced=false;
        let add=oldurl.search.replace(/[?&]_=[^&#]*/,(m)=>{
            hasReplaced=true;
            return m.replace(/_=.*/,newTag);
        })
        if (! hasReplaced){
            add+="&"+newTag;
        }
        url+=add;
    }
    else{
        url+="?"+newTag;
    }
    if (oldurl.hash){
        url+=oldurl.hash;
    }
    return url;
}
export const urlToString=(url:any,opt_base?:string|URL):string=>{
    if (typeof(url)==='string'){
        url= new URL(url,opt_base);
    }
    if (! (url instanceof URL)){return url;}
    if (url.origin === window.location.origin){
        return url.pathname+url.search;
    }
    return url.toString();
}
export const reloadPage=()=>{
    // @ts-ignore
    const url=injectDateIntoUrl(window.location);
    window.location.replace(url);
}
export const isObject = (value:any) => {
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && !(value instanceof RegExp)
        && !(value instanceof Date)
        && !(value instanceof Set)
        && !(value instanceof Map)
}
export const injectav=(obj:any)=>{
    if (obj === undefined){ obj={};}
    if (! isObject(obj)){ throw new Error("expecting an object or undefined for injectav, found "+typeof(obj)+ ": "+obj);}
    if (obj.avnav === undefined){ obj.avnav = {};}
    if (! isObject(obj.avnav)){ throw new Error("injectav: avnav exists, no object: "+typeof(obj.avnav)) ;}
    return obj;
}
export const getav=(obj:any)=>{
    const av=injectav(obj);
    return av.avnav;
}
export const avitem=(obj:any,itemName='item',defaultv={})=>{
    const rt=getav(obj)[itemName];
    if (rt === undefined){ return defaultv;}
    return rt
}
export const setav=(obj:any,avdata:Record<string, any>)=>{
    if (! isObject(avdata)){ throw new Error("setav: expecting an object as data, got "+typeof(avdata)+": "+avdata);}
    const av=injectav(obj);
    av.avnav={...av.avnav,...avdata};
    return av;
}

export const loadJs=(url:string|URL)=>{
    const nUrl=injectDateIntoUrl(new URL(url,window.location.href));
    const fileref=document.createElement('script');
    fileref.setAttribute("type","text/javascript");
    fileref.setAttribute("src", nUrl);
    document.head.appendChild(fileref);
}
const DATA_NAME='data-avnavcssprio';
/**
 * find the latest CSS element with lower or similar priority
 * @param type
 * @param priority
 * @returns [element,before]
 */
const findCss=(priority?:number):[Element,boolean]=>{
    const elements=document.head.querySelectorAll(`[${DATA_NAME}]`);
    const elementsForSort=[];
    for (let i=0; i<elements.length;i++){
        const el=elements[i];
        const prio=el.getAttribute(DATA_NAME);
        if (prio == undefined) continue;
        const nPrio=Number(prio);
        if (isNaN(nPrio)) continue;
        elementsForSort.push({el:el,prio:nPrio});
    }
    if (elementsForSort.length <1){
        return [undefined,false]
    }
    //sort higher prio first (lowest prio at the end)
    elementsForSort.sort((a, b) => b.prio - a.prio);
    //with no prio we insert at the beginning (i.e. least important)
    if (priority == undefined){
        return [elementsForSort[0].el,true];
    }
    for (const se of elementsForSort){
        if (se.prio < priority){
            return [se.el,true]; //before this one
        }
    }
    //we did not find any lower priority - so we inject at the end
    return [elementsForSort[elementsForSort.length-1].el,false];
}
const injectHeadElement=(element:Element,priority?:number)=>{
    const [existing,before]=findCss(priority);
    if (! existing) {
        document.head.appendChild(element);
    }
    else{
        if (before){
            existing.before(element);
        }
        else{
            existing.after(element);
        }
    }
}
export const loadOrUpdateCss=(url?:string|URL,id?:string,priority?:number)=>{
    if (id){
        const existing= document.head.querySelector('#' + id) as HTMLLinkElement;
        if (existing && existing.href){
            if (! url){
                existing.disabled=true;
                return;
            }
            const nUrl=injectDateIntoUrl(new URL(url,window.location.href));
            existing.href=nUrl;
            existing.disabled=false;
            return true;
        }
    }
    if (! url) return false;
    const fileref=document.createElement("link");
    fileref.setAttribute("rel", "stylesheet");
    fileref.setAttribute("type", "text/css");
    const nUrl=injectDateIntoUrl(new URL(url,window.location.href));
    fileref.setAttribute("href", nUrl);
    if (id) fileref.setAttribute("id",id);
    if (priority !== undefined) {
        fileref.setAttribute(DATA_NAME, priority+"");
    }
    injectHeadElement(fileref,priority);
    return true;
}
export const createOrUpdateStyleSheet=(txt:string,id:string,priority?:number)=>{
    if (! id) return;
    const existing=document.head.querySelector('#'+id);
    if (existing){
        existing.innerHTML=txt;
    }
    else{
        const sheet=document.createElement('style');
        sheet.setAttribute("id",id);
        sheet.setAttribute("type","text/css");
        if (priority !== undefined){
            sheet.setAttribute(DATA_NAME, priority+"");
        }
        sheet.innerHTML=txt;
        injectHeadElement(sheet,priority);
    }
}
export const CSSPRIORITIES={
    USER:10,
    LAYOUT: 20,
    PLUGIN: 30,
    ADDON: 40,
    SYSTEM: 50,
}
export const avNavVersion=()=>{
    let version=Version;
    // @ts-ignore
    if (window.avnavAndroid) version=window.avnavAndroid.getVersion();
    return version;
}

export const toBoolean=(obj:any)=>{
    if (obj == undefined) return false;
    if (typeof(obj) == "string") return obj.toLowerCase() === "true";
    return !!obj;
}

export const getColor=(element:HTMLElement,
                       defaultv?:string,
                       omitOpacity?:boolean)=> {
    if (! element) return defaultv;
    const color=window.getComputedStyle(element).color;
    if (omitOpacity) return color;
    const opacity=window.getComputedStyle(element).opacity;
    if (opacity == '') return color;
    const onumber=Number(opacity);
    if (onumber == 1) return color;
    const cv=tinycolor(color);
    const newAlpha=cv.getAlpha()*onumber;
    cv.setAlpha(newAlpha);
    if (newAlpha == 1) return cv.toHexString();
    return cv.toRgbString();
}
Helper.concat=concat;
Helper.concatsp=concatsp;
Helper.unsetorTrue=unsetOrTrue;
Helper.now=now;
Helper.iterate=iterate;
Helper.getNameAndExt=getNameAndExt;
Helper.reloadPage=reloadPage;
Helper.isObject=isObject;
Helper.injectav=injectav;
Helper.avitem=avitem;
Helper.setav=setav;
Helper.isset=isset;
Helper.urlToString=urlToString;
Helper.avNavVersion=avNavVersion;
Helper.toBoolean=toBoolean;
Helper.getColor=getColor;

export default Helper;


export function Index<T>(p: T, k: string) {
    return p[k as keyof T];
}