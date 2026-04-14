/**
 * # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */
import Button, {ButtonDef, updateButtons} from '../components/Button';
import ItemList from '../components/ItemList';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {SyntheticEvent, useCallback, useEffect, useRef, useState} from 'react';
import {PageFrame, PageLeft, PageProps} from '../components/Page';
import Toast from '../components/Toast';
import Requests from '../util/requests';
import base from '../base';
// @ts-ignore
import chartImage from '../images/Chart60.png';
// @ts-ignore
import EditOverlaysDialog from '../components/EditOverlaysDialog.jsx';
// @ts-ignore
import mapholder from "../map/mapholder";
import LocalStorage from '../util/localStorageManager';
import Helper, {avitem} from "../util/helper";
import {RecursiveCompare} from "../util/compare";
import {getUrlWithBase, Item} from "../util/itemFunctions";
import {InjectMainMenu, useInitialButton} from "./MainNav";
import {PAGEIDS} from "../util/pageids";
import MainPageButtons from "./MainPageButtons";
import {useStoreState} from "../hoc/Dynamic";
import {scrollInContainer, useKeyEventHandlerPlain, useStateRef, useTimer} from "../util/UiHelper";
import {useHistory} from "../components/HistoryProvider";
import ButtonList from "../components/ButtonList";


const getImgSrc=function(color:string){
    if (color == "red") return globalStore.getData(keys.properties.statusErrorImage);
    if (color == "green") return globalStore.getData(keys.properties.statusOkImage);
    if (color == "yellow")return globalStore.getData(keys.properties.statusYellowImage);
};

const BottomLine = () => {
    const [connectionLost] = useStoreState(keys.nav.gps.connectionLost);
    const [status, setStatus] = useState<any>({})
    const timer = useTimer((seq: number) => {
        Requests.getJson({
            request: 'api',
            type: 'decoder',
            command: 'nmeaStatus'
        })
            .then((json) => {
                timer.guardedCall(seq, () => setStatus(json.data));
                timer.startTimer(seq);
            }, () => {
                timer.guardedCall(seq, () => setStatus({}));
                timer.startTimer(seq);
            })
    }, globalStore.getData(keys.properties.positionQueryTimeout), true, true)


    //we have the raw nmea in "raw"
    let nmeaColor = connectionLost ? "yellow" : "red";
    let aisColor = connectionLost ? "yellow" : "red";
    let nmeaText = connectionLost ? "" : "server connection lost";
    let aisText = "";
    if (!connectionLost) {
        if (status && status.nmea) {
            nmeaColor = status.nmea.status;
            nmeaText = status.nmea.source + ":" + status.nmea.info;
        }
        if (status && status.ais) {
            aisColor = status.ais.status;
            aisText = status.ais.source + ":" + status.ais.info;
        }
    }
    return (
        <div className='footer'>
            <div className='inner'>
                <div className='status'>
                    <div>
                        <img className='status_image' src={getImgSrc(nmeaColor)}/>
                        NMEA&nbsp;{nmeaText}
                    </div>
                    {!connectionLost ? <div>
                        <img className='status_image' src={getImgSrc(aisColor)}/>
                        AIS&nbsp;{aisText}
                    </div> : null
                    }
                </div>
                <div className="link">
                    <div> AVNav Version <span>{Helper.avNavVersion()}</span></div>
                    <div><a href="http://www.wellenvogel.de/software/avnav/index.php"
                            className="extLink">www.wellenvogel.de/software/avnav/index.php</a>
                    </div>
                </div>
            </div>
        </div>
    )
}

interface ChartItemProps{
    hasOverlay?: boolean;
    originalScheme?: boolean;
    selected?: boolean;
    onClick?: (ev:SyntheticEvent) => void;
    displayName?: string;
    name?: string;
    redrawCallback:()=>void;

}
const ChartItem=(props:ChartItemProps)=>{
    let cls="chartItem";
    if (props.selected) cls+=" activeEntry";
    if (props.originalScheme) cls+=" userAction";
    cls+=props.hasOverlay?" withOverlays":" noOverlays";
    const isConnected=globalStore.getData(keys.gui.global.connectedMode,false);
    return (
        <div className={cls} onClick={props.onClick}>
            <img src={getUrlWithBase(props,'icon')||chartImage}/>
            <span className="chartName">{props.displayName||props.name}</span>
            {isConnected && <Button
                className="smallButton"
                name="MainOverlays"
                onClick={(ev)=>{
                    ev.stopPropagation();
                    EditOverlaysDialog.createDialog(props,()=>{
                        props.redrawCallback();
                        mapholder.setRedraw(true);
                    });
                }}
            />}
        </div>
    );
}

const DEFAULT_QUERY_INTERVAL=3000;
const EMPTY_QUERY_INTERVAL=500;

const nameForSort=(item:Item)=>{
    const n=item?(item.displayName||item.name):undefined;
    return (n||'ZZZ').toUpperCase();
}
const MainPage = (props: PageProps) => {
    const [chartList, setChartList, chartListRef] = useStateRef([]);
    const [selectedChart, setSelectedChart, selectedChartRef] = useStateRef(undefined);
    const [loading, setLoading] = useState(false);
    const [reload] = useStoreState(keys.gui.global.reloadSequence);
    const history = useHistory();
    const currentButtons = useRef<ButtonDef[]>(null);
    const timer = useTimer((sequence: number) => {
        Requests.getJson({
            request: 'api',
            type: 'chart',
            command: 'list'
        }, {timeout: 3 * parseFloat(globalStore.getData(keys.properties.networkTimeout))}).then((json) => {
                const items = [];
                let current = mapholder.getBaseChart();
                const lastLoaded = mapholder.getLastChartKey();
                const lastChartKey = current ? current.getChartKey() : lastLoaded ? lastLoaded.key : undefined;
                let i = 0;
                let selectedChart;
                const isLoading = json.loading;
                json.items.sort((a: any, b: any) => {
                    const nameA = nameForSort(a);
                    const nameB = nameForSort(b);
                    if (nameA < nameB) {
                        return -1;
                    }
                    if (nameA > nameB) {
                        return 1;
                    }
                    return 0;
                })
                for (const e in json.items) {
                    const chartEntry = json.items[e];
                    if (!chartEntry) continue;
                    chartEntry.key = chartEntry.name;
                    if (lastChartKey === chartEntry.name) {
                        selectedChart = i;
                    }
                    chartEntry.redrawCallback=()=>timer.restart();
                    items.push(chartEntry);
                    i++;
                }
                setLoading(isLoading);
                if (selectedChart === undefined && items.length > 0) {
                    selectedChart = 0;
                    current = undefined; //it seems that the last chart from the mapholder is not available any more
                                         //just set the first chart
                }
                if (selectedChart !== undefined) {
                    setSelectedChart(selectedChart);
                    //if current is undefined we have just started
                    //just set the chart entry at the mapholder
                    if (!current) {
                        if (!props.options || !props.options.noInitial) {
                            mapholder.setChartEntry(items[selectedChart]);
                        }
                    }
                }
                if (!RecursiveCompare(chartListRef.current, items)) setChartList(items);
                if (sequence !== undefined) {
                    timer.setTimeout(isLoading ? EMPTY_QUERY_INTERVAL : DEFAULT_QUERY_INTERVAL)
                    timer.startTimer(sequence);
                }
            },
            (error) => {
                Toast("unable to read chart list: " + error);
                if (sequence !== undefined) timer.startTimer(sequence);
            });

    }, DEFAULT_QUERY_INTERVAL,true,true)
    useEffect(() => {
        timer.restart();
    }, [reload])
    const selectChart = (offset: number) => {
        const len = (chartListRef.current || []).length;
        const currentIndex = selectedChartRef.current;
        let newIndex = currentIndex + offset;
        if (newIndex >= len) {
            newIndex = 0;
        }
        if (newIndex < 0) {
            newIndex = 0;
        }
        if (newIndex != currentIndex) {
            setSelectedChart(newIndex);
        }
    }
    useKeyEventHandlerPlain("page", "selectChart", () => {
        const chartlist = chartListRef.current;
        const selected = selectedChartRef.current || 0;
        if (chartlist && chartlist[selected]) {
            showNavpage(chartlist[selected]);
        }
    })
    useKeyEventHandlerPlain("page", "nextChart", () => {
        selectChart(1);
    })
    useKeyEventHandlerPlain("page", "prevChart", () => {
        selectChart(-1);
    })

    const buttonActions = {
        ShowGps: {
            onClick: () => {
                history.push(PAGEIDS.GPS)
            }
        },
        NavOverlays: {
            onClick: () => {
                EditOverlaysDialog.createDialog(undefined, () => mapholder.setRedraw(true));
            }
        },
        Cancel: {
            onClick: () => {
                // @ts-ignore
                if (window.avnavAndroid) window.avnavAndroid.goBack()
            }
        }
    }


    /**
     * the click handler for the charts
     * @param ev - the chart entry
     */
    const showNavpage = useCallback((ev: SyntheticEvent) => {
        const entry = avitem(ev);
        base.log("activating navpage with url " + entry.url);
        mapholder.setChartEntry(entry);
        history.push(PAGEIDS.NAV);
    }, []);

    const normalActions = updateButtons(MainPageButtons, buttonActions);
    currentButtons.current = InjectMainMenu(PAGEIDS.MAIN, normalActions);
    useInitialButton(currentButtons);
    useEffect(() => {
        globalStore.storeData(keys.gui.global.soundEnabled, true);
    }, []);
    const Title = () => <React.Fragment>
        <span>{"AvNav " + LocalStorage.getPrefix() + " Select Chart"}</span>
        {loading && <span className={"spinner"}/>}
    </React.Fragment>
    return (
        <PageFrame
            id={props.id}>
            <PageLeft
                title={<Title/>} id={props.id}>
                <ItemList className="mainContent"
                          itemClass={ChartItem}
                          onItemClick={showNavpage}
                          itemList={chartList}
                          selectedIndex={selectedChart}
                          scrollable={true}
                          listRef={(list) => {
                              if (!list) return;
                              const selected = list.querySelector('.activeEntry');
                              const mode = scrollInContainer(list, selected as HTMLElement);
                              if (mode < 1 || mode > 2) return;
                              selected.scrollIntoView(mode == 1);
                          }}
                />
                <BottomLine/>
            </PageLeft>
            <ButtonList itemList={currentButtons.current} page={props.id}/>
        </PageFrame>
    );

}


export default MainPage;