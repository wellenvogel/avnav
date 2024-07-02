/**
 * Created by andreas on 21.03.22.
 */

import React from 'react';
import GuiHelper from "../util/GuiHelpers";
import Formatter from "../util/formatter";
import PropTypes from "prop-types";

const rad2deg=(rad,inDeg)=>{
    if (inDeg) return parseFloat(rad);
    return parseFloat(rad) / Math.PI * 180;
}

const DegreeFormatter = (value,inDeg)=> {
      if (value === undefined) return "???";
      return avnav.api.formatter.formatDecimal(Math.abs(rad2deg(value,inDeg)), 4, 0);
  };

export class SKRollWidget extends React.Component{

    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }

    render(){
        let value=DegreeFormatter(this.props.value,this.props.inDegree);
        let degreeArrow = "-";
          if (this.props.value == 0) {
              degreeArrow = "0";
          } else if (this.props.value < 0) {
              degreeArrow = "\u21D0" + value;
          } else if (this.props.value > 0) {
              degreeArrow = value + "\xA0\u21D2";
          }
        let classes="widget SKRollWidget "+this.props.className||"";
        let wdClasses="widgetData";
        if (Math.abs(rad2deg(this.props.value,this.props.inDegree)) >= this.props.criticalValue){
            wdClasses+=" critical";
        }
        return (
            <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className='infoLeft'>{this.props.caption}</div>
                <div className='infoRight'>{this.props.unit}</div>
                <div className={wdClasses}>{degreeArrow}</div>
            </div>
        );
    }

}

SKRollWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    caption: PropTypes.string,
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

export class SKPitchWidget extends React.Component{

    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }

    render(){
        let value=DegreeFormatter(this.props.value,this.props.inDegree);
        let degreeArrow = "-";
        if (this.props.value == 0) {
            degreeArrow = "0";
        } else if (this.props.value < 0) {
            degreeArrow = value + "\xA0\u21D3";
        } else if (this.props.value > 0) {
            degreeArrow = value + "\xA0\u21D1";
        }
        let classes="widget SKPitchWidget "+this.props.className||"";
        let wdClasses="widgetData";
        if (Math.abs(rad2deg(this.props.value,this.props.inDegree)) >= this.props.criticalValue){
            wdClasses+=" critical";
        }
        return (
            <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className='infoLeft'>{this.props.caption}</div>
                <div className='infoRight'>{this.props.unit}</div>
                <div className={wdClasses}>{degreeArrow}</div>
            </div>
        );
    }

}

SKPitchWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    style: PropTypes.object,
    caption: PropTypes.string,
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
