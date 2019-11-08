/**
 * Created by andreas on 18.05.14.
 */
    
var navobjects=require('../nav/navobjects');
var NavData=require('../nav/navdata');


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
     * @type {NavData}
     */
    this.navobject=NavData;
    /**
     * @private
     * @type {boolean}
     */
    this.visible=this.mapholder.getProperties().getProperties().layers.track;
    var self=this;
    /**
     * the track as read from the track handler
     * @type {Array}
     */
    this.currentTrack=[];
    /**
     * the list of track points
     * @type {Array}
     */
    this.trackPoints=[];
    /**
     * @private
     * @type {ol.style.Style}
     */
    this.lineStyle={};
    this.setStyle();
    $(document).on(navobjects.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });


};
/**
 * set the style for the track line
 * @private
 */
TrackLayer.prototype.setStyle=function() {
    this.lineStyle = {
            color: this.mapholder.properties.getProperties().trackColor,
            width: this.mapholder.properties.getProperties().trackWidth
        }
};

/**
 * the handler for new data
 * @param evdata
 */
TrackLayer.prototype.navEvent=function(evdata){
    if (evdata.source == navobjects.NavEventSource.MAP) return; //avoid endless loop
    if (! this.visible) {
        this.currentTrack=[];
        this.trackPoints=[];
        return;
    }
    if (evdata.type == navobjects.NavEventType.TRACK){
        var newTrack=this.navobject.getTrackHandler().getTrackData();
        if (newTrack.length < 2){
            this.currentTrack=[];
            this.trackPoints=[];
            return;
        }
        var startts=newTrack[0].ts;
        var mystart=this.currentTrack.length?this.currentTrack[0].ts:0;
        if ((mystart >0 && (startts-mystart) > 3600)||mystart == 0){
            //once per hour we do a redraw...
            this.currentTrack=newTrack.slice(0);
            this.trackPoints=[];
            for (var i=0;i<this.currentTrack.length;i++){
                this.trackPoints.push(this.mapholder.pointToMap([this.currentTrack[i].lon,this.currentTrack[i].lat]));
            }
        }
        else {
            //we add new points
            var lastts=this.currentTrack.length>0?this.currentTrack[this.currentTrack.length-1].ts:0;
            var startidx=-1;
            for (var i=0;i<newTrack.length;i++){
                if (newTrack[i].ts > lastts){
                    startidx=i;
                    break;
                }
            }
            if (startidx < 0) return; //no newer points...
            for (var i=startidx;i<newTrack.length;i++){
                this.currentTrack.push(newTrack[i]); //no need to copy the point as we do not modify them
                var newcoord=this.mapholder.pointToMap([newTrack[i].lon,newTrack[i].lat]);
                this.trackPoints.push(newcoord);
            }
        }
    }
    this.mapholder.triggerRender();
};

/**
 *
 * @param {ol.Coordinate} center
 * @param {avnav.map.Drawing} drawing
 */
TrackLayer.prototype.onPostCompose=function(center,drawing){
    if (! this.visible) return;
    drawing.drawLineToContext(this.trackPoints,this.lineStyle);
};
TrackLayer.prototype.propertyChange=function(evdata) {
    this.visible=this.mapholder.getProperties().getProperties().layers.track;
    this.setStyle();
    this.currentTrack=[]; //trigger a complete redraw
    this.trackPoints=[];
};

module.exports=TrackLayer;