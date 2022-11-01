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
        this.spanRef=this.spanRef.bind(this);
    }
    spanRef(item){
        if (! item) return;
        /* very dirty workaround for button images not showing up
           on chrome android on some devices
           was unable to find out about the reason - but it seems that
           setting the image url again solves the issue
         */
        let current=window.getComputedStyle(item).backgroundImage;
        if (current){
            item.style.backgroundImage=current;
        }
    }
    render() {
        let className = this.props.className || "";
        className += " button " + this.props.name;
        if (this.props.toggle !== undefined) {
            className += this.props.toggle ? " active" : " inactive";
        }
        let {toggle,icon,style,disabled,overflow,editDisable,editOnly,visible,dummy,...forward}=this.props;
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
            <span style={spanStyle} ref={this.spanRef}/>
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

export default Button;