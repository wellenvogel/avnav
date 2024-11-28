/**
 * Created by andreas on 23.02.16.
 */

import React, {useEffect, useRef, useState} from "react";
import PropTypes from 'prop-types';
import ReactHtmlParser,{convertNodeToElement} from 'react-html-parser/dist/react-html-parser.min.js';
import base from '../base.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const REACT_EVENTS=('onCopy onCut onPaste onCompositionEnd onCompositionStart onCompositionUpdate onKeyDown onKeyPress onKeyUp'+
    ' onFocus onBlur onChange onInput onInvalid onReset onSubmit onError onLoad onClick onContextMenu onDoubleClick onDrag onDragEnd onDragEnter onDragExit'+
    ' onDragLeave onDragOver onDragStart onDrop onMouseDown onMouseEnter onMouseLeave onMouseMove onMouseOut onMouseOver onMouseUp'+
    ' onPointerDown onPointerMove onPointerUp onPointerCancel onGotPointerCapture onLostPointerCapture onPointerEnter onPointerLeave'+
    ' onPointerOver onPointerOut onSelect onTouchCancel onTouchEnd onTouchMove onTouchStart onScroll onWheel'+
    ' onAbort onCanPlay onCanPlayThrough onDurationChange onEmptied onEncrypted onEnded onError onLoadedData' +
    ' onLoadedMetadata onLoadStart onPause onPlay onPlaying onProgress onRateChange onSeeked onSeeking onStalled onSuspend'+
    ' onTimeUpdate onVolumeChange onWaiting onLoad onError onAnimationStart onAnimationEnd onAnimationIteration onTransitionEnd'+
    ' onToggle').split(/  */);

let EVENT_TRANSLATIONS={};
REACT_EVENTS.forEach((name)=>{
    EVENT_TRANSLATIONS[name.toLowerCase()]=name;
})

const transform=(self,node,index)=>{
    if (node && node.attribs){
        for (let k in node.attribs){
            if (k.match(/^on../)){
                let evstring=node.attribs[k];
                if (!self.eventHandler || ! self.eventHandler[evstring]) {
                    base.log("external widget, no event handler for "+evstring);
                    continue;
                }
                let translated=EVENT_TRANSLATIONS[k];
                let nk;
                if (translated){
                    nk=translated;
                }
                else {
                    nk = "on" + k.substr(2, 1).toUpperCase() + k.substring(3);
                }
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

export const ExternalWidget =(props)=>{
    const [updateCount,setUpdateCount]=useState(1);
    const initialCalled=useRef(false);
    const canvasRef=useRef(null);
    const getProps=()=>{
        if (props.translateFunction) return {...props,...props.translateFunction({...props})};
        return props;
    };
    const userData=useRef( {
        eventHandler: [],
        triggerRedraw: () => {
            setUpdateCount(updateCount+1)
        }
    });
    if (! initialCalled.current && typeof (props.initFunction) === 'function') {
        initialCalled.current=true;
        props.initFunction.call(userData.current, userData.current, getProps());
    }
    useEffect(()=>{
        if (canvasRef.current && props.renderCanvas){
            props.renderCanvas.apply(userData.current,[canvasRef.current,getProps()]);
        }

        return ()=>{
            if (initialCalled.current &&  typeof(props.finalizeFunction) === 'function'){
                props.finalizeFunction.call(userData.current,userData.current,getProps());
            }
            initialCalled.current=false;
        }
    })
    
        let convertedProps=getProps();
        let innerHtml=null;
        if (props.renderHtml){
            try {
                innerHtml = props.renderHtml.apply(userData.current,[convertedProps]);
            }catch (e){
                base.log("External Widget: render error "+e);
                innerHtml="<p>render error </p>";
            }
            if (innerHtml === null){
                return null;
            }
        }
        let userHtml=(innerHtml!=null)?ReactHtmlParser(innerHtml,
            {transform:(node,index)=>{transform(userData.current,node,index);}}):null;
        return (
        <WidgetFrame {...convertedProps} addClass="externalWidget" onClick={props.onClick} >
            {props.renderCanvas?<canvas className='widgetData' ref={canvasRef}></canvas>:null}
                {userHtml}
        </WidgetFrame>
        );
}

ExternalWidget.propTypes={
    ...WidgetProps,
    name: PropTypes.string,
    unit: PropTypes.string,
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