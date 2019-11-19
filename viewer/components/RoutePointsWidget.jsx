/**
 * Created by andreas on 23.02.16.
 */

import React from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import Formatter from '../util/formatter.js'
import Helper from '../util/helper.js';
import routeobjects from '../nav/routeobjects.js';
import ItemList from './ItemList.jsx';
import WaypointItem from './WayPointItem.jsx';
import assign from 'object-assign';


class RoutePointsWidget extends React.Component{

    shouldComponentUpdate(nextProps,nextState){
        for (let k in RoutePointsWidget.propTypes){
            if (k == 'route') continue;
            if (nextProps[k] !== this.props[k]) return true;
        }
        if (!nextProps.route != !this.props.Route) return true;
        if (!nextProps.route) return false;
        return nextProps.route.differsTo(this.props.route);
    }
    render(){
        let self=this;
        let classes="avn_widget avn_routePointsWidget "+this.props.className||"";
        if (this.props.editingActive) classes +=" avn_activeRoute ";

        return (
            <ItemList className={classes}
                      itemList={this.props.route?this.props.route.getRoutePoints(this.props.selectedPoint):[]}
                      itemClass={WaypointItem}
                      scrollable={true}
                      onItemClick={(item,data)=>{if (self.props.onClick) self.props.onClick(item) }}
                />
        );
    }

}

RoutePointsWidget.propTypes={
    onClick:        PropTypes.func,
    className:      PropTypes.string,
    mode:           PropTypes.string, //display info side by side if small
    route:          PropTypes.objectOf(routeobjects.Route),
    editingActive:  PropTypes.bool,
    selectedPoint:  PropTypes.number
};

RoutePointsWidget.storeKeys={
    route:          keys.nav.routeHandler.editingRoute,
    editingActive:  keys.nav.editRoute.isActive
};

module.exports=RoutePointsWidget;