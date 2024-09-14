/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import globalStore from '../util/globalstore.jsx';
import {SortableProps} from "../hoc/Sortable";
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const TimeStatusWidget = (props=> {
    let classes="timeStatusWidget "+props.className||"";
    let imgSrc=globalStore.getData(props.gpsValid?
        keys.properties.statusOkImage:
        keys.properties.statusErrorImage);
    let time="----";
    if (props.time !== undefined){
        time=Formatter.formatTime(props.time);
    }
    return (
        <WidgetFrame {...props} className={classes} unit={undefined}>
                <img className="status" src={imgSrc}/>
                <div className="widgetData">{time}</div>
        </WidgetFrame>
    );
});

TimeStatusWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
TimeStatusWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

export default TimeStatusWidget;