/**
 * Created by andreas on 23.02.16.
 */

import React, {useEffect, useRef, useState} from "react";
import PropTypes from 'prop-types';
import ReactHtmlParser from 'react-html-parser/dist/react-html-parser.min.js';
import base from '../base.ts';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import Helper from "../util/helper";
import {ErrorBoundary} from "./ErrorBoundary";
import {UserHtml} from "./UserHtml";


export const ExternalWidget =(props)=>{
    let [,setUpdateCount]=useState(1);
    const initialCalled=useRef(false);
    const canvasRef=useRef(null);
    const resizeSequence=useRef(0);
    const getProps=()=>{
        if (props.translateFunction) return {...props,...props.translateFunction({...props})};
        return props;
    };
    const userData=useRef( {
        eventHandler: [],
        triggerRedraw: () => {
            setUpdateCount((previousCount)=>previousCount+1)
        },
        triggerResize: ()=>{
            resizeSequence.current++;
            setUpdateCount((previousCount)=>previousCount+1)
        }
    });
    if (! initialCalled.current && typeof (props.initFunction) === 'function') {
        initialCalled.current=true;
        props.initFunction.call(userData.current, userData.current, getProps());
    }
    //called once after mount/after unmount
    useEffect(() => {
        return ()=>{
            if (initialCalled.current &&  typeof(props.finalizeFunction) === 'function'){
                props.finalizeFunction.call(userData.current,userData.current,getProps());
            }
            initialCalled.current=false;
        }
    }, []);
    //called after every render
    useEffect(()=>{
        if (canvasRef.current && props.renderCanvas){
            props.renderCanvas.apply(userData.current,[canvasRef.current,getProps(),userData.current]);
        }
    })
    
        let convertedProps=getProps();
        let innerHtml=null;
        if (props.renderHtml){
            try {
                innerHtml = props.renderHtml.apply(userData.current,[convertedProps,userData.current]);
            }catch (e){
                base.log("External Widget: render error "+e);
                innerHtml="<p>render error </p>";
            }
            if (innerHtml == null){
                return null;
            }
        }
    return (
        <ErrorBoundary fallback={"render error in widget"}>
            <WidgetFrame {...convertedProps} addClass={Helper.concatsp("externalWidget", props.className)}
                         onClick={props.onClick} resizeSequence={resizeSequence.current}>
                {props.renderCanvas ? <canvas className='widgetData' ref={canvasRef}></canvas> : null}
                {(innerHtml != null) && <UserHtml
                context={userData.current}
                userHtml={innerHtml}
                />}
            </WidgetFrame>
        </ErrorBoundary>
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