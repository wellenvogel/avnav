/**
 * Created by andreas on 18.05.14.
 */

avnav.provide('avnav.map.AisLayer');



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
    /**
     * @private
     * @type {ol.style.Stroke}
     */
    this.textStyle ={};
    this.setStyles();

    /**
     * @private
     * @type {string}
     */
    this.nearestImage=new Image();
    /**
     * @private
     * @type {string}
     */
    this.warningImage=new Image();
    /**
     * @private
     * @type {string}
     */
    this.normalImage=new Image();
    this.createAllIcons();
    /**
     * the ais data - this is a copy of the ais data array (elements are refs) form the aishandler
     * @private
     * @type {Array}
     */
    this.aisdata=[];
    /**
     * an array of pixel positions of the current ais data
     * @type {Array.<{pixel:ol.Coordinate,ais:{}}
     */
    this.pixel=[];

    $(document).on(avnav.nav.NavEvent.EVENT_TYPE, function(ev,evdata){
        self.navEvent(evdata);
    });
    /**
     *
     * @type {boolean}
     */
    this.visible=this.mapholder.getProperties().getProperties().layers.ais;
    $(document).on(avnav.util.PropertyChangeEvent.EVENT_TYPE, function(ev,evdata){
        self.propertyChange(evdata);
    });

};


/**
 * create an AIS icon using a 2d context
 * @param {string} color - the css color
 * @returns {*} - an image data uri
 */
avnav.map.AisLayer.prototype.createIcon=function(color){
    var canvas = document.createElement("canvas");
    if (! canvas) return undefined;
    canvas.width=100;
    canvas.height=300;
    var ctx=canvas.getContext('2d');
    //drawing code created by http://www.professorcloud.com/svg-to-canvas/
    //from ais-nearest.svg
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 4;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#000000";
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(23.5, 297.875);
    ctx.lineTo(50, 200);
    ctx.lineTo(76.5, 297.875);
    ctx.lineTo(23.5, 297.875);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0)";
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(50, 200);
    ctx.lineTo(50, 3);
    ctx.fill();
    ctx.stroke();
    return canvas.toDataURL();
};

/**
 * compute the icons for the AIS display
 * @private
 */
avnav.map.AisLayer.prototype.createAllIcons=function(){
    var style=this.mapholder.getProperties().getProperties().style;
    this.nearestImage.src=this.createIcon(style.aisNearestColor);
    this.warningImage.src=this.createIcon(style.aisWarningColor);
    this.normalImage.src=this.createIcon(style.aisNormalColor);
};
/**
 * find the AIS target that has been clicked
 * @param {ol.Coordinate} pixel the css pixel from the event
 */
avnav.map.AisLayer.prototype.findTarget=function(pixel){
    log("findAisTarget "+pixel[0]+","+pixel[1]);
    var tolerance=this.mapholder.getProperties().getProperties().aisClickTolerance/2;
    var idx=this.mapholder.findTarget(pixel,this.pixel,tolerance);
    if (idx >=0) return this.pixel[idx].ais;
    return undefined;
};


avnav.map.AisLayer.prototype.setStyles=function(){
    this.textStyle= {
        stroke: '#fff',
        color: '#000',
        width: 3,
        font: this.mapholder.getProperties().getProperties().aisTextSize+'px Calibri,sans-serif',
        offsetY: 15
    };
    this.targetStyle={
        anchor: [15, 60],
        size: [30,90],
        rotation: 0,
        rotateWithView: true
    };
};


/**
 * an event fired from the AIS handler
 * @param evdata
 */
avnav.map.AisLayer.prototype.navEvent=function(evdata){
    if (evdata.source == avnav.nav.NavEventSource.MAP) return; //avoid endless loop
    if (! this.visible) return;
    if (evdata.type == avnav.nav.NavEventType.AIS){
        this.aisdata=this.navobject.getAisHandler().getAisData().slice(0);
        this.pixel=[];
    }
    this.mapholder.triggerRender();
};

/**
 *
 * @param {ol.Coordinate} center
 * @param {avnav.map.Drawing} drawing
 */
avnav.map.AisLayer.prototype.onPostCompose=function(center,drawing){
    if (! this.visible) return;
    var i;
    var pixel=[];
    for (i in this.aisdata){
        var current=this.aisdata[i];
        var pos=current.mapPos;
        if (! pos){
            pos=this.mapholder.pointToMap((new avnav.nav.navdata.Point(current.lon,current.lat)).toCoord());
            current.mapPos=pos;
        }
        var rotation=current.course||0;
        var text=current.shipname;
        if (! text || text == "unknown") text=current.mmsi;
        var icon = this.normalImage;
        if (current.nearest)
            icon = this.nearestImage;
        if (current.warning)
            icon = this.warningImage;
        this.targetStyle.rotation=rotation*Math.PI/180;
        var curpix=drawing.drawImageToContext(pos,icon,this.targetStyle);
        pixel.push({pixel:curpix,ais:current});
        drawing.drawTextToContext(pos,text,this.textStyle);
    }
    this.pixel=pixel;
};
/**
 * handle changed properties
 * @param evdata
 */
avnav.map.AisLayer.prototype.propertyChange=function(evdata){
    this.visible=this.mapholder.getProperties().getProperties().layers.ais;
    this.createAllIcons();
    this.setStyles();
};
