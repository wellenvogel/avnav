/**
 * Created by andreas on 04.05.14.
 */
import NavData from './navdata';
import navobjects from './navobjects';
import Formatter from '../util/formatter';
import NavCompute from './navcompute';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import Requests from '../util/requests.js';
import base from '../base.js';
import assign from "object-assign";
import aisformatter from './aisformatter';


const AisTarget=navobjects.Ais;
/**
 * the handler for the ais data
 * query the server...
 * @constructor
 */
let AisData=function( opt_noQuery){


    /** @private
     * @type {Array.<AisTarget>}
     * */
    this.currentAis=[];

    /**
     * the last successfull query
     * @type {number}
     */
    this.lastAisQuery=new Date().getTime();
    /**
     * @private
     * @type {null}
     */
    this.timer=null;
    /**
     * @private
     * @type {number}
     */
    this.aisErrors=0;
    /**
     * the mmsi of the tracked target
     * @type {number}
     */
    this.trackedAIStarget=null;

    /**
     * the mmsi of the computed nearest target
     * @type {null}
     */
    this.computedNearestMmsi=null;
    /**
     * the mmsi we have computed for a warning
     * @type {null}
     */
    this.computedWarningMmsi=null;


    /**
     * the nearest target - being returned when values are queried
     *
     * @type {AisTarget}
     */
    this.nearestAisTarget={};

    globalStore.register(this,keys.nav.gps);

    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=Formatter;
    if (! opt_noQuery) this.startQuery();
};
/**
 *
 * @param boatPos boat pos, course, speed
 * @param ais the ais target, will be modified
 * @private
 */
AisData.prototype._computeAisTarget=function(boatPos,ais){
    ais.warning=false;
    ais.tracking=false;
    ais.nearest=false;
    let computeProperties=globalStore.getMultiple({
        minAISspeed: keys.properties.minAISspeed
    });
    let dst = NavCompute.computeDistance(boatPos, new navobjects.Point(parseFloat(ais.lon||0), parseFloat(ais.lat||0)));
    let cpadata = NavCompute.computeCpa({
            lon: boatPos.lon,
            lat: boatPos.lat,
            course: boatPos.course || 0,
            speed: boatPos.speed || 0
        },
        {
            lon: parseFloat(ais.lon || 0),
            lat: parseFloat(ais.lat || 0),
            course: parseFloat(ais.course || 0),
            speed: parseFloat(ais.speed || 0)
        },
        computeProperties
    );
    ais.distance = dst.dts;
    ais.headingTo = dst.course;
    if (cpadata.tcpa !== undefined && cpadata.cpa !== undefined) {
        ais.cpa = cpadata.cpa;
        ais.tcpa = cpadata.tcpa;
    }
    else {
        ais.cpa = 0;
        ais.tcpa = 0;
    }
    ais.passFront = cpadata.front;
    if (!ais.shipname) ais.shipname = "unknown";
    if (!ais.callsign) ais.callsign = "????";
};
/**
 * compute all the cpa data...
 * @private
 */
AisData.prototype.handleAisData=function() {
    let boatPos = globalStore.getMultiple(keys.nav.gps);
    let trackedTarget=null; //ref to tracked target
    let aisWarningAis = null;
    let aisTargets=[];
    let onlyMoving=globalStore.getData(keys.properties.aisOnlyShowMoving,false);
    let onlyAB=globalStore.getData(keys.properties.aisShowOnlyAB,true);
    let aisMinSpeed = parseFloat(globalStore.getData(keys.properties.aisMinDisplaySpeed, 0));
    let foundTrackedTarget = false;
    for (let aisidx in this.currentAis) {
        let ais =this.currentAis[aisidx];
        let shouldHandle = !onlyMoving || (parseFloat(ais.speed) >= aisMinSpeed);
        if (shouldHandle && onlyAB){
            let clazz=aisformatter.format('clazz',ais);
            if (clazz !== "A" && clazz !== "B"){
                shouldHandle=false;
            }
        }
        if (!shouldHandle) continue;
        aisTargets.push(ais);
        if (boatPos.valid) {
            this._computeAisTarget(boatPos, ais);
            let warningCpa = globalStore.getData(keys.properties.aisWarningCpa);
            if (ais.cpa && ais.cpa < warningCpa && ais.tcpa && Math.abs(ais.tcpa) < globalStore.getData(keys.properties.aisWarningTpa)) {
                if (aisWarningAis) {
                    if (ais.tcpa >= 0) {
                        if (aisWarningAis.tcpa > ais.tcpa || aisWarningAis.tcpa < 0) aisWarningAis = ais;
                    } else {
                        if (aisWarningAis.tcpa < 0 && aisWarningAis.tcpa < ais.tcpa) aisWarningAis = ais;
                    }
                } else aisWarningAis = ais;
            }
        }
        if (ais.mmsi == this.trackedAIStarget) {
            foundTrackedTarget = true;
            ais.tracking = true;
            trackedTarget = ais;
        }
    }
    if (!foundTrackedTarget) this.trackedAIStarget = null;
    if (aisTargets) {
        aisTargets.sort(this.aisSort);
        if (aisTargets.length) {
            aisTargets[0].nearest = true;
            this.computedNearestMmsi=aisTargets[0].mmsi;
        }
    }
    if (aisWarningAis) {
        aisWarningAis.warning = true;
        this.computedWarningMmsi=aisWarningAis.mmsi;
    }
    else{
        this.computedWarningMmsi=null;
    }
    //handling of the nearest target
    //warning active - this one
    //no tracked target set - nearest
    //tracked set - this one
    if (aisTargets.length) {
        if (aisWarningAis) this.nearestAisTarget = aisWarningAis;
        else {
            if (trackedTarget) this.nearestAisTarget = trackedTarget;
            else this.nearestAisTarget = aisTargets[0];
        }
    } else {
        this.nearestAisTarget = {};
        this.computedWarningMmsi=null;
        this.computedNearestMmsi=null;
    }
    let storeKeys = {
        nearestAisTarget: keys.nav.ais.nearest,
        currentAis: keys.nav.ais.list,
        updateCount: keys.nav.ais.updateCount
    };
    globalStore.storeMultiple({
        nearestAisTarget: this.nearestAisTarget,
        currentAis: aisTargets,
        updateCount: globalStore.getData(keys.nav.ais.updateCount, 0) + 1
    }, storeKeys);

};

AisData.prototype.dataChanged=function(){
    this.handleAisData();
};
/**
 * sorter for the AIS data - sort by distance
 * @param a
 * @param b
 * @returns {number}
 */
AisData.prototype.aisSort=function(a,b) {
    try {
        if (a.distance == b.distance) return 0;
        if (a.distance < b.distance) return -1;
        return 1;
    } catch (err) {
        return 0;
    }
};

/**
 * @private
 */
AisData.prototype.startQuery=function() {
    let url = "?request=ais";
    let center=NavData.getAisCenter();
    let self=this;
    let timeout=parseInt(globalStore.getData(keys.properties.aisQueryTimeout));
    if (! center){
        window.clearTimeout(this.timer);
        this.timer=window.setTimeout(function(){
            self.startQuery();
        },timeout);
        return;
    }
    url+="&lon="+this.formatter.formatDecimal(center.lon,3,5);
    url+="&lat="+this.formatter.formatDecimal(center.lat,3,5);
    url+="&distance="+this.formatter.formatDecimal(globalStore.getData(keys.properties.aisDistance)||10,4,1);
    Requests.getJson(url,{checkOk:false,timeout:timeout}).then(
        (data)=>{
            self.aisErrors=0;
            self.lastAisQuery=new Date().getTime();
            let aisList=[];
            if (data['class'] && data['class'] == "error") aisList=[];
            else aisList=data;
            self.currentAis=aisList;
            try {
                self.handleAisData();
            }catch (e){
                let x=e;
            }
            window.clearTimeout(self.timer);
            self.timer=window.setTimeout(function(){self.startQuery();},timeout);
        }
    ).catch(
        (error)=>{
            base.log("query ais error");
            self.aisErrors+=1;
            if (self.aisErrors >= globalStore.getData(keys.properties.maxAisErrors)){
                self.currentAis=[];
                self.handleAisData();
            }
            window.clearTimeout(self.timer);
            self.timer=window.setTimeout(function(){self.startQuery();},timeout);
        }
    );
};



/**
 * get an ais target by mmsi, return undefined if not found
 * @param mmsi
 * @returns {*}
 */
AisData.prototype.getAisByMmsi=function(mmsi){
    let rt=undefined;
    if (mmsi == 0 || mmsi == null){
        rt=assign({},this.nearestAisTarget);
    }
    if (! rt) {
        for (let i in this.currentAis) {
            if (this.currentAis[i].mmsi === mmsi) {
                rt = assign({}, this.currentAis[i]);
            }
        }
    }
    if (rt){
        if (this.computedNearestMmsi === rt.mmsi) rt.nearest = true;
        if (this.computedWarningMmsi === rt.mmsi) rt.warning = true;
        return rt;
    }
    return undefined;
};
/**
 * get the position of an AIS target
 * @param mmsi
 * @returns {*}
 */
AisData.prototype.getAisPositionByMmsi=function(mmsi){
    let ais=this.getAisByMmsi(mmsi);
    if (! ais) return undefined;
    return new navobjects.Point(parseFloat(ais.lon||0),parseFloat(ais.lat||0));
};



/**
 * return the mmsi of the tracked target or 0
 * @returns {number}
 */
AisData.prototype.getTrackedTarget=function(){
    return this.trackedAIStarget;
};
/**
 * set the target to be tracked, 0 to use nearest
 * @param {number} mmsi
 */
AisData.prototype.setTrackedTarget=function(mmsi){
    if (this.trackedAIStarget == mmsi) return;
    this.trackedAIStarget=mmsi;
    globalStore.storeData(keys.nav.ais.trackedMmsi,mmsi);
    this.handleAisData();
};

export default new AisData();