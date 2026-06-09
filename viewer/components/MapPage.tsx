/**
 * Created by andreas on 02.05.14.
 * a page component that displays a map
 * and widget containers
 */

import Dynamic, {useStore, useStoreState} from '../hoc/Dynamic';
// @ts-ignore
import Visible from '../hoc/Visible';
import ItemList, {Item} from './ItemList';
import globalStore from '../util/globalstore';
import keys from '../util/keys';
import React, {ReactElement, ReactNode, SyntheticEvent, useCallback, useEffect, useRef, useState} from 'react';

import {PageFrame, PageLeft, PageProps} from './Page';
import Toast from './Toast';
import {showPromiseDialog} from './OverlayDialog';
// @ts-ignore
import WidgetFactory from '../components/WidgetFactory';
// @ts-ignore
import mapholder from '../map/mapholder';
// @ts-ignore
import EditWidgetDialog from '../components/EditWidgetDialog';
import LayoutHandler from '../util/layouthandler';
// @ts-ignore
import EulaDialog from './EulaDialog';
// @ts-ignore
import EditOverlaysDialog from './EditOverlaysDialog';
import Helper, {concatsp, injectav} from "../util/helper";
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import {DynamicTitleIcons} from "./TitleIcons";
import ButtonList from "./ButtonList";
import base from "../base";
import {PageType} from "../util/pageids";
import Button, {ButtonDef, DynamicButtonProps} from "./Button";
import {ChartEntry, MapEvent, MapEventCallback, SHOW_MODE} from "../map/maptypes";
import {useDialogContext} from "./exports";
import {IDialogContext} from "./DialogContext";
import {addonViewManager} from "./AddonView";
import {InternalWidgetDefinition} from "../util/types";
import {ChartSelectDialog} from "./ChartsSelectDialog";
import ButtonDefs from "./ButtonDefs";

const INFO_TYPES={
    eula:STORAGE_NAMES.EULAS,
    info:STORAGE_NAMES.CHARTINFO
};

const needsToShow=(setName:string,type:string,mode:SHOW_MODE)=>{
    if (mode == SHOW_MODE.never) return false;
    const currentRaw=LocalStorage.getItem(type)||"{}";
    let current:Record<string,number>={};
    try{
        current=JSON.parse(currentRaw);
    }catch (e){
        base.log("unable to read state for "+type);
    }
    const lastShown=current[setName];
    if (lastShown === undefined) return true;
    if (mode == SHOW_MODE.once) return false;
    let lastDate=undefined;
    try{
        lastDate=new Date(lastShown);
    }catch (e){ /* empty */ }
    if (lastDate === undefined) return true;
    const now=new Date();
    return lastDate.getDay() != now.getDay();
};

const setShown=(setName:string,type:string)=>{
    const currentRaw=LocalStorage.getItem(type)||"{}";
    let current:Record<string,number>={};
    try{
        current=JSON.parse(currentRaw);
    }catch (e){
        base.log("unable to read state for "+type);
    }
    current[setName]=(new Date()).getTime();
    LocalStorage.setItem(type,undefined,JSON.stringify(current));
};




const widgetCreator=(widget:Record<string,any>,mode:string)=>{
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


interface LayoutPage{
    location:string;
    options:Record<string, any>;
    id:PageType
}
const getLayoutPage=(props:PageProps):LayoutPage=>{
    return {
        location: props.location||props.id,
        options: props.options,
        id:props.id
    }
}
const setBottom=(val:string)=>{
    const el=document.querySelector('.ol-scale-bar')as HTMLElement;
    if (el){
        el.style.bottom=val;
    }
}
interface MapOptions{
    mapClass?: string;
    mapOpacity?:number;
    rightOffset?: number;
}
const Map=({mapClass,mapOpacity,rightOffset}:MapOptions)=>{
    useStoreState(keys.gui.global.chartEntrySequence);
    const dialogContext=useDialogContext();
    if (!mapholder.getCurrentChartEntry()){
        return <div className={"noChart"}>
        <div className={"text"}>No Chart selected</div>
        <Button
            {...ButtonDefs.NavSelectChart}
            className={"center"}
            onClick={()=>selectChartDialog(dialogContext)}/>
        </div>;
    }
    return <div
        className={mapClass}
        ref={(el)=>{
            mapholder.renderTo(el);
        }}
        style={{opacity:mapOpacity,marginRight:rightOffset?rightOffset+"px":undefined}}>
    </div>;
}
export type PanelCreator =(name:string)=>{name:string|PageType,list?:InternalWidgetDefinition[]}  //will be called with the panel name
interface WidgetContainerProps{
    panelCreator:PanelCreator;
    panel:string,
    mode:string,
    layoutPage:LayoutPage
    onItemClick:(ev:SyntheticEvent) => void,
    fontSize?:string,
    reverse?:boolean,
}
const WidgetContainer=(wcprops:WidgetContainerProps)=> {
    const {panel, mode, layoutPage, ...forward} = wcprops;
    const panelItems = wcprops.panelCreator(panel);
    if (!panelItems.list) return null;
    const invertEditDirection = mode === 'vertical' || panel === 'bottomLeft';
    return <ItemList  {...forward}
                      className={"widgetContainer " + mode + " " + panel}
                      itemCreator={(widget) => {
                          return widgetCreator(widget, mode)
                      }}
                      itemList={panelItems.list}
                      onItemClick={(ev) => {
                          const avev = injectav(ev);
                          avev.avnav.panelName = panelItems.name;
                          avev.avnav.invertEditDirection = invertEditDirection;
                          wcprops.onItemClick(avev);
                      }}
                      onClick={() => {
                          EditWidgetDialog.createDialog(undefined, layoutPage, panelItems.name, {
                              fixPanel: true,
                              beginning: invertEditDirection,
                              types: ["!map"]
                          });
                      }}
                      dragdrop={globalStore.getData(keys.gui.global.layoutEditing)}
                      horizontal={mode === 'horizontal'}
                      allowOther={true}
                      dragFrame={panelItems.name}
                      onSortEnd={(oldIndex, newIndex, frameId, targetFrameId) => {
                          LayoutHandler.withTransaction(
                              layoutPage, (handler) => handler.moveItem(
                                  layoutPage.id,
                                  frameId as string,
                                  oldIndex,
                                  newIndex,
                                  targetFrameId as string))
                      }}
    />
}
export interface MapPageProps extends PageProps{
    buttonList:         ButtonDef[],
    panelCreator:       PanelCreator,
                                                    //and must return {name: panelName, list:widget list}
    onItemClick?:        (ev:SyntheticEvent)=>void;  //like ItemList
    mapEventCallback?:   MapEventCallback,
    id:                 PageType,
    overlayContent?:     ReactElement,               //overlay in the map container
    mapLoadCallback?:    ()=>void,
    hideCallback?:     (hidden:boolean) => void,
}
interface InternalMapPageProps extends MapPageProps{
    widgetFontSize:     number,
    mapFloat?:           boolean,
    reloadSequence: number,
    sequence: number,
}
const MapPage =(iprops:MapPageProps)=>{
    const sprops:InternalMapPageProps=useStore(iprops,{storeKeys:LayoutHandler.getStoreKeys({
            widgetFontSize:keys.properties.widgetFontSize,
            mapFloat: keys.properties.mapFloat,
            reloadSequence:keys.gui.global.reloadSequence,
            addon:keys.gui.global.addonViewChanged,
            sequence:keys.gui.global.chartEntrySequence
        })});
    //reset map float
    const hasAddon=!!addonViewManager.getPageAddon(iprops.id);
    const [layerTypes,setLayerTypes]=useState([]);
    const [buttonWidth,setButtonWidth]=useState(undefined);
    const buttonsHidden=useRef(false);
    const bottomRef=useRef<HTMLElement>();
    const dialogContext=useDialogContext();
    const layoutPage=getLayoutPage(sprops);
    const mapEvent=useCallback((evdata:MapEvent)=>{
        if (globalStore.getData(keys.gui.global.layoutEditing)) return;
        if (sprops.mapEventCallback) return sprops.mapEventCallback(evdata);
    },[sprops.mapEventCallback]);
    const computeScalePosition=useCallback(()=>{
        if (! sprops.mapFloat){
            setBottom('0px');
        }
        else{
            if (!bottomRef.current) return;
            const rect=bottomRef.current.getBoundingClientRect();
            setBottom(rect.height+"px");
        }
    },[sprops.mapFloat]);
    const showMap=useCallback((chartEntry:ChartEntry)=>{
        if (chartEntry.infoMode !== undefined ){
            if (needsToShow(chartEntry.url,INFO_TYPES.info,chartEntry.infoMode)){
                Toast("Chart "+chartEntry.info);
                setShown(chartEntry.url,INFO_TYPES.info);
            }
        }
        mapholder.loadMap().
        then(()=>{
            computeScalePosition();
            setLayerTypes(mapholder.getMapLayerNames());
        }).
        catch((error:any)=>{Toast(error)});
    },[]);
    //we rely on map events being only triggered by load map when a promise resolves (i.e. async to this code)
    //this way the order of our effects does not really matter (although the subscribe effect will run AFTER the next one that triggers loadMap) -
    //see https://www.zipy.ai/blog/useeffect-hook-guide#:~:text=React%20determines%20the%20order%20of,they%20appear%20in%20the%20code.
    useEffect(() => {
        const id=mapholder.subscribe(mapEvent);
        return ()=>mapholder.unsubscribe(id);
    }, [mapEvent]);
    useEffect(() => {
        const chartEntry:ChartEntry=mapholder.getCurrentChartEntry();
        if (! chartEntry) return;
        if (chartEntry.eulaMode !== undefined){
            if (needsToShow(chartEntry.url,INFO_TYPES.eula,chartEntry.eulaMode)){
                showPromiseDialog(dialogContext,(dprops)=><EulaDialog {...dprops} eulaUrl={chartEntry.url+"/eula"} name={chartEntry.name}/>)
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
    }, [sprops.sequence]);
    useEffect(() => {
        mapholder.updateSize();
    }, [sprops.mapFloat,hasAddon]);
    useEffect(()=>computeScalePosition());
        const chartEntry=mapholder.getCurrentChartEntry()||{};
        const mapClass=concatsp("map",chartEntry.name?chartEntry.name.replace(/[^a-zA-Z0-9_@]/g,"").replace('@',' '):undefined);
        const mapOpacity=globalStore.getData(keys.properties.nightMode) ?
            globalStore.getData(keys.properties.nightChartFade, 100) / 100:1;
        const className=Helper.concatsp(
            sprops.className,
            "mapPage",
            (sprops.mapFloat&&!hasAddon)?"mapFloat":undefined,
            layerTypes.join(" "));
        const overlay=sprops.overlayContent || null;
        return (
            <PageFrame
                {...sprops}
                className={className}
                hideCallback={(hidden)=>{
                    mapholder.updateSize();
                    buttonsHidden.current=hidden;
                    if (iprops.hideCallback) iprops.hideCallback(hidden);
                }}
                editingChanged={()=>mapholder.updateSize()}
            >
                {sprops.mapFloat && <DynamicTitleIcons rightOffset={buttonWidth}/> }
                {sprops.mapFloat?<Map mapClass={mapClass} mapOpacity={mapOpacity} rightOffset={hasAddon?buttonWidth:undefined}/>:null}
                <PageLeft id={sprops.id}>
                        <div className="leftSection">
                            <WidgetContainer
                                fontSize={sprops.widgetFontSize + "px"}
                                panel="left"
                                mode="vertical"
                                layoutPage={layoutPage} panelCreator={sprops.panelCreator}
                                onItemClick={sprops.onItemClick}
                            />
                            <WidgetContainer
                                fontSize={sprops.widgetFontSize + "px"}
                                panel="top"
                                mode="horizontal"
                                layoutPage={layoutPage}
                                panelCreator={sprops.panelCreator}
                                onItemClick={sprops.onItemClick}
                            />
                            <div className={'mapFrame'}>
                            {!sprops.mapFloat && <DynamicTitleIcons /> }
                            {!sprops.mapFloat && <Map mapClass={mapClass} mapOpacity={mapOpacity}/>}
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
                                fontSize={sprops.widgetFontSize + "px"}
                                panel='bottomLeft'
                                mode="horizontal"
                                layoutPage={layoutPage}
                                panelCreator={sprops.panelCreator}
                                onItemClick={sprops.onItemClick}
                            />
                            <WidgetContainer
                                fontSize={sprops.widgetFontSize + "px"}
                                panel="bottomRight"
                                mode="horizontal"
                                layoutPage={layoutPage}
                                panelCreator={sprops.panelCreator}
                                onItemClick={sprops.onItemClick}
                            />
                        </div>
                </PageLeft>
                <ButtonList
                    page={iprops.id}
                    itemList={iprops.buttonList}
                    widthChanged={(width)=>{
                        setButtonWidth(width);
                        mapholder.updateSize();
                    }}
                    />
            </PageFrame>

        );
}

export const selectChartDialog=(
    dialogCtx:IDialogContext,
    callback?:(chart:Item)=>void,
    infoText?:ReactNode
    )=>{
    const current=mapholder.getCurrentChartEntry()||{};
    dialogCtx.showDialog(()=><ChartSelectDialog
        resolveFunction={(chartEntry:Item)=>{
            if (! chartEntry) {
                return;
            }
            mapholder.setChartEntry(chartEntry);
            if (callback) callback(chartEntry);
        }}
        selected={current.name}
        additionalButtons={[
            {
                ...ButtonDefs.DBShowOverlays,
                onClick:() => {
                    mapholder.showOverlays()
                },
                disabled: ()=>{
                    const [numOverlays,numDisabled]=mapholder.overlayStatus();
                    return numOverlays === 0 || numDisabled === 0
                }
            },
            {
                ...ButtonDefs.DBHideOverlays,
                onClick:() => {
                    mapholder.hideOverlays();
                },
                disabled: ()=>{
                    const [numOverlays,numDisabled]=mapholder.overlayStatus();
                    return numOverlays === 0 || numDisabled === numOverlays
                }
            }
        ]}
        text={infoText}
    />);
}


MapPage.PANELS=['left','top','bottomLeft','bottomRight'];

export default MapPage;
export interface OverlayButtonDisplayProps {
    buttons?: DynamicButtonProps[]
}
export interface ActiveOverlayButtons {
    kind?:'waypoint'|'measure',
    buttons?: DynamicButtonProps[]
}
export const OverlayButtonDisplay = (props: OverlayButtonDisplayProps) => {
    if (!props.buttons || !props.buttons.length) return null;
    return <ButtonList
        itemList={props.buttons}
        className="overlayContainer"
    />
}