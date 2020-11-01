/**
 * Created by andreas on 02.05.14.
 */

import navobjects from '../nav/navobjects';
import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import MapHolder from '../map/mapholder.js';
import base from '../base.js';
import chartImage from '../images/Chart60.png';
import GuiHelper from '../util/GuiHelpers.js';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import Mob from '../components/Mob.js';
import Addons from '../components/Addons.js';

const DynamicList = Dynamic(ItemList);


const getImgSrc=function(color){
    if (color == "red") return globalStore.getData(keys.properties.statusErrorImage);
    if (color == "green") return globalStore.getData(keys.properties.statusOkImage);
    if (color == "yellow")return globalStore.getData(keys.properties.statusYellowImage);
};

const selectChart=(offset)=>{
    let chartList=globalStore.getData(keys.gui.mainpage.chartList);
    let len=0;
    if (chartList) len=chartList.length;
    let currentIndex=globalStore.getData(keys.gui.mainpage.selectedChartIndex);
    let newIndex=(currentIndex||0)+offset;
    if (newIndex >= len){
        newIndex=0;
    }
    if (newIndex < 0){
        newIndex=0;
    }
    if (newIndex != currentIndex){
        globalStore.storeData(keys.gui.mainpage.selectedChartIndex,newIndex);
    }
};

class MainPage extends React.Component {
    constructor(props) {
        super(props);
        this.timerCall=this.timerCall.bind(this);
        let self=this;
        this.buttons = [
            {
                name: 'ShowStatus',
                onClick: ()=> {
                    history.push('statuspage')
                },
                editDisable: true
            },
            {
                name: 'ShowSettings',
                onClick: ()=> {
                    history.push('settingspage')
                }
            },
            {
                name: 'ShowDownload',
                onClick: ()=> {
                    history.push('downloadpage')
                },
                editDisable: true
            },
            {
                name: 'Connected',
                storeKeys: [keys.gui.global.onAndroid, keys.properties.connectedMode,keys.gui.capabilities.canConnect],
                updateFunction: (state, skeys) => {
                    return {
                        visible: !state[keys.gui.global.onAndroid] && state[keys.gui.capabilities.canConnect] == true,
                        toggle: state[keys.properties.connectedMode]
                    }
                },
                onClick: ()=> {
                    let con = globalStore.getData(keys.properties.connectedMode, false);
                    con = !con;
                    globalStore.storeData(keys.properties.connectedMode, con);
                },
                editDisable: true
            },
            {
                name: 'ShowGps',
                onClick: ()=> {
                    history.push('gpspage')
                }
            },
            {
                name: 'Night',
                storeKeys: {toggle: keys.properties.nightMode},
                onClick: ()=> {
                    let mode = globalStore.getData(keys.properties.nightMode, false);
                    mode = !mode;
                    globalStore.storeData(keys.properties.nightMode, mode);
                },
                editDisable: true
            },
            Mob.mobDefinition,
            LayoutFinishedDialog.getButtonDef(),

            {
                name: 'MainCancel',
                storeKeys: {visible: keys.gui.global.onAndroid},
                onClick: ()=> {
                    avnav.android.goBack()
                }

            },
            {
                name: 'MainAddOns',
                storeKeys: keys.gui.mainpage.addOns,
                updateFunction: (state, skeys)=> {
                    return {
                        visible: state[keys.gui.mainpage.addOns] && state[keys.gui.mainpage.addOns].length > 0
                    };
                },
                onClick: ()=> {
                    history.push('addonpage')
                },
                editDisable: true
            }
        ];
        globalStore.storeData(keys.gui.mainpage.chartList, []);
        globalStore.storeData(keys.gui.mainpage.addOns, []);
        selectChart(0);
        GuiHelper.keyEventHandler(this,(component,action)=>{
            if (action == "selectChart"){
                let chartlist=globalStore.getData(keys.gui.mainpage.chartList);
                let selected=globalStore.getData(keys.gui.mainpage.selectedChartIndex,0);
                if (chartlist && chartlist[selected]){
                    showNavpage(chartlist[selected]);
                }
            }
            if (action == "nextChart"){
                selectChart(1);
            }
            if (action == "previousChart"){
                selectChart(-1);
            }
        },"page",["selectChart","nextChart","previousChart"]);
        this.timer=GuiHelper.lifecycleTimer(this,this.timerCall,globalStore.getData(keys.properties.positionQueryTimeout),true);
    }


    componentDidMount() {
        globalStore.storeData(keys.gui.global.soundEnabled,true);
        readAddOns();
        fillList();
    }
    componentDidUpdate(){
        readAddOns();
        fillList();
    }

    timerCall(sequence){
        if (sequence != this.timer.currentSequence()) return;
        Requests.getJson("?request=nmeaStatus")
            .then((json)=>{
                globalStore.storeData(keys.gui.mainpage.status,json.data);
                this.timer.startTimer(sequence);
            })
            .catch((error)=>{
                globalStore.storeData(keys.gui.mainpage.status,{});
                this.timer.startTimer(sequence);
            })
    }

    render() {
        let self = this;
        let ChartItem = function (props) {
            let cls="chartItem";
            if (props.selected) cls+=" activeEntry";
            if (props.originalScheme) cls+=" userAction";
            return (
                <div className={cls} onClick={props.onClick}>
                    <img src={chartImage}/>
                    <span className="chartName">{props.name}</span>
                    <span className="more"/>
                </div>
            );
        };
        let BottomLine = Dynamic(function (props) {
            //we have the raw nmea in "raw"
            let nmeaColor=!props.connectionLost?"yellow":"red";
            let aisColor=!props.connectionLost?"yellow":"red";
            let nmeaText=!props.connectionLost?"":"server connection lost";
            let aisText="";
            if (!props.connectionLost) {
                if (props.status && props.status.nmea) {
                    nmeaColor = props.status.nmea.status;
                    nmeaText = props.status.nmea.source + ":" + props.status.nmea.info;
                }
                if (props.status && props.status.ais) {
                    aisColor = props.status.ais.status;
                    aisText = props.status.ais.source + ":" + props.status.ais.info;
                }
            }
            return (
                <div className='footer'>
                    <div className='inner'>
                        <div className='status'>
                            <div >
                                <img className='status_image' src={getImgSrc(nmeaColor)}/>
                                NMEA&nbsp;{nmeaText}
                            </div>
                            {!props.connectionLost ? <div >
                                <img className='status_image' src={getImgSrc(aisColor)}/>
                                AIS&nbsp;{aisText}
                            </div> : null
                            }
                        </div>
                        <div className="link">
                            <div > AVNav Version <span >{avnav.version}</span></div>
                            <div><a href="http://www.wellenvogel.de/software/avnav/index.php" className="extLink">www.wellenvogel.de/software/avnav/index.php</a>
                            </div>
                        </div>
                    </div>
                </div>
            )
        });
        return (
            <Page
                  className={this.props.className}
                  style={this.props.style}
                  id="mainpage"
                  title="AvNav"
                  mainContent={
                    <DynamicList className="mainContent"
                               itemClass={ChartItem}
                               onItemClick={showNavpage}
                               itemList={[]}
                               storeKeys={{
                                    itemList:keys.gui.mainpage.chartList,
                                    selectedIndex: keys.gui.mainpage.selectedChartIndex
                                    }}
                               scrollable={true}
                               listRef={(list)=>{
                                    if (!list) return;
                                    let selected=list.querySelector('.activeEntry');
                                    let mode=GuiHelper.scrollInContainer(list,selected);
                                    if (mode < 1 || mode > 2) return;
                                    selected.scrollIntoView(mode==1);
                               }}
                        />
                        }
                  bottomContent={
                    <BottomLine storeKeys={{
                        status:keys.gui.mainpage.status,
                        valid: keys.nav.gps.valid,
                        connectionLost: keys.nav.gps.connectionLost
                        }} />
                    }
                  buttonList={self.buttons}/>
        );


    }


}


const fillList = function () {
    Requests.getJson("?request=list&type=chart",{timeout:3*parseFloat(globalStore.getData(keys.properties.networkTimeout))}).then((json)=>{
            let items = [];
            for (let e in json.items) {
                let chartEntry = json.items[e];
                if (chartEntry.key) chartEntry.key=chartEntry.name;
                items.push(chartEntry);
            }
            globalStore.storeData(keys.gui.mainpage.chartList, items);
        },
        (error)=>{
            Toast("unable to read chart list: "+error);
        });
};
const readAddOns = function () {
    Addons.readAddOns(true)
        .then((items)=>{
            globalStore.storeData(keys.gui.mainpage.addOns, items);
        })
        .catch(()=>{});
};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
const showNavpage = function (entry) {
    base.log("activating navpage with url " + entry.url);
    MapHolder.setChartEntry(entry);
    history.push('navpage');

};



module.exports = Dynamic(MainPage,{storeKeys:keys.gui.global.reloadSequence});