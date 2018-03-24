let StoreApi=require('./storeapi');
let Base=require('../base');
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
 */
Store.prototype.storeData=function(key,data){
    this.data[key]=data;
    //this could be improved by checking for changes...
    this.callCallbacks([key]);
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
    let oldData=this.data[key];
    if (opt_subkey){
        if (! this.data[key]) this.data[key]={};
        if (! (this.data[key] instanceof Object)) throw new Error("data for key "+key+" must be an object for subkey handling");
        oldData=this.data[key][opt_subkey];
    }
    let newData;
    if (typeof(data) === 'function'){
        newData=data(oldData);
    }
    else {
        if (!oldData || oldData instanceof Array) newData = data;
        else {
            newData=avnav.assign({},oldData, data);
        }
    }
    let hasChanged=!this.equalsData(oldData,newData);
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
    let oldData=this.data[key];
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
    let val={};
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
Store.prototype.getDataLocal=function(key,opt_default){
    let rt=this.data[key];
    if (rt !== undefined) return rt;
    return opt_default;
};
Store.prototype.resetLocal=function(){
    this.data={};
};
Store.prototype.resetData=function(){
    this.data={};
};

module.exports=Store;
