/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js'
import routeobjects from '../nav/routeobjects.js';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);


const EditRouteWidget = (props) => {
    let [route, notUsed, isActive] = StateHelper.getRouteIndexFlag(props);
    let classes = "editRouteWidget";
    if (isActive) classes += " activeRoute ";
    if (!route) {
        return (
            <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined}>
                <div className="routeName">No Route</div>
            </WidgetFrame>
        )
    }
    let rname = route.name;
    let numPoints = route.points.length;
    let len = route.computeLength(0, props.useRhumbLine);
    let remain = isActive ? props.remain : undefined;
    let eta = isActive ? props.eta : undefined;
    return (
        <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined}>
            <div className="routeName widgetData">{rname}</div>
            <div className="widgetData">
                <span className="label">PTS:</span>
                <span className="routeInfo">{Formatter.formatDecimal(numPoints, 3)}</span>
            </div>
            <div className="widgetData">
                <span className="label">DST:</span>
                <span className="routeInfo">{Formatter.formatDistance(len)}</span>
            </div>
            {props.mode !== "horizontal" ?
                <div className="widgetData">
                    <span className="label">RTG:</span>
                    <span className="routeInfo">{Formatter.formatDistance(remain)}</span>
                </div> : null}
            {props.mode !== "horizontal" ?
                <div className="widgetData">
                    <span className="label">ETA:</span>
                    <span className="routeInfo">{Formatter.formatTime(eta)}</span>
                </div> : null}
        </WidgetFrame>
    );
}


EditRouteWidget.propTypes={
    ...WidgetProps,
    route:   PropTypes.instanceOf(routeobjects.Route),
    remain: PropTypes.number,
    eta:    PropTypes.instanceOf(Date),
    isApproaching: PropTypes.bool,
    isActive: PropTypes.bool,
    useRhumbLine: PropTypes.bool
};

EditRouteWidget.storeKeys=editor.getStoreKeys({
    remain:keys.nav.route.remain,
    eta:keys.nav.route.eta,
    isApproaching: keys.nav.route.isApproaching,
    useRhumbLine: keys.nav.routeHandler.useRhumbLine
});

export default EditRouteWidget;