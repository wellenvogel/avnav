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
    DBCancel, DBOk,
    DialogButtons,
    DialogFrame, DialogRow,
    showDialog,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import {useTimer} from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import WayPointDialog, {updateWaypoint} from '../components/WaypointDialog.jsx';
import ButtonList from '../components/ButtonList.jsx';
import RouteEdit, {StateHelper} from '../nav/routeeditor.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {EditWidgetDialogWithFunc} from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import FeatureInfoDialog from "../components/FeatureInfoDialog";
import mapholder from "../map/mapholder.js";
import {InputReadOnly} from "../components/Inputs";
import DB from '../components/DialogButton';
import Formatter from "../util/formatter";
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";
import Page from "../components/Page";
import PropTypes from "prop-types";
import {useStore, useStoreState} from "../hoc/Dynamic";
import {ConfirmDialog, InfoItem, SelectDialog, ValueDialog} from "../components/BasicDialogs";
import ItemList from "../components/ItemList";
import RoutePointsWidget, {RoutePoint} from "../components/RoutePointsWidget";
import WayPointItem from "../components/WayPointItem";
import {useAvNavSortable} from "../hoc/Sortable";

const RouteHandler = NavHandler.getRoutingHandler();
const PAGENAME = "editroutepage";

const editor = new RouteEdit(RouteEdit.MODES.EDIT);
const activeRoute = new RouteEdit(RouteEdit.MODES.ACTIVE);

const isActiveRoute = () => {
    let activeName = activeRoute.getRouteName();
    if (activeName && activeName === editor.getRouteName()) return true;
    return false;
};
const getCurrentEditor = () => {
    return isActiveRoute() ? activeRoute : editor;
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
    let RenderDialog = function (props) {
        return <WayPointDialog
            {...props}
            waypoint={item}
            okCallback={wpChanged}/>
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

const loadRoutes = () => {
    return RouteHandler.listRoutes(true)
        .then((routes) => {
            routes.sort((a, b) => {
                let na = a.name ? a.name.toLowerCase() : undefined;
                let nb = b.name ? b.name.toLowerCase() : undefined;
                if (na < nb) return -1;
                if (na > nb) return 1;
                return 0;
            })
            return routes;
        })
        .catch((error) => {
            Toast(error)
        });
}

const EditPointsDialog=(props)=>{
    if (!props.route) return null;
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [selected,setSelected]=useState(0);
    const [inverted,setInverted]=useState(props.inverted);
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
    let info = RouteHandler.getInfoFromRoute(route);
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
                    deleteCallback={(wp)=>{
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
                label: "Empty"
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
                    showPromiseDialog(dialogContext,(drops)=><ConfirmDialog {...drops} text={"All waypoint names will change"} title={"Renumber points"}/> )
                        .then(()=>{
                            if (changeRoute((nr)=>{
                                nr.renumber();
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

const RouteSaveModes={
    NONE:0,
    UPDATE: 1, //if name changed: delete old editing
    REPLACE_EXISTING:2,  //after loading new route - do not delete old editing
    REPLACE_NEW:3 //replace with a new route - do not delete existing
}

const EditRouteDialog = (props) => {
    if (!props.route) return null;
    const activeRouteState=useStore({storeKeys: activeRoute.getStoreKeys()})
    const [saveMode,setSaveMode]=useState(RouteSaveModes.UPDATE);
    const dialogContext = useDialogContext();
    const [route, setRoute] = useState(props.route);
    const [inverted, setInverted] = useState(false);
    const [availableRoutes, setAvailableRoutes] = useState();
    const [connectedMode]=useStoreState(keys.properties.connectedMode)
    useEffect(() => {
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
    const existsRoute = (name) => {
        if (!availableRoutes) return false;
        if (Helper.getExt(name) !== 'gpx') name += '.gpx';
        for (let i = 0; i < availableRoutes.length; i++) {
            if (availableRoutes[i].name === name) return true;
        }
        return false;
    }
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
            getCurrentEditor().setNewRoute(cloned);
            //the page must also know that we are now editing a different route
            editor.setNewRoute(cloned);
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
            //if we had been editing the active this will change now
            //but there is no chance that we start editing the active with copy
            //as the name cannot exist already
            //do a last check anyway
            if (cloned.name === StateHelper.routeName(activeRouteState)){
                Toast("unable to copy to active route");
                return false;
            }
            if (cloned.server && ! connectedMode) {
                cloned.server = false;
            }
            editor.setNewRoute(cloned);
            return true;
        }
        return false;
    }
    const deleteRoute = () => {
        if (isActiveRoute()) return;
        showPromiseDialog(dialogContext, (dprops)=><ConfirmDialog {...dprops} text={"Really delete route " + props.route.name}/>)
            .then(() => {
                RouteHandler.deleteRoute(props.route.name,
                    () => {
                        if (editor.getRouteName() === props.route.name) {
                            editor.removeRoute();
                        }
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
    const loadNewRoute = () => {
        let finalList = [];
        availableRoutes.forEach((aroute) => {
            let name = aroute.name.replace(/\.gpx/, '');
            //mark the route we had been editing on the page before
            let selected = getCurrentEditor().getRouteName() === name;
            //check with and without gpx extension
            if (aroute.name === route.name || name === route.name) return;
            finalList.push({label: name, value: name, key: name, originalName: aroute.name, selected: selected});
        });
        showDialog(dialogContext, () => <SelectDialog
            title={"load route"}
            list={finalList}
            resolveFunction={(entry) => {
                if (entry.name === props.route.name) return;
                RouteHandler.fetchRoute(entry.originalName, false,
                    (nroute) => {
                        if (!nroute) {
                            Toast("unable to load route " + entry.originalName);
                            return;
                        }
                        setRoute(nroute.clone());
                        setInverted(false);
                        setSaveMode((nroute.name === props.route.name)?RouteSaveModes.UPDATE:RouteSaveModes.REPLACE_EXISTING);
                    },
                    (err) => Toast(err)
                )
            }}
        />);
    }
    const nameDialog=()=>{
        return showPromiseDialog(dialogContext,(dprops)=><ValueDialog
            {...dprops}
            title={"Select new name"}
            value={route.name}
            checkFunction={(newName)=>{
                if (newName === route.name) return "unchanged";
                if (existsRoute(newName)) return "already exists";
            }}/>)
    }
    let nameChanged = route.name !== props.route.name;
    let canDelete = !isActiveRoute() && !nameChanged && route.name !== DEFAULT_ROUTE;
    let info = RouteHandler.getInfoFromRoute(route);
    return <DialogFrame className="EditRouteDialog" title={"Edit Route"}>
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
        <DialogButtons>
            <DB name="new"
                onClick={() => {
                    nameDialog()
                        .then((newName)=>{
                            let newRoute=new routeobjects.Route();
                            newRoute.name=newName;
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
            <DB name="edit"
                onClick={() => {
                    nameDialog()
                        .then((newName)=>{
                            changeRoute((nr)=>{nr.name=newName})
                        },()=>{})
                }}
                close={false}
                disabled={props.route.name === DEFAULT_ROUTE && saveMode === RouteSaveModes.UPDATE}
            >
                Rename
            </DB>
                <DB name="edit"
                    onClick={() => {
                        showPromiseDialog(dialogContext,EditPointsDialog,{route:route,inverted:inverted})
                            .then((changed)=>{
                                setRoute(changed.route.clone());
                                setInverted(changed.inverted);
                            },()=>{})
                    }}
                    close={false}
                >
                    Points
                </DB>
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
                    nameDialog()
                        .then((newName)=>{
                            let changedRoute=changeRoute((nr)=>{nr.name=newName})
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
                disabled={!route.differsTo(props.route)}
            >
                Save
            </DB>

        </DialogButtons>
    </DialogFrame>
}

EditRouteDialog.propTypes = {
    route: PropTypes.objectOf(routeobjects.Route).isRequired,
    editAction: PropTypes.func
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


const DEFAULT_ROUTE = "default";

const EditRoutePage = (iprops) => {
    const dialogCtxRef = useRef();
    const props = useStore(iprops, {storeKeys: {activeRouteName: keys.nav.routeHandler.activeName}})
    const [wpButtonsVisible, setWpButtonsVisible] = useState(false);
    const [lastCenteredWp, setLastCenteredWp] = useState();
    const hasCentered = useRef(false);
    const wpTimer = useTimer(() => {
        setWpButtonsVisible(false);
    }, globalStore.getData(keys.properties.wpButtonTimeout) * 1000);
    const showWpButtons = useCallback((on) => {
        if (on) wpTimer.startTimer();
        if (on === wpButtonsVisible) return;
        setWpButtonsVisible(on);
    }, [wpButtonsVisible]);
    const lastGpsLock = useRef();
    useEffect(() => {
        checkEmptyRoute();
        RouteHandler.setCurrentRoutePage(PAGENAME);
        MapHolder.setRoutingActive(true);
        MapHolder.showEditingRoute(true);
        lastGpsLock.current = MapHolder.getGpsLock();
        MapHolder.setGpsLock(false);
        return () => {
            MapHolder.setRoutingActive(false);
            MapHolder.setGpsLock(lastGpsLock.current, true);
            RouteHandler.unsetCurrentRoutePage(PAGENAME);
        }
    }, []);

    const checkRouteWritable = useCallback((opt_noDialog) => {
        let currentEditor = getCurrentEditor();
        if (currentEditor.isRouteWritable()) return true;
        if (opt_noDialog) return false;
        showPromiseDialog(dialogCtxRef, (dprops)=><ConfirmDialog {...dprops} text={"you cannot edit this route as you are disconnected. OK to select a new name"}/>)
            .then(() => {
                currentEditor.syncTo(RouteEdit.MODES.PAGE);
                props.history.push('routepage');
            });
        return false;
    }, []);
    const widgetClick = (item, data, panel, invertEditDirection) => {
        let currentEditor = getCurrentEditor();
        if (item.name === "EditRoute") {
            if (globalStore.getData(keys.gui.global.layoutEditing)) return;
            showDialog(dialogCtxRef, () => {
                return <EditRouteDialog
                    route={currentEditor.getRoute()?currentEditor.getRoute().clone():new routeobjects.Route('empty')}
                    editAction={() => {
                        currentEditor.syncTo(RouteEdit.MODES.PAGE);
                        props.history.push("routepage");
                    }}
                />
            },checkEmptyRoute)
            return;
        }
        if (item.name === 'RoutePoints') {
            if (LayoutHandler.isEditing()) return;
            if (data && data.idx !== undefined) {
                let lastSelected = currentEditor.getIndex();
                currentEditor.setNewIndex(data.idx);
                MapHolder.setCenter(currentEditor.getPointAt());
                setLastCenteredWp(data.idx);
                if (lastSelected === data.idx && lastCenteredWp === data.idx) {
                    startWaypointDialog(data, data.idx, dialogCtxRef);
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
            }
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
            }
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
            }
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
    const mapEvent = (evdata) => {
        //console.log("mapevent: "+evdata.type);
        let currentEditor = getCurrentEditor();
        if (evdata.type === MapHolder.EventTypes.LOAD || evdata.type === MapHolder.EventTypes.RELOAD) {
            if (hasCentered.current) return true;
            if (props.options && props.options.center) {
                if (editor.hasRoute()) {
                    let wp = editor.getPointAt();
                    if (wp) {
                        setLastCenteredWp(wp.index);
                        mapholder.setCenter(wp);
                    }
                }
            }
            hasCentered.current = true;
        }
        if (evdata.type === MapHolder.EventTypes.SELECTWP) {
            currentEditor.setNewIndex(currentEditor.getIndexFromPoint(evdata.wp));
            return true;
        }
        if (evdata.type === MapHolder.EventTypes.FEATURE) {
            let feature = evdata.feature;
            if (!feature) return;
            if (feature.nextTarget && checkRouteWritable(true)) {
                feature.additionalActions = [
                    {
                        name: 'insert', label: 'Before', onClick: () => {
                            let currentEditor = getCurrentEditor();
                            let target = new navobjects.WayPoint(
                                feature.nextTarget[0],
                                feature.nextTarget[1],
                                feature.name
                            )
                            MapHolder.setCenter(target);
                            currentEditor.addWaypoint(target, true);
                            setLastCenteredWp(currentEditor.getIndex());
                        }
                    },
                    {
                        name: 'add', label: 'After', onClick: () => {
                            let currentEditor = getCurrentEditor();
                            let target = new navobjects.WayPoint(
                                feature.nextTarget[0],
                                feature.nextTarget[1],
                                feature.name
                            )
                            MapHolder.setCenter(target);
                            currentEditor.addWaypoint(target);
                            setLastCenteredWp(currentEditor.getIndex());
                        }
                    },
                    {
                        name: 'center', label: 'Center', onClick: () => {
                            let currentEditor = getCurrentEditor();
                            let target = new navobjects.WayPoint(
                                feature.nextTarget[0],
                                feature.nextTarget[1],
                                feature.name
                            )
                            MapHolder.setCenter(target);
                            currentEditor.changeSelectedWaypoint(target);
                            setLastCenteredWp(currentEditor.getIndex());
                        }
                    }
                ]
            }
            if (feature.overlayType === 'route') {
                let routeName = feature.overlayName;
                if (routeName && routeName.replace(/\.gpx$/, '') !== currentEditor.getRouteName() &&
                    checkRouteWritable(true)
                ) {
                    feature.additionalActions = [
                        {
                            name: 'insert', label: 'Before', onClick: (props) => {
                                insertOtherRoute(feature.overlayName, props.routeTarget, true);
                            },
                            condition: (props) => props.routeTarget
                        }
                    ];
                    if (currentEditor.getIndex() >= 0 && currentEditor.getPointAt()) {
                        feature.additionalActions.push(
                            {
                                name: 'add', label: 'Ater', onClick: (props) => {
                                    insertOtherRoute(feature.overlayName, props.routeTarget, false);
                                },
                                condition: (props) => props.routeTarget
                            });
                    }
                }
            }
            showDialog(dialogCtxRef, () => <FeatureInfoDialog history={props.history} {...feature}/>)
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
                if (!checkRouteWritable()) return;
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
                if (!checkRouteWritable()) return;
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
                if (!checkRouteWritable()) return;
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
                if (!checkRouteWritable()) return;
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
                if (!checkRouteWritable()) return;
                stopAnchorWithConfirm(true)
                    .then(() => {
                        RouteHandler.wpOn(getCurrentEditor().getPointAt());
                        props.history.pop();
                    })
                    .catch(() => {
                    });
            },
            editDisable: true,
            overflow: true
        },
        {
            name: 'Menu',
            onClick: () => {
                widgetClick({name: "EditRoute"})
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
        />
    );
}
EditRoutePage.propTypes = {
    ...Page.pageProperties
}

export default EditRoutePage;