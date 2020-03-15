import Helper from './helper.js';
import {KeyHelper} from './keys.jsx';
import shallowCompare from './shallowcompare';
/**
 * Created by andreas on 20.11.16.
 * a simple interface to register for value updates
 * following the reactjs StoreApi concept
 */
/** @interface */
let UpdateCallback=function(){

};

/**
 * @param {object} StoreApi
 */
UpdateCallback.prototype.dataChanged=function(StoreApi){
    throw new Error("dataChanged not implemented");
};


 /**
 * a callback description
 * @param {UpdateCallback||function} callback the object having a "dataChanged" function
 * @param {string[]||object} keys the keys (can be empty - call back for all)
  *       if it is an object it should have a __path property for the real key
  *       in this case it is considered to ba a prefix
 * @constructor
 */
let CallbackDescriptor=function(callback,keys){
    this.callback=callback;
    if ( KeyHelper.keyNodeToString(keys)){
        this.keys=KeyHelper.keyNodeToString(keys);
        this.prefix=true;
    }
     else {
        this.keys = keys;
        this.prefix = false;
    }
};
CallbackDescriptor.prototype.isCallbackFor=function(keylist){
    if (! keylist || keylist.length === 0) return true;
    if (this.prefix){
        for (let k in keylist){
            if (Helper.startsWith(keylist[k],this.keys)) return true;
        }
        return false;
    }
    if (! this.keys || this.keys.length === 0) return true;
    for (let k in this.keys){
        for (let t in keylist){
            if (this.keys[k] === keylist[t] ) return true;
        }
    }
    return false;
};
CallbackDescriptor.prototype.call=function(keys){
    if (typeof(this.callback) === 'function'){
        return this.callback(keys);
    }
    else{
        return this.callback.dataChanged(keys);
    }
};
/**
 * @class
 * @constructor
 */
let StoreApi=function(){
    /**
     * @private
     * @type {CallbackDescriptor[]}
     */
    this.callbacks=[];
};
/**
 * find a callback in the list of registered callbacks
 * @param {UpdateCallback||function} callback
 * @returns {number} - -1 if not found
 * @private
 */
StoreApi.prototype._findCallback=function(callback){
    let i;
    for (i=0;i< this.callbacks.length;i++){
        if (this.callbacks[i].callback == callback) return i;
    }
    return -1;
};


/**
 * register a callback handler
 * @param {UpdateCallback||function} callback
 * @param list of keys, can be an object with the values being the keys or a keyNode - registering a prefix
 */
StoreApi.prototype.register=function(callback/*,...*/){
    let args=Array.prototype.slice.call(arguments,1);
    let keys=[];
    if (args.length == 1 && KeyHelper.keyNodeToString(args[0])){
        keys=args[0];
    }
    else {
        args.forEach(function (arg) {
            if (arg === undefined) return;
            if (arg instanceof Array) {
                keys = keys.concat(arg)
            }
            else if (arg instanceof Object) {
                for (let k in arg) {
                    keys.push(arg[k])
                }
            }
            else  keys = keys.concat(arg);
        });
    }
    if (! callback) return;
    let idx=this._findCallback(callback);
    if (idx <0){
        this.callbacks.push(new CallbackDescriptor(callback,keys));
        return true;
    }
    this.callbacks[idx]=new CallbackDescriptor(callback,keys);
    return true;
};
/**
 * deregister a callback object
 * @param {UpdateCallback||function} callback
 * @returns {boolean}
 */
StoreApi.prototype.deregister=function(callback){
    let idx=this._findCallback(callback);
    if (idx < 0) return false;
    this.callbacks.splice(idx,1);
    return true;
};
/**
 * fire the callbacks
 * @param keys - an array of keys
 * @param opt_omitHandler e reference to a handler to be omitted
 */
StoreApi.prototype.callCallbacks=function(keys,opt_omitHandler){
    let self=this;
    this.callbacks.forEach(function(cbItem){
        if (opt_omitHandler){
            if (opt_omitHandler === cbItem.callback) return;
            if (opt_omitHandler instanceof Array){
                for (let k in opt_omitHandler){
                    if (opt_omitHandler[k] == cbItem.callback) return;
                }
            }
        }
        if (cbItem.isCallbackFor(keys)){
           cbItem.call(keys);
        }
    });
};

StoreApi.prototype.equalsData=shallowCompare;

/**
 * retrieve the data for a certain key
 * if no data is there undefined is returned
 * @param key
 * @param opt_default an optional default value
 * @returns {*}
 */
StoreApi.prototype.getData=function(key,opt_default){
    let rt;
    if (this.getDataLocal){
        rt=this.getDataLocal(key,opt_default);
    }
    if (rt !== undefined) return rt;
    return opt_default;
};
/**
 * fetch an object containing the keys provided as parameter
 * @param keys single key or array or object (keys used and being translated)
 */
StoreApi.prototype.getMultiple=function(keys){
    let self=this;
    let storeKeys=keys;
    let rt={};
    if (! (storeKeys instanceof Array)){
        if (storeKeys instanceof Object){
            for (let k in storeKeys){
                let v=undefined;
                if (typeof(storeKeys[k]) === 'object'){
                    v=self.getMultiple(storeKeys[k]);
                }
                else {
                    v = self.getData(storeKeys[k]);
                }
                rt[k]=v;
            }
            return rt;
        }
        else {
            storeKeys = [storeKeys];
        }
    }
    storeKeys.forEach((key)=>{
        let v=self.getData(key);
        rt[key]=v;
    });
    return rt;
};





module.exports=StoreApi;
