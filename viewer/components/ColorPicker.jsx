/**
 * Created by andreas on 03.12.16.
 * copied/modified  from https://github.com/Lazyshot/react-color-picker/blob/master/lib/index.js
 * to correctly handle willReceiveProperties
 */
'use strict';

import React from 'react';
import assign from 'object-assign';
import tinycolor from 'tinycolor2';

import Swipe from '../components/Swipe.jsx';
import base from '../base.js';

const toHsv = (color)=>{ return tinycolor(color).toHsv()};
const toColorString=(color)=>{
    let cv=tinycolor(color);
    return (cv.getAlpha() == 1)?cv.toHexString():cv.toRgbString();
};

class AlphaSpectrumL extends React.Component{
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
        return <div className='alpha-spectrum'
                    style={style}
                    ref={this.mainRef}>
                <div className="alpha-gradient"/>
            <div
                className='alpha-drag'
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
        var pos = Math.round(hsv.a * height );
        var diff = Math.round(size / 2);
        return pos - diff;
    }
}

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

class SaturationSpectrumL extends React.Component{
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
        return this.props.pointerSize||7;
    }
    prepareBackgroundColor(hsv) {

        var col = tinycolor.fromRatio({
            h: hsv.h % 360 / 360,
            s: 1,
            v: 1
        });
        return col.toRgbString();
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
        style.backgroundColor=this.prepareBackgroundColor(hsv);
        var dragStyle = {
            height: this.getPointerSize(),
            width: this.getPointerSize()
        };
        var dragPos = this.getDragPosition(hsv);
        if (dragPos != null) {
            dragStyle.top = dragPos.top;
            dragStyle.left=dragPos.left;
            dragStyle.display = 'block';
            dragStyle.position='absolute';
        }
        return <div className='saturation-spectrum'
                    style={style}
                    ref={this.mainRef}>
                <div className="saturation-white">
                    <div className="saturation-black"/>
                </div>
            <div
                className='saturation-drag'
                style={dragStyle }
                >
                <div className='saturation-inner'/>
            </div>
        </div>


    }

    getDragPosition(hsv) {
        var height = this.props.height;
        var width = this.props.width;
        if (height === undefined || width === undefined) {
            if (! this.main) return null;
            let rect=this.main.getBoundingClientRect();
            height=rect.height;
            width=rect.width;
        }
        var size = this.getPointerSize();
        var y = height-hsv.v * height;
        var x = hsv.s * width;
        var diff = Math.round(size / 2);
        return {
            left:x - diff,
            top:y-diff
        };
    }
}

class ColorPicker extends React.Component{

    constructor(props){
        super(props);
        this.onHueSwipeStart=this.onHueSwipeStart.bind(this);
        this.onSatSwipeStart=this.onSatSwipeStart.bind(this);
        this.onSwipeH=this.onSwipeH.bind(this);
        this.onSwipeSV=this.onSwipeSV.bind(this);
        this.onSwipeAlpha=this.onSwipeAlpha.bind(this);
        this.onHueSwipeMove=this.onHueSwipeMove.bind(this);
        this.onSatSwipeMove=this.onSatSwipeMove.bind(this);
        this.onSatSwipeEnd=this.onSatSwipeEnd.bind(this);
        this.onHueSwipeEnd=this.onHueSwipeEnd.bind(this);
        this.onAlphaSwipeStart=this.onAlphaSwipeStart.bind(this);
        this.onAlphaSwipeMove=this.onAlphaSwipeMove.bind(this);
        this.onAlphaSwipeEnd=this.onAlphaSwipeEnd.bind(this);
        this.handleChange=this.handleChange.bind(this);
        this.state={};
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
        let alphaStyle = this.props.alphaStyle || {};
        alphaStyle.marginLeft = this.props.alphaMargin;
        let value = props.value?
            this.toColorValue(this.props.value):
            null;


        let saturationConfig = {
            onDrag     : this.handleChange,
            onChange   : this.handleChange,
            onMouseDown: this.handleSaturationMouseDown,
            height     : props.saturationHeight,
            width     : props.saturationWidth
        };

        let hueConfig = {
            height     : props.hueHeight || props.saturationHeight,
            width      : props.hueWidth,
            style      : hueStyle
        };

        let alphaConfig = {
            height     : props.alphaHeight || props.saturationHeight,
            width      : props.alphaWidth||props.hueWidth,
            style      : alphaStyle
        };

        saturationConfig.value=value;
        hueConfig.value=value;
        alphaConfig.value=value;

        return ( <div{...props}>
            <Swipe className="inner"
                onSwipeStart={this.onSatSwipeStart}
                onSwipeMove={this.onSatSwipeMove}
                onSwipeEnd={this.onSatSwipeEnd}
                includeMouse={true}>
                <SaturationSpectrumL {...saturationConfig}/>
            </Swipe>
            <Swipe className="inner"
                onSwipeStart={this.onHueSwipeStart}
                onSwipeMove={this.onHueSwipeMove}
                onSwipeEnd={this.onHueSwipeEnd}
                includeMouse={true}
                >
                <HueSpectrumL {...hueConfig} />
            </Swipe>
            {this.props.showAlpha?
                <Swipe className="inner"
                       onSwipeStart={this.onAlphaSwipeStart}
                       onSwipeMove={this.onAlphaSwipeMove}
                       onSwipeEnd={this.onAlphaSwipeEnd}
                       includeMouse={true}
                    >
                    <AlphaSpectrumL {...alphaConfig} />
                </Swipe>
                :
                null
            }
        </div>);
    }
    /*
        normally all the swipe handling should go directly into the sub comps
        but to avoid copying them all, we leave them here.
     */
    onHueSwipeStart(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("hue swipe start");
        return this.onSwipeH(abs.y);
    }
    onSatSwipeStart(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("sat swipe start");
        return this.onSwipeSV(abs.x,abs.y);
    }
    onAlphaSwipeStart(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("swipe start");
        return this.onSwipeAlpha(abs.y);
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
        this.handleChange(hsv);
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
        this.handleChange(hsv);
        return true;
    }
    onSwipeAlpha(newY){
        if (! this.swipe) return;
        base.log("swipeAlpha y="+newY+", olda="+this.swipe.a);
        let a=newY/(this.props.alphaHeight||this.props.saturationHeight);
        let hsv=assign({},this.swipe);
        hsv.a=a;
        if (hsv.a >1) hsv.a=1;
        if (hsv.a < 0) hsv.a=0;
        base.log("new a="+hsv.a);
        this.handleChange(hsv);
        return true;
    }
    onHueSwipeEnd(abs){
        base.log("hue swipe end y="+abs.y);
        return this.onSwipeH(abs.y);
    }
    onHueSwipeMove(o,abs){
        base.log("hue swipe move y="+abs.y);
        return this.onSwipeH(abs.y);
    }
    onSatSwipeMove(o,abs){
        return this.onSwipeSV(abs.x,abs.y);
    }
    onSatSwipeEnd(abs){
        return this.onSwipeSV(abs.x,abs.y);
    }
    onAlphaSwipeMove(o,abs){
        return this.onSwipeAlpha(abs.y);
    }
    onAlphaSwipeEnd(abs){
        return this.onSwipeAlpha(abs.y);
    }

    toColorValue(value){
        return typeof value == 'string'?
            toHsv(value):
            value
    }


    handleChange(color){
        color = assign({}, color);
        let value = toColorString(color)
        if (this.props.onChange)this.props.onChange(value);
    }
    
};

ColorPicker.displayName='ColorPicker';
export default  ColorPicker;
