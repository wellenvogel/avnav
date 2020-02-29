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
    let rt=assign({},props);
    let textColorNames=['colorTitle','colorUnits','colorNumbers','colorStrokeTicks','colorMajorTicks','colorMinorTicks','colorValueText'];
    if (props.colorText !== undefined){
        textColorNames.forEach((cn)=>{
            if (rt[cn] === undefined) rt[cn]=props.colorText;
        })
    }
    if (props.colorNeedle !== undefined){
        if (rt.colorNeedleEnd === undefined) rt.colorNeedleEnd=props.colorNeedle;
    }
    return rt;
};

class Gauge extends React.Component{
    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.gauge=undefined;
    }
    getProps(){
        let rt=this.props.translateFunction?defaultTranslateFunction(this.props.translateFunction(this.props)):defaultTranslateFunction(this.props);
        for (let k in rt){
            if (rt[k] === undefined) delete rt[k];
        }
        return rt;
    }
    render(){
        let props=this.getProps();
        let classes="widget canvasGauge radial";
        if (props.className) classes+=" "+props.className;
        let style=props.style||{};
        let value=props.value;
        if (typeof (this.props.formatter) === 'function'){
            value=this.props.formatter(value);
        }
        let textStyle={color:props.colorText};
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
        if (value < 0) value=0;
        if (value > 360) value=360;
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
    style: PropTypes.object,
    default: PropTypes.string,
    value: PropTypes.number,
    drawValue: PropTypes.bool,
    colorText: PropTypes.string,
    formatter: PropTypes.string,
    formatterParameters: PropTypes.string,
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
        />
};
GaugeRadial.propTypes=Gauge.propTypes;
GaugeRadial.editableParameters=Gauge.editableParameters;
export const GaugeHorizontal=(props)=>{
    return <Gauge
        {...props}
        gauge={LinearGauge}
        makeSquare={false}
        />
};

GaugeHorizontal.propTypes=Gauge.propTypes;
GaugeHorizontal.editableParameters=assign({},Gauge.editableParameters,{drawValue:false,valueFontFactor:false});