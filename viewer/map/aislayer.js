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

const DEFAULT_COLOR="#f7c204";

class StyleEntry {
    constructor(colorStyle,src, style, replaceColor) {
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

AisLayer.prototype.drawTargetSymbol=function(drawing,xy,current,computeTargetFunction,drawEstimated){
    let courseVectorTime=globalStore.getData(keys.properties.navBoatCourseTime,0);
    let useCourseVector=globalStore.getData(keys.properties.aisUseCourseVector,false);
    let courseVectorWidth=globalStore.getData(keys.properties.navCircleWidth);
    let scale=globalStore.getData(keys.properties.aisIconScale,1);
    let classbShrink=globalStore.getData(keys.properties.aisClassbShrink,1);
    let useHeading=globalStore.getData(keys.properties.aisUseHeading,false);
    let rotation=current.course||0;
    let symbol=this.getStyleEntry(current);
    let style=assign({},symbol.style);
    if (! symbol.image || ! style.size) return;
    if (style.alpha !== undefined){
        style.alpha=parseFloat(style.alpha);
        if (isNaN(style.alpha)) {
            style.alpha = undefined;
        }
        else{
            if (style.alpha < 0) style.alpha=0;
            if (style.alpha > 1) style.alpha=1;
        }
    }
    if (current.hidden){
        style.alpha=0.2;
    }
    let now=(new Date()).getTime();
    if (classbShrink != 1 && AisFormatter.format('clazz',current) === 'B'){
        scale=scale*classbShrink;
    }
    if (scale != 1){
        style.size=[style.size[0]*scale,style.size[1]*scale];
        style.anchor=[style.anchor[0]*scale,style.anchor[1]*scale];
    }
    if (style.rotate !== undefined && ! style.rotate) {
        style.rotation = 0;
        style.rotateWithView=false;
    }
    else{
        if (useHeading && current.heading !== undefined){
            style.rotation=current.heading * Math.PI/180;
        }
        else {
            style.rotation = rotation * Math.PI / 180;
        }
        style.rotateWithView=true;
    }
    if (drawEstimated && symbol.ghostImage){
        if ((current.speed||0) >= globalStore.getData(keys.properties.aisMinDisplaySpeed) && current.age > 0){
            let age=current.age;
            if (current.receiveTime < now){
                age+=(now-current.receiveTime)/1000;
            }
            let ghostPos=computeTargetFunction(xy,rotation,current.speed*age);
            drawing.drawImageToContext(ghostPos,symbol.ghostImage,style);
        }
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

AisLayer.prototype.computeTextOffsets=function(target,textIndex){
    let rt={
        offsetX:0,
        offsetY:0
    };
    let hoffset=Math.floor(this.textStyle.fontSize * 1.0);
    let base=10;
    if (! target.course || 315 < target.course  ||  target.course < 45 ){
        //above
        rt.offsetY=-base-textIndex*hoffset;
    }
    else{
        if (target.course >= 45 && target.course <= 135){
            rt.offsetX=base;
            rt.offsetY=-hoffset+textIndex*hoffset;
        }
        if (target.course > 135 && target.course < 225){
            rt.offsetY=base+textIndex*hoffset;
        }
        if (target.course >= 225 && target.course <= 315){
            rt.offsetX=-base;
            rt.offsetY=-hoffset+textIndex*hoffset;
        }
    }
    return rt;
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
        let curpix=this.drawTargetSymbol(drawing,pos,current,this.computeTarget, drawEstimated);
        pixel.push({pixel:curpix,ais:current});
        let text=AisFormatter.format(firstLabel,current,true);
        if (text) {
            drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 0),alpha));
        }
        if (secondLabel !== firstLabel) {
            text=AisFormatter.format(secondLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 1),alpha));
            }
        }
        if (thirdLabel !== firstLabel && thirdLabel !== secondLabel){
            text=AisFormatter.format(thirdLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 2),alpha));
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
    for (let styleMap in styles) {
        let stylePrefix=styleMaps[styleMap];
        let names = ['Normal', 'Warning', 'Nearest', 'Tracking'];
        let allowedStyles = {
            anchor: true,
            size: true,
            courseVectorColor: true,
            courseVector: true,
            rotate: true,
            alpha: true
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
