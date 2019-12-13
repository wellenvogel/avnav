import React from 'react';
import PropTypes from 'prop-types';
import GuiHelper from '../util/GuiHelpers.js';

class Button extends React.Component {
    constructor(props){
        super(props);
        let self=this;
        GuiHelper.keyEventHandler(this,(component,action)=>{
            if (self.props.onClick && ! self.props.disabled) self.props.onClick();
        },"button",this.props.name);
    }
    render() {
        let className = this.props.className || "";
        className += " button " + this.props.name;
        if (this.props.toggle !== undefined) {
            className += this.props.toggle ? " active" : " inactive";
        }
        let {toggle,icon,style,disabled,...forward}=this.props;
        let spanStyle={};
        if (icon !== undefined) {
            spanStyle.backgroundImage = "url(" + icon + ")";
        }
        let add = {};
        if (disabled) {
            add.disabled = "disabled";
        }
        return (
            <button {...forward} {...add} className={className}>
            <span style={spanStyle}/>
            </button>
        );
    }
}

Button.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    toggle: PropTypes.bool,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    style: PropTypes.object,
    disabled: PropTypes.bool
};

module.exports=Button;