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
        this.buttonDef=this.buttonDef.bind(this);
        this.mode="manual";
        this.actionFunction=undefined;
        try {
            if (window && window.bonjourBrowser && window.bonjourBrowser.dimScreen) {
                this.actionFunction = window.bonjourBrowser.dimScreen.bind(window.bonjourBrowser);
            }
        }catch (e){}
        if (! this.actionFunction){
            try {
                //we must use the original injection point here as window.avnav.android will be set later only
                if (window.avnavAndroid && window.avnavAndroid.dimScreen) {
                    this.actionFunction = window.avnavAndroid.dimScreen.bind(window.avnavAndroid);
                }
            }catch(e){}
        }
        //test only...
        if (! this.actionFunction && window.location.search.match(/[?&]dimm=true/)){
            this.actionFunction=()=>{
                console.log("dimmer");
            }
        }

    }
    activate(){
        if (this.mode != "manual" && this.mode != "timer") return;
        if (! this.enabled()) return;
        globalStore.storeData(KEY,true);
        let dimFade=parseInt(globalStore.getData(keys.properties.dimFade,0));
        if (dimFade < 0) dimFade=0;
        if (dimFade > 100) dimFade=100;
        this.actionFunction(dimFade);
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
        if (this.actionFunction) this.actionFunction(100);
    }
    isActive(){
        return globalStore.getData(KEY,false);
    }
    canHandle(){
        return this.actionFunction !== undefined;
    }
    enabled(){
        return this.canHandle() && globalStore.getData(keys.properties.showDimButton,false);
    }
    buttonDef(){
        return{
            name: 'Dim',
            onClick: this.activate,
            visible: this.enabled(),
            overflow: true
        }
    }

}

export default  new DimmHandler();