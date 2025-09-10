/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper,PropertyType} from '../util/keys.jsx';
import React, {useState} from 'react';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import assign from 'object-assign';
import {
    DialogButtons,
    DialogFrame, showDialog,
    showPromiseDialog,
    useDialogContext
} from '../components/OverlayDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {ColorSelector, Checkbox, Radio, InputSelect, InputReadOnly, Input} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
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
import Helper, {avitem, injectav, setav} from "../util/helper";

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
        keys.properties.autoUpdateUserCss,keys.properties.keyModeEdit],
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

const createValueChanged=(props)=>{
    return (value)=> {
        props.onClick(setav(undefined, {value: value}));
    }
}
const CheckBoxSettingsItem=(props)=>{
    return (
        <Checkbox
            className={props.className}
            onChange={createValueChanged(props)}
            label={props.label}
            value={props.value}/>
    );
};
const CheckBoxListSettingsItem=(lprops)=>{
    let current=lprops.value;
    if (typeof(current) !== 'object') return null;
    let dl=[];
    for (let k in current){
        dl.push({label:k,value:current[k]})
    }
    return (<div>
        {dl.map((props)=>
        <Checkbox
            className={lprops.className}
            onChange={(nv)=>{
                let newProps=assign({},current);
                newProps[props.label]=nv;
                const cf=createValueChanged(lprops);
                cf(newProps);
            }}
            key={props.label}
            label={props.label}
            value={props.value}/>)}
    </div>);
};


const RangeItemDialog=({value,values,defaultv,label,resolveFunction})=>{
            const [cvalue,setValue]=useState(value);
            let range=values[0]+"..."+values[1];
            const dialogContext=useDialogContext();
            return(
                <DialogFrame className="settingsDialog" title={label}>
                    <div className="settingsRange">Range: {range}</div>
                    <Input
                        dialogRow={true}
                        type={"number"}
                        label={"Value"}
                        min={values[0]} max={values[1]} step={values[2]||1}
                        value={cvalue}
                        onChange={(v)=>setValue(v)}
                    />
                    <DialogButtons >
                        <DB name="reset" onClick={()=>setValue(defaultv)} close={false} visible={defaultv !== undefined} >Reset</DB>
                        <DB name="cancel" >Cancel</DB>
                        <DB name="ok" onClick={()=>{
                            if (cvalue < values[0]|| cvalue > values[1]) {
                                Toast("out of range");
                                return;
                            }
                            dialogContext.closeDialog();
                            resolveFunction(cvalue);
                        }}
                            close={false}
                        >OK</DB>
                    </DialogButtons>
                </DialogFrame>
            );
        };
const RangeSettingsItem=(properties)=> {
    const dialogContext=useDialogContext();
    return <div className={properties.className}
                onClick={()=>{
                        dialogContext.showDialog(()=>{
                            return <RangeItemDialog
                                {...properties}
                                resolveFunction={createValueChanged(properties)}/>
                        })
                        }}>
        <div className="label">{properties.label}</div>
        <div className="value">{properties.value}</div>
    </div>;
};

const ListSettingsItem=(properties)=> {
    let items=[];
    for (let k in properties.values){
        let nv=properties.values[k].split(":");
        if (nv.length > 1){
            items.push({label:nv[0],value:nv[1]});
        }
        else{
            items.push( {label:nv[0],value:nv[0]});
        }
    }
    return <div className={properties.className}>
            <div className="label">{properties.label}</div>
            <Radio
                onChange={createValueChanged(properties)}
                itemList={items}
                value={properties.value}>
            </Radio>
          </div>
};

const SelectSettingsItem=(properties)=> {
    let items=[];
    let value=properties.value;
    for (let k in properties.values){
        let cv=properties.values[k];
        if (typeof(cv) !== 'object') {
            let nv = cv.split(":");
            if (nv.length > 1) {
                cv={label: nv[0], value: nv[1]};
            } else {
                cv={label: nv[0], value: nv[0]};
            }
        }
        items.push({label:cv.label,value:cv.value});
        if (cv.value === properties.value){
            value={label:cv.label,value:cv.value};
        }
    }
    return(
        <InputSelect
            className={properties.className}
            onChange={createValueChanged(properties)}
            itemList={items}
            changeOnlyValue={true}
            value={value}
            label={properties.label}
            resetCallback={(ev)=>{
                const cf=createValueChanged(properties);
                cf(properties.defaultv);
            }}
        >
        </InputSelect>
    )
};




const ColorSettingsItem=(properties)=>{
    let style={
        backgroundColor: properties.value
    };

    return <ColorSelector
               className={properties.className}
               onChange={createValueChanged(properties)}
               label={properties.label}
               default={properties.defaultv}
               value={properties.value}
        />
        ;
};

const createSettingsItem=(item)=>{
    if (item.type == PropertyType.CHECKBOX){
        return CheckBoxSettingsItem;
    }
    if (item.type == PropertyType.MULTICHECKBOX){
        return CheckBoxListSettingsItem;
    }
    if (item.type == PropertyType.RANGE){
        return RangeSettingsItem;
    }
    if (item.type == PropertyType.COLOR){
        return ColorSettingsItem;
    }
    if (item.type == PropertyType.LAYOUT){
        return LayoutItem;
    }
    if (item.type == PropertyType.LIST){
        return ListSettingsItem;
    }
    if (item.type == PropertyType.SELECT){
        return SelectSettingsItem;
    }
    return (props)=>{
        return (<div className={props.className}>
            <div className="label">{props.label}</div>
            <div className="value">{props.value}</div>
        </div>)
    }
};

const LayoutItem=(props)=>
{
    const isEditing=()=>{
        Toast("cannot change layout during editing");
    }
    if (LayoutHandler.isEditing()){
        props=assign({},props,
            {value:LayoutHandler.name});
        return <InputReadOnly
            className={props.className}
            label={props.label}
            value={props.value}
            onClick={isEditing}
        />
    }
    const valueChanged=createValueChanged(props);
    const changeFunction=(newVal)=>{
        if (LayoutHandler.isEditing()) {
            isEditing();
            return;
        }
        LayoutHandler.loadLayout(newVal,true)
            .then((layout)=>{
                valueChanged(newVal);
            })
            .catch((error)=>{
                Toast(error+"");
            })
    };
    return <InputSelect
            className={props.className}
            onChange={changeFunction}
            itemList={(currentLayout)=>{
                return new Promise((resolve,reject)=>{
                   LayoutHandler.listLayouts()
                       .then((list)=>{
                           let displayList=[];
                           list.forEach((el)=>{
                               let le={label:el.name,value:el.name};
                               if (currentLayout === el.name ) le.selected=true;
                               displayList.push(le);
                           });
                           resolve(displayList);
                       })
                       .catch((e)=>reject(e))
                });
            }}
            changeOnlyValue={true}
            value={props.value}
            label={props.label}
            resetCallback={(ev)=>{
                valueChanged(props.defaultv)
            }}
        />;
};


class SettingsPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name:'SettingsOK',
                onClick:()=>{
                    if (! self.leftPanelVisible()){
                        self.handlePanel(undefined);
                        return;
                    }
                    if (!self.hasChanges()){
                        this.props.history.pop();
                        return;
                    }
                    let values=self.values.getValues(true);
                    //if the layout changed we need to set it
                    const layoutName = values[keys.properties.layoutName];
                    if (!LayoutHandler.hasLoaded(layoutName)) {
                        LayoutHandler.loadLayout(layoutName)
                            .then((res) => {
                                LayoutHandler.activateLayout();
                                globalStore.storeMultiple(values);
                                this.props.history.pop();
                            })
                            .catch((err) => Toast(err));
                        return;
                    }
                    LayoutHandler.activateLayout();
                    globalStore.storeMultiple(values);
                    this.props.history.pop();
                }
            },
            {
                name: 'SettingsDefaults',
                onClick:()=> {
                    self.confirmAbortOrDo().then(()=> {
                        self.resetData();
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
                            promises.push(LayoutHandler.loadLayout(masterValues[key],true));
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
                    self.confirmAbortOrDo().then(()=> {
                        self.resetChanges();
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
                    self.confirmAbortOrDo().then(()=>{
                        self.resetChanges();
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
                visible: globalStore.getData(keys.properties.connectedMode,false) && globalStore.getData(keys.gui.capabilities.uploadSettings),
                overflow: true
            },
            {
                name: 'SettingsLoad',
                onClick:()=>{
                    self.confirmAbortOrDo().then(()=>{
                        self.resetChanges();
                        this.loadSettings();
                    });
                },
                visible: globalStore.getData(keys.properties.connectedMode,false) && globalStore.getData(keys.gui.capabilities.uploadSettings),
                overflow: true
            },
            {
                name: 'SettingsReload',
                onClick: ()=> {
                    self.confirmAbortOrDo().then(() => {
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
                    if (! self.leftPanelVisible()){
                        self.handlePanel(undefined);
                        return;
                    }
                    self.confirmAbortOrDo().then(()=> {
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
        this.MainContent=this.MainContent.bind(this);
        this.flattenedKeys=KeyHelper.flattenedKeys(keys.properties);
        this.state={
            leftPanelVisible:true,
            section:'Layer'
        };
        this.values=stateHelper(this,globalStore.getMultiple(this.flattenedKeys));
        this.defaultValues={};
        this.flattenedKeys.forEach((key)=>{
            let description=KeyHelper.getKeyDescriptions()[key];
            if (description){
                this.defaultValues[key] = description.defaultv;
            }
        })

    }
    /**
     * will fire a confirm dialog and resolve to 1 on changes, resolve to 0 on no changes
     * @returns {Promise}
     */
    confirmAbortOrDo(){
        if (this.hasChanges()) {
            return new Promise((resolve)=>{
                showPromiseDialog(undefined,(props)=><ConfirmDialog {...props} text={"discard changes?"}/>)
                    .then(()=>{
                        resolve(0);
                    })
                    .catch((e)=>{
                        console.log(e);
                    })
            })
        }
        else {
            return new Promise((resolve)=>{
                resolve(0);
            });
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
    changeItem(ev){
        const item=avitem(ev);
        const value=avitem(ev,'value')
        this.values.setValue(item.name,value);
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (this.props.small !== prevProps.small && prevProps.small && ! this.state.leftPanelVisible){
            this.setState({leftPanelVisible: true});
        }
    }

    resetChanges(){
        this.values.setState(globalStore.getMultiple(this.flattenedKeys),true);
    }

    handleLayoutClick(){
        let self=this;
        let isEditing=LayoutHandler.isEditing();
        if (! isEditing){
            let startDialog=()=> {
                LayoutHandler.listLayouts()
                    .then((list)=> {
                        showPromiseDialog(undefined,(dprops)=><ItemNameDialog
                            {...dprops}
                            title={"Start Layout Editor"}
                            iname={LayoutHandler.nameToBaseName(LayoutHandler.name)}
                            fixedPrefix={'user.'}
                            fixedExt={'json'}
                            checkName={(newName)=> {
                                if (newName) {
                                    let checkName=newName.replace(/^user./,'').replace(/\.json$/,'');
                                    if (! checkName){
                                        return {
                                            error:'name must not be empty',
                                            proposal: LayoutHandler.nameToBaseName(LayoutHandler.name)
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
                                LayoutHandler.startEditing(LayoutHandler.fileNameToServerName(res.name));
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
            self.confirmAbortOrDo().then(()=>{
                this.resetChanges();
                startDialog();
            }).catch(()=>{});
        }
        else{
            showDialog(undefined,()=><LayoutFinishedDialog finishCallback={()=>this.changeItem({name:keys.properties.layoutName},LayoutHandler.name)}/> )
        }
    }

    resetData(){
        let values=assign({},this.defaultValues);
        this.values.setState(values,true);
    }
    hasChanges(){
        return this.values.isChanged();
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
    MainContent(props){
        let self=this;
        let leftVisible = props.leftPanelVisible;
        let rightVisible = !props.small || !props.leftPanelVisible;
        let leftClass = "sectionList";
        if (!rightVisible) leftClass += " expand";
        let currentSection = props.section|| 'Layer';
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
        for (let section in settingsSections) {
            for (let s in settingsSections[section]) {
                let key = settingsSections[section][s];
                if (settingsConditions[key] !== undefined){
                    if (! settingsConditions[key](self.values.getValues())) continue;
                }
                let description = KeyHelper.getKeyDescriptions()[key];
                let value=self.values.getValue(key);
                let className="listEntry";
                if (value === this.defaultValues[key]){
                    className+=" defaultValue";
                }
                else{
                    if (! sectionChanges[section]) sectionChanges[section]={};
                    sectionChanges[section].isDefault=false;
                }
                if (this.values.isItemChanged(key)) {
                    className+=" changed";
                    if (! sectionChanges[section]) sectionChanges[section]={};
                    sectionChanges[section].isChanged=true;
                }
                if (propertyhandler.isPrefixProperty(key)){
                    className+=" prefix";
                }
                if (section === currentSection) {
                    let item = assign({}, description, {
                        name: key,
                        value: value,
                        className: className
                    });
                    settingsItems.push(item);
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
            sitem.className = className;
        });
        return (
            <div className="leftSection">
                { leftVisible ? <ItemList
                    className={leftClass}
                    scrollable={true}
                    itemClass={SectionItem}
                    onItemClick={self.sectionClick}
                    itemList={sectionItems}
                /> : null}
                {rightVisible ? <ItemList
                    className="settingsList"
                    scrollable={true}
                    itemCreator={createSettingsItem}
                    itemList={settingsItems}
                    onItemClick={self.changeItem}
                /> : null}
            </div>);
    };
    render() {
        let self = this;
        let MainContent=this.MainContent;
        return (
            <Page
                {...self.props}
                id="settingspage"
                mainContent={
                            <MainContent
                                section={self.state.section}
                                leftPanelVisible={self.state.leftPanelVisible}
                                small={self.props.small}
                            />
                        }
                buttonList={self.buttons}
                title={"Settings"+((self.props.small && !self.state.leftPanelVisible)?" "+self.state.section:"")}
                />);
    }
}
SettingsPage.propTypes=Page.pageProperties;
export default SettingsPage;
