import Requests from './requests.js';
import Promise from 'promise';
import PropertyHandler from './propertyhandler.js';
import Helper from './helper.js';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import KeyHandler from './keyhandler.js';
import base from '../base.js';

class LayoutHandler{
    constructor(){
        this.layout=undefined;
        this.name=undefined;
        this.propertyDescriptions=KeyHelper.getKeyDescriptions(true);
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
                        base.log("error wen trying to read layout locally: "+e);
                    }
                    reject("" + error);
                }
            );
        });
    }

    uploadLayout(name,layout,isString){
        if (! name || ! layout){
            return new Promise((resolve,reject)=>{
               reject("missing parameter name or layout");
            });
        }
        //the provided name should always be without the user./system. prefix
        //whe we upload we always create a user. entry...
        name=name.replace(/^user\./,'').replace(/^system\./,'');
        if (avnav.android){
            return new Promise((resolve,reject)=>{
                try {
                    avnav.android.storeLayout(name, layout);
                    resolve({status:'OK'})
                }catch(e){
                    reject(e)
                }
            });
        }
        if (isString){
            layout=JSON.parse(layout);
        }
        return Requests.postJson("?request=upload&type=layout&name="+encodeURIComponent(name),layout)
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

}

export default new LayoutHandler();