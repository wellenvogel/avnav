/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper,PropertyType} from '../util/keys.jsx';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import assign from 'object-assign';
import {
    DBCancel,
    DialogButtons,
    DialogFrame, DialogText,
    showDialog,
    showPromiseDialog
} from '../components/OverlayDialog.jsx';
import LayoutHandler, {layoutLoader} from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {InputSelect, InputReadOnly} from '../components/Inputs.jsx';
import DimHandler from '../util/dimhandler';
import FullScreen from '../components/Fullscreen';
import {useStateObject} from "../util/GuiHelpers";
import Formatter from "../util/formatter";
import PropertyHandler from '../util/propertyhandler';
import {createItemActions, ItemActions} from "../components/FileDialog";
import loadSettings from "../components/LoadSettingsDialog";
import propertyhandler from "../util/propertyhandler";
import LocalStorage from '../util/localStorageManager';
import leavehandler from "../util/leavehandler";
import {ConfirmDialog} from "../components/BasicDialogs";
import {checkName, ItemNameDialog} from "../components/ItemNameDialog";
import Helper, {avitem} from "../util/helper";
import {
    default as EditableParameterUIFactory,
    EditableParameterListUI,
    getCommonParam
} from "../components/EditableParameterUI";
import {EditableStringParameterBase} from "../util/EditableParameter";
import Button from "../components/Button";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";

const settingsSections={
    Layer:      [keys.properties.layers.base,keys.properties.layers.ais,keys.properties.layers.track,keys.properties.layers.nav,keys.properties.layers.boat,
        keys.properties.layers.grid,keys.properties.layers.compass,keys.properties.layers.scale,
        keys.properties.layers.user],
    UpdateTimes:[keys.properties.positionQueryTimeout,keys.properties.trackQueryTimeout,keys.properties.aisQueryTimeout, keys.properties.networkTimeout ,
                keys.properties.connectionLostAlarm],
    Widgets:    [keys.properties.widgetFontSize,keys.properties.allowTwoWidgetRows],
    Buttons:    [keys.properties.style.buttonSize,keys.properties.cancelTop,keys.properties.buttonCols,keys.properties.showDimButton,keys.properties.showFullScreen,
        keys.properties.hideButtonTime,keys.properties.showButtonShade, keys.properties.autoHideNavPage,keys.properties.autoHideGpsPage,keys.properties.nightModeNavPage,
        keys.properties.showSplitButton],
    Layout:     [keys.properties.layoutName,keys.properties.baseFontSize,keys.properties.smallBreak,keys.properties.nightFade,
        keys.properties.nightChartFade,keys.properties.dimFade,keys.properties.localAlarmSound,keys.properties.alarmVolume ,
        keys.properties.titleIcons, keys.properties.titleIconsGps, keys.properties.startLastSplit,
        keys.properties.autoUpdateUserCss],
    AIS:        [keys.properties.aisDistance,keys.properties.aisCenterMode,keys.properties.aisWarningCpa,keys.properties.aisWarningTpa,
        keys.properties.aisShowEstimated,keys.properties.aisEstimatedOpacity,keys.properties.aisCpaEstimated,
        keys.properties.aisMinDisplaySpeed,keys.properties.aisOnlyShowMoving,
        keys.properties.aisFirstLabel,keys.properties.aisSecondLabel,keys.properties.aisThirdLabel,
        keys.properties.aisTextSize,keys.properties.aisUseCourseVector,keys.properties.aisCurvedVectors,keys.properties.aisRelativeMotionVectorRange,keys.properties.style.aisNormalColor,
        keys.properties.style.aisNearestColor, keys.properties.style.aisWarningColor,keys.properties.style.aisTrackingColor,
        keys.properties.aisIconBorderWidth,keys.properties.aisIconScale,keys.properties.aisClassbShrink,keys.properties.aisShowA,
        keys.properties.aisShowB,keys.properties.aisShowOther,keys.properties.aisUseHeading,
        keys.properties.aisReducedList,keys.properties.aisListUpdateTime, keys.properties.aisHideTime, keys.properties.aisLostTime,
        keys.properties.aisMarkAllWarning,keys.properties.aisShowErrors],
    Navigation: [keys.properties.bearingColor,keys.properties.bearingWidth,keys.properties.navCircleColor,keys.properties.navCircleWidth,keys.properties.navCircle1Radius,keys.properties.navCircle2Radius,keys.properties.navCircle3Radius,
        keys.properties.navBoatCourseTime,keys.properties.boatIconScale,keys.properties.boatDirectionMode,
        keys.properties.boatDirectionVector,keys.properties.boatSteadyDetect,keys.properties.boatSteadyMax,
        keys.properties.courseAverageTolerance,keys.properties.courseAverageInterval,keys.properties.speedAverageInterval,keys.properties.positionAverageInterval,keys.properties.anchorWatchDefault,keys.properties.anchorCircleWidth,
        keys.properties.anchorCircleColor,keys.properties.measureColor,keys.properties.measureRhumbLine],
    Map:        [
        keys.properties.startNavPage,
        keys.properties.autoZoom,keys.properties.mobMinZoom,keys.properties.style.useHdpi,
        keys.properties.clickTolerance,keys.properties.featureInfo,
        keys.properties.mapFloat,keys.properties.mapScale,keys.properties.mapUpZoom,
        keys.properties.mapOnlineUpZoom,
        keys.properties.mapLockMode,keys.properties.mapLockMove,keys.properties.mapAlwaysCenter,keys.properties.mapScaleBarText,keys.properties.mapZoomLock,
        keys.properties.fontBase,keys.properties.fontColor,keys.properties.fontShadowWidth,keys.properties.fontShadowColor
    ],
    Track:      [keys.properties.trackColor,keys.properties.trackWidth,keys.properties.trackInterval,keys.properties.initialTrackLength],
    Route:      [keys.properties.routeColor,keys.properties.routeWidth,keys.properties.routeWpSize,keys.properties.routingTextSize,keys.properties.routeApproach,keys.properties.routeShowLL],
    Remote:     [keys.properties.remoteChannelName,keys.properties.remoteChannelRead,keys.properties.remoteChannelWrite,keys.properties.remoteGuardTime]
};

const settingsConditions={
};

settingsConditions[keys.properties.dimFade]=()=>DimHandler.canHandle();
settingsConditions[keys.properties.showDimButton]=()=>DimHandler.canHandle();
settingsConditions[keys.properties.showFullScreen]=()=>FullScreen.fullScreenAvailable();
settingsConditions[keys.properties.boatDirectionVector]=(values)=>{
    let cur=(values||{})
    return cur[keys.properties.boatDirectionMode]!== 'cog';
}
settingsConditions[keys.properties.aisCpaEstimated]=(values)=>
    (values||{})[keys.properties.aisShowEstimated]
settingsConditions[keys.properties.aisMinDisplaySpeed]=(values)=>
    (values||{})[keys.properties.aisOnlyShowMoving]||(values||{})[keys.properties.aisShowEstimated]
settingsConditions[keys.properties.aisEstimatedOpacity]=(values)=>
    (values||{})[keys.properties.aisShowEstimated]
settingsConditions[keys.properties.aisCpaEstimated]=(values)=>
    (values||{})[keys.properties.aisShowEstimated]
settingsConditions[keys.properties.boatSteadyMax]=(values)=>
    (values||{})[keys.properties.boatSteadyDetect]
const sectionConditions={};
sectionConditions.Remote=()=>globalStore.getData(keys.gui.capabilities.remoteChannel) && window.WebSocket !== undefined;



const SectionItem=(props)=>{
    let className=(props.className||"")+" listEntry";
    if (props.activeItem) className+=" activeEntry";
    return(
        <div className={className} onClick={props.onClick}>{props.name}</div>
    );
};

class LayoutParameterUI extends EditableStringParameterBase{
    constructor(props) {
        super(props,props.type,true);
        this.render=this.render.bind(this);
        Object.freeze(this);
    }
    render({currentValues,initialValues,className,onChange,children}){
        const isEditing=()=>{
            Toast("cannot change layout during editing");
        }
        if (LayoutHandler.isEditing()){
            return <InputReadOnly
                {...getCommonParam({ep:this,currentValues,className,initialValues,children})}
                value={LayoutHandler.name}
                onClick={isEditing}
            />
        }
        const changeFunction=(newVal)=>{
            if (LayoutHandler.isEditing()) {
                isEditing();
                return;
            }
            onChange(this.setValue(undefined, newVal.value));
        };
        const changeWithCheck=(newVal)=>{
            if (LayoutHandler.isEditing()) {
                isEditing();
                return;
            }
            onChange(newVal);
        }
        return <InputSelect
            {...getCommonParam({ep:this,currentValues,className,initialValues,onChange:changeWithCheck,children})}
            onChange={changeFunction}
            itemList={(currentLayout)=>{
                    return layoutLoader.listLayouts()
                        .then((list)=>{
                            let displayList=[];
                            list.forEach((el)=>{
                                let le={label:el.name,value:el.name};
                                if (currentLayout === el.name ) le.selected=true;
                                displayList.push(le);
                            });
                            return displayList;
                        })}
            }
            />
    }
}

const itemUiFromPlain=(item)=>{
    if (item.type === PropertyType.LAYOUT){
        return new LayoutParameterUI({type: item.type,
            default: item.defaultv,
            list: item.values,
            displayName: item.label,
            name:item.name,
            description: item.description
        })
    }
    let rt=EditableParameterUIFactory.createEditableParameterUI({
        type: item.type,
        default: item.defaultv,
        list: item.values,
        displayName: item.label,
        name:item.name,
        description: item.description
    })
    return rt;
}


const HasChangesDialog=({resolveFunction})=>{
    return <DialogFrame>
        <DialogText>Settings changed</DialogText>
        <DialogButtons
            buttonList={[
                DBCancel(),
                {
                    name:'delete',
                    label:'Discard',
                    onClick: ()=>{
                        resolveFunction(false);
                    }
                },
                {
                    name:'SettingsOK',
                    label:'Activate',
                    onClick: ()=>{
                        resolveFunction(true);
                    }
                }
            ]}
        />
    </DialogFrame>
}

const SettingsPage = (props) => {
    const history=useHistory();
    const [leftPanelVisible, setLeftPanelVisible] = React.useState(true);
    const [section, setSection] = useState('Layer');
    const flattenedKeys = useRef(undefined);
    if (!flattenedKeys.current) {
        flattenedKeys.current = KeyHelper.flattenedKeys(keys.properties);
    }
    const initialValues = useRef();
    if (!initialValues.current) {
        initialValues.current = globalStore.getMultiple(flattenedKeys.current, true);
    }
    const values = useStateObject(initialValues.current);
    const layoutSettings = useStateObject(LayoutHandler.getLayoutProperties());
    const defaultValues = useRef(undefined);
    if (!defaultValues.current) {
        defaultValues.current = {};
        flattenedKeys.current.forEach((key) => {
            let description = KeyHelper.getKeyDescriptions()[key];
            if (description) {
                defaultValues.current[key] = description.defaultv;
            }
        })
    }
    const renderItemCache = useRef({});
    const hasChanges = () => {
        return values.isChanged() || layoutSettings.isChanged();
    }
    const handlePanel = useCallback((section) => {
        if (section === undefined) {
            setLeftPanelVisible(true);
        } else {
            setLeftPanelVisible(!props.small);
            setSection(section);
        }
    }, [props.small]);
    const resetChanges = useCallback(() => {
        initialValues.current = globalStore.getMultiple(flattenedKeys.current, true);
        values.reset(initialValues.current);
        layoutSettings.reset(LayoutHandler.getLayoutProperties());
    }, []);
    const saveChanges = useCallback(() => {
        if (!hasChanges()) return Promise.resolve(true);
        let val = values.getState(true);
        //if the layout changed we need to set it
        const layoutName = val[keys.properties.layoutName];
        const finish = () => {
            if (LayoutHandler.isEditing()) {
                if (layoutSettings.isChanged()) {
                    LayoutHandler.updateLayoutProperties(layoutSettings.getState(true));
                }
            } else {
                LayoutHandler.activateLayout();
                globalStore.storeMultiple(val);
            }
            resetChanges();
            return true;
        }
        if (!LayoutHandler.hasLoaded(layoutName) && !LayoutHandler.isEditing()) {
            return layoutLoader.loadLayout(layoutName)
                .then((layout) => {
                    LayoutHandler.setLayoutAndName(layout, layoutName)
                    return finish();
                })
        }
        return Promise.resolve(finish());
    }, []);

    /**
     * will check for changes and revert or save changes
     * @returns {Promise}
     */
    const confirmAbortOrDo = useCallback((allowSave) => {
        if (hasChanges()) {
            if (allowSave) {
                return showPromiseDialog(undefined, (props) => <HasChangesDialog {...props} />)
                    .then((save) => {
                        if (save) {
                            return saveChanges();
                        } else {
                            resetChanges();
                            return true;
                        }
                    })
            } else {
                return showPromiseDialog(undefined, (props) => <ConfirmDialog {...props}
                                                                              text={"discard settings changes?"}/>)
            }
        } else {
            return Promise.resolve(0);
        }
    }, []);

    const saveSettings = useCallback(() => {
        let actions = createItemActions({type:'settings'});
        let oldName = actions.nameToBaseName(globalStore.getData(keys.properties.lastLoadedName)).replace(/-*[0-9]*$/, '');
        let suffix = Formatter.formatDateTime(new Date()).replace(/[: /]/g, '').replace(/--/g, '');
        let proposedName = oldName + "-" + suffix;
        PropertyHandler.listSettings()
            .then((settings) => {
                const checkFunction = (newName) => {
                    return checkName(newName, settings, actions.nameForCheck,true,true);
                }
                return showPromiseDialog(undefined, (dprops) => <ItemNameDialog
                    {...dprops}
                    fixedPrefix={'user.'}
                    title={"Select Name to save settings"}
                    iname={proposedName}
                    checkName={checkFunction}
                />)
                    .then((res) => res.name)
            })
            .then((settingsName) => {
                if (!settingsName || settingsName === 'user.') {
                    return Promise.reject();
                }
                proposedName = settingsName;
                return PropertyHandler.uploadSettingsData(
                    proposedName,
                    PropertyHandler.exportSettings(values.getState(true)),
                    true
                )
            })
            .then((res) => {
                globalStore.storeData(keys.properties.lastLoadedName, proposedName);
                Toast("settings saved");
            })
            .catch((e) => {
                if (e) Toast(e);
            })

    }, []);
    const loadSettingsCb = useCallback(() => {
        loadSettings(values.getState(), globalStore.getData(keys.properties.lastLoadedName))
            .then((settings) => values.setState(settings, true))
            .catch((e) => {
                if (e) Toast(e);
            })
    }, []);

    const buttons = useMemo(() => {
        return [
            {
                name: 'SettingsOK',
                onClick: () => {
                    if (!leftPanelVisible) {
                        handlePanel(undefined);
                        return;
                    }
                    saveChanges()
                        .then(() => history.pop())
                        .catch((err) => {
                            Toast(err + "")
                        })
                }
            },
            {
                name: 'SettingsDefaults',
                onClick: () => {
                    confirmAbortOrDo(false).then(() => {
                        resetData();
                    });
                }
            },
            {
                name: 'SettingsSplitReset',
                storeKeys: {
                    editing: keys.gui.global.layoutEditing
                },
                updateFunction: (state) => {
                    return {visible: !state.editing && LocalStorage.hasPrefix()}
                },
                onClick: () => {
                    let masterValues = propertyhandler.getMasterValues();
                    let promises = [];
                    for (let key in masterValues) {
                        let description = KeyHelper.getKeyDescriptions()[key];
                        if (description.type === PropertyType.LAYOUT) {
                            promises.push(layoutLoader.loadLayout(masterValues[key]));
                        }
                    }
                    Promise.all(promises)
                        .then(() => values.setState(masterValues))
                        .catch((e) => Toast(e));
                },
                overflow: true
            },
            {
                name: 'SettingsAndroid',
                visible: globalStore.getData(keys.gui.global.onAndroid, false),
                onClick: () => {
                    confirmAbortOrDo(true).then(() => {
                        history.pop();
                        avnav.android.showSettings();
                    });
                }
            },
            {
                name: 'SettingsLayout',
                onClick: () => {
                    handleLayoutClick();
                },
                updateFunction: (state) => {
                    return {
                        toggle: state.toggle,
                        visible: !state.cap || state.con
                    }
                },
                storeKeys: {
                    toggle: keys.gui.global.layoutEditing,
                    cap: keys.gui.capabilities.uploadLayout,
                    con: keys.properties.connectedMode
                }
            },
            {
                name: 'SettingsAddons',
                onClick: () => {
                    confirmAbortOrDo(true).then(() => {
                        history.push("addonconfigpage");
                    });
                },
                storeKeys: {
                    visible: keys.properties.connectedMode
                }
            },
            {
                name: 'SettingsSave',
                onClick: () => saveSettings(),
                storeKeys: {
                    editing: keys.gui.global.layoutEditing,
                    connected: keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction: (state) => {
                    return {
                        visible: !state.editing && state.connected && state.allowed
                    }
                },
                overflow: true
            },
            {
                name: 'SettingsLoad',
                onClick: () => {
                    confirmAbortOrDo().then(() => {
                        resetChanges();
                        loadSettingsCb();
                    });
                },
                storeKeys: {
                    editing: keys.gui.global.layoutEditing,
                    connected: keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction: (state) => {
                    return {
                        visible: !state.editing && state.connected && state.allowed
                    }
                },
                overflow: true
            },
            {
                name: 'SettingsReload',
                onClick: () => {
                    confirmAbortOrDo(true).then(() => {
                        leavehandler.stop();
                        Helper.reloadPage();
                    });
                },
                storeKeys: {
                    visible: keys.gui.global.layoutEditing,
                },
                updateFunction: (state) => {
                    return {
                        visible: !state.visible
                    }
                },
            },
            Mob.mobDefinition(history),
            {
                name: 'Cancel',
                onClick: () => {
                    if (!leftPanelVisible) {
                        handlePanel(undefined);
                        return;
                    }
                    confirmAbortOrDo(false).then(() => {
                        history.pop();
                    });
                }
            }
        ]
    }, [leftPanelVisible]);
    const changeItem = useCallback((key, value) => {
        if (LayoutHandler.isEditing()) {
            layoutSettings.setValue(key, value);
        } else {
            if (key in layoutSettings.getState()) {
                Toast("cannot change layout settings when not editing");
                return;
            }
            values.setValue(key, value);
            if (key === keys.properties.layoutName) {
                layoutLoader.loadLayout(value)
                    .then((layout) => {
                        const newLayoutSettings = LayoutHandler.getLayoutProperties(layout);
                        layoutSettings.setState(newLayoutSettings, true);
                    })
                    .catch((e) => {
                        Toast(e + "")
                    })
            }
        }
    }, []);

    //show the left panel when changing from small to not small
    const lastSmall = useRef(props.small);
    useEffect(() => {
        if (props.small !== lastSmall.current) {
            if (lastSmall.current && !leftPanelVisible) {
                setLeftPanelVisible(true);
            }
            lastSmall.current = props.small;
        } else {
            if (!props.small && !leftPanelVisible) {
                setLeftPanelVisible(true);
            }
        }
    }, [props.small, leftPanelVisible]);

    const handleLayoutClick = useCallback(() => {
        let isEditing = LayoutHandler.isEditing();
        if (!isEditing) {
            let startDialog = () => {
                layoutLoader.listLayouts()
                    .then((list) => {
                        const currentName = LayoutHandler.getName();
                        const itemActions=createItemActions({type:'layout'});
                        showPromiseDialog(undefined, (dprops) => <ItemNameDialog
                            {...dprops}
                            title={"Start Layout Editor"}
                            iname={itemActions.nameToBaseName(LayoutHandler.name)}
                            fixedPrefix={'user.'}
                            checkName={(newName) => {
                                    if (!newName) {
                                        return {
                                            error: 'name must not be empty',
                                            proposal: itemActions.nameToBaseName(LayoutHandler.name)
                                        }
                                    }
                                    if (newName.indexOf('.') >= 0) {
                                        return {
                                            error: 'names must not contain a .',
                                            proposal: newName.replace(/\./g, '')
                                        }
                                    }
                                let cr = checkName(newName, undefined, undefined);
                                if (cr) return cr;
                                cr = checkName(newName, list,itemActions.nameForCheck );
                                if (cr) {
                                    if ((layoutLoader.getUserPrefix()+newName) === currentName) {
                                        return {
                                            info: "existing"
                                        }
                                    } else {
                                        return cr;
                                    }
                                } else {
                                    return {
                                        info: "new"
                                    }
                                }
                            }}
                        />)
                            .then((res) => {
                                LayoutHandler.startEditing(layoutLoader.getUserPrefix()+res.name);
                                history.pop();
                            })
                            .catch(() => {
                            })
                    })
                    .catch((error) => {
                        Toast("cannot start layout editing: " + error)
                    });
            };
            if (!hasChanges()) {
                startDialog();
                return;
            }
            confirmAbortOrDo(true).then(() => {
                startDialog();
            }).catch(() => {
            });
        } else {
            const dialog = () => showDialog(undefined,
                () => <LayoutFinishedDialog finishCallback={() => {
                    //potentially we did fallback to the old layout
                    layoutSettings.reset(LayoutHandler.getLayoutProperties());
                }}/>)
            if (!hasChanges()) {
                dialog();
                return;
            }
            confirmAbortOrDo(true).then(() => {
                dialog();
            }, () => {
            })
        }
    }, []);

    const resetData = useCallback(() => {
        if (LayoutHandler.isEditing()) {
            layoutSettings.setState({}, true);
        } else {
            const oldLayoutName = values.getValue(keys.properties.layoutName);
            let newValues = assign({}, defaultValues.current);
            const newLayoutName = newValues[keys.properties.layoutName];
            values.setState(newValues, true);
            if (oldLayoutName !== newLayoutName) {
                changeItem(keys.properties.layoutName, newLayoutName); //reset layoutSettings
            }
        }
    }, []);


    const sectionClick = useCallback((ev) => {
        const item = avitem(ev);
        handlePanel(item.name);
    }, [handlePanel]);
    let leftVisible = leftPanelVisible;
    let rightVisible = !props.small || !leftVisible
    let leftClass = "sectionList";
    if (!rightVisible) leftClass += " expand";
    let currentSection = section || 'Layer';
    let sectionItems = [];
    for (let s in settingsSections) {
        let sectionCondition = sectionConditions[s];
        if (sectionCondition !== undefined) {
            if (!sectionCondition()) continue;
        }
        let item = {name: s};
        if (s === currentSection) item.activeItem = true;
        sectionItems.push(item);
    }
    let hasCurrentSection = false;
    sectionItems.forEach((item) => {
        if (item.name === currentSection) {
            hasCurrentSection = true;
        }
    });
    if (!hasCurrentSection) {
        currentSection = sectionItems[0].name;
        sectionItems[0].activeItem = true;
        //TODO: send up
    }
    let settingsItems = [];
    let sectionChanges = {};
    let sectionHasLayoutSettings = {};
    const layoutValues = layoutSettings.getState();
    const itemClasses = {};
    for (let section in settingsSections) {
        for (let s in settingsSections[section]) {
            let key = settingsSections[section][s];
            if (key in layoutValues) {
                sectionHasLayoutSettings[section] = true;
            }
            if (settingsConditions[key] !== undefined) {
                if (!settingsConditions[key](values.getState())) continue;
            }
            let description = KeyHelper.getKeyDescriptions()[key];
            let value = values.getValue(key);
            let className = "listEntry";
            if (value !== defaultValues.current[key]) {
                if (!sectionChanges[section]) sectionChanges[section] = {};
                sectionChanges[section].isDefault = false;
            }
            if (values.isItemChanged(key)) {
                if (!sectionChanges[section]) sectionChanges[section] = {};
                sectionChanges[section].isChanged = true;
            }
            if (propertyhandler.isPrefixProperty(key)) {
                className += " prefix";
            }
            if (key in layoutValues) {
                className += " layoutSetting";
            }
            if (section === currentSection) {
                let item = {
                    ...description,
                    name: key,
                };
                //do not recreate items on each render
                //as this would loose focus on every change
                //to avoid a separate creation step
                //we simply keep every item that has been rendered available
                //as only then it needs to be persistent
                let uiItem = renderItemCache.current[item.name];
                if (uiItem === undefined) {
                    uiItem = itemUiFromPlain(item);
                    renderItemCache.current[item.name] = uiItem;
                }
                settingsItems.push(uiItem);
                itemClasses[key] = className;
            }
        }
    }
    sectionItems.forEach((sitem) => {
        let className = "listEntry";
        if ((sectionChanges[sitem.name] || {}).isChanged) {
            className += " changed";
        }
        if ((sectionChanges[sitem.name] || {}).isDefault !== false) {
            className += " defaultValue";
        }
        if (sectionHasLayoutSettings[sitem.name]) {
            className += " layoutSetting";
        }
        sitem.className = className;
    });
    const layoutEditing = LayoutHandler.isEditing();
    const title = layoutEditing ? "LayoutSettings" : "Settings";
    const currentValues = {...values.getState(), ...layoutSettings.getState()};
    return <PageFrame
        {...props}
        id={'settingspage'}
    >
        <PageLeft
            title={title + ((props.small && !leftPanelVisible) ? " " + section : "")}
        >
            <div className="leftSection">
                {leftVisible ? <ItemList
                    className={leftClass}
                    scrollable={true}
                    itemClass={SectionItem}
                    onItemClick={sectionClick}
                    itemList={sectionItems}
                /> : null}
                {rightVisible ? <div
                    className="settingsList dialogObjects">
                    <EditableParameterListUI
                        values={currentValues}
                        initialValues={initialValues.current}
                        parameters={settingsItems}
                        onChange={(nv) => {
                            for (let k in nv) {
                                changeItem(k, nv[k]);
                            }
                        }}
                        itemClassName={(param) => Helper.concatsp('listEntry', itemClasses[param.name])}
                        itemchildren={(param) => {
                            if (!(param.name in layoutValues) || !layoutEditing) return null;
                            return <Button
                                name={"SettingsLayoutOff"}
                                className={"smallButton"}
                                onClick={(ev) => {
                                    ev.stopPropagation();
                                    layoutSettings.deleteValue(param.name);
                                }}
                            />
                        }}
                    />
                </div> : null}
            </div>
        </PageLeft>
        <ButtonList
            itemList={buttons}
        />
    </PageFrame>
}
SettingsPage.propTypes=Page.pageProperties;
export default SettingsPage;
