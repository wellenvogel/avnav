import React from 'react';
import PropTypes from 'prop-types';
import GuiHelper from '../util/GuiHelpers.js';
import KeyHandler from '../util/keyhandler';

class DialogButton extends React.Component {
    constructor(props){
        super(props);
        KeyHandler.registerDialogComponent("dialogButton");
        GuiHelper.keyEventHandler(this,(component,action)=>{
            if (this.props.onClick && ! this.props.disabled && this.props.visible !== false) this.props.onClick();
        },"dialogButton",this.props.name);
    }
    render() {
        let {icon,style,disabled,visible,...forward}=this.props;
        if (visible === false) return null;
        let className = this.props.className || "";
        className += " dialogButton " + this.props.name;
        let spanStyle={};
        if (icon !== undefined) {
            className+=" icon";
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        className+=this.props.toggle?" active":" inactive";
        let add = {};
        if (disabled) {
            add.disabled = true;
        }
        return (
            <button {...forward} {...add} className={className}>
            <span style={spanStyle}/>
                {this.props.children}
            </button>
        );
    }
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