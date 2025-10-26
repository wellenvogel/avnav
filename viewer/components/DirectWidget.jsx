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
    let vdef=props.default||'---';
    try {
      if (props.value != null) {
          let outOfRange=0;
          if(parseFloat(props.value) < props.minValue) outOfRange=-1;
          if(parseFloat(props.value) > props.maxValue) outOfRange=+1;
          if(outOfRange) {
            vdef=props.formatter?props.formatter(null):vdef; // placeholder with correct with
            if (outOfRange<0) vdef=vdef.replace(/./g,'<'); // underflow
            if (outOfRange>0) vdef=vdef.replace(/./g,'>'); // overflow
            throw new Error();
          }
      }
      val=props.formatter?props.formatter(props.value):props.value;
      val=(val==null?'':''+val)||vdef;
    }catch(error){
      val=vdef;
    }
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
