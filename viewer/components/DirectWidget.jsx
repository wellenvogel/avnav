/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Value from './Value.jsx';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";
import {concatsp} from "../util/helper";

const DirectWidget=(wprops)=>{
    const props=wprops.translateFunction?{...wprops,...wprops.translateFunction({...wprops})}:wprops;
    let val;
    try {
      val=props.formatter?props.formatter(props.value):props.value;
      val=(val==null?'':''+val)||props.default||'---';
    }catch(error){
      val=props.default||'---';
    }
    if(!/^-\d/.test(val)) val=val.replaceAll('-','\u2012'); // replace - by digit wide hyphen if not a neg. number, _ would also work well
    const display={
        value:val
    };
    const resizeSequence=useStringsChanged(display,wprops.mode==='gps')
    if(props.addClass) props.addClass=concatsp(props.addClass,'DirectWidget');
    return (
        <WidgetFrame {...props} resizeSequence={resizeSequence} >
            <div className='widgetData'>
                <Value value={val}/>
            </div>
        </WidgetFrame>
    );
}

DirectWidget.propTypes = {
    name: PropTypes.string,
    unit: PropTypes.string,
    ...WidgetProps,
    value: PropTypes.any,
    isAverage: PropTypes.bool,
    formatter: PropTypes.func.isRequired,
    default: PropTypes.string,
    translateFunction: PropTypes.func,
};
DirectWidget.editableParameters={
    caption:true,
    unit:true,
    formatter:true,
    formatterParameters: true,
    value: true
};

export default DirectWidget;
