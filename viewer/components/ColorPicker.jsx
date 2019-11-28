/**
 * Created by andreas on 03.12.16.
 * copied from https://github.com/Lazyshot/react-color-picker/blob/master/lib/index.js
 * to correctly handle willReceiveProperties
 */
'use strict';

import React from 'react';
import reactCreateClass from 'create-react-class';
import assign from 'object-assign';
import colorUtils  from '../node_modules/react-color-picker/lib/utils/color';
import defaultColor  from '../node_modules/react-color-picker/lib/defaultColor';
import toStringValue from '../node_modules/react-color-picker/lib/utils/toStringValue';

import {SaturationSpectru,HueSpectrum} from 'react-color-picker';
import Swipe from '../components/Swipe.jsx';
import base from '../base.js';

let toHsv = colorUtils.toHsv;

function emptyFn(){}

let RESULT = reactCreateClass({

    displayName: 'ColorPicker',

    getDefaultProps: function(){
        return {
            defaultColor    : defaultColor,
            saturationWidth : 300,
            saturationHeight: 300,
            hueHeight       : null,
            hueWidth        : 50,
            hueMargin       : 10
        }
    },

    getInitialState: function(){
        return {
            value: this.props.defaultValue
        }
    },

    prepareClasses: function(classes){
        classes.push('cp')
    },
    componentWillReceiveProps:function(nextProps){
        this.setState({
            dragHue: null
        });
    },
    prepareProps: function(props){

        let classes = [props.className || ''];
        this.prepareClasses(classes);
        props.className = classes.join(' ');

        return props
    },

    render: function(){

        let props = this.prepareProps(assign({}, this.props));

        let hueStyle = this.props.hueStyle || {};

        hueStyle.marginLeft = this.props.hueMargin;


        let value = props.value?
            this.toColorValue(this.props.value):
            null;

        let defaultValue = !value?
            this.toColorValue(this.state.value || props.defaultValue || props.defaultColor):
            null;

        let saturationConfig = {
            onDrag     : this.handleSaturationDrag,
            onChange   : this.handleSaturationChange,
            onMouseDown: this.handleSaturationMouseDown,
            height     : props.saturationHeight,
            width     : props.saturationWidth,
            inPicker   : true
        };

        let hueConfig = {
            onDrag     : this.handleHueDrag,
            onChange   : this.handleHueChange,
            height     : props.hueHeight || props.saturationHeight,
            width      : props.hueWidth,
            inPicker   : true,
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
                onSwipeMove={this.onHueSwipeMove}>
                <HueSpectrum {...hueConfig} />
            </Swipe>
        </div>);
    },
    /*
        normally all the swipe handling should go directly into the sub comps
        but to avoid copying them all, we leave them here.
     */
    onHueSwipeStart: function(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("swipe start");
        return this.onSwipeH(abs.y);
    },
    onSatSwipeStart: function(abs){
        this.swipe=this.toColorValue(this.props.value);
        base.log("swipe start");
        return this.onSwipeSV(abs.x,abs.y);
    },
    onSwipeH:function(newY){
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
    },
    onSwipeSV:function(newX,newY){
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
    },
    onHueSwipeMove: function(o,abs){
        return this.onSwipeH(abs.y);
    },
    onSatSwipeMove: function(o,abs){
        return this.onSwipeSV(abs.x,abs.y);
    },

    toColorValue: function(value){
        return typeof value == 'string'?
            toHsv(value):
            value
    },

    toStringValue: toStringValue,

    handleChange: function(color){

        this.state.dragHue = null;

        color = assign({}, color);

        let value = this.toStringValue(color)

            ;(this.props.onChange || emptyFn)(value, color)
    },

    handleSaturationChange: function(color){
        this.handleChange(color)
    },

    handleHueChange: function(color){
        this.handleChange(color)
    },

    handleHueDrag: function(hsv){
        this.handleDrag(hsv)
    },

    handleSaturationDrag: function(hsv){
        this.handleDrag(hsv)
    },

    handleDrag: function(color){

        if (!this.props.value){
            this.setState({
                value: color
            })
        }

        (this.props.onDrag || emptyFn)(this.toStringValue(color), color);
    },

    handleSaturationMouseDown: function(hsv){
        this.setState({
            dragHue: hsv.h
        })
    }
});


module.exports = RESULT;