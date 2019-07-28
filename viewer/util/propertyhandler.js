/**
 * Created by andreas on 03.05.14.
 */

import Properties from './properties.jsx';
import StoreApi from './storeapi.js';
import Base from '../base.js';

/**
 * an event being fired when properties are changed
 * @param {PropertyHandler} propertyHandler
 * @constructor
 */
const PropertyChangeEvent=function(propertyHandler){
    /**
     *
     * @type {PropertyHandler}
     */
    this.propertyHandler=propertyHandler;
};
PropertyChangeEvent.EVENT_TYPE="propertyevent";

//compatibility
avnav.util.PropertyChangeEvent=PropertyChangeEvent;



/**
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param propertyDescriptions - a hierarchy of Property
 * @param properties - a hierarchy of Property (2 level..)
 *                     only for compatibility, if a description is set, this one wins...
 * @constructor
 */
const PropertyHandler=function(propertyDescriptions){
    StoreApi.call(this);
    this.propertyDescriptions=propertyDescriptions;
    this.currentProperties={};
    this.extractProperties(this.currentProperties,"",this.propertyDescriptions);
    this.userData={};
    this.callbacks=[];
};
Base.inherits(PropertyHandler,StoreApi);

/**
 * extend object by extend, preserving any object structure
 * @param obj
 * @param extend
 */
PropertyHandler.prototype.extend=function(obj,ext){
    for (var k in ext){
        if (ext[k] instanceof Object  && ! (ext[k] instanceof Array)){
            if (obj[k] === undefined) obj[k]={};
            this.extend(obj[k],ext[k]);
        }
        else obj[k]=ext[k];
    }
};
/**
 * extract (recursively) the current values of Property descriptions
 * to an object structure (starting at base)
 * call itself recursively
 * @param {{}} base
 * @param {string}path - the path to the object we are extracting (. sep)
 * @param {{}} descriptions
 */
PropertyHandler.prototype.extractProperties=function(base,path,descriptions){
    for (var k in descriptions){
        var d=descriptions[k];
        var curpath=(path == "")?k:path+"."+k;
        if (d instanceof Properties.Property){
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
 * @returns Property
 */
PropertyHandler.prototype.getDescriptionByName=function(name){
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
 * @param {Property} descr
 */
PropertyHandler.prototype.getValue=function(descr){
    if (descr === undefined || !( descr instanceof Properties.Property)) return undefined;
    return descr.path[descr.pname];
};
/**
 * set a property value (and write it to user data)
 * @param value the value
 * @param {Property} descr
 * @returns {boolean}
 */
PropertyHandler.prototype.setValue=function(descr,value){
    if (descr === undefined || !( descr instanceof Properties.Property)) return false;
    descr.path[descr.pname]=value;
    return this.setUserDataByDescr(descr,value);
};
/**
 * get a property value by its name (separated by .)
 * @param {string} name
 * @returns {*}
 */
PropertyHandler.prototype.getValueByName=function(name){
    var descr=this.getDescriptionByName(name); //ensure that this is really a property
    return this.getValue(descr);
};
/**
 * set a user data value (potentially creating intermediate objects)
 * @param {Property} descr
 * @param {string} value
 * @returns {boolean}
 */
PropertyHandler.prototype.setUserDataByDescr=function(descr,value){
    if (descr === undefined || !( descr instanceof Properties.Property)) return false;
    var parr=descr.completeName.split(".");
    var current=this.userData;
    try {
        for (var i = 0; i < (parr.length - 1); i++) {
            var path = parr[i];
            if (current[path] === undefined) {
                if (value == descr.defaultv) return true; //don't set user data when default...
                current[path] = {}
            }
            current = current[path];
        }
        var fname=parr[parr.length -1];
        if (value == descr.defaultv){
            if (current[fname] !== undefined) delete current[fname];
        }
        else {
            current[parr[parr.length - 1]] = value;
        }
        this.callCallbacks([descr.completeName]);
        return true;
    }catch(e){
        avnav.log("Exception when setting user data "+descr.completeName+": "+e);
    }
    return false;
};
/**
 * set a property value given the name
 * @param {string} name
 * @param value
 * @returns {boolean}
 */
PropertyHandler.prototype.setValueByName=function(name,value){
    var descr=this.getDescriptionByName(name); //ensure that this is really a property
    return this.setValue(descr,value);
};


/**
 * get the current active properties
 * @returns {*}
 */
PropertyHandler.prototype.getProperties=function(){
    return this.currentProperties;
};

/**
 * save the current settings
 */
PropertyHandler.prototype.saveUserData=function(){
    var raw=JSON.stringify(this.userData);
    localStorage.setItem(this.currentProperties.settingsName,raw);
};


/**
 * load the user data from the cookie
 * this overwrites any current data
 */
PropertyHandler.prototype.loadUserData=function(){
    if (! window.localStorage){
        avnav.util.overlay.Toast("local storage is not available, seems that your browser is not HTML5... - application will not work");
        return;
    }
    var rawdata=localStorage.getItem(this.currentProperties.settingsName);
    if (! rawdata) return;
    var ndata= JSON.parse(rawdata);
    if (ndata){
        this.userData=this.filterUserData(ndata);
        this.extend(this.currentProperties,this.userData);
    }
    this.updateLayout();

};
/**
 * update the layout
 */
PropertyHandler.prototype.updateLayout=function(){
    var vars=this.propertyDescriptions.style;
    var height=$(window).height();
    //ensure that our buttons fit...
    var numButtons=this.getValue(this.propertyDescriptions.maxButtons);
    var buttonHeight=height/numButtons-8; //TODO: should we get this from CSS?
    var currentButtonHeight=this.getValue(this.propertyDescriptions.style.buttonSize);
    var scale=buttonHeight/currentButtonHeight;
    var nightColorDim=this.getValue(this.propertyDescriptions.nightColorDim);
    if (scale > 1) scale=1;
    if (vars){
        //we rely on exactly one level below style
        for (var k in vars){
            var val=this.getValue(vars[k]);
            if (k == "buttonSize"){
                if (val > buttonHeight) val=Math.ceil(buttonHeight);
                var fontSize=val/4 ; //must match the settings in less
                $(".avn_button").css('font-size',fontSize+"px");
                $(".avn_dialog button").css('font-size',fontSize+"px");
            }
        }
    }
    var nval = this.getValue(this.propertyDescriptions.nightMode);
    if (!nval) {
        $('html').removeClass('nightMode');
        $('body').css('opacity', '1');
    }
    else {
        $('html').addClass('nightMode');
        $('body').css('opacity', this.getValue(this.propertyDescriptions.nightFade)/100)
    }
    //set the font sizes
    var baseFontSize=this.getValue(this.propertyDescriptions.baseFontSize);
    $('body').css('font-size',baseFontSize+"px");
    $('.avn_widgetContainer').css('font-size',this.getValue(this.propertyDescriptions.widgetFontSize)+"px");
};
PropertyHandler.prototype.getButtonFontSize=function(){
    var height=$(window).height();
    var numButtons=this.getValue(this.propertyDescriptions.maxButtons);
    var buttonHeight=height/numButtons-8; //TODO: should we get this from CSS?
    var currentButtonHeight=this.getValue(this.propertyDescriptions.style.buttonSize);
    var scale=buttonHeight/currentButtonHeight;
    var nightColorDim=this.getValue(this.propertyDescriptions.nightColorDim);
    if (scale > 1) scale=1;
    return currentButtonHeight * scale/4;

};
/**
 * filter out only the allowed user data
 * this filters only one level (for "old style" setUserData)
 * @param data
 * @returns {{}}
 */
PropertyHandler.prototype.filterUserData=function(data){
    var allowed = {};
    for (var key in this.propertyDescriptions) {
        if (data[key]!== undefined)allowed[key] = data[key];
    }
    return allowed;
};

PropertyHandler.prototype.getColor=function(colorName,addNightFade){
    var rt=this.getValueByName("style."+colorName);
    if (rt === undefined){
        rt=this.getValueByName(colorName);
    }
    if (rt === undefined) return rt;
    if ((addNightFade === undefined || addNightFade) && this.getValue(this.propertyDescriptions.nightMode)){
        var nf=this.getValue(this.propertyDescriptions.nightColorDim);
        return this.hex2rgba(rt,nf/100);
    }
    return rt;
};

PropertyHandler.prototype.getAisColor=function(currentObject){
    var color="";
    if (currentObject.warning){
        color=this.getColor('aisWarningColor');
    }
    else {
        if (currentObject.tracking) {
            color = this.getColor('aisTrackingColor');
        }
        else {
            if (currentObject.nearest) {
                color = this.getColor('aisNearestColor');
            }
            else {
                color = this.getColor('aisNormalColor');
            }
        }
    }
    return color;
};

PropertyHandler.prototype.hex2rgba=function(hex, opacity)
{
    var patt = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;
    var matches = patt.exec(hex);
    var r = parseInt(matches[1], 16);
    var g = parseInt(matches[2], 16);
    var b = parseInt(matches[3], 16);
    var rgba = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
    return rgba;
};

PropertyHandler.prototype.getDataLocal=function(key,opt_default){
    return this.getValueByName(key)||opt_default;
};

module.exports=new PropertyHandler(Properties.propertyList);



