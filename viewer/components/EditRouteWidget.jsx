/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js'
import routeobjects from '../nav/routeobjects.js';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {SortableProps, useAvNavSortable} from "../hoc/Sortable";
import {WidgetHead, WidgetProps} from "./WidgetBase";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);


const EditRouteWidget = (props) => {
    useKeyEventHandler(props, "widget");
    const ddProps = useAvNavSortable(props.dragId);
    let [route, notUsed, isActive] = StateHelper.getRouteIndexFlag(props);
    let classes = "widget editRouteWidget " + props.className || "";
    if (isActive) classes += " activeRoute ";
    if (!route) {
        return (
            <div className={classes} onClick={props.onClick} style={props.style}>
                <WidgetHead caption={'RTE'}/>
                <div className="routeName">No Route</div>
            </div>
        )
    }
    let rname = route.name;
    let numPoints = route.points.length;
    let len = route.computeLength(0, props.useRhumbLine);
    let remain = isActive ? props.remain : undefined;
    let eta = isActive ? props.eta : undefined;
    const style = {...props.style, ...ddProps.style};
    return (
        <div className={classes} onClick={props.onClick} {...ddProps} style={style}>
            <div className="infoLeft">RTE</div>
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
        </div>
    );
}


EditRouteWidget.propTypes={
    ...SortableProps,
    ...WidgetProps,
    route:   PropTypes.objectOf(routeobjects.Route),
    remain: PropTypes.number,
    eta:    PropTypes.objectOf(Date),
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