/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js'
import Helper from '../util/helper.js';
import routeobjects from '../nav/routeobjects.js';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';

const editor=new RouteEdit(RouteEdit.MODES.EDIT);


class EditRouteWidget extends React.Component{

    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps, EditRouteWidget.storeKeys);
    }
    render(){
        let [route,notUsed,isActive]=StateHelper.getRouteIndexFlag(this.props);
        let classes="widget avn_editingRouteWidget "+this.props.classes||""+ " "+this.props.className||"";
        if (isActive) classes +=" avn_activeRoute ";
        else classes+=" avn_otherRoute";
        if (!route){
            return (
                <div className={classes} onClick={this.props.onClick}>
                    <div className="infoLeft">RTE</div>
                    <div className="avn_routeName">No Route</div>
                </div>
            )
        }
        let rname=undefined;
        if (this.props.mode === "small"){
            rname=route.name;
        }
        else {
            rname = route.name.substr(0, 14);
            if (route.name.length > 14) rname += "..";
        }
        let numPoints=route.points.length;
        let len=route.computeLength(0);
        let remain=isActive?this.props.remain:undefined;
        let eta=isActive?this.props.eta:undefined;
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="infoLeft">RTE</div>
            <div className="avn_routeName">{rname}</div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">PTS:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(numPoints,3)}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">DST:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(len,3,1)}</span>
            </div>
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">RTG:</span>
                <span className="avn_routeInfo">{Formatter.formatDecimal(remain,3,1)}</span>
            </div>getRouteN
            <div className="avn_routeInfoLine">
                <span className="avn_route_label">ETA:</span>
                <span className="avn_routeInfo avd_edRouteEta">{Formatter.formatTime(eta)}</span>
            </div>
        </div>
        );
    }

}

EditRouteWidget.propTypes={
    onClick:PropTypes.func,
    classes:PropTypes.string,
    mode:   PropTypes.string, //display info side by side if small
    route:   PropTypes.objectOf(routeobjects.Route),
    remain: PropTypes.number,
    eta:    PropTypes.objectOf(Date),
    isApproaching: PropTypes.bool,
    isActive: PropTypes.bool,
    name: PropTypes.string
};

EditRouteWidget.storeKeys=editor.getStoreKeys({
    remain:keys.nav.route.remain,
    eta:keys.nav.route.eta,
    isApproaching: keys.nav.route.isApproaching
});

module.exports=EditRouteWidget;