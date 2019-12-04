/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';
import ReactHtmlParser from 'react-html-parser';
import base from '../base.js';

class ExternalWidget extends React.Component{
    constructor(props){
        super(props);
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.userData={};
    }
    render(){
        let classes="widget externalWidget";
        if (this.props.className) classes+=" "+this.props.className;
        let style=this.props.style||{};
        let innerHtml=null;
        if (this.props.renderHtml){
            try {
                innerHtml = this.props.renderHtml.apply(this.userData,[this.props]);
            }catch (e){
                base.log("ExternalWidget: render error "+e);
                innerHtml="<p>render error </p>";
            }
            if (innerHtml === null){
                return null;
            }
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            {this.props.renderCanvas?<canvas className='widgetData' ref={this.canvasRef}></canvas>:null}
            <div className="resize">
                {(innerHtml!=null)?ReactHtmlParser(innerHtml):null}
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
        try {
            this.props.renderCanvas.apply(this.userData,[this.canvas, this.props]);
        }catch (e){
            base.log("ExternalWidget: canvas render error "+e);
        }
    }
};

ExternalWidget.propTypes={
    name: PropTypes.string,
    unit: PropTypes.string,
    caption: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    default: PropTypes.string,
    renderHtml: PropTypes.func,
    renderCanvas: PropTypes.func
};

module.exports=ExternalWidget;