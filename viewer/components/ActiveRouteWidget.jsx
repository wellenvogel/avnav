/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import compare from '../util/shallowcompare';
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';
import GuiHelper from '../util/GuiHelpers.js';


class ActiveRouteWidget extends React.Component{
    constructor(props){
        super(props);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps,ActiveRouteWidget.storeKeys);
    }
    componentDidUpdate(){

    }

    render() {
        if (!this.props.routeName) return null;
        let self = this;
        let classes = "widget activeRouteWidget " + this.props.className || "";
        if (this.props.isApproaching) classes += " approach ";
        return (
            <div className={classes} onClick={this.props.onClick} style={this.props.style}>
                <div className="infoLeft">RTE</div>
                <div className="widgetData">
                    <div className="routeName">{this.props.routeName}</div>
                    <div>
                        <span className="routeRemain">{Formatter.formatDecimal(this.props.remain, 3, 1)}</span>
                        <span className='unit'>nm</span>
                    </div>
                    <div className="routeEta">{Formatter.formatTime(this.props.eta)}</div>
                    { this.props.isApproaching ?
                        <div className="routeNext">
                            <span
                                className="routeNextCourse">{Formatter.formatDecimal(this.props.nextCourse, 3, 0)}</span>
                            <span className='unit'>&#176;</span>
                        </div>
                        : <div></div>
                    }
                </div>
            </div>
        );
    }

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
    nextCourse: PropTypes.number

};
ActiveRouteWidget.storeKeys={
    isApproaching: keys.nav.route.isApproaching,
    routeName: keys.nav.route.name,
    eta: keys.nav.route.eta,
    remain: keys.nav.route.remain,
    nextCourse: keys.nav.route.nextCourse,
};

module.exports=ActiveRouteWidget;