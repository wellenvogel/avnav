/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {SyntheticEvent, useCallback, useEffect, useRef, useState} from 'react';
import MapPage, {OverlayButtonDisplay, selectChartDialog} from '../components/MapPage';
import Toast from '../components/Toast';
// @ts-ignore
import NavHandler from '../nav/navdata.js';
import routeobjects, {Route, RouteInfo} from '../nav/routeobjects';
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    DialogRow,
    showDialog,
    showPromiseDialog
} from '../components/OverlayDialog';
import Helper, {avitem, getav, injectav, valueof} from '../util/helper';
import {useStateRef} from '../util/UiHelper';
// @ts-ignore
import mapholder, {LOCK_MODES} from '../map/mapholder';
import {EventTypes, MapEvent} from '../map/maptypes';
// @ts-ignore
import WayPointDialog, {updateWaypoint} from '../components/WaypointDialog';
import RouteEdit, {RouteStoreDataType, StateHelper} from '../nav/routeeditor';
// @ts-ignore
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog';
import {createDialog, RawButtonDef} from '../components/EditPageDialog';
import LayoutHandler, {LAYOUT_OPTIONS} from '../util/layouthandler';
// @ts-ignore
import {CenterActionButton, GuardedFeatureListDialog, hideAction, linkAction} from "../components/FeatureInfoDialog";
import {Checkbox, InputReadOnly} from "../components/Inputs";
import DB from '../components/DialogButton';
import Formatter from "../util/formatter";
// @ts-ignore
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";
import  {PageProps} from "../components/Page";
import {useStore, useStoreState} from "../hoc/Dynamic";
import {ConfirmDialog, InfoItem} from "../components/BasicDialogs";
// @ts-ignore
import RoutePointsWidget from "../components/RoutePointsWidget";
// @ts-ignore
import {createItemActions, standardActions} from "../components/FileDialog";
import UploadHandler, {uploadClick} from "../components/UploadHandler";
import {FeatureAction, FeatureInfo} from "../map/featureInfo";
import DownloadButton from "../components/DownloadButton";
import {useHistory} from "../components/HistoryProvider";
import {DownloadItemInfoMode, DownloadItemList} from "../components/DownloadItemList";
import {IDialogContext, useDialogContext} from "../components/DialogContext";
import {InjectMainMenu} from "./MainNav";
import {PAGEIDS} from "../util/pageids";
import {propsToDefs, updateButtons} from "../components/Button";
import {GeneralWithCancel} from "./GeneralButtons";
import {iconClasses} from '../components/Icons';
import ButtonDefs from "../components/ButtonDefs";
import {ActionDialog} from "../components/ActionDialog";
import {Point, WayPoint} from "../nav/navobjects";
import {IHistory} from "../util/history";

const RouteHandler = NavHandler.getRoutingHandler();
const PAGENAME = "editroutepage";

const editor = new RouteEdit(RouteEdit.MODES.EDIT);
const activeRoute = new RouteEdit(RouteEdit.MODES.ACTIVE);

const mergedStoreKeys:Record<string,string>={};
for (const red of [editor,activeRoute]) {
    const prfx=(editor === red )?'ed':'ac';
    const keys=red.getStoreKeys();
    for (const k in keys){
        mergedStoreKeys[prfx+k] = keys[k];
    }
}


const isActiveRoute = (activeState:RouteStoreDataType,editorState:RouteStoreDataType) => {
    const active = StateHelper.route(activeState);
    return StateHelper.isSameRoute(editorState,active);
};
const getCurrentEditor = () => {
    return isActiveRoute(activeRoute.getState(),editor.getState()) ? activeRoute : editor;
};

const startWaypointDialog = (item:WayPoint, index:number, dialogContext?:IDialogContext) => {
    if (!item) return;
    const wpChanged = (newWp:WayPoint) => {
        const changedWp = updateWaypoint(item, newWp, (err:string) => {
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            getCurrentEditor().changeSelectedWaypoint(changedWp, index);
            return true;
        }
        return false;
    };
    const canWrite=checkRouteWritable();
    const RenderDialog = ()=> {
        const history = useHistory();
        return <WayPointDialog
            readOnly={!canWrite}
            waypoint={item}
            okCallback={wpChanged}
            deleteCallback={()=>{
                getCurrentEditor().deleteWaypoint(index);
                return true;
            }}
            startCallback={()=>{
                startRouting(dialogContext,index,history);
                return true;
            }}
        />
    };
    showDialog(dialogContext, RenderDialog);
};

export const INFO_ROWS = [
    {label: 'points', value: 'numpoints'},
    {label: 'length', value: 'length', formatter: (v:number) => {
            return Formatter.formatDistance(v) + " nm";
        }
    }
];
interface EditPointsDialogProps{
    route?:Route
    inverted?:boolean
    resolveFunction:({route,inverted}:{route:Route,inverted:boolean}) => void
}
const EditPointsDialog=(props:EditPointsDialogProps)=>{
    if (!props.route) return null;
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [selected,setSelected]=useState(0);
    const [inverted,setInverted]=useState(props.inverted);
    const activeRouteState= useStore({storeKeys:activeRoute.getStoreKeys()});
    const isActiveRoute=useCallback(()=>{
        return StateHelper.isSameRoute(activeRouteState,route)
    },[activeRouteState])
    const changeRoute = (cb:(route:Route)=>(boolean|undefined)) => {
        const newRoute = route.clone();
        if (cb(newRoute) !== false) {
            setRoute(newRoute);
            return newRoute;
        }
        return route;
    }
    const wpChanged = (oldWp:WayPoint,newWp:WayPoint,idx:number) => {
        const changedWp = updateWaypoint(oldWp, newWp, (err:string) => {
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            changeRoute((nr:Route)=>{nr.points[idx]=changedWp;return true;})
            return true;
        }
        return false;
    };
    const info = RouteHandler.getInfoFromRoute(route);
    const active=isActiveRoute();
    return <DialogFrame className={"EditRoutePoints"} title={route.name}>
        {INFO_ROWS.map((description) => {
            return InfoItem.show(info, description);
        })}
        {inverted && <DialogRow>inverted</DialogRow>}
        <RoutePointsWidget
            route={route}
            index={selected}
            showLatLon={globalStore.getData(keys.properties.routeShowLL)}
            useRhumbLine={globalStore.getData(keys.nav.routeHandler.useRhumbLine)}
            onClick={(ev:SyntheticEvent)=>{
                const item:WayPoint & {idx:number}=getav(ev).point;
                setSelected(item.idx);
                showDialog(dialogContext,()=><WayPointDialog
                    waypoint={item}
                    okCallback={(changedWp:WayPoint)=>{
                        return wpChanged(item,changedWp,item.idx);
                    }}
                    deleteCallback={active?undefined:(wp:WayPoint & {idx:number})=>{
                        changeRoute((nr:Route)=>{
                            nr.deletePoint(wp.idx);
                            return true;
                        })
                        return true;
                    }}
                />);
            }}
        />
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.DBEmptyRoute,
                onClick: () => {
                    const changed=changeRoute((nr:Route) => {
                        nr.points = [];
                        return true;
                    });
                    if (changed.points.length < 1) setInverted(false);
                },
                close: false,
                visible: !active,
                disabled: route.points.length < 1,
            },
            {
                ...ButtonDefs.DBInvertRoute,
                onClick: () => {
                    changeRoute((nr:Route) => {
                        nr.swap();
                        return true;
                    })
                    setInverted(!inverted);
                },
                disabled: route.points.length < 1,
                close: false,
            },
            {
                ...ButtonDefs.DBRenumberRoute,
                onClick:()=>{
                    showPromiseDialog(dialogContext,(drops)=><ConfirmDialog {...drops} text={"All waypoint names will change"} title={"Renumber points?"}/> )
                        .then(()=>{
                            if (changeRoute((nr:Route)=>{
                                nr.renumber(1);
                                return true;
                            })) setInverted(false);
                        },
                            ()=>{})
                },
                disabled: route.points.length < 1,
                close: false,
            },
            DBCancel(),
            DBOk(()=>{
                if (props.resolveFunction) props.resolveFunction({
                    route:route,
                    inverted:inverted
                });
            },{
                disabled: !route.differsTo(props.route)
            })
        ]}/>
    </DialogFrame>
}

const isRouteInList=(routeList:RouteInfo[],route:RouteInfo)=>{
    if (! routeList || ! route) return false;
    for (const rt of routeList) {
        if (routeobjects.isSameRoute(rt,route)){return true;}
    }
    return false;
}

interface LoadRouteDialogProps{
    blacklist:RouteInfo[],
    selectedRoute?:Route,
    resolveFunction?:(route:Route) => void,
    title:string,
    allowUpload:boolean,
}
const LoadRouteDialog=({blacklist,selectedRoute,resolveFunction,title,allowUpload}:LoadRouteDialogProps)=>{
    const dialogContext=useDialogContext();
    const [,,connectedModeRef]=useStoreState(keys.gui.global.connectedMode);
    const [wrOnly,setWrOnly,wrOnlyRef]=useStateRef(true);
    const itemActions=createItemActions('route').copy({
        canModify:(item:RouteInfo)=>(!item.server || connectedModeRef.current),
        show:(item:RouteInfo)=>{
            if (selectedRoute && selectedRoute.name === item.name) return "selected";
            if (isRouteInList(blacklist,item)) return "blacklisted";
            if (! wrOnlyRef.current) return true;
            if (item.server && ! connectedModeRef.current) return "not con";
            return true;
        }
    })
    const [uploadFile,setUploadFile]=useState(undefined);
    return <DialogFrame className={'LoadRoutesDialog'} title={title}>
        <Checkbox dialogRow={true} label={"writableOnly"} value={wrOnly} onChange={(nv)=>setWrOnly(nv)}/>
        <DownloadItemList
            type={'route'}
            selectCallback={async (ev)=>{
                const entry=avitem(ev);
                try {
                    const nroute = await RouteHandler.fetchRoute(entry.name);
                    if (!nroute) {
                        throw new Error("unable to load route " + entry.name);
                    }
                    if (resolveFunction) resolveFunction(nroute.clone());
                    dialogContext.closeDialog();
                } catch (err) {
                    Toast("unable to load route: " + err)
                }
                return true;
            }}
            noExtra={true}
            infoMode={DownloadItemInfoMode.ICONS}
            itemActions={itemActions}
        />
        <UploadHandler
            local={true}
            file={uploadFile}
            type={'route'}
            checkNameCallback={async (file)=>{
                try {
                    const uploadAction=itemActions.getUploadAction().copy({
                        localAction: async (userData:{nroute?:Route},name:string)=>{
                            if (! userData.nroute) throw new Error("no route loaded");
                            userData.nroute.name=name;
                            if (resolveFunction) resolveFunction(userData.nroute);
                            dialogContext.closeDialog();
                        }
                    });
                    return uploadAction.checkFile(file,dialogContext);
                }catch (e) {
                    Toast(e);
                }
            }}
            errorCallback={(err)=>{
                setUploadFile(undefined);
                Toast(err)
            }}
            doneCallback={()=>setUploadFile(undefined)}
        />
        <DialogButtons buttonList={[
            {
                ...ButtonDefs.Upload,
                onClick: ()=>uploadClick((ev)=>{
                    setUploadFile(ev.target.files[0]);
                },".gpx"),
                visible: allowUpload,
                close:false
            },
            DBCancel()
        ]}/>
    </DialogFrame>
}

const RouteSaveModes={
    NONE:0,
    UPDATE: 1, //if name changed: delete old editing
    REPLACE_EXISTING:2,  //after loading new route - do not delete old editing
    REPLACE_NEW:3 //replace with a new route - do not delete existing
}
interface EditRouteDialogProps{
    route:Route,
}

const EditRouteDialog = (props:EditRouteDialogProps) => {
    const itemActions=createItemActions('route');
    const activeRouteState=useStore({storeKeys: activeRoute.getStoreKeys()})
    const [saveMode,setSaveMode]=useState(RouteSaveModes.UPDATE);
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [inverted, setInverted] = useState(false);
    const [connectedMode]=useStoreState(keys.gui.global.connectedMode)
    const isActiveRoute = useCallback(() => {
        return  StateHelper.isSameRoute(activeRouteState,route);
    }, [activeRouteState,route]);
    const getCurrentEditor = useCallback(() => {
        return isActiveRoute() ? activeRoute : editor;
    }, []);
    if (!props.route) return null;
    const changeRoute = (cb :(route:Route)=>boolean) => {
        const newRoute = route.clone();
        if (cb(newRoute) !== false) {
            setRoute(newRoute);
            return newRoute;
        }
        return route;
    }
    const save = (cloned:Route,rtSaveMode:valueof<typeof RouteSaveModes>) => {
        const oldName = props.route.name;
        if (rtSaveMode === RouteSaveModes.NONE) return false;
        if (rtSaveMode === RouteSaveModes.UPDATE){
            const isActive= StateHelper.isSameRoute(activeRouteState,props.route);
            const nameChanged=route.name !== oldName;
            if ( isActive && nameChanged){
                Toast("cannot rename active route");
                return false;
            }
            getCurrentEditor().setNewRoute(cloned,undefined,true);
            //the page must also know that we are now editing a different route
            editor.setNewRoute(cloned,undefined,true);
            if (nameChanged) {
                RouteHandler.deleteRoute(oldName)
                    .then(() => {
                    },
                    (error:string) => {
                        Toast(error);
                    })
            }
            return true;
        }
        if (rtSaveMode === RouteSaveModes.REPLACE_NEW || saveMode === RouteSaveModes.REPLACE_EXISTING){
            if (rtSaveMode === RouteSaveModes.REPLACE_NEW) {
                //we should never replace the currently active route with a newly created one
                //basically this should not be possible any way as the name dialog would prevent this
                //but: do a last check anyway
                if (StateHelper.isSameRoute(activeRouteState,cloned)) {
                    Toast("unable to copy to active route");
                    return false;
                }
            }
            editor.setNewRoute(cloned,undefined,true);
            return true;
        }
        return false;
    }
    const loadNewRoute = () => {
        showPromiseDialog(dialogContext,(props)=><LoadRouteDialog
            {...props}
            blacklist={[route]}
            selectedRoute={getCurrentEditor().getRoute()}
            allowUpload={true}
        />)
            .then((nroute)=>{
                        setRoute(nroute);
                        setInverted(false);
                        setSaveMode((nroute.name === props.route.name)?RouteSaveModes.UPDATE:RouteSaveModes.REPLACE_EXISTING);
                    },
                    () => {}
            )
    }
    const writable= ! route.isServer() || connectedMode;
    const canDelete = !isActiveRoute()  && route.name !== DEFAULT_ROUTE && writable;
    const info = RouteHandler.getInfoFromRoute(route);
    const createAction=itemActions.getCreateAction().copy({title:'Choose name for new route'});
    const renameKey=standardActions.rename?.name;
    const deleteKey=standardActions.delete?.name;
    const actions=itemActions.getActions(info,[renameKey,deleteKey]);
    const renameAction=actions[renameKey]?.copy({
        execute: (_item:any,newName:string)=>{
            changeRoute((nr:Route)=>{nr.setName(newName);return true;})
        }
    });
    const deleteAction=actions[deleteKey]?.copy({
        close:false
    });
    return <DialogFrame className={Helper.concatsp("EditRouteDialog",isActiveRoute()?"activeRoute":undefined)} title={"Edit Route"}>
        <InputReadOnly
            dialogRow={true}
            label="name"
            value={route.displayName()}
        >
        </InputReadOnly>
        {INFO_ROWS.concat(itemActions.getInfoRows(info)).map((description) => {
            return InfoItem.show(info, description);
        })}
        {inverted && <InfoItem
            label=""
            value="inverted"
        />}
        <InfoItem label={'writable'} value={""+writable}/>
        <DialogButtons>
            <DB {...ButtonDefs.DBNewRoute}
                onClick={() => {
                    createAction.action(dialogContext)
                        .then((newRoute:Route)=>{
                            setRoute(newRoute);
                            setInverted(false);
                            setSaveMode(RouteSaveModes.REPLACE_NEW);
                        },()=>{});
                }}
                close={false}
            />
            < DB {...ButtonDefs.DBLoadRoute}
                 onClick={loadNewRoute}
                 close={false}
            />
            <DownloadButton
                fileName={route.name+".gpx"}
                localData={()=>route.toXml()}
                useDialogButton={true}
            />
            <DB {...ButtonDefs.DBRename}
                onClick={() => {
                    renameAction.runAction(info,dialogContext)
                    .then(() => {},(e?:string)=>{if (e) Toast(e)});
                }}
                close={false}
                disabled={! writable || (props.route.name === DEFAULT_ROUTE && saveMode === RouteSaveModes.UPDATE) || isActiveRoute()}
                visible={!!renameAction}
            />
                <DB {...ButtonDefs.DBRoutePoints}
                    onClick={() => {
                        showPromiseDialog(dialogContext,EditPointsDialog,{route:route,inverted:inverted})
                            .then((changed)=>{
                                setRoute(changed.route.clone());
                                setInverted(changed.inverted);
                            },()=>{})
                    }}
                    close={false}
                    disabled={!writable}
                />
            <DB
                {...ButtonDefs.StopNav}
                iconClass={iconClasses.NavStop}
                onClick={()=>{
                    if (! isActiveRoute()) return;
                    RouteHandler.routeOff();
                    mapholder.triggerRender();
                    dialogContext.closeDialog();
                }}
                visible={isActiveRoute()}
                disabled={!writable}
                close={false}
            />
        </DialogButtons>
        <DialogButtons>
            <DB {...ButtonDefs.DBDelete}
                onClick={async () => {
                    try {
                        if (await deleteAction.runAction(info, dialogContext)) {
                            if (editor.isHandling(info)) {
                                editor.removeRoute();
                            }
                            dialogContext.closeDialog();
                        }
                    }catch (e) {
                        if (e) Toast(e);
                    }
                }}
                close={false}
                disabled={!canDelete || saveMode === RouteSaveModes.REPLACE_NEW}
                visible={!!deleteAction }
            />
            <DB {...ButtonDefs.DBSaveAs}
                onClick={() => {
                    renameAction.copy({
                        execute: (_item:any,newName:string)=>{
                            const baseName=routeobjects.nameToBaseName(newName);
                            newName=(itemActions.isConnected()?routeobjects.SERVER_PREFIX:routeobjects.LOCAL_PREFIX)+baseName;
                            const changedRoute=changeRoute((nr:Route)=>{nr.setName(newName);return true;})
                            setSaveMode(RouteSaveModes.REPLACE_NEW); //just if something goes wrong during save and we do not close
                            if(save(changedRoute,RouteSaveModes.REPLACE_NEW)) dialogContext.closeDialog()
                        },
                        title:'Save As'
                    }).runAction(info,dialogContext);
                }}
                close={false}
                visible={!!renameAction}
            />
            <DB {...ButtonDefs.DBCancel}/>
            <DB {...ButtonDefs.DBOk}
                onClick={() => save(route.clone(),saveMode)}
                disabled={!route.differsTo(props.route) || (! writable && saveMode !== RouteSaveModes.REPLACE_EXISTING)}
            >
            </DB>

        </DialogButtons>
    </DialogFrame>
}


const getPanelList = (panel:string) => {
    return LayoutHandler.getPanelData(PAGENAME, panel, LayoutHandler.getOptionValues([LAYOUT_OPTIONS.SMALL]));
};

const checkEmptyRoute = () => {
    if (!editor.hasRoute()) {
        RouteHandler.fetchRoute(DEFAULT_ROUTE)
            .then((route:Route) => {
                editor.setRouteAndIndex(route, 0);
            },
            () => {
                const rt = new Route(DEFAULT_ROUTE);
                editor.setRouteAndIndex(rt, 0);
            });

    }
}

const startRouting=(dialogContext?:IDialogContext,optIdx?:number,opt_history?:IHistory)=>{
    //if (!checkRouteWritable()) return;
    stopAnchorWithConfirm(true,dialogContext)
        .then(async () => {
            await RouteHandler.wpOn(getCurrentEditor().getPointAt(optIdx));
            if (opt_history) opt_history.push(PAGEIDS.NAV);
        })
        .catch((e?:string) => {
            if (e) Toast(e);
        });
}

const checkRouteWritable = (dialogContext?:IDialogContext) => {
    const currentEditor = getCurrentEditor();
    if (currentEditor.isRouteWritable()) return true;
    if (!dialogContext) return false;
    showPromiseDialog(dialogContext, (dprops)=><ConfirmDialog {...dprops} text={"you cannot edit this route as you are disconnected. OK to save as new local route."}/>)
        .then(() => {
            showDialog(dialogContext,(props)=><EditRouteDialog
                {...props}
                route={currentEditor.getRoute().clone()}
            />,()=>{
                checkEmptyRoute();
                mapholder.triggerRender();
            })
        });
    return false;
};

const getTargetFromInfo=(featureInfo:FeatureInfo)=> {
    const target = featureInfo.point;
    if (! target) return ;
    return WayPoint.fromPlain(target);
}

const DEFAULT_ROUTE = "default";

const buildWaypointButtons=(dialogContext:IDialogContext,
                            closeButtons:()=>void,
                            setLastCenteredWp:(nr:number)=>void,
                            routeWritable:boolean,
                            opt_omitCancel?:boolean)=>{
    return  [
        {
            ...ButtonDefs.Cancel,
            onClick:()=>{
                closeButtons();
            },
            visible: !opt_omitCancel,
        },
        {
            ...ButtonDefs.WpLocate,
            onClick: () => {
                const currentEditor = getCurrentEditor();
                mapholder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            }
        },
        {
            ...ButtonDefs.WpEdit,
            onClick: () => {
                const currentEditor = getCurrentEditor();
                startWaypointDialog(currentEditor.getPointAt(), currentEditor.getIndex(), dialogContext);
            },
            visible: routeWritable
        },
        {
            ...ButtonDefs.WpNext,
            storeKeys: mergedStoreKeys,
            updateFunction: () => {
                //we need to be slightly dirty here
                //the store keys will be kept from the initiol render
                //but the active editor could change afterwards
                //so we use the current editor
                const editor=getCurrentEditor();
                const realState=editor.getState();
                return {disabled: !StateHelper.hasPointAtOffset(realState, 1)};
            },
            onClick: () => {
                const currentEditor = getCurrentEditor();
                currentEditor.moveIndex(1);
                mapholder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            },
            visible: routeWritable
        },
        {
            ...ButtonDefs.WpPrevious,
            storeKeys: mergedStoreKeys,
            updateFunction: () => {
                const editor=getCurrentEditor();
                const realState=editor.getState();
                return {disabled: !StateHelper.hasPointAtOffset(realState, -1)}
            },
            onClick: () => {
                const currentEditor = getCurrentEditor();
                currentEditor.moveIndex(-1);
                mapholder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            },
            visible: routeWritable
        }
    ];
}

const EditRoutePage = (props:PageProps) => {
    const history=useHistory();
    const dialogContext = useDialogContext();
    const editorState=useStore({editor: activeRoute.getStoreKeys()});
    const activeState=useStore({storeKeys:activeRoute.getStoreKeys()})
    const [wpButtonsVisible, setWpButtonsVisible] = useState(false);
    const [lastCenteredWp, setLastCenteredWp] = useState<number>();
    const [connectedMode]=useStoreState(keys.gui.global.connectedMode);
    const hasCentered = useRef(false);
    const showingActiveRoute=isActiveRoute(activeState,editorState);
    const routeWritable=!StateHelper.isServerRoute(showingActiveRoute?activeState:editorState) || connectedMode;
    const showWpButtons = useCallback((on:boolean) => {
        if (on === wpButtonsVisible) return;
        setWpButtonsVisible(on);
    }, [wpButtonsVisible]);
    const lastGpsLock = useRef();
    const lastBoatOffset=useRef();
    useEffect(() => {
        checkEmptyRoute();
        RouteHandler.setCurrentRoutePage(PAGENAME);
        mapholder.setRoutingActive(true);
        mapholder.showEditingRoute(true);
        mapholder.leavePageAction();
        lastGpsLock.current = mapholder.getGpsLock();
        lastBoatOffset.current=mapholder.getBoatOffset();
        mapholder.setGpsLock(LOCK_MODES.off,true);
        return () => {
            mapholder.setRoutingActive(false);
            mapholder.setBoatOffsetXY(lastBoatOffset.current);
            mapholder.setGpsLock(lastGpsLock.current, true,false,true);
            RouteHandler.unsetCurrentRoutePage(PAGENAME);
        }
    }, []);
    const showRouteDialog=()=>{
        if (globalStore.getData(keys.gui.global.layoutEditing)) return;
        const currentEditor = getCurrentEditor();
        showDialog(dialogContext, () => {
            return <EditRouteDialog
                route={currentEditor.getRoute()?currentEditor.getRoute().clone():new Route('empty')}
            />
        },()=>{
            checkEmptyRoute();
            mapholder.triggerRender();
        })
    }
    const widgetClick = (ev:SyntheticEvent) => {
        const av=injectav(ev);
        const item=av.avnav.item||{};
        const panel=av.avnav.panelName;
        const invertEditDirection=av.avnav.invertEditDirection;
        const currentEditor = getCurrentEditor();
        if (item.name === "EditRoute") {
            showRouteDialog();
        }
        if (item.name === 'RoutePoints') {
            const point=av.avnav.point;
            if (LayoutHandler.isEditing()) return;
            if (point && point.idx !== undefined) {
                const lastSelected = currentEditor.getIndex();
                currentEditor.setNewIndex(point.idx);
                mapholder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(point.idx);
                if (lastSelected === point.idx && lastCenteredWp === point.idx) {
                    startWaypointDialog(point, point.idx, dialogContext);
                }
            }
            return;
        }
        if (LayoutHandler.isEditing()) {
            showDialog(dialogContext, () => <EditWidgetDialogWithFunc
                widgetItem={item}
                pageWithOptions={PAGENAME}
                panelname={panel}
                opt_options={{beginning: invertEditDirection, types: ["!map"]}}
            />);
            return;
        }
        if (panel === 'bottomRight') {
            if (!globalStore.getData(keys.nav.gps.valid)) return;
            const boatPos = globalStore.getData(keys.nav.gps.position);
            mapholder.setCenter(boatPos);
            return;
        }
        if (panel === 'bottomLeft') {
            showWpButtons(true)
        }

    };


    const insertOtherRoute = (name:string, iotherStart:Point, opt_before?:boolean) => {
        const editor = getCurrentEditor();
        const idx = editor.getIndex();
        const current = editor.getPointAt(idx);
        if (!iotherStart) return;
        const otherStart=WayPoint.fromPlain(iotherStart);
        const runInsert = () => {
            RouteHandler.fetchRoute(name)
                .then((route:Route) => {
                    if (!route.points) return;
                    const insertPoints = [];
                    let usePoints = false;
                    for (let i = 0; i < route.points.length; i++) {
                        if (route.points[i].compare(otherStart)) usePoints = true;
                        if (usePoints) insertPoints.push(route.points[i]);
                    }
                    editor.addMultipleWaypoints(insertPoints, opt_before);
                },
                (error:string) => {
                    Toast(error)
                }
            );
        }
        if (!current) return runInsert();
        const otherIndex = idx + (opt_before ? -1 : 1);
        const other = editor.getPointAt(otherIndex);
        let text, replace:Record<string, string>;
        if (other !== undefined && otherIndex >= 0) {
            //ask the user if we should really insert between 2 points
            text = "Really insert route ${route} starting at ${start} between ${from} and ${to}?";
            replace = {route: name, start: otherStart.name};
            if (opt_before) {
                replace.from = other.name;
                replace.to = current.name;
            } else {
                replace.from = current.name;
                replace.to = other.name;
            }
        } else {
            text = opt_before ?
                "Really insert route ${route} starting at ${start} before ${current}?" :
                "Really append route ${route} starting at ${start} after ${current}?";
            replace = {route: name, current: current.name, start: otherStart.name};
        }
        showPromiseDialog(dialogContext, (dprops)=><ConfirmDialog {...dprops} text={Helper.templateReplace(text, replace)}/>)
            .then(() => runInsert())
            .catch(() => {
            });
    }
    const pointActions=[new FeatureAction(
        {
            ...ButtonDefs.NavAdd,
            onClick: (info) => {
                const target = getTargetFromInfo(info);
                if (!target) return;
                const currentEditor = getCurrentEditor();
                mapholder.setCenter(target);
                currentEditor.addWaypoint(target, true);
                setLastCenteredWp(currentEditor.getIndex());
            },
            condition: (featureInfo) => featureInfo.validPoint()
        }),
        new FeatureAction(
            {
                ...ButtonDefs.NavAddAfter,
                 onClick: (info) => {
                    const target = getTargetFromInfo(info);
                    if (!target) return;
                    const currentEditor = getCurrentEditor();
                    mapholder.setCenter(target);
                    currentEditor.addWaypoint(target);
                    setLastCenteredWp(currentEditor.getIndex());
                },
                condition: (featureInfo) => featureInfo.validPoint()
            }),
        new FeatureAction(
            {
                ...ButtonDefs.NavToCenter,
                onClick: (info) => {
                    const target = getTargetFromInfo(info);
                    if (!target) return;
                    const currentEditor = getCurrentEditor();
                    mapholder.setCenter(target);
                    currentEditor.changeSelectedWaypoint(target);
                    setLastCenteredWp(currentEditor.getIndex());
                },
                condition: (featureInfo) => featureInfo.validPoint()
            })
    ]

    const mapEvent = (evdata:MapEvent) => {
        //console.log("mapevent: "+evdata.type);
        const currentEditor = getCurrentEditor();
        if (evdata.type === EventTypes.LOAD || evdata.type === EventTypes.RELOAD) {
            if (hasCentered.current) return true;
            if (props.options && props.options.center) {
                if (currentEditor.hasRoute()) {
                    const index=currentEditor.getIndex();
                    const wp = currentEditor.getPointAt(index);
                    if (wp && index >= 0) {
                        setLastCenteredWp(index);
                        mapholder.setCenter(wp);
                    }
                }
            }
            hasCentered.current = true;
        }
        if (evdata.type === EventTypes.SELECTWP) {
            if (evdata.fromButton){
                //never start the editWaypointDialog
                //or set the selected waypoint
                return false;
            }
            const currentIndex = currentEditor.getIndex();
            const newIndex = currentEditor.getIndexFromPoint(evdata.wp);
            if (currentIndex !== newIndex) currentEditor.setNewIndex(newIndex);
            else {
                startWaypointDialog(currentEditor.getPointAt(currentIndex), currentIndex, dialogContext);
            }
            return true;
        }
        if (evdata.type === EventTypes.FEATURE) {
            const fromButton=!!evdata.fromButton;
            const featureList = evdata.feature;
            const additionalActions:FeatureAction[] = [];
            if (routeWritable) {
                if (! fromButton) additionalActions.push(...pointActions);
                const routeActionCondition = (featureInfo:FeatureInfo) => {
                    if (featureInfo.getType() !== FeatureInfo.TYPE.route || !featureInfo.isOverlay) return false;
                    if (!featureInfo.validPoint()) return false;
                    return   !currentEditor.isHandling(featureInfo.getItemInfo());
                }
                additionalActions.push(new FeatureAction(
                    {
                        ...ButtonDefs.DBInsertRouteBefore,
                        onClick: (props) => {
                            insertOtherRoute(props.urlOrKey, props.point, true);
                        },
                        condition: (featureInfo) => routeActionCondition(featureInfo),
                        close: false
                    }
                ));
                if (currentEditor.getIndex() >= 0 && currentEditor.getPointAt()) {
                    additionalActions.push(new FeatureAction(
                        {
                            ...ButtonDefs.DBInsertRouteAfter,
                            onClick: (props) => {
                                insertOtherRoute(props.urlOrKey, props.point, false);
                            },
                            condition: (featureInfo) => routeActionCondition(featureInfo),
                            close: false
                        }));
                }
                additionalActions.push(hideAction);
                additionalActions.push(linkAction);
            }
            showDialog(dialogContext, (dprops) => <GuardedFeatureListDialog {...dprops}
                                                                    featureList={featureList}
                                                                    additionalActions={additionalActions}
                                                                    listActions={fromButton?[]:pointActions}/>)
            return true;
        }
    }

    const buttons = [
        {
            ...ButtonDefs.NavSelectChart,
            onClick: () => selectChartDialog(dialogContext)
        },
        {
            ...ButtonDefs.ZoomIn,
            onClick: () => {
                mapholder.changeZoom(1)
            }
        },
        {
            ...ButtonDefs.ZoomOut,
            onClick: () => {
                mapholder.changeZoom(-1)
            }
        },
        {
            ...ButtonDefs.NavAddAfter,
            onClick: () => {
                if (!checkRouteWritable(dialogContext)) return;
                const center = mapholder.getCenter();
                if (!center) return;
                const currentEditor = getCurrentEditor();
                const current = currentEditor.getPointAt();
                if (current) {
                    const distance = mapholder.pixelDistance(center, current);
                    if (distance < 8) return;
                }
                currentEditor.addWaypoint(center);
                setLastCenteredWp(currentEditor.getIndex());
            },
            editDisable: true
        },
        {
            ...ButtonDefs.NavAdd,
            onClick: () => {
                if (!checkRouteWritable(dialogContext)) return;
                const center = mapholder.getCenter();
                if (!center) return;
                const currentEditor = getCurrentEditor();
                const current = currentEditor.getPointAt();
                if (current) {
                    const distance = mapholder.pixelDistance(center, current);
                    if (distance < 8) return;
                }
                currentEditor.addWaypoint(center, true);
                setLastCenteredWp(currentEditor.getIndex());
            },
            editDisable: true
        },
        {
            ...ButtonDefs.NavDelete,
            onClick: () => {
                if (!checkRouteWritable(dialogContext)) return;
                getCurrentEditor().deleteWaypoint();
                const newIndex = getCurrentEditor().getIndex();
                const currentPoint = getCurrentEditor().getPointAt(newIndex);
                if (currentPoint) {
                    mapholder.setCenter(currentPoint);
                    setLastCenteredWp(newIndex);
                }
            },
            editDisable: true
        },
        {
            ...ButtonDefs.NavToCenter,
            onClick: () => {
                if (!checkRouteWritable(dialogContext)) return;
                const center = mapholder.getCenter();
                if (!center) return;
                const currentEditor = getCurrentEditor();
                currentEditor.changeSelectedWaypoint(center);
                setLastCenteredWp(currentEditor.getIndex());
            },
            overflow: true,
            editDisable: true
        },
        {
            ...ButtonDefs.NavGoto,
            onClick: () => {
                startRouting(dialogContext,undefined,history);
            },
            editDisable: true,
            overflow: true
        },
        {
            ...RawButtonDef,
            onClick:()=>createDialog(PAGENAME,
            MapPage.PANELS, [LAYOUT_OPTIONS.SMALL], dialogContext)
        },
        {
            ...ButtonDefs.NavActions,
            editDisable: true,
            onClick:()=>{
                showDialog(dialogContext,()=><ActionDialog
                    title={'Navigation tools'}
                    actionButtons={[
                    {
                        ...ButtonDefs.ABShowWpButtons,
                        onClick:()=>{
                            showWpButtons(!wpButtonsVisible)},
                        toggle: wpButtonsVisible,
                        visible: ! props.small
                    },
                    {
                        ...CenterActionButton,
                        close:false
                    },
                    {
                        ...ButtonDefs.GpsCenter,
                        onClick:()=>{
                            mapholder.centerToGps();

                        }
                    },
                    {
                        ...ButtonDefs.RouteMenu,
                        onClick: () => {
                            showRouteDialog();
                        },
                        close:false
                    },
                    {
                        ...ButtonDefs.StopNav,
                        onClick:()=>{
                            RouteHandler.routeOff();
                            mapholder.triggerRender();
                        },
                        editDisable: true,
                        overflow: true,
                        disabled: !activeRoute.hasActiveTarget(),
                        toggle: activeRoute.hasActiveTarget()
                    },

                ]}/>)
            }
        }
    ];
    return (
        <MapPage
            {...props}
            id={PAGENAME}
            mapEventCallback={mapEvent}
            onItemClick={widgetClick}
            panelCreator={getPanelList}
            buttonList={InjectMainMenu(PAGEIDS.ROUTE,updateButtons(GeneralWithCancel,{
                Cancel:{
                    onClick:()=>{ history.pop()}
                }
            }).concat(propsToDefs(buttons)))}
            overlayContent={<OverlayButtonDisplay buttons={
                (props.small || wpButtonsVisible)?
                    buildWaypointButtons(
                        dialogContext,
                        ()=>setWpButtonsVisible(false),
                        (last)=>setLastCenteredWp(last),
                        routeWritable,
                        props.small)
                    :
                    undefined
            }/>}
        />
    );
}


export default EditRoutePage;