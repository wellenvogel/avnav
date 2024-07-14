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


const CenterDisplayWidget = (props) => {
    useKeyEventHandler(props, "widget");
    const ddProps = useAvNavSortable(props.dragId);
    let classes = "widget centerDisplayWidget " + props.className || "";
    let small = (props.mode == "horizontal");
    let measurePosition = props.measurePosition;
    let measureValues;
    if (measurePosition) {
        measureValues = NavCompute.computeDistance(measurePosition, props.centerPosition, props.measureRhumbLine);
    }
    const style = {...props.style, ...ddProps.style};
    return (
        <div className={classes} onClick={props.onClick} {...ddProps} style={style}>
            <div className="infoLeft">Center</div>
            {!small && <div className="widgetData">{Formatter.formatLonLats(props.centerPosition)}</div>}
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
                        <span>{Formatter.formatDistance(measureValues.dts)}</span>
                        <span className="unit">nm</span>
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
                    <span>{Formatter.formatDistance(props.markerDistance)}</span>
                    <span className="unit">nm</span>
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
                    <span>{Formatter.formatDistance(props.centerDistance)}</span>
                    <span className="unit">nm</span>

                </div>
            </div>
        </div>
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
    onClick: PropTypes.func,
    className: PropTypes.string,
    markerCourse:PropTypes.number,
    markerDistance:PropTypes.number,
    centerCourse:PropTypes.number,
    centerDistance:PropTypes.number,
    centerPosition: PropTypes.object,
    measurePosition: PropTypes.object,
    measureRhumbLine: PropTypes.bool,
    dragId: PropTypes.string,
    style: PropTypes.object,
    mode: PropTypes.string
};
export default CenterDisplayWidget;