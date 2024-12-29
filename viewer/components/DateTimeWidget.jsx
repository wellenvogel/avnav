/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const DateTimeWidget = (props) => {
    let time = "----";
    if (props.time) {
        time = Formatter.formatTime(props.time);
    }
    let date = "----";
    if (props.time) {
        date = Formatter.formatDate(props.time);
    }
    return (
        <WidgetFrame {...props} addClass="dateTimeWidget" caption="Date" unit={undefined}>
                <div className="widgetData date">{date}</div>
                <div className="widgetData time">{time}</div>
        </WidgetFrame>
    );
}

DateTimeWidget.propTypes={
    ...WidgetProps,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
DateTimeWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

export default DateTimeWidget;