/**
 * Created by andreas on 03.05.14.
 */

import Toast from '../components/Toast.jsx';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import base from '../base.js';
import merge from 'lodash.merge';
import Helper from './helper.js';


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
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param propertyDescriptions - a hierarchy of Property
 * @param properties - a hierarchy of Property (2 level..)
 *                     only for compatibility, if a description is set, this one wins...
 * @constructor
 */
class PropertyHandler {
    constructor(propertyDescriptions) {
        let self=this;
        this.propertyDescriptions = KeyHelper.getKeyDescriptions(true);
        this.getProperties=this.getProperties.bind(this);
        this.saveUserData=this.saveUserData.bind(this);
        this.getColor=this.getColor.bind(this);
        this.getAisColor=this.getAisColor.bind(this);
        this.incrementSequence=this.incrementSequence.bind(this);
        this.dataChanged=this.dataChanged.bind(this);
        this.resetToSaved=this.resetToSaved.bind(this);
        this.resetToSaved();
        //register at the store for updates of our synced data
        globalStore.register(this,keys.properties);
        if (!window.localStorage) {
            Toast("local storage is not available, seems that your browser is not HTML5... - application will not work");
            return;
        }
        this.incrementSequence();
        try{
            window.addEventListener('message',(ev)=>{
                if (ev.origin !== window.location.origin) return;
                if (ev.data === 'reloadSettings'){
                    this.resetToSaved();
                    this.incrementSequence();
                }
            })
        } catch (e){}
    }

    loadUserData(){
        try{
           let rawdata = localStorage.getItem(globalStore.getData(keys.properties.settingsName));
           if (!rawdata) return {};
           return JSON.parse(rawdata);
        }catch (e){
           base.log("unable to load user data")
        }
        return {};
    }

    incrementSequence(){
        globalStore.storeData(keys.gui.global.propertySequence,
            globalStore.getData(keys.gui.global.propertySequence,0)+1);
    }

    /**
     * get the current active properties
     * @deprecated - expensive!
     * @returns {*}
     */
    getProperties() {
        return globalStore.getMultiple(keys.properties);
    }

    /**
     * save the current settings
     */
    saveUserData(data) {
        let raw = JSON.stringify(data);
        localStorage.setItem(globalStore.getData(keys.properties.settingsName), raw);
        try{
            window.parent.postMessage('settingsChanged',window.location.origin);
        }catch (e){}
    }


    dataChanged(storeKeys){
        let self=this;
        let values=globalStore.getMultiple(keys.properties);
        this.saveUserData(
            Helper.filterObjectTree(values,(item,path)=>{
                let description=self.propertyDescriptions[path];
                if (description === undefined) return false;
                return item !== description.defaultv;
            },KeyHelper.keyNodeToString(keys.properties))
        );
        this.incrementSequence();
    }



    getColor(colorName, addNightFade) {
        let rt = globalStore.getData(KeyHelper.keyNodeToString(keys.properties.style)+"." + colorName);
        if (rt === undefined) return rt;
        if ((addNightFade === undefined || addNightFade) && globalStore.getData(keys.properties.nightMode)) {
            let nf = globalStore.getData(keys.properties.nightColorDim);
            return hex2rgba(rt, nf / 100);
        }
        return rt;
    }

    getAisColor(currentObject) {
        let color = "";
        if (currentObject.warning) {
            color = this.getColor('aisWarningColor');
        } else {
            if (currentObject.nearest) {
                color = this.getColor('aisNearestColor');
            } else if (currentObject.tracking) {
                color = this.getColor('aisTrackingColor');
            } else {
                color = this.getColor('aisNormalColor');
            }
        }
    return color;
    }


    resetToSaved(){
        let self=this;
        let defaults=KeyHelper.getDefaultKeyValues();
        globalStore.storeMultiple(defaults,undefined,true);
        try {
            let ndata = this.loadUserData();
            if (ndata) {
                let userData = Helper.filterObjectTree(ndata, (item, path)=> {
                    let description = self.propertyDescriptions[path];
                    if (!description) return;
                    return item != globalStore.getData(path);
                }, KeyHelper.keyNodeToString(keys.properties));
                globalStore.storeMultiple(userData, keys.properties, true, true);
            }
        }catch (e){
            base.log("Exception reading user data "+e);
        }
    }

    firstStart(){
        let changes={};
        for (let path in this.propertyDescriptions){
            let pd=this.propertyDescriptions[path];
            if (pd.initialValue !== undefined){
                changes[path]=pd.initialValue;
            }
        }
        globalStore.storeMultiple(changes);
        //set some initial properties
    }

}

export default new PropertyHandler();



