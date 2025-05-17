/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";


const EtaWidget = (props) => {
    let eta = props.eta ? Formatter.formatTime(props.eta) : '--:--:--';
    const display={
        eta: eta,
        name: props.wpname
    };
    const resizeSequence=useStringsChanged(display,props);
    const disconnect=(props.server===false);
    return (
        <WidgetFrame {...props} addClass="etaWidget" resizeSequence={resizeSequence} disconnect={disconnect}>
            <div className="widgetData markerEta">{display.eta}</div>
            <div className="widgetData markerName">{display.name}</div>
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
    wpname: keys.nav.wp.name,
    server: keys.nav.wp.server
};
export default EtaWidget;