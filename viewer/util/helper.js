/**
 * Created by andreas on 04.05.14.

 */

import compare from './compare';

/**
 *
 * @constructor
 */
let Helper=function(){};



Helper.endsWith=function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

Helper.startsWith=function(str, prefix) {
    if (! str) return false;
    return (str.indexOf(prefix, 0) === 0);
};

Helper.addEntryToListItem=function(list,keyname,keyvalue,key,value){
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

Helper.compareProperties=function(oldVals,newVals,keyObject){
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
};

Helper.escapeHtml=function(string) {
    return String(string).replace(/[&<>"'\/]/g, function (s) {
        return Helper.entityMap[s];
    });
};

Helper.parseXml=function(text){
    let xmlDoc=undefined;
    if (window.DOMParser) {
        // code for modern browsers
        let parser = new DOMParser();
        xmlDoc = parser.parseFromString(text,"text/xml");
    } else {
        // code for old IE browsers
        xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = false;
        xmlDoc.loadXML(text);
    }
    return xmlDoc;
};


Helper.getExt=(name)=>{
    if (!name) return;
    let rt=name.replace(/.*\./,'').toLocaleLowerCase();
    return rt;
};

Helper.filteredAssign=function(){
    let args = Array.prototype.slice.call(arguments);
    let filter=args.shift();
    let rt={};
    for (let k in args){
        let o=args[k];
        if (! o) continue;
        for (let ok in filter){
            if (ok in o ) rt[ok]=o[ok];
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
Helper.templateReplace=function(tstring,replacements){
    if (typeof(replacements) !== 'object') return tstring;
    for (let k in replacements){
        tstring=tstring.replace("${"+k+"}",replacements[k]);
    }
    return tstring;
};

Helper.keysToStr=(dict)=>{
    let rt={};
    for (let k in dict){
        rt[k]=k+"";
    }
    return rt;
};

Helper.getParam=(key)=>{
    // Find the key and everything up to the ampersand delimiter
    let value=RegExp("[?&]"+key+"=[^?&]*").exec(window.location.search);

    // Return the unescaped value minus everything starting from the equals sign or an empty string
    return decodeURIComponent(!!value ? value.toString().replace(/^[^=]+./,"") : "");
};

Helper.to360=(a)=>{
    while (a < 0) { a += 360; }
    return a % 360;
};

Helper.to180=(a)=>{
    return Helper.to360(a+180)-180;
};

Helper.radians=(a)=>{
    return a * Math.PI / 180;
};

Helper.degrees=(a)=>{
    return a * 180 / Math.PI;
};

Helper.toCart=(p)=>{
  return [p[1] * Math.sin(Helper.radians(p[0])),
          p[1] * Math.cos(Helper.radians(p[0]))];
}

Helper.toPol=(c)=>{
  return [Helper.to360(90 - Helper.degrees(Math.atan2(c[1], c[0]))),
          Math.sqrt(c[0] * c[0] + c[1] * c[1])];
}

Helper.addPolar=(a,b)=>{
  a=Helper.toCart(a);
  b=Helper.toCart(b);
  return Helper.toPol([a[0]+b[0],a[1]+b[1]]);
}
class IdGen{
    constructor(opt_iv) {
        this.value=opt_iv||0;
    }
    next(){
        this.value++;
        return this.value;
    }
}
Helper.idGen=IdGen;
export const concat=(...args)=>{
    let rt="";
    args.forEach((a)=>{
        if (a !== undefined) rt+=a;
    });
    return rt;
}
export const concatsp=(...args)=>args.filter(i=>i!=null).join(' ');
export const unsetOrTrue=(item)=>{
    return !!(item === undefined || item);
}
export const isset=(item,opt_empty)=>{
    if (item === undefined) return false;
    if (! opt_empty) return true;
    if (item !== '') return true;
    return false;
}
export const now=()=>{
    return (new Date()).getTime();
}
export const iterate=(object,callback)=>{
    if (object instanceof Array){
        object.forEach((item,index)=>callback(item,index));
        return;
    }
    if (object instanceof Object && object.constructor === Object){
        //just for plain objects
        for (let k in object){
            if (typeof object[k] !== 'function') {
                callback(object[k], k);
            }
        }
        return;
    }
    callback(object);
}
export const getNameAndExt=(fn)=>{
    if (typeof(fn) !== 'string' || ! fn) return [fn+'',''];
    const x=fn.lastIndexOf('.');
    if (x >= 0){
        return [fn.substring(0,x),fn.substring(x+1)]
    }
    return [fn,''];
}
const injectDateIntoUrl=(oldurl)=>{
    let url=oldurl.protocol+"//"+oldurl.host+oldurl.pathname;
    const newTag='_='+encodeURIComponent((new Date).getTime());
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
export const reloadPage=()=>{
    let url=injectDateIntoUrl(window.location);
    window.location.replace(url);
}
export const isObject = (value) => {
    return typeof value === 'object'
        && value !== null
        && !Array.isArray(value)
        && !(value instanceof RegExp)
        && !(value instanceof Date)
        && !(value instanceof Set)
        && !(value instanceof Map)
}
export const injectav=(obj)=>{
    if (obj === undefined){ obj={};}
    if (! isObject(obj)){ throw new Error("expecting an object or undefined for injectav, found "+typeof(obj)+ ": "+obj);}
    if (obj.avnav === undefined){ obj.avnav = {};}
    if (! isObject(obj.avnav)){ throw new Error("injectav: avnav exists, no object: "+typeof(obj.avnav)) ;}
    return obj;
}
export const avitem=(obj,itemName='item',defaultv={})=>{
    const rt=injectav(obj).avnav[itemName];
    if (rt === undefined){ return defaultv;}
    return rt
}
export const setav=(obj,avdata)=>{
    if (! isObject(avdata)){ throw new Error("setav: expecting an object as data, got "+typeof(avdata)+": "+avdata);}
    const av=injectav(obj);
    av.avnav={...av.avnav,...avdata};
    return av;
}

export const loadJs=(url)=>{
    let nUrl=injectDateIntoUrl(new URL(url,window.location.href));
    const fileref=document.createElement('script');
    fileref.setAttribute("type","text/javascript");
    fileref.setAttribute("src", nUrl);
    document.head.appendChild(fileref);
}
export const loadOrUpdateCss=(url,id)=>{
    if (id){
        let existing=document.head.querySelector('#'+id);
        if (existing && existing.href){
            let nUrl=injectDateIntoUrl(new URL(url?url:existing.href,window.location.href));
            existing.href=nUrl;
            return true;
        }
    }
    if (! url) return false;
    let fileref=document.createElement("link");
    fileref.setAttribute("rel", "stylesheet");
    fileref.setAttribute("type", "text/css");
    let nUrl=injectDateIntoUrl(new URL(url,window.location.href));
    fileref.setAttribute("href", nUrl);
    if (id) fileref.setAttribute("id",id);
    document.head.appendChild(fileref);
    return true;
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

export default Helper;



