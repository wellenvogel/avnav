/**
 * Created by andreas on 21.03.22.
 */

import React from 'react';
import Formatter from "../util/formatter";
import PropTypes from "prop-types";
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const rad2deg=(rad,inDeg)=>{
    if (inDeg) return parseFloat(rad);
    return parseFloat(rad) / Math.PI * 180;
}

const DegreeFormatter = (value,inDeg)=> {
      if (value === undefined) return "???";
      return Formatter.formatDecimal(Math.abs(rad2deg(value,inDeg)), 4, 0,false,false);
  };

export const SKRollWidget=(props)=>{
        let degreeArrow = "---";
        if (props.value !== undefined) {
            let value = DegreeFormatter(props.value, props.inDegree);
            degreeArrow = value + "";
            // arrow left + Wert
            if (props.value < 0 && value != 0) {
                degreeArrow = "\u21D0" + degreeArrow;
            }
            // value + space + arrow right
            if (props.value > 0 && value != 0) {
                degreeArrow = degreeArrow + "\xA0\u21D2";
            }
        }
        let wdClasses="widgetData";
        if (Math.abs(rad2deg(props.value,props.inDegree)) >= props.criticalValue){
            wdClasses+=" critical";
        }
        return (
            <WidgetFrame {...props} addClass="SKRollWidget" >
                <div className={wdClasses}>{degreeArrow}</div>
            </WidgetFrame>
        );
    }


SKRollWidget.propTypes={
    ...WidgetProps,
    unit: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string,PropTypes.number]),
    criticalValue: PropTypes.number,
    inDegree: PropTypes.bool
};
SKRollWidget.editableParameters={
    formatter: false,
    formatterParameters: false,
    value:{type:'KEY',default:'nav.gps.signalk.navigation.attitude.roll'},
    unit:{type:'STRING',default:'°'},
    inDegree:{type:'BOOLEAN',default:false,description:'set to true if input is in deg instead of rad'},
    criticalValue: {type: 'NUMBER', default: 45},
    caption: {type:'STRING',default:'Roll'}
}

export const SKPitchWidget = (props) => {
    let degreeArrow = "---";
    if (props.value !== undefined) {
        let value = DegreeFormatter(props.value, props.inDegree);
        degreeArrow = value + "";
        // arrow left + Wert
        if (props.value < 0 && value != 0) {
            degreeArrow += "\xA0\u21D3";
        }
        // value + space + arrow right
        if (props.value > 0 && value != 0) {
            degreeArrow += "\xA0\u21D1";
        }
    }
    let wdClasses = "widgetData";
    if (Math.abs(rad2deg(props.value, props.inDegree)) >= props.criticalValue) {
        wdClasses += " critical";
    }
    return (
        <WidgetFrame {...props} addClass="SKPitchWidget">
            <div className={wdClasses}>{degreeArrow}</div>
        </WidgetFrame>
    );
}

SKPitchWidget.propTypes={
    ...WidgetProps,
    unit: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string,PropTypes.number]),
    criticalValue: PropTypes.number,
    inDegree: PropTypes.bool
};
SKPitchWidget.editableParameters={
    formatter: false,
    formatterParameters: false,
    value:{type:'KEY',default:'nav.gps.signalk.navigation.attitude.pitch'},
    unit:{type:'STRING',default:'°'},
    inDegree:{type:'BOOLEAN',default:false,description:'set to true if input is in deg instead of rad'},
    criticalValue: {type: 'NUMBER', default: 45},
    caption: {type:'STRING',default:'Pitch'}
}