import StoreApi from './storeapi';
import Base from '../base';
/**
 * @class
 * @constructor
 */
let Store=function(){
    StoreApi.call(this);
    /**
     * the data we store for each key
     * @private
     * @type {{}}
     */
    this.data={};
};
Base.inherits(Store,StoreApi);


/**
 * store a data item for a key and trigger the registered callbacks
 * @param key
 * @param data
 * @param opt_noCallbacks: either true to omit all callbacks or a callback reference to omit this
 */
Store.prototype.storeData=function(key,data,opt_noCallbacks){
    let hasChanged=!this.equalsData(this.data[key],data);
    this.data[key]=data;
    if (hasChanged && ! (opt_noCallbacks === true) )this.callCallbacks([key],opt_noCallbacks);
    return hasChanged;
};



/**
 * update several values from an object with given translations
 * for the keys
 * @param data
 * @param keyTranslations objectKey:storeKey - can be undefined - no translations
 * @param opt_noCallbacks: either true to omit all callbacks or a callback reference to omit this
 */
Store.prototype.storeMultiple=function(data,keyTranslations,opt_noCallbacks,opt_omitUndefined){
    let self=this;
    let changeKeys=[];
    if (data === undefined && keyTranslations == undefined) return;
    for (let k in (keyTranslations !== undefined)?keyTranslations:data){
        let storeKey=(keyTranslations!==undefined)? keyTranslations[k]:k;
        let v=(data !== undefined)?data[k]:undefined;
        if (typeof(storeKey) === 'object'){
            let subChanged=self.storeMultiple(v,storeKey,true,opt_omitUndefined);
            changeKeys=changeKeys.concat(subChanged);
            continue;
        }
        let hasChanged=false;
        if (v !== undefined || opt_omitUndefined !== true)
            hasChanged=this.storeData(storeKey,v,true);
        if (hasChanged){
            changeKeys.push(storeKey);
        }
    }
    if (changeKeys.length > 0 && (opt_noCallbacks !== true)){
        this.callCallbacks(changeKeys,opt_noCallbacks);
    }
    return changeKeys;
};



/**
 * retrieve the data for a certain key
 * if no data is there undefined is returned
 * @param key
 * @param opt_default an optional default value
 * @returns {*}
 */
Store.prototype.getDataLocal=function(key,opt_default){
    let rt=this.data[key];
    if (rt !== undefined) return rt;
    return opt_default;
};

Store.prototype.getKeysByPrefix=function(prefix){
    let rt=[];
    if (!prefix) return rt;
    let len=prefix.length;
    for (let k in this.data){
        if (k.substr(0,len) == prefix){
            rt.push(k);
        }
    }
    return rt;
};

module.exports=Store;
