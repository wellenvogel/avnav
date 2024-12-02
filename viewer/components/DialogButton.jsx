import React from 'react';
import PropTypes from 'prop-types';
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';
import KeyHandler from '../util/keyhandler';

const COMPONENT="dialogButton";
const DialogButton=(props)=>{
        KeyHandler.registerDialogComponent(COMPONENT);
        useKeyEventHandlerPlain(props.name,COMPONENT,()=>{
            if (props.onClick && ! props.disabled && props.visible !== false) props.onClick();
        });
        let {icon,style,disabled,visible,name,className,toggle,children,...forward}=props;
        if (visible === false) return null;
        if (className === undefined) className="";
        className += " dialogButton " + name;
        let spanStyle={};
        if (icon !== undefined) {
            className+=" icon";
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        className+=toggle?" active":" inactive";
        let add = {};
        if (disabled) {
            add.disabled = true;
        }
        return (
            <button {...forward} {...add} className={className}>
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
    visible: PropTypes.bool
};

export default DialogButton;