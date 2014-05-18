/**
 * Created by andreas on 18.05.14.
 */

goog.provide('avnav.map.NavLayer');
goog.require('avnav.map.MapHolder');
goog.require('avnav.nav.GpsData');
goog.require('avnav.nav.NavObject');

/**
 * a cover for the layer that contaisn the booat, the current wp and the route between them
 * @param {avnav.map.MapHolder} mapholder
 * @param {avnav.nav.NavObject} navobject
 * @constructor
 */
avnav.map.NavLayer=function(mapholder,navobject){
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
     * the last boat course
     * @private
     * @type {number}
     */
    this.lastBoatCourse=0;
    /**
     * the initial course must be different from 0 to create a style...
     * @private
     * @type {ol.style.Style}
     */
    this.boatStyle=this.setBoatStyle(20);

    /**
     * our features: 0-boat,1-marker,2-line between boat and marker
     * @private
     * @type {Array.<ol.Feature>}
     */
    this.features=[];
    this.features.push(new ol.Feature({
        'geometry': new ol.geom.Point([0,0])
    }));

    this.maplayer.getSource().addFeatures(this.features);
    this.maplayer.avnavOptions.type=avnav.map.LayerTypes.TNAV;

};
/**
 * feature index
 * @type {number}
 */
avnav.map.NavLayer.IDXBOAT=0;
avnav.map.NavLayer.IDXMARKER=0;
avnav.map.NavLayer.IDXCOURSE=0;

/**
 * get the new boat style (as we have to change this for the rotation...)
 * @private
 * @param rotation
 */
avnav.map.NavLayer.prototype.setBoatStyle=function(rotation){
    //rotation=30;
    if (rotation == this.lastBoatCourse) return this.boatStyle;
    this.boatStyle=new ol.style.Style({

        image: new ol.style.Icon( ({
            anchor: [15, 72],
            size: [30,120],
            anchorXUnits: 'pixels',
            anchorYUnits: 'pixels',
            opacity: 1,
            src: 'images/Boat2.png',
            rotation: rotation/180*Math.PI
        }))
    /*
        image: new ol.style.Circle({
         radius: 10,
         fill: new ol.style.Fill({color: 'red'})
         })
         */
    });
    this.lastBoatCourse=rotation;
    return this.boatStyle;
};

/**
 * get the maplayer
 * @returns {ol.layer.Vector|*}
 */
avnav.map.NavLayer.prototype.getMapLayer=function(){
    return this.maplayer;
};



/**
 * set the boat position
 * @param {ol.Coordinate} pos
 * @param {number} course
 */
avnav.map.NavLayer.prototype.setBoatPosition=function(pos,course){
    //TODO: set course
    this.setBoatStyle(course);
    this.features[avnav.map.NavLayer.IDXBOAT].setGeometry(new ol.geom.Point(this.mapholder.transformToMap(pos)));
    //TODO: compute...
};

/**
 * get the style for one of the features
 * @param {ol.Feature} feature
 * @param resolution
 * @returns {*}
 */
avnav.map.NavLayer.prototype.styleFunction=function(feature,resolution){
    if (feature == this.features[avnav.map.NavLayer.IDXBOAT]){
        return [this.boatStyle];
    }
    return undefined;
};