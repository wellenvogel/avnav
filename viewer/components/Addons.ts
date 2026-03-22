import globalStore from '../util/globalstore';
import keys from '../util/keys';
// @ts-ignore
import Requests from '../util/requests';
import Toast from './Toast';
import base from "../base";
import {UserButtonProps} from "../util/api.impl";
import Helper from "../util/helper";
import {UserButton} from "../api/api.interface";

export interface PluginAddonProps{
    name: string;
    pluginName: string;
    displayName?: string;
    url:string;
    icon: string;
    title?: string;
    newWindow?:boolean;
    preventConnectionLost?:boolean
}
class PluginAddOn{
    name: string;
    pluginName: string;
    displayName: string;
    url: string;
    icon: string;
    title: string;
    newWindow: boolean;
    source: string;
    canDelete: boolean;
    preventConnectionLost: boolean;
    key: string;
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
const pluginAddOns:Record<string, PluginAddOn> = {};
const pluginUserButtons:Record<string, PluginUserButton> = {};

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
}
const getPageUserButtons=(page:string)=>{
    const rt=[];
    for (const k in pluginUserButtons){
        const buttonDef=pluginUserButtons[k];
        if (page === buttonDef.page){
            rt.push({...buttonDef.button,overflow:true});
        }
        else{
            if (Array.isArray(buttonDef.page)){
                for (const dp of buttonDef.page){
                    if (dp === page){
                        rt.push({...buttonDef.button,overflow:true});
                        break;
                    }
                }
            }
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
}

const readAddOns = async (
    opt_showToast?:boolean,
    opt_includeInvalid?:boolean)=> {
        if (!globalStore.getData(keys.gui.capabilities.addons)) return [];
        const req={
            request:'api',
            command:'list',
            type:"addon",
            invalid:false
        };
        if (opt_includeInvalid){
            req.invalid=true;
        }
        try {
            const addons = await Requests.getJson(req).then((json:any) => {
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
            for (const k in pluginAddOns){
                addons.push(pluginAddOns[k]);
            }
            return addons;
        }catch (error){
            if (opt_showToast)Toast("reading addons failed: " + error);
            throw error;
        }
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
    removePluginAddOns:removePluginAddOns
}
