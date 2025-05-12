import React from 'react';
import {DynamicTitleIcons} from "./TitleIcons";
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
const storeKeys={
    connectionLostState: keys.nav.gps.connectionLost
}
const Headline= (iprops)=>{
    const props=useStore(iprops,{storeKeys:storeKeys});
    let className="header ";
    if (props.className) className+=props.className;
    if (props.connectionLost && props.connectionLostState) className+=" connectionLost";
    return <div className={className}>
        <span>{props.title}</span>
        <DynamicTitleIcons/>
    </div>
};
export default Headline;