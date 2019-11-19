/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import MapPage from '../components/MapPage.jsx';
import Toast from '../util/overlay.js';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import GuiHelpers from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import DirectWidget from '../components/DirectWidget.jsx';
import navobjects from '../nav/navobjects.js';
import AisData from '../nav/aisdata.js';
import ButtonList from '../components/ButtonList.jsx';
import WayPointDialog from '../components/WaypointDialog.jsx';

const RouteHandler=NavHandler.getRoutingHandler();


const DynamicPage=Dynamic(MapPage);


const widgetClick=(item,data,panel)=>{
    if (item.name == "AisTarget"){
        let mmsi=(data && data.mmsi)?data.mmsi:widget.mmsi;
        if (! mmsi) return;
        history.push("aisinfopage",{mmsi:mmsi});
        return;
    }
    if (item.name == "ActiveRoute"){
        RouteHandler.startEditingRoute();
        RouteHandler.setRouteForPage();
        history.push("routepage");
        return;
    }
    if (item.name == "Zoom"){
        MapHolder.checkAutoZoom(true);
        return;
    }
    if (item.name == 'WindDisplay' || item.name == 'DepthDisplay'){
        history.push("gpspage",{secondPage:true});
        return;
    }
    if (item.name =='COG' || item.name == 'SOG'|| item.name == 'TimeStatus'||item.name == 'Position'){
        history.push('gpspage');
        return;
    }
    if (item.name == 'BRG'||item.name == 'DST'|| item.name=='ETA'|| item.name=='WpPosition'){
        globalStore.storeData(keys.gui.navpage.selectedWp,RouteHandler.getCurrentLegTarget())
    }

};

const getPanelList=(panel,opt_isSmall)=>{
    return GuiHelpers.getPanelFromLayout('navpage',panel,'small',opt_isSmall);
};
const startWaypointDialog=(item)=>{
    const wpChanged=(newWp,close)=>{
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,(err)=>{
            Toast(Helper.escapeHtml(err));
        },RouteHandler);
        if (changedWp) {
            return true;
        }
        return false;
    };
    let RenderDialog=function(props){
        return <WayPointDialog
            {...props}
            waypoint={item}
            okCallback={wpChanged}/>
    };
    OverlayDialog.dialog(RenderDialog);
};
const waypointButtons=[
    {
        name:'WpLocate',
        onClick:()=>{
            MapHolder.setCenter(globalStore.getData(keys.gui.navpage.selectedWp));
            globalStore.storeData(keys.gui.navpage.selectedWp,undefined);
        }
    },
    {
        name:'WpEdit',
        onClick:()=>{
            startWaypointDialog(globalStore.getData(keys.gui.navpage.selectedWp));
            globalStore.storeData(keys.gui.navpage.selectedWp,undefined);
        }
    },
    {
        name:'WpGoto',
        storeKeys:{
            leg:keys.nav.routeHandler.currentLeg,
            selectedWp: keys.gui.navpage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!(state.leg && state.leg.hasRoute())) return rt;
            if (state.leg.isCurrentTarget(state.selectedWp)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.navpage.selectedWp);
            globalStore.storeData(keys.gui.navpage.selectedWp,undefined);
            if (selected) RouteHandler.wpOn(selected);
        }

    },
    {
        name:'NavNext',
        storeKeys:{
            leg:keys.nav.routeHandler.currentLeg,
            selectedWp: keys.gui.navpage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!(state.leg && state.leg.hasRoute())) return rt;
            if (!state.leg.isCurrentTarget(state.selectedWp)) return rt;
            if (!state.leg.currentRoute.getPointAtOffset(state.selectedWp,1)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.navpage.selectedWp);
            globalStore.storeData(keys.gui.navpage.selectedWp,undefined);
            RouteHandler.wpOn(RouteHandler.getPointAtOffset(selected,1));

        }
    },
    {
        name:'WpNext',
        storeKeys:{
            leg:keys.nav.routeHandler.currentLeg,
            selectedWp: keys.gui.navpage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!(state.leg && state.leg.hasRoute())) return rt;
            if (!state.leg.currentRoute.getPointAtOffset(state.selectedWp,1)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.navpage.selectedWp);
            let next=RouteHandler.getPointAtOffset(selected,1);
            globalStore.storeData(keys.gui.navpage.selectedWp,next);
            MapHolder.setCenter(next);

        }
    },
    {
        name:'WpPrevious',
        storeKeys:{
            leg:keys.nav.routeHandler.currentLeg,
            selectedWp: keys.gui.navpage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!(state.leg && state.leg.hasRoute())) return rt;
            if (!state.leg.currentRoute.getPointAtOffset(state.selectedWp,-1)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.navpage.selectedWp);
            let next=RouteHandler.getPointAtOffset(selected,-1);
            globalStore.storeData(keys.gui.navpage.selectedWp,next);
            MapHolder.setCenter(next);
        }
    }
];


class NavPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
    }
    mapEvent(evdata,token){
        console.log("mapevent: "+evdata.type);
        if (evdata.type === MapHolder.EventTypes.SELECTAIS){
            let aisparam=evdata.aisparam;
            if (!aisparam) return;
            if (aisparam.mmsi){
                AisData.setTrackedTarget(aisparam.mmsi);
                history.push('aisinfopage',{mmsi:aisparam.mmsi});
            }
            return;
        }
    }
    componentWillUnmount(){
    }
    componentDidMount(){

    }
    getButtons(type){
        let rt=[
            {
                name: "ZoomIn",
                onClick:()=>{MapHolder.changeZoom(1)}
            },
            {
                name: "ZoomOut",
                onClick:()=>{MapHolder.changeZoom(-1)}
            },
            {
                name: "LockPos",
                storeKeys:{
                    toggle: keys.map.lockPosition
                },
                updateFunction:(state)=>{
                    return state;
                },
                onClick:()=>{
                    let old=globalStore.getData(keys.map.lockPosition);
                    MapHolder.setGpsLock(!old);
                }
            },
            {
                name: "LockMarker",
                storeKeys: {
                    leg: keys.nav.routeHandler.currentLeg
                },
                updateFunction:(state)=>{
                    return {visible:!(state.leg && state.leg.isRouting())
                    }
                },
                onClick:()=>{
                    let center = NavHandler.getMapCenter();
                    let currentLeg=RouteHandler.getCurrentLeg();
                    let wp=new navobjects.WayPoint();
                    //take over the wp name if this was a normal wp with a name
                    //but do not take over if this was part of a route
                    if (currentLeg && currentLeg.to && currentLeg.to.name && ! currentLeg.to.routeName){
                        wp.name=currentLeg.to.name;
                    }
                    else{
                        wp.name = 'Marker';
                    }
                    center.assign(wp);
                    RouteHandler.wpOn(wp);
                }
            },
            {
                name: "StopNav",
                storeKeys: {
                    leg: keys.nav.routeHandler.currentLeg
                },
                updateFunction:(state)=>{
                    return {visible:(state.leg && state.leg.isRouting())
                    }
                },
                toggle:true,
                onClick:()=>{
                    RouteHandler.routeOff();
                    MapHolder.triggerRender();
                }
            },
            {
                name: "CourseUp",
                storeKeys:{
                    toggle: keys.map.courseUp
                },
                onClick:()=>{
                    MapHolder.setCourseUp(!globalStore.getData(keys.map.courseUp,false))
                }
            },
            {
                name: "ShowRoutePanel",
                onClick:()=>{
                    history.push("editroutepage");
                }

            },
            {
                name: "AnchorWatch",
                storeKeys: {
                    watchDistance: keys.nav.anchor.watchDistance
                },
                updateFunction:(state)=>{
                    return {
                        toggle: state.watchDistance !== undefined
                    }
                },
                onClick:()=>{
                    GuiHelpers.anchorWatchDialog(undefined);
                }
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        return rt;
    }
    render(){
        let self=this;
        let url=globalStore.getData(keys.gui.navpage.mapurl);
        let chartBase=globalStore.getData(keys.gui.navpage.chartbase,url);
        return (
            <DynamicPage
                className={self.props.className}
                style={self.props.style}
                id="navpage"
                mapEventCallback={self.mapEvent}
                onItemClick={widgetClick}
                mapUrl={url}
                chartBase={chartBase}
                panelCreator={getPanelList}
                storeKeys={{
                    selectedWp:keys.gui.navpage.selectedWp
                }}
                updateFunction={(state)=>{
                    let rt={
                        buttonList:[],
                        overlayContent:undefined
                    };
                    rt.buttonList=self.getButtons();
                    if (state.selectedWp){
                        rt.overlayContent=<ButtonList
                            itemList={waypointButtons}
                            className="overlayContainer"
                        />;
                    }
                    return rt;
                }}
                />
        );
    }
}

module.exports=NavPage;