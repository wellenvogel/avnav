/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {SyntheticEvent, useCallback, useEffect, useRef, useState} from 'react';
import MapPage, {selectChartDialog, PanelCreator} from '../components/MapPage';
import Toast from '../components/Toast';
// @ts-ignore
import NavHandler from '../nav/navdata.js';
import {
    DBCancel,
    DialogButtons, DialogFrame, DialogRow,
    DialogText, showDialog, showPromiseDialog
} from '../components/OverlayDialog';
import Helper, {injectav} from '../util/helper';
import {
    useKeyEventHandlerPlain,
    useTimer
} from '../util/UiHelper';
import {useStoreHelper} from "../util/UiHelper";
// @ts-ignore
import MapHolder, {LOCK_MODES} from '../map/mapholder.js';
import {ChartEntry, EventTypes, MapEvent} from "../map/maptypes";
// @ts-ignore
import navobjects from '../nav/navobjects.js';
import ButtonList from '../components/ButtonList';
// @ts-ignore
import WayPointDialog, {updateWaypoint} from '../components/WaypointDialog';
// @ts-ignore
import RouteEdit,{StateHelper} from '../nav/routeeditor';
import LayoutHandler, {LAYOUT_OPTIONS} from '../util/layouthandler';
// @ts-ignore
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog';
import {RawButtonDef,createDialog} from '../components/EditPageDialog';
// @ts-ignore
import anchorWatch, {AnchorWatchKeys, isWatchActive} from '../components/AnchorWatchDialog';
import Dimmer from '../util/dimhandler';
// @ts-ignore
import {CenterActionButton, GuardedFeatureListDialog, hideAction, linkAction} from "../components/FeatureInfoDialog";
// @ts-ignore
import {TrackConvertDialog} from "../components/TrackConvertDialog";
import DialogButton from "../components/DialogButton";
// @ts-ignore
import WidgetFactory from "../components/WidgetFactory";
import ItemList, {Item} from "../components/ItemList";
import {PageFrame, PageLeft, PageProps} from "../components/Page";
import Requests from "../util/requests";
import {AisInfoWithFunctions} from "../components/AisInfoDisplay";
// @ts-ignore
import MapEventGuard from "../hoc/MapEventGuard";
import {
    BoatFeatureInfo,
    FeatureAction,
    FeatureInfo, RouteFeatureInfo, WpFeatureInfo
    // @ts-ignore
} from "../map/featureInfo";
// @ts-ignore
import {Measure} from "../nav/routeobjects";
// @ts-ignore
import {KeepFromMode} from "../nav/routedata";
import {ConfirmDialog} from "../components/BasicDialogs";
// @ts-ignore
import navdata from "../nav/navdata";
import base from "../base";
// @ts-ignore
import {showErrorList} from "../components/ErrorListDialog";
import {useHistory} from "../components/HistoryProvider";
// @ts-ignore
import {createItemActions} from "../components/FileDialog";
import {PAGEIDS, PageType} from "../util/pageids";
import {IDialogContext, useDialogContext} from "../components/DialogContext";
import Button, {ButtonDef, propsToDefs, updateFromOld} from "../components/Button";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import NavPageButtons from "./NavPageButtons";
import {IHistory} from "../util/history";

const RouteHandler=NavHandler.getRoutingHandler();

const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);
const editorRoute = new RouteEdit(RouteEdit.MODES.EDIT);

const PAGENAME=PAGEIDS.NAV;




const getPanelList:PanelCreator=(panel:string|PageType)=>{
    return LayoutHandler.getPanelData(PAGENAME,panel,LayoutHandler.getOptionValues([LAYOUT_OPTIONS.SMALL,LAYOUT_OPTIONS.ANCHOR]));
};
const getPanelWidgets=(panel:string)=>{
    const panelData=getPanelList(panel);
    if (panelData && panelData.list) {
        const layoutSequence=globalStore.getData(keys.gui.global.layoutSequence);
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
const startWaypointDialog=(item:navobjects.WayPoint,idx:number,dialogCtx:IDialogContext)=>{
    if (! item) return;
    const wpChanged=(newWp:navobjects.WayPoint)=>{
        const changedWp=updateWaypoint(item,newWp,(err:any)=>{
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
const showLockDialog=(dialogContext:IDialogContext)=>{
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
    wpOn(activeRoute.getNextWaypoint(),KeepFromMode.OLDTO);
};

const navToWp=(on?:boolean)=>{
    if(on){
        const center = globalStore.getData(keys.map.centerPosition);
        const current=activeRoute.getCurrentTarget();
        const wp=new navobjects.WayPoint();
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
        wpOn(wp);
        return;
    }
    RouteHandler.routeOff();
    MapHolder.triggerRender();
};
const wpOn=(...args:any[])=>{
    RouteHandler.wpOn(...args).then(
        ()=>{},
        (e:any)=>{if (e) Toast(e)})
}
const gotoFeature=(featureInfo:FeatureInfo,opt_noRoute?:boolean)=>{
    let target = featureInfo.point;
    if (!target) return;
    if (opt_noRoute && target instanceof navobjects.WayPoint) {
        target=target.clone()
        delete target.routeName;
    }
    if (! target.name) target.name=globalStore.getData(keys.properties.markerDefaultName);
    wpOn(target);
}
const OVERLAYPANEL="overlay";
const getCurrentMapWidgets=():Item[] =>{
    const current = getPanelWidgets(OVERLAYPANEL);
    let idx = 0;
    const rt:Item[] = [];
    if (! current.list) return rt;
    current.list.forEach((item) => {
        rt.push({index: idx,... item});
        idx++;
    })
    return rt;
}
const MapWidgetsDialog =()=> {
    const dialogContext=useDialogContext();
    const onItemClick = useCallback((item:Item)=>{
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
                const theItem=item;
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
const OverlayContent=(
    {showWpButtons,setShowWpButtons,dialogContext}:
    {showWpButtons?:boolean, setShowWpButtons?:(v:boolean)=>void,dialogContext?:IDialogContext,},
)=>{
    const waypointButtons=[
        anchorWatch(false,dialogContext),
        {
            name:'WpLocate',
            onClick:()=>{
                setCenterToTarget();
                setShowWpButtons(false);
            },
            storeKeys: activeRoute.getStoreKeys(),
            updateFunction:(state:any)=>{
                return { visible: StateHelper.hasActiveTarget(state) || StateHelper.anchorWatchDistance(state) !== undefined}
            }
        },
        {
            name:'WpEdit',
            onClick:()=>{
                if (activeRoute.hasRoute()){
                    startWaypointDialog(activeRoute.getPointAt(),activeRoute.getIndex(),dialogContext);
                }
                else {
                    startWaypointDialog(activeRoute.getCurrentTarget(),undefined,dialogContext);
                }
                setShowWpButtons(false);
            },
            storeKeys: activeRoute.getStoreKeys(),
            updateFunction:(state:any)=>{
                return {visible:StateHelper.hasActiveTarget(state) }
            },

        },
        {
            name:'WpGoto',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state:any)=> {
                return {visible: StateHelper.hasActiveTarget(state) &&  !StateHelper.selectedIsActiveTarget(state)}
            },
            onClick:()=>{
                const selected=activeRoute.getPointAt();
                setShowWpButtons(false);
                if (selected) wpOn(selected);
            },


        },
        {
            name:'NavNext',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state:any)=> {
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
            updateFunction: (state:any)=> {
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
            updateFunction: (state:any)=> {
                return {
                    disabled:!StateHelper.hasPointAtOffset(state,1),
                    visible: StateHelper.hasRoute(state) && ! StateHelper.anchorWatchDistance(state)
                };
            },
            onClick:()=>{
                setShowWpButtons(true);
                activeRoute.moveIndex(1);
                const next=activeRoute.getPointAt();
                MapHolder.setCenter(next);

            }
        },
        {
            name:'WpPrevious',
            storeKeys:activeRoute.getStoreKeys(),
            updateFunction: (state:any)=> {
                return {
                    disabled:!StateHelper.hasPointAtOffset(state,-1),
                    visible: StateHelper.hasRoute(state) && ! StateHelper.anchorWatchDistance(state)
                }
            },
            onClick:()=>{
                setShowWpButtons(true);
                activeRoute.moveIndex(-1);
                const next=activeRoute.getPointAt();
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
                const widgetConfig=WidgetFactory.findWidget(widget) || {};
                const key=widget.key;
                return WidgetFactory.createWidget(widget,
                    {
                        handleVisible:!globalStore.getData(keys.gui.global.layoutEditing),
                        registerMap: (callback:(drawing:any,center:any)=>void)=>MapHolder.registerMapWidget(
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
const createRouteFeatureAction=(history:IHistory,opt_fromMeasure?:boolean)=>{
    return new FeatureAction({
        name:'ShowRoutePanel',
        label: opt_fromMeasure?'To Route':'New Route',
        onClick: (featureInfo:FeatureInfo,listCtx:IDialogContext)=>{
            let measure:any;
            if (opt_fromMeasure){
                measure=globalStore.getData(keys.map.activeMeasure);
                if (!measure) return;
                if (measure.points.length < 1) return;
            }
            const routeActions=createItemActions('route');
            const createAction=routeActions.getCreateAction();
            createAction.action(listCtx).then((newRoute:any)=>{
                listCtx.closeDialog();
                if (!measure) {
                    newRoute.addPoint(0, featureInfo.point);
                    editorRoute.setRouteAndIndex(newRoute, 0);
                } else {
                    const mRoute=measure.clone();
                    mRoute.setName(newRoute.name);
                    editorRoute.setRouteAndIndex(mRoute, mRoute.getIndexFromPoint(featureInfo.point))
                }
                history.push("editroutepage", {center: true});
            })
        },
        close:false,
        condition: (featureInfo:FeatureInfo)=>{
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
const NavPage=(props:PageProps)=>{
    const dialogCtx=useDialogContext();
    const [wpButtonsVisible,setWpButtonsVisible]=useState(false);
    useStoreHelper(()=>MapHolder.triggerRender(),keys.gui.global.layoutSequence);
    const [sequence,setSequence]=useState(0);
    const checkChartCount=useRef(30);
    const history=useHistory();
    const runSelectChart=(info?:string)=>{
        selectChartDialog(dialogCtx,()=>setSequence(old=>old+1),info);
    }
    const initialDialogRef=useRef(undefined);
    const loadTimer = useTimer((seq) => {
        const neededChart:ChartEntry= MapHolder.getLastChartKey();
        if (seq === 0){
            //only called once when page is loaded
            if (MapHolder.getCurrentChartEntry()) return;
            if (neededChart){
                dialogCtx.showDialog(()=>{
                        return (<DialogFrame title={"Waiting for chart"}>
                                            <DialogText>{neededChart.displayName||neededChart.name||neededChart.key}</DialogText>
                                            <DialogButtons buttonList={DBCancel()}/>
                                        </DialogFrame>
                        );
                },()=>{
                    const runDialog=!!initialDialogRef.current;
                    initialDialogRef.current=undefined;
                    if (!MapHolder.getCurrentChartEntry() && runDialog) runSelectChart();
                }).then ((cancel)=>initialDialogRef.current=cancel);
            }
            loadTimer.startTimer(seq);
            return;
        }
        if (!initialDialogRef.current  || !neededChart || MapHolder.getCurrentChartEntry()) {
            if (initialDialogRef.current){
                initialDialogRef.current();
                initialDialogRef.current=undefined;
            }
            return;
        }
        checkChartCount.current--;
        if (checkChartCount.current < 0) {
            initialDialogRef.current=undefined; //do not run the dialog twice
            runSelectChart(`unable to load ${neededChart.displayName||neededChart.name||neededChart.key}`);
            return;
        }
        Requests.getJson({
            request:'api',
            type:'chart',
            command:'list'
        }, {timeout: 3 * parseFloat(globalStore.getData(keys.properties.networkTimeout))}).then((json) => {
            (json.items || []).forEach((chartEntry:ChartEntry) => {
                if (chartEntry.name === neededChart.key) {
                    MapHolder.setChartEntry(chartEntry);
                    setSequence(sequence + 1);
                    return;
                }
            })
            loadTimer.startTimer(seq);
        })
            .catch(() => {
                loadTimer.startTimer(seq)
            });
    }, 1000,false,true);
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
    const showAisInfo=useCallback((mmsi:string)=>{
        if (! mmsi) return;
        showDialog(dialogCtx,()=>{
            return <GuardedAisDialog
                mmsi={mmsi}
                actionCb={(action:string,m:string)=>{
                    if (action === 'AisInfoList'){
                        history.push(PAGEIDS.AIS, {mmsi: m});
                    }
                }}
            />;
        })
    },[history]);
    const showWpButtons=useCallback((on?:boolean)=>{
        if (on) {
            wpTimer.startTimer();
        }
        else {
            wpTimer.stopTimer();
        }
        if (wpButtonsVisible === on) return;
        setWpButtonsVisible(on);
    },[wpButtonsVisible]);
    const widgetClick=useCallback((ev:SyntheticEvent)=>{
        const avev=injectav(ev);
        const item=avev.avnav.item||{};
        const panel=avev.avnav.panelName||"";
        const pagePanels=LayoutHandler.getPagePanels(PAGENAME);
        const idx=pagePanels.indexOf(OVERLAYPANEL);
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
            const mmsi=avev.avnav.mmsi;
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

    const mapEvent = useCallback((evdata:MapEvent) => {
        base.log("mapevent: " + evdata.type);
        if (evdata.type === EventTypes.FEATURE) {
            const featureList=evdata.feature;
            const additionalActions:FeatureAction[] = [];
            additionalActions.push(new FeatureAction({
                name:'StopNav',
                label:'StopNav',
                onClick:()=>{
                    wpOn();
                },
                condition:(featureInfo:FeatureInfo)=>featureInfo instanceof WpFeatureInfo
            }))
            additionalActions.push(new FeatureAction({
                name: 'goto',
                label: 'Goto',
                onClick: (featureInfo:FeatureInfo) => {
                    gotoFeature(featureInfo,true);
                },
                condition: (featureInfo:FeatureInfo) => {
                    return featureInfo.validPoint() &&
                        !(featureInfo instanceof WpFeatureInfo ) &&
                        ! (featureInfo instanceof BoatFeatureInfo)
                }
            }));
            additionalActions.push(new FeatureAction({
                name: 'start',
                label: 'Start',
                onClick: (featureInfo:FeatureInfo) => {
                    gotoFeature(featureInfo);
                },
                condition: (featureInfo:FeatureInfo) => {
                    return featureInfo.validPoint() &&
                        !(featureInfo instanceof WpFeatureInfo ) &&
                        ! (featureInfo instanceof BoatFeatureInfo) &&
                        (featureInfo instanceof RouteFeatureInfo)
                }
            }));
            additionalActions.push(new FeatureAction({
                name:'center',
                label:'Center',
                onClick:(featureInfo:FeatureInfo)=>{
                    if (MapHolder.getGpsLock()) return;
                    MapHolder.setCenter(featureInfo.point);
                    MapHolder.triggerRender();
                },
                condition: (featureInfo:FeatureInfo)=>{
                    return featureInfo.validPoint();
                }
            }))
            additionalActions.push(new FeatureAction({
                name: 'toroute',
                label: 'Convert',
                onClick: (featureInfo:FeatureInfo) => {
                    dialogCtx.showDialog( () => <TrackConvertDialog history={history}
                                                                    name={featureInfo.urlOrKey}/>)
                },
                onPreClose:false,
                close: false,
                condition: (featureInfo:FeatureInfo) => featureInfo.getType() === FeatureInfo.TYPE.track
            }));
            additionalActions.push(new FeatureAction({
                name: 'editRoute',
                label: 'Edit',
                onClick: (featureInfo:FeatureInfo) => {
                    const nextTarget = featureInfo.point;
                    if (!nextTarget) return;
                    RouteHandler.fetchRoute(featureInfo.urlOrKey)
                        .then((route:any) => {
                            const idx = route.findBestMatchingIdx(nextTarget);
                            editorRoute.setNewRoute(route, idx >= 0 ? idx : undefined);
                            history.push(PAGEIDS.ROUTE,{center:true});
                        },
                        (error:any) => {
                            if (error) Toast(error);
                        });
                },
                condition: (featureInfo:FeatureInfo) => featureInfo.getType() === FeatureInfo.TYPE.route && featureInfo.isOverlay
            }));
            additionalActions.push(new FeatureAction({
                name: 'editRoute',
                label: 'Edit',
                onClick: (featureInfo:FeatureInfo) => {
                    activeRoute.setNewIndex(activeRoute.getIndexFromPoint(featureInfo.point,true));
                    activeRoute.syncTo(RouteEdit.MODES.EDIT);
                    history.push("editroutepage",{center:true});
                },
                condition: (featureInfo:FeatureInfo) => featureInfo.getType() === FeatureInfo.TYPE.route && ! featureInfo.isOverlay
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
                condition:(featureInfo:FeatureInfo)=>featureInfo.getType() === FeatureInfo.TYPE.track && ! featureInfo.isOverlay && globalStore.getData(keys.gui.global.connectedMode)
            }))
            additionalActions.push(hideAction);
            additionalActions.push(linkAction);
            const listActions=[
                new FeatureAction({
                    name: 'goto',
                    label: 'Goto',
                    onClick: (featureInfo:FeatureInfo) => {
                        gotoFeature(featureInfo);
                    },
                    condition: (featureInfo:FeatureInfo)=>featureInfo.validPoint() &&
                        //could only be base boat or anchor
                        featureInfo.getType() === FeatureInfo.TYPE.base

                }),
                createRouteFeatureAction(history)
            ]
            const measure=globalStore.getData(keys.map.activeMeasure);
            listActions.push(new FeatureAction({
                name: 'Measure',
                label: (measure === undefined)?'Measure':'+ Measure',
                onClick: (featureInfo:FeatureInfo)=>{
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
                listActions={listActions}
            />)
            return true;
        }
    }, [history]);
    const editLayoutButtons=propsToDefs([
        {
            ...RawButtonDef,
            onClick: () => createDialog(PAGENAME,
                MapPage.PANELS,
                [LAYOUT_OPTIONS.SMALL, LAYOUT_OPTIONS.ANCHOR])
        },
        {
            name: 'NavMapWidgets',
            editOnly: true,
            overflow: true,
            onClick: ()=>showDialog(dialogCtx,(props)=><MapWidgetsDialog {...props}/>)
        }
        ]);
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
                onClick:()=>{
                    const old=globalStore.getData(keys.map.lockPosition);
                    let mapLockMode=LOCK_MODES.center;
                    if (!old /*off or undefined*/){
                        const lockMode=globalStore.getData(keys.properties.mapLockMode,'center');
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
                updateFunction:(state:any)=>{
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
                updateFunction:(state:any)=>{
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
                    history.push(PAGEIDS.ROUTE);
                },
                overflow: true

            },
            {
                name: "NavOverlays",
                onClick:()=>runSelectChart(),
                /*overflow: true,
                storeKeys:{
                    visible:keys.gui.capabilities.uploadOverlays
                }*/
            },
            {
                name:'GpsCenter',
                onClick:()=>{
                    MapHolder.centerToGps();

                },
                overflow: true,
                editDisable: true
            },
            CenterActionButton,
            Dimmer.buttonDef(),
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        const currentButtons=useRef<ButtonDef[]>();
        currentButtons.current=
            InjectMainMenu(PAGEIDS.NAV,
                updateFromOld(NavPageButtons,buttons).concat(propsToDefs(editLayoutButtons))
                );
        useInitialButton(currentButtons)
        let autohide=undefined;
        if (globalStore.getData(keys.properties.autoHideNavPage) && ! wpButtonsVisible && ! globalStore.getData(keys.gui.global.layoutEditing)){
            autohide=globalStore.getData(keys.properties.hideButtonTime,30)*1000;
        }
        const pageProperties=props;
        const hasChart=!!MapHolder.getCurrentChartEntry();
        if (! hasChart){
            return <PageFrame id={pageProperties.id}>
                <PageLeft id={pageProperties.id}>
                    <div className={"noChart"}>No Chart selected</div>
                    <Button
                        className={"center"}
                        name={'NavOverlays'}
                        displayName={'Select Chart'}
                        onClick={()=>runSelectChart()}/>
                </PageLeft>
                <ButtonList page={pageProperties.id} itemList={buttons}/>
            </PageFrame>
        }
        return (
            <MapPage
                {...pageProperties}
                id={PAGENAME}
                mapEventCallback={mapEvent}
                onItemClick={widgetClick}
                panelCreator={getPanelList}
                overlayContent={
                    <OverlayContent
                        showWpButtons={wpButtonsVisible}
                        setShowWpButtons={(on)=>{
                            showWpButtons(on);
                        }}

                    />}
                buttonList={currentButtons.current}
                autoHideButtons={autohide}
                />
        );
}
export default NavPage;