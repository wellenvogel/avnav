/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import MapPage,{overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import OverlayDialog, {
    DBCancel,
    DialogButtons, DialogDisplay,
    DialogFrame, DialogRow,
    DialogText, showDialog, useDialogContext
} from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import {
    useKeyEventHandlerPlain,
    useStoreHelper,
    useTimer
} from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import ButtonList from '../components/ButtonList.jsx';
import WayPointDialog, {updateWaypoint} from '../components/WaypointDialog.jsx';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import LayoutHandler from '../util/layouthandler.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import anchorWatch, {AnchorWatchKeys, isWatchActive} from '../components/AnchorWatchDialog.jsx';
import Mob from '../components/Mob.js';
import Dimmer from '../util/dimhandler.js';
import FeatureInfoDialog from "../components/FeatureInfoDialog";
import {TrackConvertDialog} from "../components/TrackConvertDialog";
import FullScreen from '../components/Fullscreen';
import DialogButton from "../components/DialogButton";
import RemoteChannelDialog from "../components/RemoteChannelDialog";
import assign from 'object-assign';
import WidgetFactory from "../components/WidgetFactory";
import ItemList from "../components/ItemList";
import mapholder from "../map/mapholder.js";
import {PageFrame, PageLeft} from "../components/Page";
import Requests from "../util/requests";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
import MapEventGuard from "../hoc/MapEventGuard";
import {useStoreState} from "../hoc/Dynamic";

const RouteHandler=NavHandler.getRoutingHandler();

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const PAGENAME='navpage';




const getPanelList=(panel)=>{
    return LayoutHandler.getPanelData(PAGENAME,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.SMALL,LayoutHandler.OPTIONS.ANCHOR]));
};
const getPanelWidgets=(panel)=>{
    let panelData=getPanelList(panel);
    if (panelData && panelData.list) {
        let layoutSequence=globalStore.getData(keys.gui.global.layoutSequence);
        let idx=0;
        panelData.list.forEach((item)=>{
            item.key=layoutSequence+"_"+idx;
            idx++;
        })
        return panelData;
    }
    return {name:panel};
}
/**
 *
 * @param item
 * @param idx if undefined - just update the let "to" point
 */
const startWaypointDialog=(item,idx,dialogCtx)=>{
    if (! item) return;
    const wpChanged=(newWp)=>{
        let changedWp=updateWaypoint(item,newWp,(err)=>{
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
    showDialog(dialogCtx,(props)=><WayPointDialog
            {...props}
            waypoint={item}
            okCallback={wpChanged}/>
    );
};

const setBoatOffset=()=>{
    if (! globalStore.getData(keys.nav.gps.valid)) return;
    let pos=globalStore.getData(keys.nav.gps.position);
    if (! pos) return;
    let ok=MapHolder.setBoatOffset(pos);
    return ok;
}
const showLockDialog=(dialogContext)=>{
    const LockDialog=(props)=>{
        return <div className={'LockDialog inner'}>
            <h3 className="dialogTitle">{'Lock Boat'}</h3>
            <div className={'dialogButtons'}>
                <DialogButton
                    name={'current'}
                    onClick={()=>{
                        props.closeCallback();
                        if (!setBoatOffset()) return;
                        MapHolder.setGpsLock(true);
                    }}
                >
                    Current</DialogButton>
                <DialogButton
                    name={'center'}
                    onClick={()=>{
                        props.closeCallback();
                        MapHolder.setBoatOffset();
                        MapHolder.setGpsLock(true);
                    }}
                >
                    Center
                </DialogButton>
                <DialogButton
                    name={'cancel'}
                    onClick={()=>props.closeCallback()}
                >
                    Cancel
                </DialogButton>
            </div>
        </div>
    }
    showDialog(dialogContext,LockDialog);
}

const setCenterToTarget=()=>{
    MapHolder.setGpsLock(false);
    if (activeRoute.anchorWatch() !== undefined){
        MapHolder.setCenter(activeRoute.getCurrentFrom());
    }
    else {
        MapHolder.setCenter(activeRoute.hasRoute() ? activeRoute.getPointAt() : activeRoute.getCurrentTarget());
    }
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
const OVERLAYPANEL="overlay";
const getCurrentMapWidgets=(sequence) =>{
    let current = getPanelWidgets(OVERLAYPANEL);
    let idx = 0;
    let rt = [];
    if (! current.list) return rt;
    current.list.forEach((item) => {
        rt.push(assign({index: idx}, item));
        idx++;
    })
    return rt;
}
const MapWidgetsDialog =()=> {
    const dialogContext=useDialogContext();
    const [layoutSequence]=useStoreState(keys.gui.global.layoutSequence);
    const onItemClick = useCallback((item)=>{
        dialogContext.showDialog(()=><EditWidgetDialogWithFunc
            widgetItem={item}
            panelname={OVERLAYPANEL}
            pageWithOptions={PAGENAME}
            opt_options={{fixPanel:true,types:['map']}}
        />)
    },[]);
    const items=getCurrentMapWidgets(layoutSequence);
    return <DialogFrame className={'MapWidgetsDialog'} title={"Map Widgets"}>
            {items && items.map((item)=>{
                let theItem=item;
                return <DialogRow
                    className={'lisEntry'}
                    onClick={()=>onItemClick(theItem)}
                    >
                    {item.name}
                </DialogRow>
            })}
        <DialogButtons buttonList={[
            {
                name:'add',
                onClick:()=>{
                    dialogContext.showDialog(()=><EditWidgetDialogWithFunc
                        widgetItem={undefined}
                        pageWithOptions={PAGENAME}
                        panelname={OVERLAYPANEL}
                        opt_options={{fixPanel:true,types:['map']}}
                    />)
                    },
                close: false
            },
            {
                name:'cancel',
                label:'Close'
            }
        ]}/>
    </DialogFrame>
}

const GuardedAisDialog=MapEventGuard(AisInfoWithFunctions);
const OverlayContent=({showWpButtons,setShowWpButtons,dialogCtxRef})=>{
    const waypointButtons=[
        anchorWatch(false,dialogCtxRef),
        {
            name:'WpLocate',
            onClick:()=>{
                setCenterToTarget();
                setShowWpButtons(false);
            },
            storeKeys: activeRoute.getStoreKeys(),
            updateFunction:(state)=>{
                return { visible: StateHelper.hasActiveTarget(state) || StateHelper.anchorWatchDistance(state) !== undefined}
            }
        },
        {
            name:'WpEdit',
            onClick:()=>{
                if (activeRoute.hasRoute()){
                    startWaypointDialog(activeRoute.getPointAt(),activeRoute.getIndex(),dialogCtxRef);
                }
                else {
                    startWaypointDialog(activeRoute.getCurrentTarget(),undefined,dialogCtxRef);
                }
                setShowWpButtons(false);
            },
            storeKeys: activeRoute.getStoreKeys(),
            updateFunction:(state)=>{
                return {visible:StateHelper.hasActiveTarget(state) }
            },

        },
        {
            name:'WpGoto',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state)=> {
                return {visible: StateHelper.hasActiveTarget(state) &&  !StateHelper.selectedIsActiveTarget(state)}
            },
            onClick:()=>{
                let selected=activeRoute.getPointAt();
                setShowWpButtons(false);
                if (selected) RouteHandler.wpOn(selected);
            },


        },
        {
            name:'NavNext',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state)=> {
                return {visible:
                        StateHelper.hasActiveTarget(state) &&  StateHelper.selectedIsActiveTarget(state)
                        &&  StateHelper.hasPointAtOffset(state,1)
                };
            },
            onClick:()=>{
                setShowWpButtons(false);
                activeRoute.moveIndex(1);
                RouteHandler.wpOn(activeRoute.getPointAt());

            }
        },
        {
            name: 'NavRestart',
            storeKeys: activeRoute.getStoreKeys(),
            updateFunction: (state)=> {
                return {
                    visible:  StateHelper.hasActiveTarget(state) &&  StateHelper.selectedIsActiveTarget(state)
                };
            },
            onClick:()=>{
                setShowWpButtons(false);
                RouteHandler.legRestart();
            }
        },
        {
            name:'WpNext',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state)=> {
                return {
                    disabled:!StateHelper.hasPointAtOffset(state,1),
                    visible: StateHelper.hasRoute(state) && ! StateHelper.anchorWatchDistance(state)
                };
            },
            onClick:()=>{
                setShowWpButtons(true);
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
                    visible: StateHelper.hasRoute(state) && ! StateHelper.anchorWatchDistance(state)
                }
            },
            onClick:()=>{
                setShowWpButtons(true);
                activeRoute.moveIndex(-1);
                let next=activeRoute.getPointAt();
                MapHolder.setCenter(next);
            }
        }
    ];

    return <React.Fragment>
        {showWpButtons?<ButtonList
            itemList={waypointButtons}
            className="overlayContainer"
        />:null}
        <ItemList
            className={'mapWidgetContainer widgetContainer'}
            itemCreator={(widget)=>{
                let widgetConfig=WidgetFactory.findWidget(widget) || {};
                let key=widget.key;
                return WidgetFactory.createWidget(widget,
                    {
                        handleVisible:!globalStore.getData(keys.gui.global.layoutEditing),
                        registerMap: (callback)=>MapHolder.registerMapWidget(
                            PAGENAME,
                            {
                                name: key,
                                storeKeys: widgetConfig.storeKeys
                            },callback),
                        triggerRender: ()=>MapHolder.triggerRender()
                    }
                )
            }}
            itemList={getPanelWidgets(OVERLAYPANEL).list || []}
        />
    </React.Fragment>
}
const needsChartLoad=()=>{
    if (mapholder.getCurrentChartEntry()) return;
    return mapholder.getLastChartKey()
}
const NavPage=(props)=>{
    const dialogCtx=useRef();
    const [wpButtonsVisible,setWpButtonsVisible]=useState(false);
    useStoreHelper(()=>MapHolder.triggerRender(),keys.gui.global.layoutSequence);
    const [sequence,setSequence]=useState(0);
    const checkChartCount=useRef(30);
    const loadTimer = useTimer((seq) => {
        if (!needsChartLoad()) return;
        checkChartCount.current--;
        if (checkChartCount.current < 0) {
            props.history.pop();
        }
        Requests.getJson("?request=list&type=chart", {timeout: 3 * parseFloat(globalStore.getData(keys.properties.networkTimeout))}).then((json) => {
            (json.items || []).forEach((chartEntry) => {
                if (!chartEntry.key) chartEntry.key = chartEntry.chartKey || chartEntry.url;
                if (chartEntry.key === neededChart) {
                    mapholder.setChartEntry(chartEntry);
                    setSequence(sequence + 1);
                    return;
                }
                loadTimer.startTimer(seq);
            })
        })
            .catch(() => {
                loadTimer.startTimer(seq)
            });
    }, 1000);
    useEffect(() => {
        globalStore.storeData(keys.map.measurePosition,undefined);
        activeRoute.setIndexToTarget();
        if (globalStore.getData(keys.properties.mapLockMode) === 'center'){
            MapHolder.setBoatOffset();
        }
        const neededChart = needsChartLoad();
        if (neededChart) {
            loadTimer.startTimer();
        }
        MapHolder.showEditingRoute(false);
        return ()=>{
            globalStore.storeData(keys.map.measurePosition,undefined);
        }
    }, []);
    const wpTimer=useTimer(()=>{
            setWpButtonsVisible(false);
        },globalStore.getData(keys.properties.wpButtonTimeout)*1000);
    useKeyEventHandlerPlain('page',"centerToTarget", setCenterToTarget);
    useKeyEventHandlerPlain('page',"navNext",navNext);
    useKeyEventHandlerPlain('page',"toggleNav",()=>navToWp(!activeRoute.hasActiveTarget()));
    const showAisInfo=useCallback((mmsi)=>{
        if (! mmsi) return;
        showDialog(dialogCtx,()=>{
            return <GuardedAisDialog
                mmsi={mmsi}
                actionCb={(action,m)=>{
                    if (action === 'AisInfoList'){
                        props.history.push('aispage', {mmsi: m});
                    }
                }}
            />;
        })
    },[]);
    const showWpButtons=useCallback((on)=>{
        if (on) {
            wpTimer.startTimer();
        }
        else {
            wpTimer.stopTimer();
        }
        if (wpButtonsVisible === on) return;
        setWpButtonsVisible(on);
    },[]);
    const widgetClick=useCallback((item,data,panel,invertEditDirection)=>{
        let pagePanels=LayoutHandler.getPagePanels(PAGENAME);
        let idx=pagePanels.indexOf(OVERLAYPANEL);
        if (idx >=0){
            pagePanels.splice(idx,1);
        }
        if (LayoutHandler.isEditing()) {
            showDialog(dialogCtx, () => <EditWidgetDialogWithFunc
                widgetItem={item}
                pageWithOptions={PAGENAME}
                panelname={panel}
                opt_options={{fixPanel: pagePanels, beginning: invertEditDirection, types: ["!map"]}}
            />)
            return;
        }
        if (item.name == "AisTarget"){
            let mmsi=(data && data.mmsi)?data.mmsi:item.mmsi;
            showAisInfo(mmsi);
            return;
        }
        if (item.name == "ActiveRoute"){
            if (!activeRoute.hasRoute()) return;
            activeRoute.setIndexToTarget();
            activeRoute.syncTo(RouteEdit.MODES.EDIT);
            props.history.push("editroutepage");
            return;
        }
        if (item.name == "Zoom"){
            MapHolder.checkAutoZoom(true);
            return;
        }
        if (panel && panel.match(/^bottomLeft/)){
            activeRoute.setIndexToTarget();
            showWpButtons(true);
            return;
        }
        props.history.push("gpspage",{widget:item.name});

    },[]);

    const mapEvent=useCallback((evdata)=>{
        console.log("mapevent: "+evdata.type);
        if (evdata.type === MapHolder.EventTypes.SELECTAIS){
            let aisparam=evdata.aisparam;
            if (!aisparam) return;
            if (aisparam.mmsi){
                showAisInfo(aisparam.mmsi);
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
                                RouteHandler.wpOn(target);
                            }
                        }
                    );
                }
                showDialog(dialogCtx,()=><FeatureInfoDialog history={props.history} {...feature}/>)
            }
            if (feature.overlayType === 'route' && ! feature.activeRoute){
                let currentRouteName=activeRoute.getRouteName();
                if (Helper.getExt(currentRouteName) !== 'gpx') currentRouteName+='.gpx';
                if (activeRoute.hasActiveTarget() && currentRouteName === feature.overlayName){
                    //do not show a feature pop up if we have an overlay that exactly has the current route
                    return false;
                }
            }
            if (feature.overlayType === 'track'){
                feature.additionalActions.push({
                   name:'toroute',
                   label: 'Convert',
                   onClick:(cprops)=>{
                       showDialog(dialogCtx,()=><TrackConvertDialog history={props.history} name={cprops.overlayName}/>)
                   }
                });
            }
            if (feature.overlayType !== 'route' || ! feature.nextTarget){
                showFeature()
            } else {
                let currentTarget=activeRoute.getCurrentTarget();
                //show a "routeTo" if this is not the current target
                if (! feature.activeRoute || ! currentTarget ||
                    ! currentTarget.compare(feature.nextTarget)
                ) {
                    feature.additionalActions.push({
                        name: 'routeTo',
                        label: 'Route',
                        onClick: (props) => {
                            RouteHandler.wpOn(props.nextTarget);
                        },
                        condition: (props) => props.nextTarget
                    });
                }
                feature.additionalActions.push({
                    name:'editRoute',
                    label:'Edit',
                    onClick:()=>{
                        let nextTarget= feature.nextTarget;
                        if (! nextTarget) return;
                        RouteHandler.fetchRoute(feature.overlayName,false,
                            (route)=>{
                                let idx=route.findBestMatchingIdx(nextTarget);
                                let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                                editor.setNewRoute(route,idx >= 0?idx:undefined);
                                props.history.push("editroutepage");
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
    },[]);
    const buttons=[
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
                    if (! old){
                        let lockMode=globalStore.getData(keys.properties.mapLockMode,'center');
                        if ( lockMode === 'ask'){
                            showLockDialog(dialogCtx);
                            return;
                        }
                        if (lockMode === 'current'){
                            if (! setBoatOffset()) return;
                        }
                        else{
                            MapHolder.setBoatOffset();
                        }
                    }
                    MapHolder.setGpsLock(!old);
                },
                editDisable:true
            },
            {
                name: "LockMarker",
                storeKeys: activeRoute.getStoreKeys(AnchorWatchKeys),
                updateFunction:(state)=>{
                    return {visible:!StateHelper.hasActiveTarget(state) && ! isWatchActive(state)}
                },
                onClick:()=>{
                    navToWp(true);
                },
                editDisable: true
            },
            anchorWatch(true,dialogCtx),
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
                    props.history.push("editroutepage");
                },
                overflow: true

            },
            {
                name: "NavOverlays",
                onClick:()=>overlayDialog(dialogCtx),
                overflow: true,
                storeKeys:{
                    visible:keys.gui.capabilities.uploadOverlays
                }
            },
            {
                name:'GpsCenter',
                onClick:()=>{
                    MapHolder.centerToGps();

                },
                overflow: true,
                editDisable: true
            },
            {
                name: 'Night',
                storeKeys: {
                    toggle: keys.properties.nightMode,
                    visible: keys.properties.nightModeNavPage
                },
                onClick: ()=> {
                    let mode = globalStore.getData(keys.properties.nightMode, false);
                    mode = !mode;
                    globalStore.storeData(keys.properties.nightMode, mode);
                },
                overflow: true
            },
            {
                name: 'Measure',
                storeKeys: {
                    toggle: keys.map.measurePosition,
                    visible: keys.properties.showMeasure
                },
                overflow: true,
                onClick: ()=>{
                    let current=globalStore.getData(keys.map.measurePosition);
                    if (current){
                        globalStore.storeData(keys.map.measurePosition,undefined);
                        MapHolder.triggerRender();
                        return;
                    }
                    if (MapHolder.getGpsLock()) return;
                    let center = globalStore.getData(keys.map.centerPosition);
                    globalStore.storeData(keys.map.measurePosition,center);
                    MapHolder.triggerRender();
                }
            },
            Mob.mobDefinition(props.history),
            EditPageDialog.getButtonDef(PAGENAME,
                MapPage.PANELS,
                [LayoutHandler.OPTIONS.SMALL,LayoutHandler.OPTIONS.ANCHOR]),
            {
                name: 'NavMapWidgets',
                editOnly: true,
                overflow: true,
                onClick: ()=>showDialog(dialogCtx,(props)=><MapWidgetsDialog {...props}/>)
            },
            LayoutFinishedDialog.getButtonDef(undefined,dialogCtx.current),
            LayoutHandler.revertButtonDef((pageWithOptions)=>{
                if (pageWithOptions.location !== props.location){
                    props.history.replace(pageWithOptions.location,pageWithOptions.options);
                }
            }),
            RemoteChannelDialog({overflow:true},dialogCtx),
            FullScreen.fullScreenDefinition,
            Dimmer.buttonDef(),
            {
                name: 'Cancel',
                onClick: ()=>{props.history.pop()}
            }
        ];
        let autohide=undefined;
        if (globalStore.getData(keys.properties.autoHideNavPage) && ! wpButtonsVisible && ! globalStore.getData(keys.gui.global.layoutEditing)){
            autohide=globalStore.getData(keys.properties.hideButtonTime,30)*1000;
        }
        let pageProperties=Helper.filteredAssign(MapPage.propertyTypes,props);
        let neededChart=needsChartLoad();
        if (neededChart){
            return (
                <PageFrame
                    {...pageProperties}
                    id={PAGENAME}>
                    <PageLeft dialogCtxRef={dialogCtx}>
                        <DialogDisplay
                            closeCallback={() => props.history.pop()}>
                            <DialogFrame title={"Waiting for chart"}>
                                <DialogText>{neededChart}</DialogText>
                                <DialogButtons buttonList={DBCancel()}/>
                            </DialogFrame>
                        </DialogDisplay>
                    </PageLeft>
                    <ButtonList itemList={buttons}/>
                </PageFrame>
            );
        }
        return (
            <MapPage
                {...pageProperties}
                id={PAGENAME}
                mapEventCallback={mapEvent}
                onItemClick={widgetClick}
                panelCreator={getPanelList}
                overlayContent={ ()=>
                    <OverlayContent
                        showWpButtons={wpButtonsVisible}
                        setShowWpButtons={(on)=>{
                            showWpButtons(on);
                        }}
                        dialogCtxRef={dialogCtx}
                    />}
                buttonList={buttons}
                preventCenterDialog={(props.options||{}).remote}
                autoHideButtons={autohide}
                dialogCtxRef={dialogCtx}
                />
        );
}

export default NavPage;