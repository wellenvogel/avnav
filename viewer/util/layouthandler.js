import Requests from './requests.js';
import Helper from './helper.js';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import KeyHandler from './keyhandler.js';
import base from '../base.js';
import assign from 'object-assign';

import defaultLayout from '../layout/default.json';
const DEFAULT_NAME="system.default";
class LayoutHandler{
    constructor(){
        this.layout=undefined;
        this.name=undefined;
        this.propertyDescriptions=KeyHelper.getKeyDescriptions(true);
        this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
        this.temporaryLayouts={};
        this.temporaryLayouts[DEFAULT_NAME]=defaultLayout;
        this.dataChanged=this.dataChanged.bind(this);
        this._setEditing(false);
        this.hiddenPanels={}; //panels we removed during editing
        this.temporaryOptions={}; //options being set during edit
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
        this.setTemporaryOptionValues();
    }
    isEditing(){
        return this.editing;
    }

    loadStoredLayout(opt_remoteFirst){
        let self=this;
        return new Promise((resolve,reject)=> {
            let layoutName=globalStore.getData(keys.properties.layoutName);
            //if we selected the default layout we will always use our buildin (if store locally)
            //or load from the server
            if (layoutName !== DEFAULT_NAME && ! opt_remoteFirst) {
                let storedLayout = this._loadFromStorage();
                if (storedLayout && (storedLayout.name == layoutName) && storedLayout.data) {
                    this.name = storedLayout.name;
                    this.layout = storedLayout.data;
                    this.temporaryLayouts[this.name] = this.layout;
                    self.activateLayout();
                    resolve(this.layout);
                    return;
                }
            }
            this.loadLayout(layoutName)
                .then((layout)=>{
                    this.activateLayout();
                    resolve(this.layout);
                })
                .catch((error)=>{
                    if (opt_remoteFirst) {
                        let storedLayout = this._loadFromStorage();
                        if (storedLayout && (storedLayout.name == layoutName) && storedLayout.data) {
                            this.name = storedLayout.name;
                            this.layout = storedLayout.data;
                            this.temporaryLayouts[this.name] = this.layout;
                            self.activateLayout();
                            resolve(this.layout);
                            return;
                        }
                    }
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
    loadLayout(name, opt_checkOnly){
        let self=this;
        if (! opt_checkOnly) {
            this.layout=undefined;
            this.name=name;
            this._setEditing(false);
        }
        return new Promise((resolve,reject)=> {
            if (this.storeLocally){
                if (!this.temporaryLayouts[name]) {
                    reject("layout "+name+" not found");
                }
                else {
                    let layout=this.temporaryLayouts[name];
                    if (! opt_checkOnly) this.layout=layout;
                    resolve(layout);
                }
                return;
            }
            Requests.getJson("?request=download&noattach=true&type=layout&name=" +
                encodeURIComponent(name), {checkOk: false}).then(
                (json)=> {
                    let error=self.checkLayout(json);
                    if (error !== undefined){
                        reject("layout error: "+error);
                        return;
                    }
                    if (! opt_checkOnly) this.layout = json;
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
                                if (! opt_checkOnly) {
                                    this.layout = layoutData.data;
                                    if (name.match(/^user\./)) {
                                        self.uploadLayout(name.replace(/^user\./, ''), this.layout)
                                            .then(() => {
                                            })
                                            .catch(() => {
                                            });
                                    }
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
        return name.replace(/^user\./,'').replace(/^system\./,'').replace(/^plugin\./,'').replace(/\.json$/,'').replace(/.*\./,'');
    }

    uploadLayout(name,layout,opt_overwrite){
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
                if (typeof(layout) === 'string') {
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
            Requests.postPlain({
                request:'upload',
                type:'layout',
                name: layoutName,
                overwrite: !! opt_overwrite
            }, JSON.stringify(layout,undefined,2)).
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


    getLayoutWidgets(){
        if (! this.layout || ! this.layout.widgets) return {};
        return this.layout.widgets;
    }
    activateLayout(upload){
        this._removeHiddenPanels();
        this._setEditing(false);
        if (!this.layout) return false;
        try {
            localStorage.setItem(
                globalStore.getData(keys.properties.layoutStoreName),
                JSON.stringify({name: this.name, data: this.layout}));
        }catch(e){
            base.log("unable to store layout locally")
        }
        KeyHandler.resetMerge(1);
        if (this.layout.keys){
           KeyHandler.mergeMappings(1,this.layout.keys);
        }
        globalStore.storeData(keys.properties.layoutName,this.name);
        this.incrementSequence();
        if (upload){
            this.uploadLayout(this.name,this.layout,true).then(()=>{}).catch((error)=>{
               base.log("unable to upload layout "+error);
            });
        }
        return true;
    }
    incrementSequence(){
        let ls=globalStore.getData(keys.gui.global.layoutSequence,0);
        globalStore.storeData(keys.gui.global.layoutSequence,ls+1);
    }

    _isHiddenPanel(page,panelname){
        if (! this.isEditing()) return false;
        let pd=this.hiddenPanels[page];
        if (!pd) return;
        return pd[panelname]?true:false;
    }
    _setHiddenPanel(page,panelname,hidden){
        let pd=this.hiddenPanels[page];
        if (!pd){
            pd={};
            this.hiddenPanels[page]=pd;
        }
        pd[panelname]=hidden;
    }

    _removeHiddenPanels(){
        if (! this.isEditing()) return;
        for (let pg in this.hiddenPanels){
            let pageData=this.getPageData(pg);
            if (!pageData) continue;
            let page=this.hiddenPanels[pg];
            for (let pn in page){
                if (! page[pn]) continue;
                delete pageData[pn];
            }
        }
        this.hiddenPanels={};
    }

    getPageData(page,opt_add){
        let widgets=this.getLayoutWidgets();
        if (!widgets) return;
        let pageData=widgets[page];
        if (! pageData){
            if (! this.isEditing() || ! opt_add)return;
            pageData={};
            widgets[page]=pageData;
        }
        if (typeof(pageData) !== 'object') return;
        return pageData;
    }

    getAllOptions(){
        let rt={};
        for (let k in this.OPTIONS){
            rt[this.OPTIONS[k]]=true;
        }
        return rt;
    }
    getOptionsAsArray(){
        let rt=[];
        for (let k in this.OPTIONS){
            rt.push(this.OPTIONS[k]);
        }
        return rt;
    }

    /**
     * get an array of panel names to try for the options being set
     * the last element is the basename and the first element is the name with the max amount of options
     * @param basename
     * @param options object with the keys being LayoutHandler.prototype.OPTIONS
     * @return {*[]}
     */
    getPanelTryList(basename,options){
        if (! options) options=[];
        let panelName=basename;
        let tryList=[panelName];
        for (let o in this.OPTIONS){
            if (options[this.OPTIONS[o]]){
                panelName+="_"+this.OPTIONS[o];
                tryList.push(panelName);
            }
        }
        let rt=[];
        for (let k=tryList.length-1;k>=0;k--){
            rt.push(tryList[k]);
        }
        return rt;
    }
    /**
     *
     * @param page
     * @param basename
     * @param options object with the keys being LayoutHandler.prototype.OPTIONS
     * @returns an object with {name:panelName, list: the data}
     */
    getPanelData(page,basename,options){
        let pageData=this.getPageData(page);
        if (!pageData) return {name:basename};
        let tryList=this.getPanelTryList(basename,options);
        for (let i=0;i<tryList.length;i++){
            let list=this.getDirectPanelData(page,tryList[i]);
            if (list) return {name:tryList[i],list:list};
        }
        return {name:basename};
    }


    /**
     * get the data for a panel (name already includes options)
     * if opt_add is true and we are editing - just add the structure if it is not there
     * @param page
     * @param panel
     * @param opt_add if set to true: create the panel (only possible if we are editing)
     * @return {*}
     */
    getDirectPanelData(page,panel,opt_add){
        let pageData=this.getPageData(page,opt_add);
        if (! pageData) return;
        let panelData=pageData[panel];
        if (! panelData) {
            if ((! opt_add) || (! this.isEditing())) return ;
            panelData=[];
            pageData[panel]=panelData;
        }
        if (this._isHiddenPanel(page,panel)){
            if (!opt_add) return;
            this._setHiddenPanel(page,panel,false);
        }
        return panelData;
    }

    removePanel(pagename,panel){
        if (!this.isEditing()) return false;
        this._setHiddenPanel(pagename,panel,true);
        return true;
    }

    getItem(page,panel,index){
        if (! this.isEditing()) return ;
        let panelData=this.getDirectPanelData(page,panel);
        if (!panelData) return;
        if (index < 0 || index >= panelData.length) return;
        return panelData[index];
    }

    getPagePanels(pagename){
        let rt=[];
        let pageData=this.getPageData(pagename);
        if (! pageData) return rt;
        for (let panelName in pageData){
            if (this._isHiddenPanel(pagename,panelName)) continue;
            //TODO: we should filter the allowed panels
            rt.push(panelName);
        }
        return rt;
    }


    /**
     * replace/add/remove a widget
     * @param page the page
     * @param panel the panel
     * @param index the item index, if opt_add is set: <0 insert at start, >= 0 append
     * @param item the item to be inserted, if undefined: remove
     * @param opt_add if set: add the item instead of replace/remove
     * @type ADD_MODES
     * @return {boolean} true if success
     */
    replaceItem(page,panel,index,item,opt_add){
        if (! this.isEditing()) return false;
        let allowAdd=opt_add !== undefined && opt_add !== this.ADD_MODES.noAdd;
        if (allowAdd && ! item) return false;
        let layoutItem={};
        if (item){
            for (let k in item){
                if (k === 'key') continue;
                if (k === 'index') continue;
                if (k === 'wclass') continue;
                if (typeof(item[k]) === 'function')continue;
                layoutItem[k]=item[k];
            }
        }
        let panelData=this.getDirectPanelData(page,panel,allowAdd);
        if (!panelData) return false;
        if (allowAdd) {
            if (opt_add == this.ADD_MODES.beginning) {
                //insert at the beginning
                panelData.splice(0, 0, layoutItem);
                this.incrementSequence();
                return true;
            }
            if (opt_add == this.ADD_MODES.end) {
                //append
                panelData.push(layoutItem);
                this.incrementSequence();
                return true;
            }
        }
        if (index < 0 || index >= panelData.length){
            return false;
        }
        if (allowAdd){
            if (opt_add == this.ADD_MODES.afterIndex){
                if (index == (panelData.length-1)){
                    panelData.push(layoutItem);
                }
                else {
                    panelData.splice(index + 1, 0, layoutItem)
                }
                this.incrementSequence();
                return true;
            }
            if (opt_add == this.ADD_MODES.beforeIndex){
                panelData.splice(index,0,layoutItem);
                this.incrementSequence();
                return true;
            }
            return false; //invalid add mode
        }
        if (item) {
            panelData.splice(index, 1, layoutItem);
        }
        else{
            panelData.splice(index, 1);
        }
        this.incrementSequence();
        return true;
    }

    moveItem(page,panel,oldIndex,newIndex){
        if (oldIndex == newIndex) return true;
        if (! this.isEditing()) return false;
        let panelData=this.getDirectPanelData(page,panel);
        if (!panelData) return false;
        if (oldIndex < 0 || oldIndex >= panelData.length) return false;
        if (newIndex < 0 || newIndex >= panelData.length) return false;
        let item=panelData[oldIndex];
        panelData.splice(oldIndex,1);
        panelData.splice(newIndex,0,item);
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
                       active: k == activeLayout,
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
                    if (activeLayout == fi.name) {
                        fi.canDelete = false;
                        fi.active=true;
                    }
                    list.push(fi);
                }
                resolve(list);
            }).catch((error)=>{reject(error)});

        });
    }

    /**
     * get a layout fetch function for downloads we handle this locally
     * @param name
     */
    getLocalDownload() {
        if (!this.storeLocally) return;
        return (name) => {
            let layout = this.temporaryLayouts[name];
            if (!layout) return;
            return JSON.stringify(layout, null, 2);
        };
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

    getStoreKeys(others){
        let rt={
            layoutSequence:keys.gui.global.layoutSequence,
            isEditing: keys.gui.global.layoutEditing
        };
        rt["layout"+this.OPTIONS.ANCHOR]=keys.nav.anchor.watchDistance;
        rt["layout"+this.OPTIONS.SMALL]=keys.gui.global.smallDisplay;
        return assign(rt,others);
    }
    setTemporaryOptionValues(options){
        if (! this.isEditing()) return;
        if (!options){
            this.temporaryOptions=this.getOptionValues(this.getOptionsAsArray(),true);
        }
        this.temporaryOptions=assign({},this.temporaryOptions,options);
        this.incrementSequence();
    }

    /**
     * get the values for layout options
     * @param handledOptions - array of handled options
     * @param opt_ignoreTemporary
     * @returns {{}}
     */
    getOptionValues(handledOptions,opt_ignoreTemporary){
        if (this.isEditing() && ! opt_ignoreTemporary){
            return this.temporaryOptions;
        }
        let rt={};
        let keys=this.getStoreKeys();
        handledOptions.forEach((option)=>{
            let storeKey=keys['layout'+option];
            if (storeKey){
                rt[option]=globalStore.getData(storeKey,false);
            }
        });
        return rt;
    }

}

LayoutHandler.prototype.OPTIONS={
    SMALL:'small',
    ANCHOR:'anchor'
};

LayoutHandler.prototype.ADD_MODES={
    noAdd:0,
    beginning: 1,
    end: 2,
    beforeIndex: 3,
    afterIndex: 4
};
export default  new LayoutHandler();