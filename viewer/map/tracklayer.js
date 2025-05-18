/**
 * Created by andreas on 18.05.14.
 */
    
import navobjects from '../nav/navobjects';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import RouteLayer from "./routelayer";
import mapholder from "./mapholder";


class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}

/**
 * a cover for the layer that the track
 * @param {MapHolder} mapholder
 * @constructor
 */
const TrackLayer=function(mapholder){
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;

    /**
     * @private
     * @type {boolean}
     */
    this.visible=globalStore.getData(keys.properties.layers.track);

    /**
     * the list of track points
     * @type {Array}
     */
    this.trackPoints=[];
    /**
     * list of last drawn pixel positions
     * @type {*[]}
     */
    this.trackPixel=[];
    /**
     * @private
     * @type {olStyle}
     */
    this.lineStyle={};
    this.setStyle();

    let self=this;
    globalStore.register(this,keys.gui.global.propertySequence);
    this.newTrackCallback=new Callback((keys)=>{
        self.navEvent();
    });
    globalStore.register(this.newTrackCallback,keys.nav.track);


};
/**
 * set the style for the track line
 * @private
 */
TrackLayer.prototype.setStyle=function() {
    this.lineStyle = {
            color: globalStore.getData(keys.properties.trackColor),
            width: globalStore.getData(keys.properties.trackWidth)
        }
};

/**
 * the handler for new data
 * @param evdata
 */
TrackLayer.prototype.navEvent = function () {
    if (!this.visible) {
        this.currentTrack = [];
        this.trackPoints = [];
        return;
    }

    let newTrack = globalStore.getData(keys.nav.track.currentTrack);
    if (newTrack.length < 2) {
        this.currentTrack = [];
        this.trackPoints = [];
        return;
    }
    let startts = newTrack[0].ts;
    let mystart = this.currentTrack.length ? this.currentTrack[0].ts : 0;
    if ((mystart > 0 && (startts - mystart) > 3600) || mystart == 0) {
        //once per hour we do a redraw...
        this.currentTrack = newTrack.slice(0);
        this.trackPoints = [];
        for (let i = 0; i < this.currentTrack.length; i++) {
            this.trackPoints.push(this.mapholder.pointToMap([this.currentTrack[i].lon, this.currentTrack[i].lat]));
        }
    }
    else {
        //we add new points
        let lastts = this.currentTrack.length > 0 ? this.currentTrack[this.currentTrack.length - 1].ts : 0;
        let startidx = -1;
        for (let i = 0; i < newTrack.length; i++) {
            if (newTrack[i].ts > lastts) {
                startidx = i;
                break;
            }
        }
        if (startidx < 0) return; //no newer points...
        for (let i = startidx; i < newTrack.length; i++) {
            this.currentTrack.push(newTrack[i]); //no need to copy the point as we do not modify them
            let newcoord = this.mapholder.pointToMap([newTrack[i].lon, newTrack[i].lat]);
            this.trackPoints.push(newcoord);
        }
    }

};

/**
 *
 * @param {olCoordinate} center
 * @param {Drawing} drawing
 */
TrackLayer.prototype.onPostCompose=function(center,drawing){
    if (! this.visible) {
        this.trackPixel=[];
        return;
    }
    this.trackPixel=drawing.drawLineToContext(this.trackPoints,this.lineStyle);
};
TrackLayer.prototype.dataChanged=function() {
    this.visible=globalStore.getData(keys.properties.layers.track);
    this.setStyle();
    this.currentTrack=[]; //trigger a complete redraw
    this.trackPoints=[];
    this.trackPixel=[];
};
TrackLayer.prototype.setImageStyles=function(styles){

};

/**
 * find the waypoint that has been clicked and set this as active
 * @param pixel
 * @returns {navobjects.Point}
 */
TrackLayer.prototype.findTarget=function(pixel){
    //TODO: own tolerance
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
    if (! this.trackPixel || ! this.trackPixel.length) return;
    let idx = this.mapholder.findTarget(pixel, this.trackPixel, tolerance);
    if (idx >= 0 && idx < this.trackPoints.length){
        return mapholder.fromMapToPoint(this.trackPoints[idx]);
    }
    return;
};
export default TrackLayer;