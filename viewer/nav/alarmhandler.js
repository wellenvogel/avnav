import Requests from '../util/requests.js';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from '../base.js';
import assign from 'object-assign';


class AlarmHandler{
    constructor(){
        this.timerFunction=this.timerFunction.bind(this);
        this.startTimer=this.startTimer.bind(this);
        this.timer=undefined;
        this.lastSequence=globalStore.getData(keys.nav.gps.updatealarm);
    }

    start(){
        this.startTimer();
    }
    compareAlarms(a,b){
        if (!a !== !b) return false;
        if (! (a instanceof Object) || ! (b instanceof Object)) return false;
        let foundKeys={};
        for (let k in a){
            if (! b[k]) return false;
            if (a[k].name != b[k].name) return false;
            if (a[k].running != b[k].running) return false;
            foundKeys[k]=true;
        }
        for (let k in b){
            if (!foundKeys[k]) return false;
        }
        return true;
    }

    startTimer(){
        if (this.timer) window.clearTimeout(this.timer);
        this.timer=undefined;
        let interval=globalStore.getData(keys.properties.positionQueryTimeout);
        window.setTimeout(this.timerFunction,interval);
    }
    timerFunction(){
        let currentSequence=globalStore.getData(keys.nav.gps.updatealarm);
        if (this.lastSequence === undefined || this.lastSequence != currentSequence) {
            this.lastSequence=currentSequence;
            Requests.getJson("?request=alarm&status=all")
                .then((json)=> {
                    this.startTimer();
                    let old = globalStore.getData(keys.nav.alarms.all);
                    if (this.compareAlarms(old, json.data)) return;
                    globalStore.storeData(keys.nav.alarms.all, json.data)
                })
                .catch((error)=> {
                    this.startTimer();
                    base.log("alarm query error: " + error);
                });
        }
        else{
            this.startTimer();
        }
    }

    stopAlarm(type){
        let alarms=assign({},globalStore.getData(keys.nav.alarms.all));
        delete alarms[type];
        globalStore.storeData(keys.nav.alarms.all,alarms);
        Requests.getJson("?request=alarm&stop="+type).then(
            (json)=>{

            }
        ).catch(
            (error)=>{
                base.log("unable to stop alarm "+type);
            }
        );
    }

}

export default  new AlarmHandler();