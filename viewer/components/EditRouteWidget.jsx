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
import GuiHelper from '../util/GuiHelpers.js';

const editor=new RouteEdit(RouteEdit.MODES.EDIT);


class EditRouteWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }

    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps, EditRouteWidget.storeKeys);
    }
    render(){
        let [route,notUsed,isActive]=StateHelper.getRouteIndexFlag(this.props);
        let classes="widget editRouteWidget "+this.props.className||"";
        if (isActive) classes +=" activeRoute ";
        if (!route){
            return (
                <div className={classes} onClick={this.props.onClick} style={this.props.style}>
                    <div className="infoLeft">RTE</div>
                    <div className="routeName">No Route</div>
                </div>
            )
        }
        let rname=route.name;
        let numPoints=route.points.length;
        let len=route.computeLength(0);
        let remain=isActive?this.props.remain:undefined;
        let eta=isActive?this.props.eta:undefined;
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="infoLeft">RTE</div>
            <div className="routeName widgetData">{rname}</div>
            <div className="widgetData">
                <span className="label">PTS:</span>
                <span className="routeInfo">{Formatter.formatDecimal(numPoints,3)}</span>
            </div>
            <div className="widgetData">
                <span className="label">DST:</span>
                <span className="routeInfo">{Formatter.formatDistance(len)}</span>
            </div>
            { this.props.mode !== "horizontal"?
            <div className="widgetData">
                <span className="label">RTG:</span>
                <span className="routeInfo">{Formatter.formatDistance(remain)}</span>
            </div>:null}
            { this.props.mode !== "horizontal"?
            <div className="widgetData">
                <span className="label">ETA:</span>
                <span className="routeInfo">{Formatter.formatTime(eta)}</span>
            </div>:null}
        </div>
        );
    }

}

EditRouteWidget.propTypes={
    onClick:PropTypes.func,
    className:PropTypes.string,
    mode:   PropTypes.string, //display info side by side if small
    route:   PropTypes.objectOf(routeobjects.Route),
    remain: PropTypes.number,
    eta:    PropTypes.objectOf(Date),
    isApproaching: PropTypes.bool,
    isActive: PropTypes.bool
};

EditRouteWidget.storeKeys=editor.getStoreKeys({
    remain:keys.nav.route.remain,
    eta:keys.nav.route.eta,
    isApproaching: keys.nav.route.isApproaching
});

export default EditRouteWidget;