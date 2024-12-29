/**
 * Created by andreas on 23.02.16.
 */

import React, {useEffect} from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import routeobjects from '../nav/routeobjects.js';
import ItemList from './ItemList.jsx';
import WaypointItem from './WayPointItem.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import GuiHelper from '../util/GuiHelpers.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);

const RoutePoint=(showLL)=>{
    return (props)=>{
        return <WaypointItem {...props} showLatLon={showLL}/>
    }
}
const RoutePointsWidget = (props) => {
    let listRef = undefined;
    const scrollSelected = () => {
        if (!listRef) return;
        let el = listRef.querySelector('.activeEntry');
        if (el) {
            let mode = GuiHelper.scrollInContainer(listRef, el);
            if (mode < 1 || mode > 2) return;
            el.scrollIntoView(mode == 1);
        }
    }
    useEffect(() => {
        scrollSelected();
    });
    let [route, index, isActive] = StateHelper.getRouteIndexFlag(props);
    if ((!route || !route.points || route.points.length < 1) && !props.isEditing) return null;
    let classes = "routePointsWidget";
    if (isActive) classes += " activeRoute ";
    if (props.mode === 'horizontal' && !props.isEditing) return null; //we do not display...
    return (
        <WidgetFrame {...props} addClass={classes} caption={undefined} unit={undefined}>
            <ItemList
                itemList={route ? route.getRoutePoints(index, props.useRhumbLine) : []}
                itemCreator={() => {
                    return RoutePoint(props.showLatLon)
                }}
                scrollable={true}
                onItemClick={(item) => {
                    if (props.onClick)
                        props.onClick(new routeobjects.RoutePoint(item))
                }}
                onClick={(ev) => {
                    if (props.isEditing && props.onClick) {
                        props.onClick(ev);
                    }
                }}
                listRef={(element) => {
                    listRef = element
                }}
            />
        </WidgetFrame>
    );
}


RoutePointsWidget.propTypes={
    ...WidgetProps,
    route:          PropTypes.objectOf(routeobjects.Route),
    isActive:       PropTypes.bool,
    index:          PropTypes.number,
    showLatLon:     PropTypes.bool,
    isEditing:      PropTypes.bool,
    useRhumbLine:   PropTypes.bool
};

RoutePointsWidget.storeKeys=editor.getStoreKeys({
    showLatLon: keys.properties.routeShowLL,
    isEditing: keys.gui.global.layoutEditing,
    useRhumbLine: keys.nav.routeHandler.useRhumbLine
});

export default RoutePointsWidget;