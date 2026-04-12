import globalStore from './globalstore';
import globalstore from './globalstore';
import keys from './keys';
import Requests from './requests';
import base from "../base";
import {UserButtonProps} from "./api.impl";
import Helper from "./helper";
import {PluginPage, UserApp, UserButton, UserButtonBase} from "../api/api.interface";
import {StoreCallback} from "./store";
import {PAGEIDS} from "./pageids";
import {ButtonAddonType, DynamicButtonProps} from "../components/Button";
import {StoreKeys} from "../hoc/Dynamic";
import {ReactNode} from "react";

export interface AddonProps extends UserApp {
    [index:string]:UserButtonBase|string|boolean|StoreKeys|PluginPage|PluginPage[]|ReactNode|URL;
    name: string;
    key?:string
    button?:UserButtonBase;
    preventConnectionLost?:boolean,
    source?:string,
    invalid?:boolean
    page?:PluginPage|[PluginPage],
    originalUrl?:string,
    canDelete?:boolean,
    keepUrl?:boolean,
}
export interface PluginAddonProps extends AddonProps{
    pluginName: string;
    icon?:string|URL;
}
class PluginAddOn implements PluginAddonProps{
    [index:string]:UserButtonBase|string|boolean|StoreKeys|PluginPage|PluginPage[]|ReactNode|URL;
    name: string;
    pluginName: string;
    url: string|URL;
    button?:UserButtonBase;
    icon?: string|URL;
    title: React.ReactNode;
    newWindow: boolean;
    source: string;
    canDelete: boolean;
    preventConnectionLost: boolean;
    key: string;
    page?: PluginPage|[PluginPage];
    constructor(props:PluginAddonProps) {
        for (const k in props) {
            this[k] = props[k];
        }
        this.source="plugin-"+props.pluginName;
        this.canDelete=false;
    }
}

class PluginUserButton{
    key:string;
    page:PluginPage|[PluginPage];
    button:UserButton;
    pluginName:string;
    constructor(plugin:string,button:UserButton,page:PluginPage|[PluginPage]){
        if (! plugin) throw new Error("missing plugin")
        if (! button) throw new Error("missing button")
        if (! button.name) throw new Error("missing name in button def")
        if ( typeof(button.onClick) !== "function") throw new Error("button.onClick is not a function")
        this.key=plugin+'-'+button.name
        this.page=page || PAGEIDS.ADDON;
        this.button=Helper.filteredAssign(UserButtonProps,button) as UserButton;
        this.pluginName=plugin;
    }
}

export class ServerAddon implements AddonProps{
    [index:string]:UserButtonBase|string|boolean|StoreKeys|PluginPage|PluginPage[]|ReactNode|URL;
    name: string;
    invalid?: boolean;
    canDelete?: boolean;
    source?: string;
    title?: string;
    keepUrl?: boolean;
    originalUrl?: string;
    url:string;
    preventConnectionLost?: boolean;
    newWindow?: boolean;
    page?:PluginPage|[PluginPage];
    key:string;
    button?:UserButtonBase;
    constructor(raw:any) {
        this.name=raw.name;
        this.invalid=Helper.toBoolean(raw.invalid);
        this.canDelete=Helper.toBoolean(raw.canDelete);
        this.source=raw.source;
        this.title=raw.title;
        this.keepUrl=Helper.toBoolean(raw.keepUrl);
        this.preventConnectionLost=Helper.toBoolean(raw.preventConnectionLost);
        this.newWindow=Helper.toBoolean(raw.newWindow);
        this.key=raw.key||raw.name;
        this.url=raw.url;
        this.page=raw.page;
        this.button={name:raw.name,
            displayName:raw.displayName||raw.title||raw.name,
            icon:raw.icon};
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

export const getServerAddons=():AddonProps[]=>{
    return serverAddOns;
}
export interface InternalAddonProps extends AddonProps{
    type:ButtonAddonType,
    buttonClass:string
}
export const getAllAddons=():InternalAddonProps[]=>{
    const rt:InternalAddonProps[]=[];
    for (const sad of serverAddOns){
        rt.push({
            ...sad,
            type:sad.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
            buttonClass: getNameForButton(sad)
        });
    }
    for (const pad of Object.values(pluginAddOns)){
        const padm:InternalAddonProps={
            ...pad,
            type:pad.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
            buttonClass: getNameForButton(pad)
        };
        if (!padm.source) padm.source="cl-plugin-"+padm.pluginName;
        padm.canDelete=false;
        rt.push(padm);
    }
    for (const bad of Object.values(pluginUserButtons)){
        rt.push({
            name:bad.key,
            page:bad.page,
            canDelete:false,
            button:{...bad.button,name:bad.key},
            type:ButtonAddonType.USER_HANDLER,
            source:"cl-plugin-"+bad.pluginName,
            buttonClass: getNameForPluginButton(bad)
        })
    }
    return rt;
}
const addPluginAddOn=(
    props:PluginAddonProps)=>{
    if (!props.name) throw new Error("name is required");
    if (!props.pluginName) throw new Error("pluginName is required");
    if (!props.url) throw new Error("url is required");
    if (!props.button ) throw new Error("button is required");
    const completeName=props.pluginName+"."+name;
    const existing=pluginAddOns[completeName];
    if (existing && existing.pluginName!==props.pluginName) {
        throw new Error(`AddOn "${name}" already exists from "${existing.pluginName}"`);
    }
    pluginAddOns[completeName]=new PluginAddOn(
        {...props,button: {
                ...props.button,
                name:props.name,
                displayName:props.button.displayName||props.title||props.name,
            },
        }
    );
    addonsChanged();
    return completeName;
}
const addUserButton=(plugin:string,button:UserButton,page:PluginPage|[PluginPage])=>{
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
const isOnPage=(page:string,pageDef:PluginPage|[PluginPage])=>{
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
export interface PageUserButton extends DynamicButtonProps{
    config?:AddonProps
}
const getNameForButton=(addon:AddonProps)=>{
    return addon?.key||addon?.name;
}
const getNameForPluginButton=(button?:PluginUserButton)=>{
    return button?.key;
}
const getPageUserButtons=(
    page:string,
    includeInvalid?:boolean,
    ):PageUserButton[]=>{
    const rt:PageUserButton[]=[];
    for (const k in pluginUserButtons){
        const buttonDef=pluginUserButtons[k];
        if (isOnPage(page,buttonDef.page)){
            rt.push({
                ...buttonDef.button,
                name:getNameForPluginButton(buttonDef),
                overflow:true,
                closeDialogs:false, //allow toggle handling
                isAddon:ButtonAddonType.USER_HANDLER});
        }
    }
    for (const k in pluginAddOns){
        const addon=pluginAddOns[k];
        if (isOnPage(page,addon.page)){
            const buttonDef={
                ...addon.button,
                name:getNameForButton(addon),
                overflow: true,
                isAddon:addon.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
                config: {...addon}
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
                ...addon.button,
                name:getNameForButton(addon),
                overflow: true,
                isAddon:addon.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
                config: {...addon}
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

const findAddonByUrl=(addons:AddonProps[],url:string|URL)=>{
    if (! addons || !(addons instanceof Array)) return;
    if (! url) return;
    const rtall=[];
    for (const i in addons){
        const addon=addons[i];
        if ((addon.url+"") == (url+"")){
            rtall.push(addon);
        }
    }
    return rtall;
};
/**
 * update/add an addon
 * @param name - if not set: add this addon
 * @param url
 * @param icon
 * @param title
 * @param newWindow
 * @param page
 * @returns {*}
 */
const updateAddon=(
    name: string,
    url:string|URL,
    icon: string|URL,
    title?:string,
    newWindow?:boolean,
    page?:string)=>{
   return Requests.getJson({
       request:'api',
       type:'addon',
       command:'update',
       url:url,
       title: title,
       icon:icon,
       name:name,
       newWindow: newWindow,
       page:page,
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
    findAddonByUrl:findAddonByUrl,
    updateAddon:updateAddon,
    removeAddon:removeAddon,
    addPluginAddOn:addPluginAddOn,
    addUserButton: addUserButton,
    getPageUserButtons:getPageUserButtons,
    removePluginAddOns:removePluginAddOns,
    getServerAddons:getServerAddons,
    getAllAddons:getAllAddons,
    QueryHandler:QueryHandler,
}
