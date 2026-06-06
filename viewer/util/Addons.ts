import globalStore from './globalstore';
import globalstore from './globalstore';
import keys from './keys';
import Requests from './requests';
import base from "../base";
import {UserButtonProps} from "./api.impl";
import Helper, {createOrUpdateStyleSheet} from "./helper";
import {PluginPage, UserApp, UserButton, UserButtonBase} from "../api/api.interface";
import {StoreCallback} from "./store";
import {PAGEIDS, PLUGINPAGES} from "./pageids";
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
        this.preventConnectionLost=Helper.toBoolean(raw.preventConnectionLost);
        this.newWindow=Helper.toBoolean(raw.newWindow);
        this.key=raw.key||raw.name;
        this.url=raw.url;
        this.page=raw.page;
        this.originalUrl=raw.originalUrl;
        this.button={name:raw.name,
            displayName:raw.longText||'',
            label:raw.shortText||'',
            iconClass:raw.iconClass,
            icon:raw.icon};
    }
}
let pluginPageMappings:Record<string, PluginPage|[PluginPage]>={};
const serverAddOns:ServerAddon[]=[]
const pluginAddOns:Record<string, PluginAddOn> = {};
const pluginUserButtons:Record<string, PluginUserButton> = {};

const getPagesForAddon=(addon:AddonProps)=>{
    const key=addon.key;
    if (key === undefined) return addon.page;
    try {
        const mappings = pluginPageMappings[key];
        if (mappings) return mappings;
    }catch(e){ /* empty */ }
    return addon.page;
}

const addonsChanged=()=>{
    globalstore.storeData(keys.gui.global.addonsChanged,globalstore.getData(keys.gui.global.addonsChanged,0)+1)
    updateAddonCss();
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
    readUserConfig(){
        Requests.getHtmlOrText({
            type:'user',
            command:'download',
            name:'pluginmappings.json'
        })
        .then(data=>{
            const raw=JSON.parse(data);
            if (typeof raw != 'object') throw new Error("invalid pluginmappings");
            pluginPageMappings=raw;
        })
            .catch((e)=>base.error("error fetching pluginmappings",e));
    }
    fillAddons(){
        this.readUserConfig();
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
            buttonClass: getNameForButton(sad),
            page:getPagesForAddon(sad),
        });
    }
    for (const pad of Object.values(pluginAddOns)){
        const padm:InternalAddonProps={
            ...pad,
            type:pad.newWindow?ButtonAddonType.CONFIG_NEW_WINDOW:ButtonAddonType.CONFIG,
            buttonClass: getNameForButton(pad),
            page: getPagesForAddon(pad)
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
                label:props.button.label||props.title||props.name
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
    onlyUserActions?:boolean
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
    if (onlyUserActions){
        return rt;
    }
    for (const k in pluginAddOns){
        const addon=pluginAddOns[k];
        if (isOnPage(page,getPagesForAddon(addon))){
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
        if (isOnPage(page,getPagesForAddon(addon))){
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

const findPageForAddon=(name:string)=>{
    let rt:string|string[];
    for (const pad of Object.values(pluginAddOns)){
        if (name === getNameForButton(pad)){
            rt=getPagesForAddon(pad);
            if (! rt) rt=PAGEIDS.ADDON
            break;
        }
    }
    if (! rt){
        for (const sad of Object.values(serverAddOns)){
            if (name === getNameForButton(sad)){
                rt=getPagesForAddon(sad);
                if (! rt) rt=PAGEIDS.ADDON
                break;
            }
        }
    }
    if (! rt){
        return rt;
    }
    if (rt == PAGEIDS.ADDON){
        return rt;
    }
    if (!Array.isArray(rt)) rt=[rt];
    for (const page of rt){
        if (Object.values(PLUGINPAGES).indexOf(page) >= 0){
            return page;
        }
    }
    return PAGEIDS.ADDON;
}
/**
 * get the names we should register keyboard handler for
 */
const getAddonButtonNames = () => {
    const rt = [];
    for (const pad of Object.values(pluginAddOns)) {
        rt.push(getNameForButton(pad));
    }
    for (const sad of Object.values(serverAddOns)) {
        rt.push(getNameForButton(sad));
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
            if (item.key.match(/^[0-9]/)) item.key="s"+item.key;
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

/**
 * update/add an addon
 * @param name - if not set: add this addon
 * @param url
 * @param icon
 * @param title
 * @param newWindow
 * @param page
 * @param shortText
 * @param longText
 * @returns {*}
 */
const updateAddon=(
    name: string,
    url:string|URL,
    icon: string|URL,
    title?:string,
    newWindow?:boolean,
    page?:string,
    shortText?:string,
    longText?:string)=>{
   return Requests.getJson({
       request:'api',
       type:'addon',
       command:'update',
       url:url,
       title: title||'',
       icon:icon||'',
       name:name,
       newWindow: newWindow||false,
       page:page||'',
       shortText:shortText||'',
       longText:longText||'',
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
const STYLE_NAME='avnav-addon-styles';
const buildButtonStyles=(button:UserButtonBase,name:string,title?:string):string=>{
    let label = (button?.label as string)||title;
    if (! label){
        label=name||"";
        for (const t of ['user-','system-']) {
                    const exp=new RegExp("^"+t)
                    label = label.replace(exp, '');
        }

    }
    let style="";
    if (button?.displayName){
        style+=`.longText.${name}::after{\ncontent:"${button.displayName}";\n}\n`;
    }
    if (label){
        style+=`.${name}::after{\ncontent:"${label}";\n}\n`;
    }
    if (button?.icon){
        style+=`.${name} .icon{\nbackground-image: url("${button.icon}");\n}\n`;
    }
    return style;
}
const updateAddonCss=()=>{
    let rulesTxt='';
    for (const sadd of serverAddOns){
        const button=sadd.button;
        const name=getNameForButton(sadd);
        const styles=buildButtonStyles(button,name,sadd.title);
        if (styles) rulesTxt+=styles;
    }
    for (const add of Object.values(pluginAddOns)){
        const button=add.button;
        const name=getNameForButton(add);
        const styles=buildButtonStyles(button,name,add.title as string);
        if (styles) rulesTxt+=styles;
    }
    for (const add of Object.values(pluginUserButtons)){
        const button=add.button;
        const name=getNameForPluginButton(add);
        const styles=buildButtonStyles(button,name);
        if (styles) rulesTxt+=styles;
    }
    createOrUpdateStyleSheet(rulesTxt,STYLE_NAME);
}

export default  {
    updateAddon:updateAddon,
    removeAddon:removeAddon,
    addPluginAddOn:addPluginAddOn,
    addUserButton: addUserButton,
    getPageUserButtons:getPageUserButtons,
    removePluginAddOns:removePluginAddOns,
    getServerAddons:getServerAddons,
    getAllAddons:getAllAddons,
    QueryHandler:QueryHandler,
    updateAddonCss:updateAddonCss,
    findPageForAddon:findPageForAddon,
    getAddonButtonNames:getAddonButtonNames,
}
