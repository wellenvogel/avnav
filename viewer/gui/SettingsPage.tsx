/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys, {KeyHelper, PropertyType} from '../util/keys';
import React, {useRef, useState} from 'react';
import {PageBaseProps, PageFrame, PageLeft} from '../components/Page';
import Toast from '../components/Toast';
import {
    showDialog, showPromiseDialogTrue
} from '../components/OverlayDialog';
import {layoutLoader} from '../util/layouthandler';
import PropertyHandler from '../util/propertyhandler';
// @ts-ignore
import leavehandler from "../util/leavehandler";

import Helper, {avitem} from "../util/helper";
import ButtonList from "../components/ButtonList";
import {useHistory} from "../components/HistoryProvider";
import {ListItem, ListMainSlot} from "../components/ListItems";
import {
    settingsSections,
    settingsConditions,
    SaveSettingsDialog,
    LoadSettingsDialog, EditSettingsCategory
} from "../components/Settings";
import {ButtonDef, ButtonEventHandler, updateButtons} from "../components/Button";
import {PAGEIDS} from "../util/pageids";
import layouthandler from "../util/layouthandler";
import {useStoreState} from "../hoc/Dynamic";
import {MultiView, MvHeadline, useScrollHelper} from "../components/MultiView";
import {useUploadHelper} from "../components/UploadHandler";
import {handleInitialButton, InjectMainMenu} from "./MainNav";
import SettingsPageButtons from "./SettingsPageButtons";
import {useDialogContext} from "../components/exports";
import {DownloadItemList} from "../components/DownloadItemList";
import propertyhandler from "../util/propertyhandler";
import globalstore from "../util/globalstore";
import {ConfirmDialog} from "../components/BasicDialogs";

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

interface SectionListProps{
    onSelect:(ev:Event) => void;
}
const SectionList=(props:SectionListProps)=>{
    const flattenedKeys = useRef(undefined);
    const [selectedSection, setSelectedSection] = useState<string>(null);
    if (!flattenedKeys.current) {
        flattenedKeys.current = KeyHelper.flattenedKeys(keys.properties);
    }
    const currentValues=globalStore.getMultiple(flattenedKeys.current, true);
    const defaultValues = useRef(undefined);
    const layoutValues=layouthandler.getLayoutProperties();
    if (!defaultValues.current) {
        defaultValues.current = {};
        flattenedKeys.current.forEach((key:string) => {
            const description = KeyHelper.getKeyDescriptions()[key];
            if (description) {
                defaultValues.current[key] = description.defaultv;
            }
        })
    }
    const sectionItems = [];
    for (const s in settingsSections) {
        const sectionCondition = sectionConditions[s];
        if (sectionCondition !== undefined) {
            if (!sectionCondition()) continue;
        }
        const item: Record<string, any> = {name: s,className:""};
        let isDefault=true;
        for (const key of settingsSections[s]) {
            if (key in layoutValues) {
                item.className += " layoutSetting";
            }
            if (settingsConditions[key] !== undefined) {
                if (!settingsConditions[key](currentValues)) continue;
            }
            const value = currentValues[key];
            if (value !== defaultValues.current[key]) {
                isDefault = false;
            }
        }
        if (isDefault) {
            item.className += " defaultValue";
        }
        else{
            item.className += " changed";
        }
        sectionItems.push(item);
    }
    return <ItemList
        className={'sectionList'}
        itemList={sectionItems}
        itemClass={SectionItem}
        onItemClick={(ev:Event) =>{
            const item=avitem(ev);
            props.onSelect(ev);
            setSelectedSection(item.name)
        }}
        selectedKey={selectedSection}
        scrollSelected={1}
    />

}
const PAGE=PAGEIDS.SETTINGS;
//const TITLE=PAGE_TITLES.SETTINGS;
const ITEM_TYPE="settings";
const SettingsPage = (props:Partial<PageBaseProps>) => {
    const history=useHistory();
    const dialogContext = useDialogContext();
    const [layoutEditing]=useStoreState(keys.gui.global.layoutEditing);
    const [scrollProps,scrollTo,visible]=useScrollHelper(0);
    const buttonListRef=useRef<ButtonDef[]>();
    const [uploadProps,uploadAction]=useUploadHelper(ITEM_TYPE);
    const buttonActions=
        {
            SectionView:{
              onClick:() =>{scrollTo(0)},
              toggle: visible(0),
              disabled:visible(0) && visible(1),
            },
            ItemsView:{
              onClick:() =>{scrollTo(1)},
              toggle: visible(1),
              disabled:visible(1) && visible(0),
            },
            SettingsDefaults:{
                onClick: async () => {
                    const ok=await showPromiseDialogTrue(dialogContext,(dp)=>
                        <ConfirmDialog {...dp}
                            title={'Reset to Defaults?'}
                            text={'This will reset all settings to their defaults (including the layout)'}
                        />)
                    if (!ok) return;
                    if (layoutEditing) {
                        layouthandler.updateLayoutProperties({})
                    }
                    else{
                        const layout=layouthandler.getName();
                        propertyhandler.resetToDefaults();
                        const newLayout=globalstore.getData(keys.properties.layoutName);
                        if (layout != newLayout){
                            layouthandler.resetToDefault();
                        }
                    }
                }
            },
            SettingsSplitReset: {
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
                        .then(() => globalStore.storeMultiple(masterValues))
                        .catch((e) => Toast(e));
                },
                overflow: true
            },
            SettingsAddons: {
                onClick: () => {
                    history.push("addonconfigpage");
                }
            },
            SettingsSave: {
                onClick: () => showDialog(undefined, () => <SaveSettingsDialog/>),
                storeKeys: {
                    editing: keys.gui.global.layoutEditing,
                    connected: keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction: (state: Record<string, any>) => {
                    return {
                        visible: !state.editing && state.connected && state.allowed
                    }
                },
                overflow: true
            },
            SettingsLoad: {
                onClick: () => {
                    showDialog(undefined, () => <LoadSettingsDialog/>);
                }
            },
            SettingsReload: {
                onClick: () => {
                    leavehandler.stop();
                    Helper.reloadPage();
                }
            },
            Cancel: {
                onClick: () => {
                    history.pop();
                }
            },
            DownloadPageUpload: {
                onClick:uploadAction
            }
        }
    buttonListRef.current=InjectMainMenu(PAGE,updateButtons(SettingsPageButtons,
        buttonActions));
    handleInitialButton(history,buttonListRef.current);
        const title = layoutEditing ? "LayoutSettings" : "Settings";
    return <PageFrame id={PAGEIDS.SETTINGS}
        {...props}
    >
        <PageLeft
            title={title}
        >
            <MultiView {...scrollProps}
                maxNumber={props.pageColumns}
                       views={[
                <React.Fragment key={0}>
                    <MvHeadline
                        {...scrollProps}
                    title={'Categories'}
                    number={0}
                    max={1}
                    />
                    <SectionList onSelect={(ev:Event) =>{
                        const item=avitem(ev);
                        showDialog(dialogContext,()=><EditSettingsCategory category={item.name}/>)
                    }
                    }/>
                </React.Fragment>,
                <React.Fragment key={1}>
                    <MvHeadline {...scrollProps}
                                title={'Stored Settings'}
                                number={1}
                                max={1}/>
                    <DownloadItemList type={ITEM_TYPE}
                                      {...uploadProps}
                                      autoreload={3000}
                                      scrollSelected={1}
                    />
                </React.Fragment>
            ]}/>
        </PageLeft>
        <ButtonList
            page={PAGE}
            itemList={buttonListRef.current}
        />
    </PageFrame>
}
export default SettingsPage;
