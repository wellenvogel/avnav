/**
 * Created by andreas on 18.05.14.
 */
    
import navobjects from '../nav/navobjects';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from '../base.js';


/**
 * a cover for the layer with the AIS display
 * @param {MapHolder} mapholder
 * @constructor
 */
const AisLayer=function(mapholder){
    /**
     * @private
     * @type {MapHolder}
     */
    this.mapholder=mapholder;

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
     * an array of pixel positions of the current ais data
     * @type {Array.<{pixel:ol.Coordinate,ais:{}}
     */
    this.pixel=[];

    /**
     *
     * @type {boolean}
     */
    this.visible=globalStore.getData(keys.properties.layers.ais);
    globalStore.register(this,keys.gui.global.propertySequence);

};


/**
 * create an AIS icon using a 2d context
 * @param {string} color - the css color
 * @returns {*} - an image data uri
 */
AisLayer.prototype.createIcon=function(color){
    let canvas = document.createElement("canvas");
    if (! canvas) return undefined;
    canvas.width=100;
    canvas.height=300;
    let ctx=canvas.getContext('2d');
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
AisLayer.prototype.createAllIcons=function(){
    let style=globalStore.getMultiple(keys.properties.style);
    this.nearestImage.src=this.createIcon(style.aisNearestColor);
    this.warningImage.src=this.createIcon(style.aisWarningColor);
    this.normalImage.src=this.createIcon(style.aisNormalColor);
};
/**
 * find the AIS target that has been clicked
 * @param {ol.Coordinate} pixel the css pixel from the event
 */
AisLayer.prototype.findTarget=function(pixel){
    base.log("findAisTarget "+pixel[0]+","+pixel[1]);
    let tolerance=globalStore.getData(keys.properties.aisClickTolerance)/2;
    let idx=this.mapholder.findTarget(pixel,this.pixel,tolerance);
    if (idx >=0) return this.pixel[idx].ais;
    return undefined;
};


AisLayer.prototype.setStyles=function(){
    this.textStyle= {
        stroke: '#fff',
        color: '#000',
        width: 3,
        font: globalStore.getData(keys.properties.aisTextSize)+'px Calibri,sans-serif',
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
 *
 * @param {ol.Coordinate} center
 * @param {Drawing} drawing
 */
AisLayer.prototype.onPostCompose=function(center,drawing){
    if (! this.visible) return;
    let i;
    let pixel=[];
    let aisList=globalStore.getData(keys.nav.ais.list,[]);
    for (i in aisList){
        let current=aisList[i];
        let pos=current.mapPos;
        if (! pos){
            pos=this.mapholder.pointToMap((new navobjects.Point(current.lon,current.lat)).toCoord());
            current.mapPos=pos;
        }
        let rotation=current.course||0;
        let text=current.shipname;
        if (! text || text == "unknown") text=current.mmsi;
        let icon = this.normalImage;
        if (current.nearest)
            icon = this.nearestImage;
        if (current.warning)
            icon = this.warningImage;
        this.targetStyle.rotation=rotation*Math.PI/180;
        let curpix=drawing.drawImageToContext(pos,icon,this.targetStyle);
        pixel.push({pixel:curpix,ais:current});
        drawing.drawTextToContext(pos,text,this.textStyle);
    }
    this.pixel=pixel;
};
/**
 * handle changed properties
 * @param evdata
 */
AisLayer.prototype.dataChanged=function(){
    this.visible=globalStore.getData(keys.properties.layers.ais);
    this.createAllIcons();
    this.setStyles();
};
/**
 * get an AIS icon as data url
 * @param {string} type: nearest,warning,normal
 * @returns {string} the icon as a data url
 */
AisLayer.prototype.getAisIcon=function(type){
    if (type == 'nearest'){
        return this.createIcon(globalStore.getData(keys.properties.style.aisNearestColor));
    }
    if (type == 'warning'){
        return this.createIcon(globalStore.getData(keys.properties.style.aisWarningColor));
    }
    return this.createIcon(globalStore.getData(keys.properties.style.aisNormalColor));
};

module.exports=AisLayer;
