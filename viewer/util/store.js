/**
 * Created by andreas on 20.11.16.
 * a simple interface to register for value updates
 * following the reactjs store concept
 */
/** @interface */
var UpdateCallback=function(){

};

var equalsObjects=require('shallow-equal/objects');
var equalsArrays=require('shallow-equal/arrays');
/**
 * @param {object} store
 */
UpdateCallback.prototype.dataChanged=function(store){
    throw new Error("dataChanged not implemented");
};

/** @interface */
var DataProvider=function(){

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
 * @param {string[]} keys the keys (can be empty - call back for all)
 * @constructor
 */
var CallbackDescriptor=function(callback,keys){
    this.callback=callback;
    this.keys=keys;
};
/**
 * @class
 * @constructor
 */
var Store=function(){
    /**
     * @private
     * @type {CallbackDescriptor[]}
     */
    this.callbacks=[];
    /**
     * the data we store for each key
     * @private
     * @type {{}}
     */
    this.data={};
    /**
     * registered data provider
     * they will be called if no data is found internally
     * @private
     * @type {{}}
     */

    this.dataProvider={}
};
/**
 * find a callback in the list of registered callbacks
 * @param {UpdateCallback} callback
 * @returns {number} - -1 if not found
 * @private
 */
Store.prototype._findCallback=function(callback){
    var i;
    for (i=0;i< this.callbacks.length;i++){
        if (this.callbacks[i].callback == callback) return i;
    }
    return -1;
};
/**
 * check if at least one of the keys in kyelist is contained in arr
 * returns true also if the keylist is empty
 * @param keylist
 * @param arr
 * @private
 */
Store.prototype._contains=function(keylist,arr){
    if (! keylist || keylist.length == 0) return true;
    var found=false;
    keylist.forEach(function(key){
       arr.forEach(function(el){
           if (el == key) found=true;
       })
    });
    return found;
};

/**
 * register a callback handler
 * @param {UpdateCallback} callback
 * @param list of keys
 */
Store.prototype.register=function(callback/*,...*/){
    var args=Array.prototype.slice.call(arguments,1);
    var keys=[];
    args.forEach(function(arg){
       keys=keys.concat(arg);
    });
    if (! callback) return;
    var idx=this._findCallback(callback);
    if (idx <0){
        this.callbacks.push(new CallbackDescriptor(callback,keys));
        return true;
    }
    var description=this.callbacks[idx];
    if (! description.keys) description.keys=keys;
    else {
        keys.forEach(function(key){
            var found=false;
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
Store.prototype.deregister=function(callback){
    var idx=this._findCallback(callback);
    if (idx < 0) return false;
    this.callbacks.splice(idx,1);
    return true;
};
/**
 * fire the callbacks
 * @param keys - an array of keys
 */
Store.prototype.callCallbacks=function(keys){
    var self=this;
    this.callbacks.forEach(function(cbItem){
       if (self._contains(keys,cbItem.keys)){
           cbItem.callback.dataChanged(this);
       }
    });
};
/**
 * store a data item for a key and trigger the registered callbacks
 * @param key
 * @param data
 */
Store.prototype.storeData=function(key,data){
    this.data[key]=data;
    //this could be improved by checking for changes...
    this.callCallbacks([key]);
};

Store.prototype.equalsData=function(oldData,newData){
    if (oldData === undefined && newData === undefined) return true;
    if (oldData === undefined) return false;
    if (newData === undefined) return false;
    if (typeof (newData) !== typeof (oldData)) return false;
    if (newData instanceof Array && oldData instanceof Array){
        return equalsArrays(oldData,newData)
    }
    if (newData instanceof Object && oldData instanceof Object){
        return equalsObjects(newData,oldData);
    }
    return oldData == newData;
};
/**
 * update data in the store
 * the data needs to be an object!
 * will only call callbacks if data is changed
 * @param key
 * @param {*} data either an object to be merged
 *            or a function that is called with the old data and should return the new
 * @param {string} opt_subkey if set - only update this data
 */
Store.prototype.updateData=function(key,data,opt_subkey){
    var oldData=this.data[key];
    if (opt_subkey){
        if (! this.data[key]) this.data[key]={};
        if (! (this.data[key] instanceof Object)) throw new Error("data for key "+key+" must be an object for subkey handling");
        oldData=this.data[key][opt_subkey];
    }
    var newData;
    if (typeof(data) === 'function'){
        newData=data(oldData);
    }
    else {
        if (!oldData) newData = data;
        else {
            newData=avnav.assign({},oldData, data);
        }
    }
    var hasChanged=this.equalsData(oldData,newData);
    if (opt_subkey){
        this.data[key][opt_subkey]=newData;
    }
    else{
        this.data[key]=newData;
    }
    //this could be improved by checking for changes...
    if (hasChanged) this.callCallbacks([key]);
};
/**
 * replace a subkey of an object
 * @param key
 * @param data
 * @param subKey
 */
Store.prototype.replaceSubKey=function(key,data,subKey){
    var oldData=this.data[key];
    if (oldData && ! (oldData instanceof Object)) throw new Error("can only update objects, key="+key);
    if (! oldData) oldData={};
    oldData[subKey]=data;
    this.data[key]=oldData;
    this.callCallbacks([key]);
};
/**
 * update a value inside an object
 * @param key
 * @param opt_subkey
 * @param itemKey
 * @param value
 */
Store.prototype.updateSubItem=function(key,itemKey,value,opt_subkey){
    var val={};
    val[itemKey]=value;
    this.updateData(key,function(oldData){
        if (oldData && ! (oldData instanceof Object)) throw new Error("item "+key+" needs to be an object");
        return avnav.assign({},oldData,val);
    },opt_subkey);
};
/**
 * retrieve the data for a certain key
 * if no data is there undefined is returned
 * @param key
 * @param opt_default an optional default value
 * @returns {*}
 */
Store.prototype.getData=function(key,opt_default){
    var rt=this.data[key];
    if (rt !== undefined) return rt;
    for (provider in this.dataProvider){
        rt=provider.getData(key);
        if (rt !== undefined) return rt;
    }
    return opt_default;
};
Store.prototype.reset=function(){
    this.callbacks=[];
    this.data={};
};
Store.prototype.resetData=function(){
    this.data={};
};

/**
 * register a data provider
 * @param {DataProvider} provider
 */
Store.prototype.registerDataProvider=function(provider){
    this.dataProvider[provider]=true;
};
Store.prototype.deregisterDataProvider=function(provider){
    this.dataProvider[provider]=undefined;
};


module.exports=Store;
