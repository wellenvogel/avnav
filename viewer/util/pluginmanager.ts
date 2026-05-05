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
import {Index, loadJs, loadOrUpdateCss, urlToString} from "./helper";
// @ts-ignore
import widgetFactory from "../components/WidgetFactory";
import {listItems} from "./itemFunctions";
// @ts-ignore
import FeatureFormatter from "./featureFormatter";
import {layoutLoader} from "./layouthandler";
import Addons from "./Addons";
// @ts-ignore
import {layerFactory} from "../map/chartlayers";
import LocalStorageManager, {UNPREFIXED_NAMES} from "./localStorageManager";
import React from 'react';
// @ts-ignore
import alarmhandler, {LOCAL_TYPES} from "../nav/alarmhandler";
import {
    DialogConfig,
    FeatureFormatterFunction,
    FormatterFunction,
    LayoutData,
    MapLayerProfiles,
    PluginPage,
    ProxyOptions,
    StoreData,
    UserApp,
    UserButton,
    UserButtonBase,
    UserMapLayerCallback
} from "../api/api.interface";
import addons from "./Addons";



class PluginApi extends ApiV2 {
    #impl:Plugin=undefined;
    constructor(impl:Plugin) {
        super();
        this.#impl=impl;
    }

    override getBaseUrl() {
        return this.#impl.getBaseUrl();
    }

    override buildProxyUrl(url:string|URL,headers?:Record<string, string>,proxyOptions?:ProxyOptions): string {
        return this.#impl.buildProxyUrl(url,headers,proxyOptions);
    }

    override getPluginName() {
        return this.#impl.getPluginName();
    }

    override registerWidget(description:Record<string, any>,
                            opt_editableParameters?:Record<string,any>) {
        this.#impl.registerWidget(description, opt_editableParameters);
    }

    override registerFormatter(name:string, formatterFunction:FormatterFunction) {
        this.#impl.registerFormatter(name, formatterFunction);
    }

    override registerFeatureFormatter(name:string, formatterFunction:FeatureFormatterFunction) {
        this.#impl.registerFeatureFormatter(name, formatterFunction);
    }

    override registerLayoutData(name:string, layoutJson:LayoutData) {
        this.#impl.registerLayoutData(name, layoutJson);
    }

    override registerLayout(name:string, url:string|URL) {
        this.#impl.registerLayout(name, url);
    }

    override registerUserApp(button:UserButtonBase,app:UserApp,page?:PluginPage|[PluginPage]) {
        this.#impl.registerUserApp(button,app,page);
    }

    override registerUserButton(button:UserButton, page:PluginPage|[PluginPage]):void {
        this.#impl.registerUserButton(button, page);
    }

    override registerUserMapLayer(baseName:MapLayerProfiles, name:string, callback:UserMapLayerCallback) {
        this.#impl.registerUserMapLayer(baseName, name, callback);
    }


    override getStoreBaseKey() {
        return this.#impl.getStoreBaseKey();
    }

    override setStoreData(key:string, data:StoreData) {
        this.#impl.setStoreData(key, data);
    }

    override getStoreData(key:string,defaultv?:StoreData) {
        return this.#impl.getStoreData(key,defaultv);
    }

    override showDialog(dialog:DialogConfig, context:object) {
        return this.#impl.showDialog(dialog, context);
    }


    override getLocalStorage(key:string, defaultv:StoreData) {
        return this.#impl.getLocalStorage(key, defaultv);
    }

    override setLocalStorage(key:string, data:StoreData|undefined) {
        this.#impl.setLocalStorage(key, data);
    }

    override async getConfig() {
        return await this.#impl.getConfig();
    }

}

/**
 * the api implementation for a plugin
 * in general there is no real need for it to extend ApiV2 directly as
 * all requests are handled by PluginApi above.
 * But with this dependency the IDE makes it easier to implement new methods
 */
class Plugin extends ApiV2{
    name: string;
    private baseUrl: string;
    private api: PluginApi;
    private disabled: boolean;
    // @ts-ignore
    private mjs: string;
    private shutdown: (api:ApiV2)=>void;
    private registeredFormatters: string[];
    private widgets: string[];
    private featureFormatter: string[];
    private mapLayers: string[];
    private moduleTs: number;
    private manager: Pluginmanager;
    // @ts-ignore
    private module: any;
    constructor(manager:Pluginmanager,baseUrl:string,name:string) {
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
    async loadModule(url:string|URL,timestamp:number){
        try {
            base.log(`importing ${url} for ${this.name}`);
            url=this.baseUrl+url;
            // @ts-ignore
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
    mustUpdate(timestamp:number){
        return timestamp !== this.moduleTs;
    }

    override registerWidget(description:Record<string, any>,
                            opt_editableParameters?:Record<string, any>):void {
        if (this.disabled) throw new Error("disabled");
        const name=widgetFactory.registerWidget(description, opt_editableParameters);
        if (name) {
            base.log(`registered Widget ${name} for ${this.name}`);
            this.widgets.push(name);
        }
    }

    override registerFormatter(name:string, formatterFunction:FormatterFunction) {
        if (this.disabled) throw new Error("disabled");
        const fname=widgetFactory.registerFormatter(name,formatterFunction);
        if (fname) {
            this.registeredFormatters.push(fname);
            base.log(`registered formatter ${name} for ${this.name}`);
        }
    }

    override registerFeatureFormatter(name:string, formatterFunction:FeatureFormatterFunction) {
        if (this.disabled) throw new Error("disabled");
        super.registerFeatureFormatter(name, formatterFunction);
        base.log(`registered featureformatter ${name} for ${this.name}`);
        this.featureFormatter.push(name);
    }


    override getBaseUrl() {
        if (this.disabled) throw new Error("disabled");
        return this.baseUrl;
    }
    override buildProxyUrl(url:string|URL,headers?:Record<string,string>,
                           proxyOptions?:ProxyOptions):string {
        return buildProxyUrl(url,this.getBaseUrl(),headers,proxyOptions);
    }

    override getPluginName() {
        if (this.disabled) throw new Error("disabled");
        return this.name===USERNAME?"":this.name;
    }

    _registerLayout(name:string,data:LayoutData,url?:string|URL){
        if (this.disabled) throw new Error("disabled");
        if (this.name === USERNAME) throw new Error("regsiterLayout only for plugins");
        const ts=data?this.moduleTs:undefined;
        const layoutname=layoutLoader.addPluginLayout(name,this.name,ts,data,url);
        if (layoutname){
            base.log(`registered layout ${name} for ${this.name}`);
        }
    }

    override registerLayoutData(name:string, layoutJson:LayoutData) {
        this._registerLayout(name, layoutJson);
    }

    override registerLayout(name:string, url:string|URL) {
        if (! url) throw Error("url must not be empty");
        url=urlToString(url,this.getBaseUrl());
        this._registerLayout(name, undefined,url);
    }

    override registerUserApp(button:UserButtonBase,app:UserApp,page?:PluginPage|[PluginPage]):void {
        if (! app.url) throw Error("url must not be empty");
        const url=urlToString(app.url,this.getBaseUrl());
        if (! button.icon) throw Error("icon must not be empty");
        const icon=urlToString(button.icon,this.getBaseUrl());
        Addons.addPluginAddOn({name:button.name,
            pluginName:this.name,
            url,
            button:{...button,icon:icon},
            title:app.title,
            newWindow:app.newWindow,
            page:page});
    }
    override registerUserButton(button:UserButton, page:PluginPage|[PluginPage]):void {
        const buttonDef={...button};
        for (const k of ['icon']){
            if (k in buttonDef){
                // @ts-ignore
                buttonDef[k] = urlToString(buttonDef[k],this.getBaseUrl());
            }
        }
        Addons.addUserButton(this.name,buttonDef,page);
    }

    override registerUserMapLayer(baseName:MapLayerProfiles,
                                  name:string,
                                  callback:UserMapLayerCallback) {
        name=(this.name === USERNAME)?"user_"+name:"plugin_"+name;
        layerFactory.registerUserChartLayer(baseName, name, callback);
        this.mapLayers.push(name);
    }

    override async getConfig() {
        const res=await Requests.getJson({
            type:'plugins',
            command:'pluginConfig',
            name:this.name,
        })
        return res.data;
    }


    override getStoreBaseKey() {
        return "ext."+this.name;
    }

    override setStoreData(key:string, data:StoreData) {
        if (!key || ! key.startsWith(this.getStoreBaseKey())) throw new Error(`invalid store key ${key}`);
        globalstore.storeData(key, data);
    }

    override getStoreData(key:string,defaultv:StoreData) {
        return globalstore.getData(key,defaultv);
    }

    override showDialog(dialog:DialogConfig, context:object):Promise<()=>void> {
        if (! this.manager.dialogStarter) throw new Error("cannot start a dialog in this state");
        for (const k of ['text','title']){
            const v=Index<DialogConfig>(dialog,k);
            if (v !== undefined) {
                if ( typeof(v) !== 'string' && ! React.isValidElement(v)) { throw new Error(`invalid dialog property ${k}: ${v}`); }
            }
        }
        return this.manager.dialogStarter(context,dialog);
    }

    override getLocalStorage(key:string, defaultv?:StoreData) {
        const name=this.name+"."+key;
        const rt=LocalStorageManager.getItem(UNPREFIXED_NAMES.EXTERNAL,name);
        if (! rt) return defaultv;
        return JSON.parse(rt);
    }

    setLocalStorage(key:string, data:StoreData) {
        const name=this.name+"."+key;
        if (! data) LocalStorageManager.removeItem(UNPREFIXED_NAMES.EXTERNAL,name);
        else {
            const raw=JSON.stringify(data);
            LocalStorageManager.setItem(UNPREFIXED_NAMES.EXTERNAL,name,raw);
        }
    }

}
const USERFILES:Record<string,string>={
    js:'user.js',
    css:'user.css',
    mjs:'user.mjs'
};
const USERNAME='__avnavuser'; //must be disjunct from all plugin names
interface PluginBaseConfig{
    name:string;
    active:boolean;
    base?:string;
}
type PluginConfig = Record<keyof typeof USERFILES, {
    url:string,
    timestamp:number
}> & PluginBaseConfig

class Pluginmanager{
    private css: Record<string,number>={};
    dialogStarter : (context: object, dialog: DialogConfig) => Promise<()=>void>
    private createdApis: Record<string, Plugin>={};
    private legacyJs: Record<string, number>={};
    private mjs:Record<string,number>={};
    private updateRequests:number=0;
    constructor(){
        this.dialogStarter=undefined;
    }
    cssId(pluginName:string) {
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
        const rt:PluginConfig={
            name:USERNAME,
            active:true,
        } as PluginConfig;
        try{
            const userList=await listItems('user');
            let urlBase;
            for (const item of userList) {
                for (const k in USERFILES) {
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
        addons.updateAddonCss(); //must be created before all plugin and user css
        this.updateRequests=1; //we are running a request right now
        //on startup we really want to wait until the update is finished once
        await this.update();
        this.nextUpdate(); //maybe in the mean time new update requests have arrived
        globalstore.storeData(keys.gui.global.pluginLoadingDone,true);
    }
    deleteApi(api:Plugin){
        if (!api) return false;
        base.log(`deleteApi ${api.name}`);
        api.disable();
        delete this.createdApis[api.name];
        return true;
    }
    async update(){
        if (! globalstore.getData(keys.gui.capabilities.plugins)) return;
        const queries=[];
        const foundPlugins:Record<string,PluginConfig>={};
        queries.push(this.query().then((plugins)=>{
            if (!plugins || !(plugins instanceof Array)) {
                throw new Error("no plugins returned")
            }
            for (const plugin of plugins) {
                const name = plugin.name;
                if (!name || !plugin.base) continue;
                if (!plugin.active) continue;
                foundPlugins[name] = plugin;
            }
        }));
        queries.push(this.queryUser().then((userFiles)=>{
            foundPlugins[userFiles.name] = userFiles;
        }));
        try {
            await Promise.all(queries);
        }catch (e){
            base.error("unable to query plugins",e);
            if (alarmhandler.isBlocked(LOCAL_TYPES.connectionLost)) return;
            Toast("unable to query plugins");
            return;
        }
        base.log("got plugin/user info");
        let unloadedJsChanges=false;
        let updatedMjs=false;
        let hasUpdates=false;
        const asyncActions=[];
        for (const pluginName in foundPlugins) {
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
                                //if the mjs has never been loaded or if the timestamp is still the same like on the first load
                                //there is no need to load the module again
                                const first = this.mjs[pluginName] === undefined || this.mjs[pluginName] === plugin.mjs.timestamp;
                                let base=(new URL(plugin.base,window.location.href)).toString();
                                if (! base.endsWith("/")) base+="/";
                                if (! first){
                                    base+="__"+plugin.mjs.timestamp+"/";
                                }
                                api = new Plugin(this,base, pluginName);
                                if (first) {
                                    this.mjs[pluginName] = plugin.mjs.timestamp;
                                } else {
                                    updatedMjs = true;
                                }
                                await api.loadModule((pluginName === USERNAME)?"user.mjs":"plugin.mjs", plugin.mjs.timestamp);
                                this.createdApis[pluginName] = api;
                            } catch (e) {
                                console.error("unable to create api and load module", plugin, e);
                                try {
                                    api.disable();
                                } catch (e) { /* empty */ }
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
                    hasUpdates=true
                }
            }
        }
        await Promise.all(asyncActions);
        for (const pname in this.createdApis){
            if (!foundPlugins[pname]) {
                hasUpdates=hasUpdates || this.deleteApi(this.createdApis[pname]);
            }
        }
        for (const pname in this.css){
            if (!foundPlugins[pname]) {
                const cssid = this.cssId(pname);
                base.log("deleting css for " + pname);
                loadOrUpdateCss(undefined, cssid);
                delete this.css[pname];
                hasUpdates=true;
            }
        }
        //for the legacy JS we know that all js entries have been now created
        //but maybe some of them have changed (other timestamp) or
        //there had been created ones that are not available any more
        //so when disabling a legacy plugin we need to inform the user that
        //there was a js change
        //but if later on enabling it again with unchanged code
        //there is no change any more
        for (const lname in this.legacyJs){
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
    setDialogStarter(starterFunction:(context: object, dialog: DialogConfig) => Promise<()=>void>){
        this.dialogStarter=starterFunction;
    }

}

export default new Pluginmanager();