import React from 'react';
import {useKeyEventHandlerPlain} from '../util/UiHelper';
import KeyHandler from '../util/keyhandler';
import {concatsp, setav} from "../util/helper";
import {Options, useStore} from "../hoc/Dynamic";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {ButtonEvent, ButtonEventHandler} from "./Button";
import {Icon} from "./Icons";

export interface DialogButtonProps extends Options{
    onClick?: ButtonEventHandler;
    onPreClose?: (ev:ButtonEvent,ctx:IDialogContext)=>boolean;
    className?: string;
    name?: string;
    icon?: string;
    iconClass?: string;
    style?: Record<string, any>;
    disabled?: boolean;
    toggle?: boolean;
    visible?: boolean;
    close?: boolean;  //default: true
    children?: React.ReactNode;
    label?: React.ReactNode;
    displayName?:string;
}
const COMPONENT="dialogButton";
const DialogButton=(props:DialogButtonProps)=>{
        const dialogContext=useDialogContext();
        KeyHandler.registerDialogComponent(COMPONENT);
    // eslint-disable-next-line prefer-const
        let {icon,displayName,style,disabled,visible,name,className,toggle,children,onClick,close,onPreClose,iconClass,...forward}=useStore(props);
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
                className={concatsp("button dialogButton",name,(icon !== undefined)?"icon":undefined,toggle?"active":"inactive",className)}
                title={displayName}
            >
            <Icon icon={icon} className={iconClass}/>
                {children}
            </button>
        );
    }



export default DialogButton;