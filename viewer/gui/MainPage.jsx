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
import Toast from '../util/overlay.js';
import Requests from '../util/requests.js';
import MapHolder from '../map/mapholder.js';

const DynamicList = Dynamic(ItemList);


const getImgSrc=function(color){
    if (color == "red") return globalStore.getData(keys.properties.statusErrorImage);
    if (color == "green") return globalStore.getData(keys.properties.statusOkImage);
    if (color == "yellow")return globalStore.getData(keys.properties.statusYellowImage);
};

class MainPage extends React.Component {
    constructor(props) {
        super(props);
        let self=this;
        this.buttons = [
            {
                name: 'ShowStatus',
                onClick: ()=> {
                    history.push('statuspage')
                }
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
                }
            },
            {
                name: 'Connected',
                storeKeys: [keys.gui.global.onAndroid, keys.properties.connectedMode],
                updateFunction: (state, skeys) => {
                    return {
                        visible: !state[keys.gui.global.onAndroid],
                        toggle: state[keys.properties.connectedMode]
                    }
                },
                onClick: ()=> {
                    let con = globalStore.getData(keys.properties.connectedMode, false);
                    con = !con;
                    globalStore.storeData(keys.properties.connectedMode, con);
                }
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
                }
            },
            {
                name: 'MainInfo',
                onClick: ()=> {
                    history.push('infopage')
                }
            },
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
                    history.push('addonpage',{addOns:globalStore.getData(keys.gui.mainpage.addOns,[])})
                }
            }
        ];
        globalStore.storeData(keys.gui.mainpage.chartList, []);
        globalStore.storeData(keys.gui.mainpage.addOns, [])
    }


    componentDidMount() {
        readAddOns();
        fillList();
    }

    render() {
        let self = this;
        let ChartItem = function (props) {
            return (
                <div className="chartItem" onClick={props.onClick}>
                    <img src="images/Chart60.png"/>
                    <span className="">{props.name}</span>
                    <span className="more"/>
                </div>
            );
        };
        let BottomLine = Dynamic(function (props) {
            //we have the raw nmea in "raw"
            let nmeaColor="yellow";
            let aisColor="yellow";
            let nmeaText="";
            let aisText="";
            if (props.raw && props.raw.status && props.raw.status.nmea){
                nmeaColor=props.raw.status.nmea.status;
                nmeaText=props.raw.status.nmea.source+":"+props.raw.status.nmea.info;
            }
            if (props.raw && props.raw.status && props.raw.status.ais){
                aisColor = props.raw.status.ais.status;
                aisText=props.raw.status.ais.source+":"+props.raw.status.ais.info;
            }
            return (
                <div className='footer'>
                    <div className='inner'>
                        <div className='status'>
                            <div >
                                <img className='status_image' src={getImgSrc(nmeaColor)}/>
                                NMEA&nbsp;{nmeaText}
                            </div>
                            <div >
                                <img className='status_image' src={getImgSrc(aisColor)}/>
                                AIS&nbsp;{aisText}
                            </div>
                        </div>
                        <div className="link">
                            <div > AVNav Version <span >{window.avnav_version}</span></div>
                            <div><a href="http://www.wellenvogel.de/software/avnav/index.php" className="avn_extlink">www.wellenvogel.de/software/avnav/index.php</a>
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
                               storeKeys={{itemList:keys.gui.mainpage.chartList}}
                               scrollable={true}
                        />
                        }
                  bottomContent={
                    <BottomLine storeKeys={{raw:keys.nav.gps.raw}} />
                    }
                  buttonList={self.buttons}/>
        );


    }


}


const fillList = function () {
    Requests.getJson("?request=listCharts").then((json)=>{
            let items = [];
            for (let e in json.data) {
                let chartEntry = json.data[e];
                let listEntry = {
                    key: chartEntry.name,
                    name: chartEntry.name,
                    url: chartEntry.url,
                    charturl: chartEntry.charturl
                };
                items.push(listEntry);
            }
            globalStore.storeData(keys.gui.mainpage.chartList, items);
        },
        (error)=>{
            Toast.Toast("unable to read chart list: "+error);
        });
};
const readAddOns = function () {
    if (globalStore.getData(keys.gui.global.onAndroid, false)) return;
    Requests.getJson("?request=readAddons").then((json)=>{
            let items = [];
            for (let e in json.data) {
                let button = json.data[e];
                let entry = {
                    key: button.key,
                    url: button.url,
                    icon: button.icon,
                    title: button.title
                };
                if (entry.key) {
                    items.push(entry);
                }
            }
            globalStore.storeData(keys.gui.mainpage.addOns, items);
        },
        (error)=>{
            Toast.Toast("reading addons failed: " + error);
        });
};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
const showNavpage = function (entry) {
    avnav.log("activating navpage with url " + entry.url);
    MapHolder.setMapUrl(entry.url,entry.charturl);
    history.push('navpage');

};



module.exports = MainPage;