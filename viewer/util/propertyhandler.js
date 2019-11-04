/**
 * Created by andreas on 03.05.14.
 */

import Properties from './properties.jsx';
import Toast from './overlay.js';
import globalStore from './globalstore.jsx';
import keys from './keys.jsx';

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

const applyLayoutLegacy=(nightMode,nightFade,baseFontSize,widgetFontSize,buttonFontSize)=>{
    if (!nightMode) {
        $('#old_pages').removeClass('nightMode');
        $('#old_pages').css('opacity', '1');
    }
    else {
        $('#old_pages').addClass('nightMode');
        $('#old_pages').css('opacity', nightFade / 100)
    }
    $(".avn_button").css('font-size', buttonFontSize + "px");
    $(".avn_dialog button").css('font-size', buttonFontSize + "px");
    $('body').css('font-size', baseFontSize + "px");
    $('.avn_widgetContainer').css('font-size', widgetFontSize + "px");
};

const hex2rgba= (hex, opacity)=> {
    let patt = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;
    let matches = patt.exec(hex);
    let r = parseInt(matches[1], 16);
    let g = parseInt(matches[2], 16);
    let b = parseInt(matches[3], 16);
    let rgba = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
    return rgba;
};

/**
 * extend object by extend, preserving any object structure
 * @param obj
 * @param ext
 */
const extend=(obj, ext)=> {
    for (let k in ext) {
        if (ext[k] instanceof Object && !(ext[k] instanceof Array)) {
            if (obj[k] === undefined) obj[k] = {};
            extend(obj[k], ext[k]);
        }
        else obj[k] = ext[k];
    }
};


/**
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param propertyDescriptions - a hierarchy of Property
 * @param properties - a hierarchy of Property (2 level..)
 *                     only for compatibility, if a description is set, this one wins...
 * @constructor
 */
class PropertyHandler {
    constructor(propertyDescriptions) {
        this.propertyDescriptions = propertyDescriptions;
        this.currentProperties = {};
        this.extractProperties(this.currentProperties, "", this.propertyDescriptions);
        this.userData = {};
        //a fast access to the properties that we sync with the store
        this.storeProperties=undefined;
        this.extractProperties=this.extractProperties.bind(this);
        this.getDescriptionByName=this.getDescriptionByName.bind(this);
        this.setValue=this.setValue.bind(this);
        this.getValueByName=this.getValueByName.bind(this);
        this.setUserDataByDescr=this.setUserDataByDescr.bind(this);
        this.setValueByName=this.setValueByName.bind(this);
        this.getProperties=this.getProperties.bind(this);
        this.saveUserData=this.saveUserData.bind(this);
        this.initialize=this.initialize.bind(this);
        this.updateLayout=this.updateLayout.bind(this);
        this.getButtonFontSize=this.getButtonFontSize.bind(this);
        this.filterUserData=this.filterUserData.bind(this);
        this.getColor=this.getColor.bind(this);
        this.getAisColor=this.getAisColor.bind(this);
        this.incrementSequence=this.incrementSequence.bind(this);
        this.dataChanged=this.dataChanged.bind(this);
        this.getValue=this.getValue.bind(this);
    }

    incrementSequence(){
        globalStore.storeData(keys.gui.global.propertySequence,
            globalStore.getData(keys.gui.global.propertySequence,0),
            this
        );
    }


    /**
     * extract (recursively) the current values of Property descriptions
     * to an object structure (starting at base)
     * call itself recursively
     * @param {{}} base
     * @param {string}path - the path to the object we are extracting (. sep)
     * @param {{}} descriptions
     */
    extractProperties(base, path, descriptions) {
        for (let k in descriptions) {
            let d = descriptions[k];
            let curpath = (path == "") ? k : path + "." + k;
            if (d instanceof Properties.Property) {
                base[k] = d.defaultv;
                d.path = base; //set path to value holding object
                d.pname = k;
                d.completeName = curpath;
            }
            else {
                if (d instanceof Object) {
                    base[k] = {};
                    this.extractProperties(base[k], curpath, d);
                }
            }
        }
    }

    /**
     * get a property description
     * @param {string} name - path separated by .
     * @returns Property
     */
    getDescriptionByName(name) {
        let parr = name.split(".");
        let current = this.propertyDescriptions;
        for (let pidx in parr) {
            current = current[parr[pidx]];
            if (!current) return undefined;
        }
        if (current == this.propertyDescriptions) return undefined;
        return current;
    }

    

    /**
     * set a property value (and write it to user data)
     * @param value the value
     * @param {Property} descr
     * @returns {boolean}
     */
    setValue(descr, value,opt_omitStore) {
        if (descr === undefined || !( descr instanceof Properties.Property)) return false;
        descr.path[descr.pname] = value;
        return this.setUserDataByDescr(descr, value,opt_omitStore);
    }

    /**
     * get the current value of a property
     * @param {Property} descr
     */
    getValue(descr){
        if (descr === undefined || !( descr instanceof Properties.Property)) return undefined;
        return descr.path[descr.pname];
    }


    /**
     * get a property value by its name (separated by .)
     * @param {string} name
     * @returns {*}
     */
    getValueByName(name) {
        let descr = this.getDescriptionByName(name); //ensure that this is really a property
        return this.getValue(descr);
    }

;
    /**
     * set a user data value (potentially creating intermediate objects)
     * @param {Property} descr
     * @param {string} value
     * @returns {boolean}
     */
    setUserDataByDescr(descr, value,opt_omitStore) {
        if (descr === undefined || !( descr instanceof Properties.Property)) return false;
        let parr = descr.completeName.split(".");
        let current = this.userData;
        try {
            for (let i = 0; i < (parr.length - 1); i++) {
                let path = parr[i];
                if (current[path] === undefined) {
                    if (value == descr.defaultv) return true; //don't set user data when default...
                    current[path] = {}
                }
                current = current[path];
            }
            let fname = parr[parr.length - 1];
            if (value == descr.defaultv) {
                if (current[fname] !== undefined) delete current[fname];
            }
            else {
                current[parr[parr.length - 1]] = value;
            }
            if (! opt_omitStore ){
                let storeKey=keys.properties[descr.completeName];
                if (storeKey){
                    globalStore.storeData(storeKey,value,this);
                }
            }
            return true;
        } catch (e) {
            avnav.log("Exception when setting user data " + descr.completeName + ": " + e);
        }
        return false;
    }

    /**
     * set a property value given the name
     * @param {string} name
     * @param value
     * @returns {boolean}
     */
    setValueByName(name, value) {
        let descr = this.getDescriptionByName(name); //ensure that this is really a property
        return this.setValue(descr, value);
    }


    /**
     * get the current active properties
     * @returns {*}
     */
    getProperties() {
        return this.currentProperties;
    }

    /**
     * save the current settings
     */
    saveUserData() {
        let raw = JSON.stringify(this.userData);
        localStorage.setItem(this.currentProperties.settingsName, raw);
    }


    /**
     * load the user data from the cookie
     * this overwrites any current data
     */
    initialize() {
        //register at the store for updates of our synced data
        globalStore.register(this,keys.properties);
        //keep a hash of the descriptions of the synced props for fast access
        this.storeProperties={};
        for (let propKey in keys.properties){
            this.storeProperties[propKey]=this.getDescriptionByName(propKey);
        }
        if (!window.localStorage) {
            Toast.Toast("local storage is not available, seems that your browser is not HTML5... - application will not work");
            return;
        }
        let rawdata = localStorage.getItem(this.currentProperties.settingsName);
        if (!rawdata) return;
        let ndata = JSON.parse(rawdata);
        if (ndata) {
            this.userData = this.filterUserData(ndata);
            extend(this.currentProperties, this.userData);
        }
        //fill initial data into the store
        let storeData={};
        for (let propKey in keys.properties){
            let descr=this.storeProperties[propKey];
            if (! descr) continue;
            storeData[propKey]=this.getValue(descr);
        }
        globalStore.storeMultiple(storeData,keys.properties,this);
        this.updateLayout();

    }

    dataChanged(){
        if (! this.storeProperties) return; //not initialized yet
        let hasChanges=false;
        let values=globalStore.getMultiple(keys.properties);
        for (let propKey in values){
            let description=this.storeProperties[propKey];
            if (! description) continue;
            if (values[propKey] != this.getValue(description)){
                this.setValue(description,values[propKey],true);
                hasChanges=true;
            }
        }
        if (hasChanges){
            this.saveUserData();
            this.updateLayout();
        }
    }

    /**
     * update the layout
     */
    updateLayout() {
        applyLayoutLegacy(
            this.getValue(this.propertyDescriptions.nightMode),
            this.getValue(this.propertyDescriptions.nightFade),
            this.getValue(this.propertyDescriptions.baseFontSize),
            this.getButtonFontSize()
        );
        this.incrementSequence();
    }

    getButtonFontSize() {
        let numButtons = this.getValue(this.propertyDescriptions.maxButtons);
        let currentButtonHeight = this.getValue(this.propertyDescriptions.style.buttonSize);
        let scale=1;
        let height = window.innerHeight;
        if (height !== undefined) {
            let buttonHeight = height / numButtons - 8; //TODO: should we get this from CSS?
            scale = buttonHeight / currentButtonHeight;
        }
        if (scale > 1) scale = 1;
        return currentButtonHeight * scale / 4;
    }

    /**
     * filter out only the allowed user data
     * this filters only one level (for "old style" setUserData)
     * @param data
     * @returns {{}}
     */
    filterUserData(data) {
        let allowed = {};
        for (let key in this.propertyDescriptions) {
            if (data[key] !== undefined)allowed[key] = data[key];
        }
        return allowed;
    }

    getColor(colorName, addNightFade) {
        let rt = this.getValueByName("style." + colorName);
        if (rt === undefined) {
            rt = this.getValueByName(colorName);
        }
        if (rt === undefined) return rt;
        if ((addNightFade === undefined || addNightFade) && this.getValue(this.propertyDescriptions.nightMode)) {
            let nf = this.getValue(this.propertyDescriptions.nightColorDim);
            return hex2rgba(rt, nf / 100);
        }
        return rt;
    }

;

    getAisColor(currentObject) {
        let color = "";
        if (currentObject.warning) {
            color = this.getColor('aisWarningColor');
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
    }

}

module.exports=new PropertyHandler(Properties.propertyList);



