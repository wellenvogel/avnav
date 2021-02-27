/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';


class CenterDisplayWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,CenterDisplayWidget.storeKeys);
    }

    render() {
        let classes = "widget centerDisplayWidget " + this.props.className || "";
        let small = (this.props.mode == "horizontal");
        return (
            <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className="infoLeft">Center</div>
                { !small && <div className="widgetData">{Formatter.formatLonLats(this.props.centerPosition)}</div>}

                <div className="widgetData">
                    <div className="label marker"></div>
                    <div className="value">
                        <span>{Formatter.formatDirection(this.props.markerCourse)}</span>
                        <span className="unit">&#176;</span>
                    </div>
                    <div className="value">
                        /
                    </div>
                    <div className="value">
                        <span>{Formatter.formatDistance(this.props.markerDistance)}</span>
                        <span className="unit">nm</span>
                    </div>
                </div>
                <div className="widgetData">
                    <div className="label boat"></div>
                    <div className="value">
                        <span >{Formatter.formatDirection(this.props.centerCourse)}</span>
                        <span className="unit">&#176;</span>
                    </div>
                    <div className="value">
                        /
                    </div>
                    <div className="value">
                        <span >{Formatter.formatDistance(this.props.centerDistance)}</span>
                        <span className="unit">nm</span>

                    </div>
                </div>
            </div>
        );
    }

}

CenterDisplayWidget.storeKeys={
        markerCourse:keys.nav.center.markerCourse,
        markerDistance:keys.nav.center.markerDistance,
        centerCourse:keys.nav.center.course,
        centerDistance:keys.nav.center.distance,
        centerPosition: keys.map.centerPosition
};

CenterDisplayWidget.propTypes={
    onClick: PropTypes.func,
    className: PropTypes.string,
    markerCourse:PropTypes.number,
    markerDistance:PropTypes.number,
    centerCourse:PropTypes.number,
    centerDistance:PropTypes.number,
    centerPosition: PropTypes.object
};
export default CenterDisplayWidget;