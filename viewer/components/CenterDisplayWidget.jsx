/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';


class CenterDisplayWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        return Helper.compareProperties(this.props,nextProps,CenterDisplayWidget.storeKeys);
    }
    render(){
        let classes="widget avn_centerWidget "+this.props.classes||""+ " "+this.props.className||"";
        let small = (this.props.mode == "small");
        let tableClass="";
        if (small) tableClass="avn_widgetDataFirst";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className="infoLeft">Center</div>
            { ! small && <div className="avn_centerPosition">{Formatter.formatLonLats(this.props.centerPosition)}</div>}
                <div className={"avn_table "+tableClass}>
                    <div className="avn_row">
                        <div className="avn_label avn_marker"></div>
                        <div className="avn_center_value">
                            <span>{Formatter.formatDecimal(this.props.markerCourse,3,0)}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span>{Formatter.formatDecimal(this.props.markerDistance,3,1)}</span>
                            <span className="avn_unit">nm</span>
                        </div>
                    </div>
                    <div className="avn_row">
                        <div className="avn_label avn_boat"></div>
                        <div className="avn_center_value">
                            <span >{Formatter.formatDecimal(this.props.centerCourse,3,0)}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span >{Formatter.formatDecimal(this.props.centerDistance,3,1)}</span>
                            <span className="avn_unit">nm</span>

                        </div>
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
    classes: PropTypes.string,
    markerCourse:PropTypes.number,
    markerDistance:PropTypes.number,
    centerCourse:PropTypes.number,
    centerDistance:PropTypes.number,
    centerPosition: PropTypes.object
};
module.exports=CenterDisplayWidget;