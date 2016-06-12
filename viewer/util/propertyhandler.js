/**
 * Created by andreas on 03.05.14.
 */
avnav.provide('avnav.util.PropertyHandler');
avnav.provide('avnav.util.Property');
avnav.provide('avnav.util.PropertyType');
avnav.provide('avnav.util.PropertyChangeEvent');

/**
 * an event being fired when properties are changed
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @constructor
 */
avnav.util.PropertyChangeEvent=function(propertyHandler){
    /**
     *
     * @type {avnav.util.PropertyHandler}
     */
    this.propertyHandler=propertyHandler;
};
avnav.util.PropertyChangeEvent.EVENT_TYPE="propertyevent";

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
 * @param opt_values either min,max,[step],[decimal] for range or a list of value:label for list
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
    this.extend(this.currentProperties,properties);
    this.userData={};
    var self=this;
};

/**
 * extend object by extend, preserving any object structure
 * @param obj
 * @param extend
 */
avnav.util.PropertyHandler.prototype.extend=function(obj,ext){
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
 * @returns avnav.util.Property
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
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return undefined;
    return descr.path[descr.pname];
};
/**
 * set a property value (and write it to user data)
 * @param value the value
 * @param {avnav.util.Property} descr
 * @returns {boolean}
 */
avnav.util.PropertyHandler.prototype.setValue=function(descr,value){
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return false;
    descr.path[descr.pname]=value;
    return this.setUserDataByDescr(descr,value);
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
    if (descr === undefined || !( descr instanceof avnav.util.Property)) return false;
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
 * save the current settings
 */
avnav.util.PropertyHandler.prototype.saveUserData=function(){
    var raw=JSON.stringify(this.userData);
    localStorage.setItem(this.currentProperties.settingsName,raw);
};


/**
 * load the user data from the cookie
 * this overwrites any current data
 */
avnav.util.PropertyHandler.prototype.loadUserData=function(){
    if (! window.localStorage){
        alert("local storage is not available, seems that your browser is not HTML5... - application will not work");
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
 * update the layout (recompile less)
 */
avnav.util.PropertyHandler.prototype.updateLayout=function(){
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
    $(".avn_smallButton").css('font-size',baseFontSize+"px");
    $('.avn_widgetContainer').css('font-size',this.getValue(this.propertyDescriptions.widgetFontSize)+"px");
};
/**
 * filter out only the allowed user data
 * this filters only one level (for "old style" setUserData)
 * @param data
 * @returns {{}}
 */
avnav.util.PropertyHandler.prototype.filterUserData=function(data){
    var allowed = {};
    for (var key in this.propertyDescriptions) {
        if (data[key]!== undefined)allowed[key] = data[key];
    }
    return allowed;
};

avnav.util.PropertyHandler.prototype.getColor=function(colorName,addNightFade){
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

avnav.util.PropertyHandler.prototype.getAisColor=function(currentObject){
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

avnav.util.PropertyHandler.prototype.hex2rgba=function(hex, opacity)
{
    var patt = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;
    var matches = patt.exec(hex);
    var r = parseInt(matches[1], 16);
    var g = parseInt(matches[2], 16);
    var b = parseInt(matches[3], 16);
    var rgba = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
    return rgba;
};




