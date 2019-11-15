import Helper from './helper.js';
/**
 * Created by andreas on 20.11.16.
 * a simple interface to register for value updates
 * following the reactjs StoreApi concept
 */
/** @interface */
let UpdateCallback=function(){

};

let shallowCompare=require('./shallowcompare');
/**
 * @param {object} StoreApi
 */
UpdateCallback.prototype.dataChanged=function(StoreApi){
    throw new Error("dataChanged not implemented");
};

/** @interface */
let DataProvider=function(){

};
/**
 *
 * @param {string} key
 */
DataProvider.prototype.getData=function(key){
    throw new Error("getData not implemented");
};

 /**
 * a callback description
 * @param {UpdateCallback} callback the object having a "dataChanged" function
 * @param {string[]||object} keys the keys (can be empty - call back for all)
  *       if it is an object it should have a __path property for the real key
  *       in this case it is considered to ba a prefix
 * @constructor
 */
let CallbackDescriptor=function(callback,keys){
    this.callback=callback;
    if ( (typeof(keys) === 'object' && typeof(keys.__path) !== undefined)){
        this.keys=keys.__path;
        this.prefix=true;
    }
    this.keys=keys;
    this.prefix=false;
};
CallbackDescriptor.prototype.isCallbackFor=function(keylist){
    if (this.prefix){
        for (let k in keylist){
            if (Helper.startsWith(keylist[k],this.keys)) return true;
        }
        return false;
    }
    if (! keylist || keylist.length === 0) return true;
    if (! this.keys || this.keys.length === 0) return true;
    for (let k in this.keys){
        for (let t in keylist){
            if (this.keys[k] === keylist[t] ) return true;
        }
    }
    return false;
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
    /**
     * registered data provider
     * they will be called if no data is found internally
     * @private
     * @type {{}}
     */

    this.dataProvider=[];
};
/**
 * find a callback in the list of registered callbacks
 * @param {UpdateCallback} callback
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
 * @param {UpdateCallback} callback
 * @param list of keys, can be an object with the values being the keys
 */
StoreApi.prototype.register=function(callback/*,...*/){
    let args=Array.prototype.slice.call(arguments,1);
    let keys=[];
    args.forEach(function(arg){
        if (arg === undefined) return;
        if (arg instanceof Array){
            keys=keys.concat(arg)
        }
        else if (arg instanceof Object){
            for (let k in arg){
               keys.push(arg[k])
            }
        }
        else  keys=keys.concat(arg);
    });
    if (! callback) return;
    let idx=this._findCallback(callback);
    if (idx <0){
        this.callbacks.push(new CallbackDescriptor(callback,keys));
        return true;
    }
    let description=this.callbacks[idx];
    if (! description.keys) description.keys=keys;
    else {
        keys.forEach(function(key){
            let found=false;
            description.keys.forEach(function(existing){
                if (existing == key) found=true;
            });
            if (! found) description.keys.push(key);
        });
    }
    return true;
};
/**
 * deregister a callback object
 * @param {UpdateCallback} callback
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
        if (opt_omitHandler && opt_omitHandler === cbItem.callback)return;
        if (cbItem.isCallbackFor(keys)){
           cbItem.callback.dataChanged(self,keys);
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
    for (let i in this.dataProvider){
        if (this.dataProvider[i].getData === undefined) continue;
        rt=this.dataProvider[i].getData(key);
        if (rt !== undefined) return rt;
    }
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
StoreApi.prototype.reset=function(){
    if (this.resetLocal){
        this.resetLocal();
    }
    this.callbacks=[];
};

/**
 * callback function for data provider
 * @param provider
 * @param keys
 * @private
 */
StoreApi.prototype.dataChanged=function(provider,keys){
    this.callCallbacks(keys);
};

/**
 * register a data provider
 * @param {DataProvider} provider
 */
StoreApi.prototype.registerDataProvider=function(provider){
    for (let i in this.dataProvider){
        if (this.dataProvider[i] === provider) return;
    }
    this.dataProvider.push(provider);
    let self=this;
    if (provider.register){
        provider.register(this)
    }
};
StoreApi.prototype.deregisterDataProvider=function(provider){
    if (provider.deregister){
        provider.deregister(this)
    }
    for (let i in this.dataProvider){
        if (this.dataProvider[i] === provider)  {
            this.dataProvider.splice(i,1);
            return;
        }
    }
};


module.exports=StoreApi;
