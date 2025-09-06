/**
 * Created by andreas on 02.05.14.
 */

import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import MapPage, {overlayDialog} from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    DialogRow,
    showDialog,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
import Helper, {injectav, setav} from '../util/helper.js';
import {useTimer} from '../util/GuiHelpers.js';
import MapHolder, {LOCK_MODES} from '../map/mapholder.js';
import mapholder, {EventTypes} from '../map/mapholder.js';
import WayPointDialog, {updateWaypoint} from '../components/WaypointDialog.jsx';
import ButtonList from '../components/ButtonList.jsx';
import RouteEdit, {StateHelper} from '../nav/routeeditor.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import {CenterActionButton, GuardedFeatureListDialog, hideAction, linkAction} from "../components/FeatureInfoDialog";
import {Checkbox, InputReadOnly} from "../components/Inputs";
import DB from '../components/DialogButton';
import Formatter from "../util/formatter";
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";
import Page from "../components/Page";
import PropTypes from "prop-types";
import {useStore, useStoreState} from "../hoc/Dynamic";
import {ConfirmDialog, InfoItem, SelectList} from "../components/BasicDialogs";
import RoutePointsWidget from "../components/RoutePointsWidget";
import plugimage from '../images/icons-new/plug.svg';
import {ItemActions, ItemDownloadButton} from "../components/FileDialog";
import UploadHandler from "../components/UploadHandler";
import {FeatureAction, FeatureInfo} from "../map/featureInfo";
import {existsRoute, loadRoutes} from "../components/RouteInfoHelper";
import {checkName, ItemNameDialog} from "../components/ItemNameDialog";

const RouteHandler = NavHandler.getRoutingHandler();
const PAGENAME = "editroutepage";

const editor = new RouteEdit(RouteEdit.MODES.EDIT);
const activeRoute = new RouteEdit(RouteEdit.MODES.ACTIVE);




const isActiveRoute = (activeState,editorState) => {
    let activeName = StateHelper.routeName(activeState);
    if (activeName && activeName === StateHelper.routeName(editorState)) return true;
    return false;
};
const getCurrentEditor = () => {
    return isActiveRoute(activeRoute.getState(),editor.getState()) ? activeRoute : editor;
};

const startWaypointDialog = (item, index, dialogContext) => {
    if (!item) return;
    const wpChanged = (newWp) => {
        let changedWp = updateWaypoint(item, newWp, (err) => {
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            getCurrentEditor().changeSelectedWaypoint(changedWp, index);
            return true;
        }
        return false;
    };
    const canWrite=checkRouteWritable();
    let RenderDialog = function (props) {
        return <WayPointDialog
            {...props}
            readOnly={!canWrite}
            waypoint={item}
            okCallback={wpChanged}
            deleteCallback={()=>{
                getCurrentEditor().deleteWaypoint(index);
                return true;
            }}
            startCallback={()=>{
                startRouting(dialogContext,index);
                return true;
            }}
        />
    };
    showDialog(dialogContext, RenderDialog);
};

export const INFO_ROWS = [
    {label: 'points', value: 'numpoints'},
    {label: 'length', value: 'length', formatter: (v) => {
            return Formatter.formatDistance(v) + " nm";
        }
    },
];

const EditPointsDialog=(props)=>{
    if (!props.route) return null;
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [selected,setSelected]=useState(0);
    const [inverted,setInverted]=useState(props.inverted);
    const activeRouteState= useStore({storeKeys:activeRoute.getStoreKeys()});
    const isActiveRoute=useCallback(()=>{
        return route.name === StateHelper.routeName(activeRouteState)
    },[activeRouteState])
    const changeRoute = (cb) => {
        let newRoute = route.clone();
        if (cb(newRoute) !== false) {
            setRoute(newRoute);
            return newRoute;
        }
        return route;
    }
    const wpChanged = (oldWp,newWp,idx) => {
        let changedWp = updateWaypoint(oldWp, newWp, (err) => {
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            changeRoute((nr)=>{nr.points[idx]=changedWp})
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
            onClick={(item)=>{
                setSelected(item.idx);
                showDialog(dialogContext,()=><WayPointDialog
                    waypoint={item}
                    okCallback={(changedWp)=>{
                        return wpChanged(item,changedWp,item.idx);
                    }}
                    deleteCallback={active?undefined:(wp)=>{
                        changeRoute((nr)=>{
                            nr.deletePoint(wp.idx);
                        })
                        return true;
                    }}
                />);
            }}
        />
        <DialogButtons buttonList={[
            {
                name: "empty",
                onClick: () => {
                    let changed=changeRoute((nr) => {
                        nr.points = []
                    });
                    if (changed.points.length < 1) setInverted(false);
                },
                close: false,
                label: "Empty",
                visible: !active,
                disabled: route.points.length < 1,
            },
            {
                name: "invert",
                onClick: () => {
                    changeRoute((nr) => {
                        nr.swap()
                    })
                    setInverted(!inverted);
                },
                disabled: route.points.length < 1,
                close: false,
                label: "Invert"
            },
            {
                name:"renumber",
                onClick:()=>{
                    showPromiseDialog(dialogContext,(drops)=><ConfirmDialog {...drops} text={"All waypoint names will change"} title={"Renumber points?"}/> )
                        .then(()=>{
                            if (changeRoute((nr)=>{
                                nr.renumber(1);
                            })) setInverted(false);
                        },
                            ()=>{})
                },
                disabled: route.points.length < 1,
                close: false,
                label: "Renumber"
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
EditPointsDialog.propTypes={
    route: PropTypes.objectOf(routeobjects.Route).isRequired,
    resolveFunction: PropTypes.func,
    inverted: PropTypes.bool
}

const LoadRouteDialog=({blacklist,selectedName,resolveFunction,title,allowUpload})=>{
    const dialogContext=useDialogContext();
    const [connectedMode]=useStoreState(keys.properties.connectedMode);
    const [list,setList]=useState(undefined);
    const [wrOnly,setWrOnly]=useState(true);
    const [uploadSequence,setUploadSequence]=useState(0);
    const currentList=useRef([]);
    useEffect(() => {
        loadRoutes()
            .then((routeList)=>{
                let finalList=[];
                routeList.forEach((aroute)=>{
                   let name = aroute.name.replace(/\.gpx/, '');
                    //mark the route we had been editing on the page before
                    let selected = selectedName && selectedName === name;
                    //check with and without gpx extension
                    const hidden=(blacklist &&(blacklist.indexOf(aroute.name) >= 0 || blacklist.indexOf(name) >= 0));
                    finalList.push({
                        label: name,
                        value: name,
                        key: name,
                        name:name,
                        originalName: aroute.name,
                        selected: selected,
                        server: aroute.server,
                        icon: aroute.server?plugimage:undefined,
                        hidden: hidden
                    });
                })
                setList(finalList);
            })
            .catch(()=>{})
    }, []);
    let displayList=[];
    if (list) {
        list.forEach((item) => {
            if (item.hidden) return;
            let cl = "";
            if (item.server && !connectedMode) {
                if (wrOnly) return;
                cl = "readonly";
            }
            displayList.push({...item, className: cl})
        })
    }
    currentList.current=list;
    return <DialogFrame className={'LoadRoutesDialog'} title={title}>
        <Checkbox dialogRow={true} label={"writableOnly"} value={wrOnly} onChange={(nv)=>setWrOnly(nv)}/>
        {! list && <div className="loading">Loading...</div>}
        <SelectList
            list={displayList}
            onClick={(entry)=>{
                RouteHandler.fetchRoute(entry.originalName, !(entry.server && connectedMode) ,
                    (nroute) => {
                        if (!nroute) {
                            Toast("unable to load route " + entry.originalName);
                            return;
                        }
                        if (nroute.server != entry.server){
                            //strange situation:
                            //we have a local route that originally was a server route - but it is no longer
                            //available at the server - or we have a local route that is also available on the server
                            //so we try to correct
                            nroute.server=entry.server;
                        }
                        if (resolveFunction) resolveFunction(nroute.clone());
                        dialogContext.closeDialog();
                    },
                        (err)=>{Toast("unable to load route: "+err)});
            }}
            />
        <UploadHandler
            local={true}
            uploadSequence={uploadSequence}
            type={'route'}
            doneCallback={(data)=>{
                try {
                    const actions=ItemActions.create({type:'route'},connectedMode)
                    let nroute = new routeobjects.Route();
                    nroute.fromXml(data.data);
                    if (! nroute.name) {
                        nroute.setName(actions.nameForUpload(data.name));
                    }
                    const routeExists=(name)=> {
                        return checkName(name,currentList.current,(item)=>item.value+".gpx")
                    }
                    const name=actions.serverNameToClientName(nroute.name);
                    if (routeExists(name)) {
                        showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
                            {...dprops}
                            title={"route already exists, select new name"}
                            checkName={routeExists}
                            fixedExt={'gpx'}
                            iname={nroute.name}
                            />)
                            .then((res)=>{
                                nroute.setName(actions.nameForUpload(res.name));
                                if (resolveFunction) resolveFunction(nroute);
                                dialogContext.closeDialog();
                            })
                        return;
                    }
                    if (resolveFunction) resolveFunction(nroute);
                    dialogContext.closeDialog();
                }catch (e) {
                    Toast(e);
                }
            }}
            errorCallback={(err)=>Toast(err)}
            checkNameCallback={(name)=>{
                if(Helper.getExt(name) !== 'gpx') return {error:"only .gpx files"};
                return {name:name}
            }}
        />
        <DialogButtons buttonList={[
            {
                name:'upload',
                label:'Upload',
                onClick: ()=>setUploadSequence(uploadSequence+1),
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

const EditRouteDialog = (props) => {
    const activeRouteState=useStore({storeKeys: activeRoute.getStoreKeys()})
    const [saveMode,setSaveMode]=useState(RouteSaveModes.UPDATE);
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [inverted, setInverted] = useState(false);
    const [availableRoutes, setAvailableRoutes] = useState();
    const [connectedMode]=useStoreState(keys.properties.connectedMode)
    useEffect(() => {
        if (!props.route) return;
        loadRoutes()
            .then((routes) => {
                setAvailableRoutes(routes)
            });
    }, []);
    const isActiveRoute = useCallback(() => {
        let activeName = StateHelper.routeName(activeRouteState);
        return (activeName !== undefined && route.name === activeName);
    }, [activeRouteState]);
    const getCurrentEditor = useCallback(() => {
        return isActiveRoute() ? activeRoute : editor;
    }, []);
    if (!props.route) return null;
    const changeRoute = (cb) => {
        let newRoute = route.clone();
        if (cb(newRoute) !== false) {
            setRoute(newRoute);
            return newRoute;
        }
        return route;
    }
    const save = (cloned,rtSaveMode) => {
        let oldName = props.route.name;
        let oldServer = props.route.server;
        if (rtSaveMode === RouteSaveModes.NONE) return false;
        if (rtSaveMode === RouteSaveModes.UPDATE){
            const isActive=oldName === StateHelper.routeName(activeRouteState);
            const nameChanged=route.name !== oldName;
            if ( isActive && nameChanged){
                Toast("cannot rename active route");
                return false;
            }
            getCurrentEditor().setNewRoute(cloned,undefined,true);
            //the page must also know that we are now editing a different route
            editor.setNewRoute(cloned,undefined,true);
            if (nameChanged) {
                RouteHandler.deleteRoute(oldName,
                    () => {
                    },
                    (error) => {
                        Toast(error);
                    },
                    !oldServer
                )
            }
            return true;
        }
        if (rtSaveMode === RouteSaveModes.REPLACE_NEW || saveMode === RouteSaveModes.REPLACE_EXISTING){
            if (rtSaveMode === RouteSaveModes.REPLACE_NEW) {
                //we should never replace the currently active route with a newly created one
                //basically this should not be possible any way as the name dialog would prevent this
                //but: do a last check anyway
                if (cloned.name === StateHelper.routeName(activeRouteState)) {
                    Toast("unable to copy to active route");
                    return false;
                }
            }
            editor.setNewRoute(cloned,undefined,true);
            return true;
        }
        return false;
    }
    const deleteRoute = () => {
        if (isActiveRoute()) return;
        showPromiseDialog(dialogContext, (dprops)=><ConfirmDialog {...dprops} text={"Really delete route " + route.name}/>)
            .then(() => {
                RouteHandler.deleteRoute(route.name,
                    () => {
                        if (editor.getRouteName() === route.name) {
                            editor.removeRoute();
                        }
                        dialogContext.closeDialog();
                    },
                    (error) => {
                        Toast(error)
                    },
                    !route.server)

            })
            .catch(() => {
            })
    }
    const loadNewRoute = () => {
        showPromiseDialog(dialogContext,(props)=><LoadRouteDialog
            {...props}
            blacklist={[route.name]}
            selectedName={getCurrentEditor().getRouteName()}
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
    const nameDialog=(title)=>{
        const checkExisting=(name)=>{
            return checkName(name,availableRoutes,(item)=>item.name);
        }
        return showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
            {...dprops}
            iname={route.name}
            fixedExt={'gpx'}
            checkName={checkExisting}
            mandatory={true}
            title={title}
        />)
            .then((res)=>{
                const actions=ItemActions.create({type:'route'},connectedMode);
                return actions.nameForUpload(res.name);
            })
    }
    const writable= ! route.server || connectedMode;
    let canDelete = !isActiveRoute() && existsRoute(route.name,availableRoutes) && route.name !== DEFAULT_ROUTE && writable;
    let info = RouteHandler.getInfoFromRoute(route);
    return <DialogFrame className={Helper.concatsp("EditRouteDialog",isActiveRoute()?"activeRoute":undefined)} title={"Edit Route"}>
        <InputReadOnly
            dialogRow={true}
            label="name"
            value={route.name}
        >
        </InputReadOnly>
        {INFO_ROWS.map((description) => {
            return InfoItem.show(info, description);
        })}
        {inverted && <InfoItem
            label=""
            value="inverted"
        />}
        <InfoItem label={'server'} value={""+!!route.server}/>
        <InfoItem label={'writable'} value={""+writable}/>
        <DialogButtons>
            <DB name="new"
                onClick={() => {
                    nameDialog("Choose Route Name")
                        .then((newName)=>{
                            let newRoute=new routeobjects.Route();
                            newRoute.setName(newName);
                            newRoute.server=connectedMode;
                            setRoute(newRoute);
                            setInverted(false);
                            setSaveMode(RouteSaveModes.REPLACE_NEW);
                        },()=>{});
                }}
                close={false}
            >New</DB>
            < DB name="load"
                 onClick={loadNewRoute}
                 close={false}
            >Load</DB>
            <ItemDownloadButton
                item={{
                    type:'route',
                    name:route.name,
                    localData: ()=>route.toXml()
                }}
                name={'download'}
                useDialogButton={true}
            >Download</ItemDownloadButton>
            <DB name="edit"
                onClick={() => {
                    nameDialog("Choose New Name")
                        .then((newName)=>{
                            changeRoute((nr)=>{nr.setName(newName)})
                        },()=>{})
                }}
                close={false}
                disabled={! writable || (props.route.name === DEFAULT_ROUTE && saveMode === RouteSaveModes.UPDATE) || isActiveRoute()}
            >
                Rename
            </DB>
                <DB name="points"
                    onClick={() => {
                        showPromiseDialog(dialogContext,EditPointsDialog,{route:route,inverted:inverted})
                            .then((changed)=>{
                                setRoute(changed.route.clone());
                                setInverted(changed.inverted);
                            },()=>{})
                    }}
                    close={false}
                    disabled={!writable}
                >
                    Points
                </DB>
            <DB
                name={'StopNav'}
                onClick={()=>{
                    if (! isActiveRoute()) return;
                    RouteHandler.routeOff();
                    MapHolder.triggerRender();
                }}
                visible={isActiveRoute()}
                disabled={!writable}
                close={false}
            >Stop</DB>
        </DialogButtons>
        <DialogButtons>
            <DB name="delete"
                onClick={() => {
                    deleteRoute();
                }}
                close={false}
                disabled={!canDelete}
            >Delete</DB>
            <DB name="copy"
                onClick={() => {
                    nameDialog("Save As")
                        .then((newName)=>{
                            let changedRoute=changeRoute((nr)=>{nr.setName(newName)})
                            if (! connectedMode) changedRoute.server=false;
                            setSaveMode(RouteSaveModes.REPLACE_NEW); //just if something goes wrong during save and we do not close
                            if(save(changedRoute,RouteSaveModes.REPLACE_NEW)) dialogContext.closeDialog()
                        },()=>{})
                }}
                close={false}
            >
                Save As
            </DB>
            <DB name="cancel"
            >Cancel</DB>
            <DB name="ok"
                onClick={() => save(route.clone(),saveMode)}
                disabled={!route.differsTo(props.route) || (! writable && saveMode !== RouteSaveModes.REPLACE_EXISTING)}
            >
                Ok
            </DB>

        </DialogButtons>
    </DialogFrame>
}

EditRouteDialog.propTypes = {
    route: PropTypes.objectOf(routeobjects.Route).isRequired
}


const getPanelList = (panel) => {
    return LayoutHandler.getPanelData(PAGENAME, panel, LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.SMALL]));
};

const checkEmptyRoute = () => {
    if (!editor.hasRoute()) {
        RouteHandler.fetchRoute(DEFAULT_ROUTE, true, (route) => {
                editor.setRouteAndIndex(route, 0);
            },
            () => {
                let rt = new routeobjects.Route(DEFAULT_ROUTE);
                editor.setRouteAndIndex(rt, 0);
            });

    }
}

const startRouting=(dialogCtxRef,optIdx,opt_history)=>{
    //if (!checkRouteWritable()) return;
    stopAnchorWithConfirm(true,dialogCtxRef)
        .then(() => {
            RouteHandler.wpOn(getCurrentEditor().getPointAt(optIdx));
            if (opt_history) opt_history.pop();
        })
        .catch(() => {
        });
}

const checkRouteWritable = (dialogCtxRef) => {
    let currentEditor = getCurrentEditor();
    if (currentEditor.isRouteWritable()) return true;
    if (!dialogCtxRef) return false;
    showPromiseDialog(dialogCtxRef, (dprops)=><ConfirmDialog {...dprops} text={"you cannot edit this route as you are disconnected. OK to select a new name"}/>)
        .then(() => {
            showDialog(dialogCtxRef,(props)=><EditRouteDialog
                {...props}
                route={currentEditor.getRoute().clone()}
            />,()=>{
                checkEmptyRoute();
                MapHolder.triggerRender();
            })
        });
    return false;
};

const getTargetFromInfo=(featureInfo)=> {
    const target = featureInfo.point;
    return target;
}

const DEFAULT_ROUTE = "default";

const EditRoutePage = (props) => {
    const dialogCtxRef = useRef();
    const editorState=useStore({editor: activeRoute.getStoreKeys()});
    const activeState=useStore({storeKeys:activeRoute.getStoreKeys()})
    const [wpButtonsVisible, setWpButtonsVisible] = useState(false);
    const [lastCenteredWp, setLastCenteredWp] = useState();
    const [connectedMode]=useStoreState(keys.properties.connectedMode);
    const hasCentered = useRef(false);
    const showingActiveRoute=isActiveRoute(activeState,editorState);
    const routeWritable=!StateHelper.isServerRoute(showingActiveRoute?activeState:editorState) || connectedMode;
    const wpTimer = useTimer(() => {
        setWpButtonsVisible(false);
    }, globalStore.getData(keys.properties.wpButtonTimeout) * 1000);
    const showWpButtons = useCallback((on) => {
        if (on) wpTimer.startTimer();
        if (on === wpButtonsVisible) return;
        setWpButtonsVisible(on);
    }, [wpButtonsVisible]);
    const lastGpsLock = useRef();
    const lastBoatOffset=useRef();
    useEffect(() => {
        checkEmptyRoute();
        RouteHandler.setCurrentRoutePage(PAGENAME);
        MapHolder.setRoutingActive(true);
        MapHolder.showEditingRoute(true);
        MapHolder.leavePageAction();
        lastGpsLock.current = MapHolder.getGpsLock();
        lastBoatOffset.current=MapHolder.getBoatOffset();
        MapHolder.setGpsLock(LOCK_MODES.off,true);
        return () => {
            MapHolder.setRoutingActive(false);
            MapHolder.setBoatOffsetXY(lastBoatOffset.current);
            MapHolder.setGpsLock(lastGpsLock.current, true,false,true);
            RouteHandler.unsetCurrentRoutePage(PAGENAME);
        }
    }, []);

    const widgetClick = (ev) => {
        const av=injectav(ev);
        const item=av.avnav.item||{};
        const panel=av.avnav.panelName;
        const invertEditDirection=av.avnav.invertEditDirection;
        let currentEditor = getCurrentEditor();
        if (item.name === "EditRoute") {
            if (globalStore.getData(keys.gui.global.layoutEditing)) return;
            showDialog(dialogCtxRef, () => {
                return <EditRouteDialog
                    route={currentEditor.getRoute()?currentEditor.getRoute().clone():new routeobjects.Route('empty')}
                />
            },()=>{
                checkEmptyRoute();
                MapHolder.triggerRender();
            })
            return;
        }
        if (item.name === 'RoutePoints') {
            const point=av.avnav.point;
            if (LayoutHandler.isEditing()) return;
            if (point && point.idx !== undefined) {
                let lastSelected = currentEditor.getIndex();
                currentEditor.setNewIndex(point.idx);
                MapHolder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(point.idx);
                if (lastSelected === point.idx && lastCenteredWp === point.idx) {
                    startWaypointDialog(point, point.idx, dialogCtxRef);
                }
            }
            return;
        }
        if (LayoutHandler.isEditing()) {
            showDialog(dialogCtxRef, () => <EditWidgetDialogWithFunc
                widgetItem={item}
                pageWithOptions={PAGENAME}
                panelname={panel}
                opt_options={{beginning: invertEditDirection, types: ["!map"]}}
            />);
            return;
        }
        if (panel === 'bottomRight') {
            if (!globalStore.getData(keys.nav.gps.valid)) return;
            let boatPos = globalStore.getData(keys.nav.gps.position);
            MapHolder.setCenter(boatPos);
            return;
        }
        if (panel === 'bottomLeft') {
            showWpButtons(true)
        }

    };
    const waypointButtons = [
        {
            name: 'WpLocate',
            onClick: () => {
                wpTimer.startTimer();
                let currentEditor = getCurrentEditor();
                MapHolder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            }
        },
        {
            name: 'WpEdit',
            onClick: () => {
                wpTimer.startTimer();
                let currentEditor = getCurrentEditor();
                startWaypointDialog(currentEditor.getPointAt(), currentEditor.getIndex(), dialogCtxRef);
            },
            visible: routeWritable
        },
        {
            name: 'WpNext',
            storeKeys: getCurrentEditor().getStoreKeys(),
            updateFunction: (state) => {
                return {disabled: !StateHelper.hasPointAtOffset(state, 1)};
            },
            onClick: () => {
                wpTimer.startTimer();
                let currentEditor = getCurrentEditor();
                currentEditor.moveIndex(1);
                MapHolder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            },
            visible: routeWritable
        },
        {
            name: 'WpPrevious',
            storeKeys: getCurrentEditor().getStoreKeys(),
            updateFunction: (state) => {
                return {disabled: !StateHelper.hasPointAtOffset(state, -1)}
            },
            onClick: () => {
                wpTimer.startTimer();
                let currentEditor = getCurrentEditor();
                currentEditor.moveIndex(-1);
                MapHolder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(currentEditor.getIndex());
            },
            visible: routeWritable
        }
    ];

    const insertOtherRoute = (name, otherStart, opt_before) => {
        let editor = getCurrentEditor();
        let idx = editor.getIndex();
        let current = editor.getPointAt(idx);
        if (!otherStart) return;
        const runInsert = () => {
            RouteHandler.fetchRoute(name, false, (route) => {
                    if (!route.points) return;
                    let insertPoints = [];
                    let usePoints = false;
                    for (let i = 0; i < route.points.length; i++) {
                        if (route.points[i].compare(otherStart)) usePoints = true;
                        if (usePoints) insertPoints.push(route.points[i]);
                    }
                    editor.addMultipleWaypoints(insertPoints, opt_before);
                },
                (error) => {
                    Toast(error)
                }
            );
        }
        if (!current) return runInsert();
        let otherIndex = idx + (opt_before ? -1 : 1);
        let other = editor.getPointAt(otherIndex);
        let text, replace;
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
        showPromiseDialog(dialogCtxRef, (dprops)=><ConfirmDialog {...dprops} text={Helper.templateReplace(text, replace)}/>)
            .then(() => runInsert())
            .catch(() => {
            });
    }
    const pointActions=[new FeatureAction(
        {
            name: 'insert', label: 'Before', onClick: (info) => {
                const target = getTargetFromInfo(info);
                if (!target) return;
                let currentEditor = getCurrentEditor();
                MapHolder.setCenter(target);
                currentEditor.addWaypoint(target, true);
                setLastCenteredWp(currentEditor.getIndex());
            },
            condition: (featureInfo) => featureInfo.validPoint()
        }),
        new FeatureAction(
            {
                name: 'add', label: 'After', onClick: (info) => {
                    const target = getTargetFromInfo(info);
                    if (!target) return;
                    let currentEditor = getCurrentEditor();
                    MapHolder.setCenter(target);
                    currentEditor.addWaypoint(target);
                    setLastCenteredWp(currentEditor.getIndex());
                },
                condition: (featureInfo) => featureInfo.validPoint()
            }),
        new FeatureAction(
            {
                name: 'NavToCenter', label: 'Move', onClick: (info) => {
                    const target = getTargetFromInfo(info);
                    if (!target) return;
                    let currentEditor = getCurrentEditor();
                    MapHolder.setCenter(target);
                    currentEditor.changeSelectedWaypoint(target);
                    setLastCenteredWp(currentEditor.getIndex());
                },
                condition: (featureInfo) => featureInfo.validPoint()
            })
    ]

    const mapEvent = (evdata) => {
        //console.log("mapevent: "+evdata.type);
        let currentEditor = getCurrentEditor();
        if (evdata.type === EventTypes.LOAD || evdata.type === EventTypes.RELOAD) {
            if (hasCentered.current) return true;
            if (props.options && props.options.center) {
                if (currentEditor.hasRoute()) {
                    const index=currentEditor.getIndex();
                    let wp = currentEditor.getPointAt(index);
                    if (wp && index >= 0) {
                        setLastCenteredWp(index);
                        mapholder.setCenter(wp);
                    }
                }
            }
            hasCentered.current = true;
        }
        if (evdata.type === EventTypes.SELECTWP) {
            const currentIndex = currentEditor.getIndex();
            const newIndex = currentEditor.getIndexFromPoint(evdata.wp);
            if (currentIndex !== newIndex) currentEditor.setNewIndex(newIndex);
            else {
                startWaypointDialog(currentEditor.getPointAt(currentIndex), currentIndex, dialogCtxRef);
            }
            return true;
        }
        if (evdata.type === EventTypes.FEATURE) {
            let featureList = evdata.feature;
            const additionalActions = [];
            if (routeWritable) {
                additionalActions.push(...pointActions);
                const routeActionCondition = (featureInfo) => {
                    if (featureInfo.getType() !== FeatureInfo.TYPE.route || !featureInfo.isOverlay) return false;
                    if (!featureInfo.validPoint()) return false;
                    let routeName = featureInfo.urlOrKey;
                    return routeName && routeName.replace(/\.gpx$/, '') !== currentEditor.getRouteName();
                }
                additionalActions.push(new FeatureAction(
                    {
                        name: 'insert', label: 'RtBefore', onClick: (props) => {
                            insertOtherRoute(props.urlOrKey, props.point, true);
                        },
                        condition: (featureInfo) => routeActionCondition(featureInfo)
                    }
                ));
                if (currentEditor.getIndex() >= 0 && currentEditor.getPointAt()) {
                    additionalActions.push(new FeatureAction(
                        {
                            name: 'add', label: 'RtAter', onClick: (props) => {
                                insertOtherRoute(props.urlOrKey, props.point, false);
                            },
                            condition: (featureInfo) => routeActionCondition(featureInfo)
                        }));
                }
                additionalActions.push(hideAction);
                additionalActions.push(linkAction(props.history));
            }
            showDialog(dialogCtxRef, (dprops) => <GuardedFeatureListDialog {...dprops}
                                                                    history={props.history}
                                                                    featureList={featureList}
                                                                    additionalActions={additionalActions}
                                                                    listActions={pointActions}/>)
            return true;
        }
    }

    const buttons = [
        {
            name: "ZoomIn",
            onClick: () => {
                MapHolder.changeZoom(1)
            }
        },
        {
            name: "ZoomOut",
            onClick: () => {
                MapHolder.changeZoom(-1)
            }
        },
        {
            name: "NavAddAfter",
            onClick: () => {
                if (!checkRouteWritable(dialogCtxRef)) return;
                let center = MapHolder.getCenter();
                if (!center) return;
                let currentEditor = getCurrentEditor();
                let current = currentEditor.getPointAt();
                if (current) {
                    let distance = MapHolder.pixelDistance(center, current);
                    if (distance < 8) return;
                }
                currentEditor.addWaypoint(center);
                setLastCenteredWp(currentEditor.getIndex());
            },
            editDisable: true
        },
        {
            name: "NavAdd",
            onClick: () => {
                if (!checkRouteWritable(dialogCtxRef)) return;
                let center = MapHolder.getCenter();
                if (!center) return;
                let currentEditor = getCurrentEditor();
                let current = currentEditor.getPointAt();
                if (current) {
                    let distance = MapHolder.pixelDistance(center, current);
                    if (distance < 8) return;
                }
                currentEditor.addWaypoint(center, true);
                setLastCenteredWp(currentEditor.getIndex());
            },
            editDisable: true
        },
        {
            name: "NavDelete",
            onClick: () => {
                if (!checkRouteWritable(dialogCtxRef)) return;
                getCurrentEditor().deleteWaypoint();
                let newIndex = getCurrentEditor().getIndex();
                let currentPoint = getCurrentEditor().getPointAt(newIndex);
                if (currentPoint) {
                    MapHolder.setCenter(currentPoint);
                    setLastCenteredWp(newIndex);
                }
            },
            editDisable: true
        },
        {
            name: "NavToCenter",
            onClick: () => {
                if (!checkRouteWritable(dialogCtxRef)) return;
                let center = MapHolder.getCenter();
                if (!center) return;
                let currentEditor = getCurrentEditor();
                currentEditor.changeSelectedWaypoint(center);
                setLastCenteredWp(currentEditor.getIndex());
            },
            overflow: true,
            editDisable: true
        },
        {
            name: "NavGoto",
            onClick: () => {
                startRouting(dialogCtxRef,undefined,props.history);
            },
            editDisable: true,
            overflow: true
        },
        {
            name: 'StopNav',
            onClick:()=>{
                RouteHandler.routeOff();
                MapHolder.triggerRender();
            },
            editDisable: true,
            overflow: true,
            disabled: !activeRoute.hasActiveTarget(),
            toggle: activeRoute.hasActiveTarget()
        },
        {
            name: 'Menu',
            onClick: () => {
                widgetClick(setav(undefined,{item:{name: "EditRoute"}}))
            },
            overflow: true,
            editDisable: true
        },
        {
            name: "NavOverlays",
            onClick: () => overlayDialog(dialogCtxRef),
            overflow: true,
            storeKeys: {
                visible: keys.gui.capabilities.uploadOverlays
            }
        },
        CenterActionButton,
        Mob.mobDefinition(props.history),
        EditPageDialog.getButtonDef(PAGENAME,
            MapPage.PANELS, [LayoutHandler.OPTIONS.SMALL], dialogCtxRef),
        LayoutFinishedDialog.getButtonDef(undefined, dialogCtxRef),
        LayoutHandler.revertButtonDef((pageWithOptions) => {
            if (pageWithOptions.location !== props.location) {
                props.history.replace(pageWithOptions.location, pageWithOptions.options);
            }
        }),
        {
            name: 'Cancel',
            onClick: () => {
                props.history.pop()
            }
        }
    ];
    let overlayContent = (props.small || wpButtonsVisible) ?
        <ButtonList
            itemList={waypointButtons}
            className="overlayContainer"
        />
        :
        null;
    let pageProperties = Helper.filteredAssign(MapPage.propertyTypes, props);
    return (
        <MapPage
            {...pageProperties}
            id={PAGENAME}
            mapEventCallback={mapEvent}
            onItemClick={widgetClick}
            panelCreator={getPanelList}
            buttonList={buttons}
            overlayContent={overlayContent}
            dialogCtxRef={dialogCtxRef}
        />
    );
}
EditRoutePage.propTypes = {
    ...Page.pageProperties
}

export default EditRoutePage;