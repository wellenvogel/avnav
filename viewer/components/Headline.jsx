import React from 'react';
import {DynamicTitleIcons} from "./TitleIcons";
import keys from "../util/keys";
import {useStore} from "../hoc/Dynamic";
import PropTypes from "prop-types";
import Helper from "../util/helper";
const storeKeys={
    connectionLostState: keys.nav.gps.connectionLost
}
const Headline= (iprops)=>{
    const props=useStore(iprops,{storeKeys:storeKeys});
    let className=Helper.concatsp("header",props.className);
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