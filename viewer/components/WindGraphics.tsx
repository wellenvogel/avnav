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

const WindGraphics = (props:WindGraphicsProps) => {
    const canvasref=useRef<HTMLCanvasElement>(null);
    const hiddenRef=useRef<HTMLDivElement>(null);
    const leftRef=useRef<HTMLSpanElement>(null);
    const rightRef=useRef<HTMLSpanElement>(null);
    const circleRef=useRef<HTMLSpanElement>(null);
    const bottomRef=useRef<HTMLSpanElement>(null);
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
        let winddirection = Number(current.windAngle);
        let show180=false;
        if (!props.show360 && current.suffix !== 'TD') {
            if (winddirection > 180) winddirection -= 360;
            show180=true;
        }
        const directionTxt = Formatter.formatDirection(winddirection,undefined,show180,true);
        const outerTxt=(props.centerDisplay!=='direction')?directionTxt+"°":windSpeed;
        const innerTxt=(props.centerDisplay!=='direction')?windSpeed:directionTxt;
        return [current,outerTxt,innerTxt,winddirection];
    }
    const drawWind = () => {
        const canvas=canvasref.current;
        if (!canvas) return;
        const [current,,centerText,winddirection]=compute();
        const colors=getColors(props.nightMode);
        const ctx = canvas.getContext('2d');
        // Set scale factor for all values
        const crect = canvas.getBoundingClientRect();
        const w = crect.width;
        const h = crect.height;
        canvas.width = w;
        canvas.height = h;
        const width = 200;			// Control width
        const height = 200;			// Control height
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

        // Settings
        const radius = 100;			// Radius of control
        const segmentWidth = 15;
        //const pointer_lenght = 33;	// Pointer lenght
        const pointer_linewidth = 6;	// Pointer lenght
        const circle_linewidth = 1;
        const value_min = 0;			// Minimum of value
        const value_max = 360;		// Maximum of value
        const angle_scala = 360;		// Angle of scala
        const angle_offset = 0;		// Angle offset for scala, Center 0° is north
        const maxTextRadius=45;

        // Calculation of pointer rotation
        const angle = ((angle_scala) / (value_max - value_min) * winddirection) + angle_offset;
        // Create text
        // Move the pointer from 0,0 to center position
        ctx.translate(width / 2, height / 2);
        ctx.font = fontSize + "px "+globalstore.getData(keys.properties.fontBase);
        ctx.fillStyle = colors.text;
        let txtDim=ctx.measureText(centerText);
        let txtHeight=txtDim.actualBoundingBoxAscent+txtDim.actualBoundingBoxDescent;
        let txtRadius=Math.sqrt((txtHeight/2*txtHeight/2)+(txtDim.width/2*txtDim.width/2));
        if (txtRadius > maxTextRadius) {
            //scale down
            const fontScale= maxTextRadius/txtRadius;
            ctx.font = (Number(fontSize) *fontScale) + "px "+globalstore.getData(keys.properties.fontBase);;
            txtRadius = txtRadius*fontScale;
            txtDim=ctx.measureText(centerText);
            txtHeight=txtDim.actualBoundingBoxAscent+txtDim.actualBoundingBoxDescent;
        }
        ctx.fillText(centerText, -txtDim.width/2, txtHeight/2);
        // Write inner circle in center position
        const circleMiddle=radius-circle_linewidth;
        ctx.beginPath();
        ctx.strokeStyle=colors.circle;
        ctx.lineWidth = circle_linewidth;
        ctx.arc(0,0, circleMiddle, 0, 2 * Math.PI);
        ctx.stroke();
        let start, end;
        const segmentMiddle=circleMiddle-circle_linewidth/2-segmentWidth/2;
        if (current.suffix === 'A') {
            // Write left partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.red; // red
            ctx.lineWidth = segmentWidth;
            //must subtract 90° as canvas has 0° east
            start = 270 - scaleAngle;
            end = 270 - scaleStart;
            ctx.arc(0, 0, segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write right partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.green; // green
            ctx.lineWidth = segmentWidth;
            //must subtract 90° as canvas has 0° east
            start = 270 +scaleStart;
            end = 270 + scaleAngle;
            ctx.arc(0,0, segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.bottom; // gray
            ctx.lineWidth = segmentWidth;
            start = 90-sternAngle;
            end = 90+sternAngle;
            ctx.arc(0,0, segmentMiddle, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Write scale
        const scaleLen=segmentWidth-4;
        for (let i = 0; i < 12; i++) {
            ctx.rotate(2*Math.PI/12)
            ctx.beginPath();
            ctx.strokeStyle = colors.circle; // dark gray
            ctx.lineWidth = 2
            ctx.moveTo(0,-(circleMiddle-circle_linewidth/2-2-scaleLen));
            ctx.lineTo(0,-(circleMiddle-circle_linewidth/2-2));
            ctx.stroke();
        }
        // Rotate
        ctx.rotate(angle * Math.PI / 180);
        // Write pointer
        ctx.beginPath();
        if (!props.useArrow) {
            ctx.lineWidth = pointer_linewidth;
            ctx.lineCap = 'round';
            ctx.strokeStyle = colors.pointer;
            ctx.moveTo(0, -txtRadius - 2);
            ctx.lineTo(0, -(segmentMiddle - segmentWidth / 2 - 4));
            ctx.stroke();
        }
        else {
            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.pointer;
            ctx.fillStyle = colors.pointer;
            ctx.moveTo(-10, -txtRadius - 2);
            ctx.lineTo(0, -(segmentMiddle - segmentWidth / 2 - 4));
            ctx.lineTo(10, -txtRadius - 2);
            //ctx.stroke();
            ctx.fill();
        }
    }
    const canvasRef = (item:HTMLCanvasElement) => {
        canvasref.current = item;
        setTimeout(drawWind, 0);
    }

    setTimeout(drawWind, 0);
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