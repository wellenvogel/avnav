/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import navcompute from '../nav/navcompute.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {getWindData} from "./WindWidget";
import {useAvNavSortable} from "../hoc/Sortable";
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const normalColors={
    green:  'rgba(5, 128, 30, 0.57)',
    red: 'rgba(255, 20, 7, 0.54)',
    circle: '#888888', // gray
    scale: '#666666', // dark gray
    pointer: '#000000',
    text: '#000000'
};
const nightColors={
    green:  'rgba(5, 128, 30, 0.57)',
    red: 'rgba(255, 20, 7, 0.54)',
    circle: '#888888', // gray
    scale: '#666666', // dark gray
    pointer: 'rgba(252, 11, 11, 0.6)',
    text: 'rgba(252, 11, 11, 0.6)'
};
const WindGraphics = (props) => {
    useKeyEventHandler(props, "widget");
    const ddProps = useAvNavSortable(props.dragId);
    let canvas = undefined;
    const drawWind = () => {
        let current = getWindData(props);
        let colors = props.nightMode ? nightColors : normalColors;
        if (!canvas) return;
        let ctx = canvas.getContext('2d');
        // Set scale factor for all values
        let crect = canvas.getBoundingClientRect();
        let w = crect.width;
        let h = crect.height;
        canvas.width = w;
        canvas.height = h;
        let width = 200;			// Control width
        let height = 200;			// Control height
        let f1 = w / width;
        let f2 = h / height;
        let f = Math.min(f1, f2);
        let fontSize = f * height / 5;
        let mvx = (w - width * f) / 2;
        let mvy = (h - height * f) / 2;
        ctx.translate(mvx > 0 ? 0.9 * mvx : 0, mvy > 0 ? mvy : 0); //move the drawing to the middle
        ctx.scale(f, f);
        let scaleAngle = props.scaleAngle || 50;
        scaleAngle = parseFloat(scaleAngle);


        // Settings
        let radius = 100;			// Radius of control
        let pointer_lenght = 33;	// Pointer lenght
        let pointer_linewidth = 6;	// Pointer lenght
        let circle_linewidth = 1;	// Pointer lenght
        let value_min = 0;			// Minimum of value
        let value_max = 360;		// Maximum of value
        let angle_scala = 360;		// Angle of scala
        let angle_offset = 0;		// Angle offset for scala, Center 0° is north

        // Create random value for wind direction and wind speed
        let winddirection = parseFloat(current.windAngle);

        // Calculation of pointer rotation
        let angle = ((angle_scala) / (value_max - value_min) * winddirection) + angle_offset;

        // Write inner circle in center position
        ctx.beginPath();
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
            ctx.strokeStyle = colors.circle; // gray
            ctx.lineWidth = 15;
            start = 40;
            end = 140;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Write scale
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.strokeStyle = colors.scale; // dark gray
            ctx.lineWidth = 10;
            start = i * 30 - 1;
            end = i * 30 + 1;
            ctx.arc(width / 2, height / 2, radius * 0.9, 2 * Math.PI / 360 * start, 2 * Math.PI / 360 * end);
            ctx.stroke();
        }
        // Create text
        // Move the pointer from 0,0 to center position
        ctx.translate(width / 2, height / 2);
        ctx.font = fontSize + "px Arial";
        if (!props.show360 && current.suffix !== 'TD') {
            if (winddirection > 180) winddirection -= 360;
        }
        let txt = Formatter.formatDirection(winddirection).replace(/ /g, "0");
        let xFactor = -0.8;
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
        ctx.moveTo(0, -40);
        ctx.lineTo(0, -40 - pointer_lenght);
        ctx.stroke();
    }
    const canvasRef = (item) => {
        canvas = item;
        setTimeout(drawWind, 0);
    }
    setTimeout(drawWind, 0);
    let current = getWindData(props);
    let windSpeed = "";
    let showKnots = props.showKnots;
    try {
        windSpeed = parseFloat(current.windSpeed);
        if (showKnots) {
            windSpeed = windSpeed * 3600 / navcompute.NM;
        }
        if (windSpeed < 10) windSpeed = Formatter.formatDecimal(windSpeed, 1, 2);
        else windSpeed = Formatter.formatDecimal(windSpeed, 3, 0);
    } catch (e) {
    }
    return (
        <WidgetFrame {...props} addClass="windGraphics" unit={showKnots ? "kn" : "m/s"} caption="Wind" resize={false}>
            <canvas className='widgetData' ref={canvasRef}></canvas>
            <div className="windSpeed">{windSpeed}</div>
            <div className="windReference">{current.suffix}</div>
        </WidgetFrame>

    );

}

WindGraphics.propTypes={
    ...WidgetProps,
    windSpeed: PropTypes.number,
    windAngle: PropTypes.number,
    windAngleTrue:  PropTypes.number,
    windSpeedTrue:  PropTypes.number,
    showKnots:  PropTypes.bool,
    scaleAngle: PropTypes.number,
    nightMode: PropTypes.bool,
    kind: PropTypes.string, //true,apparent,auto,
    show360: PropTypes.bool
};
WindGraphics.storeKeys={
    windSpeed:  keys.nav.gps.windSpeed,
    windAngle:  keys.nav.gps.windAngle,
    windAngleTrue: keys.nav.gps.trueWindAngle,
    windDirectionTrue: keys.nav.gps.trueWindDirection,
    windSpeedTrue: keys.nav.gps.trueWindSpeed,
    visible:    keys.properties.showWind,
    showKnots:  keys.properties.windKnots,
    scaleAngle: keys.properties.windScaleAngle
};
WindGraphics.editableParameters={
    show360: {type:'BOOLEAN',default:false},
    kind: {type:'SELECT',list:['auto','trueAngle','trueDirection','apparent'],default:'auto'}
}
export default WindGraphics;