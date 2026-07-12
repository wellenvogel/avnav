/**
 * Created by andreas on 18.05.14.
 */

import navobjects, {Point} from '../nav/navobjects';
import keys, {KeyHelper} from '../util/keys';
import globalStore from '../util/globalstore';
import base from '../base';
// @ts-ignore
import NavCompute from '../nav/navcompute.js';
import AisFormatter, {AIS_CLASSES, aisproxy} from '../nav/aisformatter';
import Helper from '../util/helper';
import tinycolor from "tinycolor2";
// @ts-ignore
import atonIcon from '../images/ais-aton.png';
// @ts-ignore
import cloneDeep from 'clone-deep';
// @ts-ignore
import {CourseVector, AisOptionMappings} from "../nav/aiscomputations";
// @ts-ignore
import {fillOptions} from "../nav/aisdata";
import {AisFeatureInfo} from "./featureInfo";
import {Drawing, LineStyle, MapHolder} from "./maptypes";
import { LatLon } from '../api/geo';
import {AisProxyItem} from '../nav/aistypes';
import {Coordinate} from "ol/coordinate.js";

const DEFAULT_COLOR="#f7c204";

export interface TextStyle{
    stroke?: string,
    color?: string,
    width?: number,
    fontSize?: number,
    fontBase?: string
    offsetY?: number
    align?: 'left'|'right'
}
interface TargetStyle{
    anchor?: [number, number],
    size?: [number, number],
    rotation?: number,
    rotateWithView?: boolean
}

/**
 * AIS-specific display style extending image style with AIS vector properties
 */
interface AisDisplayStyle {
    courseVector?: boolean;      // Whether to draw course vector (true/false)
    courseVectorColor?: string;  // Color for course vector lines
    textOffset?: boolean | [number, number];  // Text offset for AIS target labels (true for default or [x, y] tuple)
    // Inherited from ImageStyle
    anchor?: [number, number];
    size?: [number, number];
    rotation?: number;
    rotateWithView?: boolean;
    fixX?: number;
    fixY?: number;
    alpha?: number;
    background?: string;
    backgroundAlpha?: number;
    backgroundCircle?: string;
}

type AisOptions=Partial<Record<keyof AisOptionMappings,any>>;
class StyleEntry {
    src: string;
    private replaceColor: string;
    private ghostFactor: number;
    loaded: boolean;
    private sequence: number;
    private colorStyle: string;
    image: HTMLImageElement;
    ghostImage: HTMLImageElement;
    private color: string;
    style: Partial<AisDisplayStyle>;
    constructor(colorStyle?:string, src?:string, style?:Partial<AisDisplayStyle>, replaceColor?:string) {
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

    load(ghostFactor?:number) {
        if (this.src === undefined) return;
        const color=globalStore.getData(KeyHelper.keyNodeToString(keys.properties.style)+"."+this.colorStyle);
        if (! color) return;
        this.sequence++;
        const sequence=this.sequence;
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
const mergeStyles=function(...args:StyleEntry[]){
    const rt:StyleEntry=new StyleEntry();
    rt.style={};
    for (let i=0;i< args.length;i++) {
        const other = args[i];
        if (!other) continue;
        if (other.src !== undefined) {
            //we skip all styles that have a source attribute
            //but there was no chance to load it
            if (! other.loaded) continue;
            rt.src = other.src;
            rt.image = other.image;
            rt.ghostImage = other.ghostImage;
        }
        Object.assign(rt.style, other.style);
    }
    return rt;
};

const styleKeyFromItem=(item:AisProxyItem)=>{
    let rt="normal";
    if (item.mmsi === globalStore.getData(keys.nav.ais.trackedMmsi)){
        rt="tracking";
    }
    if ((item.warning && globalStore.getData(keys.properties.aisMarkAllWarning))||
        item.nextWarning){
      rt="warning";
    }
    else{
        if (item.nearest){
            rt="nearest";
        }
    }
    return rt;

};

const adaptIconColor= (src:string,originalColor:string,color:string):Promise<string>=>{
    return new Promise((resolve,reject)=>{
        const canvas = document.createElement("canvas");
        if (! canvas) {
            reject("no canvas");
            return;
        }
        const orig=tinycolor(originalColor).toRgb();
        const target=tinycolor(color).toRgb();
        const image=new Image();
        image.onload=()=>{
            const ctx=canvas.getContext("2d");
            canvas.height=image.height;
            canvas.width=image.width;
            ctx.drawImage(image,0,0,image.width,image.height);
            const imgData=ctx.getImageData(0,0,image.width,image.height);
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

const adaptOpacity = (image:HTMLImageElement, factor:number):Promise<string> => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        if (!canvas) {
            reject("no canvas");
            return;
        }
        const ctx = canvas.getContext("2d");
        canvas.height = image.height;
        canvas.width = image.width;
        ctx.drawImage(image, 0, 0, image.width, image.height);
        if (factor !== 1 && factor > 0) {
            const imgData = ctx.getImageData(0, 0, image.width, image.height);
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
const styleToProps:Record<string,string>={
    nearest: 'aisNearestColor',
    warning: 'aisWarningColor',
    tracking: 'aisTrackingColor',
    normal: 'aisNormalColor'
};
const amul=(arr:number[],fact:number)=>{
    if (! arr) return;
    for (let i=0;i<arr.length;i++){
        arr[i]=arr[i]*fact;
    }
}
interface DisplayOptions{
    classbShrink?:number,
    scale?:number,
    useHeading?:boolean,
    courseVectorWidth?:number
}
/**
 * a cover for the layer with the AIS display
 * @param {MapHolder} mapholder
 * @constructor
 */
type StyleMap=Record<string,StyleEntry>;
class AisLayer{
    private textStyle: TextStyle;
    private targetStyle: TargetStyle;
    private targetStyleCourseVector: TargetStyle;
    private atonStyle: TargetStyle;
    private mapholder: MapHolder;
    pixel: { pixel:Coordinate,ais:AisProxyItem }[];
    private visible: boolean;
    private symbolStyles:StyleMap;
    private atonStyles: StyleMap;
    private displayOptions:DisplayOptions;
    private aisoptions:AisOptions;
    constructor(mapholder:MapHolder) {
        /**
         * @private
         * @type {MapHolder}
         */
        this.mapholder = mapholder;

        /**
         * @private
         * @type {olStroke}
         */
        this.textStyle = {};
        this.setStyles();

        this.symbolStyles = {};
        this.atonStyles = {};

        this.createInternalIcons();
        this.computeStyles();

        /**
         * an array of pixel positions of the current ais data
         * @type {Array.<{pixel:olCoordinate,ais:{}}
         */
        this.pixel = [];

        /**
         *
         * @type {boolean}
         */
        this.visible = globalStore.getData(keys.properties.layers.ais);
        globalStore.register(this, [keys.gui.global.propertySequence,keys.gui.global.fontFamily]);
        this.computeTarget = this.computeTarget.bind(this);
        /**
         *
         * @type {Object} see {@link AisOptionMappings}
         */
        this.aisoptions = {};
        this.displayOptions = {};
        this.fillOptions();
    }


    /**
     /**
     * create an AIS icon using a 2d context
     * @param {string} color - the css color
     * @param useCourseVector
     * @returns {*} - an image data uri
     */
    createIcon(color:string, useCourseVector:boolean) {
        const canvas = document.createElement("canvas");
        if (!canvas) return undefined;
        const offset = useCourseVector ? 0 : 200;
        canvas.width = 100;
        canvas.height = offset + 100;
        const ctx = canvas.getContext('2d');
        //drawing code created by http://www.professorcloud.com/svg-to-canvas/
        //from ais-nearest.svg
        ctx.strokeStyle = 'rgba(0,0,0,0)';
        ctx.lineCap = 'butt';
        ctx.lineJoin = 'miter';
        ctx.lineWidth = parseInt(globalStore.getData(keys.properties.aisIconBorderWidth, 1));
        ctx.miterLimit = 4;
        ctx.fillStyle = color;
        ctx.strokeStyle = "#000000";
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.beginPath();
        ctx.moveTo(23.5, offset + 97.875);
        ctx.lineTo(50, offset);
        ctx.lineTo(76.5, offset + 97.875);
        ctx.lineTo(23.5, offset + 97.875);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        if (!useCourseVector) {
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
    }


    /**
     * compute the icons for the AIS display
     * @private
     */
    createInternalIcons() {
        const style = globalStore.getMultiple(keys.properties.style);
        const useCourseVector = globalStore.getData(keys.properties.aisUseCourseVector, false);
        const symbolStyle = useCourseVector ? this.targetStyleCourseVector : this.targetStyle;
        const baseIcon = this.createIcon(DEFAULT_COLOR, useCourseVector);
        for (const key in styleToProps) {
            this.symbolStyles["internal" + key] = new StyleEntry(styleToProps[key],
                baseIcon,
                {...symbolStyle, courseVectorColor: style[styleToProps[key]]},
                DEFAULT_COLOR);
            this.atonStyles["internal" + key] = new StyleEntry(styleToProps[key],
                atonIcon,
                {...this.atonStyle, courseVectorColor: style[styleToProps[key]]},
                DEFAULT_COLOR);
        }
    }

    computeStyles() {
        const ghostFactor = estimatedImageOpacity();
        for (const k in this.symbolStyles) {
            const style = this.symbolStyles[k];
            style.load(ghostFactor);
        }
        for (const k in this.atonStyles) {
            const style = this.atonStyles[k];
            style.load(); //never have a ghost image
        }
    }

    /**
     * find the AIS target that has been clicked
     * @param {olCoordinate} pixel the css pixel from the event
     */
    findFeatures(pixel:Coordinate) {
        base.log("findAisTarget " + pixel[0] + "," + pixel[1]);
        if (!this.pixel) return [];
        const firstLabel = globalStore.getData(keys.properties.aisFirstLabel, '');
        const tolerance = globalStore.getData(keys.properties.clickTolerance) / 2;
        const idxlist = this.mapholder.findTargets(pixel, this.pixel, tolerance);
        const targetList:AisFeatureInfo[]=[];
        const foundMmsis:Record<string,boolean>={};
        idxlist.forEach((idx)=>{
            const target=this.pixel[idx];
            if (target && target.ais && target.ais.mmsi){
                if (foundMmsis[target.ais.mmsi]) return;
                foundMmsis[target.ais.mmsi]=true;
                const featureInfo=new AisFeatureInfo({point:(new Point()).fromPlain(target.ais.receivedPos),mmsi:target.ais.mmsi});
                featureInfo.title = AisFormatter.format(firstLabel, target.ais, true);
                const [, symbol, ] = this.getStyleEntry(target.ais);
                if (symbol && symbol.image) featureInfo.icon=symbol.image;
                targetList.push(featureInfo)
            }
        })
        return targetList;
    }


    setStyles() {
        this.textStyle = {
            stroke: globalStore.getData(keys.properties.fontShadowColor),
            color: globalStore.getData(keys.properties.fontColor),
            width: globalStore.getData(keys.properties.fontShadowWidth),
            fontSize: globalStore.getData(keys.properties.aisTextSize),
            fontBase: globalStore.getData(keys.gui.global.fontFamily),
            offsetY: 15,
            align: 'left'
        };
        this.targetStyle = {
            anchor: [15, 60],
            size: [30, 90],
            rotation: 0,
            rotateWithView: true
        };
        this.targetStyleCourseVector = {
            anchor: [15, 0],
            size: [30, 30],
            rotation: 0,
            rotateWithView: true
        };
        this.atonStyle = {
            anchor: [15, 15],
            size: [30, 30],
            rotation: 0,
            rotateWithView: true
        }
    }

    /**
     *
     * @param item
     * @returns {StyleEntry}
     */
    getStyleEntry(item:AisProxyItem):[AisDisplayStyle,StyleEntry,number] {
        const WILDCARD_STATUS="-status*";
        const cl = AisFormatter.format('clazz', item);
        let typeSuffix;
        let statusSuffix;
        if (cl === AIS_CLASSES.A || cl === AIS_CLASSES.B) {
            typeSuffix = "-" + AisFormatter.format('shiptype', item);
            statusSuffix = (item.status !== undefined) ? "-status" + Number(item.status) : undefined;
        }
        if (cl === AIS_CLASSES.Aton) {
            typeSuffix = "-type" + item.aid_type;
        }
        const base = styleKeyFromItem(item);
        const styleMap = (cl === AIS_CLASSES.Aton) ? this.atonStyles : this.symbolStyles;
        const symbol = mergeStyles(styleMap["internal" + base],
            styleMap[base],
            (typeSuffix !== undefined) ? styleMap[base + typeSuffix] : undefined,
            (statusSuffix !== undefined) ? styleMap[base + statusSuffix] : undefined,
            (typeSuffix !== undefined) ? styleMap[base+typeSuffix+WILDCARD_STATUS]:undefined,
            (statusSuffix !== undefined && typeSuffix !== undefined) ? styleMap[base + typeSuffix + statusSuffix] : undefined,
        );
        const style = cloneDeep(symbol.style);
        if (!symbol.image || !style.size) {
            //even the internal style has not been loaded yet...
            return [undefined, undefined, 1];
        }
        if (style.alpha !== undefined) {
            style.alpha = parseFloat(style.alpha);
            if (isNaN(style.alpha)) {
                style.alpha = undefined;
            } else {
                if (style.alpha < 0) style.alpha = 0;
                if (style.alpha > 1) style.alpha = 1;
            }
        }
        const hidden = item.hidden || item.lost;
        if (hidden) {
            style.alpha = 0.2;
        }
        let scale = this.displayOptions.scale;
        if (this.displayOptions.classbShrink != 1 && AisFormatter.format('clazz', item) === 'B') {
            scale = scale * this.displayOptions.classbShrink;
        }
        if (scale != 1) {
            amul(style.size, scale);
            amul(style.anchor, scale);
        }
        if (style.rotate !== undefined && !style.rotate) {
            style.rotation = 0;
            style.rotateWithView = false;
        } else {
            const target_hdg = (this.displayOptions.useHeading && item.heading !== undefined ? item.heading : item.course) || 0;
            style.rotation = Helper.radians(target_hdg);
            style.rotateWithView = true;
        }
        return [style, symbol, scale]
    }


    /**
     *
     * @param drawing
     * @param target
     * @returns {{rot: (*|number), scale: *, style: *, pix}}
     */
    drawTargetSymbol(drawing:Drawing, target:AisProxyItem) {
        if (!target.shouldHandle) return;
        const useCourseVector = !!target.courseVector;
        const target_hdg = (this.displayOptions.useHeading && target.heading !== undefined ? target.heading : target.course) || 0;
        const [style, symbol, scale] = this.getStyleEntry(target);
        if (! style || ! symbol) return;
        if (!target.hidden) {
            const drawArc = (origin:LatLon, center:LatLon, radius:number, start:number, angle:number, style:LineStyle, shift_dir = 0, shift_dst = 0) => {
                // pass origin to mitigate error due to projection for large radii
                const segments = Math.max(3, Math.ceil(Math.abs(angle) / 5));
                const da = angle / segments, dd = shift_dst / segments;
                const points = [];
                for (let i = 0; i <= segments; i++) {
                    let p = i == 0 ? origin : NavCompute.computeTarget(center, start + i * da, radius, this.aisoptions.useRhumbLine);
                    if (shift_dst) p = NavCompute.computeTarget(p, shift_dir, i * dd, this.aisoptions.useRhumbLine);
                    points.push(this.pointToMap(p));
                }
                drawing.drawLineToContext(points, style);
            };

            if (target.rmv && style.courseVector !== false) { // relative motion vector
                if (target.rmv.type === CourseVector.T_ARC) {
                    drawArc(target.rmv.start,
                        target.rmv.center,
                        target.rmv.radius,
                        target.rmv.startAngle,
                        target.rmv.arc,
                        {
                            color: style.courseVectorColor,
                            width: this.displayOptions.courseVectorWidth,
                            dashed: true,
                            alpha: style.alpha
                        },
                        target.rmv.offsetDir, target.rmv.offsetDst);
                } else {
                    drawing.drawLineToContext([this.pointToMap(target.rmv.start), this.pointToMap(target.rmv.end)], {
                        color: style.courseVectorColor,
                        width: this.displayOptions.courseVectorWidth,
                        dashed: true,
                        alpha: style.alpha
                    });
                }
            }


            if (useCourseVector && style.courseVector !== false) {
                if (target.courseVector.type === CourseVector.T_ARC) { // curved TMV
                    //drawing.drawLineToContext([xy,drawTargetFunction(xy,target_cog+target_rot_sgn*90,100)],{color:"black",width:courseVectorWidth});
                    drawArc(
                        target.courseVector.start,
                        target.courseVector.center,
                        target.courseVector.radius,
                        target.courseVector.startAngle,
                        target.courseVector.arc,
                        {
                            color: style.courseVectorColor,
                            width: this.displayOptions.courseVectorWidth,
                            alpha: style.alpha
                        });
                } else {
                    drawing.drawLineToContext([
                        this.pointToMap(target.courseVector.start),
                        this.pointToMap(target.courseVector.end)
                    ], {
                        color: style.courseVectorColor,
                        width: this.displayOptions.courseVectorWidth,
                        alpha: style.alpha
                    });
                }
                if (target.fromEstimated) {
                    drawing.drawLineToContext([
                        this.pointToMap(target.receivedPos),
                        this.pointToMap(target.courseVector.start)
                    ], {
                        color: style.courseVectorColor,
                        width: this.displayOptions.courseVectorWidth,
                        alpha: style.alpha
                    })
                }
            }

            if (symbol.ghostImage && target.estimated) { // DR position of target
                const curpix = drawing.drawImageToContext(this.pointToMap(target.estimated), symbol.ghostImage, style);
                this.pixel.push({pixel: curpix, ais: target});
            }
        }
        const curpix = drawing.drawImageToContext(this.pointToMap(target.receivedPos), symbol.image, style);
        this.pixel.push({pixel: curpix, ais: target});
        return {scale: scale, style: style, rot: target_hdg};
    }

    computeTextOffsets(drawing:Drawing, targetRot:number, textIndex:number, numLabels:number, opt_baseOffset?:boolean | [number,number], opt_iconScale?:number) {
        const scale = (opt_iconScale === undefined) ? 1 : opt_iconScale;
        const rt = [(typeof opt_baseOffset === 'object' ? opt_baseOffset[0] : 10), (typeof opt_baseOffset === 'object' ? opt_baseOffset[1] : 0)];
        amul(rt, scale);
        amul(rt, drawing.getDevPixelRatio()); //images are always scaled
        let hoffset = Math.floor(this.textStyle.fontSize * 1.2); //https://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
        if (drawing.getUseHdpi()) {
            hoffset *= drawing.getDevPixelRatio();
        }
        let course = targetRot;
        if (course) {
            while (course >= 360) course -= 360;
            while (course < 0) course += 360;
        }
        if (!course || (0 <= course && course < 90)) {
            rt[1] += (textIndex + 0.5) * hoffset;
        } else {
            if (course >= 90 && course < 180) {
                rt[1] += -((numLabels-textIndex) + 0.5) * hoffset;
            }
            if (course >= 180 && course < 270) {
                rt[1] += (textIndex + 0.5) * hoffset;
            }
            if (course >= 270 && course < 360) {
                rt[1] += -((numLabels-textIndex) + 0.5) * hoffset;
            }
        }
        //as the offsets will be multiplied with devPixelRatio later on we need to devide...
        amul(rt, 1 / drawing.getDevPixelRatio());
        return {offsetX: rt[0], offsetY: rt[1]};
    }

    /**
     *
     * @param {olCoordinate} center
     * @param {Drawing} drawing
     */
    onPostCompose(_center:Coordinate, drawing:Drawing) {
        if (!this.visible) return;
        let i;
        this.pixel = [];
        const aisList = globalStore.getData(keys.nav.ais.list, []);
        const firstLabel = globalStore.getData(keys.properties.aisFirstLabel, '');
        const secondLabel = globalStore.getData(keys.properties.aisSecondLabel, '');
        const thirdLabel = globalStore.getData(keys.properties.aisThirdLabel, '');
        for (i in aisList) {
            const current = aisproxy(aisList[i]);
            const alpha = {alpha: current.hidden ? 0.2 : undefined};
            const pos = this.pointToMap(current.receivedPos);
            const drawn = this.drawTargetSymbol(drawing, current);
            if (!drawn) continue;
            const textOffsetScale = drawn.scale;
            const aisLables:string[]=[];
            const text = AisFormatter.format(firstLabel, current, true);
            if (text) aisLables.push(text);
            const text2= (secondLabel != firstLabel)?AisFormatter.format(secondLabel, current, true):undefined;
            if (text2) aisLables.push(text2);
            const text3= (thirdLabel !== firstLabel && thirdLabel !== secondLabel)?AisFormatter.format(thirdLabel, current, true):undefined;
            if (text3) aisLables.push(text3);
            const numLabels=aisLables.length;
            for (let i=0;i<numLabels;i++){
                drawing.drawTextToContext(pos, aisLables[i], {...this.textStyle,
                    ...this.computeTextOffsets(drawing, drawn.rot, i, numLabels,drawn.style.textOffset, textOffsetScale),
                    ...alpha});
            }
        }
    }

    fillOptions() {
        this.displayOptions.classbShrink = globalStore.getData(keys.properties.aisClassbShrink, 1);
        this.displayOptions.scale = globalStore.getData(keys.properties.aisIconScale, 1);
        this.displayOptions.useHeading = globalStore.getData(keys.properties.aisUseHeading, true);
        this.displayOptions.courseVectorWidth = globalStore.getData(keys.properties.navCircleWidth);
        this.aisoptions = fillOptions();
    }

    /**
     * handle changed properties
     * @param evdata
     */
    dataChanged() {
        this.visible = globalStore.getData(keys.properties.layers.ais);
        this.setStyles();
        this.createInternalIcons();
        this.computeStyles();
        this.fillOptions();
    }


    /**
     * compute a target point in map units from a given point
     * for drawing the circles
     * assumes "flatted" area around the point
     * @param {olCoordinate} pos in map coordinates
     * @param {number} course in degrees
     * @param {number} dist in m
     */
    computeTarget(pos:Coordinate, course:number, dist:number) {
        try {
            const point = new navobjects.Point();
            point.fromCoord(this.mapholder.transformFromMap(pos));
            const tp = NavCompute.computeTarget(point, course, dist, globalStore.getData(keys.nav.routeHandler.useRhumbLine));
            const tpmap = this.mapholder.transformToMap(tp.toCoord());
            return tpmap;
        } catch (e) {
            return [0, 0];
        }
    }

    pointToMap(point:LatLon) {
        try {
            let npoint:Point;
            if (!(point instanceof navobjects.Point)) {
                npoint = new navobjects.Point(point.lon, point.lat);
            }
            else{
                npoint=point;
            }
            return this.mapholder.transformToMap(npoint.toCoord());
        } catch (e) {
            //ignore
        }
        return [0, 0]
    }

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
    setImageStyles(styles:any) {
        const prefixToStyleMap:Record<string,StyleMap>={
            '':this.symbolStyles,
            aton:this.atonStyles,
        }
        for (const stylePrefix in prefixToStyleMap) {
            const currentMap=prefixToStyleMap[stylePrefix];
            const names = ['Normal', 'Warning', 'Nearest', 'Tracking'];
            const allowedStyles = {
                anchor: true,
                size: true,
                courseVectorColor: true,
                courseVector: true,
                rotate: true,
                alpha: true,
                textOffset: true
            };
            const iter = [''].concat(names);
            for (const i in iter) {
                const name = iter[i];
                const styleProp = "ais" + stylePrefix + name + "Image";
                const re = new RegExp("^" + styleProp);
                for (const k in styles) {
                    if (re.exec(k)) {
                        const suffix = k.replace(re, "");
                        const prefixes = name === '' ? names : [name];
                        prefixes.forEach((prefix) => {
                            const styleKey = prefix.toLowerCase() + suffix;
                            const dstyle = styles[k];
                            if (typeof (dstyle) === 'object') {
                                currentMap[styleKey] = new StyleEntry(
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
    }
}

export default AisLayer;
