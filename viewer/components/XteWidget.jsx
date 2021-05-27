/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import PropertyHandler from '../util/propertyhandler.js';
import Formatter from '../util/formatter';
import keys from '../util/keys.jsx';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';
import navcompute from '../nav/navcompute.js';

const normalColors={
    all: '#000000'
};
const nightColors={
    all: 'rgba(252, 11, 11, 0.6)'
}

class XteWidget extends React.Component{

    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.drawXte=this.drawXte.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps, XteWidget.storeKeys);
    }
    render(){
        let self = this;
        let classes = "widget xteWidget " +this.props.className||"";
        let style = this.props.style || {};
        setTimeout(self.drawXte,0);
        return (
            <div className={classes} onClick={this.props.onClick} style={style}>
                <canvas className='widgetData' ref={self.canvasRef}></canvas>
                <div className='infoLeft'>XTE</div>
                <div className='infoRight'>nm</div>
            </div>

        );

    }
    canvasRef(item){
        this.canvas=item;
        setTimeout(self.drawXte,0);
    }
    drawXte(){
        let canvas=this.canvas;
        if (! canvas) return;
        let context=canvas.getContext('2d');
        let xteMax=this.props.xteMax;
        let xteText=Formatter.formatDecimal(xteMax,1,1);
        let color=canvas.style.color;
        if (! color){
            color=this.props.nightMode?nightColors.all:normalColors.all;
        }
        let crect=canvas.getBoundingClientRect();
        let w=crect.width;
        let h=crect.height;
        canvas.width=w;
        canvas.height=h;
        context.clearRect(0,0,w,h);
        //fix for duplicate canvas in Android 4.x stock browser and webview
        //https://medium.com/@dhashvir/android-4-1-x-stock-browser-canvas-solution-ffcb939af758
        context.canvas.style.visibility ='hidden'; // Force a change in DOM
        context.canvas.offsetHeight; // Cause a repaint to take play
        context.canvas.style.visibility = 'inherit'; // Make visible again
        context.fillStyle =color;
        context.strokeStyle=color;
        let textBase=h*0.9;
        let textSize=h*0.2;
        let left=w*0.1;
        let right=w*0.9;
        let linebase=h*0.4;
        let sideHeight=h*0.3;
        let middleHeight=h*0.6;
        let shipUpper=h*0.45;
        let shipH=h*0.3;
        let shipw=w*0.03;
        let mText="0";
        context.font="normal "+Math.ceil(textSize)+"px Arial";
        context.textAlign="center";
        context.fillText(xteText,left,textBase);
        context.fillText(xteText,right,textBase);
        context.fillText("0",0.5*w,textBase);
        context.lineWidth=3;
        context.beginPath();
        context.moveTo(left,linebase-0.5*sideHeight);
        context.lineTo(left,linebase+0.5*sideHeight);
        context.moveTo(left,linebase);
        context.lineTo(right,linebase);
        context.moveTo(right,linebase-0.5*sideHeight);
        context.lineTo(right,linebase+0.5*sideHeight);
        context.moveTo(0.5*w,linebase-0.5*middleHeight);
        context.lineTo(0.5*w,linebase+0.5*middleHeight);
        context.stroke();
        context.closePath();
        let curXte=this.props.markerXte/navcompute.NM;
        if (curXte === undefined) return;
        let xtepos=parseFloat(curXte)/xteMax;
        if (xtepos < -1.1) xtepos=-1.1;
        if (xtepos > 1.1) xtepos=1.1;
        xtepos=xtepos*(right-left)/2+left+(right-left)/2;
        context.beginPath();
        context.moveTo(xtepos,shipUpper);
        context.lineTo(xtepos-shipw,shipUpper+shipH);
        context.lineTo(xtepos+shipw,shipUpper+shipH);
        context.lineTo(xtepos,shipUpper);
        context.fill();
        context.closePath();
    }

}

XteWidget.propTypes={
    onClick:    PropTypes.func,
    className:  PropTypes.string,
    markerXte:  PropTypes.number,
    xteMax:     PropTypes.number

};

XteWidget.storeKeys={
    markerXte:  keys.nav.wp.xte,
    xteMax:     keys.properties.gpsXteMax
};

export default XteWidget;