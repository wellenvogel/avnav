import {SyntheticEvent, useEffect, useRef, useState} from "react";
// @ts-ignore
import KeyHandler from './keyhandler';
// @ts-ignore
import Requests from './requests';
import base from "../base";

export type TimerCallback=(sequence:number)=>void
export interface Timer{
    startTimer:(sequence:number)=>void;
    stopTimer:(sequence:number)=>void;
    setTimeout:(newInterval:number,opt_stop?:boolean)=>void;
    currentSequence:()=>number;
    guardedCall:(sequence:number,callback:TimerCallback)=>void;
    restart:(witCallback?:boolean)=>void;
}
/**
 *
 * @param timercallback
 * @param interval
 * @param [opt_autostart]
 * @param opt_immediate
 * @returns {{guardedCall: ((function(*, *): (boolean))|*), setTimeout: *, startTimer: (function(*): boolean), currentSequence: (function(): number), stopTimer: (function(*): boolean)}}
 */
export const useTimer=(
    timercallback:TimerCallback,
    interval:number,
    opt_autostart?:boolean,
    opt_immediate?:boolean)=>{
    const timer=useRef(undefined);
    const currentSequence=useRef(0);
    const currentInterval=useRef(interval);
    //we must wrap this into a ref to ensure that always the current callback
    //with an up to date closure is called
    const callbackHandler=useRef(timercallback);
    callbackHandler.current=timercallback;
    const startTimer=(sequence?:number)=>{
        if (sequence !== undefined && sequence !== currentSequence.current) return false;
        if (timer.current !== undefined){
            currentSequence.current++;
            window.clearTimeout(timer.current);
        }
        const startSequence=currentSequence.current;
        timer.current=window.setTimeout(()=>{
            if (currentSequence.current !== startSequence) return;
            timer.current=undefined;
            callbackHandler.current(startSequence);
        },currentInterval.current);
        return true;
    }
    const stopTimer=(sequence?:number)=>{
        if (sequence !== undefined && sequence !== currentSequence.current) return false;
        if (timer.current !== undefined){
            currentSequence.current++;
            window.clearTimeout(timer.current);
            timer.current=undefined;
        }
    }
    useEffect(() => {
        if (opt_immediate && currentSequence.current ===0 ){
            callbackHandler.current(currentSequence.current);
        }
        if (opt_autostart){
            startTimer(0); //only start the timer if this is really an initial call
        }
        return ()=>{
            stopTimer();
        }
    }, []);
    return {
        startTimer:(sequence?:number)=>startTimer(sequence),
        stopTimer:(sequence?:number)=>stopTimer(sequence),
        setTimeout:(newInterval:number,opt_stop?:boolean)=>{
            if (opt_stop) stopTimer();
            currentInterval.current=newInterval;
        },
        currentSequence:()=>currentSequence.current,
        guardedCall:(sequence:number,callback:(seqeunce:number)=>void)=>{
            if (sequence !== undefined && sequence !== currentSequence.current) return false;
            callback(currentSequence.current);
            return true;
        },
        restart(opt_withCallback?:boolean){
            stopTimer(currentSequence.current);
            if (opt_withCallback){
                const sequence=currentSequence.current;
                window.setTimeout(()=>{
                    if (currentSequence.current !== sequence) return;
                    callbackHandler.current(currentSequence.current);
                },0)
            }
            else{
                startTimer(currentSequence.current);
            }
        }
    }
}

export enum ScrollType{
    none=0,
    top=1,
    bottom=2,
    left=3,
    right=4
}
export enum ScrollExeMode{
    none=0,
    vertical=1,
    horizontal=2,
    all=3
}
/**
 *
 * @param parent
 * @param element
 * @param opt_execute 0-no, 1- vert, 2-horiz , 3 -all
 * @returns {number|boolean}
 //from https://stackoverflow.com/questions/487073/how-to-check-if-element-is-visible-after-scrolling
 //returns:
 //0 - no scroll
 //1 - scrollTop
 //2 - scrollBottom
 //3 - left
 //4 - right
 */
export const scrollInContainer=(
    parent:HTMLElement,
    element:HTMLElement,
    opt_execute?:ScrollExeMode)=> {
    if (!parent || ! element) return false;
    const parentRect = parent.getBoundingClientRect();
    const elRect = element.getBoundingClientRect();
    let rt=0;
    if (elRect.top < parentRect.top) rt= 1;
    if (elRect.bottom > parentRect.bottom) rt= 2;
    if (elRect.left < parentRect.left) rt= 3;
    if (elRect.right > parentRect.right) rt= 4;
    if (opt_execute){
        if (((rt === 1 || rt === 2) && (opt_execute & 1))||
            (rt === 3 || rt === 4) && (opt_execute & 2))
            element.scrollIntoView(rt === 1);
    }
    return rt;
};

export interface KeyEventHandlerProps{
    name?:string,
    onClick?:(event?:SyntheticEvent) => void,
}
export type KeyCallback=(component:string, action:string)=>void

export const useKeyEventHandler=(
    props:KeyEventHandlerProps,
    component: string,
    opt_callback:KeyCallback)=>{
    return useEffect(()=>{
        if (! props.name || ! (props.onClick|| opt_callback)) return;
        const handler=(
            cbComponent:string,
            cbAction:string)=>{
            if (cbComponent === component && cbAction === props.name){
                if (opt_callback) opt_callback(cbComponent,cbAction);
                else props.onClick();
            }
        };
        KeyHandler.registerHandler(handler,component,props.name);
        return ()=>{
            KeyHandler.deregisterHandler(handler);
        }
    },[])
}
export const useKeyEventHandlerPlain=(
    name:string,
    component:string,
    callback:KeyCallback)=>{
    return useKeyEventHandler({name:name},component,callback);
}

export const getServerCommand=(name:string)=>{
    return Requests.getJson({
        request:'api',
        type:'command',
        command:'list'
    })
        .then((data:any)=> {
            if (!data.data) return;
            for (let i=0;i<data.data.length;i++){
                if (data.data[i].name === name){
                    return data.data[i];
                }
            }
        })
        .catch(()=>base.log("unable to query server command "+name));
}

/**
 * helper for the react callback issue
 * you can use the stateRef in callbacks to obtain the current value of the state
 * @param initial
 * @return {[unknown,(value: unknown) => void,React.MutableRefObject<unknown>]}
 */
export const useStateRef=(initial:any)=>{
    const [state,setState]=useState(initial);
    const stateRef=useRef(initial);
    stateRef.current=state;
    return [state,setState,stateRef];
}