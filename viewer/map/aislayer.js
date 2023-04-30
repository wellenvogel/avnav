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
import globalstore from "../util/globalstore";
import tinycolor from "tinycolor2";
import aisdefault from '../images/ais-default-noarrow.png'
import aisdefaultnv from '../images/ais-default.png'

const StyleEntry=function(src,style,fallback){
    this.src=src;
    this.style=style;
    let retries=0;
    if (src !== undefined) {
        this.image = new Image();
        this.image.onerror=()=>{
            if (retries) return;
            if (! fallback) return;
            this.image.src=fallback;
        }
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

AisLayer.prototype.adaptIconColor= function(src,fallback,originalColor,color){
    return new Promise((resolve,reject)=>{
        let canvas = document.createElement("canvas");
        if (! canvas) {
            reject("no canvas");
            return;
        }
        let orig=tinycolor(originalColor).toRgb();
        let target=tinycolor(color).toRgb();
        let image=new Image();
        let count=0;
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
            if (count) return;
            count++;
            image.src=fallback;
        }
        image.src=src;
    });
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
    this.symbolStyles.internaltracking = new StyleEntry(
        this.createIcon(style.aisTrackingColor, useCourseVector),
        assign({}, symbolStyle, {courseVectorColor: style.aisTrackingColor}));
};
/**
 * find the AIS target that has been clicked
 * @param {olCoordinate} pixel the css pixel from the event
 */
AisLayer.prototype.findTarget=function(pixel){
    base.log("findAisTarget "+pixel[0]+","+pixel[1]);
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
};

/**
 *
 * @param item
 * @returns {StyleEntry}
 */
AisLayer.prototype.getStyleEntry=function(item){
    let typeSuffix="-"+AisFormatter.format('shiptype',item);
    let statusSuffix=(item.status !== undefined)?"-status"+parseInt(item.status):undefined;
    let base=styleKeyFromItem(item);
    return mergeStyles(this.symbolStyles["internal"+base],
        this.symbolStyles[base],
        this.symbolStyles[base+typeSuffix],
        (statusSuffix!==undefined)?this.symbolStyles[base+statusSuffix]:undefined,
        (statusSuffix!==undefined)?this.symbolStyles[base+typeSuffix+statusSuffix]:undefined,
        );
};

AisLayer.prototype.drawTargetSymbol=function(drawing,xy,current,computeTargetFunction){
    let courseVectorTime=globalStore.getData(keys.properties.navBoatCourseTime,0);
    let useCourseVector=globalStore.getData(keys.properties.aisUseCourseVector,false);
    let courseVectorWidth=globalStore.getData(keys.properties.navCircleWidth);
    let scale=globalStore.getData(keys.properties.aisIconScale,1);
    let classbShrink=globalStore.getData(keys.properties.aisClassbShrink,1);
    let rotation=current.course||0;
    let symbol=this.getStyleEntry(current);
    let style=assign({},symbol.style);
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
    for (i in aisList){
        let current=aisList[i];
        let pos=current.mapPos;
        if (! pos){
            pos=this.mapholder.pointToMap((new navobjects.Point(current.lon,current.lat)).toCoord());
            current.mapPos=pos;
        }
        if (! pos || isNaN(pos[0]) || isNaN(pos[1])) {
            continue;
        }
        let curpix=this.drawTargetSymbol(drawing,pos,current,this.computeTarget);
        pixel.push({pixel:curpix,ais:current});
        let text=AisFormatter.format(firstLabel,current,true);
        if (text) {
            drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 0)));
        }
        if (secondLabel !== firstLabel) {
            text=AisFormatter.format(secondLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 1)));
            }
        }
        if (thirdLabel !== firstLabel && thirdLabel !== secondLabel){
            text=AisFormatter.format(thirdLabel,current,true);
            if (text) {
                drawing.drawTextToContext(pos, text, assign({}, this.textStyle, this.computeTextOffsets(current, 2)));
            }
        }
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
 * @param styles - the user images.json data
 */
AisLayer.prototype.setImageStyles=function(styles){
    let names=['Normal','Warning','Nearest','Tracking'];
    let allowedStyles={
        anchor:true,
        size: true,
        courseVectorColor: true,
        courseVector: true,
        rotate: true
    };
    let useCourseVector = globalStore.getData(keys.properties.aisUseCourseVector, false);
    let fallback=useCourseVector?aisdefault:aisdefaultnv;
    let iter=[''].concat(names);
    for (let i in iter){
        let name=iter[i];
        let styleProp="ais"+name+"Image";
        let re=new RegExp("^"+styleProp);
        for (let k in styles){
            if (re.exec(k)){
                let suffix=k.replace(re,"");
                let prefixes=name===''?names:[name];
                prefixes.forEach((prefix)=>{
                    let styleKey=prefix.toLowerCase()+suffix;
                    let dstyle=styles[k];
                    if (typeof (dstyle) === 'object') {
                        if (dstyle.replaceColor !== undefined){
                            let style = globalStore.getMultiple(keys.properties.style);
                            let targetColor=style['ais'+prefix+'Color'];
                            if (targetColor === undefined) {
                                return;
                            }
                            this.adaptIconColor(dstyle.src,fallback,dstyle.replaceColor,targetColor)
                                .then((icon)=>{
                                    this.symbolStyles[styleKey] = new StyleEntry(
                                        icon,
                                        Helper.filteredAssign(allowedStyles, dstyle)
                                    )
                                })
                        }
                        else {
                            this.symbolStyles[styleKey] = new StyleEntry(
                                dstyle.src,
                                Helper.filteredAssign(allowedStyles, dstyle),
                                fallback
                            )
                        }
                    }
                })
            }
        }
    }
};


export default AisLayer;
