import Helper from './helper';
// @ts-ignore
import {KeyHelper} from './keys';
import shallowCompare from './compare';

export type StoreDataType=any;
export type StoreKeyType=string|string[]|Record<string, string>;
export type DataChangedFunction=(keys:string[])=>void;
export interface UpdateCallback{
    dataChanged:DataChangedFunction;
}
export type StoreCallback=DataChangedFunction|UpdateCallback;




/**
 * a callback description
 * @param {UpdateCallback||function} callback the object having a "dataChanged" function
 * @param {string[]||object} keys the keys (can be empty - call back for all)
 *       if it is an object it should have a __path property for the real key
 *       in this case it is considered to ba a prefix
 * @constructor
 */
class CallbackDescriptor {
    callback:StoreCallback;
    private keys:string[];
    private equalsFunction:(val:string,cmp:string) => boolean;
    constructor(callback:StoreCallback, keys:string[]|object) {
        this.callback = callback;
        const keyNodeStr:string=KeyHelper.keyNodeToString(keys);
        if (keyNodeStr) {
            this.keys = [keyNodeStr];
            this.equalsFunction=(val:string,cmp:string) =>Helper.startsWith(cmp,val);
        } else {
            this.keys = keys as string[];
            this.equalsFunction=(val, cmp) => val === cmp;
        }
    }

    isCallbackFor(keylist:string[]|undefined):boolean {
        if (!keylist || keylist.length === 0) return true;
        if (!this.keys || this.keys.length === 0) return true;
        for (const val of this.keys) {
            for (const cmp of keylist) {
                if (this.equalsFunction(val,cmp)) return true;
            }
        }
        return false;
    }
    call(keys:string[]) {
        if (typeof (this.callback) === 'function') {
            return this.callback(keys);
        } else {
            return this.callback.dataChanged(keys);
        }
    }
}

export type HasCallback=(key:string)=>boolean;
export type ValueCallback=(key:string)=>StoreDataType;
export interface Provider{
    has:HasCallback;
    getValue:ValueCallback;
}

/**
 * @class
 * @constructor
 */
class Store {
    private callbacks: CallbackDescriptor[];
    private data: Record<string, StoreDataType>;
    private provider: Record<number, Provider>;
    private providerId: number;
    // @ts-ignore
    private name: string;
    constructor(name:string) {
        /**
         * @private
         * @type {CallbackDescriptor[]}
         */
        this.callbacks = [];
        this.data = {};
        this.provider = {}; //data provider for keys (prefixes)
        this.providerId=0;
        this.name=name;
    }

    /**
     *
     * @returns the id to be used for deregister
     * @param hasCallback
     * @param getValueCallback
     */
    registerProvider(hasCallback:HasCallback,getValueCallback:ValueCallback){
        this.providerId++;
        this.provider[this.providerId]={has:hasCallback,getValue:getValueCallback};
        return this.providerId;
    }

    deregisterProvider(providerId:number){
        delete this.provider[providerId];
    }
    /**
     * find a callback in the list of registered callbacks
     * @param {UpdateCallback||function} callback
     * @returns {number} - -1 if not found
     * @private
     */
    findCallback(callback:StoreCallback) {
        let i;
        for (i = 0; i < this.callbacks.length; i++) {
            if (this.callbacks[i].callback == callback) return i;
        }
        return -1;
    }


    /**
     * register a callback handler
     * @param {UpdateCallback||function} callback
     * @param ikeys list of keys, can be an object with the values being the keys or a keyNode - registering a prefix
     */
    register(callback:StoreCallback,...ikeys:StoreKeyType[]/*,...*/) {
        const args = Array.prototype.slice.call(ikeys);
        let keys:string[] = [];
        if (args.length == 1 && KeyHelper.keyNodeToString(args[0])) {
            keys = args[0];
        } else {
            args.forEach((arg:StoreKeyType)=> {
                if (arg === undefined) return;
                if (arg instanceof Array) {
                    keys = keys.concat(arg)
                } else if (arg instanceof Object) {
                    for (const k in arg) {
                        keys.push(arg[k])
                    }
                } else keys = keys.concat(arg);
            });
        }
        if (!callback) return;
        if (keys.length < 1) return;
        const idx = this.findCallback(callback);
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
    deregister(callback:StoreCallback) {
        const idx = this.findCallback(callback);
        if (idx < 0) return false;
        this.callbacks.splice(idx, 1);
        return true;
    }

    /**
     * fire the callbacks
     * @param keys - an array of keys
     * @param opt_omitHandler e reference to a handler to be omitted
     */
    callCallbacks(keys:string[], opt_omitHandler:any) {
        this.callbacks.forEach(function (cbItem) {
            if (opt_omitHandler) {
                if (opt_omitHandler === cbItem.callback) return;
                if (Array.isArray(opt_omitHandler)) {
                    for (const k in opt_omitHandler) {
                        if (opt_omitHandler[k] == cbItem.callback) return;
                    }
                }
            }
            if (cbItem.isCallbackFor(keys)) {
                cbItem.call(keys);
            }
        });
    }

    equalsData(d:any, c:any) {
        return shallowCompare(d, c);
    }

    /**
     * retrieve the data for a certain key
     * if no data is there undefined is returned
     * @param key
     * @param opt_default an optional default value
     * @param opt_ignoreProvider ignore any installed providers
     * @returns {*}
     */
    getData(key:string, opt_default?:StoreDataType,opt_ignoreProvider?:boolean) {
        let rt;
        let ext=false;
        if (! opt_ignoreProvider) {
            for (const k in this.provider) {
                if (this.provider[k].has(key)) {
                    rt = this.provider[k].getValue(key);
                    ext = true;
                    break;
                }
            }
        }
        if (! ext) {
            rt = this.data[key];
        }
        if (rt !== undefined) return rt;
        if (typeof opt_default === 'function') return opt_default();
        return opt_default;
    }

    /**
     * fetch an object containing the keys provided as parameter
     * @param keys single key or array or object (keys used and being translated)
     * @param opt_ignoreProvider
     */
    getMultiple(keys:StoreDataType,opt_ignoreProvider?:boolean) {
        let storeKeys = keys;
        const rt:Record<string, StoreDataType> = {};
        if (!(storeKeys instanceof Array)) {
            if (storeKeys instanceof Object) {
                for (const k in storeKeys) {
                    let v = undefined;
                    if (typeof (storeKeys[k]) === 'object') {
                        v = this.getMultiple(storeKeys[k],opt_ignoreProvider);
                    } else {
                        v = this.getData(storeKeys[k],undefined,opt_ignoreProvider);
                    }
                    rt[k] = v;
                }
                return rt;
            } else {
                storeKeys = [storeKeys];
            }
        }
        storeKeys.forEach((key:string) => {
            const v = this.getData(key,undefined,opt_ignoreProvider);
            rt[key] = v;
        });
        return rt;
    }


    /**
     * store a data item for a key and trigger the registered callbacks
     * @param key
     * @param data
     * @param opt_noCallbacks
     */
    storeData(key:string, data:StoreDataType, opt_noCallbacks?:boolean) {
        const hasChanged = !this.equalsData(this.data[key], data);
        this.data[key] = data;
        if (hasChanged && !(opt_noCallbacks === true)) this.callCallbacks([key], opt_noCallbacks);
        return hasChanged;
    }


    /**
     * update several values from an object with given translations
     * for the keys
     * @param data
     * @param keyTranslations objectKey:storeKey - can be undefined - no translations
     * @param opt_noCallbacks
     * @param opt_omitUndefined
     */
    storeMultiple(data: Record<string, StoreDataType>,
                  keyTranslations: Record<string, string>,
                  opt_noCallbacks:boolean,
                  opt_omitUndefined?:boolean) {
        let changeKeys: string[] = [];
        if (data === undefined && keyTranslations === undefined) return;
        for (const k in (keyTranslations !== undefined) ? keyTranslations : data) {
            const storeKey = (keyTranslations !== undefined) ? keyTranslations[k] : k;
            if (storeKey === undefined) continue;
            const v = (data !== undefined) ? data[k] : undefined;
            if (typeof (storeKey) === 'object') {
                const subChanged = this.storeMultiple(v, storeKey, true, opt_omitUndefined);
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


    getKeysByPrefix(prefix:string, opt_simpleValuesOnly?:boolean) {
        const rt:string[]= [];
        if (!prefix) return rt;
        for (let k in this.data) {
            if (k.startsWith(prefix)) {
                if (opt_simpleValuesOnly) {
                    if (typeof (this.data[k]) === 'object') continue;
                }
                rt.push(k);
            }
        }
        return rt;
    }
    deleteByPrefix(prefix:string) {
        for (const k of this.getKeysByPrefix(prefix)) {
            delete this.data[k];
        }
    }


}

export default Store;
