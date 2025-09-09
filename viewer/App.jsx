//avnav (C) wellenvogel 2019

import React, {Component, createRef, useEffect} from 'react';
import History from './util/history.js';
import Dynamic from './hoc/Dynamic.jsx';
import keys from './util/keys.jsx';
import MainPage from './gui/MainPage.jsx';
import InfoPage from './gui/InfoPage.jsx';
import GpsPage from './gui/GpsPage.jsx';
import AisPage from './gui/AisPage.jsx';
import AddOnPage from './gui/AddOnPage.jsx';
import AddressPage from './gui/AddressPage.jsx';
import StatusPage from './gui/StatusPage.jsx';
import WpaPage from './gui/WpaPage.jsx';
import DownloadPage from './gui/DownloadPage.jsx';
import SettingsPage from './gui/SettingsPage.jsx';
import NavPage from './gui/NavPage.jsx';
import EditRoutePage from './gui/EditRoutePage.jsx';
import WarningPage from './gui/WarningPage.jsx';
import ViewPage from './gui/ViewPage.jsx';
import AddonConfigPage from './gui/AddOnConfigPage.jsx';
import ImporterPage from "./gui/ImporterPage";
import {
    DialogContext,
    setGlobalContext, showPromiseDialog,
    useDialog
} from './components/OverlayDialog.jsx';
import globalStore from './util/globalstore.jsx';
import Requests from './util/requests.js';
import SoundHandler from './components/SoundHandler.jsx';
import Toast,{ToastDisplay} from './components/Toast.jsx';
import KeyHandler from './util/keyhandler.js';
import LayoutHandler from './util/layouthandler.js';
import AlarmHandler, {LOCAL_TYPES} from './nav/alarmhandler.js';
import GuiHelpers, {stateHelper} from './util/GuiHelpers.js';
import Mob from './components/Mob.js';
import Dimmer from './util/dimhandler.js';
import Button from './components/Button.jsx';
import LeaveHandler from './util/leavehandler';
import EditHandlerDialog from "./components/EditHandlerDialog";
import AndroidEventHandler from './util/androidEventHandler';
import remotechannel, {COMMANDS} from "./util/remotechannel";
import base from "./base";
import propertyHandler from "./util/propertyhandler";
import MapHolder from "./map/mapholder";
import NavData from './nav/navdata';
import alarmhandler from "./nav/alarmhandler.js";
import LocalStorage, {STORAGE_NAMES} from './util/localStorageManager';
import splitsupport from "./util/splitsupport"
import leavehandler from "./util/leavehandler"; //triggers querySplitMode
import fullscreen from "./components/Fullscreen";
import mapholder from "./map/mapholder";
import 'drag-drop-touch';
import {ConfirmDialog} from "./components/BasicDialogs";
import PropTypes from "prop-types";
import Helper from "./util/helper";


const DynamicSound=Dynamic(SoundHandler);

//to feed the sound with the alarm sound we have
const alarmStoreKeys={alarms:keys.nav.alarms.all,
    enabled:keys.properties.localAlarmSound,
    gui: keys.gui.global.soundEnabled};
const computeAlarmSound=(state)=> {
    let off = {src: undefined, repeat: undefined};
    if (!state.enabled || !state.gui) return {enabled: false, ...off};
    if (!state.alarms) return {enabled: true, ...off};
    let alarms = AlarmHandler.sortedActiveAlarms(state.alarms);
    if (alarms.length > 0) {
    //only use the first alarm
        return alarmhandler.getAlarmSound(alarms[0]);
    }
    return {enabled:true,...off};
}
//legacy support - hand over to the "old" gui handler
class Other extends React.Component{
    constructor(props){
        super(props);
    }
    render() {
        return <h1>Unknown page</h1>;
    }
}


class MainWrapper extends React.Component{
    constructor(props){
        super(props);
    }
    render(){
        return <MainPage {...this.props}/>
    }
    componentDidMount(){
        this.props.history.reset(); //reset history if we reach the mainpage
    }
}
MainWrapper.propTypes=MainPage.propTypes;

const pages={
    mainpage: MainWrapper,
    infopage: InfoPage,
    gpspage: GpsPage,
    aispage: AisPage,
    addonpage:AddOnPage,
    addresspage:AddressPage,
    statuspage:StatusPage,
    wpapage:WpaPage,
    downloadpage:DownloadPage,
    settingspage:SettingsPage,
    navpage: NavPage,
    editroutepage:EditRoutePage,
    warningpage:WarningPage,
    viewpage:ViewPage,
    addonconfigpage: AddonConfigPage,
    importerpage: ImporterPage
};
class Router extends Component {
    constructor(props) {
        super(props);
    }
    render() {
        let Page=pages[this.props.location];
        if (Page === undefined){
            Page=Other;
        }
        let className="pageFrame "+ (this.props.nightMode?"nightMode":"");
        let style={};
        if (this.props.nightMode) style['opacity']=globalStore.getData(keys.properties.nightFade)/100;
        let dimStyle={opacity: 0.5};
        return <div className={className}>
            {this.props.dim ?
                <div
                    className="dimm"
                    style={dimStyle}
                    onClick={()=>Dimmer.trigger()}
                    />
                :null}
                <Page
                    style={style}
                    options={this.props.options}
                    location={this.props.location}
                    history={this.props.history}
                    small={this.props.smallDisplay}
                    isEditing={this.props.isEditing}
                    windowDimensions={this.props.windowDimensions}
                />
            </div>
    }
}
Router.propTypes={
    location: PropTypes.string,
    isEditing: PropTypes.bool,
    windowDimensions: PropTypes.object,
    history: PropTypes.instanceOf(History),
    options: PropTypes.object,
    dim: PropTypes.bool,
    nightMode: PropTypes.bool,
    smallDisplay: PropTypes.bool
}

const DynamicRouter=Dynamic(Router);
//show one button (unscaled) to be able to compute button sizes
const ButtonSizer=(props)=>{
        let fontSize=props.fontSize/4; //unscaled button font size
        let style={fontSize:fontSize+"px"};
        return(
            <div className="buttonSizer" style={style} ref={props.refFunction}>
                <Button name={"dummy"}/>
            </div>
        )};


let lastError={
};

let mainShowDialog=undefined;

const GlobalDialog=()=>{
    const [DialogDisplay, setDialog] = useDialog();
    setGlobalContext(undefined,setDialog);
    mainShowDialog=setDialog;
    useEffect(() => {
        return ()=>{
            setGlobalContext();
            mainShowDialog=undefined;
        }
    }, []);
    return <DialogDisplay/>
}

const MainBody = ({location, options, history, nightMode}) => {

    return (
        <DialogContext
            showDialog={mainShowDialog}
        >
            <GlobalDialog/>
            <DynamicRouter
                storeKeys={{
                    sequence: keys.gui.global.propertySequence,
                    windowDimensions: keys.gui.global.windowDimensions,
                    dim: keys.gui.global.dimActive,
                    isEditing: keys.gui.global.layoutEditing,
                    layoutSequence: keys.gui.global.layoutSequence,
                    smallDisplay: keys.gui.global.smallDisplay,
                    ...keys.gui.capabilities
                }}
                location={location}
                options={options}
                history={history}
                nightMode={nightMode}
            />
        </DialogContext>
    )
};

class App extends React.Component {
    appRef=createRef();
    constructor(props) {
        super(props);
        this.checkSizes=this.checkSizes.bind(this);
        this.keyDown=this.keyDown.bind(this);
        this.state={
            error:0
        };
        this.history=new History();
        this.buttonSizer=null;
        this.serverVersion=globalStore.getData(keys.nav.gps.version); //maybe we should start with the compiled version
        globalStore.storeData(keys.gui.global.onAndroid,false,true);
        //make the android API available as avnav.android
        if (window.avnavAndroid) {
            base.log("android integration enabled");
            globalStore.storeData(keys.gui.global.onAndroid, true, true);
            avnav.android = window.avnavAndroid;
            globalStore.storeData(keys.properties.routingServerError, false, true);
            globalStore.storeData(keys.properties.connectedMode, true, true);
            avnav.version = avnav.android.getVersion();
            avnav.android.applicationStarted();
            const receiveAndroidEvent = (key, id) => {
                try {
                    //inform the android part that we noticed the event
                    avnav.android.acceptEvent(key, id);
                } catch (e) {
                }
                if (key == 'backPressed') {
                    if (! globalStore.getData(keys.gui.global.ignoreAndroidBack)) {
                        let currentPage = this.history.currentLocation()
                        if (currentPage == "mainpage") {
                            avnav.android.goBack();
                            return;
                        }
                        this.history.pop();
                    }
                }
                if (key == 'propertyChange') {
                    globalStore.storeData(keys.gui.global.propertySequence,
                        globalStore.getData(keys.gui.global.propertySequence, 0) + 1);
                }
                if (key == "reloadData") {
                    globalStore.storeData(keys.gui.global.reloadSequence,
                        globalStore.getData(keys.gui.global.reloadSequence, 0) + 1);
                }
                AndroidEventHandler.handleEvent(key, id);
            };
            avnav.android.receiveEvent = receiveAndroidEvent;
            splitsupport.subscribe('android', (ev) => {
                receiveAndroidEvent(ev.key, ev.param);
            })
        }
        splitsupport.subscribe('stopLeave',()=>{
            if (! globalStore.getData(keys.gui.global.layoutEditing)) {
                leavehandler.stop();
            }
        });
        fullscreen.init();
        Dimmer.init();
        let startpage="warningpage";
        let firstStart=true;
        if (LocalStorage.hasStorage()){
            if (LocalStorage.getItem(STORAGE_NAMES.LICENSE) === 'true'){
                startpage="mainpage";
                firstStart=false;
            }
        }
        if (firstStart){
            propertyHandler.firstStart();
        }

        NavData.startQuery();
        this.pendingActions=[];
        this.pendingActions.push(Requests.getJson("images.json", {useNavUrl: false, checkOk: false})
            .then((data) => {
                MapHolder.setImageStyles(data);
            })
            .catch((error) => {
                Toast("unable to load image definitions");
            })
            .then(() => Requests.getJson("/user/viewer/images.json", {useNavUrl: false, checkOk: false})
                .then((data) => {
                    MapHolder.setImageStyles(data);
                })
                .catch((error) => {
                    Toast("unable to load user image definitions: " + error);
                }))
        );
        this.pendingActions.push(Requests.getJson("keys.json", {useNavUrl: false, checkOk: false})
            .then(
                (json) => {
                    KeyHandler.registerMappings(json);
                })
            .catch((error) => {
                Toast("unable to load key mappings: " + error);
            })
            .then(() =>
                Requests.getJson("/user/viewer/keys.json", {useNavUrl: false, checkOk: false}).then(
                    (json) => {
                        KeyHandler.mergeMappings(2, json);
                    },
                    (error) => {
                    }
                )
            )
        );
        this.pendingActions.push(Requests.getJson("/user/viewer/splitkeys.json",{useNavUrl:false,checkOk:false}).then(
            (json)=>{
                if (json.version === undefined){
                    throw new Error("missing version");
                }
                if (json.keys === undefined){
                    throw new Error("missing keys");
                }
                propertyHandler.setPrefixKeys(json.keys);
                propertyHandler.resetToSaved();
                propertyHandler.incrementSequence();
                propertyHandler.notifyFrame();
            })
            .catch((error)=>{
                console.log("splitkeys.json: "+error);
            }
        ));
        this.pendingActions.push(LayoutHandler.loadStoredLayout(true)
            .then((layout)=>{})
            .catch((error)=>{Toast(error)})
        );
        let lastChart=mapholder.getLastChartKey();
        if (startpage === 'mainpage' && globalStore.getData(keys.properties.startNavPage) && lastChart){
            const delayedStart=()=>{
                this.history.push('navpage');
            }
            this.history.push(startpage,{noInitial:true});
            Promise.all(this.pendingActions)
                .then(()=>delayedStart(),()=>delayedStart());
        }
        else {
            this.history.push(startpage);
        }
        this.leftHistoryState=stateHelper(this,this.history.currentLocation(true),'leftHistory');
        this.history.setCallback((topEntry)=>this.leftHistoryState.setState(topEntry,true));
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.controlMob(true);
        },'global','mobon');
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.controlMob(false);
        },'global','moboff');
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.toggleMob();
        },'global','mobtoggle');
        GuiHelpers.keyEventHandler(this,()=>{
            NavData.getRoutingHandler().anchorOn(undefined,undefined,true);
        },'global','anchoron');
        GuiHelpers.keyEventHandler(this,()=>{
            NavData.getRoutingHandler().anchorOff();
        },'global','anchoroff');
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            let addon=parseInt(action);
            if (this.history.currentLocation() === "addonpage"){
                this.history.replace("addonpage",{activeAddOn:addon});
            }
            else {
                this.history.push("addonpage", {activeAddOn: addon});
            }
        },'addon',['0','1','2','3','4','5','6','7']);
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            Dimmer.toggle();
        },'global','toggledimm')
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            Dimmer.activate();
        },'global','dimmon');
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            Dimmer.trigger();
        },'global','dimmoff');
        //an action to ensure keys are grabbed away even if not really used
        GuiHelpers.keyEventHandler(this,()=>{},'global','dummy');
        this.newDeviceHandler=this.newDeviceHandler.bind(this);
        this.subscription=AndroidEventHandler.subscribe('deviceAdded',this.newDeviceHandler);
        this.remoteChannel=remotechannel;
        this.remoteChannel.start();
        this.remoteChannel.subscribe(COMMANDS.setPage,(msg)=>{
            let parts=msg.split(/  */);
            try {
                let location = parts[0];
                let options={};
                if (parts.length > 1) {
                    options = JSON.parse(parts[1]);
                }
                if (pages[location] === undefined){
                    return;
                }
                this.history.setFromRemote(location,options);
            }catch (e){}
        });
        GuiHelpers.storeHelper(this,(data)=>{
            let lost=data.connectionLost;
            if (lost) {
                if (globalStore.getData(keys.properties.connectionLostAlarm)) {
                    alarmhandler.startLocalAlarm(LOCAL_TYPES.connectionLost);
                }
            }
            else alarmhandler.stopAlarm(LOCAL_TYPES.connectionLost);
        },{connectionLost:keys.nav.gps.connectionLost})
        GuiHelpers.storeHelper(this,(data)=>{
            this.checkReload();
        },[keys.nav.gps.version])
        this.titleSet=false;
    }
    newDeviceHandler(){
        try{
            let devData=avnav.android.getAttachedDevice();
            if (! devData) return;
            let config=JSON.parse(devData);
            if (config.typeName && config.initialParameters){
                EditHandlerDialog.createNewHandlerDialog(config.typeName,config.initialParameters);
            }
        }catch(e){}
    }
    static getDerivedStateFromError(error) {
        lastError.error=error;
        lastError.stack=(error||{}).stack;
        // Update state so the next render will show the fallback UI.
        return { error: 1 };
    }
    componentDidCatch(error,errorInfo){
        lastError.componentStack=(errorInfo||{}).componentStack;
        this.setState({error:2});
    }
    isRotated(){
        return globalStore.getData(keys.properties.displayRotation) !== 'none';
    }
    checkSizes(){
        if (globalStore.getData(keys.gui.global.hasActiveInputs,false)) return;
        if (! this.appRef.current) return;
        let current=this.appRef.current.getBoundingClientRect();
        if (! current) return;
        this.computeButtonSizes();
        let swap=this.isRotated();
        const dimensions={width:swap?current.height:current.width,height:swap?current.width:current.height};
        globalStore.storeData(keys.gui.global.windowDimForce,dimensions);
        if (globalStore.getData(keys.gui.global.preventSizeChange,false)) return;
        let small = dimensions.width <globalStore.getData(keys.properties.smallBreak);
        globalStore.storeData(keys.gui.global.smallDisplay,small); //set small before we change dimensions...
        globalStore.storeData(keys.gui.global.windowDimensions,dimensions);

    }
    computeButtonSizes(){
        if (! this.buttonSizer) return;
        let rect=this.buttonSizer.getBoundingClientRect();
        globalStore.storeMultiple(
            {height:rect.height,width:rect.width},
            {height: keys.gui.global.computedButtonHeight,width:keys.gui.global.computedButtonWidth}
        );
    }
    componentDidMount(){
        document.addEventListener("keydown",this.keyDown);
        let iv=window.setInterval(this.checkSizes,1000);
        this.checkSizes();
        this.setState({interval:iv});
        window.addEventListener('resize',this.checkSizes);
        AlarmHandler.start();
        this.newDeviceHandler();

    }
    componentWillUnmount(){
        AndroidEventHandler.unsubscribe(this.subscription);
        document.removeEventListener("keydown",this.keyDown);
        window.removeEventListener('resize',this.checkSizes);
        if (this.state.interval){
            window.clearInterval(this.state.interval);
        }
    }
    keyDown(evt){
        let inDialog=globalStore.getData(keys.gui.global.hasActiveInputs,false);
        KeyHandler.handleKeyEvent(evt,inDialog);
    }
    checkReload(){
        let newVersion=globalStore.getData(keys.nav.gps.version);
        if (newVersion === undefined || newVersion === '') return;
        if (this.serverVersion === undefined){
            //first query
            this.serverVersion=newVersion;
            return;
        }
        if (this.serverVersion === newVersion)return;
        showPromiseDialog(undefined,(props)=><ConfirmDialog {...props} text={"The server version has changed from "+
            this.serverVersion+
            " to "+newVersion+". Would you like to reload?"} title={"Server version change"}/>)
            .then(()=>{
                LeaveHandler.stop();
                Helper.reloadPage();
            })
            .catch(()=>this.serverVersion=newVersion);
    }
    render(){
        if (this.state.error){
            LeaveHandler.stop();
            let version=(window.avnav||{}).version;
            let etext=`VERSION:${version}\nERROR:${lastError.error}\n${lastError.stack}\n${lastError.componentStack}`;
            let etextData='data:text/plain;charset=utf-8,'+encodeURIComponent(etext);
            return <div className="errorDisplay">
                <h1>Internal Error</h1>
                <button
                    className="button"
                    onClick={()=>Helper.reloadPage()}
                    >
                    Reload App
                </button>
                <a className="errorDownload button"
                   href={etextData}
                   download="AvNavError"
                    >
                    Download Error
                </a>
                <div className="errorInfo">
                    {etext}
                </div>
                </div>
        };
        let appClass="app";
        let layoutClass=(this.props.layoutName||"").replace(/[^0-9a-zA-Z]/g,'_');
        appClass+=" "+layoutClass;
        if (this.props.smallDisplay) appClass+=" smallDisplay";
        if (this.props.nightMode) appClass+=" nightMode";
        const rotation=globalStore.getData(keys.properties.displayRotation);
        if (rotation !== 'none' && ! globalStore.getData(keys.gui.global.splitMode)) {
            appClass += " rotated";
            if (rotation === '90cw') appClass += " rotateCW";
            else appClass+= " rotateCCW";
        }
        let location=this.leftHistoryState.getValue('location');
        if (location !== "warningpage") {
            if (! this.titleSet) {
                document.title = "AVNav-Web";
                this.titleSet=true;
            }
        }
        else{
            document.title = "AVNav-Warning";
        }
        return <div
            className={appClass}
            ref={this.appRef}
            style={{fontSize: this.props.fontSize+"px"}}
            tabIndex="0"
            >
            <MainBody
                location={location}
                options={this.leftHistoryState.getValue('options')}
                history={this.history}
                nightMode={this.props.nightMode}
                />
            { ! (avnav.android || globalStore.getData(keys.gui.global.preventAlarms)) && globalStore.getData(keys.properties.localAlarmSound) ?<DynamicSound
                storeKeys={alarmStoreKeys}
                updateFunction={computeAlarmSound}
                />:
                null}
            <ToastDisplay/>
            <ButtonSizer
                sequence={this.props.sequence}
                fontSize={this.props.buttonFontSize}
                refFunction={(el)=>{
                this.buttonSizer=el;
                this.computeButtonSizes();
            }}/>
        </div>
    };
}
export default   Dynamic(App,{
  storeKeys:{
      buttonFontSize: keys.properties.style.buttonSize,
      fontSize: keys.properties.baseFontSize,
      smallDisplay: keys.gui.global.smallDisplay,
      nightMode: keys.properties.nightMode,
      layoutName: keys.properties.layoutName,
      sequence: keys.gui.global.propertySequence
  }
});