import globalStore from './globalstore.jsx';
import keys from './keys.jsx';
import splitsupport from "./splitsupport";
import Helper from "./helper";
import GuiHelpers from "./GuiHelpers";
import base from "../base";
import RequestHandler from "./requests";

const KEY=keys.gui.global.dimActive;
const URLPARAM="dimm";
class DimmHandler{
    constructor(opt_defaultTimeout){
        this.timerAction=this.timerAction.bind(this);
        this.timer=window.setInterval(this.timerAction(),1000);
        this.timeout=opt_defaultTimeout||60000;
        globalStore.storeData(KEY,false);
        this.trigger=this.trigger.bind(this);
        this.activate=this.activate.bind(this);
        this.buttonDef=this.buttonDef.bind(this);
        this.toggle=this.toggle.bind(this);
        this.mode="manual";
        this.actionFunction=undefined;
        this.lastTrigger=0;
        this.lastOff=0;
        splitsupport.subscribe('dimm',(data)=>{
            if (data.value !== globalStore.getData(KEY)){
                if (data.value) this.activate(true);
                else this.trigger(true);
            }
        })

    }
    init(){
        let mode=Helper.getParam(URLPARAM);
        if (mode){
            if (mode.match(/^server:/)){
                let command=mode.replace(/^server:/,'');
                GuiHelpers.getServerCommand(command)
                    .then((serverCommand)=>{
                        if (serverCommand) {
                            this.actionFunction = (value) => {
                                RequestHandler.getJson({
                                    request: 'api',
                                    type: 'command',
                                    action: 'runCommand',
                                    name: command,
                                    parameter: value+""
                                })
                                    .then((res)=>{})
                                    .catch((err)=>base.log("cannot execute command "+command+": "+err));
                            }
                            splitsupport.addUrlParameter(URLPARAM,mode);
                        }
                    })
                    .catch((err)=>base.log("cannot get command for dim: "+command));
            }
            else{
                if (mode === "true"){
                    //TEST
                    this.actionFunction=(value)=>{
                        base.log("dimm called with "+value);
                    }
                }
            }
        }
        else {
            try {
                if (window && window.bonjourBrowser && window.bonjourBrowser.dimScreen) {
                    this.actionFunction = window.bonjourBrowser.dimScreen.bind(window.bonjourBrowser);
                }
            } catch (e) {
            }
            if (!this.actionFunction) {
                try {
                    //we must use the original injection point here as window.avnav.android will be set later only
                    if (window.avnavAndroid && window.avnavAndroid.dimScreen) {
                        this.actionFunction = window.avnavAndroid.dimScreen.bind(window.avnavAndroid);
                    }
                } catch (e) {
                }
            }
        }
    }
    activate(opt_noSend){
        if (this.mode != "manual" && this.mode != "timer") return;
        if (! this.enabled()) return;
        globalStore.storeData(KEY,true);
        let dimFade=parseInt(globalStore.getData(keys.properties.dimFade,0));
        if (dimFade < 0) dimFade=0;
        if (dimFade > 100) dimFade=100;
        this.actionFunction(dimFade);
        if (! opt_noSend){
            splitsupport.sendToFrame('dimm',{
                value: true
            })
        }
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

    trigger(opt_noSend){
        let now=(new Date()).getTime();
        this.lastTrigger=now;
        if (this.isActive()){
            this.lastOff=now;
        }
        globalStore.storeData(KEY,false);
        if (this.actionFunction) this.actionFunction(100);
        if (! opt_noSend){
            splitsupport.sendToFrame('dimm',{
                value: false
            })
        }
    }
    toggle(){
        if (this.isActive()){
            this.trigger();
        }
        else{
            let now=(new Date()).getTime();
            if (this.lastOff > (now - parseFloat(globalStore.getData(keys.properties.remoteDimGuard,200)))) {
                return;//prevent a re-activate in a remote channel action
            }
            this.activate();
        }
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
            onClick: ()=>this.activate(),
            visible: this.enabled(),
            overflow: true
        }
    }

}

export default  new DimmHandler();