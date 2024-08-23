/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";

const DateTimeWidget=(props)=>{
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
        let classes="widget dateTimeWidget "+props.className||"";
        let time="----";
        if (props.time){
            time=Formatter.formatTime(props.time);
        }
        let date="----";
        if (props.time){
            date=Formatter.formatDate(props.time);
        }
        const style={...props.style,...ddProps.style};
        return (
        <div className={classes} onClick={props.onClick} {...ddProps} style={style}>
            <div className='infoLeft'>Date</div>
            <div className="resize">
                <div className="widgetData date">{date}</div>
                <div className="widgetData time">{time}</div>
            </div>
        </div>
        );
    }

DateTimeWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    time: PropTypes.objectOf(Date),
    gpsValid: PropTypes.bool
};
DateTimeWidget.storeKeys={
    time: keys.nav.gps.rtime,
    gpsValid: keys.nav.gps.valid
};

export default DateTimeWidget;