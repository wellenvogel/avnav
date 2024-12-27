import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';

const readAddOns = function (opt_showToast,opt_includeInvalid) {
    return new Promise((resolve, reject)=> {
        if (!globalStore.getData(keys.gui.capabilities.addons)) resolve([]);
        let req={
            type:"addon"
        };
        if (opt_includeInvalid){
            req.invalid=true;
        }
        Requests.getJson("?request=list",{},req).then((json)=> {
                let items = [];
                for (let e in json.items) {
                    let item = json.items[e];
                    if (!item.key) item.key=item.name;
                    if (item.name) {
                        items.push(item);
                    }
                }
                resolve(items);
            },
            (error)=> {
                if (opt_showToast)Toast("reading addons failed: " + error);
                reject(error+"");
            });
    });
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
   return Requests.getJson("?request=api&type=addon&command=update",{},{
       url:url,
       title: title,
       icon:icon,
       name:name,
       newWindow: newWindow
   });
};

const removeAddon=(name)=>{
    return Requests.getJson("?request=api&type=addon&command=delete",{},{
        name:name
    })
};

export default  {
    readAddOns:readAddOns,
    findAddonByUrl:findAddonByUrl,
    updateAddon:updateAddon,
    removeAddon:removeAddon
}
