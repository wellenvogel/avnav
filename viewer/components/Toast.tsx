/**
 * Created by andreas on 23.02.16.
 */

import React, {SyntheticEvent} from "react";
import Dynamic from '../hoc/Dynamic';
import keys from '../util/keys';
import globalStore from '../util/globalstore';

export interface ToastProps{
    html?:string,
    onClick?: (ev:SyntheticEvent)=>void
    className?: string
    style?:Record<string, any>
}
export const ToastComponent=(props:ToastProps)=>{
        if (! props.html ){
            return null;
        }
        const style=props.style||{};
        return (
        <div className={"toast "+props.className||""} onClick={(ev)=>{
            if (props.onClick)props.onClick(ev);
            }}
        style={style}>
            {props.html}
        </div>
        );
};

const storeKeys={
    html:keys.gui.global.toastText,
    time:keys.gui.global.toastTimeout,
    onClick:keys.gui.global.toastCallback
};
export const ToastDisplay=Dynamic(ToastComponent,{
    storeKeys:storeKeys
});

let toastTimer:number=undefined;

const clearTimer=()=>{
    if (toastTimer){
        window.clearTimeout(toastTimer);
        toastTimer=undefined;
    }
};
const Toast=(html:string|any,time?:number,opt_callback?:()=>void)=>{
    clearTimer();
    if (! time){
        time=parseInt(globalStore.getData(keys.properties.toastTimeout||15))*1000;
    }
    globalStore.storeMultiple({
        html:html+"",
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
export default  Toast;
export const hideToast=()=>{
    clearTimer();
    globalStore.storeMultiple({
        html:undefined,
        time:undefined,
        onClick:undefined
    },storeKeys)
};


