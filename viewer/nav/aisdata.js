/**
 * Created by andreas on 04.05.14.
 */
var AisTarget=require('./navobjects').Ais;
var Formatter=require('../util/formatter');
var NavCompute=require('./navcompute');
var navobjects=require('./navobjects');
var NavData=require('./navdata');

/**
 * the handler for the ais data
 * query the server...
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {NavData} navdata
 * @constructor
 */
var AisData=function(propertyHandler,navdata){
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
     * this is a translation between the display names and the aisparam values
     * @type {{aisDst: string, aisSog: string, aisCog: string, aisCpa: string, aisTcpa: string, aisMmsi: string, aisName: string, aisDestination: string, aisFront: string, aisShiptype: string}}
     */
    this.formattedDataDescription={
        aisDst:'distance',
        aisSog:'speed',
        aisCog:'course',
        aisCpa:'cpa',
        aisTcpa:'tcpa',
        aisMmsi:'mmsi',
        aisName:'shipname',
        aisDestination:'destination',
        aisFront:'passFront',
        aisShiptype:'shiptype',
        aisCallsign: 'callsign',
        aisPosition: 'position',
        aisHeading: 'heading'
    };

    this.formattedData={};
    for (var i in this.formattedDataDescription){
        this.formattedData[i]="";
        this.navobject.registerValueProvider(i,this,this.getFormattedAisValue)
    }

    /**
     * the nearest target - being returned when values are queried
     *
     * @type {AisTarget}
     */
    this.nearestAisTarget={};
    var self=this;

    /**
     * the formatter for AIS data
     * @private
     * @type {{distance: {headline: string, format: format}, speed: {headline: string, format: format}, course: {headline: string, format: format}, cpa: {headline: string, format: format}, tcpa: {headline: string, format: format}, passFront: {headline: string, format: format}, shipname: {headline: string, format: format}, callsign: {headline: string, format: format}, mmsi: {headline: string, format: format}, shiptype: {headline: string, format: format}, position: {headline: string, format: format}, destination: {headline: string, format: format}}}
     */
    this.aisparam={
        distance:{
            headline: 'dist(nm)',
            format: function(v){ return self.formatter.formatDecimal(parseFloat(v.distance||0),3,2);}
        },
        heading:{
            headline: 'hdg',
            format: function(v){ return self.formatter.formatDecimal(parseFloat(v.headingTo||0),3,0);}
        },
        speed: {
            headline: 'speed(kn)',
            format: function(v){ return self.formatter.formatDecimal(parseFloat(v.speed||0),3,1);}
        },
        course:	{
            headline: 'course',
            format: function(v){ return self.formatter.formatDecimal(parseFloat(v.course||0),3,0);}
        },
        cpa:{
            headline: 'cpa',
            format: function(v){
                var tval=parseFloat(v.tcpa||0);
                //no cpa if tcpa < 0
                if (tval < 0) return "-----";
                return self.formatter.formatDecimal(parseFloat(v.cpa||0),3,2);}
        },
        tcpa:{
            headline: 'tcpa',
            format: function(v){
                var tval=parseFloat(v.tcpa||0);
                if (tval < 0) return "--:--:--";
                var h=Math.floor(tval/3600);
                var m=Math.floor((tval-h*3600)/60);
                var s=tval-3600*h-60*m;
                return self.formatter.formatDecimal(h,2,0).replace(" ","0")+':'+self.formatter.formatDecimal(m,2,0).replace(" ","0")+':'+self.formatter.formatDecimal(s,2,0).replace(" ","0");
            }
        },
        passFront:{
            headline: 'pass',
            format: function(v){
                if (! v.cpa) return "-";
                if (v.passFront) return "Front";
                return "Back";
            }
        },
        shipname:{
            headline: 'name',
            format: function(v){ return v.shipname;}
        },
        callsign:{
            headline: 'call',
            format: function(v){ return v.callsign;}
        },
        mmsi: {
            headline: 'mmsi',
            format: function(v){ return v.mmsi;}
        },
        shiptype:{
            headline: 'type',
            format: function(v){
                var t=0;
                try{
                    t=parseInt(v.shiptype||0);
                }catch (e){}
                if (t>=20 && t<=29) return "WIG";
                if (t==30) return "Fishing";
                if (t==31 || t==32) return "Towing";
                if (t==33) return "Dredging";
                if (t==34) return "Diving";
                if (t==35) return "Military";
                if (t ==36)return "Sail";
                if (t==37) return "Pleasure";
                if (t>=40 && t<=49) return "HighSp";
                if (t==50) return "Pilot";
                if (t==51) return "SAR";
                if (t==52) return "Tug";
                if (t==53) return "PortT";
                if (t==54) return "AntiPol";
                if (t==55) return "Law";
                if (t==58) return "Medical";
                if (t>=60 && t<=69) return "Passenger";
                if (t>=70 && t<=79) return "Cargo";
                if (t>=80 && t<=89) return "Tanker";
                if (t>=91 && t<=94) return "Hazard";
                return "Other";
            }
        },
        position:{
            headline: 'position',
            format: function(v){return self.formatter.formatLonLats({lon:v.lon,lat:v.lat});}
        },
        destination: {
            headline: 'destination',
            format: function(v){ var d=v.destination; if (d) return d; return "unknown";}
        }

    };

    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=new Formatter();
    this.startQuery();
};

/**
 * compute all the cpa data...
 * @private
 */
AisData.prototype.handleAisData=function() {
    /** @type {navobjects.GpsInfo}*/
    var boatPos = this.navobject.getGpsHandler().getGpsData();
    var properties=this.propertyHandler.getProperties();
    var trackedTarget=null; //ref to tracked target
    var aisWarningAis = null;
    if (boatPos.valid) {
        var foundTrackedTarget = false;
        for (var aisidx in this.currentAis) {
            var ais = this.currentAis[aisidx];
            ais.warning=false;
            ais.tracking=false;
            ais.nearest=false;
            var dst = NavCompute.computeDistance(boatPos, new navobjects.Point(parseFloat(ais.lon||0), parseFloat(ais.lat||0)));
            var cpadata = NavCompute.computeCpa({
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
            if (cpadata.tcpa >=0) {
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
            var warningCpa=properties.aisWarningCpa/this.NM;
            if (ais.cpa && ais.cpa < warningCpa && ais.tcpa && ais.tcpa < properties.aisWarningTpa) {
                if (aisWarningAis) {
                    if (aisWarningAis.tcpa > ais.tcpa) aisWarningAis = ais;
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
 * get the formatter for AIS data
 * @returns {{distance: {headline: string, format: format}, speed: {headline: string, format: format}, course: {headline: string, format: format}, cpa: {headline: string, format: format}, tcpa: {headline: string, format: format}, passFront: {headline: string, format: format}, shipname: {headline: string, format: format}, callsign: {headline: string, format: format}, mmsi: {headline: string, format: format}, shiptype: {headline: string, format: format}, position: {headline: string, format: format}, destination: {headline: string, format: format}}}
 */
AisData.prototype.getAisFormatter=function(){
    return this.aisparam;
};
/**
 *
 * @param dname
 * @returns {string}
 */
AisData.prototype.getFormattedAisValue=function(dname){
    return this.formatAisValue(dname,this.nearestAisTarget);
};

/**
 *
 * @param dname
 * @param aisobject an AIS entry like returned by getAisByMMsi
 * @returns {string}
 */
AisData.prototype.formatAisValue=function(dname,aisobject){
    var key=this.formattedDataDescription[dname];
    if (! key) return "";
    if (aisobject === undefined) return "";
    if (aisobject[key] === undefined) return "";
    if (aisobject === undefined) return "";
    return this.aisparam[key].format(aisobject);
};

/**
 * @private
 */
AisData.prototype.startQuery=function() {
    var url = this.propertyHandler.getProperties().navUrl+"?request=ais";
    var timeout = this.propertyHandler.getProperties().aisQueryTimeout; //in ms
    var center=this.navobject.getAisCenter();
    var self=this;
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
            var aisList=[];
            if (data['class'] && data['class'] == "error") aisList=[];
            else aisList=data;
            self.currentAis=aisList;
            try {
                self.handleAisData();
            }catch (e){
                var x=e;
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
    for (var i in this.currentAis){
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
    var ais=this.getAisByMmsi(mmsi);
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