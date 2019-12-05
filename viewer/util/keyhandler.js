import base from '../base.js';

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
        this.registrations={};
        this.page=undefined;
        this.ALLPAGES="all";
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

    mergeMappings(mappings){
        this.merges=mappings;
    }
    resetMerge(){
        this.merges={};
    }

    setPage(page){
        this.page=page;
    }

    findMappingForPage(key,page){
        let mapping=undefined;
        try {
            mapping = this.findMappingForType(this.merges, key, page);
        }catch(e){
            console.log("error when searching keymapping: "+e)
        }
        if (mapping) return mapping;
        return this.findMappingForType(this.keymappings,key,page);
    }
    findMappingForType(mappings,key,page){
        if (mappings === undefined) return;
        if (key === undefined) return;
        if (page === undefined) return;
        if (! mappings[page]) return;
        for (let k in mappings[page]){
            let component=mappings[page][k];
            for (let a in component){
                let actionKey=component[a];
                if (actionKey instanceof Array){
                    for (let i in actionKey){
                        if (actionKey[i] == key){
                            return new Mapping(k,a);
                        }
                    }
                }
                else{
                    if (actionKey == key){
                        return new Mapping(k,a);
                    }
                }
            }
        }
    }

    handleKeyEvent(keyEvent){
        if (! keyEvent) return;
        let key=keyEvent.key;
        if (! key) return;
        if (keyEvent.ctrlKey){
            key="Control-"+key;
        }
        base.log("handle key: "+key);
        if (! this.keymappings) return;
        let page=this.page;
        let mapping=this.findMappingForPage(key,page);
        if (! mapping){
            page=this.ALLPAGES;
            mapping=this.findMappingForPage(key,page);
        }
        if (! mapping) return;
        keyEvent.preventDefault();
        keyEvent.stopPropagation();
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


export default new KeyHandler();