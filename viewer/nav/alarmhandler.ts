import Requests, {prepareUrl} from '../util/requests';
import keys from '../util/keys';
import globalStore from '../util/globalstore';
import base from '../base';
import Helper from "../util/helper";

export const LOCAL_TYPES=Helper.keysToStr({
    connectionLost:1
});
export interface Alarm{
    alarm:string;
    repeat?:number,
    running?:boolean,
    category:string,
    isLocal?:boolean,
    message?:string,
    external?:boolean
}

interface SoundConfig{
    src:string,
    repeat?:number,
    enabled?:boolean
}
class AlarmHandler{
    private timer:number;
    private lastSequence:number;
    private localAlarms:Record<string, Alarm>;
    private sounds:Record<string,Blob>;
    private alarmBlocks:Record<number, string>;
    private blockId:number;
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

    addBlock(alarmName:string){
        this.blockId++;
        this.alarmBlocks[this.blockId]=alarmName;
        return this.blockId;
    }
    isBlocked(alarmName:string){
        for (const k in this.alarmBlocks){
            if (this.alarmBlocks[k]=== alarmName) return true;
        }
        return false;
    }
    removeBlock(id:number){
        delete this.alarmBlocks[id];
    }
    start(){
        this.startTimer();
        for (const alarm in LOCAL_TYPES){
            if (this.sounds[alarm]) continue;
            const cfg=this.getAlarmSound({alarm:alarm},true);
            try {
                if (cfg && cfg.src) {
                    fetch(new Request(cfg.src))
                        .then((r) => r.blob())
                        .then((bl) => this.sounds[alarm] = bl)
                        .catch(() => {
                        })
                }
            }catch(e){ /* empty */ }
        }
    }
    compareAlarms(a:Record<string,Alarm>,b:Record<string,Alarm>){
        if (!a !== !b) return false;
        if (! (a instanceof Object) || ! (b instanceof Object)) return false;
        const foundKeys:Record<string, boolean>={};
        for (const k in a){
            if (! b[k]) return false;
            if (a[k].alarm !== b[k].alarm) return false;
            if (a[k].running !== b[k].running) return false;
            if (a[k].category !== b[k].category) return false;
            foundKeys[k]=true;
        }
        for (const k in b){
            if (!foundKeys[k]) return false;
        }
        return true;
    }

    startTimer(){
        if (this.timer) window.clearTimeout(this.timer);
        this.timer=undefined;
        const interval=globalStore.getData(keys.properties.positionQueryTimeout);
        window.setTimeout(this.timerFunction,interval);
    }
    timerFunction(){
        const currentSequence=globalStore.getData(keys.nav.gps.updatealarm);
        if (this.lastSequence === undefined || this.lastSequence != currentSequence) {
            this.lastSequence=currentSequence;
            Requests.getJson({
                request:'api',
                type:'alarm',
                command:'manage',
                status:'all'
            })
                .then((json)=> {
                    this.startTimer();
                    const old = globalStore.getData(keys.nav.alarms.all);
                    if (this.compareAlarms(old, json.data)) return;
                    globalStore.storeData(keys.nav.alarms.all,{... json.data,...this.localAlarms});
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
    startLocalAlarm(type:string,opt_category?:string):Alarm{
        if (! LOCAL_TYPES[type]) return;
        if (this.isBlocked(type))return;
        if (! opt_category) opt_category='info';
        const alarms={...globalStore.getData(keys.nav.alarms.all)};
        const alarm:Alarm={category:opt_category,alarm:type,isLocal:true,running:true,repeat:1};
        this.localAlarms[type]=alarm;
        alarms[type]=alarm;
        globalStore.storeData(keys.nav.alarms.all,alarms);
    }
    stopAlarm(type:string){
        const alarms={...globalStore.getData(keys.nav.alarms.all)};
        delete alarms[type];
        globalStore.storeData(keys.nav.alarms.all,alarms);
        if ( LOCAL_TYPES[type]) {
            delete this.localAlarms[type];
            return;
        }
        Requests.getJson({
            request:'api',
            type:'alarm',
            command:'manage',
            stop:type
        }).then(
            ()=>{

            }
        ).catch(
            (error:any)=>{
                base.log("unable to stop alarm "+type,error);
            }
        );
    }

    getAlarmSound(alarmConfig:Partial<Alarm>,opt_ignoreLocal?:boolean):SoundConfig{
        if (! opt_ignoreLocal && this.sounds[alarmConfig.alarm]){
            return {
                src: URL.createObjectURL(this.sounds[alarmConfig.alarm]),
                repeat: alarmConfig.repeat,
                enabled: true
            }
        }
        return {
            src: prepareUrl({
                command:'download',
                type:'alarm',
                name:alarmConfig.alarm
            }),
            repeat: alarmConfig.repeat,
            enabled: true
        };
    }

    sortedActiveAlarms(allAlarms:Record<string,Alarm>){
        const rt:Alarm[]=[];
        for(const k in allAlarms){
            const alarm=allAlarms[k];
            if (! alarm.running) continue;
            rt.push({...alarm})
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