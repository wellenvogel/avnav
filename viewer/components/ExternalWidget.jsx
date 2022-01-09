/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Value from './Value.jsx';
import GuiHelper from '../util/GuiHelpers.js';
import ReactHtmlParser,{convertNodeToElement} from 'react-html-parser/dist/react-html-parser.min.js';
import base from '../base.js';
import assign from 'object-assign';


const transform=(self,node,index)=>{
    if (node && node.attribs){
        for (let k in node.attribs){
            if (k.match(/^on../)){
                let evstring=node.attribs[k];
                if (!self.eventHandler || ! self.eventHandler[evstring]) {
                    base.log("external widget, no event handler for "+evstring);
                    continue;
                }
                let nk="on"+k.substr(2,1).toUpperCase()+k.substring(3);
                node.attribs[nk]=(ev)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    self.eventHandler[evstring].call(self,ev);
                };
                delete node.attribs[k];
            }
        }
    }
    return convertNodeToElement(node,index,(node,index)=>{transform(self,node,index)});
};

class ExternalWidget extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.state={updateCount:1};
        this.canvasRef=this.canvasRef.bind(this);
        this.renderCanvas=this.renderCanvas.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.userData={
            eventHandler:[],
            triggerRedraw: ()=>{self.setState({updateCount:self.state.updateCount+1})}
        };
        if (typeof(this.props.initFunction) === 'function'){
            this.props.initFunction.call(this.userData,this.userData,this.props);
        }
    }
    getProps(){
        if (! this.props.translateFunction){
            return this.props;
        }
        else{
            return this.props.translateFunction(assign({},this.props));
        }
    }
    render(){
        let convertedProps=this.getProps()
        let classes="widget externalWidget";
        if (convertedProps.className) classes+=" "+convertedProps.className;
        let style=convertedProps.style||{};
        let innerHtml=null;
        if (this.props.renderHtml){
            try {
                innerHtml = this.props.renderHtml.apply(this.userData,[convertedProps]);
            }catch (e){
                base.log("External Widget: render error "+e);
                innerHtml="<p>render error </p>";
            }
            if (innerHtml === null){
                return null;
            }
        }
        let userHtml=(innerHtml!=null)?ReactHtmlParser(innerHtml,
            {transform:(node,index)=>{transform(this.userData,node,index);}}):null;
        return (
        <div className={classes} onClick={this.props.onClick} style={style}>
            {this.props.renderCanvas?<canvas className='widgetData' ref={this.canvasRef}></canvas>:null}
            <div className="resize">
                {userHtml}
            </div>
            {(convertedProps.caption !== undefined )?<div className='infoLeft'>{convertedProps.caption}</div>:null}
            {(convertedProps.unit !== undefined)?
                <div className='infoRight'>{convertedProps.unit}</div>
                :null}
        </div>
        );
    }
    componentDidUpdate(){
        this.renderCanvas();
    }
    componentWillUnmount(){
        if (typeof(this.props.finalizeFunction) === 'function'){
            this.props.finalizeFunction.call(this.userData,this.userData,this.getProps());
        }
    }
    canvasRef(item){
        this.canvas=item;
        setTimeout(this.renderCanvas,0);
    }
    renderCanvas(){
        if (! this.canvas) return;
        try {
            this.props.renderCanvas.apply(this.userData,[this.canvas, this.getProps()]);
        }catch (e){
            base.log("GaugeRadial: canvas render error "+e);
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
    renderCanvas: PropTypes.func,
    initFunction: PropTypes.func,
    finalizeFunction: PropTypes.func,
    translateFunction: PropTypes.func
};
ExternalWidget.editableParameters={
    caption:true,
    unit:true
};

export default ExternalWidget;