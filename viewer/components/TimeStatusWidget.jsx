/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from "prop-types";
import keys from "../util/keys.jsx";
import Formatter from "../util/formatter.js";
import globalStore from '../util/globalstore.jsx';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetProps} from "./WidgetBase";

const TimeStatusWidget = (props=> {
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
    let classes="widget timeStatusWidget "+props.className||"";
    let imgSrc=globalStore.getData(props.gpsValid?
        keys.properties.statusOkImage:
        keys.properties.statusErrorImage);
    let time="----";
    if (props.time !== undefined){
        time=Formatter.formatTime(props.time);
    }
    const style={...props.style,...ddProps.style};
    return (
        <div {...ddProps} className={classes} onClick={props.onClick} style={style}>
            <div className='infoLeft'>{props.caption}</div>
            <img className="status" src={imgSrc}/>
            <div className="widgetData">{time}</div>
        </div>
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