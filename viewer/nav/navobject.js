/**
 * Created by andreas on 04.05.14.
 */
goog.provide('avnav.nav.NavObject');
goog.provide('avnav.nav.NavEvent');
goog.require('avnav.nav.GpsData');

/**
 * the navevent type
 * @enum {number}
 */
avnav.nav.NavEventType={
    GPS:0,
    AIS:1,
    TRACK:2
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
     * @type {{lat: number, lon: number}}
     */
    this.maplatlon={
        lat:0,
        lon:0
    };
    /**
     * @private
     * @type {{lat: number, lon: number}}
     */
    this.markerlatlon={
        lat:0,
        lon:0
    };
    /**
     * the lock state of the marker
     * @private
     * @type {boolean}
     */
    this.markerLock=true;
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
        markerEta:0
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
  //TODO
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
 * @param {avnav.nav.NavEvent.EVENT_TYPE} type
 */
avnav.nav.NavObject.prototype.getRawData=function(type){
    if (type == avnav.nav.NavEventType.GPS) return this.gpsdata.getGpsData();
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
    return "<undef>";
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
 * register the provider of a display value
 * @param {string} name
 * @param {} providerContext
 * @param {function} provider
 */
avnav.nav.NavObject.prototype.registerValueProvider=function(name,providerContext,provider){
    this.valueMap[name]={provider:provider,context:providerContext};
};

/**
 * set the current map center position
 * @param lat
 * @param lon
 */
avnav.nav.NavObject.prototype.setMapCenter=function(lon,lat){
    this.maplatlon.lat=lat;
    this.maplatlon.lon=lon;
    if (this.markerLock){
        this.markerlatlon.lat=lat;
        this.markerlatlon.lon=lon;
    }
    this.computeValues();
    $(document).trigger(avnav.nav.NavEvent.EVENT_TYPE,
        new avnav.nav.NavEvent(avnav.nav.NavEventType.GPS,[],avnav.nav.NavEventSource.MAP,this)
    );
};



