/**
 * Created by andreas on 24.11.16.
 * a simple handler for overlay dialogs
 * at most one dialog at a time will be visible
 * the component must be rendered exactly once
 * if you remove it and re-render all existing dialogs will be closed
 * the static methods will return promises for simple dialog handling
 */

import React, {Children, cloneElement, forwardRef, ReactNode, SyntheticEvent, useEffect, useRef, useState} from 'react';
// @ts-ignore
import {useInputMonitor} from '../hoc/InputMonitor';
import DialogButton, {DialogButtonProps} from './DialogButton';
// @ts-ignore
import MapEventGuard from "../hoc/MapEventGuard";
import PropTypes from "prop-types";
import Helper, {concatsp} from "../util/helper";
import {
    DialogCallback,
    DialogContextImpl,
    globalContext,
    IDialogContext,
    ReactDialogContextImpl, SetDialogFunction,
    SetDialogOptions,
    useDialogContext
} from "./DialogContext";
import Headline from "./Headline";

export interface OverlayContainerProps {
    coverClassName?: string;
    children?: React.ReactNode;
    onClick?: (ev: SyntheticEvent) => void;
    dialogClassName?: string;
}

// eslint-disable-next-line react/display-name
export const OverlayContainer=MapEventGuard(React.forwardRef<any>(
    (oprops:OverlayContainerProps,ref)=>{
    const dialogContext=useDialogContext();
    const style={zIndex:dialogContext.zIndex};
    return (
        <div
            className={Helper.concatsp("overlay_cover_active",oprops.coverClassName)}
            onClick={oprops.onClick}
            style={style}
            ref={ref}>
            <div
                className={Helper.concatsp("dialog",oprops.dialogClassName)}
                onClick={
                    (ev) => {
                        //ev.preventDefault();
                        ev.stopPropagation();
                    }
                }
                style={{zIndex:dialogContext.zIndex+1}}
            >
            {oprops.children}
            </div>
        </div>
    )
}));
export interface OverlayDialogProps{
    dialogClassName?: string;
    coverClassName?: string;
    children?: React.ReactElement;
}
const OverlayDialog = (
    {dialogClassName,coverClassName, children}:OverlayDialogProps) => {
    const dialogContext = useDialogContext();
    const nestedDialogContext = useRef(new DialogContextImpl(dialogContext));
    useInputMonitor();
    return (
        <OverlayContainer
            onClick={async (ev:SyntheticEvent) => {
                ev.stopPropagation();
                ev.preventDefault();
                await nestedDialogContext.current?.closeDialog()
            }}
            dialogClassName={dialogClassName}
            coverClassName={coverClassName}
        >
            <DialogContext
                context={nestedDialogContext.current}
            >
                <DialogDisplay/>
                {Children.map(children,
                    (child) => cloneElement(child, {closeCallback: close}))}
            </DialogContext>
        </OverlayContainer>
    );
}

export const DialogDisplay=()=>{
    const dialogContext=useDialogContext();
    const [Display,setDialog,closeDialog]=useDialog();
    useEffect(() => {
        const id=dialogContext.setDisplay(setDialog,closeDialog);
        return ()=>{
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
const useDialog=(
    closeCb?:()=>void):UseDialogResult=>{
    const [dialogContent,setDialog]=useState(undefined);
    const dialogId=useRef(1);
    const lastContent=useRef(undefined);
    const resetDialog=(opt_id?:string|number):Promise<void>=>{
        return new Promise(resolve=>{
            window.requestAnimationFrame(() => {
                const currentContent=lastContent.current;
                if (currentContent && (opt_id === undefined || currentContent.id === opt_id)) {
                    if (currentContent.close) currentContent.close();
                    if (closeCb) closeCb();
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
            window.requestAnimationFrame(() => {
                const currentContent = lastContent.current;
                if (!content) content = () => <div>Empty</div>
                if (currentContent) {
                    if (currentContent.close) currentContent.close();
                    //we will not call the global close callback
                }
                dialogId.current++;
                const newValues = {content: content, close: opt_closeCb, id: dialogId.current, options: opt_options};
                setDialog(newValues);
                lastContent.current = newValues;
                const id = dialogId.current;
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
            if (!dialogContent || !dialogContent.content) return null;
            const {dialogClassName,coverClassName}=dialogContent.options||{}
            return (
                <OverlayDialog
                    dialogClassName={dialogClassName}
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
    const {title,className,flex,children,...fwprops}=props;
    useEffect(() => {
        if (! props.fullscreen) return;
        if (!frameRef.current) return;
        const parent=frameRef.current.parentElement;
        if (!parent) return;
        if (! parent.classList.contains('fullscreen')) {
            parent.classList.add('fullscreen');
        }
    }, [props.fullscreen]);
    if (props.fullscreen){
        return <div className={Helper.concatsp(className,'dialogFrame')} ref={frameRef}>
            {props.title &&<Headline title={props.title} dynamicTitleIcons={false}/>}
            <div className={Helper.concatsp('inner',(flex !== false)?'flexInner':undefined)}>
                {props.children}
            </div>
        </div>
    }
    return <div {...fwprops} className={Helper.concatsp(className,'dialogFrame',(flex !== false)?'flexInner':undefined)}>
        {(title)?<h3 className="dialogTitle">{title}</h3>:null}
        {children}
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
type DialogButtonDef=DialogButtonProps|((props:any) => React.ReactNode)
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
            const label=button.label?button.label:button.name.substring(0,1).toUpperCase()+button.name.substring(1);
            return <DialogButton {...button} key={button.name}>
                {label}
            </DialogButton>
        })}
        {children}
    </div>
}
DialogButtons.propTypes={
    className: PropTypes.string,
    buttonList: PropTypes.oneOfType([PropTypes.array,PropTypes.object])
}
/**
 * helper for dialogButtonList
 */
export const DBCancel=(props?:DialogButtonProps)=>{
    return {close: true,name:'cancel',label:'Cancel',...props};
}
export const DBOk=(onClick:(ev:SyntheticEvent)=>void,props?:DialogButtonProps)=>{
    return {close: true,name:'ok',onClick:onClick,label:'Ok',...props};
}


