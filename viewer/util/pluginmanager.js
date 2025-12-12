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

const PREFIX="plugin";

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
class Plugin extends ApiV2{
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
    }
    getCssId(){
        return PREFIX+this.name;
    }
    setModule(module,shutdown){
        this.mjs=module;
        this.shutdown=shutdown;
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
    enable(){
        this.disabled=false;
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
    }
    getOrCreateApi(baseUrl,name){
        let rt=this.createdApis[name];
        if (rt) return rt;
        rt=new Plugin(baseUrl,name);
        this.createdApis[name]=rt;
        rt.enable();
        return rt;
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
        if (! globalstore.getData(keys.gui.capabilities.plugins)) return;
        const plugins=await this.query();
        if (!plugins || !(plugins instanceof Array)) {
            Toast("unable to query plugins");
            return;
        }
        const foundPlugins={};
        for (let plugin of plugins){
            const name=plugin.name;
            if (! name) continue;
            foundPlugins[name]=plugin.active;
            if (!plugin.active) continue;
            const api=this.getOrCreateApi(plugin.base,name);
            if (plugin.js){
                loadJs(plugin.js);
            }
            if (plugin.css){
                loadOrUpdateCss(plugin.css,api.getCssId());
            }
            if (plugin.mjs){
                try {
                    base.log("importing plugin.mjs for "+name);
                    const module = await import(/* webpackIgnore: true */ plugin.mjs);
                    let shutdown = undefined;
                    if (module && module.default) {
                        try {
                            shutdown = module.default(api.getApi());
                        }catch(e){
                            console.log("error calling default export for "+plugin.mjs,e);
                        }
                    }
                    api.setModule(module, shutdown);
                }catch (e){
                    console.log("unable to load module (plugin.mjs) "+name,e);
                }
            }
        }
        for (let pname in this.createdApis){
            if (!foundPlugins[pname]) {
                this.createdApis[pname].disable();
            }
        }
    }
}

export default new Pluginmanager();