/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import {useKeyEventHandler} from '../util/GuiHelpers.js';
import {useAvNavSortable} from "../hoc/Sortable";


const ActiveRouteWidget =(props)=>{
    useKeyEventHandler(props,"widget");
    const ddProps=useAvNavSortable(props.dragId);
        if (!props.routeName && ! props.isEditing) return null;
        let classes = "widget activeRouteWidget " + props.className || "";
        if (props.isApproaching) classes += " approach ";
        const style={...props.style,...ddProps.style};
        return (
            <div className={classes} onClick={props.onClick} style={style} {...ddProps}>
                <div className="infoLeft">RTE</div>
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
            </div>
        );
    }


ActiveRouteWidget.propTypes={
    //formatter: React.PropTypes.func,
    onClick: PropTypes.func,
    className: PropTypes.string,
    updateCallback: PropTypes.func,
    isAproaching: PropTypes.bool,
    routeName: PropTypes.string,
    eta: PropTypes.objectOf(Date),
    remain: PropTypes.number,
    nextCourse: PropTypes.number,
    dragId: PropTypes.string,
    isEditing: PropTypes.bool,
    isApproaching: PropTypes.bool,
    style: PropTypes.object

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