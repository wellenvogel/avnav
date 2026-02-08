/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
import Requests, {buildProxyUrl} from "./requests";
import base from "../base";
import Toast from "../components/Toast";
import globalstore from "./globalstore";
import keys from "./keys";
import {ApiV2} from "./api.impl";
import {injectDateIntoUrl, loadJs, loadOrUpdateCss, urlToString} from "./helper";
import widgetFactory from "../components/WidgetFactory";
import {listItems} from "./itemFunctions";
import FeatureFormatter from "./featureFormatter";
import {layoutLoader} from "./layouthandler";
import Addons from "../components/Addons";
import {layerFactory} from "../map/chartlayers";
import LocalStorageManager, {UNPREFIXED_NAMES} from "./localStorageManager";
import React from 'react';


class PluginApi extends ApiV2 {
    #impl=undefined;
    constructor(impl) {
        super();
        this.#impl=impl;
    }

    getBaseUrl() {
        return this.#impl.getBaseUrl();
    }


    buildProxyUrl(url,headers,proxyOptions) {
        return this.#impl.buildProxyUrl(url,headers,proxyOptions);
    }

    getPluginName() {
        return this.#impl.getPluginName();
    }

    registerWidget(description, opt_editableParameters) {
        this.#impl.registerWidget(description, opt_editableParameters);
    }

    registerFormatter(name, formatterFunction) {
        this.#impl.registerFormatter(name, formatterFunction);
    }

    registerFeatureFormatter(name, formatterFunction) {
        this.#impl.registerFeatureFormatter(name, formatterFunction);
    }

    registerLayoutData(name, layoutJson) {
        this.#impl.registerLayoutData(name, layoutJson);
    }

    registerLayout(name, url) {
        this.#impl.registerLayout(name, url);
    }

    registerUserApp(name, url, icon, title, newWindow) {
        this.#impl.registerUserApp(name, url, icon, title, newWindow);
    }

    registerUserButton(_button, _page) {
        this.#impl.registerUserButton(_button, _page);
    }

    registerUserMapLayer(_baseName, _name, _callback) {
        this.#impl.registerUserMapLayer(_baseName, _name, _callback);
    }


    getStoreBaseKey() {
        return this.#impl.getStoreBaseKey();
    }

    setStoreData(_key, _data) {
        this.#impl.setStoreData(_key, _data);
    }

    getStoreData(_key) {
        return this.#impl.getStoreData(_key);
    }

    showDialog(_dialog, _context) {
        return this.#impl.showDialog(_dialog, _context);
    }


    getLocalStorage(_key, _defaultv) {
        return this.#impl.getLocalStorage(_key, _defaultv);
    }

    setLocalStorage(_key, _data) {
        this.#impl.setLocalStorage(_key, _data);
    }

    async getConfig() {
        return await this.#impl.getConfig();
    }

}

/**
 * the api implementation for a plugin
 * in general there is no real need for it to extend ApiV2 directly as
 * all requests are handled by PluginApi above.
 * But with this dependency the IDE makes it easier to implement new methods
 */
export class Plugin extends ApiV2{
    constructor(manager,baseUrl,name) {
        super();
        this.name=name;
        this.baseUrl=baseUrl;
        this.api=new PluginApi(this);
        this.disabled=false;
        this.mjs=undefined;
        this.shutdown=undefined;
        this.registeredFormatters=[];
        this.widgets=[];
        this.featureFormatter=[];
        this.layouts=[];
        this.featureListFormatter=[];
        this.mapLayers=[];
        this.moduleTs=undefined;
        this.manager=manager;
    }
    getApi(){
        return this.api;
    }
    disable(){
        this.disabled=true;
        if (this.shutdown){
            try{
                this.shutdown(this.api);
            }catch (e){
                console.error("error in shutdown of "+this.name,e);
            }
        }
        this.widgets.forEach(widget => {
            if (! widget) return;
            try {
                base.log(`deregister widget ${widget} for ${this.name}`);
                widgetFactory.deregisterWidget(widget);
            }catch (e){
                console.error("error in deregisterWidget",widget,e);
            }
        })
        this.registeredFormatters.forEach(formatter => {
            if (! formatter) return;
            try{
                base.log(`deregister formatter ${formatter} for ${this.name}`);
                widgetFactory.deregisterFormatter(formatter);
            }catch(e){
                console.error("error in deregister formatter",formatter,e);
            }
        })
        this.featureFormatter.forEach(featureFormatter => {
            if (!featureFormatter) return;
            try{
                base.log(`deregister featureFormatter ${featureFormatter} for ${this.name}`);
                delete FeatureFormatter[featureFormatter];
            }catch(e){
                console.error("error in deregister featureFormatter",featureFormatter,e);
            }
        })
        layoutLoader.removePluginLayouts(this.name);
        Addons.removePluginAddOns(this.name);
        this.mapLayers.forEach(layer => {
            layerFactory.unregisterUserChartLayer(layer);
        })
        globalstore.deleteByPrefix(this.getStoreBaseKey());
    }
    async loadModule(url,timestamp,first){
        try {
            base.log("importing plugin.mjs for "+this.name);
            if (! first)
            {
                url = injectDateIntoUrl(new URL(url, window.location.href),timestamp);
            }
            const module = await import(/* webpackIgnore: true */ url);
            let shutdown = undefined;
            this.module=module;
            this.moduleTs=timestamp;
            if (module && module.default) {
                try {
                    shutdown = await module.default(this.getApi());
                }catch(e){
                    console.log("error calling default export for "+url,e);
                }
            }
            this.shutdown=shutdown;
        }catch (e){
            console.log("unable to load module (plugin.mjs) "+this.name,e);
        }
    }
    mustUpdate(timestamp){
        return timestamp !== this.moduleTs;
    }

    registerWidget(description, opt_editableParameters) {
        if (this.disabled) throw new Error("disabled");
        const name=widgetFactory.registerWidget(description, opt_editableParameters);
        if (name) {
            base.log(`registered Widget ${name} for ${this.name}`);
            this.widgets.push(name);
        }
    }

    registerFormatter(name, formatterFunction) {
        if (this.disabled) throw new Error("disabled");
        const fname=widgetFactory.registerFormatter(name,formatterFunction);
        if (fname) {
            this.registeredFormatters.push(fname);
            base.log(`registered formatter ${name} for ${this.name}`);
        }
    }

    registerFeatureFormatter(name, formatterFunction) {
        if (this.disabled) throw new Error("disabled");
        super.registerFeatureFormatter(name, formatterFunction);
        base.log(`registered featureformatter ${name} for ${this.name}`);
        this.featureFormatter.push(name);
    }


    getBaseUrl() {
        if (this.disabled) throw new Error("disabled");
        let rt=(new URL(this.baseUrl,window.location.href)).toString();
        if (! rt.endsWith("/")) rt+="/";
        return rt;
    }
    buildProxyUrl(url,headers,proxyOptions) {
        return buildProxyUrl(url,this.getBaseUrl(),headers,proxyOptions);
    }

    getPluginName() {
        if (this.disabled) throw new Error("disabled");
        return this.name===USERNAME?"":this.name;
    }

    _registerLayout(name,data,url){
        if (this.disabled) throw new Error("disabled");
        if (this.name === USERNAME) throw new Error("regsiterLayout only for plugins");
        const ts=data?this.moduleTs:undefined;
        const layoutname=layoutLoader.addPluginLayout(name,this.name,ts,data,url);
        if (layoutname){
            base.log(`registered layout ${name} for ${this.name}`);
            this.layouts.push(layoutname);
        }
    }

    registerLayoutData(name, layoutJson) {
        this._registerLayout(name, layoutJson);
    }

    registerLayout(name, url) {
        if (! url) throw Error("url must not be empty");
        url=urlToString(url,this.getBaseUrl());
        this._registerLayout(name, undefined,url);
    }

    registerUserApp(name, url, icon, title, newWindow) {
        if (! url) throw Error("url must not be empty");
        url=urlToString(url,this.getBaseUrl());
        if (! icon) throw Error("icon must not be empty");
        icon=urlToString(icon,this.getBaseUrl());
        Addons.addPluginAddOn({name,pluginName:this.name, url, icon, title, newWindow});
    }
    registerUserButton(button, page) {
        const buttonDef={...button};
        for (let k of ['icon']){
            if (k in buttonDef){
                buttonDef[k] = urlToString(buttonDef[k],this.getBaseUrl());
            }
        }
        Addons.addUserButton(this.name,buttonDef,page);
    }

    registerUserMapLayer(baseName, name, callback) {
        name=(this.name === USERNAME)?"user_"+name:"plugin_"+name;
        layerFactory.registerUserChartLayer(baseName, name, callback);
        this.mapLayers.push(name);
    }

    async getConfig() {
        const res=await Requests.getJson({
            type:'plugins',
            command:'pluginConfig',
            name:this.name,
        })
        return res.data;
    }


    getStoreBaseKey() {
        return "ext."+this.name;
    }

    setStoreData(key, data) {
        if (!key || ! key.startsWith(this.getStoreBaseKey())) throw new Error(`invalid store key ${key}`);
        globalstore.storeData(key, data);
    }

    getStoreData(key,defaultv) {
        return globalstore.getData(key,defaultv);
    }

    showDialog(dialog, context) {
        if (! this.manager.dialogStarter) throw new Error("cannot start a dialog in this state");
        for (let k of ['text','title']){
            if (dialog[k] !== undefined) {
                if ( typeof(dialog[k]) !== 'string' && ! React.isValidElement(dialog[k])) { throw new Error(`invalid dialog property ${k}: ${dialog[k]}`); }
            }
        }
        return this.manager.dialogStarter(context,dialog);
    }

    getLocalStorage(key, defaultv) {
        const name=this.name+"."+key;
        const rt=LocalStorageManager.getItem(UNPREFIXED_NAMES.EXTERNAL,name);
        if (! rt) return defaultv;
        return JSON.parse(rt);
    }

    setLocalStorage(key, data) {
        const name=this.name+"."+key;
        if (! data) LocalStorageManager.removeItem(UNPREFIXED_NAMES.EXTERNAL,name);
        else {
            const raw=JSON.stringify(data);
            LocalStorageManager.setItem(UNPREFIXED_NAMES.EXTERNAL,name,raw);
        }
    }

}
const USERFILES={
    js:'user.js',
    css:'user.css',
    mjs:'user.mjs'
};
const USERNAME='__avnavuser'; //must be disjunct from all plugin names
class Pluginmanager{
    constructor(){
        this.createdApis={}
        this.legacyJs={};
        this.css={};
        this.mjs={}
        this.updateRequests=0;
        this.dialogStarter=undefined;
    }
    cssId(pluginName) {
        return '_PL_'+pluginName+"_css"
    }
    async query(){
        try {
            const json= await Requests.getJson({
                type: 'plugins',
                command: 'pluginInfo'
            });
            return json.data;
        }catch (e){
            base.log(`error querying plugins ${e}`)
        }
    }
    async queryUser(){
        const rt={
            name:USERNAME,
            active:true,
        }
        try{
            const userList=await listItems('user');
            let urlBase;
            for (let item of userList) {
                for (let k in USERFILES) {
                    if (item.name === USERFILES[k] && item.url){
                        base.log("detected userfile "+item.name);
                        let timestamp=item.time;
                        if (k === 'css' && ! globalstore.getData(keys.properties.autoUpdateUserCss)){
                            timestamp=0; //no auto update
                        }
                        rt[k]={
                            url:item.url,
                            timestamp:timestamp
                        }
                        if (! urlBase ) {
                            urlBase=item.url.substring(0,item.url.lastIndexOf("/"));
                        }
                    }
                }
            }
            rt.base=urlBase;
        }catch (e){
            console.error("unable to query user files ",e);
        }
        return rt;
    }

    /**
     * for the update handling we need to prevent multiple updates from running
     * in parallel
     * As we cannot await the result (the store does not have an async API for that)
     * we construct a queue of update requests (max 2 entries)
     * Every callback from the store will enqueue an update request (simply be incrementing this.updateRequests)
     * nextUpdate: called when an update is done or on enqueue (triggerUpdate) if there is currently no update running
     * will decrement the counter (i.e. pick an update request from the queue) and start it with calling nextUpdate again
     * when finished
     */
    nextUpdate (){
        base.log("check next plugin updates, count="+this.updateRequests);
        if (this.updateRequests > 0){
            this.updateRequests--;
        }
        if (this.updateRequests < 1){
            //no more request in the queue
            return;
        }
        base.log("starting plugin update");
        this.update().then(() => {
            this.nextUpdate();
        }, () => {
            this.nextUpdate();
        })
    }

    /**
     * set the requestCount to 2
     * if there was no request running (old count == 0) nextUpdate is called
     * and this will start the update and set updateRequests to 1
     * if there is already a request running (old count > 0) we only set updateRequests to 2
     * if the update is finished it will call nextUpdate and start a new one
     */
    triggerUpdate() {
        const running=this.updateRequests>0;
        this.updateRequests = 2;
        if (!running) {
            this.nextUpdate();
        }
        else{
            base.log("delaying plugin update, count="+this.updateRequests);
        }
    }

    async start(){
        globalstore.register(()=>{
                this.triggerUpdate();
        },keys.nav.gps.updateconfig);
        base.log("initializing plugins");
        this.updateRequests=1; //we are running a request right now
        //on startup we really want to wait until the update is finished once
        await this.update();
        this.nextUpdate(); //maybe in the mean time new update requests have arrived
        globalstore.storeData(keys.gui.global.pluginLoadingDone,true);
    }
    deleteApi(api){
        if (!api) return false;
        base.log(`deleteApi ${api.name}`);
        api.disable();
        delete this.createdApis[api.name];
        return true;
    }
    async update(){
        if (! globalstore.getData(keys.gui.capabilities.plugins)) return;
        const queries=[];
        const foundPlugins={};
        queries.push(this.query().then((plugins)=>{
            if (!plugins || !(plugins instanceof Array)) {
                Toast("unable to query plugins");
                return;
            }
            for (let plugin of plugins) {
                const name = plugin.name;
                if (!name || !plugin.base) continue;
                if (!plugin.active) continue;
                foundPlugins[name] = plugin;
            }
        }));
        queries.push(this.queryUser().then((userFiles)=>{
            foundPlugins[userFiles.name] = userFiles;
        }));
        await Promise.all(queries);
        base.log("got plugin/user info");
        let unloadedJsChanges=false;
        let updatedMjs=false;
        let hasUpdates=false;
        const asyncActions=[];
        for (let pluginName in foundPlugins) {
            const plugin = foundPlugins[pluginName];
            let api = this.createdApis[pluginName];
            if (plugin.mjs) {
                if (!plugin.mjs.url || plugin.mjs.timestamp === undefined) {
                    hasUpdates = hasUpdates || this.deleteApi(api);
                } else {
                    if (!api || api.mustUpdate(plugin.mjs.timestamp)) {
                        base.log("update plugin "+plugin.name+" old api: "+api);
                        this.deleteApi(api);
                        hasUpdates = true;
                        const createPlugin=async()=> {
                            try {
                                api = new Plugin(this,plugin.base, pluginName);
                                //if the mjs has never been loaded or if the timestamp is still the same like on the first load
                                //there is no need to load the module again
                                const first = this.mjs[pluginName] === undefined || this.mjs[pluginName] === plugin.mjs.timestamp;
                                if (first) {
                                    this.mjs[pluginName] = plugin.mjs.timestamp;
                                } else {
                                    updatedMjs = true;
                                }
                                await api.loadModule(plugin.mjs.url, plugin.mjs.timestamp, first);
                                this.createdApis[pluginName] = api;
                            } catch (e) {
                                console.error("unable to create api and load module", plugin, e);
                                try {
                                    api.disable();
                                } catch (e) {
                                }
                            }
                        }
                        asyncActions.push(createPlugin());
                    }
                }
            } else {
                hasUpdates=hasUpdates || this.deleteApi(api);
                if (plugin.js && plugin.js.url) {
                    if (this.legacyJs[pluginName] === undefined) {
                        this.legacyJs[pluginName] = plugin.js.timestamp||0;
                        base.log("load legacy js for " + pluginName);
                        loadJs(plugin.js.url);
                    }
                }
            }
            if (plugin.css && plugin.css.url && plugin.css.timestamp) {
                const cssid = this.cssId(pluginName);
                const exixstingCss = this.css[pluginName];
                if (exixstingCss !== plugin.css.timestamp){
                    base.log("loading/updating css for " + pluginName);
                    loadOrUpdateCss(plugin.css.url, cssid);
                    this.css[pluginName]=plugin.css.timestamp;
                }
            }
        }
        await Promise.all(asyncActions);
        for (let pname in this.createdApis){
            if (!foundPlugins[pname]) {
                hasUpdates=hasUpdates || this.deleteApi(this.createdApis[pname]);
            }
        }
        for (let pname in this.css){
            if (!foundPlugins[pname]) {
                const cssid = this.cssId(pname);
                base.log("deleting css for " + pname);
                loadOrUpdateCss(undefined, cssid);
                delete this.css[pname];
            }
        }
        //for the legacy JS we know that all js entries have been now created
        //but maybe some of them have changed (other timestamp) or
        //there had been created ones that are not available any more
        //so when disabling a legacy plugin we need to inform the user that
        //there was a js change
        //but if later on enabling it again with unchanged code
        //there is no change any more
        for (let lname in this.legacyJs){
            if (!foundPlugins[lname] || ! foundPlugins[lname].js) {
                unloadedJsChanges = true;
                break;
            }
            else{
                if (foundPlugins[lname].js.timestamp !== this.legacyJs[lname]){
                    unloadedJsChanges = true;
                    break;
                }
            }
        }
        if (hasUpdates){
            globalstore.storeData(keys.gui.global.reloadSequence,globalstore.getData(keys.gui.global.reloadSequence,0)+1);
        }
        globalstore.storeData(keys.gui.global.unloadedJsChanges,unloadedJsChanges);
        if (updatedMjs){
            globalstore.storeData(keys.gui.global.updatedJsModules,true);
        }
    }
    setDialogStarter(starterFunction){
        this.dialogStarter=starterFunction;
    }
}

export default new Pluginmanager();