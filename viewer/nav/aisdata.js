/**
 * Created by andreas on 04.05.14.
 */
let AisTarget=require('./navobjects').Ais;
let Formatter=require('../util/formatter');
let NavCompute=require('./navcompute');
let navobjects=require('./navobjects');
let NavData=require('./navdata');
let Base=require('../base');
let globalStore=require('../util/globalstore.jsx');
let keys=require('../util/keys.jsx');
/**
 * the handler for the ais data
 * query the server...
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {NavData} navdata
 * @constructor
 */
let AisData=function(propertyHandler,navdata, opt_noQuery){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navdata;
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
     * @private
     * @type {properties.NM}
     */
    this.NM=this.propertyHandler.getProperties().NM;


    /**
     * the nearest target - being returned when values are queried
     *
     * @type {AisTarget}
     */
    this.nearestAisTarget={};



    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=new Formatter();
    if (! opt_noQuery) this.startQuery();
};
/**
 *
 * @param boatPos boat pos, course, speed
 * @param ais the ais target, will be modified
 * @param properties - the current properties
 * @private
 */
AisData.prototype._computeAisTarget=function(boatPos,ais,properties){
    ais.warning=false;
    ais.tracking=false;
    ais.nearest=false;
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
        properties
    );
    ais.distance = dst.dtsnm;
    ais.headingTo = dst.course;
    if (cpadata.tcpa !== undefined && cpadata.cpanm !== undefined) {
        ais.cpa = cpadata.cpanm;
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
    /** @type {navobjects.GpsInfo}*/
    let boatPos = this.navobject.getGpsHandler().getGpsData();
    let properties=this.propertyHandler.getProperties();
    let trackedTarget=null; //ref to tracked target
    let aisWarningAis = null;
    if (boatPos.valid) {
        let foundTrackedTarget = false;
        for (let aisidx in this.currentAis) {
            let ais = this.currentAis[aisidx];
            this._computeAisTarget(boatPos,ais,properties);
            let warningCpa=properties.aisWarningCpa/this.NM;
            if (ais.cpa && ais.cpa < warningCpa && ais.tcpa && Math.abs(ais.tcpa) < properties.aisWarningTpa) {
                if (aisWarningAis) {
                    if (ais.tcpa >=0) {
                        if (aisWarningAis.tcpa > ais.tcpa || aisWarningAis.tcpa < 0) aisWarningAis = ais;
                    }
                    else{
                        if (aisWarningAis.tcpa < 0 && aisWarningAis.tcpa < ais.tcpa) aisWarningAis=ais;
                    }
                }
                else aisWarningAis = ais;
            }
            if (ais.mmsi == this.trackedAIStarget) {
                foundTrackedTarget = true;
                ais.tracking=true;
                trackedTarget=ais;
            }
        }
        if (!foundTrackedTarget) this.trackedAIStarget = null;
    }
    if (this.currentAis) {
        this.currentAis.sort(this.aisSort);
        if (this.currentAis.length) {
            this.currentAis[0].nearest = true;
        }
    }
    if (aisWarningAis) {
        aisWarningAis.warning=true;
    }
    //handling of the nearest target
    //warning active - this one
    //no tracked target set - nearest
    //tracked set - this one
    if (this.currentAis.length) {
        if (aisWarningAis) this.nearestAisTarget = aisWarningAis;
        else {
            if (trackedTarget) this.nearestAisTarget = trackedTarget;
            else this.nearestAisTarget = this.currentAis[0];
        }
    }
    else {
        this.nearestAisTarget={};
    }
    globalStore.storeData(keys.nav.ais.nearest,this.nearestAisTarget);
    globalStore.storeData(keys.nav.ais.list);
    globalStore.storeData(keys.nav.ais.updateCount,globalStore.getData(keys.nav.ais.updateCount,0)+1)
    this.navobject.aisEvent();
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
    let url = this.propertyHandler.getProperties().navUrl+"?request=ais";
    let timeout = this.propertyHandler.getProperties().aisQueryTimeout; //in ms
    let center=this.navobject.getAisCenter();
    let self=this;
    if (! center){
        window.clearTimeout(this.timer);
        this.timer=window.setTimeout(function(){
            self.startQuery();
        },timeout);
        return;
    }
    url+="&lon="+this.formatter.formatDecimal(center.lon,3,5);
    url+="&lat="+this.formatter.formatDecimal(center.lat,3,5);
    url+="&distance="+this.formatter.formatDecimal(this.propertyHandler.getProperties().aisDistance||10,4,1);
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
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
        },
        error: function(status,data,error){
            avnav.log("query ais error");
            self.aisErrors+=1;
            if (self.aisErrors >= self.propertyHandler.getProperties().maxAisErrors){
                self.currentAis=[];
                self.handleAisData();
            }
            window.clearTimeout(self.timer);
            self.timer=window.setTimeout(function(){self.startQuery();},timeout);
        },
        timeout: timeout
    });
};


/**
 * return the current aisData
 * @returns {Array.<AisTarget>}
 */
AisData.prototype.getAisData=function(){
    return this.currentAis;
};

/**
 * get an ais target by mmsi, return undefined if not found
 * @param mmsi
 * @returns {*}
 */
AisData.prototype.getAisByMmsi=function(mmsi){
    if (mmsi == 0 || mmsi == null){
        return this.nearestAisTarget;
    }
    for (let i in this.currentAis){
        if (this.currentAis[i].mmsi == mmsi) return this.currentAis[i];
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
 * get the raw data for the currently tracked target
 * @returns {AisTarget}
 */
AisData.prototype.getNearestAisTarget=function(){
    return this.nearestAisTarget;
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
    this.handleAisData();
};

module.exports=AisData;