/**
 * Created by andreas on 02.05.14.
 */

import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper,PropertyType} from '../util/keys.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Toast,{hideToast} from '../components/Toast.jsx';
import assign from 'object-assign';
import OverlayDialog from '../components/OverlayDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {ColorSelector, Checkbox, Radio, InputSelect, InputReadOnly} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import DimHandler from '../util/dimhandler';
import FullScreen from '../components/Fullscreen';
import {stateHelper} from "../util/GuiHelpers";
import Formatter from "../util/formatter";
import {SaveItemDialog} from "../components/LoadSaveDialogs";
import PropertyHandler from '../util/propertyhandler';
import {ItemActions} from "../components/FileDialog";
import loadSettings from "../components/LoadSettingsDialog";
import propertyhandler from "../util/propertyhandler";
import LocalStorage from '../util/localStorageManager';
import leavehandler from "../util/leavehandler";

const settingsSections={
    Layer:      [keys.properties.layers.base,keys.properties.layers.ais,keys.properties.layers.track,keys.properties.layers.nav,keys.properties.layers.boat,
        keys.properties.layers.grid,keys.properties.layers.compass,keys.properties.layers.scale,
        keys.properties.layers.user],
    UpdateTimes:[keys.properties.positionQueryTimeout,keys.properties.trackQueryTimeout,keys.properties.aisQueryTimeout, keys.properties.networkTimeout ,
                keys.properties.connectionLostAlarm],
    Widgets:    [keys.properties.widgetFontSize,keys.properties.allowTwoWidgetRows,keys.properties.showClock,keys.properties.showZoom,keys.properties.showWind,keys.properties.showDepth],
    Buttons:    [keys.properties.style.buttonSize,keys.properties.cancelTop,keys.properties.buttonCols,keys.properties.showDimButton,keys.properties.showFullScreen,
        keys.properties.hideButtonTime,keys.properties.showButtonShade, keys.properties.autoHideNavPage,keys.properties.autoHideGpsPage,keys.properties.nightModeNavPage,
        keys.properties.showSplitButton],
    Layout:     [keys.properties.layoutName,keys.properties.baseFontSize,keys.properties.smallBreak,keys.properties.nightFade,
        keys.properties.nightChartFade,keys.properties.dimFade,keys.properties.localAlarmSound,keys.properties.alarmVolume ,
        keys.properties.titleIcons, keys.properties.titleIconsGps],
    AIS:        [keys.properties.aisDistance,keys.properties.aisWarningCpa,keys.properties.aisWarningTpa,
        keys.properties.aisShowEstimated,keys.properties.aisEstimatedOpacity,
        keys.properties.aisMinDisplaySpeed,keys.properties.aisOnlyShowMoving,
        keys.properties.aisFirstLabel,keys.properties.aisSecondLabel,keys.properties.aisThirdLabel,
        keys.properties.aisTextSize,keys.properties.aisUseCourseVector,keys.properties.aisCurvedVectors,keys.properties.aisRelativeMotionVectorRange,keys.properties.style.aisNormalColor,
        keys.properties.style.aisNearestColor, keys.properties.style.aisWarningColor,keys.properties.style.aisTrackingColor,
        keys.properties.aisIconBorderWidth,keys.properties.aisIconScale,keys.properties.aisClassbShrink,keys.properties.aisShowA,
        keys.properties.aisShowB,keys.properties.aisShowOther,keys.properties.aisUseHeading,
        keys.properties.aisReducedList,keys.properties.aisListUpdateTime, keys.properties.aisHideTime, keys.properties.aisLostTime],
    Navigation: [keys.properties.bearingColor,keys.properties.bearingWidth,keys.properties.navCircleColor,keys.properties.navCircleWidth,keys.properties.navCircle1Radius,keys.properties.navCircle2Radius,keys.properties.navCircle3Radius,
        keys.properties.navBoatCourseTime,keys.properties.boatIconScale,keys.properties.boatDirectionMode,
        keys.properties.boatDirectionVector,keys.properties.boatSteadyDetect,keys.properties.boatSteadyMax,
        keys.properties.courseAverageTolerance,keys.properties.gpsXteMax,keys.properties.courseAverageInterval,keys.properties.speedAverageInterval,keys.properties.positionAverageInterval,keys.properties.anchorWatchDefault,keys.properties.anchorCircleWidth,
        keys.properties.anchorCircleColor,keys.properties.windKnots,keys.properties.windScaleAngle,keys.properties.measureColor,keys.properties.measureRhumbLine],
    Map:        [keys.properties.autoZoom,keys.properties.mobMinZoom,keys.properties.style.useHdpi,
        keys.properties.clickTolerance,keys.properties.featureInfo,keys.properties.emptyFeatureInfo,
        keys.properties.mapFloat,keys.properties.mapScale,keys.properties.mapUpZoom,
        keys.properties.mapOnlineUpZoom,
        keys.properties.mapLockMode,keys.properties.mapLockMove,keys.properties.mapScaleBarText,keys.properties.mapZoomLock],
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
settingsConditions[keys.properties.aisMinDisplaySpeed]=(values)=>
    (values||{})[keys.properties.aisOnlyShowMoving]||(values||{})[keys.properties.aisShowEstimated]
settingsConditions[keys.properties.aisEstimatedOpacity]=(values)=>
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

const CheckBoxSettingsItem=(props)=>{
    return (
        <Checkbox
            className={props.className}
            onChange={props.onClick}
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
                lprops.onClick(newProps);
            }}
            label={props.label}
            value={props.value}/>)}
    </div>);
};

const rangeItemDialog=(item)=>{
    class Dialog extends React.Component{
        constructor(props){
            super(props);
            this.state={
                value: item.value
            };
            this.valueChange=this.valueChange.bind(this);
            this.buttonClick=this.buttonClick.bind(this);
        }
        valueChange(ev){
            this.setState({value: ev.target.value});
        }

        buttonClick(ev){
            let button=ev.target.name;
            if (button == 'ok'){
                if (this.state.value < item.values[0]|| this.state.value > item.values[1]){
                    Toast("out of range");
                    return;
                }
                item.onClick(this.state.value);
            }
            if (button == 'reset'){
                this.setState({
                    value: item.defaultv
                });
                return;
            }
            hideToast();
            this.props.closeCallback();
        }
        render() {
            let range=item.values[0]+"..."+item.values[1];
            return(
                <div className="settingsDialog inner">
                    <h3><span >{item.label}</span></h3>
                    <div className="settingsRange">Range: {range}</div>
                    <div className="dialogRow">
                        <span className="inputLabel">Value</span>
                            <input type="number"
                                   min={item.values[0]}
                                   max={item.values[1]}
                                   step={item.values[2]||1}
                                   name="value" onChange={this.valueChange} value={this.state.value}/>
                    </div>
                    <div className="dialogButtons">
                        <DB name="reset" onClick={this.buttonClick}>Reset</DB>
                        <DB name="cancel" onClick={this.buttonClick}>Cancel</DB>
                        <DB name="ok" onClick={this.buttonClick}>OK</DB>
                    </div>
                </div>
            );
        }
    };
    OverlayDialog.dialog(Dialog);
};
const RangeSettingsItem=(properties)=> {
    return <div className={properties.className}
                onClick={function(ev){
                            rangeItemDialog(properties);
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
                onChange={function(newVal){
                            properties.onClick(newVal);
                        }}
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
            onChange={function(newVal){
                properties.onClick(newVal);
            }}
            itemList={items}
            changeOnlyValue={true}
            value={value}
            label={properties.label}
            resetCallback={(ev)=>{
                properties.onClick(properties.defaultv);
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
               onChange={properties.onClick}
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
    const changeFunction=(newVal)=>{
        if (LayoutHandler.isEditing()) {
            isEditing();
            return;
        }
        LayoutHandler.loadLayout(newVal)
            .then((layout)=>{
                props.onClick(newVal);
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
                props.onClick(props.defaultv)
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
                    if (values[keys.properties.layoutName] != globalStore.getData(keys.properties.layoutName)){
                        if (! LayoutHandler.hasLoaded(values[keys.properties.layoutName])){
                            Toast("layout not loaded, cannot activate it");
                            return;
                        }
                        LayoutHandler.activateLayout();
                    }
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
                            promises.push(LayoutHandler.loadLayout(masterValues[key]));
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
                        window.location.href = window.location.href;
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
            return OverlayDialog.confirm("discard changes?");
        }
        else {
            return new Promise((resolve,reject)=>{
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
                    for (let idx in settings){
                        if (settings[idx].value === newName) return {existing:true};
                    }
                    return {}
                }
                return SaveItemDialog.createDialog(proposedName,checkFunction,{
                    title: "Select Name to save settings",
                    itemLabel: 'Settings',
                    fixedPrefix: 'user.'
                })
            })
            .then((settingsName)=>{
                if (!settingsName || settingsName === 'user.'){
                    return Promise.reject();
                }
                proposedName=settingsName;
                return PropertyHandler.uploadSettingsData(
                    settingsName,
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
    changeItem(item,value){
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
                        let name = LayoutHandler.nameToBaseName(LayoutHandler.name);
                        SaveItemDialog.createDialog(name,(newName)=>{
                            return {existing:list.indexOf(newName) >= 0};
                        },{
                            title: "Start Layout Editor",
                            itemLabel: 'Layout',
                            subtitle: "save changes to",
                            fixedPrefix: 'user.',
                            allowOverwrite: true
                        })
                            .then((newName)=> {
                                LayoutHandler.startEditing(newName);
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
            LayoutFinishedDialog.createDialog()
                .then((result)=>{
                    //we need to write the changed value also in our display values
                    self.changeItem({name:keys.properties.layoutName},LayoutHandler.name);
                })
                .catch((error)=>{});
        }
    };

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
    sectionClick(item){
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
