/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import MapPage, {overlayDialog} from '../components/MapPage.jsx';
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
import WayPointDialog from '../components/WaypointDialog.jsx';
import ButtonList from '../components/ButtonList.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import FeatureInfoDialog from "../components/FeatureInfoDialog";

const RouteHandler=NavHandler.getRoutingHandler();
const PAGENAME="editroutepage";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);
const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const isActiveRoute=()=>{
    let activeName=activeRoute.getRouteName();
    if (activeName && activeName == editor.getRouteName()) return true;
    return false;
};
const getCurrentEditor=()=>{
    return isActiveRoute()?activeRoute:editor;
};

const startWaypointDialog=(item,index)=>{
    if (! item) return;
    const wpChanged=(newWp,close)=>{
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,(err)=>{
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            getCurrentEditor().changeSelectedWaypoint(changedWp,index);
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





const getPanelList=(panel)=>{
    return LayoutHandler.getPanelData(PAGENAME,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.SMALL]));
};

const checkRouteWritable=function(){
    let currentEditor=getCurrentEditor();
    if (currentEditor.isRouteWritable()) return true;
    let ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name");
    ok.then(function(){
        currentEditor.syncTo(RouteEdit.MODES.PAGE);
        history.push('routepage');
    });
    return false;
};


const DEFAULT_ROUTE="default";

class EditRoutePage extends React.Component{
    constructor(props){
        super(props);
        this.state={
            showWpButtons:false,
            lastCenteredWp: undefined
        }
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
        if (!editor.hasRoute()){
            RouteHandler.fetchRoute(DEFAULT_ROUTE,true,(route)=>{
                    editor.setRouteAndIndex(route,0);
                },
                (error)=>{
                    let rt=new routeobjects.Route(DEFAULT_ROUTE);
                    editor.setRouteAndIndex(rt,0);
                });

        }
        this.wpTimer=GuiHelpers.lifecycleTimer(this,()=>{
            this.setState({showWpButtons:false});
        },globalStore.getData(keys.properties.wpButtonTimeout)*1000);
        RouteHandler.setCurrentRoutePage(PAGENAME);
        this.widgetClick=this.widgetClick.bind(this);
        GuiHelpers.storeHelperState(this,{
            activeRouteName: keys.nav.routeHandler.activeName,
            dimensions:keys.gui.global.windowDimensions
        });
    }
    showWpButtons(on){
        if (on) {
            this.wpTimer.startTimer();
        }
        else {
            this.wpTimer.stopTimer();
        }
        this.setState({showWpButtons:on})
    }

    widgetClick(item,data,panel,invertEditDirection){
        let currentEditor=getCurrentEditor();
        if (item.name == "EditRoute"){
            if (globalStore.getData(keys.gui.global.layoutEditing)) return;
            currentEditor.syncTo(RouteEdit.MODES.PAGE);
            history.push("routepage");
            return;
        }
        if (item.name == 'RoutePoints'){
            if (globalStore.getData(keys.gui.global.layoutEditing)) return;
            if (data && data.idx !== undefined){
                let lastSelected=currentEditor.getIndex();
                currentEditor.setNewIndex(data.idx);
                let last=this.state.lastCenteredWp;
                MapHolder.setCenter(currentEditor.getPointAt());
                this.setState({lastCenteredWp:data.idx});
                if (lastSelected == data.idx && last == data.idx){
                    startWaypointDialog(data,data.idx);
                }
            }
            return;
        }
        if (EditWidgetDialog.createDialog(item,PAGENAME,panel,invertEditDirection)) return;
        if (panel == 'bottomRight'){
            if (! globalStore.getData(keys.nav.gps.valid)) return;
            let boatPos=globalStore.getData(keys.nav.gps.position);
            MapHolder.setCenter(boatPos);
            return;
        }
        if (panel == 'bottomLeft'){
            this.showWpButtons(true)
        }

    };

    getWaypointButtons(){
        let self=this;
        let waypointButtons=[
            {
                name:'WpLocate',
                onClick:()=>{
                    self.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    MapHolder.setCenter(currentEditor.getPointAt());
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                }
            },
            {
                name:'WpEdit',
                onClick:()=>{
                    self.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    startWaypointDialog(currentEditor.getPointAt(),currentEditor.getIndex());
                }
            },
            {
                name:'WpNext',
                storeKeys:getCurrentEditor().getStoreKeys(),
                updateFunction: (state)=> {
                    return {disabled:! StateHelper.hasPointAtOffset(state,1)};
                },
                onClick:()=>{
                    self.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    currentEditor.moveIndex(1);
                    MapHolder.setCenter(currentEditor.getPointAt());
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                }
            },
            {
                name:'WpPrevious',
                storeKeys:getCurrentEditor().getStoreKeys(),
                updateFunction: (state)=> {
                    return {disabled:!StateHelper.hasPointAtOffset(state,-1)}
                },
                onClick:()=>{
                    self.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    currentEditor.moveIndex(-1);
                    MapHolder.setCenter(currentEditor.getPointAt());
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                }
            }
        ];
        return waypointButtons;
    };
    insertOtherRoute(name,opt_before){
        RouteHandler.fetchRoute(name,false,(route)=>{
            let lastPoint;
            let editor=getCurrentEditor();
            if (! route.points) return;
            editor.addMultipleWaypoints(route.points,opt_before);
            },
            (error)=>{Toast(error)}
            );
    }
    mapEvent(evdata){
        console.log("mapevent: "+evdata.type);
        let currentEditor = getCurrentEditor();
        if (evdata.type === MapHolder.EventTypes.SELECTWP) {
            currentEditor.setNewIndex(currentEditor.getIndexFromPoint(evdata.wp));
            return true;
        }
        if (evdata.type === MapHolder.EventTypes.FEATURE){
            let feature=evdata.feature;
            if (! feature) return;
            if (feature.kind === 'point' && feature.nextTarget && checkRouteWritable()){
                feature.additionalActions=[
                    {name:'insert',label:'Before',onClick:()=>{
                            let currentEditor=getCurrentEditor();
                            let target=new navobjects.WayPoint(
                                feature.nextTarget[0],
                                feature.nextTarget[1],
                                feature.name
                            )
                            MapHolder.setCenter(target);
                            currentEditor.addWaypoint(target,true);
                            this.setState({lastCenteredWp:currentEditor.getIndex()});
                        }},
                    {name:'add',label:'After',onClick:()=>{
                        let currentEditor=getCurrentEditor();
                        let target=new navobjects.WayPoint(
                            feature.nextTarget[0],
                            feature.nextTarget[1],
                            feature.name
                        )
                        MapHolder.setCenter(target);
                        currentEditor.addWaypoint(target);
                        this.setState({lastCenteredWp:currentEditor.getIndex()});
                        }},
                    {name:'center',label:'Center',onClick:()=>{
                            let currentEditor=getCurrentEditor();
                            let target=new navobjects.WayPoint(
                                feature.nextTarget[0],
                                feature.nextTarget[1],
                                feature.name
                            )
                            MapHolder.setCenter(target);
                            currentEditor.changeSelectedWaypoint(target);
                            this.setState({lastCenteredWp:currentEditor.getIndex()});
                        }}
                ]
            }
            if (feature.overlayType === 'route'){
                let routeName=feature.overlayName;
                if (routeName && routeName.replace(/\.gpx$/,'') !== currentEditor.getRouteName()){
                    feature.additionalActions=[
                        {name:'insert',label:'Before',onClick:()=>{
                                this.insertOtherRoute(feature.overlayName,true);
                            }},
                        {name:'add',label:'Ater',onClick:()=>{
                                this.insertOtherRoute(feature.overlayName,false);
                            }}
                    ]
                }
            }
            FeatureInfoDialog.showDialog(feature);
            return true;
        }

    }
    componentWillUnmount(){
        MapHolder.setRoutingActive(false);
        MapHolder.setGpsLock(this.lastGpsLock);
        RouteHandler.unsetCurrentRoutePage(PAGENAME);
    }
    componentDidMount(){
        MapHolder.setRoutingActive(true);
        MapHolder.showEditingRoute(true);
        this.lastGpsLock=MapHolder.getGpsLock();
        MapHolder.setGpsLock(false);
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
                name:"NavAddAfter",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    let center=MapHolder.getCenter();
                    if (!center) return;
                    let currentEditor=getCurrentEditor();
                    let current=currentEditor.getPointAt();
                    if (current){
                        let distance=MapHolder.pixelDistance(center,current);
                        if (distance < 8) return;
                    }
                    currentEditor.addWaypoint(center);
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                },
                editDisable: true
            },
            {
                name:"NavAdd",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    let center=MapHolder.getCenter();
                    if (!center) return;
                    let currentEditor=getCurrentEditor();
                    let current=currentEditor.getPointAt();
                    if (current){
                        let distance=MapHolder.pixelDistance(center,current);
                        if (distance < 8) return;
                    }
                    currentEditor.addWaypoint(center,true);
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                },
                editDisable: true
            },
            {
                name:"NavDelete",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    getCurrentEditor().deleteWaypoint();
                    let newIndex=getCurrentEditor().getIndex();
                    let currentPoint=getCurrentEditor().getPointAt(newIndex);
                    if (currentPoint) {
                        MapHolder.setCenter(currentPoint);
                        this.setState({lastCenteredWp:newIndex});
                    }
                },
                editDisable: true
            },
            {
                name:"NavToCenter",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    let center=MapHolder.getCenter();
                    if (!center) return;
                    let currentEditor=getCurrentEditor();
                    currentEditor.changeSelectedWaypoint(center);
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                },
                overflow: true,
                editDisable: true
            },
            {
                name:"NavGoto",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    RouteHandler.wpOn(getCurrentEditor().getPointAt());
                    history.pop();
                },
                editDisable: true,
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
                MapPage.PANELS,[LayoutHandler.OPTIONS.SMALL]),
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
        let isSmall=(this.state.dimensions||{width:0}).width
            < globalStore.getData(keys.properties.smallBreak);
        let overlayContent=(isSmall || this.state.showWpButtons)?
            <ButtonList
                itemList={this.getWaypointButtons()}
                className="overlayContainer"
            />
            :
            null;
        return (
            <MapPage
                className={self.props.className}
                style={self.props.style}
                id={PAGENAME}
                mapEventCallback={self.mapEvent}
                onItemClick={this.widgetClick}
                panelCreator={getPanelList}
                buttonList={self.getButtons()}
                overlayContent={overlayContent}
                />
        );
    }
}

export default EditRoutePage;