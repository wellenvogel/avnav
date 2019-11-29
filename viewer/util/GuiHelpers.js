import NavData from '../nav/navdata.js';
import Toast from '../components/Toast.jsx';
import PropertyHandler from '../util/propertyhandler.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import RouteEdit from '../nav/routeeditor.js';
import KeyHandler from './keyhandler.js';

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE,true);

const anchorWatchDialog = (overlayContainer)=> {
    let router = NavData.getRoutingHandler();
    if (activeRoute.anchorWatch() !== undefined) {
        router.anchorOff();
        //alarms will be stopped anyway by the server
        //but this takes some seconds...
        NavData.getGpsHandler().stopAlarm('anchor');
        NavData.getGpsHandler().stopAlarm('gps');
        return;
    }
    let pos = NavData.getCurrentPosition();
    if (!pos) {
        Toast("no gps position");
        return;
    }
    let def = globalStore.getData(keys.properties.anchorWatchDefault);
    OverlayDialog.valueDialogPromise("Set Anchor Watch", def, overlayContainer, "Radius(m)")
        .then(function (value) {
            router.anchorOn(pos, value);
        })
};

const resizeElementFont=(el)=>{
    if (!el) return;
    el.style.fontSize = "100%";
    if (el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth) {
        //scale down
        for (let size = 100; (el.scrollHeight > el.clientHeight ||  el.scrollWidth > el.clientWidth) && size > 10 ; size -= 10) {
            el.style.fontSize = size + '%';
        }
    }
    else{
        let lastSize=100;
        for (let size = 100; el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight && size <= 250 ; size += 10) {
            lastSize=size;
            el.style.fontSize = size + '%';
        }
        if (lastSize > 100){
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

const getPageFromLayout=(pagename)=>{
    let layout=globalStore.getData(keys.gui.global.layout);
    if (! layout) return;
    if (typeof(layout) !== 'object') return;
    let page=layout[pagename];
    if (typeof(page) !== 'object') return;
    return page;
};

const getPanelFromLayout=(pagename,panel,opt_filtername,opt_filtervalue)=>{
    let page=getPageFromLayout(pagename);
    if (! page) return;
    let panelname=panel;
    if (opt_filtername) {
        panelname += opt_filtervalue ? "_"+opt_filtername : "_not_"+opt_filtername;
    }
    let rt=page[panelname];
    if (rt) return rt;
    rt=page[panel];
    if (rt) return rt;
    return [];
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


module.exports={
    anchorWatchDialog,
    resizeElementFont,
    resizeByQuerySelector,
    getPageFromLayout,
    getPanelFromLayout,
    lifecycleSupport,
    lifecycleTimer,
    scrollInContainer,
    keyEventHandler,
    nameKeyEventHandler
};