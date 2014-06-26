/**
 * Created by andreas on 26.06.14.
 * 2d context drawing functions
 */

goog.provide('avnav.map.Drawing');
goog.provide('avnav.map.DrawingPositionConverter');
goog.require('avnav.nav.navdata.Point');

/**
 * an interface for converting between lat/lon and css pixel
 * @constructor
 */
avnav.map.DrawingPositionConverter=function(){
};
/**
 * to be overloaded
 * @param {ol.Coordinate} point
 * @returns {undefined}
 */
avnav.map.DrawingPositionConverter.prototype.coordToPixel=function(point){
    return undefined;
};
/**
 * convert from pixel (as provided by an event) to map coordinates
 * @param pixel
 * @returns {ol.Coordinate}
 */
avnav.map.DrawingPositionConverter.prototype.pixelToCoord=function(pixel){
    return new ol.Coordinate();
};

/**
 * 2d drawing functions
 * @constructor
 * @param {avnav.map.DrawingPositionConverter} converter
 * @param {number} opt_ratio - device pixel ratio
 */
avnav.map.Drawing=function(converter,opt_ratio){
    /**
     * the device pixel ratio
     * @private
     * @type {number}
     */
    this.devPixelRatio=1;
    if (opt_ratio) this.devPixelRatio=opt_ratio;
    /**
     * @private
     * @type {avnav.map.DrawingPositionConverter}
     */
    this.converter=converter;
    /**
     * the context to be used for drawing
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.context=undefined;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });

};

/**
 * a workaround for the current unability of ol3 to draw in image in postcompose...
 * @param {ol.Coordinate} point the position in map coordinates
 * @param {Image} the image to display (must be loaded - no check!)
 * @param {{}} opt_options handles the same properties like ol.style.Icon
 *             currently supported:
 *             anchor[x,y] in pixels
 *             size[x,y]
 *             rotation in radian
 */
avnav.map.Drawing.prototype.drawImageToContext=function(point,image,opt_options){
    if (! this.context) return;
    if (image.naturalHeight == 0 || image.naturalWidth == 0) return; //silently ignore error
    var xy=this.pointToPixel(point);
    var devpixratio=this.devPixelRatio;
    var anchor=[0,0];
    if (opt_options && opt_options.anchor){
        anchor[0]+=opt_options.anchor[0]*devpixratio;
        anchor[1]+=opt_options.anchor[1]*devpixratio;
    }
    /** @type {CanvasRenderingContext2D} */
    var context=this.context;
    context.save();
    context.translate(xy[0],xy[1]);
    var size;
    if (opt_options && opt_options.size) {
        size=opt_options.size;
    }
    else {
        size=[image.naturalWidth,image.naturalHeight];
    }
    if (opt_options && opt_options.rotation) {
        context.rotate(opt_options.rotation);
    }
    context.drawImage(image,-anchor[0],-anchor[1], size[0]*devpixratio, size[1]*devpixratio);
    context.restore();
};

/**
 * get the drawing context
 * @returns {CanvasRenderingContext2D}
 */
avnav.map.Drawing.prototype.getContext=function(){
    return this.context;
};
/**
 * get the device-pixel ratio
 * @returns {number}
 */
avnav.map.Drawing.prototype.getDevPixelRatio=function(){
    return this.devPixelRatio;
};
/**
 * convert a point in map coordinates into pixel
 * already considering the device/pixel ratio
 * @param {ol.Coordinate} coord
 * @returns {ol.Coordinate}
 */
avnav.map.Drawing.prototype.pointToPixel=function(coord){
    var rt=this.converter.coordToPixel(coord);
    rt[0]=rt[0]*this.devPixelRatio;
    rt[1]=rt[1]*this.devPixelRatio;
    return rt;
};

/**
 * handle changed properties
 * @param evdata
 */
avnav.map.Drawing.prototype.propertyChange=function(evdata){

};
/**
 * set the current devPixelRatio
 * @param {number} ratio
 */
avnav.map.Drawing.prototype.setDevPixelRatio=function(ratio){
    this.devPixelRatio=ratio;
};
/**
 * set the context
 * @param {CanvasRenderingContext2D} context
 */
avnav.map.Drawing.prototype.setContext=function(context){
    this.context=context;
};
