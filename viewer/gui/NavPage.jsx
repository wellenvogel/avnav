/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import history from '../util/history.js';
import MapPage,{overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import GuiHelpers from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import AisData from '../nav/aisdata.js';
import ButtonList from '../components/ButtonList.jsx';
import WayPointDialog from '../components/WaypointDialog.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import LayoutHandler from '../util/layouthandler.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import anchorWatch from '../components/AnchorWatchDialog.jsx';
import Mob from '../components/Mob.js';
import Dimmer from '../util/dimhandler.js';
import FeatureInfoDialog from "../components/FeatureInfoDialog";
import {TrackConvertDialog} from "../components/TrackInfoDialog";
import FullScreen from '../components/Fullscreen';

const RouteHandler=NavHandler.getRoutingHandler();

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const PAGENAME='navpage';




const getPanelList=(panel)=>{
    return LayoutHandler.getPanelData(PAGENAME,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.SMALL]));
};
/**
 *
 * @param item
 * @param idx if undefined - just update the let "to" point
 */
const startWaypointDialog=(item,idx)=>{
    if (! item) return;
    const wpChanged=(newWp,close)=>{
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,(err)=>{
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            if (idx !== undefined){
                activeRoute.changeSelectedWaypoint(changedWp,idx);
            }
            else{
                activeRoute.changeTargetWaypoint(changedWp);
            }
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

const setCenterToTarget=()=>{
    MapHolder.setGpsLock(false);
    MapHolder.setCenter(activeRoute.hasRoute()?activeRoute.getPointAt():activeRoute.getCurrentTarget());
};

const navNext=()=>{
    if (!activeRoute.hasRoute() ) return;
    RouteHandler.wpOn(activeRoute.getNextWaypoint())
};

const navToWp=(on)=>{
    if(on){
        let center = globalStore.getData(keys.map.centerPosition);
        let current=activeRoute.getCurrentTarget();
        let wp=new navobjects.WayPoint();
        //take over the wp name if this was a normal wp with a name
        //but do not take over if this was part of a route
        if (current && current.name && current.name !== navobjects.WayPoint.MOB ){
            wp.name=current.name;
        }
        else{
            wp.name = 'Marker';
        }
        wp.routeName=undefined;
        center.assign(wp);
        RouteHandler.wpOn(wp);
        return;
    }
    RouteHandler.routeOff();
    MapHolder.triggerRender();
};

class NavPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
        this.state={
            showWpButtons: false
        };
        this.showWpButtons=this.showWpButtons.bind(this);
        this.widgetClick=this.widgetClick.bind(this);
        this.waypointButtons=[
            anchorWatch(),
            {
                name:'WpLocate',
                onClick:()=>{
                    self.wpTimer.startTimer();
                    setCenterToTarget();
                    this.showWpButtons(false);
                }
            },
            {
                name:'WpEdit',
                onClick:()=>{
                    if (activeRoute.hasRoute()){
                        startWaypointDialog(activeRoute.getPointAt(),activeRoute.getIndex());
                    }
                    else {
                        startWaypointDialog(activeRoute.getCurrentTarget());
                    }
                    this.showWpButtons(false);
                }
            },
            {
                name:'WpGoto',
                storeKeys:activeRoute.getStoreKeys(),
                updateFunction: (state)=> {
                    return {visible: !StateHelper.selectedIsActiveTarget(state)}
                },
                onClick:()=>{
                    let selected=activeRoute.getPointAt();
                    this.showWpButtons(false);
                    if (selected) RouteHandler.wpOn(selected);
                }

            },
            {
                name:'NavNext',
                storeKeys:activeRoute.getStoreKeys(),
                updateFunction: (state)=> {
                    return {visible:  StateHelper.selectedIsActiveTarget(state) &&  StateHelper.hasPointAtOffset(state,1)};
                },
                onClick:()=>{
                    self.showWpButtons(false);
                    activeRoute.moveIndex(1);
                    RouteHandler.wpOn(activeRoute.getPointAt());

                }
            },
            {
                name:'WpNext',
                storeKeys:activeRoute.getStoreKeys(),
                updateFunction: (state)=> {
                    return {
                        disabled:!StateHelper.hasPointAtOffset(state,1),
                        visible: StateHelper.hasRoute(state)
                    };
                },
                onClick:()=>{
                    self.wpTimer.startTimer();
                    activeRoute.moveIndex(1);
                    let next=activeRoute.getPointAt();
                    MapHolder.setCenter(next);

                }
            },
            {
                name:'WpPrevious',
                storeKeys:activeRoute.getStoreKeys(),
                updateFunction: (state)=> {
                    return {
                        disabled:!StateHelper.hasPointAtOffset(state,-1),
                        visible: StateHelper.hasRoute(state)
                    }
                },
                onClick:()=>{
                    self.wpTimer.startTimer();
                    activeRoute.moveIndex(-1);
                    let next=activeRoute.getPointAt();
                    MapHolder.setCenter(next);
                }
            }
        ];
        activeRoute.setIndexToTarget();
        this.wpTimer=GuiHelpers.lifecycleTimer(this,()=>{
            this.showWpButtons(false);
        },globalStore.getData(keys.properties.wpButtonTimeout)*1000);
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            if (action == "centerToTarget"){
                return setCenterToTarget();
            }
            if (action == "navNext"){
                return navNext();
            }
            if (action == "toggleNav"){
                navToWp(!activeRoute.hasActiveTarget())
            }
        },"page",["centerToTarget","navNext","toggleNav"])
    }
    widgetClick(item,data,panel,invertEditDirection){
        if (EditWidgetDialog.createDialog(item,PAGENAME,panel,invertEditDirection)) return;
        if (item.name == "AisTarget"){
            let mmsi=(data && data.mmsi)?data.mmsi:item.mmsi;
            if (! mmsi) return;
            history.push("aisinfopage",{mmsi:mmsi});
            return;
        }
        if (item.name == "ActiveRoute"){
            if (!activeRoute.hasRoute()) return;
            activeRoute.setIndexToTarget();
            activeRoute.syncTo(RouteEdit.MODES.EDIT);
            history.push("editroutepage");
            return;
        }
        if (item.name == "Zoom"){
            MapHolder.checkAutoZoom(true);
            return;
        }
        if (panel == 'bottomLeft'){
            activeRoute.setIndexToTarget();
            this.showWpButtons(true);
            return;
        }
        history.push("gpspage",{widget:item.name});

    };
    showWpButtons(on){
        if (on) {
            this.wpTimer.startTimer();
        }
        else {
            this.wpTimer.stopTimer();
        }
        this.setState({showWpButtons:on})
    }
    mapEvent(evdata){
        console.log("mapevent: "+evdata.type);
        if (evdata.type === MapHolder.EventTypes.SELECTAIS){
            let aisparam=evdata.aisparam;
            if (!aisparam) return;
            if (aisparam.mmsi){
                AisData.setTrackedTarget(aisparam.mmsi);
                history.push('aisinfopage',{mmsi:aisparam.mmsi});
                return true;
            }
            return;
        }
        if (evdata.type === MapHolder.EventTypes.FEATURE){
            let feature=evdata.feature;
            if (! feature) return;
            feature.additionalActions=[];
            feature.additionalInfoRows=[];
            const showFeature=()=>{
                if (feature.nextTarget && ! feature.activeRoute) {
                    feature.additionalActions.push(
                        {
                            name: 'goto', label: 'Goto', onClick: () => {
                                let target = feature.nextTarget;
                                if (!target) return;
                                let wp = new navobjects.WayPoint(target[0], target[1], feature.name);
                                RouteHandler.wpOn(wp);
                            }
                        }
                    );
                }
                FeatureInfoDialog.showDialog(feature);
            }
            if (feature.overlayType === 'route' && ! feature.activeRoute){
                let currentRouteName=activeRoute.getRouteName();
                if (Helper.getExt(currentRouteName) !== '.gpx') currentRouteName+='.gpx';
                if (activeRoute.hasActiveTarget() && currentRouteName === feature.overlayName){
                    //do not show a feature pop up if we have an overlay that exactly has the current route
                    return false;
                }
            }
            if (feature.overlayType === 'track'){
                feature.additionalActions.push({
                   name:'toroute',
                   label: 'Convert',
                   onClick:(props)=>{
                       TrackConvertDialog.showDialog(props.overlayName)
                   }
                });
            }
            if (feature.overlayType !== 'route' || ! feature.nextTarget){
                showFeature()
            } else {
                let currentTarget=activeRoute.getCurrentTarget();
                //show a "routeTo" if this is not the current target
                if (! feature.activeRoute || ! currentTarget ||
                    currentTarget.lon !== feature.nextTarget[0]||
                    currentTarget.lat !== feature.nextTarget[1]
                ) {
                    feature.additionalActions.push({
                        name: 'routeTo',
                        label: 'Route',
                        onClick: (props) => {
                            RouteHandler.wpOn(props.routeTarget);
                        },
                        condition: (props) => props.routeTarget
                    });
                }
                feature.additionalActions.push({
                    name:'editRoute',
                    label:'Edit',
                    onClick:()=>{
                        RouteHandler.fetchRoute(feature.overlayName,false,
                            (route)=>{
                                let idx=route.findBestMatchingIdx(feature.nextTarget);
                                let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                                editor.setNewRoute(route,idx >= 0?idx:undefined);
                                history.push("editroutepage");
                            },
                            (error)=> {
                                if (error) Toast(error);
                            });
                    }
                });
                showFeature();
            }
            return true;
        }
    }
    componentWillUnmount(){
    }
    componentDidMount(){
        MapHolder.showEditingRoute(false);

    }
    getButtons(){
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
                },
                editDisable:true
            },
            {
                name: "LockMarker",
                storeKeys: activeRoute.getStoreKeys(),
                updateFunction:(state)=>{
                    return {visible:!StateHelper.hasActiveTarget(state)}
                },
                onClick:()=>{
                    navToWp(true);
                },
                editDisable: true
            },
            {
                name: "StopNav",
                storeKeys: activeRoute.getStoreKeys(),
                updateFunction:(state)=>{
                    return {visible:StateHelper.hasActiveTarget(state)};
                },
                toggle:true,
                onClick:()=>{
                    navToWp(false);
                },
                editDisable:true
            },
            {
                name: "CourseUp",
                storeKeys:{
                    toggle: keys.map.courseUp
                },
                onClick:()=>{
                    MapHolder.setCourseUp(!globalStore.getData(keys.map.courseUp,false))
                },
                editDisable:true
            },
            {
                name: "ShowRoutePanel",
                onClick:()=>{
                    if (activeRoute.getIndex() < 0 ) activeRoute.setIndexToTarget();
                    activeRoute.syncTo(RouteEdit.MODES.EDIT);
                    history.push("editroutepage");
                },
                overflow: true

            },
            {
                name: "NavOverlays",
                onClick:()=>overlayDialog(),
                overflow: true,
                storeKeys:{
                    visible:keys.gui.capabilities.uploadOverlays
                }
            },
            Mob.mobDefinition,
            EditPageDialog.getButtonDef(PAGENAME,
                MapPage.PANELS,
                [LayoutHandler.OPTIONS.SMALL]),
            LayoutFinishedDialog.getButtonDef(),
            FullScreen.fullScreenDefinition,
            Dimmer.buttonDef(),
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        return rt;
    }
    render(){
        let self=this;
        return (
            <MapPage
                className={self.props.className}
                style={self.props.style}
                id={PAGENAME}
                mapEventCallback={self.mapEvent}
                onItemClick={self.widgetClick}
                panelCreator={getPanelList}
                overlayContent={this.state.showWpButtons?<ButtonList
                            itemList={self.waypointButtons}
                            className="overlayContainer"
                        />:null}
                buttonList={self.getButtons()}
                preventCenterDialog={(self.props.options||{}).remote}
                />
        );
    }
}

export default NavPage;