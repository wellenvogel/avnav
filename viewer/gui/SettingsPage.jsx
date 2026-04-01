/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList.tsx';
import globalStore from '../util/globalstore.ts';
import keys,{KeyHelper,PropertyType} from '../util/keys.ts';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Page, {PageFrame, PageLeft} from '../components/Page.tsx';
import Toast from '../components/Toast.tsx';
import assign from 'object-assign';
import {
    DBCancel,
    DialogButtons,
    DialogFrame, DialogText,
    showDialog,
    showPromiseDialog
} from '../components/OverlayDialog.tsx';
import LayoutHandler, {layoutLoader} from '../util/layouthandler.ts';
import Mob from '../components/Mob.ts';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {useStateObject} from "../util/GuiHelpers";
import Formatter from "../util/formatter";
import PropertyHandler from '../util/propertyhandler';
import {createItemActions} from "../components/FileDialog";
import loadSettings from "../components/LoadSettingsDialog";
import LocalStorage from '../util/localStorageManager';
import leavehandler from "../util/leavehandler";
import {ConfirmDialog} from "../components/BasicDialogs";
import {checkName, ItemNameDialog} from "../components/ItemNameDialog";
import Helper, {avitem} from "../util/helper";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {ListItem, ListMainSlot} from "../components/ListItems";
import {settingsSections, settingsConditions, EditSettingsItems} from "../components/Settings";

const sectionConditions={};
sectionConditions.Remote=()=>globalStore.getData(keys.gui.capabilities.remoteChannel) && window.WebSocket !== undefined;


const SectionItem=(props)=>{
    return(
        <ListItem className={props.className} selected={props.activeItem} onClick={props.onClick}>
            <ListMainSlot primary={props.name}/>
        </ListItem>
    );
};





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
    initialValues.current = globalStore.getMultiple(flattenedKeys.current, true);
    const values = useStateObject(initialValues.current);
    const initialLayoutValues= useRef();
    initialLayoutValues.current=LayoutHandler.getLayoutProperties();
    const layoutSettings = useStateObject(initialLayoutValues.current);
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
                    let masterValues = PropertyHandler.getMasterValues();
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
                        window.avnavAndroid.showSettings();
                    });
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
    useCallback(() => {
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
            let newValues = assign({}, defaultValues.current);
            values.setState(newValues, true);
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
    for (let section in settingsSections) {
        for (let s in settingsSections[section]) {
            let key = settingsSections[section][s];
            if (key in layoutValues) {
                sectionHasLayoutSettings[section] = true;
            }
            if (settingsConditions[key] !== undefined) {
                if (!settingsConditions[key](values.getState())) continue;
            }
            let value = values.getValue(key);
            if (value !== defaultValues.current[key]) {
                if (!sectionChanges[section]) sectionChanges[section] = {};
                sectionChanges[section].isDefault = false;
            }
            if (values.isItemChanged(key)) {
                if (!sectionChanges[section]) sectionChanges[section] = {};
                sectionChanges[section].isChanged = true;
            }
            if (section === currentSection) {
                settingsItems.push(key);
            }
        }
    }
    sectionItems.forEach((sitem) => {
        let className = "";
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
    return <PageFrame
        {...props}
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
                {rightVisible ?
                    <EditSettingsItems
                        values={values.getState()}
                        layoutValues={layoutValues}
                        initialValues={initialValues.current}
                        initialLayoutValues={initialLayoutValues.current}
                        settings={settingsItems}
                        onChange={(key,value,isLayout)=>{
                            if (isLayout){
                                if (! layoutEditing) return;
                                if (value === undefined) layoutSettings.deleteValue(key);
                                else layoutSettings.setValue(key,value);
                                return;
                            }
                            changeItem(key,value);
                        }}
                        layoutEditing={layoutEditing}
                    />
                    : null}
            </div>
        </PageLeft>
        <ButtonList
            page={props.id}
            itemList={buttons}
        />
    </PageFrame>
}
SettingsPage.propTypes=Page.pageProperties;
export default SettingsPage;
