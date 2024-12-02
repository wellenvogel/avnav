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
    return (str.indexOf(prefix, 0) == 0);
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
    while (a < 360) {
        a += 360;
    }
    return a % 360;
};

Helper.to180=(a)=>{
    return to360(a+180)-180;
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

export default Helper;



