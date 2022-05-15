import React from 'react';
export default function(props){
    let className="header ";
    if (props.className) className+=props.className;
    if (props.connectionLost) className+=" connectionLost";
    return <div className={className}>{props.title}</div>
};