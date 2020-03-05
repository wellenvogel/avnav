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
import Toast from '../components/Toast.jsx';
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
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import LayoutHandler from '../util/layouthandler.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import anchorWatch from '../components/AnchorWatchDialog.jsx';

const RouteHandler=NavHandler.getRoutingHandler();

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const DynamicPage=Dynamic(MapPage);
const PAGENAME='navpage';

const widgetClick=(item,data,panel,invertEditDirection)=>{
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
        globalStore.storeData(keys.gui.navpage.showWpButtons,true);
        return;
    }
    history.push("gpspage",{widget:item.name});

};

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
        this.waypointButtons=[
            anchorWatch(),
            {
                name:'WpLocate',
                onClick:()=>{
                    self.wpTimer.startTimer();
                    setCenterToTarget();
                    globalStore.storeData(keys.gui.navpage.showWpButtons,false);
                }
            },
            {
                name:'WpEdit',
                onClick:()=>{
                    self.wpTimer.startTimer();
                    if (activeRoute.hasRoute()){
                        startWaypointDialog(activeRoute.getPointAt(),activeRoute.getIndex());
                    }
                    else {
                        startWaypointDialog(activeRoute.getCurrentTarget());
                    }
                    globalStore.storeData(keys.gui.navpage.showWpButtons,false);
                }
            },
            {
                name:'WpGoto',
                storeKeys:activeRoute.getStoreKeys(),
                updateFunction: (state)=> {
                    return {visible: !StateHelper.selectedIsActiveTarget(state)}
                },
                onClick:()=>{
                    self.wpTimer.startTimer();
                    let selected=activeRoute.getPointAt();
                    globalStore.storeData(keys.gui.navpage.showWpButtons,false);
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
                    self.wpTimer.startTimer();
                    globalStore.storeData(keys.gui.navpage.showWpButtons,false);
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
        globalStore.storeData(keys.gui.navpage.showWpButtons,false);
        this.wpTimer=GuiHelpers.lifecycleTimer(this,()=>{
            globalStore.storeData(keys.gui.navpage.showWpButtons,false);
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
        MapHolder.showEditingRoute(false);

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
                }

            },
            GuiHelpers.mobDefinition,
            EditPageDialog.getButtonDef(PAGENAME,
                MapPage.PANELS,
                [LayoutHandler.OPTIONS.SMALL]),
            LayoutFinishedDialog.getButtonDef(),
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
                id={PAGENAME}
                mapEventCallback={self.mapEvent}
                onItemClick={widgetClick}
                mapUrl={url}
                chartBase={chartBase}
                panelCreator={getPanelList}
                storeKeys={{
                    showWpButtons:keys.gui.navpage.showWpButtons
                }}
                updateFunction={(state)=>{
                    let rt={
                        buttonList:[],
                        overlayContent:undefined
                    };
                    rt.buttonList=self.getButtons();
                    if (state.showWpButtons){
                        self.wpTimer.startTimer();
                        rt.overlayContent=<ButtonList
                            itemList={self.waypointButtons}
                            className="overlayContainer"
                        />;
                    }
                    else{
                        self.wpTimer.stopTimer();
                    }
                    return rt;
                }}
                />
        );
    }
}

module.exports=NavPage;