/**
 * Created by andreas on 03.05.14.
 */
goog.provide('avnav.util.PropertyHandler');
goog.provide('avnav.util.Property');
goog.provide('avnav.util.PropertyType');
goog.require('goog.object');

avnav.util.PropertyType={
    CHECKBOX:0,
    RANGE:1,
    LIST:2,
    COLOR:3
};

/**
 * data holder for property description
 * @param defaultv
 * @param opt_label
 * @param opt_type
 * @param opt_values either min,max,[step] for range or a list of value:label for list
 * @constructor
 */
avnav.util.Property=function(defaultv,opt_label,opt_type,opt_values){
    this.defaultv=defaultv;
    this.label=opt_label;
    this.type=(opt_type !== undefined)?opt_type:avnav.util.PropertyType.RANGE;
    this.values=(opt_values !== undefined)?opt_values:[0,1000]; //assume range 0...1000
    this.path=undefined; //path to object that holds the value
    this.pname=undefined; //the name in the hierarchy, from the underlying level
    this.completeName=undefined; //the complete path
};

/**
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param propertyDescriptions - a hierarchy of avnav.util.Property
 * @param properties - a hierarchy of avnav.util.Property (2 level..)
 *                     only for compatibility, if a description is set, this one wins...
 * @constructor
 */
avnav.util.PropertyHandler=function(propertyDescriptions,properties){
    this.propertyDescriptions=propertyDescriptions;
    this.currentProperties={};
    this.extractProperties(this.currentProperties,"",this.propertyDescriptions);
    goog.object.extend(this.currentProperties,properties);
    this.userData={};
};
/**
 * extract (recursively) the current values of Property descriptions
 * to an object structure (starting at base)
 * call itself recursively
 * @param {{}} base
 * @param {string}path - the path to the object we are extracting (. sep)
 * @param {{}} descriptions
 */
avnav.util.PropertyHandler.prototype.extractProperties=function(base,path,descriptions){
    for (var k in descriptions){
        var d=descriptions[k];
        var curpath=(path == "")?k:path+"."+k;
        if (d instanceof avnav.util.Property){
            base[k]= d.defaultv;
            d.path=base; //set path to value holding object
            d.pname=k;
            d.completeName=curpath;
        }
        else {
            if (d instanceof Object){
                base[k]={};
                this.extractProperties(base[k],curpath,d);
            }
        }
    }
};

/**
 * get a property description
 * @param {string} name - path separated by .
 */
avnav.util.PropertyHandler.prototype.getDescriptionByName=function(name){
    var parr=name.split(".");
    var current=this.propertyDescriptions;
    for (var pidx in parr){
        var current=current[parr[pidx]];
        if (! current) return undefined;
    }
    if (current == this.propertyDescriptions) return undefined;
    return current;
};
/**
 * get the current value of a property
 * @param {avnav.util.Property} descr
 */
avnav.util.PropertyHandler.prototype.getValue=function(descr){
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return undefined;
    return descr.path[descr.pname];
};
/**
 * set a property value (and write it to user data)
 * @param descr the value
 * @param {avnav.util.Property} value
 * @returns {boolean}
 */
avnav.util.PropertyHandler.prototype.setValue=function(descr,value){
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return false;
    descr.path[descr.pname]=value;
    return this.setUserData(descr,value);
};
/**
 * get a property value by its name (separated by .)
 * @param {string} name
 * @returns {*}
 */
avnav.util.PropertyHandler.prototype.getValueByName=function(name){
    var descr=this.getDescriptionByName(name); //ensure that this is really a property
    return this.getValue(descr);
};
/**
 * set a user data value (potentially creating intermediate objects)
 * @param {avnav.util.Property} descr
 * @param {string} value
 * @returns {boolean}
 */
avnav.util.PropertyHandler.prototype.setUserDataByDescr=function(descr,value){
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return false;
    var parr=descr.completeName.split(".");
    var current=this.userData;
    try {
        for (var i = 0; i < (parr.length - 1); i++) {
            var path = parr[i];
            if (current[path] === undefined) {
                current[path] = {}
            }
            current = current[path];
        }
        current[parr[parr.length-1]]=value;
    }catch(e){
        log("Exception when setting user data "+descr.completeName+": "+e);
    }
    return false;
};
/**
 * set a property value given the name
 * @param {string} name
 * @param value
 * @returns {boolean}
 */
avnav.util.PropertyHandler.prototype.setValueByName=function(name,value){
    var descr=this.getDescriptionByName(name); //ensure that this is really a property
    return this.setValue(descr,value);
};


/**
 * get the current active properties
 * @returns {*}
 */
avnav.util.PropertyHandler.prototype.getProperties=function(){
    return this.currentProperties;
};

/**
 * change some user data
 * the data will be save into the cookie
 * TODO: should we change this to the description model?
 * @param data - the complete object tree to be set
 */
avnav.util.PropertyHandler.prototype.setUserData=function(data){
    var filtered=this.filterUserData(data);
    goog.object.extend(this.userData,filtered);
    goog.object.extend(this.currentProperties,filtered);
    $.cookie(this.currentProperties.cookieName,this.userData);
};

/**
 * load the user data from the cookie
 * this overwrites any current data
 */
avnav.util.PropertyHandler.prototype.loadUserData=function(){
    var ndata= $.cookie(this.currentProperties.cookieName);
    if (ndata){
        this.userData=this.filterUserData(ndata);
        goog.object.extend(this.currentProperties,this.userData);
    }
};
/**
 * filter out only the allowed user data
 * @param data
 * @returns {{}}
 */
avnav.util.PropertyHandler.prototype.filterUserData=function(data){
    var allowed = {};
    for (var key in this.allowedUserData) {
        if (data[key])allowed[key] = data[key];
    }
    return allowed;
};

/**
 * contain all allowed user data
 * the values are dont'care
 * only one level...
 * @type {{currentView: null}}
 */
avnav.util.PropertyHandler.prototype.allowedUserData={
    currentView:null,
    marker:null
};


