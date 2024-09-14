/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetFrame, WidgetHead, WidgetProps} from "./WidgetBase";


const EtaWidget = (props) => {
    let eta = props.eta ? Formatter.formatTime(props.eta) : '--:--:--';
    let classes = "etaWidget " + props.className || "";
    return (
        <WidgetFrame {...props} className={classes}>
            <div className="widgetData markerEta">{eta}</div>
            <div className="widgetData markerName">{props.wpname}</div>
        </WidgetFrame>
    );
};

EtaWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    eta: PropTypes.objectOf(Date),
    wpname: PropTypes.string
};
EtaWidget.storeKeys={
    eta: keys.nav.wp.eta,
    wpname: keys.nav.wp.name
};
export default EtaWidget;