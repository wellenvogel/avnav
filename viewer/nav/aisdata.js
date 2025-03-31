/**
 * Created by andreas on 04.05.14.
 */
import navobjects from './navobjects';
import Formatter from '../util/formatter';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Requests from '../util/requests.js';
import base from '../base.js';
import {aisproxy} from './aisformatter';
import {AisOptionMappings, handleReceivedAisData, AISItem} from "./aiscomputations";


export const fillOptions=()=>{
    let rt={};
    for (let k in AisOptionMappings){
        let mapping=AisOptionMappings[k];
        if (mapping instanceof Object){
            let v=globalStore.getData(mapping.key);
            rt[k]=mapping.f(v);
        }
        else{
            rt[k]=globalStore.getData(mapping);
        }
    }
    return rt;
}

/**
 * the handler for the ais data
 * query the server...
 * @constructor
 */
class AisData {
    constructor(navdata) {

        this.navdata = navdata;

        /** @private
         * @type {Array.<AISItem>}
         * */
        this.currentAis = [];

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


        globalStore.register(this, [keys.nav.gps, keys.nav.routeHandler.useRhumbLine]);

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
    }

    /**
     * compute all the cpa data...
     * @private
     */
    handleAisData() {
        let boatPos = globalStore.getMultiple(keys.nav.gps);
        let trackedTarget = undefined; //ref to tracked target
        let aisWarningAis=undefined; //ref to most important warning
        this.currentAis=handleReceivedAisData(this.receivedAis,
            boatPos.valid?new navobjects.Point(boatPos.lon,boatPos.lat):new navobjects.Point(undefined,undefined),
            parseFloat(boatPos.course||0),
            parseFloat(boatPos.speed||0),
            this.aisOptions);
        let hideTime = parseFloat(globalStore.getData(keys.properties.aisHideTime, 30)) * 1000;
        let now = (new Date()).getTime();
        for (let aisidx in this.currentAis) {
            let ais = this.currentAis[aisidx];
            let accessor=aisproxy(ais);
            if (!ais.shouldHandle) continue;
            let hidden = this.hiddenTargets[ais.received.mmsi];
            if (hidden !== undefined) {
                if (hidden > now || (hidden + hideTime) < now) {
                    delete this.hiddenTargets[accessor.mmsi];
                    hidden = undefined;
                }
            }
            if (hidden !== undefined) ais.hidden = true;
            if (accessor.mmsi == this.trackedAIStarget) {
                ais.tracking = true;
                trackedTarget = accessor;
            }
            if (accessor.nextWarning){
                aisWarningAis=accessor;
            }
        }
        if (trackedTarget === undefined) this.trackedAIStarget = undefined;
        //handling of the nearest target
        //warning active - this one
        //no tracked target set - nearest
        //tracked set - this one
        let nearestAisTarget=undefined;
        if (this.currentAis.length) {
            if (aisWarningAis) nearestAisTarget = aisWarningAis;
            else {
                if (trackedTarget) nearestAisTarget = trackedTarget;
                else nearestAisTarget = aisproxy(this.currentAis[0]);
            }
        } else {
            nearestAisTarget = undefined;
        }
        let storeKeys = {
            nearestAisTarget: keys.nav.ais.nearest,
            currentAis: keys.nav.ais.list,
            updateCount: keys.nav.ais.updateCount
        };
        globalStore.storeMultiple({
            nearestAisTarget: nearestAisTarget,
            currentAis: this.currentAis,
            updateCount: globalStore.getData(keys.nav.ais.updateCount, 0) + 1
        }, storeKeys);

    }

    dataChanged() {
        this.aisOptions=fillOptions();
        this.handleAisData();
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
        let param = {
            request: 'ais',
            distance: this.formatter.formatDecimal(globalStore.getData(keys.properties.aisDistance) || 10, 4, 1)
        };
        for (let idx = 0; idx < center.length; idx++) {
            if (!center[idx]) continue;
            let sfx = idx !== 0 ? idx + "" : "";
            param['lat' + sfx] = this.formatter.formatDecimal(center[idx].lat, 3, 5, false, true);
            param['lon' + sfx] = this.formatter.formatDecimal(center[idx].lon, 3, 5, false, true);
        }
        Requests.getJson(param, {checkOk: false, timeout: timeout}).then(
            (data) => {
                let now=(new Date()).getTime();
                this.aisErrors = 0;
                let aisList = [];
                if (data['class'] && data['class'] == "error") aisList = [];
                else aisList = data;
                aisList.forEach((ais)=>{ais.receiveTime=now;})
                this.receivedAis = aisList;
                try {
                    this.handleAisData();
                } catch (e) {
                    let x = e;
                    throw(e);
                }
                window.clearTimeout(this.timer);
                this.timer = window.setTimeout( ()=> {
                    this.startQuery();
                }, timeout);
            }
        ).catch(
            (error) => {
                base.log("query ais error");
                this.aisErrors += 1;
                if (this.aisErrors >= globalStore.getData(keys.properties.maxAisErrors)) {
                    this.this.receivedAis=[];
                    this.handleAisData();
                }
                window.clearTimeout(this.timer);
                this.timer = window.setTimeout(()=> {
                    this.startQuery();
                }, timeout);
            }
        );
    }

    /**
     * get an ais target by mmsi, return undefined if not found
     * @param mmsi
     * @returns {*}
     */
    getAisByMmsi(mmsi) {
        if (!mmsi) {
            return {...globalStore.getData(keys.nav.ais.nearest)}
        }
        for (let i in this.currentAis) {
            let accessor = aisproxy(this.currentAis[i]);
            if (accessor.mmsi === mmsi) {
                return accessor;
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
        let now = (new Date()).getTime();
        this.hiddenTargets[mmsi] = now;
        this.handleAisData();
    }

    unsetHidden(mmsi) {
        if (this.hiddenTargets[mmsi] !== undefined) {
            delete this.hiddenTargets[mmsi];
            this.handleAisData();
        }
    }

    isHidden(mmsi) {
        let now = (new Date()).getTime();
        let hidden = this.hiddenTargets[mmsi];
        if (hidden === undefined) return false;
        if (hidden > now || (hidden + globalStore.getData(keys.properties.aisHideTime, 30) * 1000) < now) {
            delete this.hiddenTargets[mmsi];
            return false;
        }
        return true;

    }

    /**
     * set the target to be tracked, 0 to use nearest
     * @param {number} mmsi
     */
    setTrackedTarget(mmsi) {
        if (this.trackedAIStarget == mmsi) return;
        this.trackedAIStarget = mmsi;
        globalStore.storeData(keys.nav.ais.trackedMmsi, mmsi);
        this.handleAisData();
    }
}


export default AisData;