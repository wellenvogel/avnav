/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {useStringsChanged} from "../hoc/Resizable";
import routeobjects from "../nav/routeobjects";
import Helper from '../util/helper';

const SecondRow=({remain,eta,approach})=>{
    return <div className={"secondRow"}>
        {approach && <div className="icon"/>}
        {(eta !== undefined) && <div className="routeEta">{eta}</div>}
        <div>
            <span className="routeRemain">{remain}</span>
            <span className='unit'>nm</span>
        </div>
    </div>
}

const ActiveRouteWidget =(props)=>{
        if (!props.routeName && ! props.isEditing) return null;
        let classes = "activeRouteWidget";
        if (props.isApproaching) classes += " approach ";
        let display={
            name:routeobjects.nameToBaseName(props.routeName),
            remain: Formatter.formatDistance(props.remain),
            eta: Formatter.formatTime(props.eta),
            next: Formatter.formatDirection(props.nextCourse),
        };
        const isServer=routeobjects.isServerName(props.routeName);
        const resizeSequence=useStringsChanged(display,props);
        const small = (props.mode === "horizontal");
        return (
            <WidgetFrame {...props} addClass={classes} caption="RTE" unit={undefined} resizeSequence={resizeSequence} disconnect={!isServer}>
                <div className={Helper.concatsp("widgetData",small?"small":undefined)}>
                    <div className="routeName">{display.name}</div>
                    {small && <SecondRow eta={display.eta} remain={display.remain} />}
                    {!small && <div className="routeRemain">
                        <span className="routeRemain">{display.remain}</span>
                        <span className='unit'>nm</span>
                    </div>}
                    {!small && <SecondRow eta={display.eta} approach={props.isApproaching} />}
                    { ! small && ( (props.isApproaching) ?
                        <div className="routeNext">
                            <span
                                className="routeNextCourse">{display.next}</span>
                            <span className='unit'>&#176;</span>
                        </div>
                        : <div></div>
                    )
                    }
                    {(small  && props.isApproaching) && <div className="icon small"/>}
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
    isEditing: keys.gui.global.layoutEditing,
};

export default ActiveRouteWidget;