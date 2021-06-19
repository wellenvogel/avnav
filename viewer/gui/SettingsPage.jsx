/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper,PropertyType} from '../util/keys.jsx';
import React from 'react';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Toast,{hideToast} from '../components/Toast.jsx';
import assign from 'object-assign';
import OverlayDialog from '../components/OverlayDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutNameDialog from '../components/LayoutNameDialog.jsx';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import {Input,ColorSelector,Checkbox,Radio} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import DimHandler from '../util/dimhandler';
import FullScreen from '../components/Fullscreen';

const settingsSections={
    Layer:      [keys.properties.layers.base,keys.properties.layers.ais,keys.properties.layers.track,keys.properties.layers.nav,keys.properties.layers.boat,keys.properties.layers.grid,keys.properties.layers.compass],
    UpdateTimes:[keys.properties.positionQueryTimeout,keys.properties.trackQueryTimeout,keys.properties.aisQueryTimeout, keys.properties.networkTimeout ],
    Widgets:    [keys.properties.widgetFontSize,keys.properties.allowTwoWidgetRows,keys.properties.showClock,keys.properties.showZoom,keys.properties.showWind,keys.properties.showDepth],
    Buttons:    [keys.properties.style.buttonSize,keys.properties.cancelTop,keys.properties.buttonCols,keys.properties.showDimButton,keys.properties.showFullScreen,
        keys.properties.hideButtonTime,keys.properties.showButtonShade, keys.properties.autoHideNavPage,keys.properties.autoHideGpsPage,keys.properties.nightModeNavPage],
    Layout:     [keys.properties.layoutName,keys.properties.baseFontSize,keys.properties.smallBreak,keys.properties.nightFade,
        keys.properties.nightChartFade,keys.properties.dimFade,keys.properties.localAlarmSound ],
    AIS:        [keys.properties.aisDistance,keys.properties.aisWarningCpa,keys.properties.aisWarningTpa,
        keys.properties.aisMinDisplaySpeed,keys.properties.aisOnlyShowMoving,
        keys.properties.aisTextSize,keys.properties.aisUseCourseVector,keys.properties.style.aisNormalColor,keys.properties.style.aisNearestColor,
        keys.properties.style.aisWarningColor,keys.properties.aisIconBorderWidth,keys.properties.aisIconScale],
    Navigation: [keys.properties.bearingColor,keys.properties.bearingWidth,keys.properties.navCircleColor,keys.properties.navCircleWidth,keys.properties.navCircle1Radius,keys.properties.navCircle2Radius,keys.properties.navCircle3Radius,
        keys.properties.navBoatCourseTime,keys.properties.boatIconScale,keys.properties.boatDirectionMode,
        keys.properties.boatDirectionVector,keys.properties.courseAverageTolerance,keys.properties.gpsXteMax,keys.properties.courseAverageInterval,keys.properties.speedAverageInterval,keys.properties.positionAverageInterval,keys.properties.anchorWatchDefault,keys.properties.anchorCircleWidth,
        keys.properties.anchorCircleColor,keys.properties.windKnots,keys.properties.windScaleAngle,keys.properties.measureColor],
    Map:        [keys.properties.autoZoom,keys.properties.mobMinZoom,keys.properties.style.useHdpi,keys.properties.clickTolerance,keys.properties.featureInfo,keys.properties.emptyFeatureInfo,keys.properties.mapFloat,keys.properties.mapScale,keys.properties.mapUpZoom,keys.properties.mapOnlineUpZoom,
        keys.properties.mapLockMode],
    Track:      [keys.properties.trackColor,keys.properties.trackWidth,keys.properties.trackInterval,keys.properties.initialTrackLength],
    Route:      [keys.properties.routeColor,keys.properties.routeWidth,keys.properties.routeWpSize,keys.properties.routingTextSize,keys.properties.routeApproach,keys.properties.routeShowLL],
    Remote:     [keys.properties.remoteChannelName,keys.properties.remoteChannelRead,keys.properties.remoteChannelWrite,keys.properties.remoteGuardTime]
};

const settingsConditions={
};

settingsConditions[keys.properties.dimFade]=()=>DimHandler.canHandle();
settingsConditions[keys.properties.showDimButton]=()=>DimHandler.canHandle();
settingsConditions[keys.properties.showFullScreen]=()=>FullScreen.fullScreenAvailable();
settingsConditions[keys.properties.boatDirectionVector]=()=>{
    let cur=globalStore.getData(keys.gui.settingspage.values,{})
    return cur[keys.properties.boatDirectionMode]!== 'cog';
}
settingsConditions[keys.properties.aisMinDisplaySpeed]=()=>globalStore.getData(keys.gui.settingspage.values,{})[keys.properties.aisOnlyShowMoving]

const sectionConditions={};
sectionConditions.Remote=()=>globalStore.getData(keys.gui.capabilities.remoteChannel) && window.WebSocket !== undefined;

/**
 * will fire a confirm dialog and resolve to 1 on changes, resolve to 0 on no changes
 * @returns {Promise}
 */
const confirmAbortOrDo=()=> {
    if (globalStore.getData(keys.gui.settingspage.hasChanges)) {
        return OverlayDialog.confirm("discard changes?");
    }
    else {
        return new Promise((resolve,reject)=>{
            resolve(0);
        });
    }
};

const SectionItem=(props)=>{
    let className=props.className?props.className+" listEntry":"listEntry";
    if (props.activeItem) className+=" activeEntry";
    return(
        <div className={className} onClick={props.onClick}>{props.name}</div>
    );
};

const CheckBoxSettingsItem=(props)=>{
    return (
        <Checkbox
            className={props.classsName+ " listEntry"}
            onChange={props.onClick}
            label={props.label}
            value={props.value}/>
    );
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
    return <div className={properties.className+ " listEntry"}
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
    return <div className={properties.className+ " listEntry"}>
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


const ColorSettingsItem=(properties)=>{
    let style={
        backgroundColor: properties.value
    };

    return <ColorSelector
               className={properties.className+ " listEntry"}
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
    return (props)=>{
        return (<div className="listEntry">
            <div className="label">{props.label}</div>
            <div className="value">{props.value}</div>
        </div>)
    }
};

const LayoutItem=(props)=>
{
    if (LayoutHandler.isEditing()){
        props=assign({},props,
            {value:LayoutHandler.name});
    }
    return ValueSetting(props, (item)=> {
        if (LayoutHandler.isEditing()) {
            Toast("cannot change layout during editing");
            return;
        }
        history.push("downloadpage", {
                downloadtype: 'layout',
                allowChange: false,
                selectItemCallback: (item)=> {
                    if (item.name == props.value) {
                        history.pop();
                        return;
                    }
                    //we selected a new layout
                    LayoutHandler.loadLayout(item.name)
                        .then((layout)=>{
                            let layoutProps=LayoutHandler.getLayoutProperties();
                            for (let k in layoutProps){
                                changeItem({name:k},layoutProps[k])
                            }
                            changeItem(props,item.name);
                            history.pop();
                        })
                        .catch((error)=>{
                            Toast(error+"");
                        })

                }
            }
        );
    });
};

const ValueSetting=(properties,clickHandler)=> {
    return <div className={properties.className+ " listEntry"}
                onClick={function(ev){
                            clickHandler(properties);
                        }}>
        <div className="label">{properties.label}</div>
        <div className="value">{properties.value}</div>
    </div>;
};

const changeItem=(item,value,opt_omitFlag)=>{
    let old=globalStore.getData(keys.gui.settingspage.values,{});
    let hasChanged=old[item.name]!== value;
    if (hasChanged){
        let changed={};
        changed[item.name]=value;
        globalStore.storeData(keys.gui.settingspage.values,assign({},old,changed));
        if (! opt_omitFlag) globalStore.storeData(keys.gui.settingspage.hasChanges,true);
    }
};




const DynamicPage=Dynamic(Page);
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
                        history.pop();
                        return;
                    }
                    let values=globalStore.getData(keys.gui.settingspage.values);
                    //if the layout changed we need to set it
                    if (values[keys.properties.layoutName] != globalStore.getData(keys.properties.layoutName)){
                        if (! LayoutHandler.hasLoaded(values[keys.properties.layoutName])){
                            Toast("layout not loaded, cannot activate it");
                            return;
                        }
                        LayoutHandler.activateLayout();
                    }
                    globalStore.storeMultiple(values);
                    history.pop();
                }
            },
            {
                name: 'SettingsDefaults',
                onClick:()=> {
                    confirmAbortOrDo().then(()=> {
                        self.resetData();
                    });
                }
            },
            {
                name:'SettingsAndroid',
                visible: globalStore.getData(keys.gui.global.onAndroid,false),
                onClick:()=>{
                    confirmAbortOrDo().then(()=> {
                        self.resetChanges();
                        history.pop();
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
                    confirmAbortOrDo().then(()=>{
                        self.resetChanges();
                        history.push("addonconfigpage");
                    });
                },
                storeKeys:{
                    visible:keys.properties.connectedMode
                }
            },
            Mob.mobDefinition,
            {
                name: 'Cancel',
                onClick: ()=>{
                    if (! self.leftPanelVisible()){
                        self.handlePanel(undefined);
                        return;
                    }
                    confirmAbortOrDo().then(()=> {
                    history.pop();
                });
                }
            }
        ];
        this.state={};
        this.resetData=this.resetData.bind(this);
        this.hasChanges=this.hasChanges.bind(this);
        this.leftPanelVisible=this.leftPanelVisible.bind(this);
        this.handlePanel=this.handlePanel.bind(this);
        this.sectionClick=this.sectionClick.bind(this);
        this.handleLayoutClick=this.handleLayoutClick.bind(this);
        this.flattenedKeys=KeyHelper.flattenedKeys(keys.properties);
        if (! (this.props.options && this.props.options.returning)) {
            globalStore.storeData(keys.gui.settingspage.leftPanelVisible, true);
            this.leftVisible = true;
            this.resetChanges();
            globalStore.storeData(keys.gui.settingspage.section, 'Layer');
        }

    }

    resetChanges(){
        let values = globalStore.getMultiple(this.flattenedKeys);
        globalStore.storeData(keys.gui.settingspage.values, values);
        globalStore.storeData(keys.gui.settingspage.hasChanges, false);
    }

    handleLayoutClick(){
        let isEditing=LayoutHandler.isEditing();
        if (! isEditing){
            let startDialog=()=> {
                let currentLayouts = [];
                let checkName = (name)=> {
                    name = LayoutHandler.fileNameToServerName(name);
                    for (let i = 0; i < currentLayouts.length; i++) {
                        if (currentLayouts[i].name === name) return true;
                    }
                    return false;
                };
                LayoutHandler.listLayouts()
                    .then((list)=> {
                        currentLayouts = list;
                        let name = LayoutHandler.nameToBaseName(LayoutHandler.name);
                        LayoutNameDialog.createDialog(name, checkName, "Start Layout Editor", "save changes to")
                            .then((newName)=> {
                                let layoutName = LayoutHandler.fileNameToServerName(newName);
                                LayoutHandler.startEditing(layoutName);
                                history.pop();
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
            confirmAbortOrDo().then(()=>{
                this.resetChanges();
                startDialog();
            }).catch(()=>{});
        }
        else{
            LayoutFinishedDialog.createDialog()
                .then((result)=>{
                    //we need to write the changed value also in our display values
                    changeItem({name:keys.properties.layoutName},LayoutHandler.name,true);
                })
                .catch((error)=>{});
        }
    };

    resetData(){
        let values=assign({},globalStore.getData(keys.gui.settingspage.values));
        let hasChanges=false;
        this.flattenedKeys.forEach((key)=>{
            let description=KeyHelper.getKeyDescriptions()[key];
            if (description){
                if (values[key] !== description.defaultv) {
                    hasChanges=true;
                    values[key] = description.defaultv;
                }
            }
        });
        globalStore.storeData(keys.gui.settingspage.values,values);
        globalStore.storeData(keys.gui.settingspage.hasChanges,hasChanges);
    }
    hasChanges(){
        return globalStore.getData(keys.gui.settingspage.hasChanges);
    }
    leftPanelVisible(){
        return this.leftVisible;
    }
    handlePanel(section){
        if (section === undefined){
            globalStore.storeData(keys.gui.settingspage.leftPanelVisible,true);
        }
        else {
            globalStore.storeData(keys.gui.settingspage.section, section);
            globalStore.storeData(keys.gui.settingspage.leftPanelVisible,false);
        }
    }
    sectionClick(item){
        this.handlePanel(item.name);
    }
    componentDidMount(){
    }

    render() {
        let self = this;
        let MainContent = (props)=> {
            let small = globalStore.getData(keys.gui.global.windowDimensions, {}).width
                < globalStore.getData(keys.properties.smallBreak);
            let leftVisible = !small || props.leftPanelVisible;
            self.leftVisible = leftVisible; //intentionally no state - but we exactly need to know how this looked at the last render
            let rightVisible = !small || !props.leftPanelVisible;
            let leftClass = "sectionList";
            if (!rightVisible) leftClass += " expand";
            let currentSection = globalStore.getData(keys.gui.settingspage.section, 'Layer');
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
                globalStore.storeData(keys.gui.settingspage.section,currentSection);
            }
            let settingsItems = [];
            if (settingsSections[currentSection]) {
                for (let s in settingsSections[currentSection]) {
                    let key = settingsSections[currentSection][s];
                    if (settingsConditions[key] !== undefined){
                        if (! settingsConditions[key]()) continue;
                    }
                    let description = KeyHelper.getKeyDescriptions()[key];
                    let item = assign({}, description, {
                        name: key,
                        value: props.values[key]
                    });
                    settingsItems.push(item);
                }
            }
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
                        onItemClick={changeItem}
                        /> : null}
                </div>);
        };
        let DynamicMain = Dynamic(MainContent);

        return (
            <DynamicPage
                className={self.props.className}
                style={self.props.style}
                id="settingspage"
                mainContent={
                            <DynamicMain
                                storeKeys={{
                                    leftPanelVisible: keys.gui.settingspage.leftPanelVisible,
                                    section: keys.gui.settingspage.section,
                                    values: keys.gui.settingspage.values,
                                    isEditing: keys.gui.global.layoutEditing
                                }}
                            />
                        }
                buttonList={self.buttons}
                storeKeys={{
                        leftPanelVisible: keys.gui.settingspage.leftPanelVisible,
                        section: keys.gui.settingspage.section
                        }}
                updateFunction={(state)=>{
                    let small = globalStore.getData(keys.gui.global.windowDimensions, {}).width
                        < globalStore.getData(keys.properties.smallBreak);
                    let title="Settings";
                    if (small && ! state.leftPanelVisible) title +=" "+state.section;
                    return {
                        title: title
                    }
                }}
                />);
    }
}

export default SettingsPage;
