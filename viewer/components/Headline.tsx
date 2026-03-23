import React from 'react';
// @ts-ignore
import {DynamicTitleIcons} from "./TitleIcons";
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
import Helper from "../util/helper";
const storeKeys={
    connectionLostState: keys.nav.gps.connectionLost
}
export interface THeadline{
    title?: string|React.ReactNode;
    className?:string;
    connectionLost?:boolean;
    dynamicTitleIcons?:boolean;
}
interface THeadlineInt extends THeadline{
    connectionLostState?:boolean;
}
const Headline= (iprops:THeadline)=>{
    const vprops:THeadlineInt=useStore(iprops,{storeKeys:storeKeys});
    let className=Helper.concatsp("header",vprops.className);
    // eslint-disable-next-line react/prop-types
    if (vprops.connectionLost && vprops.connectionLostState) className+=" connectionLost";
    return <div className={className}>
        <span>{vprops.title}</span>
        {Helper.unsetorTrue(vprops.dynamicTitleIcons) && <DynamicTitleIcons/>}
    </div>
};
export default Headline;