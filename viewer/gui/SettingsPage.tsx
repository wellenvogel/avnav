/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys, {KeyHelper, PropertyType, PropertyValue} from '../util/keys';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {PageFrame, PageLeft} from '../components/Page';
import Toast from '../components/Toast';
import {
    DBCancel,
    DialogButtons,
    DialogFrame, DialogText, showDialog,
    showPromiseDialog
} from '../components/OverlayDialog';
import LayoutHandler, {layoutLoader} from '../util/layouthandler';
import Mob from '../components/Mob';
import {useStateObject} from "../util/UiHelper";
import PropertyHandler from '../util/propertyhandler';
import LocalStorage from '../util/localStorageManager';
// @ts-ignore
import leavehandler from "../util/leavehandler";
import {ConfirmDialog} from "../components/BasicDialogs";

import Helper, {avitem} from "../util/helper";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {ListItem, ListMainSlot} from "../components/ListItems";
import {
    settingsSections,
    settingsConditions,
    EditSettingsItems,
    SaveSettingsDialog,
    LoadSettingsDialog
} from "../components/Settings";
import {ButtonEventHandler} from "../components/Button";
import {PAGEIDS} from "../util/pageids";

const sectionConditions:Record<string, ()=>boolean> = {};
sectionConditions.Remote=()=>globalStore.getData(keys.gui.capabilities.remoteChannel) && window.WebSocket !== undefined;

interface SectionItemProps{
    className?:string;
    activeItem?:boolean;
    onClick:ButtonEventHandler
    name:string
}
const SectionItem=(props:SectionItemProps)=>{
    return(
        <ListItem className={props.className} selected={props.activeItem} onClick={props.onClick}>
            <ListMainSlot primary={props.name}/>
        </ListItem>
    );
};





const HasChangesDialog=({resolveFunction}:{resolveFunction:(v:boolean)=>void}   )=>{
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



const SettingsPage = (props:Record<string,any>) => {
    const history=useHistory();
    const [leftPanelVisible, setLeftPanelVisible] = React.useState(true);
    const [section, setSection] = useState('Layer');
    const flattenedKeys = useRef(undefined);
    if (!flattenedKeys.current) {
        flattenedKeys.current = KeyHelper.flattenedKeys(keys.properties);
    }
    const initialValues = useRef<Record<string,PropertyValue>>();
    initialValues.current = globalStore.getMultiple(flattenedKeys.current, true);
    const values = useStateObject(initialValues.current);
    const initialLayoutValues= useRef<Record<string,PropertyValue>>();
    initialLayoutValues.current=LayoutHandler.getLayoutProperties();
    const layoutSettings = useStateObject(initialLayoutValues.current);
    const defaultValues = useRef(undefined);
    if (!defaultValues.current) {
        defaultValues.current = {};
        flattenedKeys.current.forEach((key:string) => {
            const description = KeyHelper.getKeyDescriptions()[key];
            if (description) {
                defaultValues.current[key] = description.defaultv;
            }
        })
    }
    const hasChanges = () => {
        return values.isChanged() || layoutSettings.isChanged();
    }
    const handlePanel = useCallback((section:string) => {
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
        const val = values.getState(true);
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
    const confirmAbortOrDo = useCallback((allowSave?:boolean) => {
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
                updateFunction: (state:Record<string, any>) => {
                    return {visible: !state.editing && LocalStorage.hasPrefix()}
                },
                onClick: () => {
                    const masterValues = PropertyHandler.getMasterValues();
                    const promises = [];
                    for (const key in masterValues) {
                        const description = KeyHelper.getKeyDescriptions()[key];
                        if (description.type === PropertyType.LAYOUT) {
                            promises.push(layoutLoader.loadLayout(masterValues[key] as string));
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
                        // @ts-ignore
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
                onClick: () => showDialog(undefined,()=><SaveSettingsDialog/>),
                storeKeys: {
                    editing: keys.gui.global.layoutEditing,
                    connected: keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction: (state:Record<string,any>) => {
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
                        showDialog(undefined,()=><LoadSettingsDialog/>);
                    });
                },
                storeKeys: {
                    editing: keys.gui.global.layoutEditing,
                    connected: keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction: (state:Record<string, any>) => {
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
                updateFunction: (state:Record<string, any>) => {
                    return {
                        visible: !state.visible
                    }
                },
            },
            Mob.mobDefinition(),
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
    const changeItem = useCallback((key:string, value:PropertyValue) => {
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

    const resetData = useCallback(() => {
        if (LayoutHandler.isEditing()) {
            layoutSettings.setState({}, true);
        } else {
            const newValues = {...defaultValues.current};
            values.setState(newValues, true);
        }
    }, []);


    const sectionClick = useCallback((ev:Event) => {
        const item = avitem(ev);
        handlePanel(item.name);
    }, [handlePanel]);
    const leftVisible = leftPanelVisible;
    const rightVisible = !props.small || !leftVisible
    let leftClass = "sectionList";
    if (!rightVisible) leftClass += " expand";
    let currentSection = section || 'Layer';
    const sectionItems = [];
    for (const s in settingsSections) {
        const sectionCondition = sectionConditions[s];
        if (sectionCondition !== undefined) {
            if (!sectionCondition()) continue;
        }
        const item:Record<string,any> = {name: s};
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
    const settingsItems:string[] = [];
    const sectionChanges:Record<string, any> = {};
    const sectionHasLayoutSettings:Record<string, boolean> = {};
    const layoutValues = layoutSettings.getState();
    for (const section in settingsSections) {
        for (const s in settingsSections[section]) {
            const key = settingsSections[section][s];
            if (key in layoutValues) {
                sectionHasLayoutSettings[section] = true;
            }
            if (settingsConditions[key] !== undefined) {
                if (!settingsConditions[key](values.getState())) continue;
            }
            const value = values.getValue(key);
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
    return <PageFrame id={PAGEIDS.SETTINGS}
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
export default SettingsPage;
