import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import KeyHandler from './keyhandler.js';
import LayoutHandler from './layouthandler.js';
import assign from 'object-assign';
import shallowcompare from "./compare";
import Requests from "./requests";
import base from "../base";
import {useEffect, useState} from "react";




const resizeElementFont=(el)=>{
    let MAX=250;
    let MIN=10;
    if (!el) return;
    let current=el.style.fontSize;
    let start=100;
    let keepSize=false;
    if (current && current.match(/\%/)){
        try {
            start = parseFloat(current);
            if (isNaN(start) || start < MIN || start > MAX) start=100;
            else keepSize=true;
        }catch(e){}
    }
    if (! keepSize) {
        el.style.fontSize = start+"%";
    }
    if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
        //scale down
        for (let size = start; (el.scrollHeight > el.clientHeight ||  el.scrollWidth > el.clientWidth) && size > MIN ; size -= 10) {
            el.style.fontSize = size + '%';
        }
    }
    else{
        let lastSize=start;
        for (let size = start; el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight && size <= MAX ; size += 10) {
            lastSize=size;
            el.style.fontSize = size + '%';
        }
        if (lastSize > start){
            //maybe we went multi-line...
            lastSize-=10;
            el.style.fontSize = lastSize + '%';
        }
    }
};

const resizeByQuerySelector=(querySelector)=>{
    let elements  = document.querySelectorAll(querySelector);
    if (elements.length < 0) {
        return;
    }
    for (let i = 0; i < elements.length; i++) {
        resizeElementFont(elements[i]);
    } 
};


/**
 * will call the provided callback on mount (param: false),umount(param: true), update(optional, param false)
 * will be injected after the existing lifecycle methods
 * @param thisref
 * @param callback
 * @param opt_onUpdate
 */
const lifecycleSupport=(thisref,callback,opt_onUpdate)=> {
    let oldmount = thisref.componentDidMount;
    let oldunmount = thisref.componentWillUnmount;
    let oldupdate = thisref.componentDidUpdate;
    const newmount = ()=> {
        if (oldmount) oldmount.apply(thisref);
        callback.apply(thisref,[false]);
        };
    const newunmount = ()=> {
        if (oldunmount) oldunmount.apply(thisref);
        callback.apply(thisref,[true]);
    };
    thisref.componentDidMount=newmount.bind(thisref);
    thisref.componentWillUnmount=newunmount.bind(thisref);
    if (opt_onUpdate){
        const newupdate = ()=> {
            if (oldupdate) oldupdate.apply(thisref);
            callback.apply(thisref,[false]);
        };
    };
};

class Callback{
    constructor(cb){
        this.cb=cb;
    }
    dataChanged(data,keys){
        this.cb(data,keys);
    }
}
/**
 * easy access to global store
 * alternative to the Dynamic HOC
 * @param thisref
 * @param dataCanged will be called with an object with the new values
 * @param storeKeys
 * @param opt_callImmediate - call the cb with initial values 0/undef: never, 1: immediate, 2: on mount
 */
const storeHelper=(thisref,dataCanged,storeKeys,opt_callImmediate)=>{
    let cbHandler=new Callback(()=>{
        dataCanged(globalStore.getMultiple(storeKeys));
    });
    globalStore.register(cbHandler,storeKeys);
    lifecycleSupport(thisref,(unmount)=>{
        if (unmount ){
            globalStore.deregister(cbHandler)
        }
        else{
            if (opt_callImmediate == 2){
                dataCanged(globalStore.getMultiple(storeKeys));
            }
        }
    });
    if (opt_callImmediate == 1){
        dataCanged(globalStore.getMultiple(storeKeys));
    }
};

/**
 * get some data from the global store into our state
 * @param thisref
 * @param opt_stateName - if set - create a sub object in the state
 * @param storeKeys
 */
const storeHelperState=(thisref,storeKeys,opt_stateName)=>{
    let cbHandler=new Callback((data)=>{
        let ns={};
        if (opt_stateName) {
            ns[opt_stateName] = globalStore.getMultiple(storeKeys);
        }
        else{
            ns= globalStore.getMultiple(storeKeys);
        }
        thisref.setState(ns);
    });
    if (! thisref.state) thisref.state={};
    if (opt_stateName) {
        thisref.state[opt_stateName] = globalStore.getMultiple(storeKeys);
    }
    else{
        assign(thisref.state,globalStore.getMultiple(storeKeys));
    }
    globalStore.register(cbHandler,storeKeys);
    lifecycleSupport(thisref,(unmount)=>{
        if ( unmount ){
            globalStore.deregister(cbHandler)
        }
    });
    return {
        setValue:(name,value)=>{
            let sk=storeKeys[name];
            if (! sk) return;
            globalStore.storeData(sk,value);
        },
        setMultiple:(obj)=>{
            globalStore.storeMultiple(obj,storeKeys,false,true);
        }
    }
};

/**
 * set up a lifecycle controlled timer
 * @param thisref
 * @param timercallback - will be called when timer fires
 * @param interval - interval
 * @param opt_autostart - call the callback in didMount
 * @returns {{startTimer: Function, currentSequence: Function}}
 *          to start the timer again - just call startTimer on the return
 *          to get the current seqeunce - just call currentSequence (e.g. to throw away a fetch result)
 */
const lifecycleTimer=(thisref,timercallback,interval,opt_autostart)=>{
    let timerData={
        sequence:0,
        timer:undefined,
        interval:interval,
        unmounted:false
    };
    const startTimer=(sequence)=>{
        if (sequence !== undefined && sequence != timerData.sequence) {
            return;
        }
        if (timerData.unmounted) return;
        if (timerData.timer) {
            timerData.sequence++;
            window.clearTimeout(timerData.timer);
        }
        if (! timerData.interval) return;
        //console.log("lifecycle timer start",thisref,timerData.sequence);
        let currentSequence=timerData.sequence;
        timerData.timer=window.setTimeout(()=>{
            timerData.timer=undefined;
            if (currentSequence !== timerData.sequence) return;
            timercallback.apply(thisref,[currentSequence]);
        },timerData.interval);
    };
    const setTimeout=(newInterval,opt_stop)=>{
        timerData.interval=newInterval;
        if (opt_stop){
            if (timerData.timer) window.clearTimeout(timerData.timer);
            timerData.timer=undefined;
        }
    };
    const stopTimer=(sequence)=>{
        if (sequence !== undefined && sequence !== timerData.sequence) {
            return;
        }
        if (timerData.timer) {
            timerData.sequence++;
            //console.log("lifecycle timer stop",thisref,timerData.sequence);
            window.clearTimeout(timerData.timer);
            timerData.timer=undefined;
        }
    };
    lifecycleSupport(thisref,(unmount)=>{
        timerData.sequence++;
        //console.log("lifecycle timer",thisref,unmount,timerData.sequence);
        if (unmount){
            stopTimer();
            timerData.unmounted=true;
        }
        else if(opt_autostart){
            timercallback.apply(thisref,[timerData.sequence]);
        }
    });
    return {
        startTimer:startTimer,
        setTimeout:setTimeout,
        stopTimer:stopTimer,
        currentSequence:()=>{return timerData.sequence},
        guardedCall:(sequence,callback)=>{
            //console.log("guarded call start",thisref,sequence,timerData.sequence);
            if (sequence!== undefined && sequence !== timerData.sequence) {
                return;
            }
            let rt=callback();
            //console.log("guarded call end",thisref,sequence,timerData.sequence);
            return rt;
        }
    };
};

const keyEventHandler=(thisref,callback,component,action)=>{
    const handler=(cbComponent,cbAction)=>{
        callback(cbComponent,cbAction);
    };
    lifecycleSupport(thisref,(isUmount)=>{
        if (isUmount){
            KeyHandler.deregisterHandler(handler);
        }
        else{
            KeyHandler.registerHandler(handler,component,action);
        }
    });
};

const nameKeyEventHandler=(thisref,component,opt_callback)=>{
    if (! thisref.props || ! thisref.props.name || ! (thisref.props.onClick||opt_callback)) return;
    if (! component) component="widget";
    keyEventHandler(thisref,(cbComponent,cbAction)=>{
        if (cbComponent == component && cbAction == thisref.props.name){
            if (opt_callback){
                opt_callback.apply(thisref,[cbComponent,cbAction])
            }
            else {
                thisref.props.onClick();
            }
        }
    },component,thisref.props.name);
};

export const useKeyEventHandler=(props,component,opt_callback)=>{
    return useEffect(()=>{
        if (! props.name || ! (props.onClick|| opt_callback)) return;
        const handler=(cbComponent,cbAction)=>{
            if (cbComponent === component && cbAction === props.name){
                if (opt_callback) opt_callback(cbComponent,cbAction);
                else props.onClick();
            }
        };
        KeyHandler.registerHandler(handler,component,props.name);
        return ()=>{
            KeyHandler.deregisterHandler(handler);
        }
    },[])
}
export const useKeyEventHandlerPlain=(name,component,callback)=>{
    return useKeyEventHandler({name:name},component,callback);
}

//from https://stackoverflow.com/questions/487073/how-to-check-if-element-is-visible-after-scrolling
//returns:
//0 - no scroll
//1 - scrollTop
//2 - scrollBottom
//3 - left
//4 - right
const scrollInContainer=(parent, element)=> {
    if (!parent || ! element) return false;
    let parentRect = parent.getBoundingClientRect();
    let elRect = element.getBoundingClientRect();

    if (elRect.top < parentRect.top) return 1;
    if (elRect.bottom > parentRect.bottom) return 2;
    if (elRect.left < parentRect.left) return 3;
    if (elRect.right > parentRect.right) return 4;
    return 0;
};

const IMAGES=['png','jpg','svg','bmp','tiff','gif'];

/**
 * helper for maintaining an object inside a components state
 * it will add 2 fields to the state:
 *   values - the current values
 *   changed - a flag that is true if the values differ from the initialValues
 *             compared with shallowcompare
 * create a instance in the constructor:
 *    this.stateHelper=stateHelper(this,props.current);
 * later call it using
 *    this.stateHelper.changeValue(key,value)
 * @param thisref
 * @param initialValues
 * @param opt_namePrefix - prefix for the state variabe names
 */
export const stateHelper=(thisref,initialValues,opt_namePrefix)=>{
    let valueName="values";
    let changedName="changed";
    if (opt_namePrefix){
        valueName=opt_namePrefix+valueName;
        changedName=opt_namePrefix+changedName;
    }
    if (! thisref.state) thisref.state={};
    thisref.state[valueName]=assign({},initialValues);
    thisref.state[changedName]=false;
    let rt={
        setValue:(key,value)=>{
            let values=assign({},thisref.state[valueName]);
            if (values[key] == value) return;
            values[key]=value;
            let newState={};
            newState[valueName]=values;
            newState[changedName]=!shallowcompare(values,initialValues);
            thisref.setState(newState);
        },
        setState:(partialState,opt_overwrite)=>{
            let values;
            if (! opt_overwrite) values=assign({},thisref.state[valueName],partialState);
            else values=partialState;
            let newState={};
            newState[valueName]=values;
            newState[changedName]=!shallowcompare(values,initialValues);
            thisref.setState(newState);
        },
        isChanged(){
            return thisref.state[changedName]||false;
        },
        isItemChanged(name){
            return ! shallowcompare(rt.getValue(name),initialValues[name]);
        },
        reset(){
            let newState={};
            newState[valueName]=assign({},initialValues);
            newState[changedName]=false;
            thisref.setState(newState);
        },
        getValues(opt_copy){
            if (opt_copy){
                return assign({},thisref.state[valueName]);
            }
            return thisref.state[valueName]||{};
        },
        getState(opt_copy){
            return rt.getValues(opt_copy)
        },
        getValue(key,opt_default){
            let v=rt.getValues()[key];
            if (v === undefined && opt_default !== undefined){
                v=opt_default;
            }
            return v;
        }
    };
    return rt;

};
/**
 * migration support for legacy code
 * with useState the state helper is not really necessary any more - but to migrate old code this method could be helpful
 * @param initialValues
 * @returns {*|{}|{getValue(*, *): *, getState(*): *, getValues(*): (any), isChanged(): boolean, setValue: *, setState: *, reset(): void, isItemChanged(*): *}|boolean}
 */
export const useStateHelper=(initialValues)=>{
    const [values,setValues]=useState(initialValues);
    const [isChanged,setChanged]=useState(false);
    return {
        setValue:(key,value)=>{
            if (values[key] === value) return;
            let nv={};
            nv[key]=value;
            let nvalues={...values,nv};
            nvalues[key]=value;
            setValues(nvalues);
            setChanged(true);
        },
        setState:(partialState,opt_overwrite)=>{
            let nvalues=opt_overwrite?partialState:{...values,...partialState};
            setChanged(!shallowcompare(values,initialValues));
            setValues(nvalues);
        },
        isChanged(){
            return isChanged;
        },
        isItemChanged(name){
            return ! shallowcompare(values[name],initialValues[name]);
        },
        reset(){
            setValues(initialValues);
            setChanged(false);
        },
        getValues(opt_copy){
            if (opt_copy){
                return {...values};
            }
            return values;
        },
        getState(opt_copy){
            return opt_copy?{...values}:values;
        },
        getValue(key,opt_default){
            let rt=values[key];
            if (rt !== undefined) return rt;
            return opt_default;
        }
    }
}

const getServerCommand=(name)=>{
    return Requests.getJson({
        request:'api',
        type:'command',
        action:'getCommands'
    })
        .then((data)=> {
            if (!data.data) return;
            for (let i=0;i<data.data.length;i++){
                if (data.data[i].name === name){
                    return data.data[i];
                }
            }
        })
        .catch((e)=>base.log("unable to query server command "+name));
}

export default {
    resizeElementFont,
    resizeByQuerySelector,
    lifecycleSupport,
    lifecycleTimer,
    scrollInContainer,
    keyEventHandler,
    nameKeyEventHandler,
    IMAGES,
    storeHelper,
    storeHelperState,
    stateHelper,
    getServerCommand
};
