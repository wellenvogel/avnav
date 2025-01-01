/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import NavCompute from "../nav/navcompute";
import {useAvNavSortable} from "../hoc/Sortable";
import {WidgetFrame, WidgetHead, WidgetProps} from "./WidgetBase";


const CenterDisplayWidget = (props) => {
    let small = (props.mode == "horizontal");
    let measurePosition = props.measurePosition;
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
                        <span>{Formatter.formatDistance(measureValues.dts,props.distanceUnit)}</span>
                        <span className="unit">{props.distanceUnit}</span>
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
                    <span>{Formatter.formatDistance(props.markerDistance,props.distanceUnit)}</span>
                    <span className="unit">{props.distanceUnit}</span>
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
                    <span>{Formatter.formatDistance(props.centerDistance,props.distanceUnit)}</span>
                    <span className="unit">{props.distanceUnit}</span>
                </div>
            </div>
        </WidgetFrame>
    );
}


CenterDisplayWidget.storeKeys={
        markerCourse:keys.nav.center.markerCourse,
        markerDistance:keys.nav.center.markerDistance,
        centerCourse:keys.nav.center.course,
        centerDistance:keys.nav.center.distance,
        centerPosition: keys.map.centerPosition,
        measurePosition: keys.map.measurePosition,
        measureRhumbLine: keys.properties.measureRhumbLine
};

CenterDisplayWidget.propTypes={
    ...WidgetProps,
    markerCourse:PropTypes.number,
    markerDistance:PropTypes.number,
    centerCourse:PropTypes.number,
    centerDistance:PropTypes.number,
    centerPosition: PropTypes.object,
    measurePosition: PropTypes.object,
    measureRhumbLine: PropTypes.bool,
    style: PropTypes.object,
    mode: PropTypes.string
};

CenterDisplayWidget.editableParameters={
    positionFmt: Formatter.formatLonLats.parameters[0],
    distanceUnit: Formatter.formatDistance.parameters[0],
};

export default CenterDisplayWidget;
