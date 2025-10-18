/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper,PropertyType} from '../util/keys.jsx';
import React from 'react';
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
import {stateHelper} from "../util/GuiHelpers";
import Formatter from "../util/formatter";
import PropertyHandler from '../util/propertyhandler';
import {ItemActions} from "../components/FileDialog";
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
import DialogButton from "../components/DialogButton";

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
        return <InputSelect
            {...getCommonParam({ep:this,currentValues,className,initialValues,onChange:changeFunction,children})}
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

class SettingsPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            {
                name:'SettingsOK',
                onClick:()=>{
                    if (! this.leftPanelVisible()){
                        this.handlePanel(undefined);
                        return;
                    }
                    this.saveChanges()
                        .then(()=>this.props.history.pop())
                        .catch((err)=>{Toast(err+"")})
                }
            },
            {
                name: 'SettingsDefaults',
                onClick:()=> {
                    this.confirmAbortOrDo(false).then(()=> {
                        this.resetData();
                    });
                }
            },
            {
                name: 'SettingsSplitReset',
                storeKeys:{
                    editing: keys.gui.global.layoutEditing
                },
                updateFunction:(state)=>{
                    return {visible: !state.editing && LocalStorage.hasPrefix()}
                },
                onClick:()=>{
                    let masterValues=propertyhandler.getMasterValues();
                    let promises=[];
                    for (let key in masterValues){
                        let description = KeyHelper.getKeyDescriptions()[key];
                        if (description.type === PropertyType.LAYOUT){
                            promises.push(layoutLoader.loadLayout(masterValues[key]));
                        }
                    }
                    Promise.all(promises)
                        .then(()=> this.values.setState(masterValues))
                        .catch((e)=>Toast(e));
                },
                overflow: true
            },
            {
                name:'SettingsAndroid',
                visible: globalStore.getData(keys.gui.global.onAndroid,false),
                onClick:()=>{
                    this.confirmAbortOrDo(true).then(()=> {
                        this.props.history.pop();
                        avnav.android.showSettings();
                    });
                }
            },
            {
                name: 'SettingsLayout',
                onClick:()=>{
                    this.handleLayoutClick();
                },
                updateFunction:(state)=>{
                    return {
                        toggle:state.toggle,
                        visible: ! state.cap || state.con
                    }
                },
                storeKeys:{
                    toggle: keys.gui.global.layoutEditing,
                    cap: keys.gui.capabilities.uploadLayout,
                    con: keys.properties.connectedMode
                }
            },
            {
                name: 'SettingsAddons',
                onClick:()=>{
                    this.confirmAbortOrDo(true).then(()=>{
                        this.props.history.push("addonconfigpage");
                    });
                },
                storeKeys:{
                    visible:keys.properties.connectedMode
                }
            },
            {
                name: 'SettingsSave',
                onClick:()=>this.saveSettings(),
                storeKeys:{
                    editing: keys.gui.global.layoutEditing,
                    connected:keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction:(state)=>{
                    return {
                        visible: ! state.editing && state.connected && state.allowed
                    }
                },
                overflow: true
            },
            {
                name: 'SettingsLoad',
                onClick:()=>{
                    this.confirmAbortOrDo().then(()=>{
                        this.resetChanges();
                        this.loadSettings();
                    });
                },
                storeKeys:{
                    editing: keys.gui.global.layoutEditing,
                    connected:keys.properties.connectedMode,
                    allowed: keys.gui.capabilities.uploadSettings
                },
                updateFunction:(state)=>{
                    return {
                        visible: ! state.editing && state.connected && state.allowed
                    }
                },
                overflow: true
            },
            {
                name: 'SettingsReload',
                onClick: ()=> {
                    this.confirmAbortOrDo(true).then(() => {
                        leavehandler.stop();
                        Helper.reloadPage();
                    });
                },
                storeKeys:{
                    visible: keys.gui.global.layoutEditing,
                },
                updateFunction:(state)=>{
                    return {
                        visible: ! state.visible
                    }
                },
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{
                    if (! this.leftPanelVisible()){
                        this.handlePanel(undefined);
                        return;
                    }
                    this.confirmAbortOrDo(true).then(()=> {
                        this.props.history.pop();
                });
                }
            }
        ];
        this.resetData=this.resetData.bind(this);
        this.hasChanges=this.hasChanges.bind(this);
        this.leftPanelVisible=this.leftPanelVisible.bind(this);
        this.handlePanel=this.handlePanel.bind(this);
        this.sectionClick=this.sectionClick.bind(this);
        this.handleLayoutClick=this.handleLayoutClick.bind(this);
        this.changeItem=this.changeItem.bind(this);
        this.confirmAbortOrDo=this.confirmAbortOrDo.bind(this);
        this.flattenedKeys=KeyHelper.flattenedKeys(keys.properties);
        this.state={
            leftPanelVisible:true,
            section:'Layer'
        };
        this.initialValues=this.getStoreValues();
        this.values=stateHelper(this,this.initialValues);
        this.layoutSettings=stateHelper(this,LayoutHandler.getLayoutProperties(),'layoutSettings');
        this.defaultValues={};
        this.flattenedKeys.forEach((key)=>{
            let description=KeyHelper.getKeyDescriptions()[key];
            if (description){
                this.defaultValues[key] = description.defaultv;
            }
        })
        this.renderItemCache={};

    }
    getStoreValues(){
        return globalStore.getMultiple(this.flattenedKeys,true);
    }
    saveChanges(){
        if (! this.hasChanges()) return Promise.resolve(true);
        let values=this.values.getValues(true);
        //if the layout changed we need to set it
        const layoutName = values[keys.properties.layoutName];
        const finish=()=>{
            if (LayoutHandler.isEditing()){
                if (this.layoutSettings.isChanged()){
                    LayoutHandler.updateLayoutProperties(this.layoutSettings.getState(true));
                }
            }
            else {
                LayoutHandler.activateLayout();
                globalStore.storeMultiple(values);
            }
            this.resetChanges();
            return true;
        }
        if (!LayoutHandler.hasLoaded(layoutName) && ! LayoutHandler.isEditing()) {
            values[keys.properties.layoutName]=this.initialValues[keys.properties.layoutName];
            return layoutLoader.loadLayout(layoutName)
                .then((layout) => {
                    LayoutHandler.setLayoutAndName(layout,layoutName)
                    return finish();
                })
        }
        return Promise.resolve(finish());
    }
    /**
     * will check for changes and revert or save changes
     * @returns {Promise}
     */
    confirmAbortOrDo(allowSave){
        if (this.hasChanges()) {
            if (allowSave) {
                return showPromiseDialog(undefined, (props) => <HasChangesDialog {...props} />)
                    .then((save) => {
                        if (save) {
                            return this.saveChanges();
                        } else {
                            this.resetChanges();
                            return true;
                        }
                    })
            }
            else{
                return showPromiseDialog(undefined, (props) => <ConfirmDialog {...props}
                    text={"discard settings changes?"}/>)
            }
        }
        else {
            return Promise.resolve(0);
        }
    }
    saveSettings(){
        let actions=ItemActions.create('settings');
        let oldName=globalStore.getData(keys.properties.lastLoadedName).replace(/-*[0-9]*$/,'');
        let suffix=Formatter.formatDateTime(new Date()).replace(/[: /]/g,'').replace(/--/g,'');
        let proposedName=actions.nameForUpload(oldName+"-"+suffix);
        PropertyHandler.listSettings(true)
            .then((settings)=>{
                const checkFunction=(newName)=>{
                    return checkName(newName,settings,(item)=>item.label+".json");
                }
                return showPromiseDialog(undefined,(dprops)=><ItemNameDialog
                    {...dprops}
                    fixedPrefix={'user.'}
                    fixedExt={'json'}
                    title={"Select Name to save settings"}
                    iname={proposedName}
                    checkName={checkFunction}
                    />)
                    .then((res)=>res.name)
                })
            .then((settingsName)=>{
                if (!settingsName || settingsName === 'user.'){
                    return Promise.reject();
                }
                proposedName=actions.nameForUpload(settingsName);
                return PropertyHandler.uploadSettingsData(
                    proposedName,
                    PropertyHandler.exportSettings(this.values.getValues(true)),
                    true
                )
            })
            .then((res)=> {
                globalStore.storeData(keys.properties.lastLoadedName,proposedName);
                Toast("settings saved");
            })
            .catch((e)=>{
                if (e)Toast(e);
            })

    }
    loadSettings(){
        loadSettings(this.values.getState(),globalStore.getData(keys.properties.lastLoadedName))
            .then((settings)=>this.values.setState(settings,true))
            .catch((e)=>{
                if (e) Toast(e);
            })
    }
    changeItem(key,value){
        if (LayoutHandler.isEditing()){
            this.layoutSettings.setValue(key,value);
        }
        else{
            if (key in this.layoutSettings.getState()) {
                Toast("cannot change layout settings when not editing");
                return;
            }
            this.values.setValue(key,value);
            if (key === keys.properties.lastLoadedName){
                layoutLoader.loadLayout(value)
                    .then((layout)=>{
                        const layoutSettings=LayoutHandler.getLayoutProperties(layout);
                        this.layoutSettings.setState(layoutSettings,true);
                    })
                    .catch((e)=>{Toast(e+"")})
            }
        }
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.small !== prevProps.small && prevProps.small && ! this.state.leftPanelVisible){
            this.setState({leftPanelVisible: true});
        }
    }

    resetChanges(){
        this.initialValues=this.getStoreValues();
        this.values.reset(this.initialValues);
        this.layoutSettings.reset(LayoutHandler.getLayoutProperties());
    }

    handleLayoutClick(){
        let isEditing=LayoutHandler.isEditing();
        if (! isEditing){
            let startDialog=()=> {
                layoutLoader.listLayouts()
                    .then((list)=> {
                        showPromiseDialog(undefined,(dprops)=><ItemNameDialog
                            {...dprops}
                            title={"Start Layout Editor"}
                            iname={layoutLoader.nameToBaseName(LayoutHandler.name)}
                            fixedPrefix={'user.'}
                            fixedExt={'json'}
                            checkName={(newName)=> {
                                if (newName) {
                                    let checkName=newName.replace(/^user./,'').replace(/\.json$/,'');
                                    if (! checkName){
                                        return {
                                            error:'name must not be empty',
                                            proposal: layoutLoader.nameToBaseName(LayoutHandler.name)
                                        }
                                    }
                                    if (checkName.indexOf('.') >= 0){
                                        return {
                                            error: 'names must not contain a .',
                                            proposal: checkName.replace(/\./g,'')
                                        }
                                    }
                                }
                                let cr=checkName(newName,undefined,undefined);
                                if (cr) return cr;
                                cr=checkName(newName,list,(item)=>item.name+'.json');
                                if (cr){
                                    return {
                                        info: "existing"
                                    }
                                }
                                else{
                                    return {
                                        info: "new"
                                    }
                                }
                            }}
                        />)
                            .then((res)=> {
                                LayoutHandler.startEditing(layoutLoader.fileNameToServerName(res.name));
                                this.props.history.pop();
                            })
                            .catch(()=> {
                            })
                    })
                    .catch((error)=> {
                        Toast("cannot start layout editing: " + error)
                    });
            };
            if (! this.hasChanges()){
                startDialog();
                return;
            }
            this.confirmAbortOrDo(true).then(()=>{
                startDialog();
            }).catch(()=>{});
        }
        else{
            const dialog=()=>showDialog(undefined,
                ()=><LayoutFinishedDialog finishCallback={()=>{
                    //potentially we did fallback to the old layout
                    this.layoutSettings.reset(LayoutHandler.getLayoutProperties());
                }}/> )
            if (! this.hasChanges()){
                dialog();
                return;
            }
            this.confirmAbortOrDo(true).then(()=>{
                dialog();
            },()=>{})
        }
    }

    resetData(){
        if (LayoutHandler.isEditing()){
            this.layoutSettings.setState({},true);
        }
        else {
            const oldLayoutName = this.values.getValue(keys.properties.layoutName);
            let values = assign({}, this.defaultValues);
            const newLayoutName = values[keys.properties.layoutName];
            this.values.setState(values, true);
            if (oldLayoutName !== newLayoutName){
                this.changeItem(keys.properties.layoutName,newLayoutName); //reset layoutSettings
            }
        }
    }
    hasChanges(){
        return this.values.isChanged() || this.layoutSettings.isChanged();
    }
    leftPanelVisible(){
        return this.state.leftPanelVisible;
    }
    handlePanel(section){
        if (section === undefined){
            this.setState({
                leftPanelVisible:true
            });
        }
        else {
            this.setState({
                leftPanelVisible: ! this.props.small,
                section:section
            });
        }
    }
    sectionClick(ev){
        const item=avitem(ev);
        this.handlePanel(item.name);
    }
    componentDidMount(){
    }
    render() {
        let leftVisible = this.state.leftPanelVisible;
        let rightVisible = !this.props.small || !leftVisible
        let leftClass = "sectionList";
        if (!rightVisible) leftClass += " expand";
        let currentSection = this.state.section|| 'Layer';
        let sectionItems = [];
        for (let s in settingsSections) {
            let sectionCondition=sectionConditions[s];
            if (sectionCondition !== undefined){
                if (! sectionCondition()) continue;
            }
            let item = {name: s};
            if (s === currentSection) item.activeItem = true;
            sectionItems.push(item);
        }
        let hasCurrentSection=false;
        sectionItems.forEach((item)=>{
            if (item.name === currentSection){
                hasCurrentSection=true;
            }
        });
        if (! hasCurrentSection){
            currentSection=sectionItems[0].name;
            sectionItems[0].activeItem=true;
            //TODO: send up
        }
        let settingsItems = [];
        let sectionChanges={};
        let sectionHasLayoutSettings={};
        const layoutSettings=this.layoutSettings.getValues();
        const itemClasses={};
        for (let section in settingsSections) {
            for (let s in settingsSections[section]) {
                let key = settingsSections[section][s];
                if (key in this.layoutSettings.getValues()){
                    sectionHasLayoutSettings[section]=true;
                }
                if (settingsConditions[key] !== undefined){
                    if (! settingsConditions[key](this.values.getValues())) continue;
                }
                let description = KeyHelper.getKeyDescriptions()[key];
                let value=this.values.getValue(key);
                let className="listEntry";
                if (value !== this.defaultValues[key]){
                    if (! sectionChanges[section]) sectionChanges[section]={};
                    sectionChanges[section].isDefault=false;
                }
                if (this.values.isItemChanged(key)) {
                    if (! sectionChanges[section]) sectionChanges[section]={};
                    sectionChanges[section].isChanged=true;
                }
                if (propertyhandler.isPrefixProperty(key)){
                    className+=" prefix";
                }
                if (key in layoutSettings){
                    className+=" layoutSetting";
                }
                if (section === currentSection) {
                    let item = {...description,
                        name: key,
                    };
                    //do not recreate items on each render
                    //as this would loose focus on every change
                    //to avoid a separate creation step
                    //we simply keep every item that has been rendered available
                    //as only then it needs to be persistent
                    let uiItem=this.renderItemCache[item.name];
                    if ( uiItem === undefined ){
                        uiItem=itemUiFromPlain(item);
                        this.renderItemCache[item.name]=uiItem;
                    }
                    settingsItems.push(uiItem);
                    itemClasses[key]=className;
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
            if (sectionHasLayoutSettings[sitem.name]){
                className+=" layoutSetting";
            }
            sitem.className = className;
        });
        const layoutEditing=LayoutHandler.isEditing();
        const title=layoutEditing?"LayoutSettings":"Settings";
        const currentValues={...this.values.getState(),...this.layoutSettings.getState()};
        return <PageFrame
            {...this.props}
            id={'settingspage'}
            >
            <PageLeft
                title={title+((this.props.small && !this.state.leftPanelVisible)?" "+this.state.section:"")}
            >
                <div className="leftSection">
                    { leftVisible ? <ItemList
                        className={leftClass}
                        scrollable={true}
                        itemClass={SectionItem}
                        onItemClick={this.sectionClick}
                        itemList={sectionItems}
                    /> : null}
                    {rightVisible ? <div
                        className="settingsList dialogObjects">
                        <EditableParameterListUI
                            values={currentValues}
                            initialValues={this.initialValues}
                            parameters={settingsItems}
                            onChange={(nv)=>{
                                for (let k in nv){
                                    this.changeItem(k,nv[k]);
                                }}}
                            itemClassName={(param)=> Helper.concatsp('listEntry',itemClasses[param.name])}
                            itemchildren={(param)=>{
                                if (! (param.name in this.layoutSettings.getValues())  || ! layoutEditing) return null;
                                return <Button
                                    name={"SettingsLayoutOff"}
                                    className={"smallButton"}
                                    onClick={(ev)=>{
                                        ev.stopPropagation();
                                        this.layoutSettings.deleteValue(param.name);
                                    }}
                                />
                            }}
                        />
                    </div> : null}
                </div>
            </PageLeft>
            <ButtonList
                itemList={this.buttons}
            />
        </PageFrame>
    }
}
SettingsPage.propTypes=Page.pageProperties;
export default SettingsPage;
