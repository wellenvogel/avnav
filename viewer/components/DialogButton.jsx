import React from 'react';
import PropTypes from 'prop-types';
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';
import KeyHandler from '../util/keyhandler';
import {concatsp} from "../util/helper";
import {useDialogContext} from "./OverlayDialog";
import {useStore} from "../hoc/Dynamic";

const COMPONENT="dialogButton";
const DialogButton=(props)=>{
        const dialogContext=useDialogContext();
        KeyHandler.registerDialogComponent(COMPONENT);
        let {icon,style,disabled,visible,name,className,toggle,children,onClick,close,onPreClose,...forward}=useStore(props);
        if (visible === false) return null;
        let spanStyle={};
        if (icon !== undefined) {
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        let add = {};
        if (disabled) {
            add.disabled = true;
        }
        if (close === undefined) close=true;
        const clickHandler=(ev)=>{
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
            if ( ! props.disabled && props.visible !== false) clickHandler({});
        });
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

DialogButton.propTypes={
    onClick: PropTypes.func,
    onPreClose: PropTypes.func,
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    style: PropTypes.object,
    disabled: PropTypes.bool,
    toggle: PropTypes.bool,
    visible: PropTypes.bool,
    close: PropTypes.bool  //default: true
};

export default DialogButton;