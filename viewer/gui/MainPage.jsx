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

const DynamicList = Dynamic(ItemList);
const flatten = function (object, key) {
    return object[key];
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
                storeKeys: [keys.gui.global.onAndroid, keys.gui.global.connected],
                updateFunction: (state, skeys) => {
                    return {
                        visible: !state[keys.gui.global.onAndroid],
                        toggle: state[keys.gui.global.connected]
                    }
                },
                onClick: ()=> {
                    let con = globalStore.getData(keys.gui.global.connected, false);
                    con = !con;
                    PropertyHandler.setValueByName("connectedMode", con);
                    PropertyHandler.saveUserData();
                    globalStore.storeData(keys.gui.global.connected, con);
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
                storeKeys: {toggle: keys.gui.global.nightMode},
                onClick: ()=> {
                    let mode = globalStore.getData(keys.gui.global.nightMode, false);
                    mode = !mode;
                    PropertyHandler.setValueByName('nightMode', mode);
                    PropertyHandler.saveUserData();
                    PropertyHandler.updateLayout();
                    globalStore.storeData(keys.gui.global.nightMode, mode);
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
                    history.push('addonpage')
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
        let Headline = function (props) {
            return <div className="header">AvNav</div>
        };
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
            return (
                <div className='footer'>
                    <div className='inner'>
                        <div className='status'>
                            <div >
                                <img className='status_image' src={props.nmeaStatusSrc}/>
                                NMEA&nbsp;{props.nmeaStatusText}
                            </div>
                            <div >
                                <img className='status_image' src={props.aisStatusSrc}/>
                                AIS&nbsp;{props.aisStatusText}
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
        let ChartList = Dynamic(ItemList);
        let Buttons = function (props) {
            return <DynamicList
                itemClass={Dynamic(Visible(Button))}
                className="buttonContainer"
                itemList={self.buttons}
                storeKeys={{fontSize:keys.gui.global.buttonFontSize}}
                />
        };

        return (
            <div className="page" id="avi_mainpage">
                <div className="leftPart">
                    <Headline/>
                    <ChartList className="mainContent"
                               itemClass={ChartItem}
                               onItemClick={showNavpage}
                               itemList={[]}
                               storeKeys={{itemList:keys.gui.mainpage.chartList}}
                               scrollable={true}
                        />
                    <BottomLine storeKeys={keys.status} updateFunction={flatten}/>
                </div>
                <Buttons/>
            </div>
        );


    }


}


const fillList = function () {
    let url = PropertyHandler.getProperties().navUrl + "?request=listCharts";
    $.ajax({
        url: url,
        dataType: 'json',
        cache: false,
        error: function (ev) {
            alert("unable to read chart list: " + ev.responseText);
        },
        success: function (data) {
            if (data.status != 'OK') {
                alert("reading chartlist failed: " + data.info);
                return;
            }
            let items = [];
            for (let e in data.data) {
                let chartEntry = data.data[e];
                let listEntry = {
                    key: chartEntry.name,
                    name: chartEntry.name,
                    url: chartEntry.url,
                    charturl: chartEntry.charturl
                };
                items.push(listEntry);
            }
            globalStore.storeData(keys.gui.mainpage.chartList, items);
        }

    });
};
const readAddOns = function () {
    if (globalStore.getData(keys.gui.global.onAndroid, false)) return;
    let url = PropertyHandler.getProperties().navUrl + "?request=readAddons";
    $.ajax({
        url: url,
        dataType: 'json',
        cache: false,
        error: function (ev) {
            alert("unable to read addons: " + ev.responseText);
        },
        success: function (data) {
            if (data.status != 'OK') {
                alert("reading addons failed: " + data.info);
                return;
            }
            let items = [];
            for (let e in data.data) {
                let button = data.data[e];
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
        }

    });
};

/**
 * the click handler for the charts
 * @param entry - the chart entry
 */
const showNavpage = function (entry) {
    avnav.log("activating navpage with url " + entry.url);
    history.push('navpage', {url: entry.url, charturl: entry.charturl});

};



module.exports = MainPage;