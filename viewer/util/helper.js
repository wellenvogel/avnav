/**
 * Created by andreas on 04.05.14.

 */

import compare from './shallowcompare';
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

/**
 * filter out some tree of objects
 * @param source
 * @param filterFunction will be called with the current leaf from source and a
 *        path being constructed of hierarchies concat by .
 * @param opt_basepath to be prepended to the path
 * @returns {undefined}
 */
Helper.filterObjectTree=function(source,filterFunction,opt_basepath){
    let rt=undefined;
    let path=opt_basepath;
    for (let k in source) {
        let currentPath=path!==undefined?path+"."+k:k;
        if (typeof(source[k]) === 'object') {
            let sub=Helper.filterObjectTree(source[k],filterFunction,currentPath);
            if (sub !== undefined) {
                if (rt === undefined) rt={};
                rt[k]=sub;
            }
        }
        else {
            if (filterFunction(source[k], currentPath)) {
                if (rt === undefined) rt = {};
                rt[k] = source[k];
            }
        }
    }
    return rt;
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




export default Helper;



