/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import MapPage, {overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import OverlayDialog, {dialogHelper, InfoItem} from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import GuiHelpers from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import WayPointDialog from '../components/WaypointDialog.jsx';
import ButtonList from '../components/ButtonList.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import FeatureInfoDialog from "../components/FeatureInfoDialog";
import mapholder from "../map/mapholder.js";
import {Input, InputSelect} from "../components/Inputs";
import DB from '../components/DialogButton';
import Formatter from "../util/formatter";
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";
import Page from "../components/Page";

const RouteHandler=NavHandler.getRoutingHandler();
const PAGENAME="editroutepage";

const editor=new RouteEdit(RouteEdit.MODES.EDIT);
const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const isActiveRoute=()=>{
    let activeName=activeRoute.getRouteName();
    if (activeName && activeName === editor.getRouteName()) return true;
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

export const INFO_ROWS=[
    {label:'points',value:'numpoints'},
    {label:'length',value:'length',formatter:(v)=>{
            return Formatter.formatDistance(v)+" nm";
        }},
];
class EditRouteDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={
            name:props.route.name,
            unchangedName: props.route.name,
            route: this.props.route?this.props.route.clone():undefined,
            changed:false,
            nameChanged: false,
            currentRoutes: [],
            inverted: false
        }
        this.changeName=this.changeName.bind(this);
        this.dialog=dialogHelper(this);
        this.loadNewRoute=this.loadNewRoute.bind(this);
    }
    componentDidMount() {
        RouteHandler.listRoutes(true)
            .then((routes)=>{
                routes.sort((a,b)=>{
                    let na=a.name?a.name.toLowerCase():undefined;
                    let nb=b.name?b.name.toLowerCase():undefined;
                    if (na < nb) return -1;
                    if (na > nb) return 1;
                    return 0;
                })
                this.setState({currentRoutes:routes,routesLoaded:true});
            })
            .catch((error)=>{Toast(error)});
    }
    isActiveRoute(){
        let activeName=activeRoute.getRouteName();
        return (activeName && this.state.unchangedName === activeName);
    }
    getCurrentEditor(){
        return this.isActiveRoute()?activeRoute:editor;
    }
    existsRoute(name){
        if (! this.state.routesLoaded) return false;
        if (Helper.getExt(name) !== 'gpx') name+='.gpx';
        for (let i=0;i<this.state.currentRoutes.length;i++){
            if (this.state.currentRoutes[i].name === name) return true;
        }
        return false;
    }
    changeName(newName){
        let changed=newName !== this.props.route.name;
        let ns={name:newName,nameChanged:changed};
        if (changed) ns.forceChange=false;
        this.setState(ns);
    }
    save(copy){
        this.props.closeCallback();
        let oldName=this.props.route.name;
        let oldServer=this.state.route.server;
        if (this.state.nameChanged){
            this.state.route.name=this.state.name;
        }
        else{
            copy=false;
        }
        if (! copy){
            this.getCurrentEditor().setNewRoute(this.state.route);
            //the page must also know that we are now editing a different route
            editor.setNewRoute(this.state.route);
        }
        else{
            //if we had been editing the active this will change now
            //but there is no chance that we start editing the active with copy
            //as the name cannot exist already
            //do a last check anyway
            let activeName=activeRoute.getRouteName();
            if (activeName && this.state.route.name === activeName){
                Toast("unable to copy to active route");
                return;
            }
            let newRoute=this.state.route.clone();
            if (newRoute.server && ! globalStore.getData(keys.properties.connectedMode)){
                newRoute.server=false;
            }
            editor.setNewRoute(newRoute);
        }
        if (! copy && this.state.nameChanged){
            RouteHandler.deleteRoute(oldName,
                ()=>{
                    this.done();
                },
                (error)=>{
                    this.done();
                    Toast(error);
                },
                !oldServer
                )
        }
    }
    done(){
        if(this.props.updateCallback){
            this.props.updateCallback();
        }
    }

    delete() {
        if (this.isActiveRoute()) return;
        OverlayDialog.confirm("Really delete route " + this.state.name)
            .then(() => {
                this.props.closeCallback();
                RouteHandler.deleteRoute(this.state.route.name,
                    () => {
                        if (this.getCurrentEditor().getRouteName() === this.state.route.name) {
                            this.getCurrentEditor().removeRoute();
                        }
                        this.done();
                    },
                    (error) => {
                        Toast(error)
                    },
                    !this.state.route.server)

            })
            .catch(() => {
            })
    }
    loadNewRoute(){
        let finalList=[];
        this.state.currentRoutes.forEach((route)=>{
            let name=route.name.replace(/\.gpx/,'');
            //mark the route we had been editing on the page before
            let selected=getCurrentEditor().getRouteName() === name;
            finalList.push({label:name,value:name,key:name,originalName:route.name,selected:selected});
        });

        let d =OverlayDialog.createSelectDialog("load route", finalList, (entry)=>{
            if (entry.name === this.state.route.name) return;
            RouteHandler.fetchRoute(entry.originalName,false,
                (route)=>{
                    this.setState({
                        route:route.clone(),
                        changed:true,
                        name: route.name,
                        unchangedName: route.name,
                        nameChanged: false,
                        inverted: false
                    })
                },
                (error)=>{Toast(error)});
        });
        this.dialog.showDialog(d);
    }
    render() {
        let existingName=this.existsRoute(this.state.name) && this.state.nameChanged;
        let canDelete=! this.isActiveRoute() && ! this.state.nameChanged && this.state.name !== DEFAULT_ROUTE;
        let info=RouteHandler.getInfoFromRoute(this.state.route);
        return <div className="EditRouteDialog flexInnner">
            <h3 className="dialogTitle">Edit Route</h3>
            <Input
                dialogRow={true}
                label="name"
                value={this.state.name}
                onChange={this.changeName}
            >
            </Input>
            {existingName && <div className="warning">Name already exists</div>}
            
            {INFO_ROWS.map((description)=>{
                return InfoItem.show(info,description);
            })}
            {this.state.inverted && <InfoItem
                label=""
                value="inverted"
            />}
            <div className="dialogButtons">
                <DB name="empty"
                    onClick={() => {
                        let route=this.state.route.clone();
                        route.points=[];
                        this.setState({
                            changed:true,
                            route: route
                        })
                    }}
                >Empty</DB>
                <DB name="invert"
                    onClick={() => {
                        let route=this.state.route.clone();
                        route.swap();
                        let newInverted=!this.state.inverted;
                        this.setState({
                            changed:true,
                            route: route,
                            inverted: newInverted
                        })
                    }}
                >Invert</DB>
                {this.props.editAction &&
                <DB name="edit"
                    onClick={()=>{
                        this.props.closeCallback();
                        this.props.editAction();
                    }}
                    >
                    Edit
                </DB>}
            </div>
            <div className="dialogButtons">
                < DB name="load"
                     onClick={this.loadNewRoute}
                     >Load</DB>
                { canDelete && <DB name="delete"
                    onClick={() => {this.delete(); }}
                >Delete</DB>}
                <DB name="copy"
                    onClick={() => this.save(true)}
                    disabled={(!this.state.nameChanged || existingName)}
                >
                    Save As
                </DB>
                <DB name="cancel"
                    onClick={this.props.closeCallback}
                >Cancel</DB>
                {this.state.nameChanged ?
                    <DB name="ok"
                        onClick={() => this.save()}
                        disabled={existingName}
                    >
                        Rename
                    </DB> :
                    <DB name="ok"
                        onClick={() => this.save()}
                        disabled={!this.state.changed || existingName}
                    >
                        OK
                    </DB>
                }
            </div>
        </div>
    }
}



const getPanelList=(panel)=>{
    return LayoutHandler.getPanelData(PAGENAME,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.SMALL]));
};




const DEFAULT_ROUTE="default";

class EditRoutePage extends React.Component{
    constructor(props){
        super(props);
        this.hasCentered=false;
        this.state={
            showWpButtons:false,
            lastCenteredWp: undefined
        }
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
        this.checkEmptyRoute();
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
    checkRouteWritable(opt_noDialog){
        let currentEditor=getCurrentEditor();
        if (currentEditor.isRouteWritable()) return true;
        if (opt_noDialog) return false;
        let ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name");
        ok.then(()=>{
            currentEditor.syncTo(RouteEdit.MODES.PAGE);
            this.props.history.push('routepage');
        });
        return false;
    }
    checkEmptyRoute(){
        if (!editor.hasRoute()){
            RouteHandler.fetchRoute(DEFAULT_ROUTE,true,(route)=>{
                    editor.setRouteAndIndex(route,0);
                },
                (error)=>{
                    let rt=new routeobjects.Route(DEFAULT_ROUTE);
                    editor.setRouteAndIndex(rt,0);
                });

        }
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
        if (item.name === "EditRoute"){
            if (globalStore.getData(keys.gui.global.layoutEditing)) return;
            OverlayDialog.dialog((props)=>{
                return <EditRouteDialog
                    {...props}
                    route={currentEditor.getRoute().clone()}
                    editAction={()=>{
                        currentEditor.syncTo(RouteEdit.MODES.PAGE);
                        this.props.history.push("routepage");
                    }}
                    updateCallback={()=>{this.checkEmptyRoute()}}
                    />
            })
            return;
        }
        if (item.name === 'RoutePoints'){
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
        if (EditWidgetDialog.createDialog(item,PAGENAME,panel,{beginning:invertEditDirection,types:["!map"]})) return;
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
        let waypointButtons=[
            {
                name:'WpLocate',
                onClick:()=>{
                    this.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    MapHolder.setCenter(currentEditor.getPointAt());
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                }
            },
            {
                name:'WpEdit',
                onClick:()=>{
                    this.wpTimer.startTimer();
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
                    this.wpTimer.startTimer();
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
                    this.wpTimer.startTimer();
                    let currentEditor=getCurrentEditor();
                    currentEditor.moveIndex(-1);
                    MapHolder.setCenter(currentEditor.getPointAt());
                    this.setState({lastCenteredWp:currentEditor.getIndex()});
                }
            }
        ];
        return waypointButtons;
    };
    insertOtherRoute(name,otherStart,opt_before){
        let editor=getCurrentEditor();
        let idx=editor.getIndex();
        let current=editor.getPointAt(idx);
        if (!otherStart) return;
        const runInsert=()=>{
            RouteHandler.fetchRoute(name,false,(route)=>{
                    if (! route.points) return;
                    let insertPoints=[];
                    let usePoints=false;
                    for (let i=0;i<route.points.length;i++){
                        if (route.points[i].compare(otherStart)) usePoints=true;
                        if (usePoints) insertPoints.push(route.points[i]);
                    }
                    editor.addMultipleWaypoints(insertPoints,opt_before);
                },
                (error)=>{Toast(error)}
            );
        }
        if (! current) return runInsert();
        let otherIndex=idx+(opt_before?-1:1);
        let other=editor.getPointAt(otherIndex);
        let text,replace;
        if (other !== undefined && otherIndex >= 0){
            //ask the user if we should really insert between 2 points
            text="Really insert route ${route} starting at ${start} between ${from} and ${to}?";
            replace={route:name,start:otherStart.name};
            if (opt_before){
                replace.from=other.name;
                replace.to=current.name;
            }
            else{
                replace.from=current.name;
                replace.to=other.name;
            }
        }
        else{
            text=opt_before?
                "Really insert route ${route} starting at ${start} before ${current}?":
                "Really append route ${route} starting at ${start} after ${current}?";
            replace={route:name,current:current.name,start:otherStart.name};
        }
        OverlayDialog.confirm(Helper.templateReplace(text,replace))
            .then(()=>runInsert())
            .catch(()=>{});
    }
    mapEvent(evdata){
        console.log("mapevent: "+evdata.type);
        let currentEditor = getCurrentEditor();
        if (evdata.type === MapHolder.EventTypes.LOAD || evdata.type === MapHolder.EventTypes.RELOAD){
            if (this.hasCentered) return true;
            if (this.props.options && this.props.options.center){
                if (editor.hasRoute()){
                    let wp=editor.getPointAt();
                    if (wp){
                        this.state.lastCenteredWp=wp;
                        mapholder.setCenter(wp);
                    }
                }
            }
            this.hasCentered=true;
        }
        if (evdata.type === MapHolder.EventTypes.SELECTWP) {
            currentEditor.setNewIndex(currentEditor.getIndexFromPoint(evdata.wp));
            return true;
        }
        if (evdata.type === MapHolder.EventTypes.FEATURE){
            let feature=evdata.feature;
            if (! feature) return;
            if (feature.nextTarget && this.checkRouteWritable(true)){
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
                if (routeName && routeName.replace(/\.gpx$/,'') !== currentEditor.getRouteName() &&
                    this.checkRouteWritable(true)
                ){
                    feature.additionalActions = [
                        {
                            name: 'insert', label: 'Before', onClick: (props) => {
                                this.insertOtherRoute(feature.overlayName, props.routeTarget, true);
                            },
                            condition: (props) => props.routeTarget
                        }
                    ];
                    if (currentEditor.getIndex() >= 0 && currentEditor.getPointAt()) {
                        feature.additionalActions.push(
                            {
                                name: 'add', label: 'Ater', onClick: (props) => {
                                    this.insertOtherRoute(feature.overlayName, props.routeTarget, false);
                                },
                                condition: (props) => props.routeTarget
                            });
                    }
                }
            }
            FeatureInfoDialog.showDialog(this.props.history,feature);
            return true;
        }

    }
    componentWillUnmount(){
        MapHolder.setRoutingActive(false);
        MapHolder.setGpsLock(this.lastGpsLock,true);
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
                    if (!this.checkRouteWritable()) return;
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
                    if (! this.checkRouteWritable()) return;
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
                    if (! this.checkRouteWritable()) return;
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
                    if (! this.checkRouteWritable()) return;
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
                    if (! this.checkRouteWritable()) return;
                    stopAnchorWithConfirm(true)
                        .then(()=>{
                            RouteHandler.wpOn(getCurrentEditor().getPointAt());
                            this.props.history.pop();
                        })
                        .catch(()=>{});
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
            Mob.mobDefinition(this.props.history),
            EditPageDialog.getButtonDef(PAGENAME,
                MapPage.PANELS,[LayoutHandler.OPTIONS.SMALL]),
            LayoutFinishedDialog.getButtonDef(),
            LayoutHandler.revertButtonDef((pageWithOptions)=>{
                if (pageWithOptions.location !== this.props.location){
                    this.props.history.replace(pageWithOptions.location,pageWithOptions.options);
                }
            }),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        return rt;
    }
    render(){
        let isSmall=(this.state.dimensions||{width:0}).width
            < globalStore.getData(keys.properties.smallBreak);
        let overlayContent=(isSmall || this.state.showWpButtons)?
            <ButtonList
                itemList={this.getWaypointButtons()}
                className="overlayContainer"
            />
            :
            null;
        let pageProperties=Helper.filteredAssign(MapPage.propertyTypes,this.props);
        return (
            <MapPage
                {...pageProperties}
                id={PAGENAME}
                mapEventCallback={this.mapEvent}
                onItemClick={this.widgetClick}
                panelCreator={getPanelList}
                buttonList={this.getButtons()}
                overlayContent={overlayContent}
                />
        );
    }
}
EditRoutePage.propTypes={
    ...Page.pageProperties
}

export default EditRoutePage;