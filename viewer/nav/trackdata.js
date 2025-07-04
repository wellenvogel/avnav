
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
class TrackData {
    constructor() {

        /** @private
         * @type {Array.<navobjects.TrackPoint>}
         * */
        this.currentTrack = [];
        /**
         * @private
         * @type {boolean}
         */
        this.trackValid = false;

        /**
         * the last successfull query
         * @type {number}
         */
        this.lastTrackQuery = new Date().getTime();
        /**
         * @private
         * @type {null}
         */
        this.timer = null;
        /**
         * @private
         * @type {number}
         */
        this.trackErrors = 0;


        globalStore.register(this, keys.gui.global.propertySequence);

        this.lastModifySequence=0;
        this.lastReceivedSequence=0;

    }

    /**
     *
     * @param {array} data
     * @param {boolean} [opt_full]
     * @param opt_now timestamp from server - use this for cleanup if received
     * @private
     */
    handleTrackResponse(data,opt_full,opt_now) {
        let lastts = 0;
        if (opt_full){
            this.currentTrack=[];
        }
        if (this.currentTrack.length > 0) {
            lastts = this.currentTrack[this.currentTrack.length - 1].ts;
        }
        for (let i = 0; i < data.length; i++) {
            let cur = data[i];
            if (data[i].ts <= lastts) continue;
            this.currentTrack.push(new navobjects.TrackPoint(cur.lon, cur.lat, cur.ts, cur.speed, cur.course)); //we could add course,speed...
        }
        //cleanup old track data
        let maxage = globalStore.getData(keys.properties.initialTrackLength) * 3600; //len is in h
        let curgps = globalStore.getMultiple(keys.nav.gps);
        let oldest;
        if (opt_now === undefined) {
            let now = new Date();
            if (curgps.rtime) {
                //if we have a valid GPS time we take this as our current time for the track...
                now = curgps.rtime;
            }
            oldest = now.getTime() / 1000 - maxage;
        }
        else{
            oldest=opt_now-maxage;
        }
        base.log("removing track data older then " + oldest);
        while (this.currentTrack.length > 0) {
            if (this.currentTrack[0].ts > oldest) break;
            this.currentTrack.shift();
        }
        globalStore.storeData(keys.nav.track.currentTrack, this.currentTrack.slice(0));
    }

    /**
     *
     */
    startQuery() {
        let timeout = parseInt(globalStore.getData(keys.properties.trackQueryTimeout)); //in ms!
        let interval = parseInt(globalStore.getData(keys.properties.trackInterval)); //in seconds
        let now = new Date().getTime();
        let maxItems = 0;
        const param={
            request: 'api',
            type: 'track',
            command: 'getTrackV2'
        }
        if (this.currentTrack.length === 0 || (this.lastModifySequence !== this.lastReceivedSequence)) {
            this.lastModifySequence=this.lastReceivedSequence;
            // initialize the track
            maxItems = globalStore.getData(keys.properties.initialTrackLength) * 3600 / globalStore.getData(keys.properties.trackInterval);
            param.full=true;
        } else {
            let tdiff = now - this.lastTrackQuery + 2 * timeout;
            tdiff = tdiff / 1000; //tdiff in seconds
            maxItems = tdiff / interval;
            if (maxItems < 10) maxItems = 10;
        }
        maxItems = Math.floor(maxItems);
        if (maxItems === 0) maxItems = 1;
        param.interval=interval;
        param.maxnum=maxItems;
        Requests.getJson(param, {timeout: timeout}).then(
            (json) => {
                this.lastTrackQuery = new Date().getTime();
                this.lastReceivedSequence=json.sequence;
                this.handleTrackResponse(json.data,json.full,json.now);
                base.log("trackdata");
                this.handleTrackStatus(true);
                this.timer = window.setTimeout(()=> {
                    this.startQuery();
                }, timeout);
            }
        ).catch(
            (error) => {
                base.log("query track error",error);
                this.handleTrackStatus(false);
                this.timer = window.setTimeout( ()=> {
                    this.startQuery();
                }, timeout);
            }
        );
    }

    /**
     * handle the status and trigger the FPS event
     * @param success
     */
    handleTrackStatus(success) {
        if (!success) {
            this.trackErrors++;
            if (this.trackErrors > 10) {
                base.log("lost track");
                this.trackValid = false;
                //continue to count errrors...
            } else {
                return;
            }
        } else {
            this.trackErrors = 0;
            this.trackValid = true;
        }
    }

    /**
     * return the current trackData
     * @returns {Array.<navobjects.TrackPoint>}
     */
    getTrackData() {
        return this.currentTrack;
    }

    /**
     * delete the current track and re-query
     * @param evdata
     */
    dataChanged() {
        this.resetTrack();
    }

    /**
     * reset the current track (trigger reload)
     */
    resetTrack(opt_cleanServer) {
        if (! opt_cleanServer) {
            this.currentTrack = [];
            globalStore.storeData(keys.nav.track.currentTrack, []);
            return true;
        }
        if (globalStore.getData(keys.properties.connectedMode)){
            Requests.getJson({
                request: 'api',
                type: 'track',
                command: 'cleanCurrent'
            })
                .then(()=>{
                        this.currentTrack = [];
                        globalStore.storeData(keys.nav.track.currentTrack, []);
                },
                    (e)=>{base.log("unable to clean current track",e)})
        }
        return false;
    }
}


export default TrackData;
