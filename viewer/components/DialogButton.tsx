import React from 'react';
import {useKeyEventHandlerPlain} from '../util/UiHelper';
import {DialogKeyComponents} from '../util/keyhandler';
import {concatsp, setav} from "../util/helper";
import {Options, useStore} from "../hoc/Dynamic";
import {IDialogContext, useDialogContext} from "./DialogContext";
import {ButtonEvent, ButtonEventHandler} from "./Button";
import {Icon} from "./Icons";
import {ButtonBase} from "../api/api.interface";

export interface DialogButtonProps extends Options,ButtonBase{
    onClick?: ButtonEventHandler;
    onPreClose?: (ev:ButtonEvent,ctx:IDialogContext)=>boolean;
    className?: string;
    icon?: string;
    style?: Record<string, any>;
    disabled?: boolean;
    toggle?: boolean;
    close?: boolean;  //default: true
    children?: React.ReactNode;
}
const COMPONENT=DialogKeyComponents.DIALOGBUTTON;
const DialogButton=(props:DialogButtonProps)=>{
        const dialogContext=useDialogContext();
    // eslint-disable-next-line prefer-const
        let {icon,longText,style,disabled,visible,name,className,toggle,children,onClick,close,onPreClose,iconClass,...forward}=useStore(props);
        const add:Record<string, any> = {};
        if (disabled) {
            add.disabled = true;
        }
        if (close === undefined) close=true;
        const clickHandler=(ev:ButtonEvent)=>{
            if (disabled){
                return;
            }
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
            <div
                {...forward}
                {...add}
                {...style}
                onClick={clickHandler}
                className={concatsp("button dialogButton",name,(icon !== undefined)?"icon":undefined,toggle?"active":"inactive",className)}
                title={longText}
            >
            <Icon icon={icon} className={iconClass}/>
                {children}
            </div>
        );
    }



export default DialogButton;