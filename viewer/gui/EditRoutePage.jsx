/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useState} from 'react';
import MapPage, {overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import OverlayDialog, {
    DialogButtons,
    DialogFrame,
    dialogHelper,
    InfoItem, SelectDialog,
    showDialog,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
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
import {Input} from "../components/Inputs";
import DB from '../components/DialogButton';
import Formatter from "../util/formatter";
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";
import Page from "../components/Page";
import Dialogs from "../components/OverlayDialog.jsx";

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

const startWaypointDialog=(item,index,dialogContext)=>{
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
    showDialog(dialogContext,RenderDialog);
};

export const INFO_ROWS=[
    {label:'points',value:'numpoints'},
    {label:'length',value:'length',formatter:(v)=>{
            return Formatter.formatDistance(v)+" nm";
        }},
];

const loadRoutes=()=>{
    return RouteHandler.listRoutes(true)
        .then((routes)=>{
            routes.sort((a,b)=>{
                let na=a.name?a.name.toLowerCase():undefined;
                let nb=b.name?b.name.toLowerCase():undefined;
                if (na < nb) return -1;
                if (na > nb) return 1;
                return 0;
            })
            return routes;
        })
        .catch((error)=>{Toast(error)});
}

const EditRouteDialog = (props) => {
    if (!props.route) return null;
    const dialogContext=useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [inverted, setInverted] = useState(false);
    const [availableRoutes, setAvailableRoutes] = useState();
    useEffect(() => {
        loadRoutes()
            .then((routes) => {
                setAvailableRoutes(routes)
            });
    }, []);
    const isActiveRoute = useCallback(() => {
        let activeName = activeRoute.getRouteName();
        return (activeName !== undefined && props.route.name === activeName);
    }, []);
    const getCurrentEditor = useCallback(() => {
        return isActiveRoute() ? activeRoute : editor;
    }, []);
    const existsRoute=(name)=>{
        if (! availableRoutes) return false;
        if (Helper.getExt(name) !== 'gpx') name+='.gpx';
        for (let i=0;i<availableRoutes.length;i++){
            if (availableRoutes[i].name === name) return true;
        }
        return false;
    }
    const done=useCallback(()=>{
        if(props.updateCallback){
            props.updateCallback();
        }
    },[]);
    const changeRoute=(cb)=> {
        let newRoute=route.clone();
        if (cb(newRoute) !== false) setRoute(newRoute);
    }
    const save=(copy)=>{
        let oldName=props.route.name;
        let oldServer=props.route.server;
        let cloned=route.clone();
        if (route.name === oldName){
            copy=false;
        }
        if (! copy){
            getCurrentEditor().setNewRoute(cloned);
            //the page must also know that we are now editing a different route
            editor.setNewRoute(cloned);
        }
        else{
            //if we had been editing the active this will change now
            //but there is no chance that we start editing the active with copy
            //as the name cannot exist already
            //do a last check anyway
            let activeName=activeRoute.getRouteName();
            if (activeName && cloned.name === activeName){
                Toast("unable to copy to active route");
                return;
            }
            if (cloned.server && ! globalStore.getData(keys.properties.connectedMode)){
                cloned.server=false;
            }
            editor.setNewRoute(cloned);
        }
        if (! copy && route.name !== props.route.name){
            RouteHandler.deleteRoute(oldName,
                ()=>{
                    done();
                },
                (error)=>{
                    done();
                    Toast(error);
                },
                !oldServer
                )
            return;
        }
        done();
    }
    const deleteRoute=()=> {
        if (isActiveRoute()) return;
        showPromiseDialog(dialogContext,Dialogs.createConfirmDialog("Really delete route "+props.route.name))
            .then(() => {
                RouteHandler.deleteRoute(props.route.name,
                    () => {
                        if (getCurrentEditor().getRouteName() === props.route.name) {
                            getCurrentEditor().removeRoute();
                        }
                        done();
                        dialogContext.closeDialog();
                    },
                    (error) => {
                        Toast(error)
                    },
                    !props.route.server)

            })
            .catch(() => {
            })
    }
    const restartDialog=(newRoute)=>{
        if (! newRoute) newRoute=route;
        dialogContext.replaceDialog(()=><EditRouteDialog
            {...props}
            route={newRoute.clone()}
            />);
    }
    const loadNewRoute=()=>{
        let finalList=[];
        availableRoutes.forEach((aroute)=>{
            let name=aroute.name.replace(/\.gpx/,'');
            //mark the route we had been editing on the page before
            let selected=getCurrentEditor().getRouteName() === name;
            //check with and without gpx extension
            if (aroute.name === route.name || name === route.name) return;
            finalList.push({label:name,value:name,key:name,originalName:aroute.name,selected:selected});
        });
        showDialog(dialogContext,()=><SelectDialog
            title={"load route"}
            list={finalList}
            resolveFunction={(entry)=>{
                if (entry.name === props.route.name) return;
                RouteHandler.fetchRoute(entry.originalName,false,
                    (route)=>{
                        if (! route){
                            Toast("unable to load route "+entry.originalName);
                            return;
                        }
                        restartDialog(route);
                    },
                    (err)=>Toast(err)
                )
            }}
        />);
    }
    let nameChanged=route.name !== props.route.name;
    let existingName=existsRoute(route.name) && nameChanged;
    let canDelete=! isActiveRoute() && ! nameChanged && props.route.name !== DEFAULT_ROUTE;
    let info=RouteHandler.getInfoFromRoute(route);
    return <DialogFrame className="EditRouteDialog" title={"Edit Route"}>
            <Input
                dialogRow={true}
                label="name"
                value={route.name}
                onChange={(newName)=>changeRoute((nr)=>{nr.name=newName})}
            >
            </Input>
            {existingName && <div className="warning">Name already exists</div>}
            
            {INFO_ROWS.map((description)=>{
                return InfoItem.show(info,description);
            })}
            {inverted && <InfoItem
                label=""
                value="inverted"
            />}
            <DialogButtons>
                <DB name="empty"
                    onClick={() => changeRoute((nr)=>{nr.points=[]})}
                    close={false}
                >Empty</DB>
                <DB name="invert"
                    onClick={() => {
                        changeRoute((nr)=>{nr.swap()})
                        setInverted(!inverted);
                    }}
                    close={false}
                >Invert</DB>
                {props.editAction &&
                <DB name="edit"
                    onClick={()=>{
                        save();
                        props.editAction();
                    }}
                    >
                    Edit
                </DB>}
            </DialogButtons>
            <DialogButtons>
                < DB name="load"
                     onClick={loadNewRoute}
                     close={false}
                     >Load</DB>
                { canDelete && <DB name="delete"
                                    onClick={() => {deleteRoute(); }}
                                   close={false}
                >Delete</DB>}
                <DB name="copy"
                    onClick={() => {
                        save(true);
                        restartDialog();
                    }}
                    close={false}
                    disabled={(!nameChanged || existingName)}
                >
                    Save As
                </DB>
                <DB name="cancel"
                >Cancel</DB>
                {nameChanged ?
                    <DB name="ok"
                        onClick={() => {
                            save();
                            restartDialog();
                        }}
                        disabled={existingName}
                        close={false}
                    >
                        Rename
                    </DB> :
                    <DB name="ok"
                        onClick={() => save()}
                        disabled={!route.differsTo(props.route) || existingName}
                    >
                        OK
                    </DB>
                }
            </DialogButtons>
    </DialogFrame>
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
            OverlayDialog.showDialog(undefined,()=><FeatureInfoDialog history={this.props.history} {...feature}/>)
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