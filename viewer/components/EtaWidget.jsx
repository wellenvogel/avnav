/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";


const EtaWidget = (props) => {
    let eta = props.eta ? Formatter.formatTime(props.eta) : '--:--:--';
    return (
        <WidgetFrame {...props} addClass="etaWidget">
            <div className="widgetData markerEta">{eta}</div>
            <div className="widgetData markerName">{props.wpname}</div>
        </WidgetFrame>
    );
};

EtaWidget.propTypes={
    ...WidgetProps,
    eta: PropTypes.objectOf(Date),
    wpname: PropTypes.string
};
EtaWidget.storeKeys={
    eta: keys.nav.wp.eta,
    wpname: keys.nav.wp.name
};
export default EtaWidget;