/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import NavCompute from "../nav/navcompute";
import {WidgetFrame, WidgetProps} from "./WidgetBase";


const CenterDisplayWidget = (props) => {
    let small = (props.mode == "horizontal");
    let measurePosition = props.activeMeasure?props.activeMeasure.getPointAtIndex(0):undefined;
    let measureValues;
    if (measurePosition) {
        measureValues = NavCompute.computeDistance(measurePosition, props.centerPosition, props.measureRhumbLine);
    }
    return (
        <WidgetFrame {...props} addClass="centerDisplayWidget" caption="Center" unit={undefined}>
            {!small && <div className="widgetData Position">{Formatter.formatLonLats(props.centerPosition,props.positionFmt)}</div>}
            {(measurePosition !== undefined) &&
                <div className="widgetData">
                    <div className="label measure"></div>
                    <div className="value">
                        <span>{Formatter.formatDirection(measureValues.course)}</span>
                        <span className="unit">&#176;</span>
                    </div>
                    <div className="value">
                        /
                    </div>
                    <div className="value">
                        <span>{props.formatter(measureValues.dts)}</span>
                        <span className="unit">{props.unit}</span>
                    </div>
                </div>
            }
            <div className="widgetData">
                <div className="label marker"></div>
                <div className="value">
                    <span>{Formatter.formatDirection(props.markerCourse)}</span>
                    <span className="unit">&#176;</span>
                </div>
                <div className="value">
                    /
                </div>
                <div className="value">
                    <span>{props.formatter(props.markerDistance)}</span>
                    <span className="unit">{props.unit}</span>
                </div>
            </div>
            <div className="widgetData">
                <div className="label boat"></div>
                <div className="value">
                    <span>{Formatter.formatDirection(props.centerCourse)}</span>
                    <span className="unit">&#176;</span>
                </div>
                <div className="value">
                    /
                </div>
                <div className="value">
                    <span>{props.formatter(props.centerDistance)}</span>
                    <span className="unit">{props.unit}</span>

                </div>
            </div>
        </WidgetFrame>
    );
}


CenterDisplayWidget.predefined={
    storeKeys:{
        markerCourse:keys.nav.center.markerCourse,
        markerDistance:keys.nav.center.markerDistance,
        centerCourse:keys.nav.center.course,
        centerDistance:keys.nav.center.distance,
        centerPosition: keys.map.centerPosition,
        activeMeasure: keys.map.activeMeasure,
        measureRhumbLine: keys.properties.measureRhumbLine
    },
    formatter: 'formatDistance',
    editableParameters:{
        formatterParameters: true
    },
    caption:'Center'
};

CenterDisplayWidget.propTypes={
    ...WidgetProps,
    markerCourse:PropTypes.number,
    markerDistance:PropTypes.number,
    centerCourse:PropTypes.number,
    centerDistance:PropTypes.number,
    centerPosition: PropTypes.object,
    activeMeasure: PropTypes.object,
    measureRhumbLine: PropTypes.bool,
    style: PropTypes.object,
    mode: PropTypes.string
};
export default CenterDisplayWidget;
