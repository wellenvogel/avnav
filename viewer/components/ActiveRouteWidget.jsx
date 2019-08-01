/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import compare from '../util/shallowcompare';
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js';
import Helper from '../util/helper.js';

let fmt=new Formatter();

class ActiveRouteWidget extends React.Component{
    constructor(props){
        super(props);
        this.lastApproaching=props.isApproaching;
    }
    shouldComponentUpdate(nextProps,nextState){
        return Helper.compareProperties(this.props,nextProps,ActiveRouteWidget.storeKeys);
    }
    componentDidUpdate(){
        if (this.props.updateCallback && this.doLayoutUpdate){
            this.doLayoutUpdate=false;
            this.props.updateCallback();
        }
    }
    render(){
        let self=this;
        let classes="avn_widget avn_activeRouteWidget "+this.props.classes||""+ " "+this.props.className||"";
        if (this.props.isApproaching) classes +=" avn_route_display_approach ";
        if (this.props.isApproaching != this.lastApproaching){
            this.doLayoutUpdate=true;
            this.lastApproaching=this.props.isApproaching;
        }
        return (
        <div className={classes} onClick={this.props.onClick} style={this.props.style}>
            <div className="avn_widgetInfoLeft">RTE</div>
            <div className="avn_routeName">{this.props.routeName}</div>
            <div>
                <span className="avn_routeRemain">{fmt.formatDecimal(this.props.remain,3,1)}</span>
                <span className='avn_unit'>nm</span>
            </div>
            <div className="avn_routeEta">{fmt.formatTime(this.props.eta)}</div>
            { this.props.isApproaching ?
                <div className="avn_routeNext">
                    <span className="avn_routeNextCourse">{fmt.formatDecimal(this.props.nextCourse,3,0)}</span>
                    <span className='avn_unit'>&#176;</span>
                </div>
                : <div></div>
            }
        </div>
        );
    }

}

ActiveRouteWidget.propTypes={
    //formatter: React.PropTypes.func,
    onClick: PropTypes.func,
    classes: PropTypes.string,
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
    nextCourse: keys.nav.route.nextCourse
};

module.exports=ActiveRouteWidget;