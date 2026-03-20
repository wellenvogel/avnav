
export type TimerCallback=(sequence:number)=>void
export interface Timer{
    startTimer:(sequence:number)=>void;
    stopTimer:(sequence:number)=>void;
    setTimeout:(newInterval:number,opt_stop?:boolean)=>void;
    currentSequence:()=>number;
    guardedCall:(sequence:number,callback:TimerCallback)=>void;
    restart:(witCallback?:boolean)=>void;
}
export declare function useTimer(
    timercallback:TimerCallback,
    interval:number,
    opt_autostart?:boolean,
    opt_immediate?:boolean):Timer;