import React from 'react';
import PropTypes from 'prop-types';
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';
import KeyHandler from '../util/keyhandler';
import {concatsp} from "../util/helper";
import {useDialogContext} from "./OverlayDialog";

const COMPONENT="dialogButton";
const DialogButton=(props)=>{
        const dialogContext=useDialogContext();
        KeyHandler.registerDialogComponent(COMPONENT);
        useKeyEventHandlerPlain(props.name,COMPONENT,()=>{
            if (props.onClick && ! props.disabled && props.visible !== false) props.onClick();
        });
        let {icon,style,disabled,visible,name,className,toggle,children,onClick,close,...forward}=props;
        if (visible === false) return null;
        let spanStyle={};
        if (icon !== undefined) {
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        let add = {};
        if (disabled) {
            add.disabled = true;
        }
        return (
            <button
                {...forward}
                {...add}
                onClick={(ev)=>{
                    if (! onClick || close) dialogContext.closeDialog();
                    if (onClick) onClick(ev);
                }}
                className={concatsp("dialogButton",name,(icon !== undefined)?"icon":undefined,toggle?"active":"inactive")}
            >
            <span style={spanStyle}/>
                {children}
            </button>
        );
    }

DialogButton.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    style: PropTypes.object,
    disabled: PropTypes.bool,
    toggle: PropTypes.bool,
    visible: PropTypes.bool,
    close: PropTypes.bool
};

export default DialogButton;