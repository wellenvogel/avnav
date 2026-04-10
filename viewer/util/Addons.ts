import globalStore from './globalstore';
import globalstore from './globalstore';
import keys from './keys';
import Requests from './requests';
import base from "../base";
import {UserButtonProps} from "./api.impl";
import Helper from "./helper";
import {UserApp, UserButton} from "../api/api.interface";
import {StoreCallback} from "./store";
import {Page} from "./keyhandler";
import {PAGEIDS} from "./pageids";
import {ButtonAddonType, DynamicButtonProps} from "../components/Button";

export interface PluginAddonProps{
    name: string;
    pluginName: string;
    displayName?: string;
    url:string;
    icon: string;
    title?: React.ReactNode;
    newWindow?:boolean;
    preventConnectionLost?:boolean
}
class PluginAddOn implements UserApp{
    name: string;
    pluginName: string;
    displayName: string;
    url: string;
    icon: string;
    title: React.ReactNode;
    newWindow: boolean;
    source: string;
    canDelete: boolean;
    preventConnectionLost: boolean;
    key: string;
    page?: Page;
    constructor({name,pluginName,url,icon,title,newWindow,preventConnectionLost,displayName}:PluginAddonProps) {
        this.name=name;
        this.pluginName=pluginName;
        this.url=url;
        this.icon=icon;
        this.title=title;
        this.newWindow=newWindow;
        this.source="plugin-"+pluginName;
        this.canDelete=false;
        this.newWindow=newWindow;
        this.preventConnectionLost=preventConnectionLost;
        this.key=pluginName+'.'+name;
        this.displayName=displayName||name;
    }
}

class PluginUserButton{
    key:string;
    page:string;
    button:UserButton;
    pluginName:string;
    constructor(plugin:string,button:UserButton,page:string){
        if (! plugin) throw new Error("missing plugin")
        if (! button) throw new Error("missing button")
        if (! button.name) throw new Error("missing name in button def")
        if ( typeof(button.onClick) !== "function") throw new Error("button.onClick is not a function")
        this.key=plugin+'.'+button.name
        this.page=page || 'addonpage';
        this.button=Helper.filteredAssign(UserButtonProps,button) as UserButton;
        this.pluginName=plugin;
    }
}

class ServerAddon implements UserApp{
    name: string;
    invalid?: boolean;
    canDelete?: boolean;
    source?: string;
    title?: string;
    icon?: string;
    keepUrl?: boolean;
    originalUrl?: string;
    url:string;
    preventConnectionLost?: boolean;
    newWindow?: boolean;
    page?:string
    key:string;
    constructor(raw:any) {
        this.name=raw.name;
        this.invalid=Helper.toBoolean(raw.invalid);
        this.canDelete=Helper.toBoolean(raw.canDelete);
        this.source=raw.source;
        this.title=raw.title;
        this.icon=raw.icon;
        this.keepUrl=Helper.toBoolean(raw.keepUrl);
        this.preventConnectionLost=Helper.toBoolean(raw.preventConnectionLost);
        this.newWindow=Helper.toBoolean(raw.newWindow);
        this.key=raw.key||raw.name;
        this.url=raw.url;
    }
}
const serverAddOns:ServerAddon[]=[]
const pluginAddOns:Record<string, PluginAddOn> = {};
const pluginUserButtons:Record<string, PluginUserButton> = {};

const addonsChanged=()=>{
    globalstore.storeData(keys.gui.global.addonsChanged,globalstore.getData(keys.gui.global.addonsChanged,0)+1)
}
class QueryHandler{
    callback:StoreCallback;
    timer:number=-1;
    constructor(){
    }
    start(){
        serverAddOns.length=0;
        addonsChanged();
        this.callback=globalstore.register(()=>{
            this.fillAddons()
        },keys.nav.gps.updateconfig);
        this.fillAddons();
    }
    stop(){
        globalstore.deregister(this.callback);
    }
    fillAddons(){
        base.log("reading addons");
        readAddOns(true,true)
            .then(data=>{
                if (this.timer > 0) {
                    window.clearTimeout(this.timer);
                    this.timer=-1;
                }
                serverAddOns.length=0;
                base.log(`successfully read ${data.length} addons`);
                for (const addon of data){
                    serverAddOns.push(new ServerAddon(addon));
                }
                addonsChanged();
            },
                (err)=>{
                    base.error("unable to read addons",err);
                    serverAddOns.length=0;
                    addonsChanged();
                    if (this.timer < 0) {
                        this.timer=window.setTimeout(() => {
                            base.log("retrying read addons");
                            this.timer=-1;
                            this.fillAddons()
                        },3000);
                    }
                })
    }
}

const addPluginAddOn=(
    {name,pluginName,url,icon,...other}:PluginAddonProps)=>{
    if (!name) throw new Error("name is required");
    if (!pluginName) throw new Error("pluginName is required");
    if (!url) throw new Error("url is required");
    if (!icon) throw new Error("icon is required");
    const completeName=pluginName+"."+name;
    const existing=pluginAddOns[completeName];
    if (existing && existing.pluginName!==pluginName) {
        throw new Error(`AddOn "${name}" already exists from "${existing.pluginName}"`);
    }
    pluginAddOns[completeName]=new PluginAddOn({name,pluginName,url,icon,...other});
    addonsChanged();
    return completeName;
}
const addUserButton=(plugin:string,button:UserButton,page:string)=>{
    const def=new PluginUserButton(plugin,button,page);
    if (! def.key) throw new Error("invalid userButton def");
    const existing=pluginUserButtons[def.key];
    if (existing && existing.pluginName!==plugin) {
        throw new Error(`UserButton ${button.name} already exists from ${existing.pluginName}`)
    }
    pluginUserButtons[def.key]=def;
    base.log(`added user button ${def.key}`);
    addonsChanged();
}
const isOnPage=(page:string,pageDef:string|string[])=>{
    if (! page) return false;
    if (! pageDef){
        return page === PAGEIDS.ADDON
    }
    if (! Array.isArray(pageDef)){
        if (Object.values(PAGEIDS).indexOf(pageDef) < 0){
            return page === PAGEIDS.ADDON;
        }
        return page === pageDef;
    }
    let anyValid=false;
    for (const p of pageDef){
        if (Object.values(PAGEIDS).indexOf(p) >=0) {
            anyValid=true;
            if (p === page) return true;
        }
    }
    if (! anyValid){
        return page === PAGEIDS.ADDON;
    }
    return false;
}
const getPageUserButtons=(
    page:string,
    includeInvalid?:boolean,
    ):DynamicButtonProps[]=>{
    const rt:DynamicButtonProps[]=[];
    for (const k in pluginUserButtons){
        const buttonDef=pluginUserButtons[k];
        if (isOnPage(page,buttonDef.page)){
            rt.push({...buttonDef.button,overflow:true,isAddon:ButtonAddonType.USER_HANDLER,
                noDialogsClose:true});
        }
    }
    for (const k in pluginAddOns){
        const addon=pluginAddOns[k];
        if (isOnPage(page,addon.page)){
            const buttonDef={
                name:addon.key||addon.name,
                displayName:addon.title || addon.name, //TODO
                icon:addon.icon,
                overflow: true,
                isAddon:addon.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
                config: {...addon},
                noDialogsClose:addon.newWindow
            }
            rt.push(buttonDef);
        }
    }
    for (const addon of serverAddOns){
        if (addon.invalid && ! includeInvalid){
            continue;
        }
        if (isOnPage(page,addon.page)){
            const buttonDef={
                name:addon.key||addon.name,
                displayName:addon.title || addon.name,
                icon:addon.icon,
                overflow: true,
                isAddon:addon.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
                config: {...addon},
                noDialogsClose:addon.newWindow
            }
            rt.push(buttonDef);
        }
    }
    return rt;
}


const removePluginAddOns=(pluginName:string)=>{
    let todel=[];
    for (const k in pluginAddOns) {
        if (pluginAddOns[k].pluginName===pluginName) todel.push(k);
    }
    for (const td of todel) {
        delete pluginAddOns[td];
    }
    todel=[];
    for (const k in pluginUserButtons) {
        if (pluginUserButtons[k].pluginName===pluginName) todel.push(k);
    }
    for (const td of todel) {
        delete pluginUserButtons[td];
    }
    addonsChanged();
}

const readAddOns = async (
    opt_includeInvalid?: boolean,
    opt_omitLocal?:boolean) => {
    if (!globalStore.getData(keys.gui.capabilities.addons)) return [];
    const req = {
        request: 'api',
        command: 'list',
        type: "addon",
        invalid: false
    };
    if (opt_includeInvalid) {
        req.invalid = true;
    }
    const addons = await Requests.getJson(req).then((json: any) => {
        const items = [];
        for (const e in json.items) {
            const item = json.items[e];
            if (!item.key) item.key = item.name;
            if (item.name) {
                items.push(item);
            }
        }
        return items;
    });
    if (! opt_omitLocal) {
        for (const k in pluginAddOns) {
            addons.push(pluginAddOns[k]);
        }
    }
    return addons;
};

const findAddonByUrl=(addons:any[],url:string,opt_all?:boolean)=>{
    if (! addons || !(addons instanceof Array)) return;
    if (! url) return;
    const rtall=[];
    for (const i in addons){
        const addon=addons[i];
        if (addon.url == url){
            if (! opt_all) return addon;
            rtall.push(addon);
        }
    }
    return opt_all?rtall:undefined;
};
/**
 * update/add an addon
 * @param name - if not set: add this addon
 * @param url
 * @param icon
 * @param title
 * @param newWindow
 * @returns {*}
 */
const updateAddon=(
    name: string,
    url:string,
    icon: string,
    title?:string,
    newWindow?:boolean)=>{
   return Requests.getJson({
       request:'api',
       type:'addon',
       command:'update',
       url:url,
       title: title,
       icon:icon,
       name:name,
       newWindow: newWindow
   });
};

const removeAddon=(name:string)=>{
    return Requests.getJson(
        {
            request:'api',
            type:'addon',
            command:'delete',
            name:name
        })
};

export default  {
    readAddOns:readAddOns,
    findAddonByUrl:findAddonByUrl,
    updateAddon:updateAddon,
    removeAddon:removeAddon,
    addPluginAddOn:addPluginAddOn,
    addUserButton: addUserButton,
    getPageUserButtons:getPageUserButtons,
    removePluginAddOns:removePluginAddOns,
    QueryHandler:QueryHandler,
}
