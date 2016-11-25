/**
 * Created by andreas on 20.11.16.
 * a simple interface to register for value updates
 * following the reactjs store concept
 */
/** @interface */
var UpdateCallback=function(){

};
/**
 * @param {object} store
 */
UpdateCallback.prototype.dataChanged=function(store){
    throw new Error("dataChanged not implemented");
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
/**
 * retrieve the data for a certain key
 * if no data is there undefined is returned
 * @param key
 * @returns {*}
 */
Store.prototype.getData=function(key){
    return this.data[key];
};
Store.prototype.reset=function(){
    this.callbacks=[];
    this.data={};
};
Store.prototype.resetData=function(){
    this.data={};
};

module.exports=Store;
