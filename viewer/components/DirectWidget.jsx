/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Value from './Value.jsx';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";

const DirectWidget=(wprops)=>{
    const props=wprops.translateFunction?{...wprops,...wprops.translateFunction({...wprops})}:wprops;
    let val;
    let vdef=props.default||'0';
    if (props.value !== undefined) {
        val=props.formatter?props.formatter(props.value):vdef+"";
    }
    else{
        if (! isNaN(vdef) && props.formatter) val=props.formatter(vdef);
        else val=vdef+"";
    }
    const display={
        value:val
    };
    const resizeSequence=useStringsChanged(display,wprops.mode==='gps')
    return (
        <WidgetFrame {...props} addClass="DirectWidget" resizeSequence={resizeSequence} >
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