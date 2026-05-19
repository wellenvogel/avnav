/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import keys, {KeyHelper, Property, PropertyType, PropertyValue} from "../util/keys";
import DimHandler from '../util/dimhandler';
import propertyhandler, {SavedSettingsData} from '../util/propertyhandler';
import Toast from "./Toast";
import Button, {ButtonEvent, DynamicButtonProps} from "./Button";
import {EditableStringParameterBase, Properties, SelectListEntry, Value, Values} from "../util/EditableParameter";
import {
    default as EditableParameterUIFactory,
    EditableParameterListUI,
    getCommonParam
    // @ts-ignore
} from "../components/EditableParameterUI";
import {InputReadOnly, InputSelect} from './Inputs';
import globalstore from "../util/globalstore";
import LayoutHandler, {layoutLoader} from '../util/layouthandler';
import Helper, {unsetOrTrue} from "../util/helper";
import {useStateObject} from "../util/UiHelper";
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    showDialog,
    showPromiseDialog,
    showPromiseDialogTrue
} from "./OverlayDialog";
import {ConfirmDialog} from './BasicDialogs';
import {useDialogContext, useStoreState} from "./exports";
import {IDialogContext} from "./DialogContext";
// @ts-ignore
import {createItemActions} from './FileDialog';
// @ts-ignore
import {checkName, ItemNameDialog} from './ItemNameDialog';
// @ts-ignore
import Formatter from "../util/formatter";
import LocalStorageManager, {PREFIX_NAMES} from "../util/localStorageManager";
import {fetchItem, listItems} from "../util/itemFunctions";
import {DownloadItemSelectDialog} from "./DownloadItemList";
import {Item} from "./ItemList";
import {LayoutData} from "../api/api.interface";
import ButtonDefs from "./ButtonDefs";

export interface SettingsDefinition extends Omit<Property,'isSplit'>{
    name:string;
}
export const settingsSections = {
    UpdateTimes:[keys.properties.positionQueryTimeout,keys.properties.trackQueryTimeout,keys.properties.aisQueryTimeout, keys.properties.networkTimeout ,
        keys.properties.connectionLostAlarm],
    Buttons:    [keys.properties.style.buttonSize,keys.properties.buttonCols,
        keys.properties.hideButtonTime,keys.properties.showButtonShade, keys.properties.autoHideNavPage,keys.properties.autoHideGpsPage,keys.properties.nightModeNavPage,
        keys.properties.buttonText,keys.properties.mainBtText,keys.properties.buttonTitleTime],
    General:     [keys.properties.baseFontSize,keys.properties.smallBreak,keys.properties.widgetFontSize,
        keys.properties.allowTwoWidgetRows,keys.properties.dashboardNum,keys.properties.nightFade,
        keys.properties.nightChartFade,keys.properties.dimFade,keys.properties.localAlarmSound,keys.properties.alarmVolume ,
        keys.properties.titleIcons, keys.properties.titleIconsGps, keys.properties.startLastSplit,
        keys.properties.autoUpdateUserCss],
    MainMenu:[keys.properties.mainAll,keys.properties.mainNavExpand,keys.properties.mainNavCols, keys.properties.mainBtText],
    Navigation: [keys.properties.layers.nav,keys.properties.layers.boat,keys.properties.bearingColor,keys.properties.bearingWidth,keys.properties.navCircleColor,keys.properties.navCircleWidth,keys.properties.navCircle1Radius,keys.properties.navCircle2Radius,keys.properties.navCircle3Radius,
        keys.properties.navBoatCourseTime,keys.properties.boatIconScale,keys.properties.boatDirectionMode,
        keys.properties.boatDirectionVector,keys.properties.boatSteadyDetect,keys.properties.boatSteadyMax,
        keys.properties.courseAverageTolerance,keys.properties.courseAverageInterval,keys.properties.speedAverageInterval,keys.properties.positionAverageInterval,keys.properties.anchorWatchDefault,keys.properties.anchorCircleWidth,
        keys.properties.anchorCircleColor,keys.properties.measureColor,keys.properties.measureRhumbLine],
    Map:        [
        keys.properties.layers.base,
        keys.properties.layers.grid,keys.properties.layers.compass,keys.properties.layers.scale,
        keys.properties.layers.user,
        keys.properties.startNavPage,
        keys.properties.autoZoom,keys.properties.mobMinZoom,keys.properties.style.useHdpi,
        keys.properties.clickTolerance,keys.properties.featureInfo,
        keys.properties.mapFloat,keys.properties.mapScale,keys.properties.mapUpZoom,
        keys.properties.mapOnlineUpZoom,
        keys.properties.mapLockMode,keys.properties.mapLockMove,keys.properties.mapAlwaysCenter,keys.properties.mapScaleBarText,keys.properties.mapZoomLock,
        keys.properties.fontBase,keys.properties.fontColor,keys.properties.fontShadowWidth,keys.properties.fontShadowColor
    ],
    AIS:        [keys.properties.layers.ais,keys.properties.aisDistance,keys.properties.aisCenterMode,keys.properties.aisWarningCpa,keys.properties.aisWarningTpa,
        keys.properties.aisShowEstimated,keys.properties.aisEstimatedOpacity,keys.properties.aisCpaEstimated,
        keys.properties.aisMinDisplaySpeed,keys.properties.aisOnlyShowMoving,
        keys.properties.aisFirstLabel,keys.properties.aisSecondLabel,keys.properties.aisThirdLabel,
        keys.properties.aisTextSize,keys.properties.aisUseCourseVector,keys.properties.aisCurvedVectors,keys.properties.aisRelativeMotionVectorRange,keys.properties.style.aisNormalColor,
        keys.properties.style.aisNearestColor, keys.properties.style.aisWarningColor,keys.properties.style.aisTrackingColor,
        keys.properties.aisIconBorderWidth,keys.properties.aisIconScale,keys.properties.aisClassbShrink,keys.properties.aisShowA,
        keys.properties.aisShowB,keys.properties.aisShowOther,keys.properties.aisUseHeading,
        keys.properties.aisReducedList,keys.properties.aisListUpdateTime, keys.properties.aisHideTime, keys.properties.aisLostTime,
        keys.properties.aisMarkAllWarning,keys.properties.aisShowErrors],
    Track:      [keys.properties.layers.track,keys.properties.trackColor,keys.properties.trackWidth,keys.properties.trackInterval,keys.properties.initialTrackLength],
    Route:      [keys.properties.routeColor,keys.properties.routeWidth,keys.properties.routeWpSize,keys.properties.routingTextSize,keys.properties.routeApproach,keys.properties.routeShowLL],
    Remote:     [keys.properties.remoteChannelName,keys.properties.remoteChannelRead,keys.properties.remoteChannelWrite,keys.properties.remoteGuardTime]
};

export type SettingSectionKeys=keyof typeof settingsSections;

type Condition=(values?:SettingsValuesType)=>boolean;
export const settingsConditions:Record<string,Condition>={
};

settingsConditions[keys.properties.dimFade]=()=>DimHandler.canHandle();
settingsConditions[keys.properties.boatDirectionVector]=(values)=>{
    const cur=(values||{})
    return cur[keys.properties.boatDirectionMode]!== 'cog';
}
settingsConditions[keys.properties.aisCpaEstimated]=(values)=>
    !!((values||{})[keys.properties.aisShowEstimated])
settingsConditions[keys.properties.aisMinDisplaySpeed]=(values)=>
    !!((values||{})[keys.properties.aisOnlyShowMoving]||(values||{})[keys.properties.aisShowEstimated])
settingsConditions[keys.properties.aisEstimatedOpacity]=(values)=>
    !!((values||{})[keys.properties.aisShowEstimated])
settingsConditions[keys.properties.aisCpaEstimated]=(values)=>
    !!((values||{})[keys.properties.aisShowEstimated])
settingsConditions[keys.properties.boatSteadyMax]=(values)=>
    !!((values||{})[keys.properties.boatSteadyDetect])


export type SettingsValuesType=Record<string, PropertyValue>;
interface ParameterUIRenderProps{
    currentValues:SettingsValuesType;
    initialValues:SettingsValuesType;
    className?:string;
    onChange?:(values:Values) => void;
    children?:React.ReactNode;
}
class LayoutParameterUI extends EditableStringParameterBase{
    constructor(props:Properties) {
        super(props,props.type,true);
        this.render=this.render.bind(this);
        Object.freeze(this);
    }
    _layoutEditing(){
        return globalstore.getData(keys.gui.global.layoutEditing);
    }
    render({currentValues,initialValues,className,onChange,children}:ParameterUIRenderProps){
        const isEditing=()=>{
            Toast("cannot change layout during editing");
        }
        if (this._layoutEditing()){
            return <InputReadOnly
                {...getCommonParam({ep:this,currentValues,className,initialValues,children})}
                value={LayoutHandler.getName()}
                onClick={isEditing}
            />
        }
        const changeFunction=(newVal:SelectListEntry)=>{
            if (this._layoutEditing()) {
                isEditing();
                return;
            }
            onChange(this.setValue(undefined, newVal.value));
        };
        const changeWithCheck=(newVal:{name:string,value:Value})=>{
            if (this._layoutEditing()) {
                isEditing();
                return;
            }
            onChange(newVal);
        }
        return <InputSelect
            {...getCommonParam({ep:this,currentValues,className,initialValues,onChange:changeWithCheck,children})}
            onChange={changeFunction}
            itemList={(currentLayout:string)=>{
                return layoutLoader.listLayouts()
                    .then((list:{name:string}[])=>{
                        const displayList:SelectListEntry[]=[];
                        list.forEach((el:{name:string})=>{
                            const le:SelectListEntry={label:el.name,value:el.name};
                            if (currentLayout === el.name ) le.selected=true;
                            displayList.push(le);
                        });
                        return displayList;
                    })}
            }
        />
    }
}

export const itemUiFromPlain=(item:SettingsDefinition)=>{
    if (item.type === PropertyType.LAYOUT){
        return new LayoutParameterUI({type: item.type,
            default: item.defaultv,
            list: item.values,
            displayName: item.label,
            name:item.name,
            description: item.description
        })
    }
    const rt=EditableParameterUIFactory.createEditableParameterUI({
        type: item.type,
        default: item.defaultv,
        list: item.values,
        displayName: item.label,
        name:item.name,
        description: item.description,
        readOnly: !item.canChange
    })
    return rt;
}

export interface EditSettingsItemsProps{
    values:SettingsValuesType;
    layoutValues:SettingsValuesType;
    initialValues:SettingsValuesType;
    initialLayoutValues:SettingsValuesType;
    settings:string[];
    /**
     *
     * @param name name to be set
     * @param value new value. Undefined: delete if layout
     * @param layout: is a layout value
     */
    onChange:(name:string,value:PropertyValue,layout:boolean,saveAction?:()=>void)=>void;
    className?:string;
    layoutEditing:boolean
}
export const EditSettingsItems=(props:EditSettingsItemsProps)=>{
    const values=props.values||{};
    const layoutValues=props.layoutValues||{};
    const initialValues=props.initialValues||{};
    const initialLayoutValues=props.initialLayoutValues||{};
    const renderItemCache=useRef<Record<string,any>>({});
    const settingsItems=[];
    const itemClasses:Record<string, string> = {};
    for (const key of props.settings) {
        if (settingsConditions && settingsConditions[key] !== undefined) {
            if (!settingsConditions[key](values)) continue;
        }
        const description = KeyHelper.getKeyDescriptions()[key];
        let className = "listEntry border";
        if (propertyhandler.isPrefixProperty(key)) {
            className += " prefix";
        }
        const item = {
            ...description,
            name: key,
            canChange:unsetOrTrue(description.canChange)
        };
        if (key in layoutValues) {
            className += " layoutSetting";
            if (! props.layoutEditing) item.canChange = false;
        }
        //do not recreate items on each render
        //as this would loos focus on every change
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
    const changeItem=useCallback((key:string,value:PropertyValue)=>{
        if (props.layoutEditing) {
            if (key === keys.properties.layoutName){
                Toast("cannot change layout during editing");
                return;
            }
            props.onChange(key,value,true);
        } else {
            if (key in layoutValues) {
                Toast("cannot change layout settings when not editing");
                return;
            }
            props.onChange(key,value,false)
        }
    },[props.layoutEditing]);
    return <div
        className={Helper.concatsp("settingsList","dialogObjects",props.className)}>
        <EditableParameterListUI
            values={{...values,...layoutValues}}
            initialValues={{...initialValues,...initialLayoutValues}}
            parameters={settingsItems}
            onChange={(nv:SettingsValuesType) => {
                for (const k in nv) {
                    changeItem(k, nv[k]);
                }
            }}
            itemClassName={(param:SettingsDefinition) => itemClasses[param.name]}
            itemchildren={(param:SettingsDefinition) => {
                if (!(param.name in layoutValues) || !props.layoutEditing) return null;
                return <Button
                    {...ButtonDefs.SettingsLayoutOff}
                    className={"smallButton"}
                    onClick={(ev) => {
                        ev.stopPropagation();
                        props.onChange(param.name,undefined,true);
                    }}
                />
            }}
        />
    </div>
}

export const discardChanges=(dialogContext?:IDialogContext)=>{
    return showPromiseDialog(dialogContext, (props:any) => <ConfirmDialog {...props}
                                                           text={"discard settings changes?"}/>)
        .then(()=>true,()=>false)


}

export interface EditSettingsCategoryProps{
    className?:string;
    category:SettingSectionKeys|SettingSectionKeys[];
    title?:string;
}
export const EditSettingsCategory=(props:EditSettingsCategoryProps)=>{
    let keys:string[]=[];
    const categories=Array.isArray(props.category)?props.category:[props.category];
    for (const cat of categories){
        const sectionKeys=settingsSections[cat];
        if (Array.isArray(sectionKeys)) {
            keys = keys.concat(sectionKeys);
        }
    }
    const initialValues:SettingsValuesType=useMemo(()=>globalstore.getMultiple(keys),[]);
    const initialLayoutValues=useMemo(()=>LayoutHandler.getLayoutProperties(),[]);
    const values=useStateObject(initialValues);
    const layoutValues=useStateObject(initialLayoutValues);
    const layoutEditing=LayoutHandler.isEditing();
    const dialogContext=useDialogContext();
    const setValue=useCallback((name:string,value:PropertyValue,forLayout:boolean)=>{
        if (forLayout){
            if (value === undefined) layoutValues.deleteValue(name);
            else layoutValues.setValue(name, value);
        }
        else{
            values.setValue(name, value);
        }
    },[]);

    return <DialogFrame
        title={`${props.title?props.title:props.category}`}
        className={'settings'}
        flex={true}
    >
        <EditSettingsItems
            values={values.getState()}
            layoutValues={layoutValues.getState()}
            initialValues={initialValues}
            initialLayoutValues={initialLayoutValues}
            settings={keys}
            onChange={setValue}
            layoutEditing={layoutEditing}/>
        <DialogButtons
            buttonList={[
                {
                    ...ButtonDefs.DBReset,
                    onClick:async ()=>{
                        const action=()=>{
                            if (layoutEditing){
                                layoutValues.setState({},true);
                            }
                            else{
                                const defaultValues:Record<string, PropertyValue> = {};
                                keys.forEach((key) => {
                                    const description = KeyHelper.getKeyDescriptions()[key];
                                    if (description) {
                                        defaultValues[key] = description.defaultv;
                                    }
                                })
                                values.setState(defaultValues);
                            }
                        }
                        if (layoutValues.isChanged()||values.isChanged()) {
                            const ok = await discardChanges(dialogContext);
                            if (ok) {
                                action();
                            }
                        }
                        else{
                            action();
                        }
                    },
                    close: false,
                },
                DBCancel({
                    close: false,
                    onClick:async (ev:ButtonEvent)=>{
                        ev.stopPropagation();
                        if (layoutValues.isChanged()||values.isChanged()){
                            const ok=await discardChanges(dialogContext);
                            if (ok){
                                dialogContext.closeDialog();
                            }
                            return;
                        }
                        dialogContext.closeDialog();
                    }
                }),
                DBOk(()=>{
                    if (layoutEditing){
                        if (layoutValues.isChanged()){
                            LayoutHandler.updateLayoutProperties(layoutValues.getState(true));
                        }
                    }
                    else{
                        if (values.isChanged()){
                            globalstore.storeMultiple(values.getState())
                        }
                    }
                    //TODO: save dialog
                    dialogContext.closeDialog();
                },{
                    disabled:!layoutValues.isChanged() && !values.isChanged(),
                    close: false
                })
            ]}
        />
    </DialogFrame>

}
export interface SelectLayoutDialogProps{
    className?:string;
}

export const newNameForLayoutEdit=async (currentName:string)=>{
    try {
        const list = await layoutLoader.listLayouts();
        const itemActions = createItemActions({type: 'layout'});
        const fixedPrefix= itemActions.prefixForDisplay();
        const res = await showPromiseDialog<{name:string}>(undefined, (dprops) => <ItemNameDialog
            {...dprops}
            title={"ReadOnly, select a new name"}
            iname={itemActions.nameToBaseName(currentName)}
            fixedPrefix={fixedPrefix}
            checkName={(newName: string) => {
                if (!newName) {
                    return {
                        error: 'name must not be empty',
                        proposal: itemActions.nameToBaseName(currentName),
                    }
                }
                if (newName.indexOf('.') >= 0) {
                    return {
                        error: 'names must not contain a .',
                        proposal: newName.replace(/\./g, '')
                    }
                }
                let cr = checkName(newName, undefined, undefined);
                if (cr && cr.error) return cr;
                cr = checkName(newName, list, itemActions.nameForCheck);
                if (cr && cr.error) {
                        return cr;
                } else {
                    return {
                        info: "new"
                    }
                }
            }}
        />)
        return res.name?fixedPrefix+res.name:undefined;
    }
     catch(error){
        if (error)Toast("cannot start layout editing: " + error)
        }
}

export const SelectLayoutDialog=(props:SelectLayoutDialogProps)=>{
    const layoutKey=keys.properties.layoutName;
    const description=KeyHelper.getKeyDescriptions(true)[layoutKey];
    const layoutParameter = itemUiFromPlain({...description,name:layoutKey});
    const currentName=LayoutHandler.getName();
    const currentValues=useStateObject({[layoutKey]:currentName});
    const initialValues={
        [layoutKey]:currentName
    }
    const dialogContext=useDialogContext();
    const checkAnLoad=async ():Promise<[name:string,data:LayoutData]> =>{
        const layoutName=currentValues.getValue(layoutKey);
        if (! layoutName){
            Toast("no layout selected");
            return;
        }
        try {
            const layout = await layoutLoader.loadLayout(layoutName)
            return [layoutName,layout];
        }catch (e){
            Toast(e);
            return;
        }
    }
    return <DialogFrame title={'Select/Edit Layout'} className={Helper.concatsp(props.className,'selectLayout')}>
        <EditableParameterListUI
            values={currentValues.getState()}
            parameters={[layoutParameter]}
            initialValues={initialValues}
            onChange={(values:Record<string, PropertyValue>) =>{
                if (layoutKey in values) {
                    currentValues.setState(values);
                }
            }}
        />
        <DialogButtons buttonList={[
            DBCancel(),
            DBOk(async ()=>{
                const layoutAndName=await checkAnLoad();
                if (! layoutAndName) return;
                try {
                    LayoutHandler.setLayoutAndName(layoutAndName[1],layoutAndName[0],true);
                }catch (e){
                    Toast(e);
                    return;
                }
                await dialogContext.closeDialog();
            },{
                disabled:!currentValues.isChanged(),
                close:false,
            }),
            {
                ...ButtonDefs.DBEditLayout,
                onClick: async () => {
                    const layoutName=currentValues.getValue(layoutKey);
                    let layoutAndName = [];
                    try {
                        if (! LayoutHandler.canEdit(layoutName)) {
                            const newName=await newNameForLayoutEdit(layoutName);
                            if (! newName) return;
                            layoutAndName.push(newName);
                        }
                        else {
                            if (currentValues.isChanged()) {
                                layoutAndName = await checkAnLoad();
                                if (!layoutAndName) return;
                                LayoutHandler.setLayoutAndName(layoutAndName[1], layoutAndName[0], true);
                            } else {
                                layoutAndName.push(currentName);
                            }
                        }
                        LayoutHandler.startEditing(layoutAndName[0]);
                    } catch (e) {
                        Toast(e);
                        return;
                    }
                }

            }

        ]}/>
    </DialogFrame>
}
export interface SaveSettingsDialogProps{
    title?:React.ReactNode;
    additionalButtons?:DynamicButtonProps[]
}
export const SaveSettingsDialog=(props:SaveSettingsDialogProps)=>{
    const actions = createItemActions({type:'settings'});
    const dialogContext=useDialogContext();
    let lastName=LocalStorageManager.getItem(PREFIX_NAMES.SETTINGS_NAME);
    if (! lastName) {
        lastName="settings";
        if (LocalStorageManager.hasPrefix()) lastName=lastName+'-'+LocalStorageManager.getPrefix()+"-";
    }
    const oldName = actions.nameToBaseName(lastName).replace(/-*[0-9]*$/, '');
    const suffix = Formatter.formatDateTime(new Date()).replace(/[: /]/g, '').replace(/--/g, '');
    let proposedName = oldName + "-" + suffix;
    const [settingsList,setSettingsList]=useState<string[]>();
    const checkFunction = (newName:string) => {
        return checkName(newName, settingsList||[], actions.nameForCheck,true,true);
    }
    useEffect(()=>{
        listItems('settings')
            .then((settings:string[])=>setSettingsList(settings))
            .catch(()=>{})
    },[])
    return <ItemNameDialog
                resolveFunction={async (res:{name:string})=>{
                    const settingsName=res.name;
                    if (!settingsName || settingsName === 'user.') {
                        return false;
                    }
                    proposedName = settingsName;
                    let settings=propertyhandler.exportSettings();
                    try {
                        const result = await propertyhandler.verifySettingsData(settings, false);
                        if (result.warnings && result.warnings.length > 0) {
                            const qs = await showPromiseDialogTrue(dialogContext,
                                (dprops) => <ConfirmDialog {...dprops}
                                                           title={'Settings Error'}
                                                           text={'Autocorrect the following errors?\n' + result.warnings.join('\n')}
                                                           className={'SettingsWarnings'}
                                />
                            )
                            if (qs) {
                                delete result.warnings;
                                await propertyhandler.importSettings(result.data, false);
                                settings = result.data;
                            } else {
                                return;
                            }
                        }
                    }catch (e){
                        const qs = await showPromiseDialogTrue(dialogContext,
                                (dprops) => <ConfirmDialog {...dprops}
                                                           title={'Settings Error'}
                                                           className={'SettingsWarnings'}
                                                           text={'Uncorrectable Settings Error\n'+e+"\nReset Settings to defaults?"}/>
                        );
                        if (! qs) return;
                        propertyhandler.resetToDefaults();
                        settings=propertyhandler.exportSettings();
                    }
                    try {
                        await propertyhandler.uploadSettingsData(
                            proposedName,
                            settings,
                            false
                        )
                        LocalStorageManager.setItem(PREFIX_NAMES.SETTINGS_NAME, undefined, proposedName);
                        propertyhandler.setChangedFlag(false);
                        Toast("settings saved");
                        return true;
                    }catch(e){
                        Toast(e);
                    }
                    return false;
                }}
                fixedPrefix={'user.'}
                title={props.title|| "Select Name to save settings"}
                iname={proposedName}
                checkName={checkFunction}
                additionalButtons={props.additionalButtons}
                />
}

/**
 * will return a promise that reolves to the loaded settings
 * or rejects with undefined of abort - or an error string
 * @param currentValues
 * @param defaultName
 * @param opt_title
 * @param opt_preventDialog
 */
export interface LoadSettingsProps{
    name:string,
    scope?:string,
    dialogContext?:IDialogContext; //if not set - no dialog but fail
    alwaysDialog?:boolean;
}
export const loadSettings = async (props:LoadSettingsProps) => {
    const setSettings = (checkedValues:SavedSettingsData) => {
        return propertyhandler.importSettings(checkedValues);
    }
    let settings=await fetchItem({type:'settings',name:props.name})
    if (typeof settings === 'string'){
        settings=JSON.parse(settings);
    }
    let replacements;
    if (props.scope){
        replacements={prefix:props.scope};
    }
    const verified=await propertyhandler.verifySettingsData(settings, false, false,replacements);
    if (verified.warnings && verified.warnings.length) {
        if (!props.dialogContext) {
            throw new Error("Warnings: " + verified.warnings.join(", "));
        }
        const user = await showPromiseDialog(props.dialogContext,
            (dprops) => <ConfirmDialog
                {...dprops}
                text={verified.warnings.join('\n')}
                title={'Activate them anyway?'}/>);
        if (!user) return;
    }
    else{
        if (props.alwaysDialog){
            const user=await showPromiseDialog(props.dialogContext,
                (dprops) => <ConfirmDialog
                    {...dprops}
                    text={`settings ${props.name} verified`}
                    title={'Activate settings?'}
                />)
            if (!user) return;
        }
    }
    return setSettings(verified.data);
}
export interface LoadSettingsDialogProps{
    tryName?:string;
    force?:boolean;
    title?:React.ReactNode;
}
export const LoadSettingsDialog=(props:LoadSettingsDialogProps) => {
    const dialogContext=useDialogContext();
    const [notSaved]=useStoreState(keys.gui.global.settingsChanged);
    const [notSavedOverride,setNotSavedOverride]=useState(props.force);
    if (notSaved && ! notSavedOverride){
        return <DialogFrame title={"Current settings not saved"} >
            <div className="dialogText">{"Your current settings are not saved to the server. OK to save now. Ignore to continue."}</div>
            <DialogButtons buttonList={[
                DBCancel({
                    close:false
                }),
                {
                    ...ButtonDefs.DBIgnore,
                    close:false,
                    onClick:()=>{setNotSavedOverride(true)},
                },
                DBOk(async ()=>{
                    await showDialog(dialogContext,()=><SaveSettingsDialog/>);
                },{close:false})
            ]}/>
        </DialogFrame>
    }
    return <DownloadItemSelectDialog
        type={'settings'}
        title={props.title||'Select settings to activate'}
        resolveFunction={
        async (item:Item)=>{
            try{
                await loadSettings({name:item.name,scope:item.scope,dialogContext:dialogContext,alwaysDialog:true});
            }catch (e){
                if (e) Toast(e);
                return;
            }
            await dialogContext.closeDialog();
        }
        }
        immediateSelect={!!props.tryName}
        selectedName={props.tryName}
    />
}
