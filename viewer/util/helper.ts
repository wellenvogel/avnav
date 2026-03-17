/**
 * Created by andreas on 04.05.14.

 */

// @ts-ignore
import compare from './compare';
// @ts-ignore
import Version from '../version';

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

Helper.parseXml=function(text:string){
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
    while (a < 360) {
        a += 360;
    }
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
export const concatsp=(...args:any[])=>{
    let rt="";
    args.forEach((a)=>{
        if (a !== undefined) rt+=" "+a;
    });
    return rt;
}
export const unsetOrTrue=(item:any)=>{
    return !!(item === undefined || item);
}
export const isset=(item:string|undefined|null,opt_empty?:boolean)=>{
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
export const urlToString=(url:any,opt_base?:string|URL)=>{
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
export const loadOrUpdateCss=(url?:string|URL,id?:string)=>{
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
    document.head.appendChild(fileref);
    return true;
}
export const createOrUpdateStyleSheet=(txt:string,id:string)=>{
    if (! id) return;
    const existing=document.head.querySelector('#'+id);
    if (existing){
        existing.innerHTML=txt;
    }
    else{
        const sheet=document.createElement('style');
        sheet.setAttribute("id",id);
        sheet.setAttribute("type","text/css");
        sheet.innerHTML=txt;
        document.head.appendChild(sheet);
    }
}
export const avNavVersion=()=>{
    let version=Version;
    // @ts-ignore
    if (window.avnavAndroid) version=window.avnavAndroid.getVersion();
    return version;
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

export default Helper;



