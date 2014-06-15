/**
 * Created by andreas on 18.05.14.
 */

goog.provide('avnav.map.AisLayer');
goog.provide('avnav.map.AisFeature');
goog.require('avnav.nav.NavObject');

/**
 *
 * @param aisparam
 * @param {ol.Coordinate} coord already in map coordinates
 * @constructor
 */
avnav.map.AisFeature=function(aisparam,coord){
    ol.Feature.call(this,{
        geometry:new ol.geom.Point(coord)
    });
    this.aisparam=aisparam;
};
goog.inherits(avnav.map.AisFeature,ol.Feature);
/**
 * a cover for the layer with the AIS display
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.AisLayer=function(mapholder,navobject){
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
     * teh current features indexed by mmsi
     * @type {Array.<{}>}
     */
    this.features=[];
    this.maplayer.avnavOptions.type=avnav.map.LayerTypes.TAIS;
    /**
     * @private
     * @type {ol.style.Stroke}
     */
    this.textStroke = new ol.style.Stroke({
        color: '#fff',
        width: 3
    });
    /**
     * @private
     * @type {ol.style.Fill}
     */
    this.textFill = new ol.style.Fill({
        color: '#000'
    });
    var self=this;
    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.ais);
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });

};

/**
 * get the maplayer
 * @returns {ol.layer.Vector|*}
 */
avnav.map.AisLayer.prototype.getMapLayer=function(){
    return this.maplayer;
};
/**
 * get the style for the features
 * currently we do not cache the styles as there is a good chance anyway that e.g the rotation has changed
 * @param {avnav.map.AisFeature} feature
 * @param resolution
 * @returns {*}
 */
avnav.map.AisLayer.prototype.styleFunction=function(feature,resolution){
    var icon=this.mapholder.getProperties().getProperties().aisNormalImage;
    if (feature.aisparam.nearest)
        icon=this.mapholder.getProperties().getProperties().aisNearestImage;
    if (feature.aisparam.warning)
        icon=this.mapholder.getProperties().getProperties().aisWarningImage;
    var rotation=feature.aisparam.course||0;
    var text=feature.aisparam.shipname;
    if (! text || text == "unknown") text=feature.aisparam.mmsi;
    var rt=new ol.style.Style({
        image: new ol.style.Icon( ({
            anchor: [15, 60],
            size: [30,90],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            opacity: 1,
            src: icon,
            rotation: rotation/180*Math.PI,
            rotateWithView: true
        })),
        text: new ol.style.Text({
            font: '14px Calibri,sans-serif',
            offsetY: 15,
            text: text,
            fill: this.textFill,
            stroke: this.textStroke
        })

    });
    return [rt];
};

/**
 * an event fired from the AIS handler
 * @param evdata
 */
avnav.map.AisLayer.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
    if (evdata.type == avnav.nav.NavEventType.AIS){
        var aislist=this.navobject.getRawData(avnav.nav.NavEventType.AIS);
        var toadd=[];
        var todelete=[];
        var now=new Date().getTime();
        for (var idx in aislist){
            var item=aislist[idx];
            var mmsi=item.mmsi;
            if (! mmsi) continue;
            if (! this.features[mmsi]){
                //new target
                var nTarget=new avnav.map.AisFeature(item,this.mapholder.pointToMap([parseFloat(item.lon),parseFloat(item.lat)]));
                toadd.push(nTarget);
                this.features[mmsi]=nTarget;
                //this.maplayer.getSource().addFeature(nTarget);
            }
            else{
                //TODO: how do we ensure a redraw if only the course is changing?
                this.features[mmsi].aisparam=item;
                this.features[mmsi].setGeometry(new ol.geom.Point(this.mapholder.pointToMap([parseFloat(item.lon),parseFloat(item.lat)])));
            }
            this.features[mmsi].aisparam.updatets=now;
        }
        for (var idx in this.features){
            var f=this.features[idx];
            if (f.aisparam.updatets != now){
                this.maplayer.getSource().removeFeature(f);
                delete this.features[idx];
            }
        }
        this.maplayer.getSource().addFeatures(toadd);
    }
};
/**
 * handle changed properties
 * @param evdata
 */
avnav.map.AisLayer.prototype.propertyChange=function(evdata){
    this.maplayer.setVisible(this.mapholder.getProperties().getProperties().layers.ais);
};
