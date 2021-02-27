//avnav (C) wellenvogel 2019

import React, { Component } from 'react';
import history from './util/history.js';
import Dynamic from './hoc/Dynamic.jsx';
import keys,{KeyHelper} from './util/keys.jsx';
import MainPage from './gui/MainPage.jsx';
import InfoPage from './gui/InfoPage.jsx';
import GpsPage from './gui/GpsPage.jsx';
import AisPage from './gui/AisPage.jsx';
import AisInfoPage from './gui/AisInfoPage.jsx';
import AddOnPage from './gui/AddOnPage.jsx';
import AddressPage from './gui/AddressPage.jsx';
import StatusPage from './gui/StatusPage.jsx';
import WpaPage from './gui/WpaPage.jsx';
import RoutePage from './gui/RoutePage.jsx';
import DownloadPage from './gui/DownloadPage.jsx';
import SettingsPage from './gui/SettingsPage.jsx';
import NavPage from './gui/NavPage.jsx';
import EditRoutePage from './gui/EditRoutePage.jsx';
import WarningPage from './gui/WarningPage.jsx';
import ViewPage from './gui/ViewPage.jsx';
import AddonConfigPage from './gui/AddOnConfigPage.jsx';
import PropertyHandler from './util/propertyhandler.js';
import OverlayDialog from './components/OverlayDialog.jsx';
import globalStore from './util/globalstore.jsx';
import Requests from './util/requests.js';
import SoundHandler from './components/SoundHandler.jsx';
import Toast,{ToastDisplay} from './components/Toast.jsx';
import KeyHandler from './util/keyhandler.js';
import LayoutHandler from './util/layouthandler.js';
import assign from 'object-assign';
import AlarmHandler from './nav/alarmhandler.js';
import GuiHelpers from './util/GuiHelpers.js';
import Mob from './components/Mob.js';
import Dimmer from './util/dimhandler.js';
import Button from './components/Button.jsx';
import LeaveHandler from './util/leavehandler';


const DynamicSound=Dynamic(SoundHandler);

//to feed the sound with the alarm sound we have
const alarmStoreKeys={alarms:keys.nav.alarms.all,
    enabled:keys.properties.localAlarmSound,
    gui: keys.gui.global.soundEnabled};
const computeAlarmSound=(state)=>{
    let off={src:undefined,repeat:undefined};
    if (! state.enabled || ! state.gui) return {enabled:false,...off};
    if (!state.alarms) return {enabled:true,...off};
    for (let k in state.alarms){
        if (!state.alarms[k].running) continue;
        //only use the first alarm
        return {
            src: globalStore.getData(keys.properties.navUrl)+"?request=download&type=alarm&name="+encodeURIComponent(k),
            repeat: state.alarms[k].repeat,
            enabled:true
        };
    }
    return {enabled:true,...off};
};
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
        history.reset(); //reset history if we reach the mainpage
    }
}
const pages={
    mainpage: MainWrapper,
    infopage: InfoPage,
    gpspage: GpsPage,
    aispage: AisPage,
    aisinfopage:AisInfoPage,
    addonpage:AddOnPage,
    addresspage:AddressPage,
    statuspage:StatusPage,
    wpapage:WpaPage,
    routepage:RoutePage,
    downloadpage:DownloadPage,
    settingspage:SettingsPage,
    navpage: NavPage,
    editroutepage:EditRoutePage,
    warningpage:WarningPage,
    viewpage:ViewPage,
    addonconfigpage: AddonConfigPage
};
class Router extends Component {
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
            {this.props.dim ? <div className="dimm" style={dimStyle} onClick={Dimmer.trigger}></div>:null}
                <Page style={style} options={this.props.options} location={this.props.location}/>
            </div>
    }
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

class App extends React.Component {
    constructor(props) {
        super(props);
        this.checkSizes=this.checkSizes.bind(this);
        this.keyDown=this.keyDown.bind(this);
        this.buttonSizer=null;
        this.state={
            error:0
        };
        Requests.getJson("keys.json",{useNavUrl:false,checkOk:false}).then(
            (json)=>{
                KeyHandler.registerMappings(json);
            },
            (error)=>{
                Toast("unable to load key mappings: "+error);
            }
        );
        Requests.getJson("/user/viewer/keys.json",{useNavUrl:false,checkOk:false}).then(
            (json)=>{
                KeyHandler.mergeMappings(2,json);
            },
            (error)=>{
            }
        );
        LayoutHandler.loadStoredLayout(true)
            .then((layout)=>{})
            .catch((error)=>{Toast(error)});
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.controlMob(true);
        },'global','mobon');
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.controlMob(false);
        },'global','moboff');
        GuiHelpers.keyEventHandler(this,()=>{
            Mob.toggleMob();
        },'global','mobtoggle');
        GuiHelpers.keyEventHandler(this,(component,action)=>{
            let addon=parseInt(action);
            if (history.currentLocation() === "addonpage"){
                history.replace("addonpage",{activeAddOn:addon});
            }
            else {
                history.push("addonpage", {activeAddOn: addon});
            }
        },'addon',['0','1','2','3','4','5','6','7']);

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
        if (! this.refs.app) return;
        let current=this.refs.app.getBoundingClientRect();
        if (! current) return;
        let small = current.width <globalStore.getData(keys.properties.smallBreak);
        globalStore.storeData(keys.gui.global.smallDisplay,small); //set small before we change dimensions...
        globalStore.storeData(keys.gui.global.windowDimensions,{width:current.width,height:current.height});
        this.computeButtonSizes();

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


    }
    componentWillUnmount(){
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
                    onClick={()=>window.location.href=window.location.href}
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
        }
        const Dialogs = OverlayDialog.getDialogContainer;
        let appClass="app";
        if (this.props.smallDisplay) appClass+=" smallDisplay";
        return <div
            className={appClass}
            ref="app"
            style={{fontSize: this.props.fontSize+"px"}}
            tabIndex="0"
            >
            <DynamicRouter
                storeKeys={assign({
                location: keys.gui.global.pageName,
                options: keys.gui.global.pageOptions,
                sequence: keys.gui.global.propertySequence,
                dimensions: keys.gui.global.windowDimensions,
                dim: keys.gui.global.dimActive
                },keys.gui.capabilities)
            }
                nightMode={this.props.nightMode}
                />
            <Dialogs
                className={this.props.nightMode?"nightMode":""}/>
            { ! avnav.android ?<DynamicSound
                storeKeys={alarmStoreKeys}
                updateFunction={computeAlarmSound}
                />:
                null}
            <ToastDisplay/>
            <ButtonSizer
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
  }
});