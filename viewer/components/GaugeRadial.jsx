/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';
import {RadialGauge} from 'canvas-gauges';
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

class GaugeRadial extends React.Component{
    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.gauge=undefined;
    }
    getProps(){
        let rt=this.props.translateFunction?this.props.translateFunction(this.props):defaultTranslateFunction(this.props);
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
        let wh=Math.min(rect.width,rect.height);
        if (this.refs.value){
            try {
                let factor=12;
                let fs = parseFloat(window.getComputedStyle(this.refs.value).fontSize);
                if (fs > wh/factor) {
                    this.refs.value.style.fontSize=(wh/factor)+"px";
                }
                else{
                    this.refs.value.style.fontSize=undefined;
                }
            }catch(e){}

        }
        let props=this.getProps();
        if (! this.gauge){
            try {
                let options = assign({}, props, {renderTo: this.canvas,width:wh,height:wh});
                this.gauge = new RadialGauge(options).draw();
                return;
            }catch(e){
                base.log("gauge error:"+e);
            }
        }
        if (! this.gauge) return;
        this.gauge.value=props.value;
        this.gauge.update(assign({},props,{width:wh,height:wh}));
    }
};

GaugeRadial.propTypes={
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
    translateFunction: PropTypes.func //if set: a function to translate options
    //all the options from canvas-gauges, see
    //https://canvas-gauges.com/documentation/user-guide/configuration
};
GaugeRadial.editableParameters=
{
    "caption":true,
    "unit":true,
    "value":true,
    drawValue:{type:"BOOLEAN",default:true,description:"Show Value"},
    colorPlate:{type:'COLOR'},
    colorText:{type: 'COLOR'},
    colorNeedle:{type:'COLOR'}
};


module.exports=GaugeRadial;