/**
 * Created by andreas on 18.05.14.
 */

goog.provide('avnav.map.TrackLayer');
goog.require('avnav.nav.NavObject');

/**
 * a cover for the layer that the track
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.TrackLayer=function(mapholder,navobject){
    /**
     * @private
     * @type {avnav.map.MapHolder}
     */
    this.mapholder=mapholder;
    /**
     * @private
     * @type {avnav.nav.NavObject}
     */
    this.navobject=navobject;
    var self=this;
    this.maplayer=new ol.layer.Vector({
        source: new ol.source.Vector({
        }),
        style: function(feature,resolution){
            return self.styleFunction(feature,resolution);
        }
    });
    this.maplayer.avnavOptions={};
    /**
     * the track as read from the track handler
     * @type {Array}
     */
    this.currentTrack=[];
    /**
     * @private
     * @type {ol.style.Style}
     */
    this.lineStyle={};
    this.setStyle();

    /**
     * @private
     * @type {ol.geom.LineString}
     */
    this.lineString=new ol.geom.LineString(null);
    /**
     * @private
     * @type {ol.Feature}
     */
    this.feature=new ol.Feature({
       'geometry': this.lineString
    });

    this.maplayer.avnavOptions.type=avnav.map.LayerTypes.TNAV;
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.track);
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });


};
/**
 * set the style for the track line
 * @private
 */
avnav.map.TrackLayer.prototype.setStyle=function() {
    this.lineStyle = new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: this.mapholder.properties.getProperties().trackColor,
            width: this.mapholder.properties.getProperties().trackWidth
        })
    });
};

/**
 * get the maplayer
 * @returns {ol.layer.Vector|*}
 */
avnav.map.TrackLayer.prototype.getMapLayer=function(){
    return this.maplayer;
};
/**
 * get the style for the features
 * @param {ol.Feature} feature
 * @param resolution
 * @returns {*}
 */
avnav.map.TrackLayer.prototype.styleFunction=function(feature,resolution){
    return [this.lineStyle];
};

/**
 * the handler for new data
 * @param evdata
 */
avnav.map.TrackLayer.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
    if (! this.maplayer.getVisible()) return;
    if (evdata.type == avnav.nav.NavEventType.TRACK){
        var newTrack=this.navobject.getRawData(avnav.nav.NavEventType.TRACK);
        if (newTrack.length < 2){
            this.currentTrack=[];
            if (this.maplayer.getSource().getFeatures().length!=0){
                this.maplayer.getSource().removeFeature(this.feature);
            }
            this.lineString.setCoordinates(null);
            return;
        }
        var redraw=false;
        if (this.maplayer.getSource().getFeatures().length==0){
            redraw=true;
        }
        var startts=newTrack[0].ts;
        var mystart=this.currentTrack.length?this.currentTrack[0].ts:0;
        if ((mystart >0 && (startts-mystart) > 3600)||redraw||mystart == 0){
            //once per hour we do a redraw...
            this.currentTrack=newTrack.slice(0);
            var rawlineString=[];
            for (var i=0;i<this.currentTrack.length;i++){
                rawlineString.push(this.mapholder.pointToMap([this.currentTrack[i].lon,this.currentTrack[i].lat]));
            }
            this.lineString.setCoordinates(rawlineString);
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
                this.lineString.appendCoordinate(newcoord);
            }
        }
        if (redraw){
            this.maplayer.getSource().addFeature(this.feature);
        }
    }
};

avnav.map.TrackLayer.prototype.propertyChange=function(evdata) {
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.track);
    this.setStyle();
    this.currentTrack=[]; //trigger a complete redraw
};
