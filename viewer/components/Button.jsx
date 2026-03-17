import React from 'react';
import PropTypes from 'prop-types';
import {useKeyEventHandlerPlain} from '../util/GuiHelpers.js';
import {useStore} from "../hoc/Dynamic";
import Store from "../util/store";
import {setav} from "../util/helper";
import {useDialogContext} from "./DialogContext";

const Button = (props) => {
    useKeyEventHandlerPlain(props.name, "button", (component, action) => {
        if (props.onClick && !props.disabled) props.onClick();
    });
    const dialogContext=useDialogContext();
    let {toggle, icon, style, disabled, overflow, editDisable, editOnly, visible, dummy,children, ...forward} = props;
    let className = props.className || "";
    className += " button " + props.name;
    if (toggle !== undefined) {
        let togglev = (typeof (toggle) === 'function') ? toggle() : toggle;
        className += togglev ? " active" : " inactive";
    }
    let spanStyle = {};
    if (icon !== undefined) {
        spanStyle.backgroundImage = "url(" + icon + ")";
    }
    let add = {};
    if (disabled) {
        add.disabled = "disabled";
    }
    if (forward.onClick){
        const click=forward.onClick;
        forward.onClick=(ev)=>{
            click(setav(ev,{dialogContext:dialogContext}));
        }
    }
    return (
        <button {...forward} {...add} className={className}>
            <span style={spanStyle}/>
            {children}
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

export const DynamicButton=(props)=>{
    const iprops=useStore(props);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {visible,storeKeys,store,...forward}=iprops;
    if (! visible) return null;
    return <Button {...forward}>{props.children}</Button>;
}
DynamicButton.propTypes={
    ...Button.propTypes,
    storeKeys: PropTypes.object,
    store: PropTypes.instanceOf(Store),
    updateFunction: PropTypes.func,
    visible: PropTypes.bool
}