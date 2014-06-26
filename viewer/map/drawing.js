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
     * the global rotation - will be added to rotations
     * if rotateWithView is set
     * @type {number}
     * @private
     */
    this.rotation=0;
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
 *             rotateWithView - if true - add global rotation
 * @return {ol.Coordinate} the css pixel coordinates of the object
 */
avnav.map.Drawing.prototype.drawImageToContext=function(point,image,opt_options){
    if (! this.context) return;
    if (image.naturalHeight == 0 || image.naturalWidth == 0) return; //silently ignore error
    var rt=this.pointToCssPixel(point);
    var xy=this.pixelToDevice(rt);
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
        var angle=opt_options.rotation;
        if (opt_options.rotateWithView) angle+=this.rotation;
        context.rotate(angle);
    }
    context.drawImage(image,-anchor[0],-anchor[1], size[0]*devpixratio, size[1]*devpixratio);
    context.restore();
    return rt;
};
/**
 * draw a line string
 * @param {Array.<ol.Coordinate>}points in map coordinates
 * @param opt_style - properties:
 *          color:  - css color
 *          width:  - width in px
 *          cap:    - line cap
 *          join:   - line join
 * @return {Array.<ol.Coordinate>} the css pixel coordinates of the points
 */
avnav.map.Drawing.prototype.drawLineToContext=function(points,opt_style){
    if (! points || points.length < 2) return;
    if (! this.context) return;
    var rt=[];
    if (opt_style){
        if (opt_style.color) this.context.strokeStyle=opt_style.color;
        if (opt_style.width) this.context.lineWidth=opt_style.width;
        if (opt_style.cap) this.context.lineCap=opt_style.cap;
        if (opt_style.join) this.context.lineJoin=opt_style.join;
    }
    this.context.beginPath();
    var p=this.pointToCssPixel(points[0]);
    rt.push(p);
    p=this.pixelToDevice(p);
    this.context.moveTo(p[0],p[1]);
    var i;
    for (i=1;i<points.length;i++){
        p=this.pointToCssPixel(points[i]);
        rt.push(p);
        p=this.pixelToDevice(p);
        this.context.lineTo(p[0],p[1]);
    }
    this.context.stroke();
    return rt;
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
 * @param {ol.Coordinate} coord
 *
 * @returns {ol.Coordinate}
 */
avnav.map.Drawing.prototype.pointToCssPixel=function(coord) {
    var rt = this.converter.coordToPixel(coord);
    return rt;
};

/**
 * convert pixel from css to device
 * @param {ol.Coordinate} pixel
 * @returns {ol.Coordinate}
 */
avnav.map.Drawing.prototype.pixelToDevice=function(pixel) {
    var rt=[];
    rt[0]=pixel[0]*this.devPixelRatio;
    rt[1]=pixel[1]*this.devPixelRatio;
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
/**
 * set the rotation of the view
 * @param angle
 */
avnav.map.Drawing.prototype.setRotation=function(angle){
    this.rotation=angle;
};
