/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import PropertyHandler from '../util/propertyhandler.js';
import Helper from '../util/helper.js';

class TimeStatusWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,TimeStatusWidget.storeKeys);
    }
    render(){
        var self=this;
        var classes="avn_widget avn_timeStatusWidget "+this.props.classes||""+ " "+this.props.className||"";
        var imgSrc=this.props.gpsValid? PropertyHandler.getProperties().statusOkImage:PropertyHandler.getProperties().statusErrorImage;
        var time="----";
        if (this.props.time !== undefined){
            time=Formatter.formatTime(this.props.time);
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='avn_widgetInfoLeft'>{this.props.caption}</div>
            <img className="avn_boatPositionStatus" src={imgSrc}/>
            <div className="avn_widgetData avn_gpsTime">{time}</div>
        </div>
        );
    }

};

TimeStatusWidget.propTypes={
    onClick: PropTypes.func,
    classes: PropTypes.string,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
TimeStatusWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

module.exports=TimeStatusWidget;