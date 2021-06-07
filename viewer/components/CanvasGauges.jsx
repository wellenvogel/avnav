/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';
import {RadialGauge,LinearGauge} from 'canvas-gauges';
import base from '../base.js';
import assign from 'object-assign';
//refer to https://canvas-gauges.com/documentation/user-guide/configuration
const defaultTranslateFunction=(props)=>{
    let rt=props;
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

class Gauge extends React.Component{
    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.gauge=undefined;
    }
    getProps(){
        let props=assign({},this.props);
        let rt=this.props.translateFunction?defaultTranslateFunction(this.props.translateFunction(props)):defaultTranslateFunction(props);
        for (let k in rt){
            if (rt[k] === undefined) delete rt[k];
        }
        if (props.minValue !== undefined) props.minValue=parseFloat(props.minValue);
        if (props.maxValue !== undefined) props.maxValue=parseFloat(props.maxValue);
        return rt;
    }
    render(){
        let props=this.getProps();
        let defaultColors=props.nightMode?nightColors:normalColors;
        let classes="widget canvasGauge";
        if (props.className) classes+=" "+props.className;
        if (props.typeClass) classes+=" "+props.typeClass;
        let style=props.style||{};
        let value=props.value;
        if (typeof (this.props.formatter) === 'function'){
            value=this.props.formatter(value);
        }
        let textColor=props.colorText?props.colorText:defaultColors.text;
        let textStyle={color:textColor};
        return (
        <div className={classes} onClick={props.onClick} style={style}>
            <div className="canvasFrame" ref="frame">
                {props.drawValue?
                <div className="gaugeValue" ref="value" style={textStyle}>{value}</div>:null}
                <canvas className='widgetData' ref={this.canvasRef}></canvas>
            </div>
            {(props.caption !== undefined )?<div className='infoLeft'>{props.caption}</div>:null}
            {(props.unit !== undefined)?
                <div className='infoRight'>{props.unit}</div>
                :null}
        </div>
        );
    }
    componentDidUpdate(){
        this.renderCanvas();
    }
    canvasRef(item){
        this.canvas=item;
        setTimeout(this.renderCanvas,0);
    }
    renderCanvas(){
        if (! this.canvas) return;
        let rect=undefined;
        if (this.refs.frame){
            rect=this.refs.frame.getBoundingClientRect();
        }
        else {
            rect = this.canvas.getBoundingClientRect();
        }
        let props=this.getProps();
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
        if (this.refs.value){
            try {
                let factor=parseFloat(props.valueFontFactor||12);
                let fs = parseFloat(window.getComputedStyle(this.refs.value).fontSize);
                if (fs != wh/factor) {
                    this.refs.value.style.fontSize=(wh/factor)+"px";
                }
                else{
                    this.refs.value.style.fontSize=undefined;
                }
            }catch(e){}

        }
        let value=props.value;
        if (typeof (props.formatter) === 'function'){
            value=props.formatter(value);
        }
        value=parseFloat(value);
        if (value < props.minValue) value=props.minValue;
        if (value > props.maxValue) value=props.maxValue;
        if (! this.gauge){
            try {
                let options = assign({}, props, {renderTo: this.canvas,width:width,height:height,value:value});
                this.gauge = new this.props.gauge(options).draw();
                return;
            }catch(e){
                base.log("gauge error:"+e);
            }
        }
        if (! this.gauge) return;
        this.gauge.value=value;
        this.gauge.update(assign({},props,{width:width,height:height,value:value}));
    }
};

Gauge.propTypes={
    gauge: PropTypes.object.isRequired,
    name: PropTypes.string,
    unit: PropTypes.string,
    caption: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string,
    typeClass: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string,
    value: PropTypes.number,
    drawValue: PropTypes.bool,
    colorText: PropTypes.string,
    formatter: PropTypes.oneOf([PropTypes.string,PropTypes.func]),
    formatterParameters: PropTypes.array,
    translateFunction: PropTypes.func, //if set: a function to translate options
    valueFontFactor: PropTypes.number
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
GaugeRadial.propTypes=Gauge.propTypes;
GaugeRadial.editableParameters=Gauge.editableParameters;
export const GaugeLinear=(props)=>{
    return <Gauge
        {...props}
        gauge={LinearGauge}
        makeSquare={false}
        typeClass="linear"
        />
};

GaugeLinear.propTypes=Gauge.propTypes;
GaugeLinear.editableParameters=assign({},Gauge.editableParameters,{drawValue:false,valueFontFactor:false});