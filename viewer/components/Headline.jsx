import React from 'react';
import {DynamicTitleIcons} from "./TitleIcons";
export default function(props){
    let className="header ";
    if (props.className) className+=props.className;
    if (props.connectionLost) className+=" connectionLost";
    return <div className={className}>
        <span>{props.title}</span>
        <DynamicTitleIcons/>
    </div>
};