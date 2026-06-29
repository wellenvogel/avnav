/**
 * Created by andreas on 23.02.16.
 */

import React, {useRef} from "react";
import Formatter from '../util/formatter';
import keys from '../util/keys';
import {getWindData, WindProps, WindStoreKeys} from "./WindWidget";
import {WidgetFrame} from "./WidgetBase";
import globalstore from "../util/globalstore";
import {IWidgetProps} from "../util/types";
import Helper from "../util/helper";
const EDITABLES={
    scaleAngle: {default:50, displayName: "red/green Angle", type:'NUMBER', list:[5, 90]},
    show360: {type: 'BOOLEAN', default: false},
    kind: {type: 'SELECT',
        list: ['auto', 'trueAngle', 'trueDirection', 'apparent'],
        default: 'auto',
        description:'which wind data to be shown\nauto will try apparent, trueAngle, trueDirection and display the first found data'
    },
    formatter: true,
    formatterParameters: true,
    caption: true
}
export interface WindGraphicsProps extends IWidgetProps,
    WindProps ,
    Omit<Record<keyof typeof EDITABLES, any>,('kind'|'caption')>{
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
    const drawWind = () => {
        const canvas=canvasref.current;
        const current = getWindData(props);
        if (!canvas) return;
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
        const fontSize = f * height / 6;
        const mvx = (w - width * f) / 2;
        const mvy = (h - height * f) / 2;
        ctx.translate(mvx > 0 ? 0.9 * mvx : 0, mvy > 0 ? mvy : 0); //move the drawing to the middle
        ctx.scale(f, f);
        let scaleAngle = props.scaleAngle || 50;
        scaleAngle = parseFloat(scaleAngle);


        // Settings
        const radius = 100;			// Radius of control
        const pointer_lenght = 33;	// Pointer lenght
        const pointer_linewidth = 6;	// Pointer lenght
        const circle_linewidth = 1;
        const value_min = 0;			// Minimum of value
        const value_max = 360;		// Maximum of value
        const angle_scala = 360;		// Angle of scala
        const angle_offset = 0;		// Angle offset for scala, Center 0° is north

        // Create random value for wind direction and wind speed
        let winddirection = Number(current.windAngle);

        // Calculation of pointer rotation
        const angle = ((angle_scala) / (value_max - value_min) * winddirection) + angle_offset;

        // Write inner circle in center position
        ctx.beginPath();
        ctx.strokeStyle=colors.circle;
        ctx.lineWidth = circle_linewidth;
        ctx.arc(width / 2, height / 2, radius * 0.97, 0, 2 * Math.PI);
        ctx.stroke();
        let start, end;
        if (current.suffix === 'A') {
            // Write left partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.red; // red
            ctx.lineWidth = 15;
            start = 270 - scaleAngle;
            end = 250;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write right partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.green; // green
            ctx.lineWidth = 15;
            start = 290;
            end = 270 + scaleAngle;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
            // Write partial circle
            ctx.beginPath();
            ctx.strokeStyle = colors.bottom; // gray
            ctx.lineWidth = 15;
            start = 40;
            end = 140;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Write scale
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.strokeStyle = colors.circle; // dark gray
            ctx.lineWidth = 10;
            start = i * 30 - 1;
            end = i * 30 + 1;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Create text
        // Move the pointer from 0,0 to center position
        ctx.translate(width / 2, height / 2);
        ctx.font = fontSize + "px "+globalstore.getData(keys.properties.fontBase);
        let show180=false;
        if (!props.show360 && current.suffix !== 'TD') {
            if (winddirection > 180) winddirection -= 360;
            show180=true;
        }
        const txt = Formatter.formatDirection(winddirection,undefined,show180,true);
        let xFactor = -1.0;
        if (winddirection < 0) xFactor = -1.0;
        ctx.fillStyle = colors.text;
        ctx.fillText(txt, xFactor * fontSize, 0.4 * fontSize);
        // Rotate
        ctx.rotate(angle * Math.PI / 180);
        // Write pointer
        ctx.beginPath();
        ctx.lineWidth = pointer_linewidth;
        ctx.lineCap = 'round';
        ctx.strokeStyle = colors.pointer;
        ctx.moveTo(0, -60);
        ctx.lineTo(0, -60 - pointer_lenght);
        ctx.stroke();
    }
    const canvasRef = (item:HTMLCanvasElement) => {
        canvasref.current = item;
        setTimeout(drawWind, 0);
    }
    setTimeout(drawWind, 0);
    const current = getWindData(props);
    const windSpeed = props.formatter(current.windSpeed);
    return (
        <WidgetFrame {...props} addClass="windGraphics"  caption={props.caption} resize={false}>
            <div className={'widgetData hidden colors'} ref={hiddenRef}>
                <span className={'left'} ref={leftRef}></span>
                <span className={'right'} ref={rightRef}></span>
                <span className={'bottom'} ref={bottomRef}></span>
                <span className={'circle'} ref={circleRef}></span>
            </div>
            <canvas className='widgetData' ref={canvasRef}></canvas>
            <div className="windSpeed">{windSpeed}</div>
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