
import navobjects from './navobjects';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import Requests from '../util/requests.js';
import base from '../base.js';



/**
 * the handler for the track data
 * query the server...
 * @constructor
 */
const TrackData=function(){

    /** @private
     * @type {Array.<navobjects.TrackPoint>}
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

    /**
     * ignore responses that do belong to older sequences
     * @private
     * @type {number}
     */
    this.trackRequestSequence=0;
    this.startQuery();
    globalStore.register(this,keys.gui.global.propertySequence);

};

/**
 *
 * @param data
 * @private
 */
TrackData.prototype.handleTrackResponse=function(data){
    let lastts=0;
    if (this.currentTrack.length>0){
        lastts=this.currentTrack[this.currentTrack.length-1].ts;
    }
    let num=0;
    for (let i=0;i<data.length;i++){
        let cur=data[i];
        if (data[i].ts <= lastts) continue;
        this.currentTrack.push(new navobjects.TrackPoint(cur.lon,cur.lat,cur.ts)); //we could add course,speed...
        num++;
    }
    //cleanup old track data
    let maxage=globalStore.getData(keys.properties.initialTrackLength)*3600; //len is in h
    let curgps=globalStore.getMultiple(keys.nav.gps);
    let now=new Date();
    if (curgps.rtime){
        //if we have a valid GPS time we take this as our current time for the track...
        now=curgps.rtime;
    }
    let oldest=now.getTime()/1000-maxage;
    base.log("removing track data older then "+oldest);
    while (this.currentTrack.length > 0){
        if (this.currentTrack[0].ts > oldest) break;
        this.currentTrack.shift();
    }
    globalStore.storeData(keys.nav.track.currentTrack,this.currentTrack.slice(0));
};

/**
 * @private
 */
TrackData.prototype.startQuery=function() {
    let url = "?request=track&command=getTrack";
    let timeout = parseInt(globalStore.getData(keys.properties.trackQueryTimeout)); //in ms!
    let interval=parseInt(globalStore.getData(keys.properties.trackInterval)); //in seconds
    let self = this;
    let now = new Date().getTime();
    let maxItems = 0;
    if (this.currentTrack.length == 0){
    // initialize the track
        maxItems = globalStore.getData(keys.properties.initialTrackLength)*3600/globalStore.getData(keys.properties.trackInterval);
    }
    else{
        let tdiff=now-this.lastTrackQuery+2*timeout;
        tdiff=tdiff/1000; //tdiff in seconds
        maxItems=tdiff/interval;
        if (maxItems < 10) maxItems=10;
    }
    maxItems=Math.floor(maxItems);
    if (maxItems == 0) maxItems=1;
    url+="&maxnum="+maxItems+"&interval="+interval;
    let sequence=self.trackRequestSequence;
    Requests.getJson(url,{checkOk:false,timeout:timeout}).then(
        (data)=>{
            if (sequence != self.trackRequestSequence){
                return;
            }
            self.lastTrackQuery=new Date().getTime();
            self.handleTrackResponse(data);
            base.log("trackdatadata");
            self.handleTrackStatus(true);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    ).catch(
        (error)=>{
            base.log("query track error");
            self.handleTrackStatus(false);
            self.timer=window.setTimeout(function(){
                self.startQuery();
            },timeout);
        }
    );
};

/**
 * handle the status and trigger the FPS event
 * @param success
 */
TrackData.prototype.handleTrackStatus=function(success){
    if (! success){
        this.trackErrors++;
        if (this.trackErrors > 10){
            base.log("lost track");
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
};

/**
 * return the current trackData
 * @returns {Array.<navobjects.TrackPoint>}
 */
TrackData.prototype.getTrackData=function(){
    return this.currentTrack;
};

/**
 * delete the current track and re-query
 * @param evdata
 */
TrackData.prototype.dataChanged=function() {
    this.resetTrack();
};
/**
 * reset the current track (trigger reload)
 */
TrackData.prototype.resetTrack=function(){
    self.trackRequestSequence++;
    this.currentTrack=[];
    globalStore.storeData(keys.nav.track.currentTrack,[]);
};

export default TrackData;
