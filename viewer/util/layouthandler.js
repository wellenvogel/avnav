import Requests from './requests.js';
import Promise from 'promise';
import PropertyHandler from './propertyhandler.js';
import Helper from './helper.js';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import KeyHandler from './keyhandler.js';
import base from '../base.js';
import jsdownload from 'downloadjs';

import defaultLayout from '../layout/default.json';

class LayoutHandler{
    constructor(){
        this.layout=undefined;
        this.name=undefined;
        this.propertyDescriptions=KeyHelper.getKeyDescriptions(true);
        this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
        this.temporaryLayouts={};
        this.temporaryLayouts["system.default"]=defaultLayout;
    }

    hasLoaded(name){
        return (name == this.name && this.layout);
    }

    /**
     * loads a layout but still does not activate it
     * @param name
     */
    loadLayout(name){
        let self=this;
        this.layout=undefined;
        this.name=name;
        return new Promise((resolve,reject)=> {
            if (this.storeLocally){
                if (!this.temporaryLayouts[name]) {
                    reject("layout "+name+" not found");
                }
                else {
                    this.layout=this.temporaryLayouts[name];
                    resolve(this.temporaryLayouts[name]);
                }
                return;
            }
            Requests.getJson("?request=download&type=layout&name=" +
                encodeURIComponent(name), {checkOk: false}).then(
                (json)=> {
                    let error=self.checkLayout(json);
                    if (error !== undefined){
                        reject("layout error: "+error);
                        return;
                    }
                    this.layout = json;
                    resolve(json);
                },
                (error)=> {
                    try {
                        let raw = localStorage.getItem(
                            globalStore.getData(keys.properties.layoutStoreName)
                        );
                        if (raw) {
                            let layoutData=JSON.parse(raw);
                            if (layoutData.name == name && layoutData.data){
                                this.layout=layoutData.data;
                                if (name.match(/^user\./)) {
                                    self.uploadLayout(name.replace(/^user\./,''), this.layout)
                                        .then(()=>{})
                                        .catch(()=>{});
                                }
                                resolve(layoutData.data);
                                return;
                            }

                        }
                    }catch(e){
                        base.log("error when trying to read layout locally: "+e);
                    }
                    reject("" + error);
                }
            );
        });
    }

    nameToBaseName(name){
        return name.replace(/^user\./,'').replace(/^system\./,'').replace(/\.json$/,'');
    }

    uploadLayout(name,layout,isString){
        if (! name || ! layout){
            return new Promise((resolve,reject)=>{
               reject("missing parameter name or layout");
            });
        }
        //the provided name should always be without the user./system. prefix
        //when we upload we always create a user. entry...
        name=this.nameToBaseName(name);
        return new Promise((resolve, reject)=> {
            try {
                if (isString) {
                    layout = JSON.parse(layout);
                }
                let error = this.checkLayout(layout);
                if (error) {
                    reject(error);
                    return;
                }
            } catch (e) {
                reject(e);
                return;
            }
            if (this.storeLocally) {
                this.temporaryLayouts[this.fileNameToServerName(name)] = layout;
                resolve({status:'OK'});
                return;
            }
            resolve(Requests.postJson("?request=upload&type=layout&ignoreExisting=true&name=" + encodeURIComponent(name), layout));
        });
    }

    /**
     * get the name the server will create from our local file name when we upload a layout
     * @param name
     * @returns {string}
     */
    fileNameToServerName(name){
        name=this.nameToBaseName(name);
        return "user."+name;
    }

    /**
     * check the layout
     * returns an error string if there are errors
     * @param json
     */
    checkLayout(json){
        if (! json.layoutVersion) return "no layoutVersion found in layout";
        if (! json.widgets) return "no property widgets found in Layout";
        return;
    }

    /**
     * get the properties from the layout
     * @returns a flattened object with the properties
     */
    getLayoutProperties(){
        if (! this.layout || ! this.layout.properties) return {};
        let rt=[];
        Helper.filterObjectTree(this.layout.properties,(item,path)=>{
            let description=this.propertyDescriptions[path];
            if(description !== undefined && description.canChange){
                rt[path]=item;
            }
        },KeyHelper.keyNodeToString(keys.properties));
        return rt;
    }
    activateLayout(){
        if (!this.layout) return false;
        try {
            localStorage.setItem(
                globalStore.getData(keys.properties.layoutStoreName),
                JSON.stringify({name: this.name, data: this.layout}));
        }catch(e){
            base.log("unable to store layout locally")
        }
        KeyHandler.resetMerge();
        if (this.layout.keys){
           KeyHandler.mergeMappings(this.layout.keys);
        }
        if (! this.layout.widgets) return false;
        globalStore.storeData(keys.gui.global.layout,this.layout.widgets);
        let ls=globalStore.getData(keys.gui.global.layoutSequence,0);
        globalStore.storeData(keys.gui.global.layoutSequence,ls+1);
    }

    listLayouts(){
        return new Promise((resolve,reject)=>{
            let activeLayout=globalStore.getData(keys.properties.layoutName);
            if (this.storeLocally){
               let rt=[];
               for (let k in this.temporaryLayouts){
                   let item={
                       name:k,
                       type:'layout',
                       server:false,
                       canDelete:k != activeLayout,
                       time: (new Date()).getTime()/1000
                   };
                   rt.push(item);
               }
               resolve(rt);
               return;
            }
            Requests.getJson("?request=listdir&type=layout").then((json)=> {
                let list = [];
                for (let i = 0; i < json.items.length; i++) {
                    let fi = {};
                    assign(fi, json.items[i]);
                    fi.type = 'layout';
                    fi.server = true;
                    if (activeLayout == fi.name) fi.canDelete = false;
                    list.push(fi);
                }
                resolve(list);
            }).catch((error)=>{reject(error)});

        });
    }

    /**
     * download if there is a special handling
     * return true if we handled
     * @param name
     */
    download(name){
        let fileName=this.nameToBaseName(name)+".json";
        if (this.storeLocally){
            let layout=this.temporaryLayouts[name];
            if (! layout) return;
            jsdownload(JSON.stringify(layout,null,2),fileName,"application/json");
            return true;
        }
        return false;
    }

}

export default new LayoutHandler();