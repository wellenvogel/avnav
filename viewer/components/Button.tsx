import React, {useCallback, useEffect, useRef} from 'react';
// @ts-ignore
import {useKeyEventHandlerPlain, useStateObject} from '../util/UiHelper';
import {DynamicProps, StoreKeys, UpdateFunction, useStore} from "../hoc/Dynamic";
import Helper, {setav} from "../util/helper";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {CopyAware} from "../util/CopyAware";
import {ListMainSlot} from "./exports";
import {useHistory} from "./HistoryProvider";
import {ButtonContext} from "../api/api.interface";
import base from "../base";
import {ButtonDescription} from "./ButtonList";

export type ButtonEventBase=Record<string, any>;
export interface ButtonEvent extends ButtonEventBase {
    avnav?:{
        context: ButtonContext;
        dialogContext: IDialogContext;
    }
}
export type ButtonEventHandler=((ev:ButtonEvent)=>void)|((ev:ButtonEvent) => Promise<void>);
export enum ButtonAddonType{
    NONE=0,
    USER_HANDLER=1,
    CONFIG=2,
    CONFIG_NEW_WINDOW=3
}
export interface ButtonProps {
        onClick?: ButtonEventHandler;
        className?: string;
        toggle?: boolean|(()=>boolean);
        name: string;
        icon?: string|URL;
        style?: Record<string, any>;
        disabled?:boolean|(()=>boolean);
        overflow?:boolean;
        editDisable?:boolean;
        editOnly?:boolean;
        visible?:boolean;
        children?:React.ReactNode;
        localOnly?:boolean;
        displayName?:React.ReactNode,
        storeKeys?: StoreKeys;
        updateFunction?: UpdateFunction;
        noDialogsClose?: boolean;
        isAddon?: ButtonAddonType;
        dataChanged?:(data:ButtonDescription) => void;
}
export interface DynamicButtonProps extends ButtonProps,DynamicProps {}
export class ButtonDef extends CopyAware implements DynamicButtonProps{
    constructor(props:DynamicButtonProps) {
        super();
        for (const key in props) {
            // @ts-ignore
            this[key] = props[key];
        }
    }

    [x: string]: any;
    storeKeys?: StoreKeys;
    updateFunction?: UpdateFunction;
    dataChanged: (data: ButtonDescription) => void;
    store?: any;
    minTime?: number;

    onClick?: ButtonEventHandler
    className?: string;
    toggle?: boolean | (() => boolean);
    name: string;
    icon?: string|URL;
    style?: Record<string, any>;
    disabled?: boolean|(() => boolean);
    overflow?: boolean;
    editDisable?:boolean;
    editOnly?: boolean;
    visible?: boolean;
    children?: React.ReactNode;
    localOnly?: boolean;
    displayName?: string;
    noDialogsClose?: boolean;
    isAddon?: ButtonAddonType=ButtonAddonType.NONE;
}

const toggleClass=(props:ButtonProps,ctxToggle?:boolean)=> {
    if (ctxToggle !== undefined) {
        return ctxToggle?"active":"inactive";
    }
    if (props.toggle !== undefined) {
        const togglev = (typeof (props.toggle) === 'function') ? props.toggle() : props.toggle;
        return togglev ? " active" : " inactive";
    }
}
const CTXRESERVED='__cleanup';
export const useButtonContext=(initial?:Record<string,any>):ButtonContext=>{
    const ctx=useStateObject(initial||{});
    return {
        getValue: (key: string) => {
            if (key === CTXRESERVED) throw new Error(`cannot use ${CTXRESERVED}`);
            return ctx.getValue(key)
        },
        setValue: (key: string, value: any) => {
            if (key === CTXRESERVED) throw new Error(`cannot use ${CTXRESERVED}`);
            ctx.setValue(key, value)
        },
        setCleanup:(cleanup:()=>(void|Promise<void>))=>{
            ctx.setValue(CTXRESERVED,cleanup);
        },
        cleanup:async ()=>{
            const cf=ctx.getValue(CTXRESERVED);
            if (cf && typeof cf === 'function'){
                await cf();
            }
        }
    }
}

let idx=0
const getIdx=()=>{
    idx++;
    return idx;
}

const Button = (sprops:ButtonProps) => {
    const iprops:ButtonProps=useStore(sprops,{changeCallback:sprops.dataChanged});
    const idxRef=useRef(getIdx());
    const dialogContext=useDialogContext();
    const history = useHistory();
    const ctx =useButtonContext();
    const disabledv=((typeof (iprops.disabled) === 'function') ? iprops.disabled() : iprops.disabled)||
        !!ctx.getValue('disabled');
    const syntheticClick=useCallback(()=>{
        if (sprops.onClick && !disabledv) {
            base.log("synthetic button click",idxRef.current);
            const ev= setav({},{
                dialogContext:dialogContext,
                history:history,
                context:ctx
            });
            if (iprops.noDialogsClose) sprops.onClick(ev);
            else dialogContext.closeDialog().then(()=>sprops.onClick(ev));
        }
    },[iprops.name,sprops.onClick,disabledv])
    useKeyEventHandlerPlain(sprops.name, "button", () => {
        syntheticClick();
    });
    useEffect(() => {
        return ()=>{
            ctx.cleanup();
        }
    }, [sprops.name]);
    for (const k of ['visible','icon','className']){
        const v=ctx.getValue(k);
        if (v !== undefined) {
            // @ts-ignore
            iprops[k]=v;
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {isAddon, className,name,displayName,toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, children,localOnly, ...forward} = iprops;
    if (visible !== undefined && ! visible) {
        return null;
    }
    const classNamev=Helper.concatsp(className,
        'button',
        name,
        toggleClass(iprops,ctx.getValue('toggle')),
        disabled ? 'disabled' : undefined,
    );
    const spanStyle:Record<string, any> = {};
    if (icon !== undefined) {
        spanStyle.backgroundImage = "url(" + icon + ")";
    }
    if (forward.onClick){
        const click=forward.onClick;
        forward.onClick=(ev:ButtonEvent)=>{
            if (disabledv) {
                ev.stopPropagation();
                return;
            }
            const avev=setav(ev,{
                dialogContext:dialogContext,
                history:history,
                context:ctx
            });
            if (iprops.noDialogsClose){
                click(avev);
            }
            else {
                dialogContext.closeDialog().then(() =>
                    click(avev)
                );
            }
        }
    }
    return (
        <div {...forward} className={classNamev} title={displayName+""}>
            <span style={spanStyle}/>
            {children}
        </div>
    );
}

export const ButtonRow=(button:DynamicButtonProps) => {
    const className=Helper.concatsp('buttonRow listEntry',button.className);
    return <Button {...button} className={className} displayName={undefined}>
        <ListMainSlot primary={button.displayName||button.name}></ListMainSlot>
    </Button>
}


export default Button;

export const propsToDefs=(props:DynamicButtonProps[]):ButtonDef[] => {
    const rt:ButtonDef[] = [];
    if (! props) return rt;
    for (const bt of props){
        rt.push(new ButtonDef(bt));
    }
    return rt;
}
export type ButtonUpdate=Partial<DynamicButtonProps> | ((old:Partial<DynamicButtonProps>)=>Partial<DynamicButtonProps>)
export const updateButtons=(buttonDefs:ButtonDef[],updates?:Record<string, ButtonUpdate>):ButtonDef[]=> {
   if (! updates) return buttonDefs;
   const rt:ButtonDef[] = [];
   for (const bt of buttonDefs){
       const update=updates[bt.name];
       if (update){
           if (typeof (update) === 'function') {
               rt.push(bt.copy(update(bt)))
           }
           else {
               rt.push(bt.copy(update));
           }
       }
       else{
           rt.push(bt);
       }
   }
   return rt;
}

export const updateFromOld=(
    buttons:ButtonDef[],
    updates:ButtonUpdate[],
):ButtonDef[] => {
    const converted:Record<string, ButtonUpdate> = {};
    for (const update of updates){
        if (! update.name) continue;
        converted[update.name]=update;
    }
    return updateButtons(buttons,converted);
}