/**
 * Created by andreas on 03.05.14.
 */

import Toast from '../components/Toast';
import globalStore from './globalstore';
import keys, {KeyHelper, Property, PropertyType, PropertyValue} from './keys';
import base from '../base';
import LayoutHandler, {layoutLoader} from './layouthandler';
import Requests from "./requests";
import LocalStorage, {STORAGE_NAMES} from './localStorageManager';
// @ts-ignore
import splitsupport from "./splitsupport";
import {StoreDataType} from "./store";
import Helper from "./helper";

export interface SavedSettingsData{
    settingsVersion:number|string;
    properties?: Record<string, PropertyValue>;
}
export interface VerifySettingsResult{
    warnings?:string[]
    data?:SavedSettingsData
}

const hex2rgba= (hex:string, opacity:string|number)=> {
    const patt = /^#([\da-fA-F]{2})([\da-fA-F]{2})([\da-fA-F]{2})$/;
    const matches = patt.exec(hex);
    const r = parseInt(matches[1], 16);
    const g = parseInt(matches[2], 16);
    const b = parseInt(matches[3], 16);
    const rgba = "rgba(" + r + "," + g + "," + b + "," + opacity + ")";
    return rgba;
};
type UserData=Record<string,any>;

/**
 * a storage handler for properties and userData
 * user Data contain a subset of the properties - the changable ones
 * @param propertyDescriptions - a hierarchy of Property
 * @param properties - a hierarchy of Property (2 level..)
 *                     only for compatibility, if a description is set, this one wins...
 * @constructor
 */
class PropertyHandler {
    private propertyDescriptions: Record<string, Property>;
    private propertyPrefix: string;
    private vprefixKeys: string[];
    constructor() {
        this.propertyPrefix=KeyHelper.keyNodeToString(keys.properties)+".";
        this.propertyDescriptions = KeyHelper.getKeyDescriptions(true);
        this.getProperties=this.getProperties.bind(this);
        this.saveUserData=this.saveUserData.bind(this);
        this.getColor=this.getColor.bind(this);
        this.getAisColor=this.getAisColor.bind(this);
        this.incrementSequence=this.incrementSequence.bind(this);
        this.dataChanged=this.dataChanged.bind(this);
        this.resetToSaved=this.resetToSaved.bind(this);
        this.vprefixKeys=[];
        for (const k in this.propertyDescriptions){
            const description=this.propertyDescriptions[k];
            if (description.isSplit()){
                this.vprefixKeys.push(k);
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

    setPrefixKeys(prefixKeys:string|string[]){
        if (! (prefixKeys instanceof Array)){
            throw new Error("prefix keys must be an array");
        }
        const newPrefixKeys:string[]=[];
        prefixKeys.forEach((key)=>{
            if (key.indexOf(this.propertyPrefix) !== 0) key=this.propertyPrefix+key;
            newPrefixKeys.push(key);
        })
        this.vprefixKeys=newPrefixKeys;
    }

    loadUserData(use_prefix?:boolean):UserData {
        const rt = {};
        if (use_prefix && !LocalStorage.hasPrefix()) return rt;
        const storageName = use_prefix ?
            STORAGE_NAMES.SPLITSETTINGS :
            STORAGE_NAMES.SETTINGS;
        try {
            const rawdata = LocalStorage.getItem(storageName);
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
    getProperties(): Record<string,PropertyValue > {
        return globalStore.getMultiple(keys.properties);
    }

    /**
     * save the current settings
     */
    saveUserData(data:UserData,opt_forPrefix?:boolean) {
        const raw = JSON.stringify(data);
        LocalStorage.setItem(opt_forPrefix?STORAGE_NAMES.SPLITSETTINGS:STORAGE_NAMES.SETTINGS,undefined, raw);
        splitsupport.sendToFrame('settingsChanged');
    }

    setItem(obj:UserData,path:string,value:PropertyValue,opt_skip?:number) {
        if (! obj) obj={};
        let current=obj;
        const parts=path.split('.');
        for (let i=opt_skip||0; i < parts.length ;i++){
            const pk=parts[i];
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
        const saveDataSplit:UserData={}
        const hasPrefix=LocalStorage.hasPrefix();
        if (! hasPrefix) return;
        for (const dk in this.propertyDescriptions){
            const v=globalStore.getData(dk);
            if (this.vprefixKeys.indexOf(dk) >= 0){
                //in any case also write default values to prefixed settings
                this.setItem(saveDataSplit,dk,v,1);
            }
        }
        this.saveUserData(saveDataSplit, true);
    }
    dataChanged(){
        const saveData:UserData={};
        const saveDataSplit:UserData={}
        const hasPrefix=LocalStorage.hasPrefix();
        for (const dk in this.propertyDescriptions){
            const v=globalStore.getData(dk);
            if (this.vprefixKeys.indexOf(dk) >= 0 && hasPrefix){
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



    getColor(colorName:string, addNightFade?:boolean) {
        const rt = globalStore.getData(KeyHelper.keyNodeToString(keys.properties.style)+"." + colorName);
        if (rt === undefined) return rt;
        if (Helper.unsetorTrue(addNightFade) && globalStore.getData(keys.properties.nightMode)) {
            const nf = globalStore.getData(keys.properties.nightColorDim);
            return hex2rgba(rt, nf / 100);
        }
        return rt;
    }
    //TODO: use AisItemProps here - but needs to go to a lower place
    getAisColor(currentObject:any) {
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


    _getSavedValues(){
        const values=KeyHelper.getDefaultKeyValues();
        try {
            const ndata = this.loadUserData();
            const prefixData = this.loadUserData(true);
            if (ndata) {
                for (const k in this.propertyDescriptions){
                    let v=KeyHelper.getValue(ndata,k,1);
                    if (this.vprefixKeys.indexOf(k) >= 0){
                        const pv=KeyHelper.getValue(prefixData,k,1);
                        if (pv !== undefined) v=pv;
                    }
                    if ( v === undefined) continue;
                    values[k]=v;
                }
            }
        }catch (e){
            base.log("Exception reading user data "+e);
        }
        return values;
    }

    resetToSaved(){
        const saved=this._getSavedValues()
        globalStore.storeMultiple(saved,undefined,true);
        globalStore.storeData(keys.gui.global.propertiesLoaded,true);
    }

    firstStart(){
        const changes:Record<string,StoreDataType> = {};
        for (const path in this.propertyDescriptions){
            const pd=this.propertyDescriptions[path];
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
     *     "settingsVersion":nnn
     *     "properties": {
     *         "layers.ais":true,
     *         ...
     *     }
     * }
     * With the keys below the properties are the flattened keys
     * without the leading "keys.properties"
     * @param dataIn
     * @param opt_checkValues if set - reject on invalid values, otherwise correct them
     * @param opt_errorNonExistent treat non existing properties as error
     * @param opt_replacements an object with key/value, keys will be used for a $key$ replacement
     * @return the checked (and potentially corrected) flattend properties
     */
    verifySettingsData(dataIn:SavedSettingsData|string,
                       opt_checkValues?:boolean,
                       opt_errorNonExistent?:boolean,
                       opt_replacements?:Record<string,string>):Promise<VerifySettingsResult> {

        return new Promise((resolve, reject) => {
            const warnings:string[]=[];
            const eHandler=(txt:string,nonExistant?:boolean)=>{
                if ((nonExistant && opt_errorNonExistent) || (! nonExistant && opt_checkValues)){
                    reject(txt);
                    return true;
                }
                warnings.push(txt);
            }
            let data:SavedSettingsData;
            if (typeof (dataIn) === 'string') {
                try {
                    data = JSON.parse(dataIn);
                }catch (e){
                    reject("unable to parse json: "+e);
                    return;
                }
            }
            else{
                data = dataIn;
            }
            const version=data.settingsVersion;
            if (version === undefined) {
                reject("no settings version found");
                return;
            }
            if (typeof (data.properties) !== 'object') {
                reject("no properties found");
                return;
            }
            const prefix = "properties.";
            const rt:Record<string,PropertyValue> = {};
            const descriptions = KeyHelper.getKeyDescriptions(true);
            const promises=[];
            for (const dk in data.properties) {
                const key = prefix + dk;
                if (!(key in descriptions)) {
                    if (eHandler(dk+" is no existing property",true)) return;
                    continue; //silently ignore non existing
                    //throw new Error("no property dk is defined")
                }
                const des = descriptions[key];
                let v = data.properties[dk];
                if (opt_replacements && typeof(v) === 'string'){
                    for (const rk in opt_replacements){
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
                            v = parseFloat(v as string);
                            if (isNaN(v)) {
                                v = des.values[0] as any;
                                if (eHandler("nan " + ov + "(=>"+v+") for " + dk)) return;
                            }
                        }
                        if (v > des.values[1]) {
                            ov=v;
                            v = des.values[1] as any;
                            if (eHandler(ov + " to big (=>"+v+") for " + dk)) return;
                        }
                        if (v < des.values[0]) {
                            ov=v;
                            v = des.values[0] as any;
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
                    case PropertyType.SELECT: {
                        let found = false;
                        des.values.forEach((le) => {
                            if (le instanceof Object) {
                                if (le.value === v) found = true;
                            } else {
                                if (le === v) found = true;
                            }
                        })
                        if (!found) {
                            v = des.values[0] as string;
                            if (eHandler(ov + " is not a valid value (=>" + v + ") for " + dk)) return;
                        }
                        rt[dk] = v;
                        }
                        break;
                    case PropertyType.LAYOUT:
                        promises.push(
                            layoutLoader.loadLayout(v as string)
                                .then(() => {
                                        const rt:Record<string,any> = {};
                                        rt[dk] = v;
                                        return rt;
                                    },
                                    (error:string) => {
                                        const e=dk + ": " + v + ": " + error;
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
                    values.forEach((v:PropertyValue[])=>{
                        for (const k in v){
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
    uploadSettingsData(fileName:string,
                       data:SavedSettingsData|string,
                       opt_check?:boolean,
                       opt_overwrite?:boolean,){
        if (!globalStore.getData(keys.properties.connectedMode,false)){
            return Promise.reject("not in connected mode, cannot upload");
        }
        const upload=(data:SavedSettingsData|string)=>{
            if (typeof(data) !== 'string'){
                data=JSON.stringify(data,undefined,2);
            }
            return Requests.postPlain({
                request:'api',
                command:'upload',
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

    exportSettings(current?:Record<string,PropertyValue>){
        const descriptions = KeyHelper.getKeyDescriptions(true);
        const values:Record<string, PropertyValue> = {};
        if (! current) {
            const keys = Object.keys(descriptions);
            current = globalStore.getMultiple(keys);
        }
        for (const dk in descriptions){
            const des=descriptions[dk];
            let found=false;
            for (const k of Object.values(PropertyType)){
                if (k === des.type && k !== PropertyType.INTERNAL){
                    found=true;
                    break;
                }
            }
            if (! found){
                continue;
            }
            if (current[dk] === des.defaultv) continue;
            const okey=dk.replace(/^properties\./,'');
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
    importSettings(propertyData:SavedSettingsData,
                   currentValues:Record<string,PropertyValue>,
                   opt_setDefaults?:boolean,) {
        return new Promise((resolve, reject) => {
            if (propertyData.settingsVersion === undefined) {
                reject("missing settingsVersion");
                return;
            }
            if (typeof (propertyData.properties) !== 'object') {
                reject("missing or invalid properties");
                return;
            }
            const newValues=propertyData.properties;
            const descriptions = KeyHelper.getKeyDescriptions(true);
            const values = {...currentValues};
            let newLayout:string;
            for (const dk in descriptions) {
                const des = descriptions[dk];
                let found=false;
                for (const pk of Object.values(PropertyType)){
                    if (pk === des.type && des.type !== PropertyType.INTERNAL){
                        found=true;
                        break;
                    }
                }
                if (!found) {
                    continue;
                }
                const okey=dk.replace(/^properties\./,'');
                if (okey in newValues) {
                    values[dk] = newValues[okey];
                    if (des.type === PropertyType.LAYOUT) newLayout=values[dk] as string;
                }
                else{
                    if (opt_setDefaults ){
                        values[dk]=des.defaultv;
                        if (des.type === PropertyType.LAYOUT) newLayout=values[dk] as string;
                    }
                }

            }
            if (newLayout){
                layoutLoader.loadLayout(newLayout)
                    .then((layout:any)=>{
                        LayoutHandler.setLayoutAndName(layout,newLayout);
                        resolve(values);
                    })
                    .catch((e:any)=>reject("unable to load layout: "+e));
                //load layout
            }
            else {
                resolve(values);
            }
        });
    }

    listSettings(){
        if ( !globalStore.getData(keys.gui.capabilities.uploadSettings,false)){
            return Promise.resolve([]);
        }
        return Requests.getJson({
            request:'api',
            command: 'list',
            type: 'settings'
        }).then((json)=>{
            return json.items;
        });
    }

    isPrefixProperty(name:string){
        if (! name || ! LocalStorage.hasPrefix()) return false;
        if (name.indexOf(this.propertyPrefix) !== 0){
            return false;
        }
        return this.vprefixKeys.indexOf(name) >= 0;
    }

    /**
     * get a list of property values for splitkeys
     * from the master
     * return them in the flattend structure with the keys being the store keys
     */
    getMasterValues(){
        const masterData=this.loadUserData();
        const rt:Record<string,PropertyValue> = {};
        this.vprefixKeys.forEach((key)=>{
            const v=KeyHelper.getValue(masterData,key,1);
            if ( v!== undefined) rt[key]=v;
            else{
                const description=this.propertyDescriptions[key];
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



