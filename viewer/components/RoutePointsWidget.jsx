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
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import GuiHelper from '../util/GuiHelpers.js';

const editor=new RouteEdit(RouteEdit.MODES.EDIT);

const RoutePoint=(showLL)=>{
    return function(props){
        return <WaypointItem {...props} showLatLon={showLL}/>
    }
};

class RoutePointsWidget extends React.Component{
    constructor(props){
        super(props);
        this.scrollSelected=this.scrollSelected.bind(this);
        GuiHelper.nameKeyEventHandler(this,"widget");
    }

    shouldComponentUpdate(nextProps,nextState){
        for (let k in RoutePointsWidget.propTypes){
            if (k == 'route') continue;
            if (nextProps[k] !== this.props[k]) return true;
        }
        if (!nextProps.route != !this.props.route) return true;
        if (!nextProps.route) return false;
        return nextProps.route.differsTo(this.props.route);
    }
    scrollSelected(){
        if (! this.listRef) return;
        let el=this.listRef.querySelector('.activeEntry');
        if (el) {
            let mode=GuiHelper.scrollInContainer(this.listRef,el);
            if (mode < 1 || mode > 2) return;
            el.scrollIntoView(mode==1);
        }
    }
    componentDidMount(){
        this.scrollSelected();
    }
    componentDidUpdate(){
        this.scrollSelected();
    }
    render(){
        let self=this;
        let [route,index,isActive]=StateHelper.getRouteIndexFlag(this.props);
        if (! route || !route.points || route.points.length < 1) return null;
        let classes="widget routePointsWidget "+this.props.className||"";
        if (isActive) classes +=" activeRoute ";
        if (this.props.mode == 'horizontal') return null; //we do not display...
        return (
            <ItemList className={classes}
                      itemList={route?route.getRoutePoints(index):[]}
                      itemCreator={(item)=>{return RoutePoint(this.props.showLatLon)}}
                      scrollable={true}
                      onItemClick={(item,data)=>{if (self.props.onClick)
                            self.props.onClick(new routeobjects.RoutePoint(item)) }}
                      listRef={(element)=>{self.listRef=element}}
                />
        );
    }

}

RoutePointsWidget.propTypes={
    onClick:        PropTypes.func,
    className:      PropTypes.string,
    mode:           PropTypes.string, //display info side by side if small
    route:          PropTypes.objectOf(routeobjects.Route),
    isActive:       PropTypes.bool,
    index:          PropTypes.number,
    showLatLon:     PropTypes.bool
};

RoutePointsWidget.storeKeys=editor.getStoreKeys({
    showLatLon: keys.properties.routeShowLL
});

module.exports=RoutePointsWidget;