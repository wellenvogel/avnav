import React, {useCallback} from 'react';
import PropTypes from 'prop-types';
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';

const Button = (props) => {
    useKeyEventHandlerPlain(props.name, "button", (component, action) => {
        if (props.onClick && !props.disabled) props.onClick();
    });
    const spanRef = useCallback((item) => {
        if (!item) return;
        /* very dirty workaround for button images not showing up
           on chrome android on some devices
           was unable to find out about the reason - but it seems that
           setting the image url again solves the issue
         */
        let current = window.getComputedStyle(item).backgroundImage;
        if (current) {
            item.style.backgroundImage = current;
        }
    },[]);
    let className = props.className || "";
    className += " button " + props.name;
    if (props.toggle !== undefined) {
        let toggle = (typeof (props.toggle) === 'function') ? props.toggle() : props.toggle;
        className += toggle ? " active" : " inactive";
    }
    let {toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, dummy, ...forward} = props;
    let spanStyle = {};
    if (icon !== undefined) {
        spanStyle.backgroundImage = "url(" + icon + ")";
    }
    let add = {};
    if (disabled) {
        add.disabled = "disabled";
    }
    return (
        <button {...forward} {...add} className={className}>
            <span style={spanStyle} ref={spanRef}/>
        </button>
    );
}

Button.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    toggle: PropTypes.oneOfType([PropTypes.bool,PropTypes.func]),
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    style: PropTypes.object,
    disabled: PropTypes.bool
};

export default Button;