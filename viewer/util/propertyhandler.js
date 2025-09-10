/**
 * Created by andreas on 03.05.14.
 */

import Toast from '../components/Toast.jsx';
import globalStore from './globalstore.jsx';
import keys, {KeyHelper, PropertyType, SplitProperty} from './keys.jsx';
import base from '../base.js';
import assign from 'object-assign';
import LayoutHandler from './layouthandler';
import RequestHandler from "./requests";
import Requests from "./requests";
import LocalStorage, {STORAGE_NAMES} from './localStorageManager';
import splitsupport from "./splitsupport";
import {object} from "prop-types";


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
        this.propertyPrefix=KeyHelper.keyNodeToString(keys.properties)+".";
        this.propertyDescriptions = KeyHelper.getKeyDescriptions(true);
        this.getProperties=this.getProperties.bind(this);
        this.saveUserData=this.saveUserData.bind(this);
        this.getColor=this.getColor.bind(this);
        this.getAisColor=this.getAisColor.bind(this);
        this.incrementSequence=this.incrementSequence.bind(this);
        this.dataChanged=this.dataChanged.bind(this);
        this.resetToSaved=this.resetToSaved.bind(this);
        this.prefixKeys=[];
        for (let k in this.propertyDescriptions){
            let description=this.propertyDescriptions[k];
            if (description.isSplit()){
                this.prefixKeys.push(k);
            }
        }
        //register at the store for updates of our synced data
        globalStore.register(this,keys.properties);
        if (!LocalStorage.hasStorage()) {
            Toast("local storage is not available, seems that your browser is not HTML5... - application will not work");
            return;
        }
        this.incrementSequence();
        splitsupport.subscribe('reloadSettings',()=>{
            this.resetToSaved();
            this.incrementSequence();
        });
    }

    setPrefixKeys(prefixKeys){
        if (! (prefixKeys instanceof Array)){
            throw new Error("prefix keys must be an array");
        }
        let newPrefixKeys=[];
        prefixKeys.forEach((key)=>{
            if (key.indexOf(this.propertyPrefix) !== 0) key=this.propertyPrefix+key;
            newPrefixKeys.push(key);
        })
        this.prefixKeys=newPrefixKeys;
    }

    loadUserData(use_prefix) {
        let rt = {};
        if (use_prefix && !LocalStorage.hasPrefix()) return rt;
        let storageName = use_prefix ?
            STORAGE_NAMES.SPLITSETTINGS :
            STORAGE_NAMES.SETTINGS;
        try {
            let rawdata = LocalStorage.getItem(storageName);
            if (rawdata) {
                return JSON.parse(rawdata);
            }
        } catch (e) {
            base.log("unable to load user data from " + storageName)
        }
        return rt;
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
    saveUserData(data,opt_forPrefix) {
        let raw = JSON.stringify(data);
        LocalStorage.setItem(opt_forPrefix?STORAGE_NAMES.SPLITSETTINGS:STORAGE_NAMES.SETTINGS,undefined, raw);
        splitsupport.sendToFrame('settingsChanged');
    }

    setItem(obj,path,value,opt_skip){
        if (! obj) obj={};
        let current=obj;
        let parts=path.split('.');
        for (let i=opt_skip||0;i<parts.length;i++){
            let pk=parts[i];
            if (i < (parts.length-1)){
                if (typeof(current[pk]) !== 'object') current[pk]={};
                current=current[pk];
                continue;
            }
            current[pk]=value;
        }
        return obj;
    }
    savePrefixedValues(){
        let saveDataSplit={}
        let hasPrefix=LocalStorage.hasPrefix();
        if (! hasPrefix) return;
        for (let dk in this.propertyDescriptions){
            let v=globalStore.getData(dk);
            if (this.prefixKeys.indexOf(dk) >= 0){
                //in any case also write default values to prefixed settings
                this.setItem(saveDataSplit,dk,v,1);
            }
        }
        this.saveUserData(saveDataSplit, true);
    }
    dataChanged(storeKeys){
        let saveData={};
        let saveDataSplit={}
        let hasPrefix=LocalStorage.hasPrefix();
        for (let dk in this.propertyDescriptions){
            let v=globalStore.getData(dk);
            if (this.prefixKeys.indexOf(dk) >= 0 && hasPrefix){
                //in any case also write default values to prefixed settings
                this.setItem(saveDataSplit,dk,v,1);
            }
            else{
                if (v !== this.propertyDescriptions[dk].defaultv){
                    this.setItem(saveData,dk,v,1);
                }
            }
        }
        this.saveUserData(saveData);
        if (hasPrefix) {
            this.saveUserData(saveDataSplit, true);
        }
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
        if ((currentObject.warning && globalStore.getData(keys.properties.aisMarkAllWarning))||
            currentObject.nextWarning) {
            color = this.getColor('aisWarningColor');
        } else {
            if (currentObject.nearest) {
                color = this.getColor('aisNearestColor');
            } else if (currentObject.mmsi === globalStore.getData(keys.nav.ais.trackedMmsi)) {
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
            let prefixData = this.loadUserData(true);
            if (ndata) {
                let userData={};
                for (let k in this.propertyDescriptions){
                    let v=KeyHelper.getValue(ndata,k,1);
                    if (this.prefixKeys.indexOf(k) >= 0){
                        let pv=KeyHelper.getValue(prefixData,k,1);
                        if (pv !== undefined) v=pv;
                    }
                    if ( v === undefined) continue;
                    if (v !== globalStore.getData(k)){
                        userData[k]=v;
                    }
                }
                globalStore.storeMultiple(userData, undefined, true, true);
            }
        }catch (e){
            base.log("Exception reading user data "+e);
        }
        globalStore.storeData(keys.gui.global.propertiesLoaded,true);
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
     * @param opt_errorNonExistent treat non existing properties as error
     * @param opt_replacements an object with key/value, keys will be used for a $key$ replacement
     * @return the checked (and potentially corrected) flattend properties
     */
    verifySettingsData(data, opt_checkValues, opt_errorNonExistent,opt_replacements) {

        return new Promise((resolve, reject) => {
            let warnings=[];
            const eHandler=(txt,nonExistant)=>{
                if ((nonExistant && opt_errorNonExistent) || (! nonExistant && opt_checkValues)){
                    reject(txt);
                    return true;
                }
                warnings.push(txt);
            }
            if (typeof (data) === 'string') {
                try {
                    data = JSON.parse(data);
                }catch (e){
                    reject("unable to parse json: "+e);
                    return;
                }
            }
            let version=data.settingsVersion;
            if (version === undefined) {
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
                    if (eHandler(dk+" is no existing property",true)) return;
                    continue; //silently ignore non existing
                    //throw new Error("no property dk is defined")
                }
                let des = descriptions[key];
                let v = data.properties[dk];
                if (opt_replacements && typeof(v) === 'string'){
                    for (let rk in opt_replacements){
                        v=v.replace('$'+rk+'$',opt_replacements[rk]);
                    }
                }
                let ov=v;
                switch (des.type) {
                    case PropertyType.MULTICHECKBOX:
                        if (typeof(v) !== 'object'){
                            if (eHandler("invalid type "+typeof(v)+" for "+dk)) return;
                        }
                        rt[dk]=v;
                        break;
                    case PropertyType.CHECKBOX:
                        if (typeof (v) !== 'boolean') {
                            if (typeof (v) === 'string') v = v.toLowerCase() === 'true';
                            else v = !!v;
                        }
                        rt[dk] = v;
                        break;
                    case PropertyType.RANGE:
                        if (typeof (v) !== 'number') {
                            v = parseFloat(v);
                            if (isNaN(v)) {
                                v = des.values[0];
                                if (eHandler("nan " + ov + "(=>"+v+") for " + dk)) return;
                            }
                        }
                        if (v > des.values[1]) {
                            ov=v;
                            v = des.values[1];
                            if (eHandler(ov + " to big (=>"+v+") for " + dk)) return;
                        }
                        if (v < des.values[0]) {
                            ov=v;
                            v = des.values[0];
                            if (eHandler(ov + " to small (=>"+v+") for " + dk)) return;
                        }
                        rt[dk] = v;
                        break;
                    case PropertyType.COLOR:
                        if (typeof (v) !== 'string') {
                            v = v + "";
                            if (eHandler("invalid color " + ov + "(=>"+v+") for " + dk)) return;
                        }
                        rt[dk] = v;
                        break;
                    case PropertyType.LIST:
                    case PropertyType.SELECT:
                        let found = false;
                        des.values.forEach((le) => {
                            if (le instanceof Object){
                               if (le.value === v) found=true;
                            }
                            else {
                                if (le === v) found = true;
                            }
                        })
                        if (!found) {
                            v = des.values[0];
                            if (eHandler(ov + " is not a valid value (=>"+v+") for " + dk)) return;
                        }
                        rt[dk] = v;
                        break;
                    case PropertyType.LAYOUT:
                        promises.push(
                            LayoutHandler.loadLayout(v,true)
                                .then((o) => {
                                        let rt = {};
                                        rt[dk] = v;
                                        return rt;
                                    },
                                    (error) => {
                                        let e=dk + ": " + v + ": " + error;
                                        if (opt_checkValues) {
                                            return Promise.reject(e);
                                        } else {
                                            warnings.push(e);
                                            return {};
                                        }
                                    })
                        );
                        break;
                    case PropertyType.DELETED:
                        warnings.push(dk+" is not used any more");
                        break;
                    case PropertyType.STRING:
                        rt[dk]=v;
                        break;
                    default:
                        if (eHandler(dk+": cannot be set",true)) return;
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
                    resolve({warnings:warnings,data: {settingsVersion:version,properties:rt}});
                })
                .catch((error)=>reject(error));
        })

    }

    /**
     * upload settings to the server
     * @param data the settings data
     * @param fileName
     * @param opt_check check values before
     * @param opt_overwrite overwrite on server
     * @return {Promise<* | void>}
     */
    uploadSettingsData(fileName, data,opt_check,opt_overwrite){
        if (!globalStore.getData(keys.properties.connectedMode,false)){
            return Promise.reject("not in connected mode, cannot upload");
        }
        const upload=(data)=>{
            if (typeof(data) !== 'string'){
                data=JSON.stringify(data,undefined,2);
            }
            return Requests.postPlain({
                request:'upload',
                type:'settings',
                name: fileName,
                overwrite: !!opt_overwrite
            },data);
        }
        if (opt_check) {
            return this.verifySettingsData(data, true, true)
                .then((result) => {
                    return upload(result.data);
                })
        }
        else{
            return upload(data);
        }
    }

    exportSettings(current){
        let descriptions = KeyHelper.getKeyDescriptions(true);
        let values = {};
        if (! current) {
            let keys = Object.keys(descriptions);
            current = globalStore.getMultiple(keys);
        }
        for (let dk in descriptions){
            let des=descriptions[dk];
            let found=false;
            for (let k in PropertyType){
                if (PropertyType[k] === des.type && PropertyType[k] !== PropertyType.INTERNAL){
                    found=true;
                    break;
                }
            }
            if (! found){
                continue;
            }
            if (current[dk] === des.defaultv) continue;
            let okey=dk.replace(/^properties\./,'');
            values[okey]=current[dk];
        }
        return {settingsVersion:1,properties:values}
    }

    /**
     * create a list of properties (for the settings page)
     * with filtered properties from the input
     * @param propertyData
     * @param currentValues
     * @param opt_setDefaults if true it will set all values that are different from default
     * @return {Promise}
     */
    importSettings(propertyData, currentValues, opt_setDefaults) {
        return new Promise((resolve, reject) => {
            if (propertyData.settingsVersion === undefined) {
                reject("missing settingsVersion");
                return;
            }
            if (typeof (propertyData.properties) !== 'object') {
                reject("missing or invalid properties");
                return;
            }
            let newValues=propertyData.properties;
            let descriptions = KeyHelper.getKeyDescriptions(true);
            let values = assign({},currentValues);
            let newLayout;
            for (let dk in descriptions) {
                let des = descriptions[dk];
                let found=false;
                for (let pk in PropertyType){
                    if (PropertyType[pk] === des.type && des.type !== PropertyType.INTERNAL){
                        found=true;
                        break;
                    }
                }
                if (!found) {
                    continue;
                }
                let okey=dk.replace(/^properties\./,'');
                if (okey in newValues) {
                    values[dk] = newValues[okey];
                    if (des.type === PropertyType.LAYOUT) newLayout=values[dk];
                }
                else{
                    if (opt_setDefaults ){
                        values[dk]=des.defaultv;
                        if (des.type === PropertyType.LAYOUT) newLayout=values[dk];
                    }
                }

            }
            if (newLayout){
                LayoutHandler.loadLayout(newLayout)
                    .then((ok)=>{
                        resolve(values);
                    })
                    .catch((e)=>reject("unable to load layout: "+e));
                //load layout
            }
            else {
                resolve(values);
            }
        });
    }

    listSettings(opt_forSelect){
        if ( !globalStore.getData(keys.gui.capabilities.uploadSettings,false)){
            return Promise.resolve([]);
        }
        return RequestHandler.getJson({
            request: 'listdir',
            type: 'settings'
        }).then((json)=>{
            if (!opt_forSelect) return json.items;
            let rt=[];
            json.items.forEach((item)=>rt.push({label:item.name,value:item.name}));
            return rt;
        });
    }

    isPrefixProperty(name){
        if (! name || ! LocalStorage.hasPrefix()) return false;
        if (name.indexOf(this.propertyPrefix) !== 0){
            name=this.propertyPrefix+key;
        }
        return this.prefixKeys.indexOf(name) >= 0;
    }

    /**
     * get a list of property values for splitkeys
     * from the master
     * return them in the flattend structure with the keys being the store keys
     */
    getMasterValues(){
        let masterData=this.loadUserData();
        let rt={};
        this.prefixKeys.forEach((key)=>{
            let v=KeyHelper.getValue(masterData,key,1);
            if ( v!== undefined) rt[key]=v;
            else{
                let description=this.propertyDescriptions[key];
                if (description){
                    rt[key]=description.defaultv;
                }
                else{
                    rt[key]=undefined;
                }
            }
        })
        return rt;
    }


}

export default new PropertyHandler();



