import Helper from './helper.js';
import {KeyHelper} from './keys.jsx';
import shallowCompare from './compare';
/**
 * Created by andreas on 20.11.16.
 * a simple interface to register for value updates
 * following the reactjs StoreApi concept
 */
/** @interface */
class UpdateCallback{
    constructor() {
    }
    dataChanged=function(){
        throw new Error("dataChanged not implemented");
    };
}


/**
 * a callback description
 * @param {UpdateCallback||function} callback the object having a "dataChanged" function
 * @param {string[]||object} keys the keys (can be empty - call back for all)
 *       if it is an object it should have a __path property for the real key
 *       in this case it is considered to ba a prefix
 * @constructor
 */
class CallbackDescriptor {
    constructor(callback, keys) {
        this.callback = callback;
        if (KeyHelper.keyNodeToString(keys)) {
            this.keys = KeyHelper.keyNodeToString(keys);
            this.prefix = true;
        } else {
            this.keys = keys;
            this.prefix = false;
        }
    }

    isCallbackFor(keylist) {
        if (!keylist || keylist.length === 0) return true;
        if (this.prefix) {
            for (let k in keylist) {
                if (Helper.startsWith(keylist[k], this.keys)) return true;
            }
            return false;
        }
        if (!this.keys || this.keys.length === 0) return true;
        for (let k in this.keys) {
            for (let t in keylist) {
                if (this.keys[k] === keylist[t]) return true;
            }
        }
        return false;
    }
    call(keys) {
        if (typeof (this.callback) === 'function') {
            return this.callback(keys);
        } else {
            return this.callback.dataChanged(keys);
        }
    }
}

/**
 * @class
 * @constructor
 */
class Store {
    constructor(name) {
        /**
         * @private
         * @type {CallbackDescriptor[]}
         */
        this.callbacks = [];
        this.data = {};
        this.name=name;
    }

    /**
     * find a callback in the list of registered callbacks
     * @param {UpdateCallback||function} callback
     * @returns {number} - -1 if not found
     * @private
     */
    findCallback(callback) {
        let i;
        for (i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i].callback == callback) return i;
        }
        return -1;
    }


    /**
     * register a callback handler
     * @param {UpdateCallback||function} callback
     * @param list of keys, can be an object with the values being the keys or a keyNode - registering a prefix
     */
    register(callback/*,...*/) {
        let args = Array.prototype.slice.call(arguments, 1);
        let keys = [];
        if (args.length == 1 && KeyHelper.keyNodeToString(args[0])) {
            keys = args[0];
        } else {
            args.forEach(function (arg) {
                if (arg === undefined) return;
                if (arg instanceof Array) {
                    keys = keys.concat(arg)
                } else if (arg instanceof Object) {
                    for (let k in arg) {
                        keys.push(arg[k])
                    }
                } else keys = keys.concat(arg);
            });
        }
        if (!callback) return;
        if (keys.length < 1) return;
        let idx = this.findCallback(callback);
        if (idx < 0) {
            this.callbacks.push(new CallbackDescriptor(callback, keys));
            return callback;
        }
        this.callbacks[idx] = new CallbackDescriptor(callback, keys);
        return callback;
    }

    /**
     * deregister a callback object
     * @param {UpdateCallback||function} callback
     * @returns {boolean}
     */
    deregister(callback) {
        let idx = this.findCallback(callback);
        if (idx < 0) return false;
        this.callbacks.splice(idx, 1);
        return true;
    }

    /**
     * fire the callbacks
     * @param keys - an array of keys
     * @param opt_omitHandler e reference to a handler to be omitted
     */
    callCallbacks(keys, opt_omitHandler) {
        let self = this;
        this.callbacks.forEach(function (cbItem) {
            if (opt_omitHandler) {
                if (opt_omitHandler === cbItem.callback) return;
                if (opt_omitHandler instanceof Array) {
                    for (let k in opt_omitHandler) {
                        if (opt_omitHandler[k] == cbItem.callback) return;
                    }
                }
            }
            if (cbItem.isCallbackFor(keys)) {
                cbItem.call(keys);
            }
        });
    }

    equalsData(d, c) {
        return shallowCompare(d, c);
    }

    /**
     * retrieve the data for a certain key
     * if no data is there undefined is returned
     * @param key
     * @param opt_default an optional default value
     * @returns {*}
     */
    getData(key, opt_default) {
        let rt = this.data[key];
        if (rt !== undefined) return rt;
        if (typeof opt_default === 'function') return opt_default();
        return opt_default;
    }

    /**
     * fetch an object containing the keys provided as parameter
     * @param keys single key or array or object (keys used and being translated)
     */
    getMultiple(keys) {
        let self = this;
        let storeKeys = keys;
        let rt = {};
        if (!(storeKeys instanceof Array)) {
            if (storeKeys instanceof Object) {
                for (let k in storeKeys) {
                    let v = undefined;
                    if (typeof (storeKeys[k]) === 'object') {
                        v = self.getMultiple(storeKeys[k]);
                    } else {
                        v = self.getData(storeKeys[k]);
                    }
                    rt[k] = v;
                }
                return rt;
            } else {
                storeKeys = [storeKeys];
            }
        }
        storeKeys.forEach((key) => {
            let v = self.getData(key);
            rt[key] = v;
        });
        return rt;
    }


    /**
     * store a data item for a key and trigger the registered callbacks
     * @param key
     * @param data
     * @param opt_noCallbacks: either true to omit all callbacks or a callback reference to omit this
     */
    storeData(key, data, opt_noCallbacks) {
        let hasChanged = !this.equalsData(this.data[key], data);
        this.data[key] = data;
        if (hasChanged && !(opt_noCallbacks === true)) this.callCallbacks([key], opt_noCallbacks);
        return hasChanged;
    }


    /**
     * update several values from an object with given translations
     * for the keys
     * @param data
     * @param keyTranslations objectKey:storeKey - can be undefined - no translations
     * @param opt_noCallbacks: either true to omit all callbacks or a callback reference to omit this
     */
    storeMultiple(data, keyTranslations, opt_noCallbacks, opt_omitUndefined) {
        let self = this;
        let changeKeys = [];
        if (data === undefined && keyTranslations === undefined) return;
        for (let k in (keyTranslations !== undefined) ? keyTranslations : data) {
            let storeKey = (keyTranslations !== undefined) ? keyTranslations[k] : k;
            if (storeKey === undefined) continue;
            let v = (data !== undefined) ? data[k] : undefined;
            if (typeof (storeKey) === 'object') {
                let subChanged = self.storeMultiple(v, storeKey, true, opt_omitUndefined);
                changeKeys = changeKeys.concat(subChanged);
                continue;
            }
            let hasChanged = false;
            if (v !== undefined || opt_omitUndefined !== true)
                hasChanged = this.storeData(storeKey, v, true);
            if (hasChanged) {
                changeKeys.push(storeKey);
            }
        }
        if (changeKeys.length > 0 && (opt_noCallbacks !== true)) {
            this.callCallbacks(changeKeys, opt_noCallbacks);
        }
        return changeKeys;
    }


    getKeysByPrefix(prefix, opt_simpleValuesOnly) {
        let rt = [];
        if (!prefix) return rt;
        let len = prefix.length;
        for (let k in this.data) {
            if (k.substr(0, len) === prefix) {
                if (opt_simpleValuesOnly) {
                    if (typeof (this.data[k]) === 'object') continue;
                }
                rt.push(k);
            }
        }
        return rt;
    }
};

export default Store;
