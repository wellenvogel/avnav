/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.NavObject');
avnav.provide('avnav.nav.NavEvent');
avnav.provide('avnav.nav.NavEventSource');

var Store=require('../util/store');

/**
 * the navevent type
 * @enum {number}
 */
avnav.nav.NavEventType={
    GPS:0,
    AIS:1,
    TRACK:2,
    NAV:3,
    ROUTE: 4
};

/**
 * a definition of the source that caused an event
 * to avoid endless loops
 * @enum {number}
 */
avnav.nav.NavEventSource={
    NAV:0,
    GUI:1,
    MAP:2
};

/**
 * the center mode for ais
 * @type {{NONE: number, GPS: number, MAP: number}}
 */
avnav.nav.AisCenterMode={
    NONE:0,
    GPS:1,
    MAP:2
};

/**
 *
 * @param {avnav.nav.NavEventType} type
 * @param {Array.<string>} changedNames the display names that have changed data
 * @param {avnav.nav.NavEventSource} source
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.nav.NavEvent=function(type,changedNames,source,navobject){
    /**
     * @type {avnav.nav.NavEventType}
     */
    this.type=type;
    /**
     * the list of changed display elements
     * @type {Array.<string>}
     */
    this.changedNames=changedNames;
    /**
     * @type {avnav.nav.NavEventSource}
     */
    this.source=source;
    /**
     * @type {avnav.nav.NavObject}
     */
    this.navobject=navobject;
};

avnav.nav.NavEvent.EVENT_TYPE="navevent";

/**
 *
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @constructor
 */
avnav.nav.NavObject=function(propertyHandler){
    this.base_.apply(this,arguments);
    /** @private */
    this.propertyHandler=propertyHandler;

    /**
     * @private
     * @type {avnav.util.Formatter}
     */
    this.formatter=new avnav.util.Formatter();
    /**
     * a map from the display names to the function that provides the data
     * @type {{}}
     * @private
     */
    this.valueMap={};
    /** @type {avnav.nav.GpsData}
     * @private
     */
    this.gpsdata=new avnav.nav.GpsData(propertyHandler,this);
    /**
     * @private
     * @type {avnav.nav.TrackData}
     */
    this.trackHandler=new avnav.nav.TrackData(propertyHandler,this);

    this.aisHandler=new avnav.nav.AisData(propertyHandler,this);
    this.routeHandler=new avnav.nav.RouteData(propertyHandler,this);
    /**
     * @private
     * @type {avnav.nav.navdata.Point}
     */
    this.maplatlon=new avnav.nav.navdata.Point(0,0);

    this.aisMode=avnav.nav.AisCenterMode.NONE;


    /**
     * our computed values
     * @type {{centerCourse: number, centerDistance: number, centerMarkerCourse: number, centerMarkerDistance: number, markerCourse: number, markerDistance: number, markerVmg: number, markerEta: null, markerWp: avnav.nav.navdata.WayPoint, routeName: undefined, routeNumPoints: number, routeLen: number, routeRemain: number, routeEta: null, routeNextCourse: number, routeNextWp: undefined, markerXte: number, edRouteName: undefined, edRouteNumPoints: number, edRouteLen: number, edRouteRemain: number, edRouteEta: number}}
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
        markerWp:new avnav.nav.navdata.WayPoint(0,0,"Marker"),
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
        edRouteEta:0
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
        edRouteName: "default",
        edRouteNumPoints: "--",
        edRouteLen: "--",
        edRouteRemain: "--",
        edRouteEta: "--:--:--"
    };
    for (var k in this.formattedValues){
        this.registerValueProvider(k,this,this.getFormattedNavValue);
    }
};

avnav.inherits(avnav.nav.NavObject,Store);

/**
 * compute the raw and formtted valued
 * @private
 */
avnav.nav.NavObject.prototype.computeValues=function(){
    var gps=this.gpsdata.getGpsData();
    //copy the marker to data to make it available extern
    this.data.markerWp=this.routeHandler.getCurrentLegTarget();
    this.data.routeNextWp=this.routeHandler.getCurrentLegNextWp();
    var rstart=this.routeHandler.getCurrentLeg().from;
    if (gps.valid){
        if (this.routeHandler.getLock()) {
            var legData=avnav.nav.NavCompute.computeLegInfo(this.data.markerWp,gps,rstart);
            avnav.assign(this.data,legData);
        }
        else {
            this.data.markerCourse=undefined;
            this.data.markerDistance=undefined;
            this.data.markerEta=undefined;
            this.data.markerXte=undefined;
        }
        var centerdst=avnav.nav.NavCompute.computeDistance(gps,this.maplatlon);
        this.data.centerCourse=centerdst.course;
        this.data.centerDistance=centerdst.dtsnm;
    }
    else{
        this.data.centerCourse=0;
        this.data.centerDistance=0;
        this.data.markerCourse=0;
        this.data.markerDistance=0;
        this.data.markerEta=null;
        this.data.markerXte=undefined;
    }

    //distance between marker and center
    var mcdst=avnav.nav.NavCompute.computeDistance(this.data.markerWp,this.maplatlon);
    this.data.centerMarkerCourse=mcdst.course;
    this.data.centerMarkerDistance=mcdst.dtsnm;
    //route data
    var curRoute=this.routeHandler.getCurrentLeg().currentRoute;
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
                    var dst = avnav.nav.NavCompute.computeDistance(gps, this.data.routeNextWp);
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
    }
    else {
        var edRoute=this.routeHandler.getRoute();
        this.data.edRouteRemain=0;
        this.data.edRouteEta=undefined;
        this.data.edRouteName=edRoute?edRoute.name:undefined;
        this.data.edRouteNumPoints=edRoute?edRoute.points.length:0;
        this.data.edRouteLen=edRoute?this.routeHandler.computeLength(0,edRoute):0;
    }

    //now create text values
    var legDataFormatted=this.formatLegData(this.data);
    avnav.assign(this.formattedValues,legDataFormatted);

    this.formattedValues.markerName=this.data.markerWp.name||"Marker";
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
    this.formattedValues.routeName=this.data.routeName||"default";
    this.formattedValues.routeNumPoints=this.formatter.formatDecimal(this.data.routeNumPoints,4,0);
    this.formattedValues.routeLen=this.formatter.formatDecimal(this.data.routeLen,4,1);
    this.formattedValues.routeRemain=this.formatter.formatDecimal(this.data.routeRemain,4,1);
    this.formattedValues.routeEta=this.data.routeEta?this.formatter.formatTime(this.data.routeEta):"--:--:--";
    this.formattedValues.routeNextCourse=(this.data.routeNextCourse !== undefined)?this.formatter.formatDecimal(this.data.routeNextCourse,3,0):"---";
    this.formattedValues.routeNextName=this.data.routeNextWp?this.data.routeNextWp.name:"???";

    this.formattedValues.edRouteName=this.data.edRouteName||"default";
    this.formattedValues.edRouteNumPoints=this.formatter.formatDecimal(this.data.edRouteNumPoints,4,0);
    this.formattedValues.edRouteLen=this.formatter.formatDecimal(this.data.edRouteLen,4,1);
    this.formattedValues.edRouteRemain=this.formatter.formatDecimal(this.data.edRouteRemain,4,1);
    this.formattedValues.edRouteEta=this.data.edRouteEta?this.formatter.formatTime(this.data.edRouteEta):"--:--:--";
};

avnav.nav.NavObject.prototype.formatLegData=function(legInfo){
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
 * @returns {avnav.nav.navdata.Point}
 */
avnav.nav.NavObject.prototype.getMapCenter=function(){
    return this.maplatlon;
};

/**
 * get the center for AIS queries
 * @returns {avnav.nav.navdata.Point|avnav.nav.NavObject.maplatlon|*}
 */
avnav.nav.NavObject.prototype.getAisCenter=function(){
    if (this.aisMode == avnav.nav.AisCenterMode.NONE) return undefined;
    if (this.aisMode == avnav.nav.AisCenterMode.GPS) {
        var data=this.gpsdata.getGpsData();
        if (data.valid) return data;
        return undefined;
    }
    return this.maplatlon;
};

/**
 * set the mode for the AIS query
 * @param {avnav.nav.AisCenterMode} mode
 */
avnav.nav.NavObject.prototype.setAisCenterMode=function(mode){
    this.aisMode=mode;
};
/**
 * @private
 * @param name
 * @returns {*}
 */
avnav.nav.NavObject.prototype.getFormattedNavValue=function(name){
    return this.formattedValues[name];
};
/**
 * return the values that have been computed from others
 * @returns {{centerCourse: number, centerDistance: number, centerMarkerCourse: number, centerMarkerDistance: number, markerCourse: number, markerDistance: number, markerVmg: number, markerEta: null, markerWp: avnav.nav.navdata.WayPoint, routeName: undefined, routeNumPoints: number, routeLen: number, routeRemain: number, routeEta: null, routeNextCourse: number, routeNextWp: undefined, markerXte: number, edRouteName: undefined, edRouteNumPoints: number, edRouteLen: number, edRouteRemain: number, edRouteEta: number}}
 */
avnav.nav.NavObject.prototype.getComputedValues=function(){
    return this.data;
};


/**
 * get the value of a display item
 * @param {string} name
 * @returns {string}
 */
avnav.nav.NavObject.prototype.getValue=function(name){
    var handler=this.valueMap[name];
    if(handler) return handler.provider.call(handler.context,name);
    return "undef";
};
/**
 * get a list of known display names
 */
avnav.nav.NavObject.prototype.getValueNames=function(){
    var rt=[];
    for (var k in this.valueMap){
        rt.push(k);
    }
    return rt;
};

/**
 * called back from gpshandler
 */
avnav.nav.NavObject.prototype.gpsEvent=function(){
    this.computeValues();
    this.callCallbacks();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,new avnav.nav.NavEvent (
        avnav.nav.NavEventType.GPS,
        this.getValueNames(),
        avnav.nav.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from trackhandler
 */
avnav.nav.NavObject.prototype.trackEvent=function(){
    this.callCallbacks();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,new avnav.nav.NavEvent (
        avnav.nav.NavEventType.TRACK,
        [],
        avnav.nav.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from aishandler
 */
avnav.nav.NavObject.prototype.aisEvent=function(){
    this.callCallbacks();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,new avnav.nav.NavEvent (
        avnav.nav.NavEventType.AIS,
        [],
        avnav.nav.NavEventSource.NAV,
        this
    ));
};

/**
 * called back from routeHandler
 */
avnav.nav.NavObject.prototype.routeEvent=function(){
    this.computeValues();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,new avnav.nav.NavEvent (
        avnav.nav.NavEventType.ROUTE,
        [],
        avnav.nav.NavEventSource.NAV,
        this
    ));
    this.triggerUpdateEvent(avnav.nav.NavEventSource.NAV);
};
/**
 * register the provider of a display value
 * @param {string} name
 * @param {object} providerContext
 * @param {function} provider
 */
avnav.nav.NavObject.prototype.registerValueProvider=function(name,providerContext,provider){
    this.valueMap[name]={provider:provider,context:providerContext};
};

/**
 * set the current map center position
 * @param {Array.<number>} lonlat
 */
avnav.nav.NavObject.prototype.setMapCenter=function(lonlat){
    var p=new avnav.nav.navdata.Point();
    p.fromCoord(lonlat);
    if (p.compare(this.maplatlon)) return;
    p.assign(this.maplatlon);
    this.computeValues();
    this.triggerUpdateEvent(avnav.nav.NavEventSource.MAP);
};

/**
 * get the routing handler
 * @returns {avnav.nav.RouteData|*}
 */
avnav.nav.NavObject.prototype.getRoutingHandler=function(){
    return this.routeHandler;
};

/**
 * get the gps data handler
 * @returns {avnav.nav.GpsData}
 */
avnav.nav.NavObject.prototype.getGpsHandler=function(){
    return this.gpsdata;
};
/**
 * get the track handler
 * @returns {avnav.nav.TrackData}
 */
avnav.nav.NavObject.prototype.getTrackHandler=function(){
    return this.trackHandler;
};
/**
 * get the AIS data handler
 * @returns {avnav.nav.AisData|*}
 */
avnav.nav.NavObject.prototype.getAisHandler=function(){
    return this.aisHandler;
};

avnav.nav.NavObject.prototype.resetTrack=function(){
    return this.trackHandler.resetTrack();
};

/**
 * send out an update event
 * @param {avnav.nav.NavEventSource} source
 */
avnav.nav.NavObject.prototype.triggerUpdateEvent=function(source){
    this.callCallbacks();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,
        new avnav.nav.NavEvent(avnav.nav.NavEventType.GPS,this.getValueNames(),source,this)
    );
};




