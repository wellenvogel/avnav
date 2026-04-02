import Requests from './requests';
import globalStore from './globalstore';
import keys, {DEFAULT_LAYOUT_NAME, KeyHelper, PropertyValue} from './keys';
import KeyHandler, {KeyMappings} from './keyhandler';
import base from '../base';
import LocalStorage, {STORAGE_NAMES} from './localStorageManager';
// @ts-ignore
import defaultLayout from '../layout/default.json';
// @ts-ignore
import cloneDeep from "clone-deep";
import Helper, {valueof} from "./helper";
import {PageType} from "./pageids";
import {Item} from "./itemFunctions";

export enum ACTIONS {
    ACTION_MOVE = 1,
    ACTION_ADD = 2,
    ACTION_REPLACE = 3,
    ACTION_DELETE = 4
}
export enum LAYOUT_OPTIONS{
        SMALL='small',
        ANCHOR='anchor'
}

export enum ADD_MODES{
    noAdd=0,
    beginning= 1,
    end= 2,
    beforeIndex= 3,
    afterIndex= 4
}


/**
 * an object with the keys being the enum values
 */
export type LayoutOptionFlags=Partial<Record<valueof<typeof LAYOUT_OPTIONS>,boolean>>;

export type LayoutPage=PageType|{layoutPage?:PageType,location?:PageType};
export interface LayoutData{
    keys?: KeyMappings;
    css?: string;
    layoutVersion:string|number;
    widgets?:Record<string, any>;
    properties?:Record<string, PropertyValue>;
}
/**
 * allow pagename to be an object with the mane being in location
 * @param page
 * @returns {*|string}
 */
const getPagename=(page:LayoutPage):  string=>{
    if (page === undefined) return;
    if (typeof(page) === 'string') return page;
    return page.layoutPage || page.location;
}

class PluginLayout{
    name: string;
    url: URL | string;
    timestamp: number;
    data: LayoutData;
    pluginName: string;
    constructor(name:string,pluginName:string,timestamp:number,url:URL|string,data:LayoutData) {
        this.name=name;
        this.url=url;
        this.timestamp=timestamp;
        this.data=data;
        this.pluginName=pluginName;
    }
}
export type LayoutItem=Record<string, any>;
export interface ActionOptions{
    addMode?: ADD_MODES;
    oldIndex?:number;
    index?:number;
    newIndex?:number;
    newPanel?:string
    item?:LayoutItem
}
export interface ActionHandler{
    moveItem:(page:string,panel:string,oldIndex:number,newIndex:number,newPanel:string) => boolean,
    replaceItem:(page:string,panel:string,index:number,item?:LayoutItem,addMode?:ADD_MODES)=>boolean,

}
class LayoutAction{
    private action: ACTIONS;
    private page: string;
    private panel: string;
    private options: ActionOptions;
    pageWithProps: LayoutPage;
    constructor(action:ACTIONS,page:string,panel:string,options:ActionOptions) {
        this.action=action;
        this.page=page;
        this.panel=panel;
        this.options=options;
    }
    run(handler:ActionHandler):boolean{
        if (this.action === ACTIONS.ACTION_MOVE){
            return handler.moveItem(this.page,this.panel,this.options.oldIndex,this.options.newIndex,this.options.newPanel)
        }
        if (this.action === ACTIONS.ACTION_REPLACE){
            return handler.replaceItem(this.page,this.panel,this.options.index,this.options.item)
        }
        if (this.action === ACTIONS.ACTION_DELETE){
            return handler.replaceItem(this.page,this.panel,this.options.index)
        }
        if (this.action === ACTIONS.ACTION_ADD){
            return handler.replaceItem(this.page,this.panel,this.options.index,this.options.item,this.options.addMode)
        }
        return false;
    }
}

class LayoutTransaction{
    pageWithProps: { location?: string ,layoutPage?:string};
    actions: LayoutAction[];
    constructor(pageWithProps:LayoutPage) {
        if (typeof(pageWithProps) === 'string'){
            this.pageWithProps={
                location: pageWithProps
            }
        }
        else {
            this.pageWithProps = pageWithProps;
        }
        this.actions=[];
    }
    add(action:LayoutAction){
        this.actions.push(action);
    }
    run(handler:ActionHandler){
        let rt=false;
        this.actions.forEach((action)=>{
            if (action.run(handler)) rt=true;
        })
        return rt;
    }
    hasActions(){
        return this.actions.length > 0;
    }
}

export class LayoutAndName{
    name: string;
    layout: LayoutData;
    constructor(name:string,layout:LayoutData) {
        this.name = name;
        this.layout = layout;
    }
}
const USER_PREFIX="user.";
class LayoutLoader{
    private storeLocally: boolean;
    private temporaryLayouts: Record<string, LayoutData>;
    private pluginLayouts: Record<string, PluginLayout>;
    private prefixes:Record<string, string>;
    constructor() {
        this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
        this.temporaryLayouts={};
        this.temporaryLayouts[DEFAULT_LAYOUT_NAME]=defaultLayout;
        globalStore.register(()=>{
            this.storeLocally=!globalStore.getData(keys.gui.capabilities.uploadLayout,false);
        },keys.gui.capabilities.uploadLayout);
        this.pluginLayouts={};
        this.prefixes={};
    }

    async init(){
        await Requests.getJson({
            type:'layout',
            command:'prefixes'
        }).then((json)=>{
            this.prefixes=json.data
        },()=>{})
    }
    /**
     * load a layout from local storage
     * @private
     * @returns a object with name,data
     */
    _loadFromStorage(){
        try {
            const raw = LocalStorage.getItem(
                STORAGE_NAMES.LAYOUT
            );
            if (raw) {
                return JSON.parse(raw);
            }
        }catch(e){
            base.log("error when trying to read layout locally: "+e);
        }

    }

    async loadStoredLayout(opt_remoteFirst?:boolean) {
        const layoutName = globalStore.getData(keys.properties.layoutName);
        //if we selected the default layout we will always use our buildin (if store locally)
        //or load from the server
        if (layoutName !== DEFAULT_LAYOUT_NAME && !opt_remoteFirst) {
            const storedLayout = this._loadFromStorage();
            if (storedLayout && (storedLayout.name == layoutName) && storedLayout.data) {
                this.temporaryLayouts[storedLayout.name] = storedLayout;
                return Promise.resolve(new LayoutAndName(storedLayout.name, storedLayout.data));
            }
        }
        try {
            const layout = await this.loadLayout(layoutName);
            return new LayoutAndName(layoutName, layout);
        } catch (error) {
            if (opt_remoteFirst) {
                const storedLayout = this._loadFromStorage();
                if (storedLayout && (storedLayout.name == layoutName) && storedLayout.data) {
                    this.temporaryLayouts[storedLayout.name] = storedLayout.data;
                    return new LayoutAndName(storedLayout.name, storedLayout.data);
                }
            }
            const description = KeyHelper.getKeyDescriptions()[keys.properties.layoutName];
            if (description && description.defaultv) {
                if (layoutName != description.defaultv) {
                    globalStore.storeData(keys.properties.layoutName, description.defaultv);
                    try {
                        const dlayout = await this.loadLayout(description.defaultv as string);
                        return new LayoutAndName(description.defaultv as string, dlayout);
                    } catch (error) {
                        throw new Error("unable to load default layout: " + error);
                    }
                } else {
                    throw new Error("unable to load application layout " + layoutName + ": " + error);
                }
            }
        }
    }
    /**
     * loads a layout but still does not activate it
     * @param name
     * @param opt_raw
     */
    async loadLayout(name:string,opt_raw?:boolean) {
        if (this.storeLocally) {
            if (!this.temporaryLayouts[name]) {
                return Promise.reject("layout " + name + " not found");
            } else {
                const layout = this.temporaryLayouts[name];
                if (opt_raw){
                    return Promise.resolve(JSON.stringify(layout,undefined, 2));
                }
                return Promise.resolve(layout);
            }
        }
        try {
            let layoutJson;
            const pluginLayout = this.pluginLayouts[name];
            if (pluginLayout) {
                if (pluginLayout.data){
                    layoutJson = pluginLayout.data;
                }
                if (pluginLayout.url){
                    const layout=await Requests.getHtmlOrText(pluginLayout.url);
                    if (layout){
                        layoutJson=JSON.parse(layout);
                    }
                    else{
                        throw new Error("unable to load plugin layout "+pluginLayout.url);
                    }
                }
            }
            else {
                layoutJson = await Requests.getJson({
                    request: 'api',
                    type: 'layout',
                    command: 'download',
                    noattach: true,
                    name: name
                }, {checkOk: false});
            }
            if (!layoutJson) {
                throw new Error("unable to load layout "+name);
            }
            const error = this.checkLayout(layoutJson);
            if (error !== undefined) {
                throw new Error("layout error: " + error);
            }
            if (opt_raw) {
                return JSON.stringify(layoutJson, undefined, 2);
            }
            return layoutJson;
        }catch (error)
            {
                try {
                    const raw = LocalStorage.getItem(
                        STORAGE_NAMES.LAYOUT
                    );
                    if (raw) {
                        const layoutData = JSON.parse(raw);
                        if (layoutData.name == name && layoutData.data) {
                            return layoutData.data;
                        }
                    }
                } catch (e) {
                    base.log("error when trying to read layout locally: " + e);
                }
                throw error;
            }

    }

    /**
     * upload a layout to the server
     * @param name the layout name without user prefix and without .json
     * @param layout
     * @param opt_overwrite
     * @param opt_completeName
     * @returns {Promise<never>|Promise<Awaited<{status: string}>>|Promise<unknown>}
     */
    uploadLayout(
        name:string,
        layout:LayoutData|string,
        opt_overwrite?:boolean,
        opt_completeName?:boolean) {
        if (!name || !layout) {
            return Promise.reject("missing parameter name or layout");
        }
        //the provided name should always be without the user./system. prefix
        //when we upload we always create a user. entry...
        let parsedLayout:LayoutData;
        try {
            if (typeof (layout) === 'string') {
                parsedLayout = JSON.parse(layout);
            }
            else{
                parsedLayout = layout;
            }
            const error = this.checkLayout(parsedLayout);
            if (error) {
                return Promise.reject(error);
            }
        } catch (e) {
            return Promise.reject(e);
        }
        if (this.storeLocally) {
            const localName=opt_completeName?name:USER_PREFIX+name;
            this.temporaryLayouts[localName] = parsedLayout;
            return Promise.resolve({status: 'OK'});
        }
        return Requests.postPlain({
            request:'api',
            command: 'upload',
            type: 'layout',
            name: name,
            overwrite: !!opt_overwrite,
            completeName:!!opt_completeName,
        }, JSON.stringify(parsedLayout, undefined, 2))
    }
    /**
     * check the layout
     * returns an error string if there are errors
     * @param json
     */
    checkLayout(json:LayoutData){
        if (! json.layoutVersion) return "no layoutVersion found in layout";
        if (! json.widgets) return "no property widgets found in Layout";
        return;
    }

    async listLayouts():Promise<Item[]> {
        const activeLayout = globalStore.getData(keys.properties.layoutName);
        if (this.storeLocally) {
            const rt = [];
            for (const k in this.temporaryLayouts) {
                const item:Item = {
                    name: k,
                    type: 'layout',
                    server: false,
                    canDelete: k != activeLayout,
                    active: k == activeLayout,
                    checkPrefix: USER_PREFIX,
                    time: (new Date()).getTime() / 1000
                };
                rt.push(item);
            }
            return rt;
        }
        const layouts=await Requests.getJson({
            request:'api',
            type:'layout',
            command:'list'
        }).then((json) => {
            const list = [];
            for (let i = 0; i < json.items.length; i++) {
                const fi={...json.items[i]};
                fi.type = 'layout';
                fi.server = true;
                if (activeLayout == fi.name) {
                    fi.canDelete = false;
                    fi.active = true;
                }
                list.push(fi);
            }
            return list;
        });
        for (const k in this.pluginLayouts){
            layouts.push({
                name:k,
                server: false,
                canDelete: false,
                canDownload: true,
                active: k == activeLayout,
                type:'layout',
                time: this.pluginLayouts[k].timestamp,
                downloadName: this.pluginLayouts[k].name+".json"
            })
        }
        return layouts;
    }

    /**
     * delete an item
     * resolves true if handled
     * @param name
     * @returns {Promise}
     */
    deleteLayout(name:string){
        if (this.storeLocally) {
                delete this.temporaryLayouts[name];
                return Promise.resolve(true);
        }
        return Requests.getJson({
            request:'api',
            command: 'delete',
            type: 'layout',
            name: name
        })
    }
    renameLayout(name:string,newName:string){
        if (! name) throw new Error("no name for deleteLayout");
        if (! name.startsWith(USER_PREFIX)){
            throw new Error("can only rename user layouts");
        }
        if (! newName.startsWith(USER_PREFIX)){
            throw new Error("the new layout name must also start with "+USER_PREFIX);
        }
        if (this.storeLocally){
            if (this.temporaryLayouts[newName]) {
                throw new Error("layout " + newName + " already exists");
            }
            const layout=this.temporaryLayouts[name];
            if (! layout) throw new Error("layout "+name+" not found");
            delete this.temporaryLayouts[name];
            this.temporaryLayouts[newName] = layout;
            return Promise.resolve(true);
        }
        return Requests.getJson({
            command:'rename',
            type:'layout',
            name: name,
            newName: newName
        })
    }
    getUserPrefix(){
        return USER_PREFIX;
    }
    addPluginLayout(
        name:string,
        pluginName:string,
        timestamp:number,
        data?:LayoutData,
        url?:string|URL){
        if (! this.prefixes || ! this.prefixes.plugin) throw Error("no support for plugin layouts");
        if (! name || ! pluginName) throw new Error("name and pluginName must be set");
        if (! data && ! url) throw new Error("either url or data must be set for a plugin layout");
        if (data){
            this.checkLayout(data);
        }
        const completeName=this.prefixes.plugin+pluginName+"."+name;
        if (this.pluginLayouts[completeName]){
            if (this.pluginLayouts[completeName].pluginName !== pluginName) {
                throw new Error(`layout ${completeName} already exists from ${this.pluginLayouts[completeName].pluginName}`);
            }
        }
        const pluginLayout=new PluginLayout(name,pluginName,timestamp,url,data);
        this.pluginLayouts[completeName]=pluginLayout;
        if (url && ! timestamp){
            Requests.getLastModified(url).then((lm)=>{
                const ts=(new Date(lm)).getTime()/1000;
                pluginLayout.timestamp=ts;
            },()=>{});
        }
        return completeName;
    }
    removePluginLayouts(pluginName:string){
        if (! pluginName) throw new Error("no support for plugin layouts");
        const deletes=[];
        for (const k in this.pluginLayouts){
            if (this.pluginLayouts[k].pluginName === pluginName) deletes.push(k);
        }
        deletes.forEach((del)=>{
            delete this.pluginLayouts[del];
        })
    }
}

export const layoutLoader=new LayoutLoader();

const FORBIDDEN_LAYOUTSETTINGS=[
    keys.properties.layoutName
]
class LayoutHandler{
    private layout: LayoutData;
    private name: string;
    private hiddenPanels:Record<string, Record<string,boolean>>;
    private temporaryOptions: Record<string, any>;
    private actions: LayoutTransaction[];
    private currentTransaction: LayoutTransaction;
    private styleSheet: HTMLStyleElement;
    private savedLayout: LayoutAndName;
    storeProviderId: number;
    private allowedLayoutProperties: Record<string,boolean>;
    private editing: boolean;
    constructor(){
        this.layout=undefined;
        this.name=undefined;
        this._setEditing(false);
        this.hiddenPanels={}; //panels we removed during editing
        this.temporaryOptions={}; //options being set during edit
        this.actions=[];
        this.currentTransaction=undefined;
        this.styleSheet=document.createElement("style");
        this.styleSheet.setAttribute("id","layoutStyle");
        document.head.appendChild(this.styleSheet);
        this.savedLayout=undefined;
        this.storeProviderId = globalStore.registerProvider(
            (key) => {
                if (this.layout && this.layout.properties) {
                    return key in this.layout.properties
                }
                return false;
            },
            (key) => {
                if (this.layout && this.layout.properties) {
                    return this.layout.properties[key];
                }
            }
        );
        const propertyKeys=KeyHelper.flattenedKeys(keys.properties);
        this.allowedLayoutProperties={}
        propertyKeys.forEach(propertyKey=>{
            if (FORBIDDEN_LAYOUTSETTINGS.indexOf(propertyKey) < 0 ) {
                this.allowedLayoutProperties[propertyKey] = true;
            }
        })
    }
    getAllowedLayoutProperties(){
        return {...this.allowedLayoutProperties};
    }
    canEdit(name:string){
        if (name === undefined) name=this.name;
        if (! name) return false;
        return Helper.startsWith(name,USER_PREFIX);
    }
    saveCurrent(){
        this.savedLayout=new LayoutAndName(this.name, cloneDeep(this.layout));
    }
    restoreSaved(){
        if (this.savedLayout){
            this.name=this.savedLayout.name;
            this._setLayout(this.savedLayout.layout);
        }
        this.activateLayout();
    }
    startEditing(name:string){
        if (! this.canEdit(name)) throw new Error(`invalid layout name ${name} for editing`);
        this.name=name;
        this.saveCurrent();
        this._setEditing(true);
        this.setTemporaryOptionValues();
        return true;
    }
    resetEditing(){
        if (! this.isEditing()) return false;
        this.restoreSaved();
        return true;
    }
    isEditing(){
        return this.editing;
    }

    async loadStoredLayout(opt_remoteFirst?:boolean){
        const layout=await layoutLoader.loadStoredLayout(opt_remoteFirst)
            .then((layoutAndName)=>{
                this.setLayoutAndName(layoutAndName.layout,layoutAndName.name,true);
                return layoutAndName.layout;
            },(err)=>base.log("error while loading stored layout "+err));
        return layout;
    }
    _setEditing(on:boolean){
        this.editing=on;
        this.resetActions();
        globalStore.storeData(keys.gui.global.layoutEditing,on);
    }
    _setLayout(layout:LayoutData){
        this.layout=layout;
        if (layout && layout.css){
            this.styleSheet.textContent=layout.css;
        }
        else{
            this.styleSheet.textContent="";
        }
    }
    setLayoutAndName(layout:LayoutData,name:string,opt_activate?:boolean){
        this.name=name;
        this._setLayout(layout);
        if (opt_activate){
            this.activateLayout()
        }
    }
    resetToDefault():void{
        this.setLayoutAndName(defaultLayout,DEFAULT_LAYOUT_NAME,true);
    }
    getCss(){
        if (! this.layout) return;
        return this.layout.css;
    }
    getLayoutProperties(layout?:LayoutData){
        if (! layout) layout=this.layout;
        if (! layout) return {};
        const rt:Record<string, PropertyValue> = {};
        if (! layout.properties) return rt;
        for (const k in this.allowedLayoutProperties){
            if (k in layout.properties){
                rt[k] = layout.properties[k];
            }
        }
        return rt;
    }

    /**
     * set the layout properties
     * no check, no copy
     * @param properties
     */
    updateLayoutProperties(properties:Record<string, PropertyValue>){
        if (! this.layout) return;
        if (!properties || Object.keys(properties).length === 0) {
            delete this.layout.properties;
        }
        this.layout.properties={};
        for (const k in this.allowedLayoutProperties){
            if (k in properties){
                this.layout.properties[k] = properties[k];
            }
        }
    }
    updateCss(css:string){
        if (! this.layout) return;
        this.layout.css=css;
        this._setLayout(this.layout);
    }
    hasLoaded(layoutName:string){
        if (this.name !== layoutName)return false;
        if (! this.layout) return false;
        return true;
    }
    getLayoutWidgets(){
        if (! this.layout || ! this.layout.widgets) return {};
        return this.layout.widgets;
    }
    getLayout():LayoutData{
        return this.layout||{layoutVersion:1};
    }
    getName(){
        return this.name;
    }
    activateLayout(){
        this._removeHiddenPanels();
        this._setEditing(false);
        if (!this.layout) return false;
        try {
            LocalStorage.setItem(
                STORAGE_NAMES.LAYOUT,undefined,
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
        return true;
    }
    incrementSequence(){
        const ls=globalStore.getData(keys.gui.global.layoutSequence,0);
        globalStore.storeData(keys.gui.global.layoutSequence,ls+1);
    }

    _isHiddenPanel(page:string,panelname:string){
        if (! this.isEditing()) return false;
        const pd=this.hiddenPanels[page];
        if (!pd) return;
        return pd[panelname]?true:false;
    }
    _setHiddenPanel(page:string,panelname:string,hidden:boolean){
        let pd=this.hiddenPanels[page];
        if (!pd){
            pd={};
            this.hiddenPanels[page]=pd;
        }
        pd[panelname]=hidden;
    }

    _removeHiddenPanels(){
        if (! this.isEditing()) return;
        for (const pg in this.hiddenPanels){
            const pageData=this.getPageData(pg);
            if (!pageData) continue;
            const page=this.hiddenPanels[pg];
            for (const pn in page){
                if (! page[pn]) continue;
                delete pageData[pn];
            }
        }
        this.hiddenPanels={};
    }

    getPageData(pageWithOptions:PageType,opt_add?:boolean){
        const page=getPagename(pageWithOptions);
        const widgets=this.getLayoutWidgets();
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
        const rt:Record<string, boolean> = {};
        for (const k of Object.values(LAYOUT_OPTIONS)){
            rt[k]=true;
        }
        return rt;
    }
    getOptionsAsArray(){
        return Object.values(LAYOUT_OPTIONS);
    }

    /**
     * get an array of panel names to try for the options being set
     * the last element is the basename and the first element is the name with the max amount of options
     * @param basename
     * @param options object with the keys being LAYOUT_OPTIONS
     * @return {*[]}
     */
    getPanelTryList(basename:string,options:LayoutOptionFlags){
        if (! options) options={};
        let panelName=basename;
        const tryList=[panelName];
        for (const o of Object.values(LAYOUT_OPTIONS)){
            if (options[o]){
                panelName+="_"+o;
                tryList.push(panelName);
            }
        }
        const rt:string[]=[];
        for (let k=tryList.length-1;k>=0;k--){
            rt.push(tryList[k]);
        }
        return rt;
    }
    /**
     *
     * @param pageWithOptions
     * @param basename
     * @param options object with the keys being LayoutHandler.prototype.OPTIONS
     * @returns an object with {name:panelName, list: the data}
     */
    getPanelData(
        pageWithOptions:LayoutPage,
        basename:string,
        options:LayoutOptionFlags){
        const page=getPagename(pageWithOptions);
        const pageData=this.getPageData(page);
        if (!pageData) return {name:basename};
        const tryList=this.getPanelTryList(basename,options);
        for (let i=0;i<tryList.length;i++){
            const list=this.getDirectPanelData(page,tryList[i]);
            if (list) {
                return {name:tryList[i],list:list};
            }
        }
        return {name:basename};
    }

    splitPanelName(panel:string){
        const parts=panel.split(":");
        const sub=parts.slice(1);
        const subIdx:number[]=[];
        sub.forEach((v)=>subIdx.push(parseInt(v)));
        return {
            panel:parts[0],
            sub:subIdx,
        }
    }
    /**
     * get the data for a panel (name already includes options)
     * if opt_add is true and we are editing - just add the structure if it is not there
     * @param pageWithOptions
     * @param panel - the panel name, optionally with :n:m... being indices of items with child properties
     * @param opt_add if set to true: create the panel (only possible if we are editing)
     * @return {*}
     */
    getDirectPanelData(
        pageWithOptions:LayoutPage,
        panel:string,
        opt_add?:boolean){
        const page=getPagename(pageWithOptions);
        const pageData=this.getPageData(page,opt_add);
        if (! pageData) return;
        const panelParts=this.splitPanelName(panel);
        let panelData=pageData[panelParts.panel];
        if (! panelData) {
            if ((! opt_add) || (! this.isEditing())) return ;
            panelData=[];
            pageData[panel]=panelData;
        }
        if (this._isHiddenPanel(page,panel)){
            if (!opt_add) return;
            this._setHiddenPanel(page,panel,false);
        }
        for (let i=0;i<panelParts.sub.length;i++){
            const item=panelData[panelParts.sub[i]];
            if (item === undefined || item.children === undefined) return;
            panelData=item.children;
        }
        return panelData;
    }

    removePanel(pageWithOptions:LayoutPage,panel:string){
        if (!this.isEditing()) return false;
        const pagename=getPagename(pageWithOptions);
        this._setHiddenPanel(pagename,panel,true);
        return true;
    }

    getItem(pageWithOptions:LayoutPage,panel:string,index:number){
        const page=getPagename(pageWithOptions);
        if (! this.isEditing()) return ;
        const panelData=this.getDirectPanelData(page,panel);
        if (!panelData) return;
        if (index < 0 || index >= panelData.length) return;
        return panelData[index];
    }

    getPagePanels(pageWithOptions:LayoutPage){
        const pagename=getPagename(pageWithOptions);
        const rt:string[]=[];
        const pageData=this.getPageData(pagename);
        if (! pageData) return rt;
        for (const panelName in pageData){
            if (this._isHiddenPanel(pagename,panelName)) continue;
            //TODO: we should filter the allowed panels
            rt.push(panelName);
        }
        return rt;
    }


    /**
     * replace/add/remove a widget
     * @param pageWithOptions the page
     * @param panel the panel
     * @param index the item index, if opt_add is set: <0 insert at start, >= 0 append
     * @param item the item to be inserted, if undefined: remove
     * @param opt_add if set: add the item instead of replace/remove
     * @type ADD_MODES
     * @return {boolean} true if success
     */
    replaceItem(
        pageWithOptions:LayoutPage,
        panel:string,
        index:number,
        item:LayoutItem,
        opt_add?:ADD_MODES){
        const page=getPagename(pageWithOptions);
        if (! this.isEditing()) return false;
        const allowAdd=opt_add !== undefined && opt_add !== ADD_MODES.noAdd;
        if (allowAdd && ! item) return false;
        const layoutItem:LayoutItem={};
        if (item){
            for (const k in item){
                if (k === 'key') continue;
                if (k === 'index') continue;
                if (k === 'wclass') continue;
                if (typeof(item[k]) === 'function')continue;
                layoutItem[k]=item[k];
            }
        }
        const panelData=this.getDirectPanelData(page,panel,allowAdd);
        if (!panelData) return false;
        if (allowAdd) {
            if (opt_add == ADD_MODES.beginning) {
                //insert at the beginning
                panelData.splice(0, 0, layoutItem);
                this._addAction(new LayoutAction(ACTIONS.ACTION_DELETE,page,panel,{
                    index:0
                }));
                this.incrementSequence();
                return true;
            }
            if (opt_add == ADD_MODES.end) {
                //append
                panelData.push(layoutItem);
                this._addAction(new LayoutAction(ACTIONS.ACTION_DELETE,page,panel,{
                    index: panelData.length-1
                }));
                this.incrementSequence();
                return true;
            }
        }
        if (index < 0 ){
            return false;
        }
        if (allowAdd){
            if (opt_add == ADD_MODES.afterIndex){
                if (index == (panelData.length-1)){
                    panelData.push(layoutItem);
                    this._addAction(new LayoutAction(ACTIONS.ACTION_DELETE,page,panel,{
                        index: panelData.length-1
                    }));
                }
                else {
                    panelData.splice(index + 1, 0, layoutItem)
                    this._addAction(new LayoutAction(ACTIONS.ACTION_DELETE,page,panel,{
                        index: index+1
                    }));
                }
                this.incrementSequence();
                return true;
            }
            if (opt_add == ADD_MODES.beforeIndex){
                panelData.splice(index,0,layoutItem);
                this._addAction(new LayoutAction(ACTIONS.ACTION_DELETE,page,panel,{
                    index: index
                }));
                this.incrementSequence();
                return true;
            }
            return false; //invalid add mode
        }
        const old=panelData[index];
        if (item) {
            panelData.splice(index, 1, layoutItem);
            this._addAction(new LayoutAction(ACTIONS.ACTION_REPLACE,page,panel,{
                index: index,
                item: old
            }));
        }
        else{
            panelData.splice(index, 1);
            this._addAction(new LayoutAction(ACTIONS.ACTION_ADD,page,panel,{
                index: index,
                item: old
            }));
        }
        this.incrementSequence();
        return true;
    }
    subPanelName(panel:string,sub:number|number[]):string{
        if (sub === undefined) return panel;
        if (! Array.isArray(sub)) sub=[sub];
        sub.forEach((v:number) => {
            panel+=":"+v;
        })
        return panel;
    }

    moveItem(
        pageWithOptions:LayoutPage,
        panel:string,
        oldIndex:number,
        newIndex:number,
        opt_newPanel?:string){
        base.log("moveItem",pageWithOptions,panel,oldIndex,newIndex,opt_newPanel);
        if (oldIndex == newIndex && (opt_newPanel === undefined || panel === opt_newPanel)) return true;
        if (! this.isEditing()) return false;
        const page=getPagename(pageWithOptions);
        const panelData=this.getDirectPanelData(page,panel);
        if (!panelData) return false;
        if (oldIndex < 0 || oldIndex >= panelData.length) return false;
        if (newIndex < 0) return false;
        let newPanelData=panelData;
        if (opt_newPanel !== undefined && opt_newPanel !== panel){
            newPanelData=this.getDirectPanelData(page,opt_newPanel);
            if (! newPanelData) return false;
        }
        //for the fallback we have to recompute panel and indices if the insertion or removal
        //affects the indices - only if the panels have sub-indices
        let revertSourcePanel=opt_newPanel||panel;
        const revertSourceParts=this.splitPanelName(revertSourcePanel);
        const revertOldIndex=newIndex;
        const revertNewIndex=oldIndex;
        let revertTargetPanel=panel;
        const revertTargetParts=this.splitPanelName(revertTargetPanel);
        if (revertTargetParts.panel === revertSourceParts.panel &&
            revertTargetParts.sub.length !== revertSourceParts.sub.length) {
            if (revertTargetParts.sub.length > revertSourceParts.sub.length){
                //in this case the target could be inserted before the original source
                //so for reverting the source index increases
                const idx=revertSourceParts.sub.length;
                if (newIndex <= revertTargetParts.sub[idx]) revertTargetParts.sub[idx]++;
            }
            else{
                //in this case the source panel could be moved to lower if the source
                //was located before the source panel
                const idx=revertTargetParts.sub.length;
                if (oldIndex < revertSourceParts.sub[idx]) revertSourceParts.sub[idx]--;
            }
            revertTargetPanel=this.subPanelName(revertTargetParts.panel,revertTargetParts.sub);
            revertSourcePanel=this.subPanelName(revertSourceParts.panel, revertSourceParts.sub);
        }
        this._addAction(new LayoutAction(ACTIONS.ACTION_MOVE,page,revertSourcePanel,{
            oldIndex: revertOldIndex,
            newIndex: revertNewIndex,
            newPanel: revertTargetPanel
        }));
        const item=panelData[oldIndex];
        panelData.splice(oldIndex,1);
        newPanelData.splice(newIndex,0,item);
        this.incrementSequence();
        return true;
    }
    getStoreKeys(others?:Record<string,string>){
        const rt= {
            layoutSequence: keys.gui.global.layoutSequence,
            isEditing: keys.gui.global.layoutEditing,
            ["layout" + LAYOUT_OPTIONS.ANCHOR]: keys.nav.anchor.watchDistance,
            ["layout" + LAYOUT_OPTIONS.SMALL]: keys.gui.global.smallDisplay,
            ...others
        }
        return rt;
    }
    setTemporaryOptionValues(options?:Record<string, any>){
        if (! this.isEditing()) return;
        if (!options){
            this.temporaryOptions=this.getOptionValues(this.getOptionsAsArray(),true);
        }
        this.temporaryOptions={...this.temporaryOptions,...options};
        this.incrementSequence();
    }

    /**
     * get the values for layout options
     * @param handledOptions - array of handled options
     * @param opt_ignoreTemporary
     * @returns {{}}
     */
    getOptionValues(handledOptions:LAYOUT_OPTIONS[],opt_ignoreTemporary?:boolean){
        if (this.isEditing() && ! opt_ignoreTemporary){
            return this.temporaryOptions;
        }
        const rt:Record<string,any>={};
        const keys=this.getStoreKeys();
        handledOptions.forEach((option)=>{
            const storeKey=keys['layout'+option];
            if (storeKey){
                rt[option]=globalStore.getData(storeKey,false);
            }
        });
        return rt;
    }

    resetActions(){
        this.actions=[];
        this.currentTransaction=undefined;
        globalStore.storeData(keys.gui.global.layoutReverts,this.actions.length);
    }
    hasRevertableActions(){
        return this.isEditing() && this.actions.length > 0;
    }
    revertAction(pageCallback:(page:LayoutPage)=>void){
        if (! this.hasRevertableActions() || this.currentTransaction) return false;
        const action=this.actions.pop();
        globalStore.storeData(keys.gui.global.layoutReverts,this.actions.length);
        const rt=action.run(this);
        if (rt && pageCallback && action.pageWithProps) pageCallback(action.pageWithProps);
        return rt;
    }
    _addAction(action:LayoutAction){
        if (this.currentTransaction) {
            this.currentTransaction.add(action);
        }
    }
    withTransaction(pageWithOptions:LayoutPage, callback:(handler:LayoutHandler)=>boolean){
        this.currentTransaction=new LayoutTransaction(pageWithOptions);
        let rt=false;
        try{
            rt=callback(this);
        }
        finally{
            if (this.currentTransaction.hasActions()){
                this.actions.push(this.currentTransaction);
                globalStore.storeData(keys.gui.global.layoutReverts,this.actions.length);
            }
            this.currentTransaction=undefined;
        }
        return rt;
    }

    revertButtonDef(pageCallback?:(page:LayoutPage)=>void){
        const rt:Record<string,any>={
            name: 'RevertLayout',
            displayName: 'Undo',
            editOnly: true,
            overflow: true,
            storeKeys:{
                reverts: keys.gui.global.layoutReverts
            },
            updateFunction:(state:Record<string,any>)=>{
              return {
                  disabled: state.reverts < 1
              }
            }
        }
        if (pageCallback){
            rt.onClick= ()=>this.revertAction(pageCallback);
        }
        return rt;
    }

}



export default  new LayoutHandler();