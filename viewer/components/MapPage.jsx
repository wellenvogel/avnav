/**
 * Created by andreas on 02.05.14.
 * a page component that displays a map
 * and widget containers
 */

import Dynamic, {useStore} from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import PropTypes from 'prop-types';
import Page, {PageFrame, PageLeft} from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import {handleCtxRef, showDialog, showPromiseDialog} from '../components/OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import MapHolder from '../map/mapholder.js';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import EulaDialog from './EulaDialog.jsx';
import EditOverlaysDialog from './EditOverlaysDialog.jsx';
import {getOverlayConfigName} from "../map/chartsourcebase";
import mapholder from "../map/mapholder.js";
import Helper, {concatsp, injectav} from "../util/helper";
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import {DynamicTitleIcons} from "./TitleIcons";
import ButtonList from "./ButtonList";
import base from "../base";

const SHOW_MODE={
    never:0,
    once: 1,
    session:2
};

const INFO_TYPES={
    eula:STORAGE_NAMES.EULAS,
    info:STORAGE_NAMES.CHARTINFO
};

const needsToShow=(setName,type,mode)=>{
    if (mode == SHOW_MODE.never) return false;
    let currentRaw=LocalStorage.getItem(type)||"{}";
    let current={};
    try{
        current=JSON.parse(currentRaw);
    }catch (e){
        base.log("unable to read state for "+type);
    }
    let lastShown=current[setName];
    if (lastShown === undefined) return true;
    if (mode == SHOW_MODE.once) return false;
    let lastDate=undefined;
    try{
        lastDate=new Date(lastShown);
    }catch (e){

    }
    if (lastDate === undefined) return true;
    let now=new Date();
    return lastDate.getDay() != now.getDay();
};

const setShown=(setName,type)=>{
    let currentRaw=LocalStorage.getItem(type)||"{}";
    let current={};
    try{
        current=JSON.parse(currentRaw);
    }catch (e){
        base.log("unable to read state for "+type);
    }
    current[setName]=(new Date()).getTime();
    LocalStorage.setItem(type,undefined,JSON.stringify(current));
};




const widgetCreator=(widget,mode)=>{
    let rt=WidgetFactory.createWidget(widget,{mode:mode,handleVisible:!globalStore.getData(keys.gui.global.layoutEditing)});
    if (widget.name=='CenterDisplay'){
        rt=Dynamic(Visible(rt),{
            storeKeys:{
                locked:keys.map.lockPosition,
                editing: keys.gui.global.layoutEditing
            },
            updateFunction:(state)=>{return {visible:!state.locked || state.editing}}
        })
    }
    return rt;
};


const getLayoutPage=(props)=>{
    return {
        location: props.location||props.id,
        options: props.options,
        id:props.id
    }
}
const setBottom=(val)=>{
    let el=document.querySelector('.ol-scale-bar');
    if (el){
        el.style.bottom=val;
    }
}
const Map=({mapClass,mapOpacity})=>{
    return <div
        className={mapClass}
        ref={(el)=>{
            MapHolder.renderTo(el);
        }}
        style={{opacity:mapOpacity}}>
    </div>;
}
const MapPage =(iprops)=>{
    const props=useStore(iprops,{storeKeys:LayoutHandler.getStoreKeys({
            widgetFontSize:keys.properties.widgetFontSize,
            mapFloat: keys.properties.mapFloat
        })});
    const [buttonWidth,setButtonWidth]=useState(undefined);
    const buttonsHidden=useRef(false);
    const dialogCtx=useRef();
    const bottomRef=useRef();
    const layoutPage=getLayoutPage(props);
    const mapEvent=useCallback((evdata)=>{
        if (globalStore.getData(keys.gui.global.layoutEditing)) return;
        if (props.mapEventCallback) return props.mapEventCallback(evdata);
    },[props.mapEventCallback]);
    const computeScalePosition=useCallback(()=>{
        if (! props.mapFloat){
            setBottom('0px');
        }
        else{
            if (!bottomRef.current) return;
            let rect=bottomRef.current.getBoundingClientRect();
            setBottom(rect.height+"px");
        }
    },[props.mapFloat]);
    const showMap=useCallback((chartEntry)=>{
        if (chartEntry.infoMode !== undefined ){
            if (needsToShow(chartEntry.url,INFO_TYPES.info,chartEntry.infoMode)){
                Toast("Chart "+chartEntry.info);
                setShown(chartEntry.url,INFO_TYPES.info);
            }
        }
        MapHolder.loadMap().
        then((result)=>{
            computeScalePosition();
        }).
        catch((error)=>{Toast(error)});
    },[]);
    //we rely on map events being only triggered by load map when a promise resolves (i.e. async to this code)
    //this way the order of our effects does not really matter (although the subscribe effect will run AFTER the next one that triggers loadMap) -
    //see https://www.zipy.ai/blog/useeffect-hook-guide#:~:text=React%20determines%20the%20order%20of,they%20appear%20in%20the%20code.
    useEffect(() => {
        const id=MapHolder.subscribe(mapEvent);
        return ()=>MapHolder.unsubscribe(id);
    }, [mapEvent]);
    useEffect(() => {
        let chartEntry=MapHolder.getCurrentChartEntry()||{};
        if (chartEntry.eulaMode !== undefined){
            if (needsToShow(chartEntry.url,INFO_TYPES.eula,chartEntry.eulaMode)){
                showPromiseDialog(dialogCtx.current,(dprops)=><EulaDialog {...dprops} eulaUrl={chartEntry.url+"/eula"} name={chartEntry.name}/>)
                    .then(()=>{
                        setShown(chartEntry.url,INFO_TYPES.eula);
                        showMap(chartEntry);
                    })
                    .catch(()=>{
                        Toast("EULA rejected");
                    });
                return;
            }
        }
        showMap(chartEntry);
    }, []);
    useEffect(()=>computeScalePosition());
    const WidgetContainer=useCallback((wcprops)=>{
        let {panel,mode,layoutPage,...forward}=wcprops;
        let panelItems=props.panelCreator(panel);
        if (! panelItems.list) return null;
        let invertEditDirection=mode==='vertical'||panel === 'bottomLeft';
        return <ItemList  {...forward}
                          className={"widgetContainer "+mode+" "+panel}
                          itemCreator={(widget)=>{
                              return widgetCreator(widget,mode)
                          }}
                          itemList={panelItems.list}
                          onItemClick={(ev)=>{
                              const avev=injectav(ev);
                              avev.avnav.panelName=panelItems.name;
                              avev.avnav.invertEditDirection=invertEditDirection;
                              props.onItemClick(avev);
                          }}
                          onClick={()=>{
                              EditWidgetDialog.createDialog(undefined,layoutPage,panelItems.name,{fixPanel: true,beginning:invertEditDirection,types:["!map"]});
                          }}
                          dragdrop={globalStore.getData(keys.gui.global.layoutEditing)}
                          horizontal={mode === 'horizontal'}
                          allowOther={true}
                          dragFrame={panelItems.name}
                          onSortEnd={(oldIndex,newIndex,frameId,targetFrameId)=>{
                              LayoutHandler.withTransaction(layoutPage,(handler)=>handler.moveItem(layoutPage.id, frameId, oldIndex, newIndex,targetFrameId))
                          }}
        />
        },[props.onItemClick]);
        let chartEntry=MapHolder.getCurrentChartEntry()||{};
        let mapClass=concatsp("map",chartEntry.chartKey?chartEntry.chartKey.replace(/[^a-zA-Z0-9_@]/g,"").replace('@',' '):undefined);
        let mapOpacity=globalStore.getData(keys.properties.nightMode) ?
            globalStore.getData(keys.properties.nightChartFade, 100) / 100:1;
        let className=Helper.concatsp(props.className,"mapPage",props.mapFloat?"mapFloat":undefined);
        let pageProperties=Helper.filteredAssign(Page.propTypes,props);
        let overlay=props.overlayContent || null;
        if (typeof(overlay) === 'function'){
            overlay=overlay({});
        }
        return (
            <PageFrame
                {...pageProperties}
                className={className}
                hideCallback={(hidden)=>{
                    mapholder.updateSize();
                    buttonsHidden.current=hidden;
                }}
                editingChanged={()=>mapholder.updateSize()}
            >
                {props.mapFloat && <DynamicTitleIcons rightOffset={buttonWidth}/> }
                {props.mapFloat?<Map mapClass={mapClass} mapOpacity={mapOpacity} />:null}
                <PageLeft dialogCtxRef={(ctx)=>{
                    dialogCtx.current=ctx;
                    handleCtxRef(ctx,props.dialogCtxRef);
                }}>
                        <div className="leftSection">
                            <WidgetContainer
                                fontSize={props.widgetFontSize + "px"}
                                panel="left"
                                mode="vertical"
                                layoutPage={layoutPage}

                            />
                            <WidgetContainer
                                fontSize={props.widgetFontSize + "px"}
                                panel="top"
                                mode="horizontal"
                                layoutPage={layoutPage}
                            />
                            <div className={'mapFrame'}>
                            {!props.mapFloat && <DynamicTitleIcons /> }
                            {!props.mapFloat && <Map mapClass={mapClass} mapOpacity={mapOpacity}/>}
                            {overlay}
                            </div>
                        </div>
                        <div ref={(container)=>{
                            bottomRef.current=container;
                            computeScalePosition();
                        }}
                            className={"bottomSection" + (globalStore.getData(keys.properties.allowTwoWidgetRows) ? " twoRows" : "")}>
                            <WidgetContainer
                                reverse={true}
                                fontSize={props.widgetFontSize + "px"}
                                panel='bottomLeft'
                                mode="horizontal"
                                layoutPage={layoutPage}
                            />
                            <WidgetContainer
                                fontSize={props.widgetFontSize + "px"}
                                panel="bottomRight"
                                mode="horizontal"
                                layoutPage={layoutPage}
                            />
                        </div>
                </PageLeft>
                <ButtonList
                    itemList={props.buttonList}
                    widthChanged={(width)=>{
                        setButtonWidth(width);
                        mapholder.updateSize();
                    }}
                    />
            </PageFrame>

        );
}

MapPage.propertyTypes={
    ...Page.pageProperties,
    buttonList:         PropTypes.array,
    panelCreator:       PropTypes.func.isRequired,  //will be called with the panel name
                                                    //and must return {name: panelName, list:widget list}
    onItemClick:        PropTypes.func.isRequired,  //like ItemList
    mapEventCallback:   PropTypes.func,
    id:                 PropTypes.string,
    overlayContent:     PropTypes.any,               //overlay in the map container
    mapLoadCallback:    PropTypes.func,
    autoHideButtons:    PropTypes.any,
    widgetFontSize:     PropTypes.number,
    mapFloat:           PropTypes.bool,
    dialogCtxRef: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.shape({current: PropTypes.any})
    ])


};

export const overlayDialog=(dialogContext,opt_chartName,opt_updateCallback)=>{
    let current=MapHolder.getCurrentMergedOverlayConfig();
    if (! current) return;
    let currentChart=MapHolder.getCurrentChartEntry()||{};
    showDialog(dialogContext,(props)=> {
        let canEdit=getOverlayConfigName(currentChart) !== undefined && globalStore.getData(keys.properties.connectedMode,false) ;
        return <EditOverlaysDialog
            {...props}
            chartName={opt_chartName||currentChart.name}
            title="Active Overlays"
            current={current}
            updateCallback={(newConfig)=>{
                MapHolder.updateOverlayConfig(newConfig);
                if (opt_updateCallback) opt_updateCallback(newConfig);
                }
            }
            resetCallback={()=>{
                MapHolder.resetOverlayConfig();
            }}
            editCallback={(canEdit)?()=>{
                EditOverlaysDialog.createDialog(currentChart,(nv)=>{
                    if (nv) {
                        MapHolder.loadMap().then(()=>{
                            MapHolder.resetOverlayConfig();
                        })
                    }
                });
                return true;
            }:undefined}
            preventEdit={true}
            />;
    });
};

MapPage.PANELS=['left','top','bottomLeft','bottomRight'];

export default MapPage;