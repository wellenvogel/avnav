/**
 * Created by andreas on 03.12.16.
 * copied from https://github.com/Lazyshot/react-color-picker/blob/master/lib/index.js
 * to correctly handle willReceiveProperties
 */
'use strict';

import React from 'react';
import reactCreateClass from 'create-react-class';
import assign from 'object-assign';
import tinycolor from 'tinycolor2';

import {SaturationSpectrum,HueSpectrum} from 'react-color-picker';
import Swipe from '../components/Swipe.jsx';
import base from '../base.js';

const toHsv = (color)=>{ return tinycolor(color).toHsv()};
const toColorString=(color)=>{
    let cv=tinycolor(color);
    return (cv.getAlpha() == 1)?cv.toHexString():cv.toRgbString();
};


function emptyFn(){}

class HueSpectrumL extends React.Component{
    constructor(props){
        super(props);
        this.mainRef=this.mainRef.bind(this);
        this.state={redraw:0};
        this.main=undefined;
    }
    mainRef(item){
        if (this.main !== item){
            this.main=item;
            if (item) this.setState({redraw:this.state.redraw+1})
        }
    }
    getPointerSize(){
        return this.props.pointerSize||3;
    }
    render(){
        let hsv = toHsv(this.props.value);
        var style = assign({}, this.props.style);
        if (this.props.height) {
            style.height = this.props.height;
        }
        if (this.props.width) {
            style.width = this.props.width;
        }
        var dragStyle = {
            height: this.getPointerSize()
        };
        var dragPos = this.getDragPosition(hsv);
        if (dragPos != null) {
            dragStyle.top = dragPos;
            dragStyle.display = 'block';
            dragStyle.position='absolute';
        }
        return <div className='hue-spectrum'
                    style={style}
                    ref={this.mainRef}>
                    <div
                        className='hue-drag'
                        style={dragStyle }
                        >
                        <div className='hue-inner'/>
                    </div>
                </div>


    }

    getDragPosition(hsv) {
        if (!this.props.height && !this.main) {
            return null;
        }
        var height = this.props.height || this.main.getBoundingClientRect().height;
        var size = this.getPointerSize();
        var pos = Math.round(hsv.h * height / 360);
        var diff = Math.round(size / 2);
        return pos - diff;
    }
}

class ColorPicker extends React.Component{

    constructor(props){
        super(props);
        this.onHueSwipeStart=this.onHueSwipeStart.bind(this);
        this.onSatSwipeStart=this.onSatSwipeStart.bind(this);
        this.onSwipeH=this.onSwipeH.bind(this);
        this.onSwipeSV=this.onSwipeSV.bind(this);
        this.onHueSwipeMove=this.onHueSwipeMove.bind(this);
        this.onSatSwipeMove=this.onSatSwipeMove.bind(this);
        this.onHueSwipeEnd=this.onHueSwipeEnd.bind(this);
        this.handleChange=this.handleChange.bind(this);
        this.handleDrag=this.handleDrag.bind(this);
        this.state={};
    }


    componentWillReceiveProps(nextProps){
        this.setState({
            dragHue: null
        });
    }

    render(){

        let props = assign({}, this.props);
        if (props.className){
            props.className+=" colorPicker";
        }
        else{
            props.className="colorPicker";
        }
        let hueStyle = this.props.hueStyle || {};
        hueStyle.marginLeft = this.props.hueMargin;
        let value = props.value?
            this.toColorValue(this.props.value):
            null;

        let defaultValue = !value?
            this.toColorValue(this.state.value || props.defaultValue || props.defaultColor):
            null;

        let saturationConfig = {
            onDrag     : this.handleDrag,
            onChange   : this.handleChange,
            onMouseDown: this.handleSaturationMouseDown,
            height     : props.saturationHeight,
            width     : props.saturationWidth,
            inPicker   : true
        };

        let hueConfig = {
            height     : props.hueHeight || props.saturationHeight,
            width      : props.hueWidth,
            style      : hueStyle
        };

        if (this.state.dragHue){
            (value || defaultValue).h = this.state.dragHue;
        }

        if (value){
            saturationConfig.value = assign({}, value);
            hueConfig.value = assign({}, value)
        } else {
            saturationConfig.defaultValue = assign({}, defaultValue);
            hueConfig.defaultValue = assign({}, defaultValue)
        }

        return ( <div{...props}>
            <Swipe className="inner"
                onSwipeStart={this.onSatSwipeStart}
                onSwipeMove={this.onSatSwipeMove}>
                <SaturationSpectrum {...saturationConfig}/>
            </Swipe>
            <Swipe className="inner"
                onSwipeStart={this.onHueSwipeStart}
                onSwipeMove={this.onHueSwipeMove}
                onSwipeEnd={this.onHueSwipeEnd}
                includeMouse={true}
                >
                <HueSpectrumL {...hueConfig} />
            </Swipe>
        </div>);
    }
    /*
        normally all the swipe handling should go directly into the sub comps
        but to avoid copying them all, we leave them here.
     */
    onHueSwipeStart(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("swipe start");
        return this.onSwipeH(abs.y);
    }
    onSatSwipeStart(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("swipe start");
        return this.onSwipeSV(abs.x,abs.y);
    }
    onSwipeH(newY){
        if (! this.swipe) return;
        base.log("swipeH y="+newY+", oldh="+this.swipe.h);
        let h=newY*360/(this.props.hueHeight||this.props.saturationHeight);
        let hsv=assign({},this.swipe);
        hsv.h=h;
        if (hsv.h > 359) hsv.h=359;
        if (hsv.h < 0) hsv.h=0;
        base.log("new h="+hsv.h);
        this.handleDrag(hsv);
        return true;
    }
    onSwipeSV(newX,newY){
        if (! this.swipe) return;
        base.log("Satswipe "+newX+","+newY+", olds="+this.swipe.s+",oldv="+this.swipe.v);
        let s=newX/this.props.saturationWidth;
        let v=(this.props.saturationHeight-newY)/this.props.saturationHeight;
        let hsv=assign({},this.swipe);
        hsv.s=s;
        hsv.v=v;
        if (hsv.v > 1) hsv.v=1;
        if (hsv.v < 0) hsv.v=0;
        if (hsv.s > 1) hsv.s=1;
        if (hsv.s < 0) hsv.s=0;
        base.log("new s="+hsv.s+", newv="+hsv.v);
        this.handleDrag(hsv);
        return true;
    }
    onHueSwipeEnd(abs){
        return this.onSwipeH(abs.y);
    }
    onHueSwipeMove(o,abs){
        return this.onSwipeH(abs.y);
    }
    onSatSwipeMove(o,abs){
        return this.onSwipeSV(abs.x,abs.y);
    }

    toColorValue(value){
        return typeof value == 'string'?
            toHsv(value):
            value
    }


    handleChange(color){

        this.state.dragHue = null;

        color = assign({}, color);

        let value = toColorString(color)

            ;(this.props.onChange || emptyFn)(value, color)
    }

    handleDrag(color){
        (this.props.onDrag || emptyFn)(toColorString(color), color);
    }

    handleSaturationMouseDown(hsv){
        this.setState({
            dragHue: hsv.h
        })
    }
};

ColorPicker.displayName='ColorPicker';
export default ColorPicker;
