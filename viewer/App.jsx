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
import PropertyHandler from './util/propertyhandler.js';
import OverlayDialog from './components/OverlayDialog.jsx';
import globalStore from './util/globalstore.jsx';
import Requests from './util/requests.js';
import SoundHandler from './components/SoundHandler.jsx';
import Toast,{ToastDisplay} from './components/Toast.jsx';
import KeyHandler from './util/keyhandler.js';
import LayoutHandler from './util/layouthandler.js';


const DynamicSound=Dynamic(SoundHandler);

//to feed the sound with the alarm sound we have
const alarmStoreKeys={alarms:keys.nav.gps.alarms,enabled:keys.properties.localAlarmSound};
const computeAlarmSound=(state)=>{
    let off={src:undefined,repeat:undefined};
    if (! state.enabled) return {enabled:false,...off};
    if (!state.alarms) return {enabled:true,...off};
    for (let k in state.alarms){
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
    editroutepage:EditRoutePage
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
        return <div className={className}>
                <Page style={style} options={this.props.options} location={this.props.location}/>
            </div>
    }
}

const DynamicRouter=Dynamic(Router);

class App extends React.Component {
    constructor(props) {
        super(props);
        this.checkSizes=this.checkSizes.bind(this);
        this.keyDown=this.keyDown.bind(this);
        this.state={};
        Requests.getJson("layout/keys.json",{useNavUrl:false,checkOk:false}).then(
            (json)=>{
                KeyHandler.registerMappings(json);
            },
            (error)=>{
                Toast("unable to load key mappings: "+error);
            }
        );
        let layoutName=globalStore.getData(keys.properties.layoutName);
        LayoutHandler.loadLayout(layoutName)
            .then((layout)=>{
                LayoutHandler.activateLayout(true);
            })
            .catch((error)=>{
                let description=KeyHelper.getKeyDescriptions()[keys.properties.layoutName];
                if (description && description.defaultv){
                    if (layoutName != description.defaultv){
                        globalStore.storeData(keys.properties.layoutName,description.defaultv);
                        LayoutHandler.loadLayout(description.defaultv).then(()=>{
                            LayoutHandler.activateLayout();
                        }).catch((error)=>{
                            Toast("unable to load default layout: "+error);
                        })
                    }
                }
                Toast("unable to load application layout "+layoutName+": "+error);
            });
    }
    checkSizes(){
        if (globalStore.getData(keys.gui.global.hasActiveInputs,false)) return;
        if (! this.refs.app) return;
        let current=this.refs.app.getBoundingClientRect();
        if (! current) return;
        let small = current.width <globalStore.getData(keys.properties.smallBreak);
        globalStore.storeData(keys.gui.global.smallDisplay,small); //set small before we change dimensions...
        globalStore.storeData(keys.gui.global.windowDimensions,{width:current.width,height:current.height});
        globalStore.storeData(keys.gui.global.buttonFontSize,PropertyHandler.getButtonFontSize())
    }
    componentDidMount(){
        document.addEventListener("keydown",this.keyDown);
        let iv=window.setInterval(this.checkSizes,1000);
        this.checkSizes();
        this.setState({interval:iv});
        window.addEventListener('resize',this.checkSizes);


    }
    componentWillUnmount(){
        document.removeEventListener("keydown",this.keyDown);
        window.removeEventListener('resize',this.checkSizes);
        if (this.state.interval){
            window.clearInterval(this.state.interval);
        }
    }
    keyDown(evt){
        if (globalStore.getData(keys.gui.global.hasActiveInputs,false)) return;
        KeyHandler.handleKeyEvent(evt);
    }
    render(){
        const Dialogs = OverlayDialog.getDialogContainer;
        return <div
            className="app"
            ref="app"
            style={{fontSize: this.props.fontSize+"px"}}
            tabIndex="0"
            >
            <DynamicRouter
                storeKeys={{
                location: keys.gui.global.pageName,
                options: keys.gui.global.pageOptions,
                sequence: keys.gui.global.propertySequence,
                dimensions: keys.gui.global.windowDimensions
            }}
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
        </div>
    };
}
module.exports=Dynamic(App,{
  storeKeys:{
      fontSize: keys.properties.baseFontSize,
      nightMode: keys.properties.nightMode,
  }
});