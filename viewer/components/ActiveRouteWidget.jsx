/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const ActiveRouteWidget =(props)=>{
        if (!props.routeName && ! props.isEditing) return null;
        let classes = "activeRouteWidget";
        if (props.isApproaching) classes += " approach ";
        return (
            <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined}>
                <div className="widgetData">
                    <div className="routeName">{props.routeName}</div>
                    <div>
                        <span className="routeRemain">{Formatter.formatDistance(props.remain)}</span>
                        <span className='unit'>nm</span>
                    </div>
                    <div className="routeEta">{Formatter.formatTime(props.eta)}</div>
                    { props.isApproaching ?
                        <div className="routeNext">
                            <span
                                className="routeNextCourse">{Formatter.formatDirection(props.nextCourse)}</span>
                            <span className='unit'>&#176;</span>
                        </div>
                        : <div></div>
                    }
                </div>
            </WidgetFrame>
        );
    }


ActiveRouteWidget.propTypes={
    ...WidgetProps,
    isAproaching: PropTypes.bool,
    routeName: PropTypes.string,
    eta: PropTypes.objectOf(Date),
    remain: PropTypes.number,
    nextCourse: PropTypes.number,
    isEditing: PropTypes.bool
};
ActiveRouteWidget.storeKeys={
    isApproaching: keys.nav.route.isApproaching,
    routeName: keys.nav.route.name,
    eta: keys.nav.route.eta,
    remain: keys.nav.route.remain,
    nextCourse: keys.nav.route.nextCourse,
    isEditing: keys.gui.global.layoutEditing
};

export default ActiveRouteWidget;