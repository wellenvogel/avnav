import React from 'react';
import PropTypes from 'prop-types';

const Button=function(props){
    let className=props.className||"";
    className+=" button "+props.name;
    if (props.toggle !== undefined){
        className+=props.toggle?" active":" inactive";
    }
    let {toggle,icon,style,...forward}=props;
    if (! style) style={};
    if (icon !== undefined) {
        style.backgroundImage="url("+icon+")";
    }
    return(
        <button {...forward} className={className} style={style}/>
    );
};

Button.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    toggle: PropTypes.bool,
    name: PropTypes.string.isRequired,
    icon: PropTypes.string,
    style: PropTypes.object
};

module.exports=Button;