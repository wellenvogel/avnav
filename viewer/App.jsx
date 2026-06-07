//avnav (C) wellenvogel 2019

import React, {createRef, useCallback, useEffect, useRef} from 'react';
import History from './util/history';
import Dynamic from './hoc/Dynamic';
import keys, {ButtonFontSizeFactor} from './util/keys';
import InfoPage from './gui/InfoPage';
import GpsPage from './gui/GpsPage';
import AisPage from './gui/AisPage';
import AddOnPage from './gui/AddOnPage';
import AddressPage from './gui/AddressPage';
import ServerPage from './gui/ServerPage';
import WpaPage from './gui/WpaPage';
import SettingsPage from './gui/SettingsPage';
import NavPage from './gui/NavPage';
import EditRoutePage from './gui/EditRoutePage';
import WarningPage from './gui/WarningPage';
import AddonConfigPage from './gui/AddOnConfigPage';
import {
    DialogContext, DialogDisplay,
    showPromiseDialog
} from './components/OverlayDialog';
import globalStore from './util/globalstore.ts';
import Requests from './util/requests';
import SoundHandler from './components/SoundHandler.jsx';
import Toast,{ToastDisplay} from './components/Toast.tsx';
import KeyHandler, {KeyComponents} from './util/keyhandler.ts';
import LayoutHandler from './util/layouthandler.ts';
import AlarmHandler, {LOCAL_TYPES} from './nav/alarmhandler.js';
import GuiHelpers, {stateHelper} from './util/GuiHelpers.js';
import Mob from './components/Mob.ts';
import Dimmer from './util/dimhandler';
import Button from './components/Button.tsx';
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
import fullscreen from "./util/Fullscreen";
import mapholder from "./map/mapholder";
import 'drag-drop-touch';
import {ConfirmDialog} from "./components/BasicDialogs";
import PropTypes from "prop-types";
import Helper, {avNavVersion} from "./util/helper";
import {HistoryContext, useHistory} from "./components/HistoryProvider";
import {RouteSyncDialog} from "./components/RouteInfoHelper";
import {PAGEIDS} from "./util/pageids";
import {useDialogContext} from "./components/DialogContext";
import ChannelsPage from "./gui/ChannelsPage";
import RoutesPage from "./gui/RoutesPage";
import TracksPage from "./gui/TracksPage";
import AisCfgPage from "./gui/AisCfgPage";
import LayoutsPage from "./gui/LayoutsPage";
import ChartsPage from "./gui/ChartsPage";
import addons from "./util/Addons";
import {addonViewManager} from "./components/AddonView";
import {PluginsPage} from "./gui/PluginsPage";
import {RemotePage} from "./gui/RemotePage";
import LoadingPage from "./gui/LoadingPage";
import {CL_BUTTON_TEXT, CL_MAINBT_TEXT} from "./components/ButtonDefs";
import keyhandler from "./util/keyhandler.ts";

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
const Other=(props)=>{
        return <React.Fragment>
            <h1>Unknown page {'"'+props.id+'"'}</h1>
            <Button
                name={'main'}
                onClick={()=>props.history.replace(PAGEIDS.NAV)}
            >Main</Button>
        </React.Fragment>
}



const pages={
    [PAGEIDS.INFO]: InfoPage,
    [PAGEIDS.GPS]: GpsPage,
    [PAGEIDS.AIS]: AisPage,
    [PAGEIDS.ADDON]:AddOnPage,
    [PAGEIDS.ADDR]:AddressPage,
    [PAGEIDS.SERVER]:ServerPage,
    [PAGEIDS.WPA]:WpaPage,
    [PAGEIDS.SETTINGS]:SettingsPage,
    [PAGEIDS.NAV]: NavPage,
    [PAGEIDS.ROUTE]:EditRoutePage,
    [PAGEIDS.WARNING]:WarningPage,
    [PAGEIDS.ADDCFG]: AddonConfigPage,
    [PAGEIDS.CHANNELS]: ChannelsPage,
    [PAGEIDS.NROUTE]: RoutesPage,
    [PAGEIDS.TRACKS]: TracksPage,
    [PAGEIDS.AISCFG]: AisCfgPage,
    [PAGEIDS.LAYOUT]: LayoutsPage,
    [PAGEIDS.CHARTS]: ChartsPage,
    [PAGEIDS.PLUGINS]:PluginsPage,
    [PAGEIDS.REMOTE]:RemotePage
};
const Router = (props) => {
    const history = useHistory();
    const dialogContext = useDialogContext();
    const connectedMode=useRef(true);
    const checkRoutes=useCallback(()=>{
        const current=globalStore.getData(keys.gui.global.connectedMode);
        if (current != connectedMode.current){
            if (current){
                dialogContext.showDialog(()=><RouteSyncDialog
                    deleteLocal={false}
                />)
            }
            connectedMode.current=current;
        }
    })
    useEffect(()=>{
        globalStore.register(checkRoutes,keys.gui.global.connectedMode);
        return ()=>globalStore.deregister(checkRoutes);
    })
    useEffect(()=>{
        checkRoutes();
    })
    let Page = props.location?pages[props.location]:LoadingPage;
    if (Page === undefined) {
        Page = Other;
    }
    let className = Helper.concatsp("pageFrame",
        props.nightMode ? "nightMode" : undefined,
        props.btText? CL_BUTTON_TEXT:undefined,
        props.mainBtText?CL_MAINBT_TEXT:undefined,
        "icon-"+props.iconSet
        );
    let style = {};
    if (props.nightMode) style['opacity'] = globalStore.getData(keys.properties.nightFade) / 100;
    let dimStyle = {opacity: 0.5};
    let nCol=1;
    if (props.windowDimensions && props.buttonWidth && props.fontSize){
        const width=props.windowDimensions.width - props.buttonWidth;
        const limit=props.pageColumnWidth*props.fontSize/14;
        nCol=Math.floor(width/limit);
    }
    return <div className={className}>
        {props.dim ?
            <div
                className="dimm"
                style={dimStyle}
                onClick={() => Dimmer.trigger()}
            />
            : null}
        <Page
            id={props.location}
            history={history}
            style={style}
            options={props.options}
            location={props.location}
            small={props.smallDisplay}
            isEditing={props.isEditing}
            windowDimensions={props.windowDimensions}
            pageColumns={nCol}
        />
    </div>
}
Router.propTypes = {
    location: PropTypes.string,
    isEditing: PropTypes.bool,
    windowDimensions: PropTypes.object,
    options: PropTypes.object,
    dim: PropTypes.bool,
    nightMode: PropTypes.bool,
    smallDisplay: PropTypes.bool,
    pageColumnWidth: PropTypes.number,
    buttonWidth: PropTypes.number,
    fontSize: PropTypes.number,
    btText: PropTypes.bool,
    mainBtText: PropTypes.bool,
    iconSet: PropTypes.string
}

const DynamicRouter=Dynamic(Router);
//show one button (unscaled) to be able to compute button sizes
const ButtonSizer=(props)=>{
        let fontSize=props.fontSize/ButtonFontSizeFactor; //unscaled button font size
        let style={fontSize:fontSize+"px"};
        return(
            <div className="buttonSizer" style={style} ref={props.refFunction}>
                <Button name={"dummy"}/>
            </div>
        )};


let lastError={
};


const MainBody = ({ history, nightMode}) => {
    const location=history.currentLocation(true);
    return (
        <HistoryContext history={history}>
        <DialogContext>
            <DialogDisplay name={'app'}/>
            <DynamicRouter
                storeKeys={{
                    sequence: keys.gui.global.propertySequence,
                    reloadSequence: keys.gui.global.reloadSequence,
                    addonsChanged: keys.gui.global.addonsChanged,
                    windowDimensions: keys.gui.global.windowDimensions,
                    dim: keys.gui.global.dimActive,
                    isEditing: keys.gui.global.layoutEditing,
                    layoutSequence: keys.gui.global.layoutSequence,
                    smallDisplay: keys.gui.global.smallDisplay,
                    pageColumnWidth: keys.properties.pageColumnWidth,
                    buttonWidth:keys.gui.global.computedButtonWidth,
                    fontSize: keys.properties.baseFontSize,
                    btText: keys.properties.buttonText,
                    mainBtText: keys.properties.mainBtText,
                    iconSet: keys.properties.buttonIconSet,
                    ...keys.gui.capabilities
                }}
                location={location?.location}
                options={location?.options}
                history={history}
                nightMode={nightMode}
            />
        </DialogContext>
        </HistoryContext>
    )
};
MainBody.propTypes = {
    history: PropTypes.instanceOf(History),
    nightMode: PropTypes.bool,
}

const hideSplash=()=>{
    const spe=document.querySelector("#splash");
    if (spe){
        //spe.style.display="none";
        spe.classList.add('splashHidden');
    }
}

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
        globalStore.storeData(keys.gui.global.onAndroid,false);
        if (window.avnavAndroid) {
            base.log("android integration enabled");
            globalStore.storeData(keys.gui.global.onAndroid, true, );
            globalStore.storeData(keys.properties.routingServerError, false);
            globalStore.storeData(keys.gui.global.connectedMode, true);
            const receiveAndroidEvent = (key, id) => {
                try {
                    //inform the android part that we noticed the event
                    window.avnavAndroid.acceptEvent(key, id);
                } catch (e) {
                }
                if (key == 'backPressed') {
                    if (! globalStore.getData(keys.gui.global.ignoreAndroidBack)) {
                        let currentPage = this.history.currentLocation()
                        if (currentPage == PAGEIDS.NAV) {
                            window.avnavAndroid.goBack();
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
            window.avnavAndroid.receiveEvent = receiveAndroidEvent;
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
        let startpage=PAGEIDS.WARNING;
        let firstStart=true;
        if (LocalStorage.hasStorage()){
            if (LocalStorage.getItem(STORAGE_NAMES.LICENSE) === 'true'){
                startpage=PAGEIDS.NAV;
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
                    const canConnect=globalStore.getData(keys.gui.capabilities.canConnect);
                    if (canConnect !== false) Toast("unable to load user image definitions: " + error);
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
            })
            .catch((error)=>{
                console.log("splitkeys.json: "+error);
            }
        ));
        this.pendingActions.push(
            new Promise(resolve => {
                const action=()=>LayoutHandler.loadStoredLayout(true)
                    .then((layout)=>{
                        return(layout);
                    })
                    .catch((error)=>{Toast(error);})
                if (globalStore.getData(keys.gui.global.pluginLoadingDone) ){
                    action().then((data)=>{resolve(data)});
                }
                else{
                        const callback=globalStore.register(()=>{
                            globalStore.deregister(callback);
                            action().then((rs)=>resolve(rs));
                        },keys.gui.global.pluginLoadingDone);
                    }
                })
        );
        const delayedStart=()=>{
            this.history.push(startpage,{initial:true});
            hideSplash();
            if (window.avnavAndroid){
                window.avnavAndroid.applicationStarted();
            }
        }
        Promise.all(this.pendingActions)
             .then(()=>delayedStart(),()=>delayedStart());
        this.leftHistoryState=stateHelper(this,this.history.currentLocation(true),'leftHistory');
        this.history.setCallback((topEntry,lastEntry)=>{
            this.leftHistoryState.setState(topEntry,true);
            if (lastEntry) addonViewManager.setPageAddon(lastEntry.location); //reset any shown user app
        });
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
        const addonKeyHandler=(component,action)=> {
            const page = addons.findPageForAddon(action);
            if (!page) return;
            if (this.history.currentLocation() === page) {
                keyhandler.callHandler(KeyComponents.BUTTON, action);
            } else {
                this.history.push(page, {button: action});
            }
        }
        const getAddonButtons=()=>{
            const rt=addons.getAddonButtonNames();
            return rt;
        }
        GuiHelpers.lifecycleSupport(this,(umount)=>{
                if (umount) {
                    keyhandler.deregisterHandler(addonKeyHandler);
                    return;
                }
                keyhandler.registerHandler(addonKeyHandler,KeyComponents.ADDON,getAddonButtons());
            }
        )
            //we are a bit lazy here and do not deregister old addon buttons
            //they will not be found later any way from the handler by findPageForAddons
        globalStore.register(()=>{
            keyhandler.registerHandler(addonKeyHandler,KeyComponents.ADDON,getAddonButtons());
        },keys.gui.global.addonsChanged)
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
        this.addonReader=new addons.QueryHandler();
        this.addonReader.start();
    }
    newDeviceHandler(){
        try{
            let devData=window.avnavAndroid.getAttachedDevice();
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
    checkSizes(){
        if (globalStore.getData(keys.gui.global.hasActiveInputs,false)) return;
        if (! this.appRef.current) return;
        let current=this.appRef.current.getBoundingClientRect();
        if (! current) return;
        this.computeButtonSizes();
        const dimensions={width:current.width,height:current.height};
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
            let version=avNavVersion();
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
        let location=this.leftHistoryState.getValue('location');
        if (location && location !== PAGEIDS.WARNING) {
            if (! this.titleSet) {
                document.title = "AVNav-Web";
                this.titleSet=true;
            }
            globalStore.storeData(keys.gui.global.soundEnabled,true); //onec we hit the firts "normal page" show the enable sound toast
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
            { ! (window.avnavAndroid || globalStore.getData(keys.gui.global.preventAlarms)) && globalStore.getData(keys.properties.localAlarmSound) ?<DynamicSound
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