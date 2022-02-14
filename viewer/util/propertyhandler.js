/**
 * Created by andreas on 03.05.14.
 */

import Toast from '../components/Toast.jsx';
import globalStore from './globalstore.jsx';
import keys, {KeyHelper, PropertyType} from './keys.jsx';
import base from '../base.js';
import merge from 'lodash.merge';
import Helper from './helper.js';
import LayoutHandler from './layouthandler';


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

    /**
     * verify the property data we have loaded from a file
     * raise an exception if invalid
     * the input expects the following form:
     * {
     *     "version":nnn
     *     "properties": {
     *         "layers.ais":true,
     *         ...
     *     }
     * }
     * With the keys below the properties are the flattened keys
     * without the leading "keys.properties"
     * @param data
     * @param opt_checkValues if set - reject on invalid values, otherwise correct them
     * @return the checked (and potentially corrected) flattend properties
     */
    verifyPropertyData(data, opt_checkValues) {
        return new Promise((resolve, reject) => {
            if (typeof (data) === 'string') {
                try {
                    data = JSON.parse(data);
                }catch (e){
                    reject("unable to parse json: "+e);
                    return;
                }
            }
            if (data.settingsVersion === undefined) {
                reject("no settings version found");
                return;
            }
            if (typeof (data.properties) !== 'object') {
                reject("no properties found");
                return;
            }
            const prefix = "properties.";
            let rt = {};
            let descriptions = KeyHelper.getKeyDescriptions(true);
            let promises=[];
            for (let dk in data.properties) {
                let key = prefix + dk;
                if (!(key in descriptions)) {
                    continue; //silently ignore non existing
                    //throw new Error("no property dk is defined")
                }
                let des = descriptions[key];
                let v = data.properties[dk];
                switch (des.type) {
                    case PropertyType.CHECKBOX:
                        if (typeof (v) !== 'boolean') {
                            if (opt_checkValues) {
                                reject("invalid boolean " + v + " for " + dk);
                                return;
                            }
                            if (typeof (v) === 'string') v = v.toLowerCase() === 'true';
                            else v = !!v;
                        }
                        rt[key] = v;
                        break;
                    case PropertyType.RANGE:
                        if (typeof (v) !== 'number') {
                            if (opt_checkValues) {
                                reject("invalid number " + v + " for " + dk);
                                return;
                            }
                            v = parseFloat(v);
                            if (isNaN(v)) {
                                if (opt_checkValues) {
                                    reject("nan " + v + " for " + dk);
                                    return;
                                }
                                v = values[0];
                            }
                        }
                        if (v > values[1]) {
                            if (opt_checkValues) {
                                reject(v + " to big for " + dk);
                                return;
                            }
                            v = values[1];
                        }
                        if (v < values[0]) {
                            if (opt_checkValues) {
                                reject(v + " to small for " + dk);
                                return;
                            }
                            v = values[0];
                        }
                        rt[key] = v;
                        break;
                    case PropertyType.COLOR:
                        if (typeof (v) !== 'string') {
                            if (opt_checkValues) {
                                reject("invalid color " + v + " for " + dk);
                                return;
                            }
                            v = v + "";
                        }
                        rt[key] = v;
                        break;
                    case PropertyType.LIST:
                    case PropertyType.SELECT:
                        let found = false;
                        des.values.forEach((le) => {
                            if (le === v) found = true;
                        })
                        if (!found) {
                            if (opt_checkValues) {
                                reject(v + " is not a valid value for " + dk);
                                return;
                            }
                            v = des.values[0];
                        }
                        rt[key] = v;
                        break;
                    case PropertyType.LAYOUT:
                        promises.push(
                            new Promise((lresolve,lreject)=> {
                                LayoutHandler.loadLayout(v)
                                    .then((o) => {
                                        let rt={};
                                        rt[key]=v;
                                        lresolve(rt);
                                    })
                                    .catch((error) => {
                                        if (opt_checkValues) {
                                            lreject(dk + ": unable to load layout " + v + ": " + error);
                                        }
                                        else{
                                            lresolve({});
                                        }
                                    })
                            })
                        );
                        break;
                    default:
                        //silently ignore this
                        break;
                }
            }
            Promise.all(promises)
                .then((values)=>{
                    values.forEach((v)=>{
                        for (let k in v){
                            rt[k]=v[k];
                        }
                    })
                    resolve(rt);
                })
                .catch((error)=>reject(error));
        })

    }

}

export default new PropertyHandler();



