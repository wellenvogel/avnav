import React from 'react';
import PropTypes from 'prop-types';

const Button=function(props){
    let className=props.className||"";
    className+=" button "+props.name;
    if (props.toggle !== undefined){
        className+=props.toggle?" active":" inactive";
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