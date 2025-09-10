import base from '../base.js';
import remotechannel, {COMMANDS} from "./remotechannel";


class Mapping{
    constructor(idx,page,component,action){
        this.component=component;
        this.action=action;
        this.page=page;
        this.idx=idx;
    }
}

export const PageKeyMode = {
    ALL: 'all',
    NONE: 'none',
    EXPLICIT: 'explicit'
}

class KeyHandler{
    static CONFIG='_config'; //entry at page mappings for config values
    static CFG_mode='mode'; //config for page mode
    constructor(){
        this.keymappings={};
        this.merges={};
        this.mergeLevels=[];
        this.registrations={};
        this.page=undefined;
        this.pageConfig={};
        this.ALLPAGES="all";
        this.dialogComponents=[]; //components registered here will be handled in dialogs
        this.remoteSubscription=remotechannel.subscribe(COMMANDS.key,(msg)=>{
            this.handleKey(msg);
        })
    }

    registerDialogComponent(component){
        if (component === KeyHandler.CONFIG) throw new Error("unable to register component "+component);
        if (this.dialogComponents.indexOf(component)>=0) return;
        this.dialogComponents.push(component);
    }
    registerHandler(handlerFunction,component,action){
        if (component === KeyHandler.CONFIG) throw new Error("unable to register component "+component);
        if (! this.registrations[component]){
            this.registrations[component]={};
        }
        let regComponent=this.registrations[component];
        if (! (action instanceof Array)){
            action=[action]
        }
        for (let i =0 ; i< action.length;i++) {
            if (!regComponent[action[i]]) regComponent[action[i]] = [];
            if (regComponent[action[i]].indexOf(handlerFunction) <0) {
                regComponent[action[i]].push(handlerFunction);
            }
        }
        return true;
    }
    deregisterHandler(handlerFunction){
        for (let k in this.registrations){
            let regComponent=this.registrations[k];
            for (let a in regComponent){
                let action=regComponent[a];
                let idx=action.indexOf(handlerFunction);
                if (idx >= 0){
                    action.splice(idx,1);
                }
                //TODO: should we remove anything?
            }
        }
    }

    /**
     * register the keymappings
     * @param mappings
     *        pagexyz:  {
     *                  componentA: {
     *                                  action1: key
     *                              }
     *                  }
     *  use "all" for all pages
     */
    registerMappings(mappings){
        //TODO: checks
        this.keymappings=mappings;
    }

    mergeMappings(level,mappings){
        this.merges[level]=mappings;
        if (this.mergeLevels.indexOf(level) < 0){
            this.mergeLevels.push(level);
            this.mergeLevels.sort();
        }
    }
    resetMerge(level){
        delete this.merges[level];
        let idx=this.mergeLevels.indexOf(level);
        if (idx < 0) return;
        this.mergeLevels.splice(idx,1);
        this.mergeLevels.sort();
    }

    setPage(page){
        this.page=page;
        this.pageConfig=this.findConfigForPage(page);
    }
    findConfigForPage(page){
        let rt={};
        for (let i=-1;i<this.mergeLevels.length;i++){
            const mapping=(i<0)?this.keymappings:this.merges[this.mergeLevels[i]];
            if (! mapping) continue;
            if (! mapping[page]) continue;
            const pageConfig=mapping[page][KeyHandler.CONFIG];
            if (! pageConfig) continue;
            Object.assign(rt,pageConfig);
        }
        return rt;
    }
    findMappingForPage(key,page,opt_inDialog) {
        let mapping=this.findMappingForPageInternal(key,page,opt_inDialog);
        if (! mapping) return;
        //check if we have the same page/action on higher merges
        //this would mean the key is not included there any more
        //so basically a higher level deleted the key completely
        let startIdx=mapping.idx;
        if (startIdx === undefined) startIdx=0;
        else startIdx++;
        for (let idx=startIdx;idx<this.mergeLevels.length;idx++){
            let mergeIndex=this.mergeLevels[idx];
            let mappings=this.merges[mergeIndex];
            if (! mappings) continue;
            //we need to use mapping.page as this could be "all" now
            let pageActions=mappings[mapping.page];
            if (! pageActions) continue;
            let component=pageActions[mapping.component];
            if (! component) continue;
            if (component[mapping.action] !== undefined){
                //we have an entry for this action
                //but as it has not been found by the search
                //our key will not be included here
                //so the mapping was deleted
                return;
            }
        }
        return mapping;

    }

    findMappingForPageInternal(key,page,opt_inDialog){
        let mapping=undefined;
        for (let lidx=this.mergeLevels.length-1;lidx>=0;lidx--) {
            try {
                mapping = this.findMappingForType(lidx, key, page,opt_inDialog);
                if (mapping) return mapping;
                if (this.pageConfig[KeyHandler.CFG_mode] !== PageKeyMode.EXPLICIT) {
                    mapping = this.findMappingForType(lidx, key, this.ALLPAGES, opt_inDialog);
                }
            } catch (e) {
                base.log("error when searching keymapping: " + e)
            }
            if (mapping) return mapping;
        }
        mapping=this.findMappingForType(undefined,key,page,opt_inDialog);
        if (mapping || this.pageConfig[KeyHandler.CFG_mode] === PageKeyMode.EXPLICIT) return mapping;
        return this.findMappingForType(undefined,key,this.ALLPAGES,opt_inDialog);

    }
    hasRegistrations(component,action){
        let compReg=this.registrations[component];
        if (!compReg) return false;
        for (let a in compReg){
            if (a === action) {
                return compReg[a].length > 0;
            }
        }
        return false;
    }
    findMappingForType(idx,key,page,opt_inDialog){
        let mappings;
        if (idx !== undefined){
            let mergeIndex=this.mergeLevels[idx];
            mappings=this.merges[mergeIndex];
        }
        else{
            mappings=this.keymappings;
        }
        if (mappings === undefined) return;
        if (key === undefined) return;
        if (page === undefined) return;
        if (! mappings[page]) return;
        for (let k in mappings[page]){
            if (opt_inDialog){
                if (this.dialogComponents.indexOf(k) < 0){
                    continue;
                }
            }
            let component=mappings[page][k];
            for (let a in component){
                if (! this.hasRegistrations(k,a)) continue;
                let actionKey=component[a];
                if (actionKey instanceof Array){
                    for (let i in actionKey){
                        if (actionKey[i] === key){
                            return new Mapping(idx,page,k,a);
                        }
                    }
                }
                else{
                    if (actionKey === key){
                        return new Mapping(idx,page,k,a);
                    }
                }
            }
        }
    }

    handleKeyEvent(keyEvent,opt_inDialog) {
        if (!keyEvent) return;
        let key = keyEvent.key;
        if (!key) return;
        if (keyEvent.ctrlKey) {
            key = "Control-" + key;
        }
        return this.handleKey(key, opt_inDialog, keyEvent)
    }
    handleKey(key,opt_inDialog,opt_keyEvent){
        base.log("handle key: "+key);
        if (! this.keymappings) return;
        if (this.pageConfig[KeyHandler.CFG_mode] === PageKeyMode.NONE) return
        let page=this.page;
        let mapping=this.findMappingForPage(key,page,opt_inDialog);
        if (! mapping) return;
        if (opt_keyEvent) {
            opt_keyEvent.preventDefault();
            opt_keyEvent.stopPropagation();
        }
        base.log("found keymapping, page="+page+", component="+mapping.component+", action="+mapping.action);
        let regComponent=this.registrations[mapping.component];
        if (! regComponent) return;
        let action=regComponent[mapping.action];
        if (! action) return;
        for (let i in action){
            action[i](mapping.component,mapping.action);
        }
    }
}


export default  new KeyHandler();