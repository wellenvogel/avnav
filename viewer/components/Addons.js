import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import {Icon} from "ol/style";
import {urlToString} from "../util/helper";

class PluginAddOn{
    constructor({name,pluginName,url,icon,title,newWindow,preventConnectionLost}){
        this.name=name;
        this.pluginName=pluginName;
        this.url=urlToString(url);
        this.icon=urlToString(icon);
        this.title=title;
        this.newWindow=newWindow;
        this.source="plugin-"+pluginName;
        this.canDelete=false;
        this.newWindow=newWindow;
        this.preventConnectionLost=preventConnectionLost;
        this.key=pluginName+'.'+name;
    }
}
const pluginAddOns={};

const addPluginAddOn=({name,pluginName,url,icon,...other})=>{
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
const removePluginAddOns=(pluginName)=>{
    const todel=[];
    for (let k in pluginAddOns) {
        if (pluginAddOns[k].pluginName===pluginName) todel.push(k);
    }
    for (let td of todel) {
        delete pluginAddOns[td];
    }
}

const readAddOns = async (opt_showToast,opt_includeInvalid)=> {
        if (!globalStore.getData(keys.gui.capabilities.addons)) return [];
        let req={
            request:'api',
            command:'list',
            type:"addon"
        };
        if (opt_includeInvalid){
            req.invalid=true;
        }
        try {
            const addons = await Requests.getJson(req).then((json) => {
                let items = [];
                for (let e in json.items) {
                    let item = json.items[e];
                    if (!item.key) item.key = item.name;
                    if (item.name) {
                        items.push(item);
                    }
                }
                return items;
            });
            for (let k in pluginAddOns){
                addons.push(pluginAddOns[k]);
            }
            return addons;
        }catch (error){
            if (opt_showToast)Toast("reading addons failed: " + error);
            throw error;
        }
};

const findAddonByUrl=(addons,url,opt_all)=>{
    if (! addons || !(addons instanceof Array)) return;
    if (! url) return;
    let rtall=[];
    for (let i in addons){
        let addon=addons[i];
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
 * @returns {*}
 */
const updateAddon=(name,url,icon,title,newWindow)=>{
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

const removeAddon=(name)=>{
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
    removePluginAddOns:removePluginAddOns
}
