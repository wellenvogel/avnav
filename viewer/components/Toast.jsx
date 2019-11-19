/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Helper from '../util/helper.js';
import Dynamic from '../hoc/Dynamic.jsx';
import keys from '../util/keys.jsx';
import globalStore from '../util/globalstore.jsx';

export const ToastComponent=(props)=>{
        if (! props.html ){
            return null;
        }
        var style=props.style||{};
        return (
        <div className={"toast "+props.className||""} onClick={()=>{
            if (props.onClick)props.onClick();
            }}
        style={style}>
            {props.html}
        </div>
        );
};

ToastComponent.propTypes={
    html: PropTypes.string,
    onClick: PropTypes.func,
    className: PropTypes.string
};
const storeKeys={
    html:keys.gui.global.toastText,
    time:keys.gui.global.toastTimeout,
    onClick:keys.gui.global.toastCallback
};
export const ToastDisplay=Dynamic(ToastComponent,{
    storeKeys:storeKeys
});

let toastTimer=undefined;

const clearTimer=()=>{
    if (toastTimer){
        window.clearTimeout(toastTimer);
        toastTimer=undefined;
    }
};
const Toast=(html,time,opt_callback)=>{
    clearTimer();
    globalStore.storeMultiple({
        html:html,
        time:time,
        onClick:()=> {
            hideToast();
            if(opt_callback) opt_callback();
        }
    },storeKeys);
    if (time){
        toastTimer=window.setInterval(hideToast,time);
    }
};
export default Toast;
export const hideToast=()=>{
    clearTimer();
    globalStore.storeMultiple({
        html:undefined,
        time:undefined,
        onClick:undefined
    },storeKeys)
};


