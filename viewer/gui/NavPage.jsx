/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import MapPage,{overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import {
    DBCancel,
    DialogButtons, DialogFrame, DialogRow,
    DialogText, OverlayDialog, showDialog, showPromiseDialog, useDialogContext
} from '../components/OverlayDialog.jsx';
import Helper, {injectav} from '../util/helper.js';
import {
    useKeyEventHandlerPlain,
    useStoreHelper,
    useTimer
} from '../util/GuiHelpers.js';
import MapHolder, {EventTypes, LOCK_MODES} from '../map/mapholder.js';
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
import {CenterActionButton, GuardedFeatureListDialog, hideAction, linkAction} from "../components/FeatureInfoDialog";
import {TrackConvertDialog} from "../components/TrackConvertDialog";
import FullScreen from '../components/Fullscreen';
import DialogButton from "../components/DialogButton";
import RemoteChannelDialog from "../components/RemoteChannelDialog";
import assign from 'object-assign';
import WidgetFactory from "../components/WidgetFactory";
import ItemList from "../components/ItemList";
import Page, {PageFrame, PageLeft} from "../components/Page";
import Requests from "../util/requests";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
import MapEventGuard from "../hoc/MapEventGuard";
import {
    BoatFeatureInfo,
    FeatureAction,
    FeatureInfo, RouteFeatureInfo, WpFeatureInfo
} from "../map/featureInfo";
import {loadRoutes} from "../components/RouteInfoHelper";
import routeobjects, {Measure} from "../nav/routeobjects";
import {KeepFromMode} from "../nav/routedata";
import {ConfirmDialog} from "../components/BasicDialogs";
import navdata from "../nav/navdata.js";
import base from "../base";
import {checkName, ItemNameDialog, nameProposal} from "../components/ItemNameDialog";
import {ItemActions} from "../components/FileDialog";
import {showErrorList} from "../components/ErrorListDialog";

const RouteHandler=NavHandler.getRoutingHandler();

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);
const editorRoute = new RouteEdit(RouteEdit.MODES.EDIT);

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
const showLockDialog=(dialogContext)=>{
    const LockDialog=()=>{
        return <div className={'LockDialog inner'}>
            <h3 className="dialogTitle">{'Lock Boat'}</h3>
            <div className={'dialogButtons'}>
                <DialogButton
                    name={'current'}
                    onClick={()=>{
                        MapHolder.setGpsLock(LOCK_MODES.current);
                    }}
                >
                    Current</DialogButton>
                <DialogButton
                    name={'center'}
                    onClick={()=>{
                        MapHolder.setGpsLock(LOCK_MODES.center);
                    }}
                >
                    Center
                </DialogButton>
                <DialogButton
                    name={'cancel'}
                >
                    Cancel
                </DialogButton>
            </div>
        </div>
    }
    showDialog(dialogContext,LockDialog);
}

const setCenterToTarget=()=>{
    MapHolder.setGpsLock(LOCK_MODES.off);
    if (activeRoute.anchorWatch() !== undefined){
        MapHolder.setCenter(activeRoute.getCurrentFrom());
    }
    else {
        MapHolder.setCenter(activeRoute.hasRoute() ? activeRoute.getPointAt() : activeRoute.getCurrentTarget());
    }
};

const navNext=()=>{
    if (!activeRoute.hasRoute() ) return;
    RouteHandler.wpOn(activeRoute.getNextWaypoint(),KeepFromMode.OLDTO);
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
            wp.name = globalStore.getData(keys.properties.markerDefaultName);
        }
        wp.routeName=undefined;
        center.assign(wp);
        RouteHandler.wpOn(wp);
        return;
    }
    RouteHandler.routeOff();
    MapHolder.triggerRender();
};
const gotoFeature=(featureInfo,opt_noRoute)=>{
    let target = featureInfo.point;
    if (!target) return;
    if (opt_noRoute && target instanceof navobjects.WayPoint) {
        target=target.clone()
        delete target.routeName;
    }
    if (! target.name) target.name=globalStore.getData(keys.properties.markerDefaultName);
    RouteHandler.wpOn(target);
}
const OVERLAYPANEL="overlay";
const getCurrentMapWidgets=() =>{
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
    const onItemClick = useCallback((item)=>{
        dialogContext.showDialog(()=><EditWidgetDialogWithFunc
            widgetItem={item}
            panelname={OVERLAYPANEL}
            pageWithOptions={PAGENAME}
            opt_options={{fixPanel:true,types:['map']}}
        />)
    },[]);
    const items=getCurrentMapWidgets();
    return <DialogFrame className={'MapWidgetsDialog'} title={"Map Widgets"}>
            {items && items.map((item)=>{
                let theItem=item;
                return <DialogRow
                    className={'lisEntry'}
                    onClick={()=>onItemClick(theItem)}
                    key={theItem.name}
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
                navNext();

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
    if (MapHolder.getCurrentChartEntry()) return;
    return MapHolder.getLastChartKey()
}
const createRouteFeatureAction=(history,opt_fromMeasure)=>{
    return new FeatureAction({
        name:'ShowRoutePanel',
        label: opt_fromMeasure?'To Route':'New Route',
        onClick: (featureInfo,listCtx)=>{
            let measure;
            if (opt_fromMeasure){
                measure=globalStore.getData(keys.map.activeMeasure);
                if (!measure) return;
                if (measure.points.length < 1) return;
            }
            loadRoutes()
                .then( (routes)=> {
                    const checkRouteName=(name)=>{
                        return checkName(name,routes,(item)=>item.name);
                    }
                    showPromiseDialog(listCtx, (dprops) => <ItemNameDialog
                        {...dprops}
                        title={"Select Name for new Route"}
                        checkName={checkRouteName}
                        mandatory={true}
                        fixedExt={'gpx'}
                        iname={nameProposal('route')}
                    />)
                        .then((res) => {
                            listCtx.closeDialog();
                            const isConnected=globalStore.getData(keys.properties.connectedMode);
                            let newRoute = measure ? measure.clone() : new routeobjects.Route();
                            const action=ItemActions.create({type:'route'},isConnected);
                            newRoute.setName(action.nameForUpload(res.name));
                            newRoute.server = isConnected;
                            if (!measure) {
                                newRoute.addPoint(0, featureInfo.point);
                                editorRoute.setRouteAndIndex(newRoute, 0);
                            } else {
                                editorRoute.setRouteAndIndex(newRoute, newRoute.getIndexFromPoint(featureInfo.point))
                            }
                            history.push("editroutepage", {center: true});
                        }, () => {
                        })
                })
                .catch(()=>{})

        },
        close:false,
        condition: (featureInfo)=>{
            if (featureInfo.getType() === FeatureInfo.TYPE.waypoint) return false;
            if (featureInfo.getType() === FeatureInfo.TYPE.boat) return false;
            if (featureInfo.getType() === FeatureInfo.TYPE.anchor) return false;
            if (featureInfo.getType() === FeatureInfo.TYPE.route && ! featureInfo.isOverlay) return false;
            if (! featureInfo.validPoint()) return false;
            if (opt_fromMeasure && (featureInfo.getType() !== FeatureInfo.TYPE.measure)) return false;
            if (!opt_fromMeasure && (featureInfo.getType() === FeatureInfo.TYPE.measure)) return false;
            return true;
        }
    })
}
const NavPage=(props)=>{
    const dialogCtx=useRef();
    const [wpButtonsVisible,setWpButtonsVisible]=useState(false);
    useStoreHelper(()=>MapHolder.triggerRender(),keys.gui.global.layoutSequence);
    const [sequence,setSequence]=useState(0);
    const checkChartCount=useRef(30);
    const history=props.history;
    const loadTimer = useTimer((seq) => {
        if (!needsChartLoad()) return;
        checkChartCount.current--;
        if (checkChartCount.current < 0) {
            history.pop();
        }
        Requests.getJson("?request=list&type=chart", {timeout: 3 * parseFloat(globalStore.getData(keys.properties.networkTimeout))}).then((json) => {
            (json.items || []).forEach((chartEntry) => {
                if (!chartEntry.key) chartEntry.key = chartEntry.chartKey || chartEntry.url;
                if (chartEntry.key === neededChart) {
                    MapHolder.setChartEntry(chartEntry);
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
        globalStore.storeData(keys.map.activeMeasure,undefined);
        activeRoute.setIndexToTarget();
        /*if (globalStore.getData(keys.properties.mapLockMode) === 'center'){
            MapHolder.setBoatOffset();
        }*/
        const neededChart = needsChartLoad();
        if (neededChart) {
            loadTimer.startTimer();
        }
        MapHolder.showEditingRoute(false);
        return ()=>{
            globalStore.storeData(keys.map.activeMeasure,undefined);
        }
    }, []);
    const wpTimer=useTimer(()=>{
            setWpButtonsVisible(false);
        },globalStore.getData(keys.properties.wpButtonTimeout)*1000);
    useKeyEventHandlerPlain("centerToTarget",'page', setCenterToTarget);
    useKeyEventHandlerPlain("navNext",'page',navNext);
    useKeyEventHandlerPlain("toggleNav",'page',()=>navToWp(!activeRoute.hasActiveTarget()));
    useEffect(() => {
        if (! globalStore.getData(keys.properties.aisShowErrors)) return;
        if (LayoutHandler.isEditing()) return;
        showErrorList({
            dialogCtx:dialogCtx,
            title: 'AIS Errors',
            className: 'AisErrorDialog',
            fillFunction: ()=>NavHandler.getAisHandler().getErrors()
        });
    }, []);
    const showAisInfo=useCallback((mmsi)=>{
        if (! mmsi) return;
        showDialog(dialogCtx,()=>{
            return <GuardedAisDialog
                mmsi={mmsi}
                actionCb={(action,m)=>{
                    if (action === 'AisInfoList'){
                        history.push('aispage', {mmsi: m});
                    }
                }}
            />;
        })
    },[history]);
    const showWpButtons=useCallback((on)=>{
        if (on) {
            wpTimer.startTimer();
        }
        else {
            wpTimer.stopTimer();
        }
        if (wpButtonsVisible === on) return;
        setWpButtonsVisible(on);
    },[wpButtonsVisible]);
    const widgetClick=useCallback((ev)=>{
        const avev=injectav(ev);
        const item=avev.avnav.item||{};
        const panel=avev.avnav.panelName||"";
        let pagePanels=LayoutHandler.getPagePanels(PAGENAME);
        let idx=pagePanels.indexOf(OVERLAYPANEL);
        if (idx >=0){
            pagePanels.splice(idx,1);
        }
        if (LayoutHandler.isEditing()) {
            const invertEditDirection=avev.avnav.invertEditDirection;
            showDialog(dialogCtx, () => <EditWidgetDialogWithFunc
                widgetItem={item}
                pageWithOptions={PAGENAME}
                panelname={panel}
                opt_options={{fixPanel: pagePanels, beginning: invertEditDirection, types: ["!map"]}}
            />)
            return;
        }
        if (item.name == "AisTarget"){
            let mmsi=avev.avnav.mmsi;
            showAisInfo(mmsi);
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
        if (panel && panel.match(/^bottomLeft/)){
            activeRoute.setIndexToTarget();
            showWpButtons(true);
            return;
        }
        history.push("gpspage",{widget:item.name});

    },[history]);

    const mapEvent = useCallback((evdata) => {
        base.log("mapevent: " + evdata.type);
        if (evdata.type === EventTypes.FEATURE) {
            const featureList=evdata.feature;
            const additionalActions = [];
            additionalActions.push(new FeatureAction({
                name:'StopNav',
                label:'StopNav',
                onClick:()=>{
                    RouteHandler.wpOn();
                },
                condition:(featureInfo)=>featureInfo instanceof WpFeatureInfo
            }))
            additionalActions.push(new FeatureAction({
                name: 'goto',
                label: 'Goto',
                onClick: (featureInfo) => {
                    gotoFeature(featureInfo,true);
                },
                condition: (featureInfo) => {
                    return featureInfo.validPoint() &&
                        !(featureInfo instanceof WpFeatureInfo ) &&
                        ! (featureInfo instanceof BoatFeatureInfo)
                }
            }));
            additionalActions.push(new FeatureAction({
                name: 'start',
                label: 'Start',
                onClick: (featureInfo) => {
                    gotoFeature(featureInfo);
                },
                condition: (featureInfo) => {
                    return featureInfo.validPoint() &&
                        !(featureInfo instanceof WpFeatureInfo ) &&
                        ! (featureInfo instanceof BoatFeatureInfo) &&
                        (featureInfo instanceof RouteFeatureInfo)
                }
            }));
            additionalActions.push(new FeatureAction({
                name:'center',
                label:'Center',
                onClick:(featureInfo)=>{
                    if (MapHolder.getGpsLock()) return;
                    MapHolder.setCenter(featureInfo.point);
                    MapHolder.triggerRender();
                },
                condition: (featureInfo)=>{
                    return featureInfo.validPoint();
                }
            }))
            additionalActions.push(new FeatureAction({
                name: 'toroute',
                label: 'Convert',
                onClick: (featureInfo) => {
                    showDialog(dialogCtx, () => <TrackConvertDialog history={history}
                                                                    name={featureInfo.urlOrKey}/>)
                },
                condition: (featureInfo) => featureInfo.getType() === FeatureInfo.TYPE.track
            }));
            additionalActions.push(new FeatureAction({
                name: 'editRoute',
                label: 'Edit',
                onClick: (featureInfo) => {
                    let nextTarget = featureInfo.point;
                    if (!nextTarget) return;
                    RouteHandler.fetchRoute(featureInfo.urlOrKey, false,
                        (route) => {
                            let idx = route.findBestMatchingIdx(nextTarget);
                            editorRoute.setNewRoute(route, idx >= 0 ? idx : undefined);
                            history.push("editroutepage",{center:true});
                        },
                        (error) => {
                            if (error) Toast(error);
                        });
                },
                condition: (featureInfo) => featureInfo.getType() === FeatureInfo.TYPE.route && featureInfo.isOverlay
            }));
            additionalActions.push(new FeatureAction({
                name: 'editRoute',
                label: 'Edit',
                onClick: (featureInfo) => {
                    activeRoute.setNewIndex(activeRoute.getIndexFromPoint(featureInfo.point,true));
                    activeRoute.syncTo(RouteEdit.MODES.EDIT);
                    history.push("editroutepage",{center:true});
                },
                condition: (featureInfo) => featureInfo.getType() === FeatureInfo.TYPE.route && ! featureInfo.isOverlay
            }));
            additionalActions.push(createRouteFeatureAction(history,true));
            additionalActions.push(new FeatureAction({
                name: 'Delete',
                label: 'Clean Track',
                onClick:()=>{
                    showPromiseDialog(dialogCtx,(dp)=><ConfirmDialog
                        {...dp}
                        title={'Empty Current Track'}
                        text={'Clean current track data and rename files?'}
                    />)
                    .then(()=>navdata.resetTrack(true),()=>{})
                },
                condition:(featureInfo)=>featureInfo.getType() === FeatureInfo.TYPE.track && ! featureInfo.isOverlay && globalStore.getData(keys.properties.connectedMode)
            }))
            additionalActions.push(hideAction);
            additionalActions.push(linkAction(history));
            const listActions=[
                new FeatureAction({
                    name: 'goto',
                    label: 'Goto',
                    onClick: (featureInfo) => {
                        gotoFeature(featureInfo);
                    },
                    condition: (featureInfo)=>featureInfo.validPoint() &&
                        //could only be base boat or anchor
                        featureInfo.getType() === FeatureInfo.TYPE.base

                }),
                createRouteFeatureAction(history)
            ]
            const measure=globalStore.getData(keys.map.activeMeasure);
            listActions.push(new FeatureAction({
                name: 'Measure',
                label: (measure === undefined)?'Measure':'+ Measure',
                onClick: (featureInfo)=>{
                    if (MapHolder.getGpsLock()) return;
                    let newMeasure;
                    if (measure){
                        newMeasure=measure.clone();
                    }
                    else{
                        newMeasure=new Measure('default');
                    }
                    newMeasure.addPoint(-99,featureInfo.point);
                    MapHolder.setCenter(featureInfo.point);
                    globalStore.storeData(keys.map.activeMeasure,newMeasure);
                },
                condition: ()=>!MapHolder.getGpsLock()
            }))
            listActions.push(new FeatureAction({
                name: 'MeasureOff',
                label: 'Measure',
                onClick: ()=>{
                    globalStore.storeData(keys.map.activeMeasure,undefined)
                },
                condition: ()=>globalStore.getData(keys.map.activeMeasure) !== undefined,
                toggle: true
            }))
            showDialog(dialogCtx,(dprops)=><GuardedFeatureListDialog
                {...dprops}
                featureList={featureList}
                additionalActions={additionalActions}
                history={history}
                listActions={listActions}
            />)
            return true;
        }
    }, [history]);
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
                    let mapLockMode=LOCK_MODES.center;
                    if (!old /*off or undefined*/){
                        let lockMode=globalStore.getData(keys.properties.mapLockMode,'center');
                        if ( lockMode === 'ask'){
                            showLockDialog(dialogCtx);
                            return;
                        }
                        if (lockMode === 'current'){
                            mapLockMode=LOCK_MODES.current;
                        }
                    }
                    else{
                        mapLockMode=LOCK_MODES.off;
                    }
                    MapHolder.setGpsLock(mapLockMode);
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
                    history.push("editroutepage");
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
            CenterActionButton,
            Mob.mobDefinition(history),
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
                    history.replace(pageWithOptions.location,pageWithOptions.options);
                }
            }),
            RemoteChannelDialog({overflow:true},dialogCtx),
            FullScreen.fullScreenDefinition,
            Dimmer.buttonDef(),
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
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
                        <OverlayDialog
                            closeCallback={() => history.pop()}>
                            <DialogFrame title={"Waiting for chart"}>
                                <DialogText>{neededChart}</DialogText>
                                <DialogButtons buttonList={DBCancel()}/>
                            </DialogFrame>
                        </OverlayDialog>
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
                autoHideButtons={autohide}
                dialogCtxRef={dialogCtx}
                />
        );
}
NavPage.propTypes=Page.propTypes;
export default NavPage;