/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js'
import Helper from '../util/helper.js';


class EditRouteWidget extends React.Component{

    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps, EditRouteWidget.storeKeys);
    }
    render(){
        let classes="avn_widget avn_editingRouteWidget "+this.props.classes||""+ " "+this.props.className||"";
        if (this.props.editingActive) classes +=" avn_activeRoute ";
        else classes+=" avn_otherRoute";
        if (this.props.routeName === undefined){
            return (
                <div className={classes} onClick={this.props.onClick}>
                    <div className="avn_widgetInfoLeft">RTE</div>
                    <div className="avn_routeName">No Route</div>
                </div>
            )
        }
        var rname;
        if (this.props.mode === "small"){
            rname=this.props.routeName;
        }
        else {
            rname = this.props.routeName.substr(0, 14);
            if (this.props.routeName.length > 14) rname += "..";
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">RTE</div>
            <div className="avn_routeName">{rname}</div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">PTS:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(this.props.numPoints,3)}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">DST:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(this.props.len,3,1)}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">RTG:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(this.props.remain,3,1)}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">ETA:</span>
                <span className="avn_routeInfo avd_edRouteEta">{Formatter.formatTime(this.props.eta)}</span>
            </div>
        </div>
        );
    }

}

EditRouteWidget.propTypes={
    onClick:PropTypes.func,
    classes:PropTypes.string,
    mode:   PropTypes.string, //display info side by side if small
    routeName:   PropTypes.string,
    remain: PropTypes.number,
    eta:    PropTypes.objectOf(Date),
    numPoints: PropTypes.number,
    len:    PropTypes.number,
    isApproaching: PropTypes.bool,
    editingActive: PropTypes.bool
};

EditRouteWidget.storeKeys={
    routeName:keys.nav.editRoute.name,
    remain:keys.nav.editRoute.remain,
    eta:keys.nav.editRoute.eta,
    numPoints:keys.nav.editRoute.numPoints,
    len:keys.nav.editRoute.len,
    isApproaching: keys.nav.route.isApproaching,
    editingActive: keys.nav.editRoute.isActive
};

module.exports=EditRouteWidget;