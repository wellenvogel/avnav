import React from 'react';
import PropTypes from 'prop-types';

const Button=function(props){
    let className=props.className||"";
    className+=" avn_button avb_"+props.name;
    if (props.toggle !== undefined){
        className+=props.toggle?" avb_toggleButton avn_buttonActive":" avb_toggleButton avn_button_inactive";
    }
    let {toggle,...forward}=props;
    return(
        <button {...forward} className={className}/>
    );
};

Button.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    toggle: PropTypes.bool,
    name: PropTypes.string.isRequired
};

module.exports=Button;