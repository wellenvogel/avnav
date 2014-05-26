/**
 * Created by andreas on 04.05.14.
 */
goog.provide('avnav.nav.NavObject');
goog.provide('avnav.nav.NavEvent');
goog.require('avnav.nav.GpsData');
goog.require('avnav.nav.TrackData');
goog.require('avnav.nav.NavCompute');
goog.require('avnav.nav.navdata.Point');
goog.require('avnav.nav.navdata.Distance');
goog.require('avnav.nav.navdata.GpsInfo');

/**
 * the navevent type
 * @enum {number}
 */
avnav.nav.NavEventType={
    GPS:0,
    AIS:1,
    TRACK:2,
    NAV:3
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
    /**
     * @private
     * @type {avnav.nav.navdata.Point}
     */
    this.maplatlon=new avnav.nav.navdata.Point(0,0);
    /**
     * @private
     * @type {avnav.nav.navdata.Point}
     */
    this.markerlatlon=new avnav.nav.navdata.Point(0,0);

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
         * @type {goog.date.DateTime}
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
    var NM=1852;
    var gps=this.gpsdata.getGpsData();
    //copy the marker to data to make it available extern
    this.data.markerLatlon=this.markerlatlon;
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
            var targetDate = new goog.date.DateTime();
            targetDate.setTime(Math.round(targettime));
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
 * set the marker position
 * @param {Array.<number>} lonlat
 */
avnav.nav.NavObject.prototype.setMarkerPos=function(lonlat) {
    var p = new avnav.nav.navdata.Point();
    p.fromCoord(lonlat);
    if (p.compare(this.markerlatlon)) return;
    this.markerlatlon = p;
    this.computeValues();
    this.triggerUpdateEvent(avnav.nav.NavEventSource.MAP);
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




