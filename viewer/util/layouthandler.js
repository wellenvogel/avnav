import Requests from './requests.js';
import Promise from 'promise';
import PropertyHandler from './propertyhandler.js';
import Helper from './helper.js';
import globalStore from './globalstore.jsx';
import keys,{KeyHelper} from './keys.jsx';
import KeyHandler from './keyhandler.js';

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
                    reject("unable to load application layout: " + error);
                }
            );
        });
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