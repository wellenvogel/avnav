/**
 * Created by andreas on 03.05.14.
 */
goog.provide('avnav.util.PropertyHandler');
goog.require('goog.object');

//TODO: provide some filters for the user data
/**
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param properties
 * @constructor
 */
avnav.util.PropertyHandler=function(properties){
    this.initialProperties=properties;
    this.currentProperties=goog.object.unsafeClone(properties);
    this.userData={};
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
 * @param data
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


