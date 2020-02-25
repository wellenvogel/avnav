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

class GaugeRadial extends React.Component{
    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.gauge=undefined;
    }
    render(){
        let classes="widget canvasGauge radial";
        if (this.props.className) classes+=" "+this.props.className;
        let style=this.props.style||{};
        let value=this.props.value;
        if (typeof (this.props.formatter) === 'function'){
            value=this.props.formatter(value);
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            <div className="canvasFrame" ref="frame">
                {this.props.drawValue?
                <div className="gaugeValue" ref="value">{value}</div>:null}
                <canvas className='widgetData' ref={this.canvasRef}></canvas>
            </div>
            {(this.props.caption !== undefined )?<div className='infoLeft'>{this.props.caption}</div>:null}
            {(this.props.unit !== undefined)?
                <div className='infoRight'>{this.props.unit}</div>
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
        if (! this.gauge){
            try {
                let options = assign({}, this.props, {renderTo: this.canvas,width:wh,height:wh});
                this.gauge = new RadialGauge(options).draw();
                return;
            }catch(e){
                base.log("gauge error:"+e);
            }
        }
        this.gauge.value=this.props.value;
        this.gauge.update(assign({},this.props,{width:wh,height:wh}));
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
    drawValue: PropTypes.bool
    //all the options from canvas-gauges, see
    //https://canvas-gauges.com/documentation/user-guide/configuration
};
GaugeRadial.useDefaultOptions=true;

module.exports=GaugeRadial;