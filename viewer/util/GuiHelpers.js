import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import KeyHandler from './keyhandler.js';
import LayoutHandler from './layouthandler.js';
import assign from 'object-assign';




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
        interval:interval
    };
    const startTimer=(sequence)=>{
        if (sequence !== undefined && sequence != timerData.sequence) {
            return;
        }
        if (timerData.timer) {
            timerData.sequence++;
            window.clearTimeout(timerData.timer);
        }
        if (! timerData.interval) return;
        let currentSequence=timerData.sequence;
        timerData.timer=window.setTimeout(()=>{
            timerData.timer=undefined;
            if (currentSequence != timerData.sequence) return;
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
        if (sequence !== undefined && sequence != timerData.sequence) {
            return;
        }
        if (timerData.timer) {
            timerData.sequence++;
            window.clearTimeout(timerData.timer);
            timerData.timer=undefined;
        }
    };
    lifecycleSupport(thisref,(unmount)=>{
        timerData.sequence++;
        if (unmount){
            stopTimer();
        }
        else if(opt_autostart){
            timercallback.apply(thisref,[timerData.sequence]);
        }
    });
    return {
        startTimer:startTimer,
        setTimeout:setTimeout,
        stopTimer:stopTimer,
        currentSequence:()=>{return timerData.sequence}
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
    storeHelperState
};