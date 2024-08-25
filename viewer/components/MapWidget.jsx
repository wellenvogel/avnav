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
        /**
         * convert lon, lat to canvas pixel
         * @param lon
         * @param lat
         * @returns {number[]|*} [x,y] pixel (starting upper left)
         */
        this.userContext.lonLatToPixel=(lon,lat)=>{
            if (! this.drawing) return[0,0];
            let mapcoord=this.drawing.pointToMap([lon,lat]);
            return this.drawing.pixelToDevice(this.drawing.pointToCssPixel(mapcoord));
        }
        /**
         * invers to #lonLatToPixel
         * @param x
         * @param y
         * @returns {number[]|*} [lon,lat]
         */
        this.userContext.pixelToLonLat=(x,y)=>{
            if (! this.drawing) return [0,0];
            x=x/this.drawing.getDevPixelRatio();
            y=y/this.drawing.getDevPixelRatio();
            return this.drawing.pointFromMap(this.drawing.cssPixelToCoord([x,y]));
        }
        /**
         * get the scale factor for high dpi displays
         * 1 is the base
         * @returns {number|*|number|number}
         */
        this.userContext.getScale=()=>{
            if (! this.drawing) return 1;
            return this.drawing.useHdpi?this.drawing.devPixelRatio:1;
        }
        /**
         * get the map rotation
         * @returns {number|*} rotation in rad!!!
         */
        this.userContext.getRotation=()=>{
            if (! this.drawing) return 0;
            return this.drawing.getRotation();
        }
        /**
         * get the drawing context
         * @returns {*}
         */
        this.userContext.getContext=()=>{
            if (! this.drawing) return;
            return this.drawing.getContext();
        }
        /**
         * get the canvas size
         * @returns {number[]} [width,height]
         */
        this.userContext.getDimensions=()=>{
            if (! this.drawing) return [0,0];
            let cv=this.drawing.getContext().canvas;
            return [cv.width*this.drawing.getDevPixelRatio(),cv.height*this.drawing.getDevPixelRatio()];
        }
        /**
         * function to trigger a new render of the map
         * this function can also be called outside the renderCanvas function - e.g. from a timer
         */
        this.userContext.triggerRender=()=>{
            window.setTimeout(()=>self.props.triggerRender(),0);
        }
    }
    getProps(){
        if (! this.props.translateFunction){
            return this.props;
        }
        else{
            return {...this.props,...this.props.translateFunction(...this.props)};
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