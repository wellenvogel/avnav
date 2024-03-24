/**
 * Created by andreas on 18.05.14.
 */

import navobjects from '../nav/navobjects';
import keys, {KeyHelper} from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';
import base from '../base.js';
import assign from 'object-assign';
import NavCompute from '../nav/navcompute.js';
import AisFormatter, {AIS_CLASSES} from '../nav/aisformatter.jsx';
import Helper from '../util/helper.js';
import globalstore from "../util/globalstore";
import tinycolor from "tinycolor2";
import atonIcon from '../images/ais-aton.png';
import cloneDeep from 'clone-deep';

const DEFAULT_COLOR="#f7c204";

class StyleEntry {
    constructor(colorStyle, src, style, replaceColor) {
        this.src = src;
        this.style = style;
        this.loaded = false;
        this.image = undefined;
        this.ghostImage = undefined;
        this.color=undefined;
        this.ghostFactor=undefined;
        this.replaceColor=replaceColor;
        this.sequence=1;
        this.colorStyle=colorStyle;
    }

    load(ghostFactor) {
        if (this.src === undefined) return;
        let color=globalStore.getData(KeyHelper.keyNodeToString(keys.properties.style)+"."+this.colorStyle);
        if (! color) return;
        this.sequence++;
        let sequence=this.sequence;
        //what needs to be done?
        //load for the first time
        //or load with changing color or ghostFactor
        if (! this.loaded){
            //if we start a new load before done - just restart completely
            this.image=undefined;
            this.ghostImage=undefined;
        }
        if (this.image) {
            if (this.replaceColor !== undefined && this.color !== color) {
                this.image = undefined;
            }
        }
        if (this.image){
            if (ghostFactor === undefined){
                this.ghostFactor=undefined;
                this.ghostImage=undefined;
                return;
            }
            else{
                if (this.ghostFactor !== ghostFactor){
                    this.ghostImage=undefined;
                }
                else{
                    return;
                }
            }
        }
        this.loaded=false;
        this.color=color;
        this.ghostFactor=ghostFactor;
        if (! this.image){
            this.image = new Image();
            if (ghostFactor !== undefined ) {
                this.ghostImage = new Image();
                this.ghostImage.onload = () => {
                    if (sequence !== this.sequence) return;
                    this.loaded = true
                }
                this.image.onload = () => {
                    if (sequence !== this.sequence) return;
                    adaptOpacity(this.image, ghostFactor)
                        .then((ghostImage) => {
                            if (sequence !== this.sequence) return;
                            this.ghostImage.src = ghostImage;
                        })
                }
            } else {
                this.image.onload = () => {
                    if (sequence !== this.sequence) return;
                    this.loaded = true;
                }
            }
            if (this.replaceColor !== undefined) {
                adaptIconColor(this.src, this.replaceColor, color)
                    .then((adaptedSrc) => {
                        if (sequence !== this.sequence) return;
                        this.image.src = adaptedSrc;
                    })
            }
            else {
                this.image.src = this.src;
            }
        }
        else{
            //only re-compute the ghost image
            this.ghostImage = new Image();
            this.ghostImage.onload = () => {
                if (sequence !== this.sequence) return;
                this.loaded = true;
            }
            adaptOpacity(this.image, ghostFactor)
                        .then((ghostImage) => {
                            if (sequence !== this.sequence) return;
                            this.ghostImage.src = ghostImage;
                        })
        }

    }

}
const mergeStyles=function(){
    let rt={
        style:{}
    };
    for (let i=0;i< arguments.length;i++) {
        let other = arguments[i];
        if (!other) continue;
        if (other.src !== undefined) {
            //we skip all styles that have a source attribute
            //but there was no chance to load it
            if (! other.loaded) continue;
            rt.src = other.src;
            rt.image = other.image;
            rt.ghostImage = other.ghostImage;
        }
        assign(rt.style, other.style);
    }
    return rt;
};

const styleKeyFromItem=(item)=>{
    let rt="normal";
    if (item.mmsi === globalStore.getData(keys.nav.ais.trackedMmsi)){
        rt="tracking";
    }
    if (item.warning){
      rt="warning";
    }
    else{
        if (item.nearest){
            rt="nearest";
        }
    }
    return rt;

};

const adaptIconColor= (src,originalColor,color)=>{
    return new Promise((resolve,reject)=>{
        let canvas = document.createElement("canvas");
        if (! canvas) {
            reject("no canvas");
            return;
        }
        let orig=tinycolor(originalColor).toRgb();
        let target=tinycolor(color).toRgb();
        let image=new Image();
        image.onload=()=>{
            let ctx=canvas.getContext("2d");
            canvas.height=image.height;
            canvas.width=image.width;
            ctx.drawImage(image,0,0,image.width,image.height);
            let imgData=ctx.getImageData(0,0,image.width,image.height);
            let hasChanges=false;
            for (let i=0;i<imgData.data.length;i+=4){
                if (imgData.data[i] === orig.r &&
                    imgData.data[i+1] === orig.g &&
                    imgData.data[i+2] === orig.b){
                    hasChanges=true;
                    imgData.data[i]=target.r;
                    imgData.data[i+1]=target.g;
                    imgData.data[i+2]=target.b;
                }
            }
            if (hasChanges){
                ctx.putImageData(imgData,0,0);
            }
            resolve(canvas.toDataURL());
        }
        image.onerror=()=>{
            resolve('data:,error'); //invalid url, triggers fallback to next matching style
        }
        image.src=src;
    });
};

const adaptOpacity = (image, factor) => {
    return new Promise((resolve, reject) => {
        let canvas = document.createElement("canvas");
        if (!canvas) {
            reject("no canvas");
            return;
        }
        let ctx = canvas.getContext("2d");
        canvas.height = image.height;
        canvas.width = image.width;
        ctx.drawImage(image, 0, 0, image.width, image.height);
        if (factor !== 1 && factor > 0) {
            let imgData = ctx.getImageData(0, 0, image.width, image.height);
            for (let i = 0; i < imgData.data.length; i += 4) {
                let nv = Math.floor(imgData.data[i + 3] * factor);
                if (nv > 255) nv = 255;
                imgData.data[i + 3] = nv;
            }
            ctx.putImageData(imgData, 0, 0);
        }
        resolve(canvas.toDataURL());
    });
};

const estimatedImageOpacity=()=>{
    return globalStore.getData(keys.properties.aisShowEstimated,false)?
        globalStore.getData(keys.properties.aisEstimatedOpacity,0.4):undefined;
}
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
    this.atonStyles={};

    this.createInternalIcons();
    this.computeStyles();

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

const styleToProps={
    nearest: 'aisNearestColor',
    warning: 'aisWarningColor',
    tracking: 'aisTrackingColor',
    normal: 'aisNormalColor'
};

/**
 * compute the icons for the AIS display
 * @private
 */
AisLayer.prototype.createInternalIcons = function () {
    let style = globalStore.getMultiple(keys.properties.style);
    let useCourseVector = globalStore.getData(keys.properties.aisUseCourseVector, false);
    let symbolStyle = useCourseVector ? this.targetStyleCourseVector : this.targetStyle;
    let baseIcon=this.createIcon(DEFAULT_COLOR,useCourseVector);
    for (let key in styleToProps) {
        this.symbolStyles["internal"+key] = new StyleEntry(styleToProps[key],
            baseIcon,
            assign({}, symbolStyle, {courseVectorColor: style[styleToProps[key]]}),
            DEFAULT_COLOR);
        this.atonStyles["internal"+key] = new StyleEntry(styleToProps[key],
            atonIcon,
            assign({}, this.atonStyle, {courseVectorColor: style[styleToProps[key]]}),
            DEFAULT_COLOR);
    }
};
AisLayer.prototype.computeStyles=function(){
    let ghostFactor=estimatedImageOpacity();
    for (let k in this.symbolStyles){
        let style=this.symbolStyles[k];
        style.load(ghostFactor);
    }
    for (let k in this.atonStyles){
        let style=this.atonStyles[k];
        style.load(); //never have a ghost image
    }
}
/**
 * find the AIS target that has been clicked
 * @param {olCoordinate} pixel the css pixel from the event
 */
AisLayer.prototype.findTarget=function(pixel){
    base.log("findAisTarget "+pixel[0]+","+pixel[1]);
    if (! this.pixel) return undefined;
    let tolerance=globalStore.getData(keys.properties.clickTolerance)/2;
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
        offsetY: 15,
        align: 'left'
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
    this.atonStyle={
       anchor: [15, 15],
        size: [30,30],
        rotation: 0,
        rotateWithView: true
    }
};

/**
 *
 * @param item
 * @returns {StyleEntry}
 */
AisLayer.prototype.getStyleEntry=function(item){
    let cl=AisFormatter.format('clazz',item);
    let typeSuffix;
    let statusSuffix;
    if (cl === AIS_CLASSES.A || cl === AIS_CLASSES.B) {
        typeSuffix = "-" + AisFormatter.format('shiptype', item);
        statusSuffix = (item.status !== undefined) ? "-status" + parseInt(item.status) : undefined;
    }
    if (cl === AIS_CLASSES.Aton){
        typeSuffix="-type"+item.aid_type;
    }
    let base=styleKeyFromItem(item);
    let styleMap=(cl === AIS_CLASSES.Aton)?this.atonStyles:this.symbolStyles;
    return mergeStyles(styleMap["internal"+base],
        styleMap[base],
        (typeSuffix !== undefined)?styleMap[base+typeSuffix]:undefined,
        (statusSuffix!==undefined)?styleMap[base+statusSuffix]:undefined,
        (statusSuffix!==undefined)?styleMap[base+typeSuffix+statusSuffix]:undefined,
        );
};

const amul=(arr,fact)=>{
    if (! arr) return;
    for (let i=0;i<arr.length;i++){
        arr[i]=arr[i]*fact;
    }
}

AisLayer.prototype.drawTargetSymbol=function(drawing,xy,target,drawTargetFunction,drawEstimated){
    let courseVectorTime=globalStore.getData(keys.properties.navBoatCourseTime,0);
    let useCourseVector=globalStore.getData(keys.properties.aisUseCourseVector,false);
    let curved=globalStore.getData(keys.properties.aisCurvedVectors,false);
    let rmvRange=globalStore.getData(keys.properties.aisRelativeMotionVectorRange,0);
    let courseVectorWidth=globalStore.getData(keys.properties.navCircleWidth);
    let scale=globalStore.getData(keys.properties.aisIconScale,1);
    let classbShrink=globalStore.getData(keys.properties.aisClassbShrink,1);
    let useHeading=globalStore.getData(keys.properties.aisUseHeading,true);
    let lostTime=globalStore.getData(keys.properties.aisLostTime,0);
    let minDRspeed=globalStore.getData(keys.properties.aisMinDisplaySpeed,0);
    // own ship
    let lat=globalStore.getData(keys.nav.gps.lat,0);
    let lon=globalStore.getData(keys.nav.gps.lon,0);
    let cog=globalStore.getData(keys.nav.gps.course,0);
    let sog=globalStore.getData(keys.nav.gps.speed,0);
    // ais target
    let target_cog=target.course||0;
    let target_sog=target.speed||0;
    let target_hdg=(useHeading && target.heading!==undefined?target.heading:target.course)||0;
    let target_rot_sgn=Math.sign(target.turn||0);
    let target_rot=Math.abs(target.turn||0); // °/min
    curved = curved && isFinite(target_rot) && target_rot>0.5;

    let symbol=this.getStyleEntry(target);
    let style=cloneDeep(symbol.style);
    if (! symbol.image || ! style.size) return;
    if (style.alpha !== undefined){
        style.alpha=parseFloat(style.alpha);
        if (isNaN(style.alpha)) {
            style.alpha = undefined;
        }else{
            if (style.alpha < 0) style.alpha=0;
            if (style.alpha > 1) style.alpha=1;
        }
    }
    let hidden = target.hidden || lostTime && target.age>lostTime;
    if (hidden){
        style.alpha=0.2;
    }
    let now=(new Date()).getTime();
    if (classbShrink != 1 && AisFormatter.format('clazz',target) === 'B'){
        scale=scale*classbShrink;
    }
    if (scale != 1){
        amul(style.size,scale);
        amul(style.anchor,scale);
    }
    if (style.rotate !== undefined && ! style.rotate) {
        style.rotation = 0;
        style.rotateWithView=false;
    }else{
        style.rotation = Helper.radians(target_hdg);
        style.rotateWithView=true;
    }
    if(!hidden){
        let onMap=drawEstimated!==undefined; // true when drawing on map, false in ais info

        var drawArc=function(origin,center,radius,start,angle,style,shift_dir=0,shift_dst=0){
            // pass origin to mitigate error due to projection for large radii
            let segments=Math.max(3,Math.ceil(Math.abs(angle)/5));
            let da=angle/segments, dd=shift_dst/segments;
            let points=[];
            for(let i=0; i<=segments; i++){
                let p=i==0?origin:drawTargetFunction(center,start+i*da,radius);
                if (shift_dst) p=drawTargetFunction(p,shift_dir,i*dd);
                points.push(p);
            }
            drawing.drawLineToContext(points,style);
        };

        if (curved) {
            var turn_radius=target_sog/Helper.radians(target_rot)*60; // m, SOG=[m/s]
            var turn_center=drawTargetFunction(xy,target_cog+target_rot_sgn*90,turn_radius);
            var turn_angle=Helper.degrees(target_sog*courseVectorTime/turn_radius);
        }

        if (rmvRange>0 && onMap && style.courseVector !== false) { // relative motion vector
            let distance=NavCompute.computeDistance({lat:lat,lon:lon},{lat:target.lat,lon:target.lon}).dts/1852;
            if (distance<=rmvRange && (target_sog || sog)) {
                if (curved) {
                    drawArc(xy,turn_center,turn_radius,target_cog-target_rot_sgn*90,target_rot_sgn*turn_angle,
                            {color:style.courseVectorColor,width:courseVectorWidth,dashed:true},
                            cog,-sog*courseVectorTime);
                } else {
                    let p=drawTargetFunction(xy,target_cog,target_sog*courseVectorTime);
                    p=drawTargetFunction(p,cog,-sog*courseVectorTime);
                    drawing.drawLineToContext([xy,p],{color:style.courseVectorColor,width:courseVectorWidth,dashed:true});
                }
            }
        }

        if (useCourseVector && style.courseVector !== false) {
            if (target_sog) { // true motion vector
                if(curved && onMap) { // curved TMV
                    //drawing.drawLineToContext([xy,drawTargetFunction(xy,target_cog+target_rot_sgn*90,100)],{color:"black",width:courseVectorWidth});
                    drawArc(xy,turn_center,turn_radius,target_cog-target_rot_sgn*90,target_rot_sgn*turn_angle,
                            {color:style.courseVectorColor,width:courseVectorWidth});
                } else {
                    let p=drawTargetFunction(xy,target_cog,target_sog*courseVectorTime);
                    drawing.drawLineToContext([xy,p],{color:style.courseVectorColor,width:courseVectorWidth});
                }
            }
        }

        if (drawEstimated && symbol.ghostImage && target_sog >= minDRspeed){ // DR position of target
            let age=target.age+Math.max(0,(now-target.receiveTime)/1000);
            if (curved) {
                let a=Helper.degrees(target_sog*age/turn_radius);
                var pos=drawTargetFunction(turn_center,target_cog-target_rot_sgn*(90-a),turn_radius);
                //if (style.rotateWithView) { style.rotation+=Helper.radians(target_rot_sgn*a); } // TODO rotate DR icon only
            } else {
                var pos=drawTargetFunction(xy,target_cog,target_sog*age);
            }
            drawing.drawImageToContext(pos,symbol.ghostImage,style);
        }
    }
    let curpix=drawing.drawImageToContext(xy,symbol.image,style);
    return {pix:curpix, scale:scale, style: style};
};

AisLayer.prototype.computeTextOffsets=function(drawing, target,textIndex, opt_baseOffset,opt_iconScale){
    let scale=(opt_iconScale === undefined)?1:opt_iconScale;
    let rt=[opt_baseOffset?opt_baseOffset[0]:10,opt_baseOffset?opt_baseOffset[1]:0];
    amul(rt,scale);
    amul(rt,drawing.getDevPixelRatio()); //images are always scaled
    let hoffset=Math.floor(this.textStyle.fontSize * 1.2); //https://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
    if (drawing.getUseHdpi()){
        hoffset*=drawing.getDevPixelRatio();
    }
    if (! target.course || (0 <= target.course  &&  target.course < 90 )){
        rt[1]+=(textIndex+0.5)*hoffset;
    }
    else{
        if (target.course >= 90 && target.course < 180){
            rt[1]+=-(textIndex+0.5)*hoffset;
        }
        if (target.course >= 180 && target.course < 270){
            rt[1]+=(textIndex+0.5)*hoffset;
        }
        if (target.course >= 270 && target.course < 360){
            rt[1]+=-(textIndex+0.5)*hoffset;
        }
    }
    //as the offsets will be multiplied with devPixelRatio later on we need to devide...
    amul(rt,1/drawing.getDevPixelRatio());
    return {offsetX:rt[0],offsetY:rt[1]};
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
    let firstLabel=globalStore.getData(keys.properties.aisFirstLabel,'');
    let secondLabel=globalStore.getData(keys.properties.aisSecondLabel,'');
    let thirdLabel=globalStore.getData(keys.properties.aisThirdLabel,'');
    let drawEstimated=globalStore.getData(keys.properties.aisShowEstimated,false);
    for (i in aisList){
        let current=aisList[i];
        let alpha={alpha: current.hidden?0.2:undefined};
        let pos=current.mapPos;
        if (! pos){
            pos=this.mapholder.pointToMap((new navobjects.Point(current.lon,current.lat)).toCoord());
            current.mapPos=pos;
        }
        if (! pos || isNaN(pos[0]) || isNaN(pos[1])) {
            continue;
        }
        let drawn=this.drawTargetSymbol(drawing,pos,current,this.computeTarget, drawEstimated);
        pixel.push({pixel:drawn.pix,ais:current});
        let textOffsetScale=drawn.scale;
        let text=AisFormatter.format(firstLabel,current,true);
        if (text) {
            drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(drawing,current, 0,drawn.style.textOffset,textOffsetScale),alpha));
        }
        if (secondLabel !== firstLabel) {
            text=AisFormatter.format(secondLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(drawing,current, 1,drawn.style.textOffset,textOffsetScale),alpha));
            }
        }
        if (thirdLabel !== firstLabel && thirdLabel !== secondLabel){
            text=AisFormatter.format(thirdLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(drawing,current, 2,drawn.style.textOffset,textOffsetScale),alpha));
            }
        }
    }
    this.pixel=pixel;
};
/**
 * handle changed properties
 * @param evdata
 */
AisLayer.prototype.dataChanged=function(evdata){
    this.visible=globalStore.getData(keys.properties.layers.ais);
    this.setStyles();
    this.createInternalIcons();
    this.computeStyles();

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
    try {
        let point = new navobjects.Point();
        point.fromCoord(this.mapholder.transformFromMap(pos));
        let tp = NavCompute.computeTarget(point, course, dist,globalstore.getData(keys.nav.routeHandler.useRhumbLine));
        let tpmap = this.mapholder.transformToMap(tp.toCoord());
        return tpmap;
    }catch (e){
        return [0,0];
    }
};
/**
 * parse the user image styles
 * we can handle the following style entries:
 * aisImage
 * aisNearestImage, aisNormalImage, aisWarningImage, aisTrackingImage
 * aisXXXImage-<shiptype> - e.g. aisNormalImage-Sail or aisImage-Sail
 * aisXXXImage-status<status> - e.g. aisImage-status5 for moored
 * aisXXXImage-<shiptype>-status<status> - e.g. aisImage-Sail-status5
 * aisatonXXXImage-type<aid_type> - e.g. aisatonImage-type9
 * for all styles you can provied the following entries:
 * src: an PNG/JPG icon url
 * anchor: [x,y] image anchor (i.e. where to position the image)
 * size: [width,height] image size
 * courseVectorColor: color - if given use this color for the course vector insetad of the default colors
 * courseVector: true|false - show/do not show a course vector
 * rotate: true|false - rotate by the ship course
 * replaceColor: color - if given, this color will be replaced by the user selected normal/tracking/nearest/warning color
 *               this way you can use the same icon image for all 4 display modes
 * whenever a style contains a src attribute but the source could not be loaded,
 * this style will be skipped completely and we fall back to the next matching (ending at the internal basic styles)
 * @param styles - the user images.json data
 */
AisLayer.prototype.setImageStyles=function(styles){
    let styleMaps={
        symbolStyles:'',
        atonStyles:'aton'
    };
    for (let styleMap in styleMaps) {
        let stylePrefix=styleMaps[styleMap];
        let names = ['Normal', 'Warning', 'Nearest', 'Tracking'];
        let allowedStyles = {
            anchor: true,
            size: true,
            courseVectorColor: true,
            courseVector: true,
            rotate: true,
            alpha: true,
            textOffset: true
        };
        let iter = [''].concat(names);
        for (let i in iter) {
            let name = iter[i];
            let styleProp = "ais"+stylePrefix + name + "Image";
            let re = new RegExp("^" + styleProp);
            for (let k in styles) {
                if (re.exec(k)) {
                    let suffix = k.replace(re, "");
                    let prefixes = name === '' ? names : [name];
                    prefixes.forEach((prefix) => {
                        let styleKey = prefix.toLowerCase() + suffix;
                        let dstyle = styles[k];
                        if (typeof (dstyle) === 'object') {
                            this[styleMap][styleKey] = new StyleEntry(
                                'ais' + prefix + 'Color',
                                dstyle.src,
                                Helper.filteredAssign(allowedStyles, dstyle),
                                dstyle.replaceColor);
                        }
                    });
                }
            }
        }
    }
    this.computeStyles();
};


export default AisLayer;
