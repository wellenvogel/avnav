/**
 * Created by andreas on 23.02.16.
 */

import React, {useEffect, useRef} from "react";
import PropTypes from 'prop-types';
import keys from '../util/keys.jsx';
import routeobjects from '../nav/routeobjects.js';
import ItemList from './ItemList.jsx';
import WaypointItem from './WayPointItem.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import GuiHelper from '../util/GuiHelpers.js';
import {WidgetFrame, WidgetProps} from "./WidgetBase";
import {injectav} from "../util/helper";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);

const RoutePoint=(showLL)=>{
    return (props)=>{
        return <WaypointItem {...props} showLatLon={showLL}/>
    }
}
const RoutePointsWidget = (props) => {
    let listRef = useRef();
    const scrollSelected = () => {
        if (!listRef.current) return;
        let el = listRef.current.querySelector('.activeEntry');
        if (el) {
            let mode = GuiHelper.scrollInContainer(listRef.current, el);
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
                onItemClick={(ev) => {
                    if (props.onClick) {
                        const avev = injectav(ev);
                        if (avev.avnav.item) {
                            avev.avnav.point=new routeobjects.RoutePoint(avev.avnav.item)
                            delete avev.avnav.item; //let the container fill this
                            props.onClick(avev);
                        }
                    }
                }}
                onClick={(ev) => {
                    if (props.isEditing && props.onClick) {
                        props.onClick(ev);
                    }
                }}
                listRef={(element) => {
                    listRef.current = element
                }}
            />
        </WidgetFrame>
    );
}


RoutePointsWidget.propTypes={
    //onClick: add an avnav.point property for the clicked route point
    ...WidgetProps,
    route:          PropTypes.instanceOf(routeobjects.Route),
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