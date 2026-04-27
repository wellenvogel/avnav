import globalStore from './globalstore';
import keys from './keys';
import splitsupport from "./splitsupport";
import Helper from "./helper";
import base from "../base";
import RequestHandler from "./requests";
import {getServerCommand} from "./UiHelper";
import {iconClasses} from '../components/Icons';

const KEY=keys.gui.global.dimActive;
const URLPARAM="dimm";
type ActionFunction=(p:string|number)=>(void|Promise<void>)
class DimmHandler{
    // @ts-ignore
    private timer: number;
    private timeout: number;
    private mode: string;
    private actionFunction:ActionFunction;
    private lastTrigger: number;
    private lastOff: number;
    constructor(opt_defaultTimeout?:number){
        this.timerAction=this.timerAction.bind(this);
        this.timer=window.setInterval(()=>this.timerAction(),1000);
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
        splitsupport.subscribe('dimm',(data:{value:string})=>{
            if (data.value !== globalStore.getData(KEY)){
                if (data.value) this.activate(true);
                else this.trigger(true);
            }
        })

    }
    init(){
        const mode=Helper.getParam(URLPARAM);
        if (mode){
            if (mode.match(/^server:/)){
                const command=mode.replace(/^server:/,'');
                getServerCommand(command)
                    .then((serverCommand)=>{
                        if (serverCommand) {
                            this.actionFunction = (value:string) => {
                                RequestHandler.getJson({
                                    request: 'api',
                                    type: 'command',
                                    command: 'runCommand',
                                    name: command,
                                    parameter: value+""
                                })
                                    .then(()=>{})
                                    .catch((err)=>base.log("cannot execute command "+command+": "+err));
                            }
                            splitsupport.addUrlParameter(URLPARAM,mode);
                        }
                    })
                    .catch(()=>base.log("cannot get command for dim: "+command));
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
                // @ts-ignore
                if (window && window.bonjourBrowser && window.bonjourBrowser.dimScreen) {
                    // @ts-ignore
                    this.actionFunction = window.bonjourBrowser.dimScreen.bind(window.bonjourBrowser);
                }
            } catch (e) {
                base.log("dimhandler action error",e);
            }
            if (!this.actionFunction) {
                try {
                    // @ts-ignore
                    if (window.avnavAndroid && window.avnavAndroid.dimScreen) {
                        // @ts-ignore
                        this.actionFunction = window.avnavAndroid.dimScreen.bind(window.avnavAndroid);
                    }
                } catch (e) {
                }
            }
        }
    }
    activate(opt_noSend?:boolean){
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
    setMode(mode:string){
        if (this.mode != "manual" && this.mode != "timer" && this.mode != "off") return false;
        this.mode=mode;
        this.trigger();
    }
    timerAction(){

        if (this.mode == "timer"){
            if (globalStore.getData(KEY,false)) return;
            const now=(new Date()).getTime();
            if (now > (this.lastTrigger+this.timeout)){
                this.activate();
            }
        }
    }

    trigger(opt_noSend?:boolean){
        const now=(new Date()).getTime();
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
            const now=(new Date()).getTime();
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
        return this.canHandle();
    }
    buttonDef(){
        return{
            name: 'Dim',
            iconClass: iconClasses.Dim,
            onClick: ()=>this.activate(),
            visible: this.enabled(),
            overflow: true
        }
    }

}

export default  new DimmHandler();