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
        this.registrations={};
        this.page=undefined;
        this.ALLPAGES="all";
    }
    registerHandler(handlerFunction,component,action){
        if (! this.registrations[component]){
            this.registrations[component]={};
        }
        let regComponent=this.registrations[component];
        if (! regComponent[action]) regComponent[action]=[];
        if (regComponent[action].indexOf(handlerFunction) >= 0) return false;
        regComponent[action].push(handlerFunction);
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

    setPage(page){
        this.page=page;
    }

    findMappingForPage(key,page){
        if (key === undefined) return;
        if (page === undefined) return;
        if (! this.keymappings[page]) return;
        for (let k in this.keymappings[page]){
            let component=this.keymappings[page][k];
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
        base.log("handle key: "+key);
        if (! key) return;
        if (! this.keymappings) return;
        let page=this.page;
        let mapping=this.findMappingForPage(key,page);
        if (! mapping){
            page=this.ALLPAGES;
            mapping=this.findMappingForPage(key,page);
        }
        if (! mapping) return;
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