/**
 * Created by andreas on 26.06.14.
 * 2d context drawing functions
 * as all the ol3 stuff is hard to use or broken...
 */



/**
 * an interface for converting between lat/lon and css pixel
 * @constructor
 */
export const DrawingPositionConverter=function(){
};
/**
 * to be overloaded
 * @param {olCoordinate} point
 * @returns {undefined}
 */
DrawingPositionConverter.prototype.coordToPixel=function(point){
    return undefined;
};
/**
 * convert from pixel (as provided by an event) to map coordinates
 * @param pixel
 * @returns {olCoordinate}
 */
DrawingPositionConverter.prototype.pixelToCoord=function(pixel){
    return [0,0];
};
/**
 *
 * @param point [lon,lat]
 * @return {number[]}
 */
DrawingPositionConverter.prototype.pointToMap=function(point){
    return [0,0];
};

/**
 *
 * @param coord [x,y]
 * @return {number[]}
 */
DrawingPositionConverter.prototype.pointFromMap=function(coord){
    return [0,0];
};
/**
 * 2d drawing functions
 * @constructor
 * @param {DrawingPositionConverter} converter
 * @param {number} opt_useHdpi - if true, adapt sizes if devPixelratio != 1
 */
export const Drawing=function(converter,opt_useHdpi){
    /**
     * the device pixel ratio
     * @private
     * @type {number}
     */
    this.devPixelRatio=1;
    /**
     * the global rotation - will be added to rotations
     * if rotateWithView is set
     * @type {number}
     * @private
     */
    this.rotation=0;
    /**
     * @private
     * @type {DrawingPositionConverter}
     */
    this.converter=converter;
    /**
     * the context to be used for drawing
     * @private
     * @type {CanvasRenderingContext2D}
     */
    this.context=undefined;
    /**
     * whether to convert font sizes and line width to hdpi (i.e. pixel ratio)
     * @private
     * @type {*|boolean}
     */
    this.useHdpi=opt_useHdpi||false;

};

Drawing.prototype.setUseHdpi=function(val){
    this.useHdpi=val||false;
};
Drawing.prototype.getUseHdpi=function(){
    return this.useHdpi;
};

/**
 * draw a circle determined by a center point an one other point
 * @param {olCoordinate} center
 * @param {olCoordinate} other
 * @param opt_styles - see drawLineToContext
 * @return the center in css pixel
 */
Drawing.prototype.drawCircleToContext=function(center,other,opt_styles){
    if (! this.context) return;
    this.setLineStyles(opt_styles);
    let rt=this.pointToCssPixel(center);
    let cp=this.pixelToDevice(rt);
    let op=this.pixelToDevice(this.pointToCssPixel(other));
    let xd=op[0]-cp[0];
    let yd=op[1]-cp[1];
    let r=Math.sqrt(xd*xd+yd*yd);
    this.context.beginPath();
    this.context.arc(cp[0],cp[1],r,0, 2 * Math.PI);
    this.context.stroke();
    return rt;
};

/**
 * @param {olCoordinate} point the position in map coordinates
 * @param {Image} image image to display (must be loaded - no check!)
 * @param {Object} opt_options handles the same properties like olIcon
 *             currently supported:
 *             anchor[x,y] in pixels
 *             size[x,y]
 *             rotation in radian
 *             rotateWithView - if true - add global rotation
 *             fixX,fixY - set this coordinate to a fix css pixel, ignore pos
 *             background: a color for an optional background rectangle
 *             backgroundAlpha: an alpha for the background
 *             backgroundCircle: a color for an optional background circle
 * @return {olCoordinate} the css pixel coordinates of the object
 */
Drawing.prototype.drawImageToContext=function(point,image,opt_options){
    if (! this.context) return;
    if (! opt_options) opt_options={};
    if (image.naturalHeight == 0 || image.naturalWidth == 0) return; //silently ignore error
    let rt=this.pointToCssPixel(point);
    let xy=this.pixelToDevice(rt);
    if (opt_options.fixX !== undefined) {
        xy[0]=opt_options.fixX*this.devPixelRatio;
    }
    if (opt_options.fixY !== undefined) {
        xy[1]=opt_options.fixY*this.devPixelRatio;
    }
    let devpixratio=this.devPixelRatio;
    let anchor=[0,0];
    if (opt_options.anchor){
        anchor[0]+=opt_options.anchor[0]*devpixratio;
        anchor[1]+=opt_options.anchor[1]*devpixratio;
    }
    let size;
    if (opt_options.size) {
        size=opt_options.size;
    }
    else {
        size=[image.naturalWidth,image.naturalHeight];
    }
    if (size[0]<=0 || size[1] <= 0) return;
    /** @type {CanvasRenderingContext2D} */
    let context=this.context;
    context.save();
    context.translate(xy[0],xy[1]);
    let angle=0;
    if (opt_options.rotation) {
        angle = opt_options.rotation;
    }
    if (opt_options.rotateWithView) angle+=this.rotation;
    if (angle) context.rotate(angle);
    if (opt_options.background || opt_options.backgroundCircle){
        context.beginPath();
        if (opt_options.background) {
            context.fillStyle = opt_options.background;
            context.rect(-anchor[0], -anchor[1], size[0] * devpixratio, size[1] * devpixratio);
        }
        else {
            context.fillStyle = opt_options.backgroundCircle;
            context.arc(0, 0,Math.max(size[0] * devpixratio, size[1] * devpixratio)/2,0,2*Math.PI);
        }
        let alpha=context.globalAlpha;
        if (opt_options.backgroundAlpha){
            context.globalAlpha=opt_options.backgroundAlpha;
        }
        context.fill();
        context.globalAlpha=alpha;
    }
    let alpha;
    if (opt_options.alpha !== undefined){
        let alpha=context.globalAlpha;
        context.globalAlpha=opt_options.alpha;
    }
    context.drawImage(image,-anchor[0],-anchor[1], size[0]*devpixratio, size[1]*devpixratio);
    if (alpha !== undefined){
        context.globalAlpha=alpha;
    }
    context.restore();
    return rt;
};
/**
 * draw a dashed line
 * coordinates have to be in device coordinates
 * @private
 * @param ax start x
 * @param ay start y
 * @param bx end x
 * @param by end y
 * @param dashLen the len in device pixel
 */
Drawing.prototype.dashedLine = function(ax, ay, bx, by, dashlen) {
    var dx = bx-ax, dy = by-ay;
    var dashes = Math.max(Math.floor(Math.sqrt(dx * dx + dy * dy) / Math.max(1,dashlen)),3);
    dashes += 1-dashes%2; // force odd number of dashes to draw visible dash at end
    dx/=dashes; dy/=dashes;
    for(var i=0;i<=dashes;i++) {
        var x=ax+i*dx, y=ay+i*dy;
        this.context[i % 2 ? 'lineTo' : 'moveTo'](x,y);
    }
};

/**
 * draw an arrow with the current line style settings
 * x1,y1 being the peak (end of this line), x2,y2 the start, width - with at bottom
 * @private
 * @param x1
 * @param y1
 * @param x2
 * @param y2
 * @param w
 * @param l
 * @param pe: pixel from line end for peak
 * @param open: if true - open arrow
 */
Drawing.prototype.arrow=function(x1,y1,x2,y2,w,l,pe,open){
    let dx=x2-x1;
    let dy=y2-y1;
    if (Math.abs(dx)<0.0001) return;
    let a=Math.atan(dy/dx);
    let d=dx*dx+dy*dy;
    //compute part of line we must move
    let f=Math.sqrt(l*l/d);
    let lf=Math.sqrt(pe*pe/d);
    let x0=x1+lf*dx;
    let y0=y1+lf*dy;
    this.context.moveTo(x0,y0);
    dx=dx*f;
    dy=dy*f;
    x2=x0+dx;
    y2=y0+dy;
    //x2,y2 is now the feet for the arrow
    let ca=Math.cos(a);
    let sa=Math.sin(a);
    this.context.lineTo(x2-sa*w,y2+ca*w);
    if (open) this.context.moveTo(x2+sa*w,y2-ca*w);
    else this.context.lineTo(x2+sa*w,y2-ca*w);
    this.context.lineTo(x0,y0);
    this.context.moveTo(x1,y1);
};
/**
 * draw a line string
 * @param {Array.<olCoordinate>}points in map coordinates
 * @param opt_style - properties:
 *          color:  - css color
 *          width:  - width in px
 *          cap:    - line cap
 *          join:   - line join
 *          dashed: - if set draw a dashed line
 * @return {Array.<olCoordinate>} the css pixel coordinates of the points
 */
Drawing.prototype.drawLineToContext=function(points,opt_style){
    if (! points || points.length < 2) return;
    if (! this.context) return;
    let rt=[];
    this.setLineStyles(opt_style);
    this.context.beginPath();
    let p=this.pointToCssPixel(points[0]);
    rt.push(p);
    p=this.pixelToDevice(p);
    this.context.moveTo(p[0],p[1]);
    let i;
    let dashlen=0;
    if (opt_style && opt_style.dashed){
//        dashlen=this.context.canvas.width/100;
        dashlen=6;
        dashlen*=this.devPixelRatio;
    }
    let last=p;
    let nminus1=undefined;
    let arrowStyle;
    if (opt_style && opt_style.arrow){
        //if we compute the arrow from our line width this has been scaled already
        let scaleWidth=true;
        let scaleLength=true;
        if (typeof opt_style.arrow === "object"){
            try{
               arrowStyle={};
               if (opt_style.arrow.width !== undefined){
                   arrowStyle.width=opt_style.arrow.width;
               }
               else {
                   arrowStyle.width = (this.context.lineWidth || 1) * 3;
                   scaleWidth=false;
               }
               if (opt_style.arrow.length !== undefined) {
                   arrowStyle.length = opt_style.arrow.length;
               }
               else{
                   arrowStyle.length = (this.context.lineWidth || 1) * 8;
                   scaleLength=false;
               }
               arrowStyle.offset=opt_style.arrow.offset||10;
               arrowStyle.open=opt_style.arrow.open||false;
            } catch (e){}
        } else{
           arrowStyle={};
           arrowStyle.width=(this.context.lineWidth||1)*3;
           scaleWidth=false;
           arrowStyle.length=(this.context.lineWidth||1)*8;
           scaleLength=false;
           arrowStyle.offset=10;
           arrowStyle.open=false;
        }
        if (this.useHdpi){
            if (scaleWidth) arrowStyle.width*=this.devPixelRatio;
            if (scaleLength) arrowStyle.length*=this.devPixelRatio;
            //arrowStyle.offset*=this.devPixelRatio;
        }
    }
    for (i=1;i<points.length;i++){
        p=this.pointToCssPixel(points[i]);
        rt.push(p);
        p=this.pixelToDevice(p);
//        if (dashlen == 0) this.context.lineTo(p[0],p[1]);
//        else this.dashedLine(last[0],last[1],p[0],p[1],dashlen);
        this.context.lineTo(p[0],p[1]);
        if(dashlen) this.context.setLineDash([dashlen,dashlen]);
        if (arrowStyle && (nminus1 === undefined || Math.abs(last[0]-p[0]))> 0.01) {
            nminus1 = last;
        }
        last=p;
        if (arrowStyle && i >= (points.length -1) && nminus1 !== undefined){
            this.arrow(last[0],last[1],nminus1[0],nminus1[1],arrowStyle.width,arrowStyle.length,arrowStyle.offset,arrowStyle.open);
        }
    }

    this.context.stroke();
    this.context.setLineDash([]);
    return rt;
};
/**
 * draw a round bubble
 * @param point - the center
 * @param radius - radius in css pixel
 * @param opt_style - see draw line, additionally background for a fill color
 */
Drawing.prototype.drawBubbleToContext=function(point,radius,opt_style){
    if (! this.context) return;
    let rt=[];
    this.setLineStyles(opt_style);
    let cp=this.pointToCssPixel(point);
    rt=cp;
    cp=this.pixelToDevice(cp);
    let r=radius*this.devPixelRatio;
    this.context.beginPath();
    this.context.arc(cp[0],cp[1],r,0, 2 * Math.PI);
    this.context.stroke();
    if (opt_style && opt_style.background){
        this.context.fillStyle=opt_style.background;
        this.context.fill();
    }
    return rt;
};


/**
 *
 * @param {olCoordinate} point
 * @param {string} text
 * @param opt_styles - properties
 *      fontBase: the text font
 *      fontSize: the size in px
 *      color: the text color
 *      stroke: text stroke - either stroke or color (color will win)
 *      width: text width
 *      align: text align
 *      baseline: text baseline
 *      rotateWithView: if true show rotated (default: false)
 *      offsetX
 *      offsetY
 *      fixX: use this as x position (ignore point[0])
 *      fixY: use this as y position (ignore point[1])
 */
Drawing.prototype.drawTextToContext=function(point,text,opt_styles){
    if (!this.context) return;
    if (! point) return;
    let doFill=true;
    let doStroke=false;
    let noRotate=true;
    let rt=this.pointToCssPixel(point);
    let dp=this.pixelToDevice(rt);
    let offset=[0,0];
    let alpha;
    if (opt_styles) {
        if (opt_styles.fontBase) {
            let fontStyle=opt_styles.fontSize||10;
            if (this.useHdpi) fontStyle*=this.devPixelRatio;
            this.context.font = fontStyle+"px "+opt_styles.fontBase;
        }
        if (opt_styles.color) this.context.fillStyle = opt_styles.color;
        if (opt_styles.stroke) {
            doStroke = true;
            this.context.strokeStyle = opt_styles.stroke;
        }
        if (opt_styles.width)this.context.lineWidth = this.useHdpi?opt_styles.width*this.devPixelRatio:opt_styles.width;
        if (opt_styles.rotateWithView) noRotate=false;
        if (opt_styles.fixX !== undefined) {
            dp[0]=opt_styles.fixX*this.devPixelRatio;
        }
        if (opt_styles.fixY !== undefined) {
            dp[1]=opt_styles.fixY*this.devPixelRatio;
        }
        if (opt_styles.offsetX) offset[0]=opt_styles.offsetX;
        if (opt_styles.offsetY) offset[1]=opt_styles.offsetY;
        if (opt_styles.alpha){
            alpha=this.context.globalAlpha;
            this.context.globalAlpha=opt_styles.alpha;
        }
    }
    offset=this.pixelToDevice(offset);
    this.context.textAlign = opt_styles.align || 'center';
    this.context.textBaseline = opt_styles.baseline || 'middle';
    if (this.rotation && noRotate){
        this.context.save();
        this.context.translate(dp[0],dp[1]);
        this.context.rotate(0);
        if (doStroke) this.context.strokeText(text,offset[0],offset[1]);
        if (doFill) this.context.fillText(text,offset[0],offset[1]);
        this.context.restore();
    }
    else {
        if (doStroke) this.context.strokeText(text,dp[0]+offset[0],dp[1]+offset[1]);
        if (doFill) this.context.fillText(text,dp[0]+offset[0],dp[1]+offset[1]);
    }
    if (alpha !== undefined){
        this.context.globalAlpha=alpha;
    }
    return rt;
};


/**
 * get the drawing context
 * @returns {CanvasRenderingContext2D}
 */
Drawing.prototype.getContext=function(){
    return this.context;
};
/**
 * get the device-pixel ratio
 * @returns {number}
 */
Drawing.prototype.getDevPixelRatio=function(){
    return this.devPixelRatio;
};

/**
 * get the current view rotation
 * @returns {number}
 */
Drawing.prototype.getRotation=function(){
    return this.rotation;
};
/**
 * convert a point in map coordinates into pixel
 * @param {olCoordinate} coord
 *
 * @returns {olCoordinate}
 */
Drawing.prototype.pointToCssPixel=function(coord) {
    let rt = this.converter.coordToPixel(coord);
    return rt;
};

/**
 * convert pixel from css to device
 * @param {olCoordinate} pixel
 * @returns {olCoordinate}
 */
Drawing.prototype.pixelToDevice=function(pixel) {
    let rt=[];
    rt[0]=pixel[0]*this.devPixelRatio;
    rt[1]=pixel[1]*this.devPixelRatio;
    return rt;
};


/**
 * set the current devPixelRatio
 * @param {number} ratio
 */
Drawing.prototype.setDevPixelRatio=function(ratio){
    this.devPixelRatio=ratio;
};

/**
 * set the context
 * @param {CanvasRenderingContext2D} context
 */
Drawing.prototype.setContext=function(context){
    this.context=context;
};
/**
 * set the rotation of the view
 * @param angle
 */
Drawing.prototype.setRotation=function(angle){
    this.rotation=angle;
};

Drawing.prototype.setLineStyles=function(opt_style){
    if (opt_style){
        if (opt_style.color) this.context.strokeStyle=opt_style.color;
        if (opt_style.width) this.context.lineWidth=this.useHdpi?opt_style.width*this.devPixelRatio:opt_style.width;
        if (opt_style.cap) this.context.lineCap=opt_style.cap;
        if (opt_style.join) this.context.lineJoin=opt_style.join;
    }
};

Drawing.prototype.cssPixelToCoord=function(xy){
    return this.converter.pixelToCoord(xy);
}
Drawing.prototype.pointToMap=function(lonlat){
    return this.converter.pointToMap(lonlat);
}
Drawing.prototype.pointFromMap=function(coord){
    return this.converter.pointFromMap(coord);
}

