/**
 * Created by andreas on 18.05.14.
 */
    
import navobjects from '../nav/navobjects';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from '../base.js';
import assign from 'object-assign';
import NavCompute from '../nav/navcompute.js';
import AisFormatter from '../nav/aisformatter.jsx';
import Helper from '../util/helper.js';

const StyleEntry=function(src,style){
    this.src=src;
    this.style=style;
    if (src !== undefined) {
        this.image = new Image();
        this.image.src = src;
    }
};
const mergeStyles=function(){
    let rt={
        style:{}
    };
    for (let i=0;i< arguments.length;i++) {
        let other = arguments[i];
        if (!other) continue;
        if (other.src !== undefined) {
            rt.src = other.src;
        }
        if (other.image !== undefined) {
            rt.image = other.image;
        }
        assign(rt.style, other.style);
    }
    return rt;
};

const styleKeyFromItem=(item,useDefault,useInternal)=>{
    let rt="normal";
    if (item.warning){
      rt="warning";
    }
    else{
        if (item.nearest){
            rt="nearest";
        }
    }
    if (useDefault) {
        return useInternal?"internal"+rt:rt;
    }
    let suffix=AisFormatter.format('shiptype',item);
    return rt+"-"+suffix;

};

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
     * @type {olStroke}
     */
    this.textStyle ={};
    this.setStyles();

    this.symbolStyles={};

    this.createInternalIcons();

    /**
     * an array of pixel positions of the current ais data
     * @type {Array.<{pixel:olCoordinate,ais:{}}
     */
    this.pixel=[];

    /**
     *
     * @type {boolean}
     */
    this.visible=globalStore.getData(keys.properties.layers.ais);
    globalStore.register(this,keys.gui.global.propertySequence);
    this.computeTarget=this.computeTarget.bind(this);

};


/**
 * create an AIS icon using a 2d context
 * @param {string} color - the css color
 * @returns {*} - an image data uri
 */
AisLayer.prototype.createIcon=function(color,useCourseVector){
    let canvas = document.createElement("canvas");
    if (! canvas) return undefined;
    let offset=useCourseVector?0:200;
    canvas.width=100;
    canvas.height=offset+100;
    let ctx=canvas.getContext('2d');
    //drawing code created by http://www.professorcloud.com/svg-to-canvas/
    //from ais-nearest.svg
    ctx.strokeStyle = 'rgba(0,0,0,0)';
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    ctx.lineWidth=parseInt(globalStore.getData(keys.properties.aisIconBorderWidth,1));
    ctx.miterLimit = 4;
    ctx.fillStyle = color;
    ctx.strokeStyle = "#000000";
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(23.5, offset+97.875);
    ctx.lineTo(50, offset);
    ctx.lineTo(76.5, offset+97.875);
    ctx.lineTo(23.5, offset+97.875);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (! useCourseVector) {
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
    }
    return canvas.toDataURL();
};

/**
 * compute the icons for the AIS display
 * @private
 */
AisLayer.prototype.createInternalIcons = function () {
    let style = globalStore.getMultiple(keys.properties.style);
    let useCourseVector = globalStore.getData(keys.properties.aisUseCourseVector, false);
    let symbolStyle = useCourseVector ? this.targetStyleCourseVector : this.targetStyle;
    this.symbolStyles.internalnearest = new StyleEntry(
        this.createIcon(style.aisNearestColor, useCourseVector),
        assign({}, symbolStyle, {courseVectorColor: style.aisNearestColor}));

    this.symbolStyles.internalwarning = new StyleEntry(
        this.createIcon(style.aisWarningColor, useCourseVector),
        assign({}, symbolStyle, {courseVectorColor: style.aisWarningColor}));

    this.symbolStyles.internalnormal = new StyleEntry(
        this.createIcon(style.aisNormalColor, useCourseVector),
        assign({}, symbolStyle, {courseVectorColor: style.aisNormalColor}));

};
/**
 * find the AIS target that has been clicked
 * @param {olCoordinate} pixel the css pixel from the event
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
        fontSize: globalStore.getData(keys.properties.aisTextSize),
        fontBase: 'Calibri,sans-serif',
        offsetY: 15
    };
    this.targetStyle={
        anchor: [15, 60],
        size: [30,90],
        rotation: 0,
        rotateWithView: true
    };
    this.targetStyleCourseVector={
        anchor: [15, 0],
        size: [30,30],
        rotation: 0,
        rotateWithView: true
    };
};

/**
 *
 * @param item
 * @returns {StyleEntry}
 */
AisLayer.prototype.getStyleEntry=function(item){
    return mergeStyles(this.symbolStyles[styleKeyFromItem(item,true,true)],
        this.symbolStyles[styleKeyFromItem(item,true)],
        this.symbolStyles[styleKeyFromItem(item)]);
};

AisLayer.prototype.drawTargetSymbol=function(drawing,xy,current,computeTargetFunction){
    let courseVectorTime=globalStore.getData(keys.properties.navBoatCourseTime,0);
    let useCourseVector=globalStore.getData(keys.properties.aisUseCourseVector,false);
    let courseVectorWidth=globalStore.getData(keys.properties.navCircleWidth);
    let scale=globalStore.getData(keys.properties.aisIconScale,1);
    let rotation=current.course||0;
    let symbol=this.getStyleEntry(current);
    let style=assign({},symbol.style);
    if (scale != 1){
        style.size=[style.size[0]*scale,style.size[1]*scale];
        style.anchor=[style.anchor[0]*scale,style.anchor[1]*scale];
    }
    if (style.rotate !== undefined && ! style.rotate) {
        style.rotation = 0;
        style.rotateWithView=false;
    }
    else{
        style.rotation = rotation * Math.PI / 180;
        style.rotateWithView=true;
    }

    let curpix=drawing.drawImageToContext(xy,symbol.image,style);
    if (useCourseVector && style.courseVector !== false){
        let courseVectorDistance=(current.speed !== undefined)?current.speed*courseVectorTime:0;
        if (courseVectorDistance > 0){
            let other=computeTargetFunction(xy,rotation,courseVectorDistance);
            drawing.drawLineToContext([xy,other],{color:style.courseVectorColor,width:courseVectorWidth});
        }
    }
    return curpix;
};

/**
 *
 * @param {olCoordinate} center
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
        let curpix=this.drawTargetSymbol(drawing,pos,current,this.computeTarget);
        let text=current.shipname;
        if (! text || text == "unknown") text=current.mmsi;
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
    this.createInternalIcons();
    this.setStyles();
};


/**
 * compute a target point in map units from a given point
 * for drawing the circles
 * assumes "flatted" area around the point
 * @param {olCoordinate} pos in map coordinates
 * @param {number} course in degrees
 * @param {number} dist in m
 */
AisLayer.prototype.computeTarget=function(pos,course,dist){
    let point=new navobjects.Point();
    point.fromCoord(this.mapholder.transformFromMap(pos));
    let tp=NavCompute.computeTarget(point,course,dist);
    let tpmap=this.mapholder.transformToMap(tp.toCoord());
    return tpmap;
};
/**
 *
 * @param styles
 */
AisLayer.prototype.setImageStyles=function(styles){
    let names=['Normal','Warning','Nearest'];
    let allowedStyles={
        anchor:true,
        size: true,
        courseVectorColor: true,
        courseVector: true,
        rotate: true
    };
    for (let i in names){
        let name=names[i];
        let styleProp="ais"+name+"Image";
        if (typeof(styles[styleProp]) === 'object' ) {
            let style = styles[styleProp];
            this.symbolStyles[name.toLowerCase()] = new StyleEntry(
                style.src,
                Helper.filteredAssign(allowedStyles,style),
                true
            );
        }
        let re=new RegExp("^"+styleProp+"[-]");
        for (let k in styles){
            if (re.exec(k)){
                let suffix=k.replace(/.*[-]/,"");
                let styleKey=name.toLowerCase()+"-"+suffix;
                let dstyle=styles[k];
                if (typeof (dstyle) === 'object') {
                    this.symbolStyles[styleKey] = new StyleEntry(
                        dstyle.src,
                        Helper.filteredAssign(allowedStyles,dstyle),
                        true
                    )
                }
            }
        }
    }
};


export default AisLayer;
