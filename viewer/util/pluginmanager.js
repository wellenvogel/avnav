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
import Requests from "./requests";
import base from "../base";
import Toast from "../components/Toast";
import globalstore from "./globalstore";
import keys from "./keys";
import {ApiV2} from "./api";
import {loadJs, loadOrUpdateCss} from "./helper";

class PluginApi extends ApiV2 {
    #impl=undefined;
    constructor(impl) {
        super();
        this.#impl=impl;
    }

    getBaseUrl() {
        return this.#impl.getBaseUrl();
    }

    getPluginName() {
        return this.#impl.getBaseUrl();
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
}
export class Plugin extends ApiV2{
    constructor(baseUrl,name) {
        super();
        this.name=name;
        this.baseUrl=baseUrl;
        this.api=new PluginApi(this);
        this.disabled=false;
        this.mjs=undefined;
        this.shutdown=undefined;
        this.formatter=[];
        this.widgets=[];
        this.featureFormatter=[];
        this.moduleTs=undefined;
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
    }
    async loadModule(url,timestamp){
        try {
            base.log("importing plugin.mjs for "+this.name);
            const module = await import(/* webpackIgnore: true */ url);
            let shutdown = undefined;
            if (module && module.default) {
                try {
                    shutdown = module.default(this.getApi());
                }catch(e){
                    console.log("error calling default export for "+url,e);
                }
            }
            this.module=module;
            this.moduleTs=timestamp;
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
        super.registerWidget(description, opt_editableParameters);
    }

    registerFormatter(name, formatterFunction) {
        if (this.disabled) throw new Error("disabled");
        super.registerFormatter(name, formatterFunction);
    }

    registerFeatureFormatter(name, formatterFunction) {
        if (this.disabled) throw new Error("disabled");
        super.registerFeatureFormatter(name, formatterFunction);
    }

    getBaseUrl() {
        if (this.disabled) throw new Error("disabled");
        return this.baseUrl;
    }

    getPluginName() {
        if (this.disabled) throw new Error("disabled");
        return this.name;
    }
}
class Pluginmanager{
    constructor(){
        this.createdApis={}
        this.legacyJs={};
        this.css={};
    }
    cssId(pluginName) {
        return '___'+pluginName+"_css"
    }
    async query(){
        try {
            const json= await Requests.getJson({
                type: 'plugins',
                command: 'listFiles'
            });
            return json.data;
        }catch (e){
            base.log(`error querying plugins ${e}`)
        }
    }
    async start(){
        globalstore.register(()=>{
            this.update().then(()=>{},()=>{});
        },keys.nav.gps.updateconfig);
        await this.update();
    }
    deleteApi(api){
        if (!api) return;
        base.log(`deleteApi ${api.name}`);
        api.disable();
        delete this.createdApis[api.name];
    }
    async update(){
        if (! globalstore.getData(keys.gui.capabilities.plugins)) return;
        const plugins=await this.query();
        if (!plugins || !(plugins instanceof Array)) {
            Toast("unable to query plugins");
            return;
        }
        const foundPlugins={};
        for (let plugin of plugins) {
            const name = plugin.name;
            if (!name || !plugin.base) continue;
            if (!plugin.active) continue;
            foundPlugins[name] = plugin;
        }
        for (let pluginName in foundPlugins) {
            const plugin = foundPlugins[pluginName];
            let api = this.createdApis[pluginName];
            if (plugin.mjs) {
                if (!plugin.mjs.url || plugin.mjs.timestamp === undefined) {
                    this.deleteApi(api);
                } else {
                    if (!api || api.mustUpdate(plugin.mjs.timestamp)) {
                        this.deleteApi(api);
                    }
                    api = new Plugin(plugin.base, pluginName);
                    this.createdApis[pluginName] = api;
                    await api.loadModule(plugin.mjs.url, plugin.mjs.timestamp);
                }
            } else {
                this.deleteApi(api);
                if (plugin.js && plugin.js.url) {
                    if (!this.legacyJs[pluginName]) {
                        this.legacyJs[pluginName] = true;
                        base.log("load legacy js for plugin " + pluginName);
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
        for (let pname in this.createdApis){
            if (!foundPlugins[pname]) {
                this.deleteApi(this.createdApis[pname]);
            }
        }
        for (let pname in this.css){
            if (!foundPlugins[pname]) {
                base.log("deleting css for " + pname);
                loadOrUpdateCss(undefined, pname);
                delete this.css[pname];
            }
        }
    }
}

export default new Pluginmanager();