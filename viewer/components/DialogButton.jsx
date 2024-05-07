import React from 'react';
import PropTypes from 'prop-types';
import GuiHelper from '../util/GuiHelpers.js';
import KeyHandler from '../util/keyhandler';

class DialogButton extends React.Component {
    constructor(props){
        super(props);
        let self=this;
        KeyHandler.registerDialogComponent("dialogButton");
        GuiHelper.keyEventHandler(this,(component,action)=>{
            if (self.props.onClick && ! self.props.disabled) self.props.onClick();
        },"dialogButton",this.props.name);
    }
    render() {
        let className = this.props.className || "";
        className += " dialogButton " + this.props.name;
        let {icon,style,disabled,...forward}=this.props;
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
    toggle: PropTypes.bool
};

export default DialogButton;