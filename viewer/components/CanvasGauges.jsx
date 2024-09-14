/**
 * Created by andreas on 23.02.16.
 */

import React, {useEffect, useRef} from "react";
import PropTypes from 'prop-types';
import {RadialGauge,LinearGauge} from 'canvas-gauges';
import base from '../base.js';
import assign from 'object-assign';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

export const getTicks=(minValue,maxValue,number)=>{
    if (minValue === undefined || maxValue === undefined || number === undefined) return;
    let majorTicks=[];
    let inc=Math.floor((parseFloat(maxValue) - parseFloat(minValue))/number);
    if (inc < 1) inc=1;
    for (let i=Math.round(minValue);i<=maxValue;i+=inc){
        majorTicks.push(i);
    }
    return majorTicks;
}
//refer to https://canvas-gauges.com/documentation/user-guide/configuration
const defaultTranslateFunction=(props)=>{
    let rt={...props};
    let defaultColors=props.nightMode?nightColors:normalColors;
    if (! rt.colorText) rt.colorText=defaultColors.text;
    let textColorNames=['colorTitle','colorUnits','colorNumbers','colorStrokeTicks','colorMajorTicks','colorMinorTicks','colorValueText'];
    if (rt.colorText !== undefined){
        textColorNames.forEach((cn)=>{
            if (rt[cn] === undefined) rt[cn]=rt.colorText;
        })
    }
    if (rt.colorNeedle === undefined) rt.colorNeedle=defaultColors.needle;
    if (rt.colorNeedle !== undefined){
        if (rt.colorNeedleEnd === undefined) rt.colorNeedleEnd=rt.colorNeedle;
    }
    if (rt.majorTicks === undefined){
        rt.majorTicks=getTicks(props.minValue,props.maxValue,10);
    }
    return rt;
};

const normalColors={
    text:  '#000000',
    needle: '#c71d1d'
}
const nightColors={
    text: 'rgba(252, 11, 11, 0.6)',
    needle: 'rgba(252, 11, 11, 0.6)'
}

const getProps=(props)=>{
    let rt=props.translateFunction?defaultTranslateFunction({...props,...props.translateFunction({...props})}):defaultTranslateFunction(props);
    for (let k in rt){
        if (rt[k] === undefined) delete rt[k];
    }
    if (rt.minValue !== undefined) rt.minValue=parseFloat(rt.minValue);
    if (rt.maxValue !== undefined) rt.maxValue=parseFloat(rt.maxValue);
    return rt;
}

const Gauge =(rprops)=>{
    let canvas = useRef(null);
    let gauge = useRef(undefined);
    useEffect(()=>{
        return ()=>{
            if (gauge.current) gauge.current.destroy();
        }
    },[])
    let frame = useRef(null);
    let value=useRef(null);
    const props=getProps(rprops);
    let nvalue=props.value;
    if (typeof (props.formatter) === 'function'){
        nvalue=props.formatter(nvalue);
    }
    nvalue=parseFloat(nvalue);
    if (nvalue < props.minValue) nvalue=props.minValue;
    if (nvalue > props.maxValue) nvalue=props.maxValue;
    const renderCanvas=()=>{
        if (!canvas.current) return;
        let rect=undefined;
        if (frame.current){
            rect=frame.current.getBoundingClientRect();
        }
        else {
            rect = canvas.current.getBoundingClientRect();
        }
        let props=getProps(rprops);
        if (props.minValue === undefined) return;
        if (props.maxValue === undefined) return;
        let makeSquare=(props.makeSquare === undefined) || props.makeSquare;
        let width=rect.width;
        let height=rect.height;
        let wh = Math.min(rect.width, rect.height);
        if (makeSquare) {
            width=wh;
            height=wh;
        }
        if (value.current){
            try {
                let factor=parseFloat(props.valueFontFactor||12);
                let fs = parseFloat(window.getComputedStyle(value.current).fontSize);
                if (fs != wh/factor) {
                    value.current.style.fontSize=(wh/factor)+"px";
                }
                else{
                    value.current.style.fontSize=undefined;
                }
            }catch(e){}

        }
        if (!gauge.current){
            try {
                let options = {...props, renderTo: canvas.current,width:width,height:height,value:nvalue};
                gauge.current = new props.gauge(options).draw();
                return;
            }catch(e){
                base.log("gauge error:"+e);
            }
        }
        if (! gauge.current) return;
        gauge.current.value=nvalue;
        gauge.current.update({...props,width:width,height:height,value:nvalue});
    }
    const canvasRef = (item) => {
        if (item ) {
            if (item !== canvas.current) {
                if (gauge.current) gauge.current.destroy();
                gauge.current=undefined;
            }
            canvas.current = item;
            setTimeout(renderCanvas, 0);
        }
    }
    let defaultColors=props.nightMode?nightColors:normalColors;
    let classes="canvasGauge";
    if (props.typeClass) classes+=" "+props.typeClass;
    let style=props.style||{};
    let textColor=props.colorText?props.colorText:defaultColors.text;
    let textStyle={color:textColor};
    return (
        <WidgetFrame {...props} addClass={classes} style={style}>
            <div className="canvasFrame" ref={frame}>
                {props.drawValue?
                <div className="gaugeValue" ref={value} style={textStyle}>{nvalue}</div>:null}
                <canvas className='widgetData' ref={canvasRef}></canvas>
            </div>
        </WidgetFrame>
        );
};

Gauge.propTypes={
    ...WidgetProps,
    gauge: PropTypes.oneOfType([PropTypes.object,PropTypes.func]).isRequired,
    name: PropTypes.string,
    unit: PropTypes.string,
    typeClass: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string,
    value: PropTypes.number,
    drawValue: PropTypes.bool,
    colorText: PropTypes.string,
    formatter: PropTypes.oneOfType([PropTypes.string,PropTypes.func]),
    formatterParameters: PropTypes.array,
    translateFunction: PropTypes.func, //if set: a function to translate options
    valueFontFactor: PropTypes.number,
    minValue: PropTypes.number,
    maxValue: PropTypes.number
    //all the options from canvas-gauges, see
    //https://canvas-gauges.com/documentation/user-guide/configuration
};
Gauge.editableParameters=
{
    "caption":true,
    "unit":true,
    "value":true,
    formatter: true,
    formatterParameters:true,
    drawValue:{type:"BOOLEAN",default:true,description:"Show Value"},
    valueFontFactor:{type:'NUMBER',default:12},
    colorPlate:{type:'COLOR'},
    colorText:{type: 'COLOR'},
    colorNeedle:{type:'COLOR'}
};

export const GaugeRadial=(props)=>{
    return <Gauge
        {...props}
        gauge={RadialGauge}
        typeClass="radial"
        />
};
GaugeRadial.propTypes=assign({},Gauge.propTypes);
delete GaugeRadial.propTypes.gauge;
GaugeRadial.editableParameters=assign({},Gauge.editableParameters,{
    valueBox:{type:"BOOLEAN",default: false, description:"Show the original canvas gauges value box"},
});
export const GaugeLinear=(props)=>{
    return <Gauge
        {...props}
        gauge={LinearGauge}
        makeSquare={false}
        typeClass="linear"
        />
};

GaugeLinear.propTypes=assign({},Gauge.propTypes);
delete GaugeLinear.propTypes.gauge;
GaugeLinear.editableParameters=assign({},Gauge.editableParameters,{drawValue:false,valueFontFactor:false});