/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';

class DateTimeWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,DateTimeWidget.storeKeys);
    }
    render(){
        let self=this;
        let classes="widget dateTimeWidget "+this.props.className||"";
        let time="----";
        if (this.props.time){
            time=Formatter.formatTime(this.props.time);
        }
        let date="----";
        if (this.props.time){
            date=Formatter.formatDate(this.props.time);
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
            <div className='infoLeft'>Date</div>
            <div className="resize">
                <div className="widgetData date">{date}</div>
                <div className="widgetData time">{time}</div>
            </div>
        </div>
        );
    }

};

DateTimeWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
DateTimeWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

export default DateTimeWidget;