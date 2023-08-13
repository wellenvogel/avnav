import Requests from '../util/requests.js';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from '../base.js';
import assign from 'object-assign';
import Helper from "../util/helper";

export const LOCAL_TYPES=Helper.keysToStr({
    connectionLost:1,
    AIS:2
});

class AlarmHandler{
    constructor(){
        this.timerFunction=this.timerFunction.bind(this);
        this.startTimer=this.startTimer.bind(this);
        this.timer=undefined;
        this.lastSequence=globalStore.getData(keys.nav.gps.updatealarm);
        this.localAlarms={};
        this.sounds={};
        this.alarmBlocks={};
        this.blockId=1;
    }

    addBlock(alarmName){
        this.blockId++;
        this.alarmBlocks[this.blockId]=alarmName;
        return this.blockId;
    }
    removeBlock(id){
        delete this.alarmBlocks[id];
    }
    start(){
        this.startTimer();
        for (let alarm in LOCAL_TYPES){
            if (this.sounds[alarm]) continue;
            let cfg=this.getAlarmSound({name:alarm},true);
            try {
                if (cfg && cfg.src) {
                    fetch(new Request(cfg.src))
                        .then((r) => r.blob())
                        .then((bl) => this.sounds[alarm] = bl)
                        .catch((e) => {
                        })
                }
            }catch(e){}
        }
    }
    compareAlarms(a,b){
        if (!a !== !b) return false;
        if (! (a instanceof Object) || ! (b instanceof Object)) return false;
        let foundKeys={};
        for (let k in a){
            if (! b[k]) return false;
            if (a[k].name !== b[k].name) return false;
            if (a[k].running !== b[k].running) return false;
            if (a[k].category !== b[k].category) return false;
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
                    globalStore.storeData(keys.nav.alarms.all,assign({}, json.data,this.localAlarms));
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
    startLocalAlarm(type,opt_category){
        if (! LOCAL_TYPES[type]) return;
        for (let k in this.alarmBlocks){
            if (this.alarmBlocks[k] === type) {
                return;
            }
        }
        if (! opt_category) opt_category='info';
        let alarms=assign({},globalStore.getData(keys.nav.alarms.all));
        let alarm={category:opt_category,name:type,isLocal:true,running:true,repeat:1};
        this.localAlarms[type]=alarm;
        alarms[type]=alarm;
        globalStore.storeData(keys.nav.alarms.all,alarms);
    }
    stopAlarm(type){
        let alarms=assign({},globalStore.getData(keys.nav.alarms.all));
        delete alarms[type];
        globalStore.storeData(keys.nav.alarms.all,alarms);
        if ( LOCAL_TYPES[type]) {
            delete this.localAlarms[type];
            return;
        }
        Requests.getJson("?request=alarm&stop="+type).then(
            (json)=>{

            }
        ).catch(
            (error)=>{
                base.log("unable to stop alarm "+type);
            }
        );
    }

    getAlarmSound(alarmConfig,opt_ignoreLocal){
        if (! opt_ignoreLocal && this.sounds[alarmConfig.name]){
            return {
                src: URL.createObjectURL(this.sounds[alarmConfig.name]),
                repeat: alarmConfig.repeat,
                enabled: true
            }
        }
        return {
            src: globalStore.getData(keys.properties.navUrl) + "?request=download&type=alarm&name=" + encodeURIComponent(alarmConfig.name),
            repeat: alarmConfig.repeat,
            enabled: true
        };
    }

    sortedActiveAlarms(allAlarms){
        let rt=[];
        for(let k in allAlarms){
            let alarm=allAlarms[k];
            if (! alarm.running) continue;
            rt.push({name:k,category:alarm.category,repeat:alarm.repeat})
        }
        rt.sort((a,b)=>{
            if (a.category === b.category) return 0;
            if (a.category === undefined && b.category !== undefined) return 1;
            if (a.category !== undefined && b.category === undefined) return -1;
            if (b.category === undefined) return -1;
            if (a.category === 'critical') return -1;
            if (a.category === 'info' && b.category === 'critical') return 1;
            return 0;
        })
        return rt;
    }

}

export default  new AlarmHandler();