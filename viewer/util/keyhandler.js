import base from '../base.js';
import remotechannel, {COMMANDS} from "./remotechannel";

class Mapping{
    constructor(component,action){
        this.component=component;
        this.action=action;
    }
}

class KeyHandler{
    constructor(){
        this.keymappings={};
        this.merges={};
        this.mergeLevels=[];
        this.registrations={};
        this.page=undefined;
        this.ALLPAGES="all";
        this.enabled=true;
        this.dialogComponents=[]; //components registered here will be handled in dialogs
        this.remoteSubscription=remotechannel.subscribe(COMMANDS.key,(msg)=>{
            this.handleKey(msg);
        })
    }
    disable(){
        this.enabled=false;
    }
    enable(){
        this.enabled=true;
    }
    registerDialogComponent(component){
        if (this.dialogComponents.indexOf(component)>=0) return;
        this.dialogComponents.push(component);
    }
    registerHandler(handlerFunction,component,action){
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
    }

    findMappingForPage(key,page,opt_inDialog){
        let mapping=undefined;
        for (let lidx=this.mergeLevels.length-1;lidx>=0;lidx--) {
            let mergeIndex=this.mergeLevels[lidx];
            try {
                mapping = this.findMappingForType(this.merges[mergeIndex], key, page,opt_inDialog);
                if (mapping) return mapping;
                mapping = this.findMappingForType(this.merges[mergeIndex], key,this.ALLPAGES ,opt_inDialog);
            } catch (e) {
                console.log("error when searching keymapping: " + e)
            }
            if (mapping) return mapping;
        }
        mapping=this.findMappingForType(this.keymappings,key,page,opt_inDialog);
        if (mapping) return mapping;
        return this.findMappingForType(this.keymappings,key,this.ALLPAGES,opt_inDialog);

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
    findMappingForType(mappings,key,page,opt_inDialog){
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
                            return new Mapping(k,a);
                        }
                    }
                }
                else{
                    if (actionKey === key){
                        return new Mapping(k,a);
                    }
                }
            }
        }
    }

    handleKeyEvent(keyEvent,opt_inDialog) {
        if (!this.enabled) return;
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