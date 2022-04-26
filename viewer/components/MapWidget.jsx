/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import GuiHelper from '../util/GuiHelpers.js';
import assign from 'object-assign';
import base from "../base";



class MapWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
        this.drawing=undefined;
        this.initUserContext();
    }
    initUserContext(){
        let self=this;
        this.userContext={};
        this.userContext.lonLatToPixel=(lon,lat)=>{
            if (! this.drawing) return[0,0];
            let mapcoord=this.drawing.pointToMap([lon,lat]);
            return this.drawing.pixelToDevice(this.drawing.pointToCssPixel(mapcoord));
        }
        this.userContext.pixelToLonLat=(x,y)=>{
            if (! this.drawing) return [0,0];
            x=x/this.drawing.getDevPixelRatio();
            y=y/this.drawing.getDevPixelRatio();
            return this.drawing.pointFromMap(this.drawing.cssPixelToCoord([x,y]));
        }
        this.userContext.getScale=()=>{
            if (! this.drawing) return 1;
            return this.drawing.useHdpi?this.drawing.devPixelRatio:1;
        }
        this.userContext.getRotation=()=>{
            if (! this.drawing) return 0;
            return this.drawing.getRotation();
        }
        this.userContext.getContext=()=>{
            if (! this.drawing) return;
            return this.drawing.getContext();
        }
        this.userContext.getDimensions=()=>{
            if (! this.drawing) return [0,0];
            let cv=this.drawing.getContext().canvas;
            return [cv.width*this.drawing.getDevPixelRatio(),cv.height*this.drawing.getDevPixelRatio()];
        }
        this.userContext.triggerRender=()=>{
            window.setTimeout(()=>self.props.triggerRender(),0);
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
    render() {
        return null;
    }
    componentWillUnmount(){
        if (typeof(this.props.finalizeFunction) === 'function'){
            try {
                this.props.finalizeFunction.call(this.userContext, this.userContext, this.getProps());
            }catch(e){
                base.log("error in user finalize function for "+this.props.name+": "+e);
            }
        }
        if (this.props.registerMap){
            this.props.registerMap()
        }
    }
    componentDidMount() {
        if (typeof(this.props.initFunction) === 'function'){
            try {
                this.props.initFunction.call(this.userContext, this.userContext, this.getProps());
            }catch(e){
                base.log("error in user init function for "+this.props.name+": "+e);
            }
        }
        if (this.props.registerMap){
            this.props.registerMap((drawing,center)=>{
                this.drawing=drawing;
                try{
                    this.props.renderCanvas.call(this.userContext,drawing.getContext().canvas,this.getProps());
                }catch(e){
                    base.log("error in user renderCanvas function for "+this.props.name+": "+e);
                }
                this.drawing=undefined;
            })
        }
    }
}

MapWidget.propTypes={
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
    translateFunction: PropTypes.func,
    registerMap: PropTypes.func.isRequired,
    triggerRender: PropTypes.func.isRequired
};
MapWidget.editableParameters={
    caption:false,
    unit:false
};

export default MapWidget;