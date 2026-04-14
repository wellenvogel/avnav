import React from 'react';
// @ts-ignore
import {DynamicTitleIcons} from "./TitleIcons";
// @ts-ignore
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
import PropTypes from "prop-types";
// @ts-ignore
import Helper from "../util/helper";
const storeKeys={
    connectionLostState: keys.nav.gps.connectionLost
}
export interface THeadline{
    title?: string|React.ReactNode;
    className?:string;
    connectionLost?:boolean;
}
interface THeadlineInt extends THeadline{
    connectionLostState?:boolean;
}
const Headline= (iprops:THeadline)=>{
    const props:THeadlineInt=useStore(iprops,{storeKeys:storeKeys});
    let className=Helper.concatsp("header",props.className);
    // eslint-disable-next-line react/prop-types
    if (props.connectionLost && props.connectionLostState) className+=" connectionLost";
    return <div className={className}>
        <span>{props.title}</span>
        <DynamicTitleIcons/>
    </div>
};
Headline.propTypes={
    className: PropTypes.string,
    connectionLost: PropTypes.bool, //show connection lost
    title: PropTypes.string

}
export default Headline;