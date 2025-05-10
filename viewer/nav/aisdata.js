/**
 * Created by andreas on 04.05.14.
 */
import navobjects from './navobjects';
import Formatter from '../util/formatter';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import {aisproxy} from './aisformatter';
import {AisOptionMappings} from "./aiscomputations";
import Helper from "../util/helper";


export const fillOptions=()=>{
    let rt={};
    for (let k in AisOptionMappings){
        let mapping=AisOptionMappings[k];
        if (mapping instanceof Object){
            if ( (mapping.key instanceof Object)) {
                let v = globalStore.getMultiple(mapping.key);
                rt[k] = mapping.f(v);
            }
            else{
                let v = globalStore.getData(mapping.key);
                rt[k]=mapping.f(v);
            }
        }
        else{
            rt[k]=globalStore.getData(mapping);
        }
    }
    return rt;
}

const RECOMPUTE_TRIGGER=2000; //trigger AIS recomputation every xxx ms even if no boat data change

/**
 * the handler for the ais data
 * query the server...
 * @constructor
 */
class AisData {
    constructor(navdata) {

        this.navdata = navdata;

        this.receivedAis=[];

        /**
         * @private
         * @type {null}
         */
        this.timer = null;
        /**
         * @private
         * @type {number}
         */
        this.aisErrors = 0;
        /**
         * the mmsi of the tracked target
         * @type {number}
         */
        this.trackedAIStarget = undefined;

        this.lastBoatData=0;

        globalStore.register(this, [
            keys.gui.global.propertySequence,
            keys.nav.routeHandler.useRhumbLine
        ]);

        globalStore.register(()=>{
            this.sendBoatData()
        },[keys.nav.gps.position,keys.nav.gps.speed,keys.nav.gps.course,keys.nav.ais.trackedMmsi])

        /**
         * @private
         * @type {Formatter}
         */
        this.formatter = Formatter;
        /**
         * @private
         * a map mmsi->hideTime for hidden ais targets
         * @type {{}}
         */
        this.hiddenTargets = {};

        /**
         * @private
         * remember the last AIS center we ever used
         * this will be used if there is no current GPS available
         * @type {undefined}
         */
        this.lastAisCenter = undefined;

        this.aisOptions=fillOptions();
        this.workerSequence = 0;
        this.worker = new Worker(new URL("./aisworker.js", import.meta.url));
        this.worker.onmessage = ({data}) => {
            //console.log("Aisdata: ", data);
            if (data.type === 'data') {
                let storeKeys = {
                    nearestAisTarget: keys.nav.ais.nearest,
                    currentAis: keys.nav.ais.list,
                    updateCount: keys.nav.ais.updateCount
                };
                let nearestAisTarget;
                if (data.data && data.data.length) {
                    if (this.trackedAIStarget !== undefined) {
                        for (let i = 0; i < data.data.length; i++) {
                            if (data.data[i].received && data.data[i].received.mmsi == this.trackedAIStarget) {
                                nearestAisTarget = aisproxy(data.data[i]);
                                break;
                            }
                        }
                    }
                    if (nearestAisTarget === undefined) {
                        nearestAisTarget = aisproxy(data.data[0]);
                    }
                }
                globalStore.storeMultiple({
                    nearestAisTarget: nearestAisTarget,
                    currentAis: data.data,
                    updateCount: globalStore.getData(keys.nav.ais.updateCount, 0) + 1
                }, storeKeys);
            }
            if (data.type === 'error') {
                //TODO
            }
        };
        this.postWorker({
            type: 'config',
            options:this.aisOptions
        })
        this.postWorker({
            type:'hidden',
            hiddenTargets: this.hiddenTargets
        })

        /**
         * trigger recompute AIS
         * @type {number}
         */
        this.timer=window.setInterval(()=>{
            if ((this.lastBoatData+RECOMPUTE_TRIGGER) < Helper.now()){
                this.sendBoatData();
            }
        },RECOMPUTE_TRIGGER*1.1);
    }

    sendBoatData(){
        if (! this.worker) return;
        this.lastBoatData=Helper.now();
        this.postWorker({
            type:'boat',
            boatPosition:globalStore.getData(keys.nav.gps.position),
            boatSpeed: globalStore.getData(keys.nav.gps.speed),
            boatCourse: globalStore.getData(keys.nav.gps.course),
            trackedMMsi: globalStore.getData(keys.nav.ais.trackedMmsi)
        })
    }

    dataChanged() {
        this.aisOptions=fillOptions();
        this.postWorker({
            type: 'config',
            options:this.aisOptions
        })
    }

    postWorker(data){
        if (! this.worker) return;
        this.workerSequence++;
        this.worker.postMessage({
            ...data,
            sequence: this.workerSequence
        })
    }


    /**
     *
     */
    startQuery() {
        let center = this.navdata.getAisCenter();
        let timeout = parseInt(globalStore.getData(keys.properties.aisQueryTimeout));
        if (!center) {
            center = this.lastAisCenter;
        } else {
            this.lastAisCenter = center;
        }
        if (!center) {
            window.clearTimeout(this.timer);
            this.timer = window.setTimeout(() => {
                this.startQuery();
            }, timeout);
            return;
        }
        this.postWorker({
            type: 'query',
            center: center,
            distance: globalStore.getData(keys.properties.aisDistance),
            timeout: timeout
        })
        this.timer = window.setTimeout(() => {
            this.startQuery();
        }, timeout);

    }

    /**
     * get an ais target by mmsi, return undefined if not found
     * @param mmsi
     * @returns {*}
     */
    getAisByMmsi(mmsi) {
        if (!mmsi) {
            return globalStore.getData(keys.nav.ais.nearest);
        }
        let currentAis=globalStore.getData(keys.nav.ais.list);
        for (let i in currentAis) {
            if (currentAis[i].mmsi == mmsi) {
                return aisproxy(currentAis[i]);
            }
        }
    }

    /**
     * get the position of an AIS target
     * @param mmsi
     * @returns {*}
     */
    getAisPositionByMmsi(mmsi) {
        let ais = this.getAisByMmsi(mmsi);
        if (!ais) return undefined;
        return new navobjects.Point(parseFloat(ais.lon || 0), parseFloat(ais.lat || 0));
    }

    /**
     * return the mmsi of the tracked target or 0
     * @returns {number}
     */
    getTrackedTarget() {
        return this.trackedAIStarget;
    }

    setHidden(mmsi) {
        this.hiddenTargets[mmsi] = Helper.now();
        this.postWorker({
            type: 'hidden',
            hiddenTargets:this.hiddenTargets
        })
    }

    unsetHidden(mmsi) {
        if (this.hiddenTargets[mmsi] !== undefined) {
            delete this.hiddenTargets[mmsi];
            this.postWorker({
                type: 'hidden',
                hiddenTargets:this.hiddenTargets
            })
        }
    }
    /**
     * set the target to be tracked, 0 to use nearest
     * @param {number} mmsi
     */
    setTrackedTarget(mmsi) {
        if (this.trackedAIStarget == mmsi) return;
        this.trackedAIStarget = mmsi;
        globalStore.storeData(keys.nav.ais.trackedMmsi, mmsi);
        //just retrigger computation once
        this.postWorker({
            type: 'config'
        })
    }
}


export default AisData;