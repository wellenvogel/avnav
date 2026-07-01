/**
 * Created by andreas on 23.02.16.
 */

import React, {useRef} from "react";
import Formatter from '../util/formatter';
import keys from '../util/keys';
import {getWindData, WindStoreKeys} from "./WindWidget";
import {WidgetFrame} from "./WidgetBase";
import globalstore from "../util/globalstore";
import {IWidgetProps} from "../util/types";
import Helper from "../util/helper";

const EDITABLES={
    scaleStart: {default: 20, type:'NUMBER',displayName:'red/green start',
        list:[1, 90],
        description: 'start angle  (from north) for the red/green area for apparent display'
    },
    scaleAngle: {default:50, displayName: "red/green end",
        type:'NUMBER', list:[5, 90],
        description: 'end angle  (from north) for the red/green area for apparent display'
    },
    sternAngle: {default:50, displayName: "stern Angle",
        type:'NUMBER', list:[0, 90],
        description: 'angle(+/- from 180°) for the grey area astern for apparent display, 0 to disable'
    },
    show360: {type: 'BOOLEAN', default: false},
    useArrow: {type: 'BOOLEAN', default: true,
        displayName:'arrow',
        description:'use arrow instead of line for the needle'},
    kind: {type: 'SELECT',
        list: ['auto', 'trueAngle', 'trueDirection', 'apparent'],
        default: 'auto',
        description:'which wind data to be shown\nauto will try apparent, trueAngle, trueDirection and display the first found data'
    },
    centerDisplay:{
        type: 'SELECT',
        displayName:'show in center',
        list: ['direction', 'speed'],
        default: 'direction',
        description:'What to show in the center of the widget\n'+
            'The other value will be shown at the lower right\n'+
            'direction: wind angle or wind direction\n'+
            'speed: wind speed'
    },
    formatter: true,
    formatterParameters: true,
    caption: true
}
export interface WindGraphicsProps extends IWidgetProps,
    Omit<Record<keyof typeof EDITABLES, any>,'caption'>{
}
interface DrawingColors{
    green:string,
    red:string,
    circle:string,
    bottom: string,
    pointer: string,
    text: string,
}
//fall back colors if the colors from the CSS do not work
const normalColors:DrawingColors = {
    green:  'rgba(5, 128, 30, 0.57)',
    red: 'rgba(255, 20, 7, 0.54)',
    circle: '#888888', // gray
    bottom: '#666666', // dark gray
    pointer: '#000000',
    text: '#000000'
};
const nightColors:DrawingColors = {
    green:  'rgba(5, 128, 30, 0.57)',
    red: 'rgba(255, 20, 7, 0.54)',
    circle: '#888888', // gray
    bottom: '#666666', // dark gray
    pointer: 'rgba(252, 11, 11, 0.6)',
    text: 'rgba(252, 11, 11, 0.6)'
};

interface DrawParameters{
    centerText:string;
    colors:DrawingColors;
    textRadius: number
    circleMiddle:number,
    segmentMiddle:number,
    scaleAngle:number,
    scaleStart:number,
    sternAngle:number,
}
class AnimAngle{
    last: number=0;
    private target: number=0;
    private end:number=0;
    private add:number=0;
    private lastTime:number=0;
    private period:number;
    private computeValue:(increment:number)=>boolean;
    constructor(period:number,target:number){
        this.last=0
        this.period=period;
        this.init(target);
    }
    clamp(value:number):number{
        if (isNaN(value)){ return value}
        return value%360;
    }
    computeClockwise(increment:number){
        if (increment < 0.5) increment = 0.5;
        const nv=this.last+increment;
        if (nv >= this.end){
            this.last=this.target;
            return false;
        }
        this.last=nv;
        return true;
    }
    computeCounterClockwise(increment:number){
        if (increment > -0.5) increment = -0.5;
        const nv=this.last+increment;
        if (nv <= this.end){
            this.last=this.target;
            return false;
        }
        this.last=nv;
        return true;
    }
    init(target:number){
        this.target=this.clamp(target);
        this.last=this.clamp(this.last);
        if (isNaN(target)){
            this.last=target;
        }
        else if (isNaN(this.last)){
            this.last=this.target;
        }
        this.lastTime=(new Date()).getTime();
        const diff=target-this.last;
        if (Math.abs(diff) <= 1){
            this.last=target;
            return false;
        }
        const aval=diff/this.period;
        //target >= last
        if (0 < diff && diff <= 180){
            this.computeValue=this.computeClockwise.bind(this);
            this.add=aval;
            this.end=this.target;
            return true;
        }
        if (diff > 180){
            this.computeValue=this.computeCounterClockwise.bind(this);
            this.add=-aval;
            this.end=this.target-360;
            return true;
        }
        //target < last
        if (diff >= -180){ //-180<=tdiff<0
            this.computeValue=this.computeCounterClockwise.bind(this);
            this.add=aval;
            this.end=this.target;
            return true;
        }
        //tdiff < -180
        this.computeValue=this.computeClockwise.bind(this);
        this.add=-aval;
        this.end=this.target+360;
        return true;
    }

    next():[number,boolean]{
        const now=new Date().getTime();
        const tdiff=now-this.lastTime;
        this.lastTime=now;
        if (tdiff > this.period || this.last === this.target){
            this.last=this.target;
            return [this.target,false]
        }
        const more=this.computeValue(tdiff*this.add);
        return[this.clamp(this.last),more]
    }
}

const WindGraphics = (props:WindGraphicsProps) => {
    const canvasref=useRef<HTMLCanvasElement>(null);
    const hiddenRef=useRef<HTMLDivElement>(null);
    const leftRef=useRef<HTMLSpanElement>(null);
    const rightRef=useRef<HTMLSpanElement>(null);
    const circleRef=useRef<HTMLSpanElement>(null);
    const bottomRef=useRef<HTMLSpanElement>(null);
    const drawParameters=useRef<DrawParameters>(undefined);
    const animAngle=useRef<AnimAngle>(undefined);
    const getColors=(night?:boolean)=>{
        const defaults=night?nightColors:normalColors;
        const red:string=Helper.getColor(leftRef.current,defaults.red);
        const green=Helper.getColor(rightRef.current,defaults.green);
        const circle=Helper.getColor(circleRef.current,defaults.circle);
        const bottom=Helper.getColor(bottomRef.current,defaults.bottom);
        const main=Helper.getColor(hiddenRef.current,defaults.text);
        const rt:DrawingColors={
            red:red,
            green:green,
            circle: circle,
            bottom: bottom,
            pointer:main,
            text:main
        }
        return rt
    }
    const compute=()=>{
        const current = getWindData(props);
        const windSpeed = props.formatter(current.windSpeed);
        // Create random value for wind direction and wind speed
        const angle= Number(current.windAngle);
        let winddirection=angle
        let show180=false;
        if (!props.show360 && current.suffix !== 'TD') {
            if (winddirection > 180) winddirection -= 360;
            show180=true;
        }
        const directionTxt = Formatter.formatDirection(winddirection,undefined,show180,true);
        const outerTxt=(props.centerDisplay!=='direction')?directionTxt+"°":windSpeed;
        const innerTxt=(props.centerDisplay!=='direction')?windSpeed:directionTxt;
        return [current,outerTxt,innerTxt,angle];
    }
    // Settings
    const radius = 100;			// Radius of control
    const segmentWidth = 15;
    const pointer_linewidth = 6;
    const circle_linewidth = 1;
    const maxTextRadius=45;
    const width = 200;			// Control width
    const height = 200;			// Control height
    const animationTime=500;
    const initialDraw  =()=>{
        drawParameters.current=undefined;
        const canvas=canvasref.current;
        if (!canvas) return;
        const [,,centerText,angle]=compute();
        if (! animAngle.current) animAngle.current=new AnimAngle(animationTime,angle);
        else animAngle.current.init(angle);
        const colors=getColors(props.nightMode);
        const ctx = canvas.getContext('2d');
        ctx.resetTransform();
        ctx.clearRect(0,0,canvas.width,canvas.height);
        // Set scale factor for all values
        const crect = canvas.getBoundingClientRect();
        const w = crect.width;
        const h = crect.height;
        canvas.width = w;
        canvas.height = h;
        const f1 = w / width;
        const f2 = h / height;
        const f = Math.min(f1, f2);
        const fontSize = f * height / 3; //initial guess
        const mvx = (w - width * f) / 2;
        const mvy = (h - height * f) / 2;
        ctx.translate(mvx > 0 ? 0.9 * mvx : 0, mvy > 0 ? mvy : 0); //move the drawing to the middle
        ctx.scale(f, f);
        const scaleAngle = Number(props.scaleAngle || 50);
        const scaleStart=Number(props.scaleStart || 20);
        const sternAngle=Number(props.sternAngle || 50);

        // Create text
        // Move the pointer from 0,0 to center position
        ctx.translate(width / 2, height / 2);
        ctx.font = fontSize + "px "+globalstore.getData(keys.properties.fontBase);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const txtDim=ctx.measureText(centerText);
        const txtHeight=txtDim.fontBoundingBoxAscent+txtDim.fontBoundingBoxDescent;
        let txtRadius=Math.sqrt((txtHeight/2*txtHeight/2)+(txtDim.width/2*txtDim.width/2));
        if (txtRadius > maxTextRadius) {
            //scale down
            const fontScale= maxTextRadius/txtRadius;
            ctx.font = (Number(fontSize) *fontScale) + "px "+globalstore.getData(keys.properties.fontBase);
            txtRadius = txtRadius*fontScale;
        }
        const circleMiddle=radius-circle_linewidth;
        const segmentMiddle=circleMiddle-circle_linewidth/2-segmentWidth/2;
        const rt:DrawParameters={
            centerText:centerText,
            scaleAngle:scaleAngle,
            scaleStart:scaleStart,
            sternAngle:sternAngle,
            colors:colors,
            textRadius:txtRadius,
            circleMiddle:circleMiddle,
            segmentMiddle:segmentMiddle
        }
        drawParameters.current=rt;
        requestAnimationFrame(drawWind);
    }
    const drawWind = () => {
        const canvas=canvasref.current;
        if (!canvas) return;
        const currentParam=drawParameters.current;
        if (! currentParam) return;
        if (! animAngle.current) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(-width/2,-height/2,width,height);
        ctx.save();
        ctx.fillStyle = currentParam.colors.text;
        ctx.fillText(currentParam.centerText, 0, 0);
        // Write inner circle in center position
        ctx.beginPath();
        ctx.strokeStyle=currentParam.colors.circle;
        ctx.lineWidth = circle_linewidth;
        ctx.arc(0,0, currentParam.circleMiddle, 0, 2 * Math.PI);
        ctx.stroke();
        let start, end;
        if (current.suffix === 'A') {
            // Write left partial circle
            ctx.beginPath();
            ctx.strokeStyle = currentParam.colors.red; // red
            ctx.lineWidth = segmentWidth;
            //must subtract 90° as canvas has 0° east
            start = 270 - currentParam.scaleAngle;
            end = 270 - currentParam.scaleStart;
            ctx.arc(0, 0, currentParam.segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write right partial circle
            ctx.beginPath();
            ctx.strokeStyle = currentParam.colors.green; // green
            ctx.lineWidth = segmentWidth;
            //must subtract 90° as canvas has 0° east
            start = 270 +currentParam.scaleStart;
            end = 270 + currentParam.scaleAngle;
            ctx.arc(0,0, currentParam.segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write partial circle
            ctx.beginPath();
            ctx.strokeStyle = currentParam.colors.bottom; // gray
            ctx.lineWidth = segmentWidth;
            start = 90-currentParam.sternAngle;
            end = 90+currentParam.sternAngle;
            ctx.arc(0,0, currentParam.segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Write scale
        const scaleLen=segmentWidth-4;
        for (let i = 0; i < 12; i++) {
            ctx.rotate(2*Math.PI/12)
            ctx.beginPath();
            ctx.strokeStyle = currentParam.colors.circle; // dark gray
            ctx.lineWidth = 2
            ctx.moveTo(0,-(currentParam.circleMiddle-circle_linewidth/2-2-scaleLen));
            ctx.lineTo(0,-(currentParam.circleMiddle-circle_linewidth/2-2));
            ctx.stroke();
        }
        // Rotate
        const [angle,more]=animAngle.current.next();
        if (! isNaN(angle)) {
            console.log("anim", angle, more);
            ctx.rotate(angle * Math.PI / 180);
            // Write pointer
            ctx.beginPath();
            if (!props.useArrow) {
                ctx.lineWidth = pointer_linewidth;
                ctx.lineCap = 'round';
                ctx.strokeStyle = currentParam.colors.pointer;
                ctx.moveTo(0, -currentParam.textRadius - 2);
                ctx.lineTo(0, -(currentParam.segmentMiddle - segmentWidth / 2 - 4));
                ctx.stroke();
            } else {
                ctx.lineWidth = 1;
                ctx.strokeStyle = currentParam.colors.pointer;
                ctx.fillStyle = currentParam.colors.pointer;
                ctx.moveTo(-10, -currentParam.textRadius - 2);
                ctx.lineTo(0, -(currentParam.segmentMiddle - segmentWidth / 2 - 4));
                ctx.lineTo(10, -currentParam.textRadius - 2);
                //ctx.stroke();
                ctx.fill();
            }
        }
        ctx.restore();
        if (more) {
            requestAnimationFrame(drawWind);
        }
    }
    const canvasRef = (item:HTMLCanvasElement) => {
        canvasref.current = item;
        drawParameters.current=undefined;
        setTimeout(initialDraw, 0);
    }
    drawParameters.current=undefined;
    setTimeout(initialDraw, 0);
    const [current,outerTxt]=compute();
    return (
        <WidgetFrame {...props} addClass="windGraphics"  caption={props.caption} resize={false}>
            <div className={'widgetData hidden colors'} ref={hiddenRef}>
                <span className={'left'} ref={leftRef}></span>
                <span className={'right'} ref={rightRef}></span>
                <span className={'bottom'} ref={bottomRef}></span>
                <span className={'circle'} ref={circleRef}></span>
            </div>
            <canvas className='widgetData' ref={canvasRef}></canvas>
            <div className="windSpeed">{outerTxt}</div>
            <div className="windReference">{current.suffix}</div>
        </WidgetFrame>

    );

}


WindGraphics.predefined= {
    storeKeys: WindStoreKeys,
    editableParameters: EDITABLES,
    formatter: 'formatSpeed',
    caption: 'Wind'
}

export default WindGraphics;