/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import Value from './Value.jsx';
import {WidgetFrame} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";
import {WidgetProps} from "../util/types";

const finalDefault='---';
const DirectWidget=(wprops)=>{
    let props;
    try {
        props = wprops.translateFunction ? {...wprops, ...wprops.translateFunction({...wprops})} : wprops;
    }catch (e){
        props={...wprops,value:'Error: '+e}
    }
    let val;
    let vdef=props.default;
    if (props.value !== undefined) {
        const nval=Number(props.value);
        if (props.minValue != null && nval < props.minValue) {
            val=(props.formatter?props.formatter(vdef):vdef||finalDefault)?.replace(/./g,'<');
        }
        else if(props.maxValue != null && nval > props.maxValue){
            val=(props.formatter?props.formatter(vdef):vdef||finalDefault)?.replace(/./g,'>');
        }
        else val=props.formatter?props.formatter(props.value):nval+"";
    }
    else{
        if (props.formatter) val=props.formatter(vdef);
        else val=(vdef != null)?(vdef+""):finalDefault;
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
    minValue: PropTypes.number,
    maxValue: PropTypes.number,
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