/**
 * Created by andreas on 23.02.16.
 */

import {useEffect, useRef} from "react";
import PropTypes from 'prop-types';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import base from "../base";



const MapWidget=(props)=>{
        useKeyEventHandler(props,"widget");
        const drawing=useRef(null);
        const userContext=useRef({
        /**
         * convert lon, lat to canvas pixel
         * @param lon
         * @param lat
         * @returns {number[]|*} [x,y] pixel (starting upper left)
         */
        lonLatToPixel:(lon,lat)=>{
            if (! drawing.current) return[0,0];
            let mapcoord=drawing.current.pointToMap([lon,lat]);
            return drawing.current.pixelToDevice(drawing.current.pointToCssPixel(mapcoord));
        },
        /**
         * invers to #lonLatToPixel
         * @param x
         * @param y
         * @returns {number[]|*} [lon,lat]
         */
        pixelToLonLat:(x,y)=>{
            if (! drawing.current) return [0,0];
            x=x/drawing.current.getDevPixelRatio();
            y=y/drawing.current.getDevPixelRatio();
            return drawing.current.pointFromMap(drawing.current.cssPixelToCoord([x,y]));
        },
        /**
         * get the scale factor for high dpi displays
         * 1 is the base
         * @returns {number|*|number|number}
         */
        getScale:()=>{
            if (! drawing.current) return 1;
            return drawing.current.useHdpi?drawing.current.devPixelRatio:1;
        },
        /**
         * get the map rotation
         * @returns {number|*} rotation in rad!!!
         */
        getRotation:()=>{
            if (! drawing.current) return 0;
            return drawing.current.getRotation();
        },
        /**
         * get the drawing context
         * @returns {*}
         */
        getContext:()=>{
            if (! drawing.current) return;
            return drawing.current.getContext();
        },
        /**
         * get the canvas size
         * @returns {number[]} [width,height]
         */
        getDimensions:()=>{
            if (! drawing.current) return [0,0];
            let cv=drawing.current.getContext().canvas;
            return [cv.width*drawing.current.getDevPixelRatio(),cv.height*drawing.current.getDevPixelRatio()];
        },
        /**
         * function to trigger a new render of the map
         * this function can also be called outside the renderCanvas function - e.g. from a timer
         */
        triggerRender:()=>{
            window.setTimeout(()=>props.triggerRender(),0);
        }
    });
    const getProps=()=>{
        if (! props.translateFunction){
            return props;
        }
        else{
            return {...props,...props.translateFunction(...props)};
        }
    }
    useEffect(() => {
        if (typeof(props.initFunction) === 'function'){
            try {
                props.initFunction.call(userContext.current, userContext.current, getProps());
            }catch(e){
                base.log("error in user init function for "+props.name+": "+e);
            }
        }
        if (props.registerMap){
            props.registerMap((currentDrawing,center)=>{
                drawing.current=currentDrawing;
                try{
                    props.renderCanvas.call(userContext.current,drawing.current.getContext().canvas,getProps());
                }catch(e){
                    base.log("error in user renderCanvas function for "+props.name+": "+e);
                }
                drawing.current=undefined;
            })
        }
        return () => {
            if (typeof (props.finalizeFunction) === 'function') {
                try {
                    props.finalizeFunction.call(userContext.current, userContext.current, getProps());
                } catch (e) {
                    base.log("error in user finalize function for " + props.name + ": " + e);
                }
            }
            if (props.registerMap) {
                props.registerMap()
            }
        }
    },[] );
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