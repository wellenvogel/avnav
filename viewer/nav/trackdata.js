/**
 * Created by andreas on 04.05.14.
 */
goog.provide('avnav.nav.TrackData');
goog.require('avnav.util.PropertyHandler');
goog.require('avnav.util.Formatter');
goog.require('goog.date.Date');
goog.require('goog.date.DateTime');
goog.require('avnav.nav.navdata.GpsInfo');
/**
 * the handler for the track data
 * query the server...
 * @param {avnav.util.PropertyHandler} propertyHandler
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.nav.TrackData=function(propertyHandler,navobject){
    /** @private */
    this.propertyHandler=propertyHandler;
    /** @private */
    this.navobject=navobject;
    /** @private
     * @type {Array.<avnav.nav.navdata.TrackPoint>}
     * */
    this.currentTrack=[];
    /**
     * @private
     * @type {boolean}
     */
    this.trackValid=false;

    /**
     * the last successfull query
     * @type {number}
     */
    this.lastTrackQuery=new Date().getTime();
    /**
     * @private
     * @type {null}
     */
    this.timer=null;
    /**
     * @private
     * @type {number}
     */
    this.trackErrors=0;
    this.NM=this.propertyHandler.getProperties().NM;
    this.startQuery();
};

/**
 *
 * @param data
 * @private
 */
avnav.nav.TrackData.prototype.convertResponse=function(data){
    var lastts=0;
    if (this.currentTrack.length>0){
        lastts=this.currentTrack[this.currentTrack.length-1].ts;
    }
    var num=0;
    for (var i=0;i<data.length;i++){
        var cur=data[i];
        if (data[i].ts <= lastts) continue;
        this.currentTrack.push(new avnav.nav.navdata.TrackPoint(cur.lon,cur.lat,cur.ts)); //we could add course,speed...
        num++;
    }
    //cleanup old track data
    var maxlen=this.propertyHandler.getProperties().initialTrackLength; //this is in units of interval
    var maxage=maxlen * this.propertyHandler.getProperties().trackInterval; //in s
    var oldest=new Date().getTime()/1000-maxage;
    log("removing track data older then "+oldest);
    while (this.currentTrack.length > 0){
        if (this.currentTrack[0].ts > oldest) break;
        this.currentTrack.shift();
    }
};

/**
 * @private
 */
avnav.nav.TrackData.prototype.startQuery=function() {
    var url = this.propertyHandler.getProperties().navUrl+"?request=track";
    var timeout = this.propertyHandler.getProperties().trackQueryTimeout; //in ms!
    var interval=this.propertyHandler.getProperties().trackInterval; //in seconds
    var self = this;
    var now = new Date().getTime();
    var maxItems = 0;
    if (this.currentTrack.length == 0){
    // initialize the track
        maxItems = this.propertyHandler.getProperties().initialTrackLength;
    }
    else{
        var tdiff=now-this.lastTrackQuery+2*timeout;
        tdiff=tdiff/1000; //tdiff in seconds
        maxItems=tdiff/interval;
        if (maxItems < 10) maxItems=10;
    }
    if (maxItems == 0) maxItems=1;
    url+="&maxnum="+maxItems+"&interval="+interval;
    var ctxdata={};
    ctxdata.self=this;
    $.ajax({
        url: url,
        dataType: 'json',
        cache:	false,
        success: function(data,status){
            self.lastTrackQuery=new Date().getTime();
            self.convertResponse(data);
            log("trackdatadata");
            self.handleTrackStatus(true);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        error: function(status,data,error){
            log("query track error");
            self.handleTrackStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        },
        timeout: 10000
    });

};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
avnav.nav.TrackData.prototype.handleTrackStatus=function(success){
    if (! success){
        this.trackErrors++;
        if (this.trackErrors > 10){
            log("lost track");
            this.trackValid=false;
            //continue to count errrors...
        }
        else{
            return;
        }
    }
    else {
        this.trackErrors=0;
        this.trackValid=true;
    }
    this.navobject.trackEvent();
};

/**
 * return the current trackData
 * @returns {Array.<avnav.nav.navdata.TrackPoint>}
 */
avnav.nav.TrackData.prototype.getTrackData=function(){
    return this.currentTrack;
};

