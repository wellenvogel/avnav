/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React, {Children, cloneElement, forwardRef, ReactNode, SyntheticEvent, useEffect, useRef, useState} from 'react';
import DialogButton, {DialogButtonProps} from './DialogButton';
// @ts-ignore
import MapEventGuard from "../hoc/MapEventGuard";
import Helper, {concatsp} from "../util/helper";
import {
    DialogCallback,
    DialogContextImpl, dialogManager,
    globalContext,
    IDialogContext,
    ReactDialogContextImpl, SetDialogFunction,
    SetDialogOptions,
    useDialogContext
} from "./DialogContext";
import Headline from "./Headline";
import base from "../base";
import ButtonDefs from "./ButtonDefs";
// @ts-ignore
import * as btdef from '../style/button_text.less';
import globalstore from "../util/globalstore";
import keys from "../util/keys";
import Store from "../util/store";

export interface OverlayContainerProps {
    coverClassName?: string;
    children?: React.ReactNode;
    onClick?: (ev: SyntheticEvent) => void;
}

// eslint-disable-next-line react/display-name
export const OverlayContainer=MapEventGuard(
    (oprops:OverlayContainerProps)=>{
    const ref=useRef<HTMLDivElement>(null);
    const dialogContext=useDialogContext();
    const style={zIndex:dialogContext.zIndex};
    return (
        <div
            className={Helper.concatsp("overlay_cover_active",oprops.coverClassName)}
            onClick={(ev:SyntheticEvent)=>{
                if (ev.target===ref.current) {
                    oprops.onClick(ev);
                    ev.stopPropagation();
                }
            }}
            style={style}
            ref={ref}>
            <React.Fragment>
            {oprops.children}
            </React.Fragment>
        </div>
    )
});
export interface OverlayDialogProps{
    coverClassName?: string;
    children?: React.ReactElement;
}

let displayId= globalContext.getId();
const nextId=()=>{
    displayId++;
    return displayId;
}
const activeInputs:Record<number,boolean>={}
export const useInputMonitor=(opt_store?:Store)=>{
    const store=opt_store?opt_store:globalstore;
    useEffect(() => {
        const id=nextId();
        activeInputs[id]=true;
        store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        return ()=>{
            delete activeInputs[id];
            store.storeData(keys.gui.global.hasActiveInputs,Object.keys(activeInputs).length > 0);
        }
    }, []);
}
const OverlayDialog = (
    {coverClassName, children}:OverlayDialogProps) => {
    const dialogContext = useDialogContext();
    const nestedDialogContext = useRef(new DialogContextImpl(nextId(), dialogContext));
    useInputMonitor();
    return (
        <OverlayContainer
            onClick={async (ev:SyntheticEvent) => {
                ev.stopPropagation();
                ev.preventDefault();
                await nestedDialogContext.current?.closeDialog()
            }}
            coverClassName={coverClassName}
        >
            <DialogContext
                context={nestedDialogContext.current}
            >
                <DialogDisplay name={'nested'}/>
                {Children.map(children,
                    (child) => cloneElement(child, {closeCallback: close}))}
            </DialogContext>
        </OverlayContainer>
    );
}

export const DialogDisplay=({name}:{name?:string})=>{
    const dialogContext=useDialogContext();
    const nameRef=useRef(name);
    const idRef=useRef("d"+nextId());
    const [Display,setDialog,closeDialog]=useDialog(idRef.current);
    useEffect(() => {
        const id=dialogContext.setDisplay(idRef.current,setDialog,closeDialog);
        base.log("set dialog display", nameRef.current,id);
        return ()=>{
            base.log("remove dialog display", nameRef.current,id);
            dialogContext.removeDisplay(id);
        }
    }, []);
    return <Display/>
}




export const DialogContext=(
    {context,children}:{context:DialogContextImpl,children:React.ReactNode})=>{
    return <ReactDialogContextImpl.Provider value={context||globalContext}>
        {children}
    </ReactDialogContextImpl.Provider>
}

export type UseDialogResult=[React.ElementType,SetDialogFunction,DialogCallback];
const useDialog=(displayId:string):UseDialogResult=>{
    const dialogContext = useDialogContext();
    const [dialogContent,setDialog]=useState(undefined);
    const lastContent=useRef(undefined);
    const resetDialog=(opt_id?:number):Promise<void>=>{
        return new Promise(resolve=>{
            window.requestAnimationFrame(() => {
                const currentContent=lastContent.current;
                if (currentContent && (opt_id === undefined ||  currentContent.id === opt_id)) {
                    dialogManager.resetDialog(dialogContext.getId(),displayId,opt_id);
                    setDialog(undefined)
                    lastContent.current = undefined;
                }
                resolve();
            })
        });
    }
    const setNewDialog=(
                        content:React.ElementType,
                        opt_closeCb?:()=>void,
                        opt_options?:SetDialogOptions,
                        ):Promise<DialogCallback>=>{
        return new Promise((resolve) => {
            const id=nextId();
            window.requestAnimationFrame(() => {
                const currentContent = lastContent.current;
                if (!content) content = () => <div>Empty</div>
                if (currentContent) {
                    if (currentContent.close) currentContent.close();
                    //we will not call the global close callback
                }
                const newValues = {content: content, close: opt_closeCb, id: id, options: opt_options};
                setDialog(newValues);
                dialogManager.setDialog(dialogContext.getId(),displayId,id,opt_closeCb);
                lastContent.current = newValues;
                resolve(() => {
                    //as the returned function can be called any time
                    //later we need to check if this is still the expected dialog
                    //that we are going to close
                    return resetDialog(id);
                });
            });
        });
    };
    return [
        () => {
            if (!dialogContent || !dialogContent.content) {
                dialogManager.resetDialog(dialogContext.getId(),displayId);
                return null;
            }
            const {coverClassName}=dialogContent.options||{}
            return (
                <OverlayDialog
                    coverClassName={coverClassName}
                >
                    <dialogContent.content/>
                </OverlayDialog>

            )
        }
        ,
        (content:React.ElementType,opt_closeCb?:()=>void,opt_options?:SetDialogOptions)=>{
            return setNewDialog(content,opt_closeCb,opt_options);
        },
        (id?:number)=>resetDialog(id)
    ]
}
export const showPromiseDialog=<T=any,>(
    dialogContext:IDialogContext|undefined,
    Dialog:React.ElementType,
    args?:Record<string, any>,
    opt_options?:SetDialogOptions)=>{
    if (!dialogContext) dialogContext=globalContext;
    return new Promise<T>((resolve,reject)=>{
        let resolved=false;
        showDialog(dialogContext,()=>{
            return <Dialog {...args} resolveFunction={(val:any)=>{
                resolved=true;
                resolve(val);
                return true;
            }} />
        },()=>{
            //give the resolve a chance to win
            window.setTimeout(()=> {
                if (!resolved) reject();
            },0);
        },opt_options);
    })
}
export const showPromiseDialogTrue=(dialogContext:IDialogContext|undefined,
                                    Dialog:React.ElementType,
                                    args?:Record<string, any>,
                                    opt_options?:SetDialogOptions)=>{
    return showPromiseDialog(dialogContext,Dialog,args,opt_options)
        .then((v:any)=>{
            if (v) return v;
            return true
        },()=>false)
}
export const showDialog=(
    opt_dialogContext:IDialogContext|undefined,
    dialog:React.ElementType,
    opt_cancelCallback?:()=>void,
    opt_options?:SetDialogOptions)=>{
    if (opt_dialogContext){
        if (! opt_dialogContext.showDialog){
                opt_dialogContext=undefined;
        }
    }
    if (! opt_dialogContext) {
        const cancel=()=>{
            // @ts-ignore
            if (window.avnavAndroid && window.avnavAndroid.dialogClosed){
                // @ts-ignore
                window.avnavAndroid.dialogClosed();
            }
            if (opt_cancelCallback) opt_cancelCallback();
        }
        return globalContext.showDialog(dialog,cancel,opt_options);
    }
    else return opt_dialogContext.showDialog(dialog,opt_cancelCallback,opt_options);
}

export interface PromiseResolveHelperProps{
    ok:()=>void
    err?:(e?:any)=>void
}

export const promiseResolveHelper = (
    {ok, err}:PromiseResolveHelperProps,
    resolveFunction:(r:any)=>boolean|void|Promise<void>,
    args:any) => {
    const rt = resolveFunction(args);
    if (rt instanceof Promise) {
        rt.then(() => ok && ok())
            .catch((e) => {
                err && err(e)
            })
        return;
    }
    if (rt) ok && ok();
    else err && err();
}

export interface DialogFrameProps extends Record<string, any>{
    title?:ReactNode;
    className?:string;
    flex?:boolean;
    fullscreen?:boolean;
    children?:React.ReactNode;
}

export const DialogFrame=(props:DialogFrameProps)=>{
    const frameRef=useRef<HTMLDivElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {title,className,flex,children,...fwprops}=props;
    if (props.fullscreen){
        return <div className={Helper.concatsp('dialog',className,'fullscreen')} ref={frameRef}>
            {title &&<Headline title={title} dynamicTitleIcons={false}/>}
            {children}
        </div>
    }
    return <div {...fwprops} className={Helper.concatsp('dialog',className)}>
        {(title)?<h3 className="dialogTitle">{title}</h3>:null}
        {children}
    </div>
}

export const DialogFlexInner=(props:DialogTextProps)=>{
    return <div className={Helper.concatsp(props.className,'flexInner')}>
        {props.children}
    </div>

}
export interface DialogTextProps{
    className?:string;
    children?:React.ReactNode;
}
export const DialogText=({className,children}:DialogTextProps)=>{
    return <div className={concatsp(className,"dialogText")}>
        {children}
    </div>
}
export interface DialogRowProps{
    className?:string;
    children?:React.ReactNode;
    onClick?:(ev?:SyntheticEvent)=>void;
}
export const DialogRow=
    // eslint-disable-next-line react/display-name,react/prop-types
    forwardRef<HTMLDivElement,React.HTMLProps<HTMLDivElement>>(({className,onClick,children}:DialogRowProps,ref)=>{
    return <div className={concatsp(className,"dialogRow")} ref={ref} onClick={onClick}>
        {children}
    </div>
})
export type DialogButtonDef=DialogButtonProps|((props:any) => React.ReactNode)
export interface DialogButtonListProps extends Record<string, any>{
    className?:string;
    children?:React.ReactNode;
    buttonList?:DialogButtonDef|DialogButtonDef[];
}
export const DialogButtons=(props:DialogButtonListProps)=>{
    const {className,children,buttonList,...fw}=props;
    let buttons=buttonList;
    if (! (buttons instanceof Array)) buttons=[buttons];
    return <div {...fw} className={Helper.concatsp("dialogButtons",className)}>
        {buttons.map((button:DialogButtonDef)=>{
            if (! button) return null;
            if (typeof(button) === 'function'){
                const El=button;
                // eslint-disable-next-line react/jsx-key
                return <El/>
            }
            let label;
            //temp: fallback to old style handling if no buttondef yet
            if (! button.name || ! btdef[button.name]) {
                label = button.shortText ? button.shortText : button.name.substring(0, 1).toUpperCase() + button.name.substring(1);
            }
            return <DialogButton {...button} key={button.name}>
                {label}
            </DialogButton>
        })}
        {children}
    </div>
}
/**
 * helper for dialogButtonList
 */
export const DBCancel=(props?:Partial<DialogButtonProps>)=>{
    return {close: true,...ButtonDefs.DBCancel,...props};
}
export const DBOk=(onClick?:(ev:SyntheticEvent)=>void,props?:Partial<DialogButtonProps>)=>{
    return {close: true,...ButtonDefs.DBOk ,onClick:onClick,...props};
}


