/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */
import shallowcompare from '../util/compare';
import Helper from "../util/helper";
import Requests from "../util/requests";

/**
 * we sort the overlays into 6 buckets (from lowest to highest)
 *    L2: own overlays below defaults
 *    L: default overlays below chart (they will have the bucket set to "L1")
 *    L1: own overlays below chart
 *    --- chart ---
 *    H1: own overlays above chart
 *    H: default overlays above chart (they have bucket H1)
 *    H2: own overlays above defaults
 *
 *
 */
const itemToBucket=function(buckets,item){
    let bucketName="H";
    let ownBuckets=['L1','L2','H1','H2'];
    if (item.isDefault){
        if (item.bucket === undefined || item.bucket.match(/^H/)) bucketName='H';
        else bucketName='L';
    }
    else{
        if (item.bucket === undefined) bucketName='H2';
        else {
            if (ownBuckets.indexOf(item.bucket) < 0) bucketName='H2';
            else bucketName=item.bucket;
        }
    }
    item.bucket=bucketName;
    if (!buckets[bucketName]) buckets[bucketName]=[];
    buckets[bucketName].push(item);
}


const filterOverlayItem=(item)=>{
    let rt=undefined;
    if (item.type === 'chart') {
        let filter={chartKey:true,name:true,displayName:true,type:true,opacity:true,enabled:true,bucket:true};
        filter[OVERLAY_ID]=true;
        rt=Helper.filteredAssign(filter,item);
    }
    else {
        rt = {...item};
    }
    for (let k in rt){
        if (typeof rt[k] === 'function'){
            delete rt[k];
        }
    }
    delete rt.selected;
    delete rt.index;
    delete rt.isDefault;
    return rt;
};
export const OVERLAY_ID='overlayId'; //unique (within one config) id of an overlay, constant during it's life time
const OVERRIDE_KEYS={
    enabled:true
};
export const getKeyFromOverlay=(overlay)=>{
    if (!overlay) return;
    return overlay[OVERLAY_ID];
}
const DEFAULT_EXPAND_FILTER={
    error:true,
    nonexistent:true,
    url: true
}
export const overlayResetExpands=(item,opt_copy)=>{
    if (! item) return;
    if (opt_copy) item={...item};
    for (let k in DEFAULT_EXPAND_FILTER){
        delete item[k];
    }
    return item;
}
/**
 * get an object with all expansion values set to a defined value
 * @param opt_value - the value to be set
 * @returns {{error: boolean, nonexistent: boolean, url: boolean}}
 */
export const overlayExpandsValue=(opt_value)=>{
    const rt={...DEFAULT_EXPAND_FILTER};
    for (let k in rt) rt[k]=opt_value;
    return rt;
}
const NEVER_EXPAND_FILTER={
    [OVERLAY_ID]:true,
    ...OVERRIDE_KEYS,
    opacity:true
}
export default class OverlayConfig{
    constructor(overlayConfig,opt_mutable,opt_defaults) {
        this.config=overlayConfig||{};
        this.mutable=opt_mutable||false;
        if (opt_defaults) this.config.defaults=opt_defaults;
        if (! this.config.defaults) this.config.defaults=[];
        else{
            let newDefaults=[];
            this.config.defaults.forEach((item)=>{
                if (getKeyFromOverlay(item) === undefined) return;
                newDefaults.push({ enabled:true,...item,isDefault:true});
            })
            this.config.defaults=newDefaults;
        }
        if (! this.config.overlays) this.config.overlays=[];
        else{
            let newOverlays=[];
            this.config.overlays.forEach((item)=>{
                if (getKeyFromOverlay(item) === undefined) return;
                newOverlays.push({enabled:true,...item,isDefault:false});
            })
            this.config.overlays=newOverlays;
        }
        this.nextId=-1;
        this.config.overlays.forEach((overlay)=>{
            if (getKeyFromOverlay(overlay) !== undefined && getKeyFromOverlay(overlay) > this.nextId){
                this.nextId=getKeyFromOverlay(overlay);
            }
        })
        this.nextId++;
        if (!this.config.defaultsOverride) this.config.defaultsOverride={};
        if (this.config.useDefault === undefined) this.config.useDefault=true;
        this.hasChanges=false;
    }
    static getBucketNames() {
        return ['L2', 'L', 'L1', 'M', 'H1', 'H', 'H2'];
    }

    static getKeyFromOverlay(overlay){
        return (getKeyFromOverlay(overlay));
    }
    createNewOverlay(parameters){
        this.checkMutable()
        let id=this.nextId;
        this.nextId++;
        let fixed={isDefault:false};
        fixed[OVERLAY_ID]=id;
        let rt={...parameters,...fixed};
        if (rt.enabled === undefined) rt.enabled=true;
        return rt;
    }
    copy(){
        let rt={
            useDefault:this.config.useDefault,
            name:this.config.name,
            defaults:[],
            overlays:[],
            defaultsOverride:{}
        };
        ['defaults','overlays'].forEach((list)=>{
            this.config[list].forEach((item)=>{
                rt[list].push({...item});
            })
        });
        for (let k in this.config.defaultsOverride){
            rt.defaultsOverride[k]={...this.config.defaultsOverride[k]};
        }
        return new OverlayConfig(rt,true);
    }

    /**
     * removed merged data
     * only will remove the data from DEFAULT_EXPAND_FILTER
     */
    cleanupMerged(){
        if (! this.config) return;
        ['overlays','defaults'].forEach((scope)=>{
            const items=this.config[scope];
            if (! items ) return;
            items.forEach(item=>{
                overlayResetExpands(item);
            })
        })
    }

    /**
     * get a config that is expanded by the results from item queries
     * @param forEditor controls which parameters will be expanded
     *        true: nonexistent,error,url
     *        false: nonexistent, error, url + all parameters for chart Items
     */
    getExpandedConfig(forEditor){
        const rt=this.copy();
        if (! rt.config) return rt;
        //build a list of necessary queries
        //we try to optimize this to just query each combination of type and name
        //only once
        const queryList={};
        ['overlays','defaults'].forEach((scope)=>{
            const items=rt.config[scope];
            if (! items) return;
            for (let i=0;i<items.length;i++){
                const item=items[i];
                if (! item.type || ! item.name) continue;
                const key=item.type+":"+item.name;
                const current=queryList[key]||{
                    type:item.type,
                    name:item.name,
                };
                const idlist=current.idlist||[];
                idlist.push({
                    idx:i,
                    scope:scope
                });
                current.idlist=idlist;
                queryList[key]=current;
            }
        })
        const queries=[];
        const queryConfigs=[];
        for (let k in queryList){
            const query=queryList[k];
            queryConfigs.push(query);
            queries.push(Requests.getJson({
                name:query.name,
                type:query.type,
                command:'info'
            }))
        }
        if (queryConfigs.length===0) return Promise.resolve(rt);
        const updateItem = (query, item) => {
            if (!query.idlist) return;
            query.idlist.forEach(id => {
                const scopeitems = rt.config[id.scope];
                if (!scopeitems) return;
                const sitem = scopeitems[id.idx];
                if (!sitem) return;
                if (forEditor) {
                    Object.assign(sitem, Helper.filteredAssign(DEFAULT_EXPAND_FILTER, item));
                } else {
                    if (sitem.type === 'chart') {
                        Object.assign(sitem, Helper.blackListAssign(NEVER_EXPAND_FILTER, item));
                    } else {
                        Object.assign(sitem, Helper.filteredAssign(DEFAULT_EXPAND_FILTER, item));
                    }
                }
            })
        }
        return Promise.allSettled(queries)
            .then((results)=>{
                for (let i=0;i<queryConfigs.length;i++){
                    const res=results[i];
                    const query=queryConfigs[i];
                    if (res.status === 'fulfilled'){
                        const item=(res.value||{}).item;
                        if (! item){
                            updateItem(query,{nonexistent:true,error:'not found'});
                        }
                        else{
                            updateItem(query,item);
                        }
                    }
                    else{
                        updateItem(query,{error:res.reason});
                    }
                }
                return rt;
            })

    }

    /**
     * fill an object (keys are the bucket names) with a copy of the overlay objects
     * @returns {{}}
     */
    getOverlayBuckets(opt_forceDefaults){
        let buckets={};
        OverlayConfig.getBucketNames().forEach((bucket)=>{buckets[bucket]=[]});
        buckets['M']=[{
            bucket:'M',
            type:'base'
        }];
        if (! this.config) return buckets;
        let defaults=this.config.defaults;
        let overlays=this.config.overlays;
        let overrides=this.config.defaultsOverride;
        if (this.config.useDefault || opt_forceDefaults) {
            defaults.forEach((item) => {
                if (getKeyFromOverlay(item) === undefined) return;
                itemToBucket(buckets, {...item, ...overrides[getKeyFromOverlay(item)],isDefault:true});
            })
        }
        overlays.forEach((item)=>{
            if (getKeyFromOverlay(item) === undefined) return;
            itemToBucket(buckets,{...item,isDefault:false});
        })
        return buckets;
    }
    getOverlayList(opt_forceDefaults){
        let rt=[];
        let buckets=this.getOverlayBuckets(opt_forceDefaults);
        OverlayConfig.getBucketNames().forEach((bucket)=>{
            if (buckets[bucket]) rt=rt.concat(buckets[bucket]);
        })
        return rt;
    }
    checkMutable(){
        if (! this.mutable) throw new Error("overlay config not mutable");
    }
    /**
     * write back a list after it potentially has been changed
     * the buckets in the list are ignored and computed from the sequence
     * and detect changes
     * @param overlayList
     */
    writeBack(overlayList){
        this.checkMutable();
        if (! overlayList) return false;
        let newDefaults=[];
        let newOverlays=[];
        let bucketNames=OverlayConfig.getBucketNames();
        let currentBucket='L2';
        let normalItemBuckets=['L2','L1','H1','H2'];
        overlayList.forEach((item) => {
            if (this.isChartBucket(item)) {
                currentBucket = 'M';
                return;
            }
            if (getKeyFromOverlay(item) === undefined) return;
            if (item.isDefault) {
                let currentIndex = bucketNames.indexOf(currentBucket);
                if (currentIndex < bucketNames.indexOf('M')) {
                    currentBucket = 'L';
                } else {
                    currentBucket = 'H'
                }
                item.bucket = currentBucket; //not really necessary...
                newDefaults.push(item);
                return;
            }
            let index = bucketNames.indexOf(currentBucket);
            while (normalItemBuckets.indexOf(currentBucket) < 0
            && index >= 0 && index < (bucketNames.length - 1)) {
                index++;
                currentBucket = bucketNames[index];
            }
            item.bucket = currentBucket;
            newOverlays.push(item);
        })
        if (newOverlays.length !== this.config.overlays.length){
            this.hasChanges=true;
            this.config.overlays=newOverlays;
        }
        else{
            let isChanged=false;
            let writeBackOverlays=[];
            for (let i=0;i<newOverlays.length;i++){
                if (!shallowcompare(this.config.overlays[i],newOverlays[i])){
                    isChanged=true;
                }
                writeBackOverlays.push(filterOverlayItem(newOverlays[i]));
            }
            if (isChanged){
                this.config.overlays=writeBackOverlays;
                this.hasChanges=true;
            }
        }
        let newOverrides={};
        newDefaults.forEach((item)=>{
            let id= getKeyFromOverlay(item);
            if (id === undefined) return;
            let old=undefined;
            this.config.defaults.forEach((item)=>{
                if (getKeyFromOverlay(item) === id) old=item;
            })
            if (! old) return; //someone tried to add a new default - not possible
            let newOverride=Helper.filteredAssign(OVERRIDE_KEYS,item);
            if (!shallowcompare(Helper.filteredAssign(OVERRIDE_KEYS,old),newOverride)) {
                newOverrides[id] = newOverride;
            }
        })
        for (let k in this.config.defaultsOverride){
            if (! shallowcompare(this.config.defaultsOverride[k],newOverrides[k])) this.hasChanges=true;
        }
        for (let k in newOverrides){
            if (! shallowcompare(this.config.defaultsOverride[k],newOverrides[k])) this.hasChanges=true;
        }
        this.config.defaultsOverride=newOverrides;
        return this.hasChanges;
    }

    setUseDefault(newValue){
        this.checkMutable();
        if (newValue !== this.config.useDefault){
            this.config.useDefault=newValue;
            this.hasChanges=true;
        }
    }
    getUseDefault(){
        return this.config.useDefault === undefined || this.config.useDefault;
    }

    /**
     * get the current config for writing back
     * no copies!
     * @returns {{overlays: *, name: *, useDefault: boolean, defaultsOverride: {}}}
     */
    getWriteBackData(){
        const overlays=[];
        if (this.config && this.config.overlays) {
            this.config.overlays.forEach((item) => {
                overlays.push(overlayResetExpands(item, true));
            })
        }
        return {
            useDefault: this.config.useDefault,
            name: this.config.name,
            overlays: overlays,
            defaultsOverride: this.config.defaultsOverride
        }
    }

    /**
     * currently we only merge in the enabled state
     * @param overrides OverlayConfig
     */
    mergeOverrides(overrides){
        const MERGE_FILTER={enabled:true};
        this.checkMutable();
        this.config.overlays.forEach((overlay)=>{
            let override=overrides.getCurrentItemConfig(overlay);
            Object.assign(overlay,Helper.filteredAssign(MERGE_FILTER,override));
        })
        this.config.defaults.forEach((overlay)=>{
            let id=getKeyFromOverlay(overlay);
            if (id === undefined) return;
            let override=overrides.getCurrentItemConfig(overlay);
            let our=this.getCurrentItemConfig(overlay);
            let merged=Helper.filteredAssign(MERGE_FILTER,our,override);
            this.config.defaultsOverride[id]={...this.config.defaultsOverride[id],...merged};
        })
    }
    reset(){
        this.checkMutable();
        let numOverrides=0;
        for (let k in this.config.defaultsOverride){
            numOverrides++;
        }
        if (this.config.overlays.length > 0 || numOverrides || ! this.config.useDefault){
            this.hasChanges=true;
        }
        this.config.overlays=[];
        this.config.defaultsOverride={};
        this.config.useDefault=true;
        return this.hasChanges;
    }
    isEmpty() {
        if (this.config.useDefault === false) return false;
        if (this.config.overlays.length > 0) return false;
        for (let idx in this.config.defaults) {
            let currentDefault = this.config.defaults[idx];
            if (getKeyFromOverlay(currentDefault) !== undefined) {
                let override = this.config.defaultsOverride[getKeyFromOverlay(currentDefault)];
                if (override) {
                    if (!shallowcompare(override, Helper.filteredAssign(OVERRIDE_KEYS, currentDefault))) return false;
                }
            }
        }
        return true;
    }
    changed(){
        return this.hasChanges;
    }
    isChartBucket(item){
        return item.bucket === 'M';
    }
    getCurrentItemConfig(item){
        let configEntries=[];
        if (getKeyFromOverlay(item) === undefined) return item;
        let isDefault=item.isDefault;
        let list=isDefault?this.config.defaults:this.config.overlays;
        let id=getKeyFromOverlay(item);
        for (let k in list){
            if (getKeyFromOverlay(list[k]) === id){
                configEntries.push(list[k]);
            }
        }
        if (isDefault) {
            configEntries.push(this.config.defaultsOverride[getKeyFromOverlay(item)]);
        }
        let rt={...item};
        configEntries.forEach((config)=>{
            Object.assign(rt,config);
        })
        return rt;
    }

    setAllEnabled(enabled){
        this.config.overlays.forEach((overlay)=>{
            this.setEnabled(overlay,enabled);
        })
        this.config.defaults.forEach((overlay)=>{
            this.setEnabled(overlay,enabled);
        })
    }
    setEnabled(item,enabled){
        this.checkMutable();
        let id=getKeyFromOverlay(item);
        if ( id === undefined) return;
        if (item.isDefault){
            this.config.defaultsOverride[id]={...this.config.defaultsOverride[id],enabled:enabled};
            this.hasChanges=true;
            return true;
        }
        else{
            for (let i=0;i<this.config.overlays.length;i++){
                if (getKeyFromOverlay(this.config.overlays[i]) === id){
                    Object.assign(this.config.overlays[i],{enabled:enabled});
                    this.hasChanges=true;
                    return true;
                }
            }
        }
    }

    getName(){
        return this.config.name;
    }
    hasDefaults(){
        return this.config.defaults.length > 0;
    }

    /**
     * remove an item from the config
     * item must have type and name
     * @param item
     * @param opt_defaults if set - also remove entries from defaults
     */
    removeItem(item,opt_defaults){
        if (! item || ! item.type || ! item.name) return false;
        if (! this.config || ! this.config.overlays) return false;
        let changed=false;
        const containers=opt_defaults?['overlays','defaults']:['overlays'];
        for (let container of containers) {
            const newOverlays=[];
            (this.config[container]||[]).forEach((overlay) => {
                if (item.name !== overlay.name || item.type !== overlay.type) {
                    newOverlays.push(overlay);
                } else {
                    changed = true;
                }
            });
            if (changed) {
                this.config[container] = newOverlays;
                this.hasChanges = true;
            }
        }
        return changed;
    }

    renameItem(item,newName){
        if (! item || ! item.type || ! item.name || ! newName) return false;
        if (! this.config || ! this.config.overlays) return false;
        let changed=0;
        this.config.overlays.forEach((overlay)=>{
            if (item.name !== overlay.name || item.type !== overlay.type) {
                return;
            }
            changed++;
            overlay.name=newName;
            delete overlay.url; //the url will be wrong any way
        });
        if (changed){
            this.hasChanges=true;
        }
        return changed;
    }

}

export const fetchOverlayConfig=(chartItem)=>{
    let getParameters = {
        request: 'api',
        type: 'chart',
        name:chartItem?chartItem.name:undefined,
        command: 'getConfig'
    };
    let defaultConfig;
    let config;
    const requests=[
        Requests.getJson(getParameters)
            .then((json)=>{
                config = json.data;
            })];
    if (chartItem) {
        requests.push(
            Requests.getJson({...getParameters, name:undefined})
                .then((config) => {
                    defaultConfig = config.data;
                }));
    }
    return Promise.all(requests)
        .then((result)=> {
            if (!config) throw new Error("unable to load overlay config");
            if (chartItem && !defaultConfig) throw new Error("unable to load default config");
            if (config.useDefault === undefined) config.useDefault = true;
            const overlayConfig= new OverlayConfig(config, true, defaultConfig ? defaultConfig.overlays : undefined);
            return overlayConfig;
        })
}
export const DEFAULT_OVERLAY_CONFIG = "default.cfg";

export const handleOverlaysSum = async (chartList, handleOneConfig) => {
    try {
        const results = await handleOverlays(chartList, handleOneConfig);
        let num = 0;
        let esum=0;
        let errors = "";
        results.forEach(item => {
            if (item.status !== 'OK') {
                errors += item.name + ":" + item.status + ","
            } else {
                const changes=parseInt(item.info);
                num += changes;
                if (changes) esum+=1;
            }
        })
        return {
            status: (errors !== "") ? errors : 'OK',
            sum: num,
            numOverlays:esum
        }
    }catch (error){
        return {
            status: error+""
        }
    }
}
export const removeItemsFromOverlays = async (chartList, itemList) => {
    if (! itemList) return false;
    const handleOneConfig=(overlayConfig,idx)=>{
        let numChanges = 0;
        itemList.forEach(item => {
            if (overlayConfig.removeItem(item)) {
                numChanges++;
            }
        })
        return numChanges;
    }
    const res=await handleOverlaysSum(chartList, handleOneConfig);
    if (res.status==='OK'){
        res.info=`removed ${res.sum} entries from ${res.numOverlays} overlays`;
    }
    return res;
}
export const renameItemInOverlays=async (chartlist,item,newName)=>{
    if (!item || ! newName) return false;
    const handleOneConfig=(overlayConfig,idx)=>{
        return overlayConfig.renameItem(item,newName);
    }
    const res=await handleOverlaysSum(chartlist,handleOneConfig);
    if (res.status==='OK'){
        res.info=`renamed ${res.sum} entries from ${res.numOverlays} overlays`;
    }
    return res;
}
/**
 * execute a callback function on multiple overlay configs
 * @param chartList the list of charts (as returned from a list request, each item must have the name property)
 *                  if name is unset or DEFAULT_OVERLAY_CONFIG it adresses the default config
 *                  if not set - fetch all charts first
 * @param callback a callback function that is called with
 *        overlay - the overlay config as fetched from the server
 *        idx     - the index in the chart list
 *        return true to send back the overlay config to the server
 *        it can also return a promise
 * @returns {Promise<Awaited<*[]>|*>}
 */
export const handleOverlays = async (chartList, callback) => {
    if (! chartList) {
        const data=await Requests.getJson({
            type:"chart",
            command:"list"
        });
        chartList=data.items||[];
        chartList.push({
            name:DEFAULT_OVERLAY_CONFIG
        })

    }
    const results = [];
    const actions = [];
    const alreadyHandled = {};
    const updateResult = (idx, status, info) => {
        results.forEach((item) => {
            if (item.index === idx) {
                item.status = status;
                item.info = info;
            }
        })
    }
    const writeBack=async (overlay,requestName )=>{
        if (! overlay) return false;
        if (overlay.isEmpty()){
            await Requests.getJson({
                type:'chart',
                command: 'deleteConfig',
                name: requestName
            })
            return;
        }
        let postParam = {
            request: 'api',
            command: 'saveConfig',
            type: 'chart',
            name: requestName,
            overwrite: true
        };
        await Requests.postPlain(postParam, JSON.stringify(overlay.getWriteBackData(), undefined, 2))
    }
    const handleOneChart=async (requestName,chart,idx)=>{
        const data = await Requests.getJson({
            type: 'chart',
            command: 'getConfig',
            name: requestName,
        });
        if (!data || ! data.data) throw new Error(" no overlay for " + chart);
        const overlay=new OverlayConfig(data.data);
        const  res=callback(overlay,idx);
        if (res instanceof Promise) {
            const wb=await res;
            if (wb){
                await writeBack(overlay,requestName);
            }
            return (!!wb)
        }
        else{
            if (res) await writeBack(overlay,requestName);
            return (!!res);
        }
    }
    let listIdx=-1;
    chartList.forEach(chart => {
        listIdx+=1;
        if (chart instanceof Object) {
            chart = chart.name;
        }
        if (alreadyHandled[chart]) {
            return;
        }
        alreadyHandled[chart] = true;
        const idx = results.length;
        const resEntry = {
            name: chart,
            info: "not handled",
            status: 'FAIL',
            index: idx
        }
        const requestName=chart === DEFAULT_OVERLAY_CONFIG?undefined:chart;

        actions.push(handleOneChart(requestName,chart,listIdx));
        resEntry.info = "started";
        results.push(resEntry);
    })
    if (actions.length > 0) {
        const actionResults = await Promise.allSettled(actions);

        for (let i = 0; i < actionResults.length; i++) {
            const res = actionResults[i];
            if (res.status === 'fulfilled') {
                updateResult(i, 'OK', res.value);
            } else {
                updateResult(i, res.reason || 'ERROR', res.reason);
            }
        }
        return results;
    } else {
        return results;
    }
}