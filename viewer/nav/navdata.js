/**
 * Created by andreas on 04.05.14.
 */

var Store=require('../util/store');
var TrackData=require('./trackdata');
var GpsData=require('./gpsdata');
var AisData=require('./aisdata');
var RouteData=require('./routedata');
var Formatter=require('../util/formatter');
var NavCompute=require('./navcompute');
var navobjects=require('./navobjects');
var globalStore=require('../util/globalstore.jsx');
var keys=require('../util/keys.jsx');


/**
 *
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @constructor
 */
var NavData=function(propertyHandler){
    this.base_.apply(this,arguments);
    /** @private */
    this.propertyHandler=propertyHandler;

    /**
     * @private
     * @type {Formatter}
     */
    this.formatter=new Formatter();
    /** @type {GpsData}
     * @private
     */
    this.gpsdata=new GpsData(propertyHandler,this);
    this.registerDataProvider(this.gpsdata);
    /**
     * @private
     * @type {TrackData}
     */
    this.trackHandler=new TrackData(propertyHandler,this);
    /**
     * @type {AisData|exports|module.exports}
     */
    this.aisHandler=new AisData(propertyHandler,this);
    this.registerDataProvider(this.aisHandler);
    this.routeHandler=new RouteData(propertyHandler,this);
    /**
     * @private
     * @type {navobjects.Point}
     */
    this.maplatlon=new navobjects.Point(0,0);

    this.aisMode=navobjects.AisCenterMode.NONE;

    /**
     * @private
     * @type {properties.NM}
     */
    this.NM=this.propertyHandler.getProperties().NM;
    /**
     * our computed values
     * @type {{centerCourse: number, centerDistance: number, centerMarkerCourse: number, centerMarkerDistance: number, markerCourse: number, markerDistance: number, markerVmg: number, markerEta: null, markerWp: navobjects.WayPoint, routeName: undefined, routeNumPoints: number, routeLen: number, routeRemain: number, routeEta: null, routeNextCourse: number, routeNextWp: undefined, markerXte: number, edRouteName: undefined, edRouteNumPoints: number, edRouteLen: number, edRouteRemain: number, edRouteEta: number}}
     */
    this.data={
        centerCourse:0,
        centerDistance:0,
        centerMarkerCourse:0,
        centerMarkerDistance:0,
        markerCourse:0,
        markerDistance:0,
        markerVmg:0,
        markerEta:null,
        markerXte: 0,
        markerWp:new navobjects.WayPoint(0,0,"Marker"),
        /* data for the active route */
        routeName: undefined,
        routeNumPoints: 0,
        routeLen: 0,
        routeRemain: 0,
        routeEta: null,
        routeNextCourse: 0,
        routeNextWp: undefined,
        /* data for the route we are editing */
        edRouteName: undefined,
        edRouteNumPoints: 0,
        edRouteLen: 0,
        /* the next 2 will only be filled when the editing route is the current */
        edRouteRemain: 0,
        edRouteEta:0,
        anchorWatchDistance: undefined,
        anchorDistance: 0,
        anchorDirection: 0
    };
    this.formattedValues={
        markerEta:"--:--:--",
        markerCourse:"--",
        markerDistance:"--",
        markerPosition:"none",
        markerVmg: "--",
        markerXte: "---",
        markerName: "--",
        centerCourse:"--",
        centerDistance:"--",
        centerMarkerCourse:"--",
        centerMarkerDistance:"--",
        centerPosition:"--",
        routeName: "default",
        routeNumPoints: "--",
        routeLen: "--",
        routeRemain: "--",
        routeEta: "--:--:--",
        routeNextCourse: "---",
        routeNextPosition: "---",
        routeNextName: "---",
        isApproaching: false,
        isEditingActiveRoute: false,
        edRouteName: "default",
        edRouteNumPoints: "--",
        edRouteLen: "--",
        edRouteRemain: "--",
        edRouteEta: "--:--:--",
        statusImageUrl: this.propertyHandler.getProperties().statusUnknownImage,
        anchorWatchDistance:"---",
        anchorDistance: "---",
        anchorDirection: "---"
    };
    this.storeKeys=[];
    for (let k in this.formattedValues){
        this.storeKeys.push(k);
    }
};

avnav.inherits(NavData,Store);

/**
 * compute the raw and formtted valued
 * @private
 */
NavData.prototype.computeValues=function(){
    var gps=this.gpsdata.getGpsData();
    //copy the marker to data to make it available extern
    this.data.markerWp=this.routeHandler.getCurrentLegTarget();
    this.data.routeNextWp=this.routeHandler.getCurrentLegNextWp();
    var rstart=this.routeHandler.getCurrentLeg().from;
    if (gps.valid){
        if (this.routeHandler.getLock()) {
            var legData=NavCompute.computeLegInfo(this.data.markerWp,gps,rstart);
            avnav.assign(this.data,legData);
        }
        else {
            this.data.markerCourse=undefined;
            this.data.markerDistance=undefined;
            this.data.markerEta=undefined;
            this.data.markerXte=undefined;
        }
        var centerdst=NavCompute.computeDistance(gps,this.maplatlon);
        this.data.centerCourse=centerdst.course;
        this.data.centerDistance=centerdst.dtsnm;
        if (this.routeHandler.getAnchorWatch()){
            let anchor=this.routeHandler.getCurrentLegStartWp();
            this.data.anchorWatchDistance = this.routeHandler.getAnchorWatch();
            if (anchor) {
                let aleginfo=NavCompute.computeLegInfo(anchor,gps);
                this.data.anchorDistance=aleginfo.markerDistance*this.NM;
                this.data.anchorDirection=aleginfo.markerCourse;
            }
            else{
                this.data.anchorDistance=0;
                this.data.anchorDirection=0;
            }
        }
    }
    else{
        this.data.centerCourse=0;
        this.data.centerDistance=0;
        this.data.markerCourse=0;
        this.data.markerDistance=0;
        this.data.markerEta=null;
        this.data.markerXte=undefined;
        this.data.anchorDistance=0;
        this.data.anchorDirection=0;
        this.data.anchorWatchDistance=undefined;
    }

    //distance between marker and center
    if (this.data.markerWp) {
        var mcdst = NavCompute.computeDistance(this.data.markerWp, this.maplatlon);
        this.data.centerMarkerCourse = mcdst.course;
        this.data.centerMarkerDistance = mcdst.dtsnm;
    }
    else{
        this.data.centerMarkerCourse=undefined;
        this.data.centerMarkerDistance=undefined;
    }
    //route data
    var curRoute=this.routeHandler.getCurrentLeg().currentRoute;
    this.data.isApproaching=this.routeHandler.getApproaching();
    if (this.routeHandler.hasActiveRoute()) {
        this.data.routeName = curRoute.name;
        this.data.routeNumPoints = curRoute.points.length;
        this.data.routeLen = this.routeHandler.computeLength(0,curRoute);
        if (this.routeHandler.getLock()) {
            this.data.routeRemain = this.routeHandler.computeLength(-1,curRoute) + this.data.markerDistance;
            var routetime = gps.rtime ? gps.rtime.getTime() : 0;
            if (this.data.markerVmg && this.data.markerVmg > 0) {
                routetime += this.data.routeRemain / this.data.markerVmg * 3600 * 1000; //time in ms
                var routeDate = new Date(Math.round(routetime));
                this.data.routeEta = routeDate;
            }
            else {
                this.data.routeEta = undefined;
            }
            this.data.routeNextCourse = undefined;
            if ( gps.valid) {
                if (this.data.routeNextWp) {
                    var dst = NavCompute.computeDistance(gps, this.data.routeNextWp);
                    this.data.routeNextCourse = dst.course;
                }
            }
        }
        else {
            this.data.routeRemain=0;
            this.data.routeEta=undefined;
            this.data.routeNextCourse=undefined;
        }
    }
    else {
        this.data.routeName=undefined;
        this.data.routeNumPoints=0;
        this.data.routeLen=0;
        this.data.routeRemain=0;
        this.data.routeEta=undefined;
        this.data.routeNextCourse=undefined;
    }
    if (this.routeHandler.isEditingActiveRoute()){
        this.data.edRouteName=this.data.routeName;
        this.data.edRouteNumPoints=this.data.routeNumPoints;
        this.data.edRouteLen=this.data.routeLen;
        this.data.edRouteRemain=this.data.routeRemain;
        this.data.edRouteEta=this.data.routeEta;
        this.data.editingActiveRoute=true;
    }
    else {
        var edRoute=this.routeHandler.getRoute();
        this.data.editingActiveRoute=false;
        this.data.edRouteRemain=0;
        this.data.edRouteEta=undefined;
        this.data.edRouteName=edRoute?edRoute.name:undefined;
        this.data.edRouteNumPoints=edRoute?edRoute.points.length:0;
        this.data.edRouteLen=edRoute?this.routeHandler.computeLength(0,edRoute):0;
    }

    globalStore.updateValuesObject(this.data,{
        centerCourse: keys.nav.center.course,
        centerDistance: keys.nav.center.distance,
        markerCourse: keys.nav.wp.course,
        markerDistance: keys.nav.wp.distance,
        markerEta: keys.nav.wp.eta,
        markerXte: keys.nav.wp.xte,
        markerVmg: keys.nav.wp.vmg,
        markerWp: keys.nav.wp.position,
        anchorDirection: keys.nav.anchor.direction,
        anchorDistance: keys.nav.anchor.distance,
        anchorWatchDistance: keys.nav.anchor.watchDistance,
        centerMarkerCourse: keys.nav.center.markerCourse,
        centerMarkerDistance: keys.nav.center.markerDistance,
        routeName: keys.nav.route.name,
        routeNumPoints: keys.nav.route.numPoints,
        routeLen: keys.nav.route.len,
        routeRemain: keys.nav.route.remain,
        routeEta: keys.nav.route.eta,
        routeNextCourse: keys.nav.route.nextCourse,
        isApproaching: keys.nav.route.isApproaching,
        edRouteName: keys.nav.editRoute.name,
        edRouteNumPoints: keys.nav.editRoute.numPoints,
        edRouteLen: keys.nav.editRoute.len,
        edRouteEta: keys.nav.editRoute.eta,
        editingActiveRoute: keys.nav.editRoute.isActive
    });
    globalStore.storeData(keys.nav.wp.name,this.data.markerWp?this.data.markerWp.name:'');
    //now create text values
    var legDataFormatted=this.formatLegData(this.data);
    avnav.assign(this.formattedValues,legDataFormatted);

    this.formattedValues.markerName=this.data.markerWp?this.data.markerWp.name||"Marker":"Marker";
    this.formattedValues.centerCourse=this.formatter.formatDecimal(
        this.data.centerCourse,3,0
    );
    this.formattedValues.centerDistance=this.formatter.formatDecimal(
        this.data.centerDistance,3,1
    );
    this.formattedValues.centerMarkerCourse=this.formatter.formatDecimal(
        this.data.centerMarkerCourse,3,0
    );
    this.formattedValues.centerMarkerDistance=this.formatter.formatDecimal(
        this.data.centerMarkerDistance,3,1
    );
    this.formattedValues.centerPosition=this.formatter.formatLonLats(
        this.maplatlon
    );
    this.formattedValues.routeName=this.data.routeName;
    this.formattedValues.routeNumPoints=this.formatter.formatDecimal(this.data.routeNumPoints,4,0);
    this.formattedValues.routeLen=this.formatter.formatDecimal(this.data.routeLen,4,1);
    this.formattedValues.routeRemain=this.formatter.formatDecimal(this.data.routeRemain,4,1);
    this.formattedValues.routeEta=this.data.routeEta?this.formatter.formatTime(this.data.routeEta):"--:--:--";
    this.formattedValues.routeNextCourse=(this.data.routeNextCourse !== undefined)?this.formatter.formatDecimal(this.data.routeNextCourse,3,0):"---";
    this.formattedValues.routeNextName=this.data.routeNextWp?this.data.routeNextWp.name:"";
    this.formattedValues.isApproaching=this.data.isApproaching||false;
    this.formattedValues.isEditingActiveRoute=this.data.editingActiveRoute;
    this.formattedValues.edRouteName=this.data.edRouteName;
    this.formattedValues.edRouteNumPoints=this.formatter.formatDecimal(this.data.edRouteNumPoints,4,0);
    this.formattedValues.edRouteLen=this.formatter.formatDecimal(this.data.edRouteLen,4,1);
    this.formattedValues.edRouteRemain=this.formatter.formatDecimal(this.data.edRouteRemain,4,1);
    this.formattedValues.edRouteEta=this.data.edRouteEta?this.formatter.formatTime(this.data.edRouteEta):"--:--:--";
    this.formattedValues.statusImageUrl=gps.valid?this.propertyHandler.getProperties().statusOkImage:this.propertyHandler.getProperties().statusErrorImage;
    this.formattedValues.anchorWatchDistance=this.data.anchorWatchDistance!==undefined?this.formatter.formatDecimal(this.data.anchorWatchDistance,8,0):"";
    this.formattedValues.anchorDistance=this.data.anchorWatchDistance!==undefined?this.formatter.formatDecimal(this.data.anchorDistance,8,0):"";
    this.formattedValues.anchorDirection=this.data.anchorWatchDistance!==undefined?this.formatter.formatDecimal(this.data.anchorDirection,3,0):"";
};

NavData.prototype.formatLegData=function(legInfo){
    var rt={};
    if (! legInfo) return rt;
    rt.markerEta=(legInfo.markerEta)?
        this.formatter.formatTime(legInfo.markerEta):"--:--:--";
    rt.markerCourse=(legInfo.markerCourse !== undefined)?this.formatter.formatDecimal(
        legInfo.markerCourse,3,0):'---';
    rt.markerDistance=(legInfo.markerDistance !== undefined)?this.formatter.formatDecimal(
        legInfo.markerDistance,3,1):'----';
    rt.markerVmg=this.formatter.formatDecimal(
        legInfo.markerVmg,3,1);
    rt.markerPosition=this.formatter.formatLonLats(
        legInfo.markerWp
    );
    rt.markerXte=(legInfo.markerXte !== undefined)?this.formatter.formatDecimal(legInfo.markerXte,2,2):"---";
    return rt;
};

/**
 * get the current map center (lon/lat)
 * @returns {navobjects.Point}
 */
NavData.prototype.getMapCenter=function(){
    return this.maplatlon;
};

/**
 * get the center for AIS queries
 * @returns {navobjects.Point|NavData.maplatlon|*}
 */
NavData.prototype.getAisCenter=function(){
    if (this.aisMode == navobjects.AisCenterMode.NONE) return undefined;
    if (this.aisMode == navobjects.AisCenterMode.GPS) {
        var data=this.gpsdata.getGpsData();
        if (data.valid) return data;
        return undefined;
    }
    return this.maplatlon;
};

/**
 * set the mode for the AIS query
 * @param {navobjects.AisCenterMode} mode
 */
NavData.prototype.setAisCenterMode=function(mode){
    this.aisMode=mode;
};
/**
 * @private
 * @param name
 * @returns {*}
 */
NavData.prototype.getFormattedNavValue=function(name){
    return this.formattedValues[name];
};
/**
 * return the values that have been computed from others
 * @returns {{centerCourse: number, centerDistance: number, centerMarkerCourse: number, centerMarkerDistance: number, markerCourse: number, markerDistance: number, markerVmg: number, markerEta: null, markerWp: navobjects.WayPoint, routeName: undefined, routeNumPoints: number, routeLen: number, routeRemain: number, routeEta: null, routeNextCourse: number, routeNextWp: undefined, markerXte: number, edRouteName: undefined, edRouteNumPoints: number, edRouteLen: number, edRouteRemain: number, edRouteEta: number}}
 */
NavData.prototype.getComputedValues=function(){
    return this.data;
};

NavData.prototype.getDataLocal=function(key,opt_default){
    var rt=this.getFormattedNavValue(key);
    if (rt === undefined) return opt_default;
    return rt;
};


/**
 * get a list of known display names
 */
NavData.prototype.getValueNames=function(){
    return this.storeKeys;
};

/**
 * called back from gpshandler
 */
NavData.prototype.gpsEvent=function(){
    this.computeValues();
    this.callCallbacks(this.getValueNames());
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.GPS,
        this.getValueNames(),
        navobjects.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from trackhandler
 */
NavData.prototype.trackEvent=function(){
    this.callCallbacks(this.getValueNames());
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.TRACK,
        [],
        navobjects.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from aishandler
 */
NavData.prototype.aisEvent=function(){
    this.callCallbacks(this.getValueNames());
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.AIS,
        [],
        navobjects.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from routeHandler
 */
NavData.prototype.routeEvent=function(){
    this.computeValues();
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,new navobjects.NavEvent (
        navobjects.NavEventType.ROUTE,
        [],
        navobjects.NavEventSource.NAV,
        this
    ));
    this.triggerUpdateEvent(navobjects.NavEventSource.NAV);
};


/**
 * set the current map center position
 * @param {Array.<number>} lonlat
 */
NavData.prototype.setMapCenter=function(lonlat){
    var p=new navobjects.Point();
    p.fromCoord(lonlat);
    if (p.compare(this.maplatlon)) return;
    p.assign(this.maplatlon);
    this.computeValues();
    this.triggerUpdateEvent(navobjects.NavEventSource.MAP);
};

/**
 * get the routing handler
 * @returns {RouteData|*}
 */
NavData.prototype.getRoutingHandler=function(){
    return this.routeHandler;
};

/**
 * get the gps data handler
 * @returns {GpsData}
 */
NavData.prototype.getGpsHandler=function(){
    return this.gpsdata;
};
/**
 * get the track handler
 * @returns {TrackData}
 */
NavData.prototype.getTrackHandler=function(){
    return this.trackHandler;
};
/**
 * get the AIS data handler
 * @returns {AisData|*}
 */
NavData.prototype.getAisHandler=function(){
    return this.aisHandler;
};

NavData.prototype.resetTrack=function(){
    return this.trackHandler.resetTrack();
};

/**
 * send out an update event
 * @param {navobjects.NavEventSource} source
 */
NavData.prototype.triggerUpdateEvent=function(source){
    this.callCallbacks(this.getValueNames());
    $(document).trigger(navobjects.NavEvent.EVENT_TYPE,
        new navobjects.NavEvent(navobjects.NavEventType.GPS,this.getValueNames(),source,this)
    );
};

NavData.prototype.getCurrentPosition=function(){
    var gps=this.getGpsHandler().getGpsData();
    if (! gps.valid) return;
    return new navobjects.Point(gps.lon,gps.lat);
};

module.exports=NavData;




