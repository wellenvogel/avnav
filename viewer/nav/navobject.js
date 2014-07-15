/**
 * Created by andreas on 04.05.14.
 */
avnav.provide('avnav.nav.NavObject');
avnav.provide('avnav.nav.NavEvent');

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


    /**
     * our computed data...
     * @type {{centerCourse: number, centerDistance: number, markerCourse: number, markerDistance: number}}
     */
    this.data={
        centerCourse:0,
        centerDistance:0,
        centerMarkerCourse:0,
        centerMarkerDistance:0,
        markerCourse:0,
        markerDistance:0,
        /**
         * @type {Date}
         */
        markerEta:null,
        markerLatlon:new avnav.nav.navdata.Point(0,0)
    };
    this.formattedValues={
        markerEta:"none",
        markerCourse:"--",
        markerDistance:"--",
        markerPosition:"none",
        centerCourse:"--",
        centerDistance:"--",
        centerMarkerCourse:"--",
        centerMarkerDistance:"--",
        centerPosition:"--"
    };
    for (var k in this.formattedValues){
        this.registerValueProvider(k,this,this.getFormattedNavValue);
    }
};

/**
 * compute the raw and formtted valued
 * @private
 */
avnav.nav.NavObject.prototype.computeValues=function(){
    var gps=this.gpsdata.getGpsData();
    //copy the marker to data to make it available extern
    this.data.markerLatlon=this.routeHandler.getRouteData().to;
    if (gps.valid){
        var markerdst=avnav.nav.NavCompute.computeDistance(gps,this.data.markerLatlon);
        this.data.markerCourse=markerdst.course;
        this.data.markerDistance=markerdst.dtsnm;
        if (gps.rtime && (Math.abs(markerdst.course-gps.course) <= 85)) {
            //TODO: is this really correct for VMG?
            var vmgapp = gps.speed * Math.cos(Math.PI / 180 * (gps.course - markerdst.course));
            //vmgapp is in kn
            var targettime = gps.rtime.getTime();
            if (vmgapp > 0) {
            targettime += this.data.markerDistance / vmgapp * 3600 * 1000; //time in ms
            var targetDate = new Date(Math.round(targettime));
            this.data.markerEta = targetDate;
            }
            else {
                this.data.markerEta=null;
            }

        }
        else  this.data.markerEta=null;
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
    }

    //distance between marker and center
    var mcdst=avnav.nav.NavCompute.computeDistance(this.data.markerLatlon,this.maplatlon);
    this.data.centerMarkerCourse=mcdst.course;
    this.data.centerMarkerDistance=mcdst.dtsnm;
    //now create text values
    this.formattedValues.markerEta=(this.data.markerEta)?
        this.formatter.formatTime(this.data.markerEta):"--:--:--";
    this.formattedValues.markerCourse=this.formatter.formatDecimal(
        this.data.markerCourse,3,0
    );
    this.formattedValues.markerDistance=this.formatter.formatDecimal(
        this.data.markerDistance,3,1
    );
    this.formattedValues.markerPosition=this.formatter.formatLonLats(
        this.data.markerLatlon
    );
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

};

/**
 * get the current map center (lon/lat)
 * @returns {avnav.nav.navdata.Point}
 */
avnav.nav.NavObject.prototype.getMapCenter=function(){
    return this.maplatlon;
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
 * get the raw data of the underlying object
 * @param {avnav.nav.NavEventType} type
 */
avnav.nav.NavObject.prototype.getRawData=function(type){
    if (type == avnav.nav.NavEventType.GPS) return this.gpsdata.getGpsData();
    if (type == avnav.nav.NavEventType.NAV) return this.data;
    if (type == avnav.nav.NavEventType.TRACK) return this.trackHandler.getTrackData();
    if (type == avnav.nav.NavEventType.AIS) return this.aisHandler.getAisData();
    if (type == avnav.nav.NavEventType.ROUTE) return this.routeHandler.getRouteData();
    return undefined;
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
 * get the AIS data handler
 * @returns {avnav.nav.AisData|*}
 */
avnav.nav.NavObject.prototype.getAisData=function(){
    return this.aisHandler;
};
/**
 * called back from gpshandler
 */
avnav.nav.NavObject.prototype.gpsEvent=function(){
    this.computeValues();
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
 * lock to current center
 * @param {boolean} lock if true
 * @param {avnav.nav.navdata.Point} opt_target - if not set, use current map center
 */
avnav.nav.NavObject.prototype.setLock=function(activate,opt_target) {
    if (!activate){
        this.routeHandler.setLock(activate);
        return;
    }
    var p = new avnav.nav.navdata.WayPoint();
    if (! opt_target) {
        this.getMapCenter().assign(p);
    }
    else {
        p=opt_target;
    }
    var pfrom;
    var gps=this.gpsdata.getGpsData();
    if (gps.valid){
        pfrom=new avnav.nav.navdata.Point(gps.lon,gps.lat);
    }
    var newLeg={
        to:p,
        from:pfrom,
        active:activate
    };
    var changed=this.routeHandler.setLeg(newLeg);
    if (changed) {
        this.computeValues();
        this.triggerUpdateEvent(avnav.nav.NavEventSource.MAP);
    }
};
/**
 * get the routing handler
 * @returns {avnav.nav.RouteData|*}
 */
avnav.nav.NavObject.prototype.getRoutingData=function(){
    return this.routeHandler;
};

/**
 * send out an update event
 * @param {avnav.nav.NavEventSource} source
 */
avnav.nav.NavObject.prototype.triggerUpdateEvent=function(source){
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,
        new avnav.nav.NavEvent(avnav.nav.NavEventType.GPS,this.getValueNames(),source,this)
    );
};




