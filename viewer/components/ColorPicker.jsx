/**
 * Created by andreas on 03.12.16.
 * copied from https://github.com/Lazyshot/react-color-picker/blob/master/lib/index.js
 * to correctly handle willReceiveProperties
 */
'use strict';

var React      = require('react');
var reactCreateClass=require('create-react-class');
var assign = require('object-assign');
var colorUtils = require('../node_modules/react-color-picker/lib/utils/color').default;
var defaultColor = require('../node_modules/react-color-picker/lib/defaultColor').default;
var toStringValue=require('../node_modules/react-color-picker/lib/utils/toStringValue').default;

var HueSpectrum= require('react-color-picker').HueSpectrum;
var SaturationSpectrum = require('react-color-picker').SaturationSpectrum;
var Swipe=require('../components/Swipe.jsx').default;

var toHsv = colorUtils.toHsv;

function emptyFn(){}

var RESULT = reactCreateClass({

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

        var classes = [props.className || ''];
        this.prepareClasses(classes);
        props.className = classes.join(' ');

        return props
    },

    render: function(){

        var props = this.prepareProps(assign({}, this.props));

        var hueStyle = this.props.hueStyle || {};

        hueStyle.marginLeft = this.props.hueMargin;


        var value = props.value?
            this.toColorValue(this.props.value):
            null;

        var defaultValue = !value?
            this.toColorValue(this.state.value || props.defaultValue || props.defaultColor):
            null;

        var saturationConfig = {
            onDrag     : this.handleSaturationDrag,
            onChange   : this.handleSaturationChange,
            onMouseDown: this.handleSaturationMouseDown,
            height     : props.saturationHeight,
            width     : props.saturationWidth,
            inPicker   : true
        };

        var hueConfig = {
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
            <Swipe className="avn_inner"
                onSwipeStart={this.onSatSwipeStart}
                onSwipeMove={this.onSatSwipeMove}>
                <SaturationSpectrum {...saturationConfig}/>
            </Swipe>
            <Swipe className="avn_inner"
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
        avnav.log("swipe start");
        return this.onSwipeH(abs.y);
    },
    onSatSwipeStart: function(abs){
        this.swipe=this.toColorValue(this.props.value);
        avnav.log("swipe start");
        return this.onSwipeSV(abs.x,abs.y);
    },
    onSwipeH:function(newY){
        if (! this.swipe) return;
        avnav.log("swipeH y="+newY+", oldh="+this.swipe.h);
        var h=newY*360/(this.props.hueHeight||this.props.saturationHeight);
        var hsv=avnav.assign({},this.swipe);
        hsv.h=h;
        if (hsv.h > 359) hsv.h=359;
        if (hsv.h < 0) hsv.h=0;
        avnav.log("new h="+hsv.h);
        this.handleDrag(hsv);
        return true;
    },
    onSwipeSV:function(newX,newY){
        if (! this.swipe) return;
        avnav.log("Satswipe "+newX+","+newY+", olds="+this.swipe.s+",oldv="+this.swipe.v);
        var s=newX/this.props.saturationWidth;
        var v=(this.props.saturationHeight-newY)/this.props.saturationHeight;
        var hsv=avnav.assign({},this.swipe);
        hsv.s=s;
        hsv.v=v;
        if (hsv.v > 1) hsv.v=1;
        if (hsv.v < 0) hsv.v=0;
        if (hsv.s > 1) hsv.s=1;
        if (hsv.s < 0) hsv.s=0;
        avnav.log("new s="+hsv.s+", newv="+hsv.v);
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

        var value = this.toStringValue(color)

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