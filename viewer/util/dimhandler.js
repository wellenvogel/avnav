import globalStore from './globalstore.jsx';
import keys from './keys.jsx';

const KEY=keys.gui.global.dimActive;
class DimmHandler{
    constructor(opt_defaultTimeout){
        this.timerAction=this.timerAction.bind(this);
        this.timer=window.setInterval(this.timerAction(),1000);
        this.timeout=opt_defaultTimeout||60000;
        globalStore.storeData(KEY,false);
        this.trigger=this.trigger.bind(this);
        this.activate=this.activate.bind(this);
        this.mode="manual";

    }
    activate(){
        if (this.mode != "manual" && this.mode != "timer") return;
        globalStore.storeData(KEY,true);
    }
    setMode(mode){
        if (this.mode != "manual" && this.mode != "timer" && this.mode != "off") return false;
        this.mode=mode;
        this.trigger();
    }
    timerAction(){
        if (this.mode == "timer"){
            if (globalStore.getData(KEY,false)) return;
            let now=(new Date()).getTime();
            if (now > (this.lastTrigger+this.timeout)){
                this.activate();
            }
        }
    }
    _setLastTrigger(){
        this.lastTrigger=(new Date()).getTime();
    }
    trigger(){
        this._setLastTrigger();
        globalStore.storeData(KEY,false);
    }
    isActive(){
        return globalStore.getData(KEY,false);
    }

}

export default new DimmHandler();