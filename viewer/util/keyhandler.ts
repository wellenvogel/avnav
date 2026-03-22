import base from '../base';
// @ts-ignore
import remotechannel, {COMMANDS} from "./remotechannel";
import {PAGEIDS} from "./pageids";

type IDX=number
export type Page=typeof PAGEIDS[keyof typeof PAGEIDS];
export type ActionFunction=(component:string,action:string)=>void
/**
 * the type of one key mapping
 * dict with key being the action and values being lists of keys
 */
export type KeyMapping=Record<string, string|string[]>;
/**
 * the mapping for a component
 */
export type ComponentMapping=Record<string,KeyMapping>;
export type MappingPage=Page|'all';
/**
 * the global key mappings
 */
export type KeyMappings=Partial<Record<MappingPage, ComponentMapping>>
class Mapping{
    component: string;
    action: string;
    page: MappingPage;
    idx: IDX;
    constructor(
        idx:IDX,
        page:MappingPage,
        component:string,
        action:string){
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
type Actions=Record<string,ActionFunction[]>
class KeyHandler{
    static CONFIG='_config'; //entry at page mappings for config values
    static CFG_mode='mode'; //config for page mode
    private keymappings: KeyMappings;
    private merges: Record<number,KeyMappings>;
    private mergeLevels: number[];
    private registrations: Record<string,Actions>;
    private page: Page;
    private pageConfig: Record<string,typeof PageKeyMode[keyof typeof PageKeyMode]>;
    private ALLPAGES: string;
    private dialogComponents: string[];
    constructor(){
        this.keymappings={};
        this.merges={};
        this.mergeLevels=[];
        this.registrations={};
        this.page=undefined;
        this.pageConfig={};
        this.ALLPAGES="all";
        this.dialogComponents=[]; //components registered here will be handled in dialogs
        remotechannel.subscribe(COMMANDS.key,(msg:string)=>{
            this.handleKey(msg);
        })
    }

    registerDialogComponent(component:string){
        if (component === KeyHandler.CONFIG) throw new Error("unable to register component "+component);
        if (this.dialogComponents.indexOf(component)>=0) return;
        this.dialogComponents.push(component);
    }
    registerHandler(
        handlerFunction:ActionFunction,
        component:string,
        action:string|string[]){
        if (component === KeyHandler.CONFIG) throw new Error("unable to register component "+component);
        if (! this.registrations[component]){
            this.registrations[component]={};
        }
        const regComponent=this.registrations[component];
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
    deregisterHandler(handlerFunction:ActionFunction){
        for (const k in this.registrations){
            const regComponent=this.registrations[k];
            for (const a in regComponent){
                const action=regComponent[a];
                const idx=action.indexOf(handlerFunction);
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
    registerMappings(mappings:KeyMappings){
        //TODO: checks
        this.keymappings=mappings;
    }

    mergeMappings(level:number,mappings:KeyMappings){
        this.merges[level]=mappings;
        if (this.mergeLevels.indexOf(level) < 0){
            this.mergeLevels.push(level);
            this.mergeLevels.sort();
        }
    }
    resetMerge(level:number){
        delete this.merges[level];
        const idx=this.mergeLevels.indexOf(level);
        if (idx < 0) return;
        this.mergeLevels.splice(idx,1);
        this.mergeLevels.sort();
    }

    setPage(page:Page){
        this.page=page;
        this.pageConfig=this.findConfigForPage(page);
    }
    findConfigForPage(page:Page){
        const rt={};
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
    findMappingForPage(key:string,page:Page,opt_inDialog?:boolean) {
        const mapping=this.findMappingForPageInternal(key,page,opt_inDialog);
        if (! mapping) return;
        //check if we have the same page/action on higher merges
        //this would mean the key is not included there any more
        //so basically a higher level deleted the key completely
        let startIdx=mapping.idx;
        if (startIdx === undefined) startIdx=0;
        else startIdx++;
        for (let idx=startIdx;idx<this.mergeLevels.length;idx++){
            const mergeIndex=this.mergeLevels[idx];
            const mappings=this.merges[mergeIndex];
            if (! mappings) continue;
            //we need to use mapping.page as this could be "all" now
            const pageActions=mappings[mapping.page];
            if (! pageActions) continue;
            const component=pageActions[mapping.component];
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

    findMappingForPageInternal(key:string,page:Page,opt_inDialog?:boolean){
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
    hasRegistrations(component:string,action:string){
        const compReg=this.registrations[component];
        if (!compReg) return false;
        for (const a in compReg){
            if (a === action) {
                return compReg[a].length > 0;
            }
        }
        return false;
    }
    findMappingForType(idx:number,key:string,page:Page,opt_inDialog?:boolean){
        let mappings;
        if (idx !== undefined){
            const mergeIndex=this.mergeLevels[idx];
            mappings=this.merges[mergeIndex];
        }
        else{
            mappings=this.keymappings;
        }
        if (mappings === undefined) return;
        if (key === undefined) return;
        if (page === undefined) return;
        if (! mappings[page]) return;
        for (const k in mappings[page]){
            if (opt_inDialog){
                if (this.dialogComponents.indexOf(k) < 0){
                    continue;
                }
            }
            const component=mappings[page][k];
            for (const a in component){
                if (! this.hasRegistrations(k,a)) continue;
                const actionKey=component[a];
                if (Array.isArray(actionKey)){
                    for (const i of actionKey){
                        if (i === key){
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

    handleKeyEvent(keyEvent:KeyboardEvent,opt_inDialog?:boolean) {
        if (!keyEvent) return;
        let key = keyEvent.key;
        if (!key) return;
        if (keyEvent.ctrlKey) {
            key = "Control-" + key;
        }
        return this.handleKey(key, opt_inDialog, keyEvent)
    }
    handleKey(key:string,opt_inDialog?:boolean,opt_keyEvent?:KeyboardEvent) {
        base.log("handle key: "+key);
        if (! this.keymappings) return;
        if (this.pageConfig[KeyHandler.CFG_mode] === PageKeyMode.NONE) return
        const page=this.page;
        const mapping=this.findMappingForPage(key,page,opt_inDialog);
        if (! mapping) return;
        if (opt_keyEvent) {
            opt_keyEvent.preventDefault();
            opt_keyEvent.stopPropagation();
        }
        base.log("found keymapping, page="+page+", component="+mapping.component+", action="+mapping.action);
        const regComponent=this.registrations[mapping.component];
        if (! regComponent) return;
        const action=regComponent[mapping.action];
        if (! action) return;
        for (const i in action){
            action[i](mapping.component,mapping.action);
        }
    }
}


export default  new KeyHandler();