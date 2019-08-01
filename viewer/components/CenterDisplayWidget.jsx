/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';

let fmt=new Formatter();

class CenterDisplayWidget extends React.Component{
    shouldComponentUpdate(nextProps,nextState) {
        for (let k in CenterDisplayWidget.storeKeys){
            if (nextProps[k] !== this.props[k]) return true;
        }
        return false;
    }
    render(){
        var classes="avn_widget avn_centerWidget "+this.props.classes||""+ " "+this.props.className||"";
        var small = (this.props.mode == "small");
        var tableClass="";
        if (small) tableClass="avn_widgetDataFirst";
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style||{}}>
                <div className="avn_widgetInfoLeft">Center</div>
            { ! small && <div className="avn_centerPosition">{fmt.formatLonLats(this.props.centerPosition)}</div>}
                <div className={"avn_table "+tableClass}>
                    <div className="avn_row">
                        <div className="avn_label avn_marker"></div>
                        <div className="avn_center_value">
                            <span>{fmt.formatDecimal(this.props.markerCourse,3,0)}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span>{fmt.formatDecimal(this.props.markerDistance,3,1)}</span>
                            <span className="avn_unit">nm</span>
                        </div>
                    </div>
                    <div className="avn_row">
                        <div className="avn_label avn_boat"></div>
                        <div className="avn_center_value">
                            <span >{fmt.formatDecimal(this.props.centerCourse,3,0)}</span>
                            <span className="avn_unit">&#176;</span>
                        </div>
                        <div className="avn_center_value">
                            /
                        </div>
                        <div className="avn_center_value">
                            <span >{fmt.formatDecimal(this.props.centerDistance,3,1)}</span>
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
        centerPosition: keys.nav.center.position
};

CenterDisplayWidget.propTypes={
    onClick: PropTypes.func,
    classes: PropTypes.string
};
module.exports=CenterDisplayWidget;