import React from 'react';
import {useKeyEventHandlerPlain} from '../util/UiHelper';
import KeyHandler from '../util/keyhandler';
import {concatsp, setav} from "../util/helper";
import {useStore} from "../hoc/Dynamic";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {ButtonEvent, ButtonEventHandler} from "./Button";

export interface DialogButtonProps{
    onClick?: ButtonEventHandler;
    onPreClose?: (ev:ButtonEvent,ctx:IDialogContext)=>boolean;
    className?: string;
    name?: string;
    icon?: string;
    style?: Record<string, any>;
    disabled?: boolean;
    toggle?: boolean;
    visible?: boolean;
    close?: boolean;  //default: true
    children?: React.ReactNode;
}
const COMPONENT="dialogButton";
const DialogButton=(props:DialogButtonProps)=>{
        const dialogContext=useDialogContext();
        KeyHandler.registerDialogComponent(COMPONENT);
    // eslint-disable-next-line prefer-const
        let {icon,style,disabled,visible,name,className,toggle,children,onClick,close,onPreClose,...forward}=useStore(props);
        const spanStyle:Record<string, any>={};
        if (icon !== undefined) {
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        const add:Record<string, any> = {};
        if (disabled) {
            add.disabled = true;
        }
        if (close === undefined) close=true;
        const clickHandler=(ev:ButtonEvent)=>{
            setav(ev,{dialogContext:dialogContext});
            if (! onClick || close) {
                let closeDialog=true;
                if (onPreClose) {
                    if (! onPreClose(ev,dialogContext)) closeDialog=false;
                }
                if (closeDialog) dialogContext.closeDialog();
            }
            if (onClick) onClick(ev,dialogContext);
        };
        useKeyEventHandlerPlain(props.name,COMPONENT,()=>{
            if ( ! disabled && visible !== false) clickHandler({});
        });
        if (visible === false) return null;
        return (
            <button
                {...forward}
                {...add}
                {...style}
                name={name}
                onClick={clickHandler}
                className={concatsp("dialogButton",name,(icon !== undefined)?"icon":undefined,toggle?"active":"inactive",className)}
            >
            <span style={spanStyle}/>
                {children}
            </button>
        );
    }



export default DialogButton;