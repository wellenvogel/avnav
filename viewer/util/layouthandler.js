import Requests from './requests.js';
import Promise from 'promise';
import PropertyHandler from './propertyhandler.js';
import Helper from './helper.js';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import KeyHandler from './keyhandler.js';
import base from '../base.js';
import jsdownload from 'downloadjs';
import assign from 'object-assign';

import defaultLayout from '../layout/default.json';

class LayoutHandler{
    constructor(){
        this.layout=undefined;
        this.name=undefined;
        this.propertyDescriptions=KeyHelper.getKeyDescriptions(true);
        this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
        this.temporaryLayouts={};
        this.temporaryLayouts["system.default"]=defaultLayout;
        this.dataChanged=this.dataChanged.bind(this);
        this._setEditing(false);
        globalStore.register(this,keys.gui.capabilities.uploadLayout);
    }

    dataChanged(skeys){
        this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
    }

    hasLoaded(name){
        return (name == this.name && this.layout);
    }
    isActiveLayout(name){
        if (name === undefined) name=this.name;
        return name == globalStore.getData(keys.properties.layoutName);
    }

    canEdit(name){
        if (name === undefined) name=this.name;
        if (! name) return false;
        return name.match(/^user\./)?true:false;
    }
    startEditing(name){
        if (! this.canEdit(name)) return false;
        this.name=name;
        this._setEditing(true);
    }
    isEditing(){
        return this.editing;
    }

    loadStoredLayout(){
        let self=this;
        return new Promise((resolve,reject)=> {
            let layoutName=globalStore.getData(keys.properties.layoutName);
            let storedLayout=this._loadFromStorage();
            if (storedLayout && (storedLayout.name == layoutName) && storedLayout.data){
                this.name=storedLayout.name;
                this.layout=storedLayout.data;
                this.temporaryLayouts[this.name]=this.layout;
                self.activateLayout();
                resolve(this.layout);
                return;
            }
            this.loadLayout(layoutName)
                .then((layout)=>{
                    this.activateLayout();
                    resolve(this.layout);
                })
                .catch((error)=>{
                    let description=KeyHelper.getKeyDescriptions()[keys.properties.layoutName];
                    if (description && description.defaultv){
                        if (layoutName != description.defaultv){
                            globalStore.storeData(keys.properties.layoutName,description.defaultv);
                            self.loadLayout(description.defaultv).then(()=>{
                                self.activateLayout();
                                resolve(self.layout);
                            }).catch((error)=>{
                                reject("unable to load default layout: "+error);
                            })
                        }
                    }
                    else{
                        reject("unable to load application layout "+layoutName+": "+error);
                    }
                });
        });
    }

    /**
     * load a layout from local storage
     * @private
     * @returns a object with name,data
     */
    _loadFromStorage(){
        try {
            let raw = localStorage.getItem(
                globalStore.getData(keys.properties.layoutStoreName)
            );
            if (raw) {
                return JSON.parse(raw);
            }
        }catch(e){
            base.log("error when trying to read layout locally: "+e);
        }

    }
    _setEditing(on){
        this.editing=on;
        globalStore.storeData(keys.gui.global.layoutEditing,on);
    }

    /**
     * loads a layout but still does not activate it
     * @param name
     */
    loadLayout(name){
        let self=this;
        this.layout=undefined;
        this.name=name;
        this._setEditing(false);
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
            let layoutName=this.fileNameToServerName(name);
            let isActive=this.isActiveLayout(layoutName);
            if (this.storeLocally) {
                this.temporaryLayouts[layoutName] = layout;
                if (isActive){
                    this.name=layoutName;
                    this.layout=layout;
                    this.activateLayout();
                }
                resolve({status:'OK'});
                return;
            }
            Requests.postJson("?request=upload&type=layout&name=" + encodeURIComponent(name), layout).
                then((result)=>{
                    if (isActive){
                        this.name=layoutName;
                        this.layout=layout;
                        this.activateLayout();
                    }
                    resolve(result);
                }).
                catch((error)=>{
                    reject(error);
                })
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

    getLayoutWidgets(){
        if (! this.layout || ! this.layout.widgets) return {};
        return this.layout.widgets;
    }
    activateLayout(upload){
        this._setEditing(false);
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
        globalStore.storeData(keys.properties.layoutName,this.name);
        this.incrementSequence();
        if (upload){
            this.uploadLayout(this.name,this.layout).then(()=>{}).catch((error)=>{
               base.log("unable to upload layout "+error);
            });
        }
        return true;
    }
    incrementSequence(){
        let ls=globalStore.getData(keys.gui.global.layoutSequence,0);
        globalStore.storeData(keys.gui.global.layoutSequence,ls+1);
    }

    getItem(page,panel,index){
        if (! this.isEditing()) return ;
        let widgets=this.getLayoutWidgets();
        if (!widgets) return ;
        let pageData=widgets[page];
        if (! pageData) {
            return;
        }
        if (typeof(pageData) !== 'object') return;
        let panelData=pageData[panel];
        if (! panelData) {
            return;
        }
        if (index < 0 || index >= panelData.length) return;
        return panelData[index];
    }
    /**
     * replace/add/remove a widget
     * @param page the page
     * @param panel the panel
     * @param index the item index, if opt_add is set: <0 insert at start, >= 0 append
     * @param item the item to be inserted, if undefined: remove
     * @param opt_add if set: add the item instead of replace/remove
     * @return {boolean} true if success
     */
    replaceItem(page,panel,index,item,opt_add){
        if (! this.isEditing()) return false;
        let widgets=this.getLayoutWidgets();
        if (!widgets) return false;
        let pageData=widgets[page];
        if (! pageData) {
            if (! opt_add) return false;
            pageData={};
            widgets[page]=pageData;
        }
        if (typeof(pageData) !== 'object') return false;
        let panelData=pageData[panel];
        if (! panelData) {
            if (! opt_add) return false;
            panelData=[];
            pageData[panel]=panelData;
        }
        if (opt_add) {
            if (index < 0) {
                //insert at the beginning
                panelData.splice(0, 0, item);
                this.incrementSequence();
                return true;
            }
            if (index >=0 ) {
                //append
                panelData.push(item);
                this.incrementSequence();
                return true;
            }
            return false;
        }
        if (index < 0 || index >= panelData.length){
            return false;
        }
        if (item) {
            panelData.splice(index, 1, item);
        }
        else{
            panelData.splice(index, 1);
        }
        this.incrementSequence();
        return true;
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

    /**
     * delete an item if we handle this locally
     * return true if handled
     * @param name
     * @returns {boolean}
     */
    deleteItem(name){
        if (this.storeLocally){
            delete this.temporaryLayouts[name];
            return true;
        }
        return false;
    }

}

export default new LayoutHandler();