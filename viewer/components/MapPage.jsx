/**
 * Created by andreas on 02.05.14.
 * a page component that displays a map
 * and widget containers
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import NavHandler from '../nav/navdata.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import WidgetFactory from '../components/WidgetFactory.jsx';
import MapHolder from '../map/mapholder.js';
import navobjects from '../nav/navobjects.js';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import EulaDialog from './EulaDialog.jsx';
import EditOverlaysDialog from './EditOverlaysDialog.jsx';
import {getOverlayConfigName} from "../map/chartsourcebase";
import mapholder from "../map/mapholder.js";
import Helper from "../util/helper";
import assign from 'object-assign';
import LocalStorage, {STORAGE_NAMES} from '../util/localStorageManager';
import {DynamicTitleIcons} from "./TitleIcons";

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

class MapPage extends React.Component{
    mapRef=createRef();
    constructor(props){
        super(props);
        this.mapEvent=this.mapEvent.bind(this);
        this.subscribeToken=undefined;
        this.bottomContainer=undefined;

    }
    getLayoutPage(){
        return {
            location: this.props.location||this.props.id,
            options: this.props.options
        }
    }
    mapEvent(evdata){
        if (globalStore.getData(keys.gui.global.layoutEditing)) return;
        return this.props.mapEventCallback(evdata);
    }
    componentWillUnmount(){
        NavHandler.setAisCenterMode(navobjects.AisCenterMode.GPS);
        MapHolder.renderTo();
        if (this.subscribeToken !== undefined){
            MapHolder.unsubscribe(this.subscribeToken);
            this.subscribeToken=undefined;
        }
    }
    computeScalePosition(){
        const setBottom=(val)=>{
            let el=document.querySelector('.ol-scale-bar');
            if (el){
                el.style.bottom=val;
            }
        }
        if (! this.props.mapFloat){
            setBottom('0px');
        }
        else{
            if (!this.bottomContainer) return;
            let rect=this.bottomContainer.getBoundingClientRect();
            setBottom(rect.height+"px");
        }
    }
    componentDidMount(){
        let self=this;
        NavHandler.setAisCenterMode(navobjects.AisCenterMode.MAP);
        this.subscribeToken=MapHolder.subscribe(this.mapEvent);
        let chartEntry=MapHolder.getCurrentChartEntry()||{};
        let showMap=()=>{
            if (chartEntry.infoMode !== undefined ){
                if (needsToShow(chartEntry.url,INFO_TYPES.info,chartEntry.infoMode)){
                    Toast("Chart "+chartEntry.info);
                    setShown(chartEntry.url,INFO_TYPES.info);
                }
            }
            MapHolder.loadMap(this.mapRef.current, this.props.preventCenterDialog).
                then((result)=>{
                    this.computeScalePosition();
                }).
                catch((error)=>{Toast(error)});
        };
        if (chartEntry.eulaMode !== undefined){
            if (needsToShow(chartEntry.url,INFO_TYPES.eula,chartEntry.eulaMode)){
                EulaDialog.createDialog(chartEntry.name,chartEntry.url+"/eula")
                    .then(()=>{
                        setShown(chartEntry.url,INFO_TYPES.eula);
                        showMap();
                    })
                    .catch(()=>{
                        Toast("EULA rejected");
                    });
                return;
            }
        }
        showMap();

    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        this.computeScalePosition();
    }

    render(){
        let self=this;
        const WidgetContainer=(props)=>{
            let {panel,mode,...other}=props;
            let panelItems=self.props.panelCreator(panel);
            if (! panelItems.list) return null;
            let invertEditDirection=mode==='vertical'||panel === 'bottomLeft';
            return <ItemList  {...props}
                className={"widgetContainer "+mode+" "+panel}
                itemCreator={(widget)=>{return widgetCreator(widget,mode)}}
                itemList={panelItems.list}
                onItemClick={(item,data)=>{
                    self.props.onItemClick(item,data,panelItems.name,invertEditDirection)
                    }}
                onClick={()=>{
                    EditWidgetDialog.createDialog(undefined,this.getLayoutPage(),panelItems.name,{fixPanel: true,beginning:invertEditDirection,types:["!map"]});
                }}
                dragdrop={globalStore.getData(keys.gui.global.layoutEditing)}
                horizontal={mode === 'horizontal'}
                allowOther={true}
                dragFrame={panelItems.name}
                onSortEnd={(oldIndex,newIndex,frameId,targetFrameId)=>{
                    LayoutHandler.withTransaction(this.getLayoutPage(),(handler)=>handler.moveItem(self.props.id, frameId, oldIndex, newIndex,targetFrameId))
                    }}
                />
        };
        let mapOpacity=globalStore.getData(keys.properties.nightMode) ?
            globalStore.getData(keys.properties.nightChartFade, 100) / 100:1;
        let map=<div className="map" ref={this.mapRef} style={{opacity:mapOpacity}}>
            <DynamicTitleIcons/>
        </div>;
        let className=self.props.className?self.props.className+" mapPage":"mapPage";
        if (this.props.mapFloat) className+=" mapFloat";
        let pageProperties=Helper.filteredAssign(Page.propTypes,self.props);
        let overlay=self.props.overlayContent || null;
        if (typeof(overlay) === 'function'){
            overlay=overlay({});
        }
        return (
            <Page
                {...pageProperties}
                className={className}
                floatContent={this.props.mapFloat?map:undefined}
                mainContent={
                    <React.Fragment>
                        <div className="leftSection">
                            <WidgetContainer
                                fontSize={self.props.widgetFontSize + "px"}
                                panel="left"
                                mode="vertical"
                            />
                            <WidgetContainer
                                fontSize={self.props.widgetFontSize + "px"}
                                panel="top"
                                mode="horizontal"
                            />

                            {!this.props.mapFloat && map}
                            {overlay}
                        </div>
                        <div ref={(container)=>{
                            this.bottomContainer=container;
                            this.computeScalePosition();
                        }}
                            className={"bottomSection" + (globalStore.getData(keys.properties.allowTwoWidgetRows) ? " twoRows" : "")}>
                            <WidgetContainer
                                reverse={true}
                                fontSize={self.props.widgetFontSize + "px"}
                                panel='bottomLeft'
                                mode="horizontal"
                            />
                            <WidgetContainer
                                fontSize={self.props.widgetFontSize + "px"}
                                panel="bottomRight"
                                mode="horizontal"
                            />
                        </div>
                    </React.Fragment>
                }
                buttonList={self.props.buttonList}
                buttonWidthChanged={()=>{
                    mapholder.updateSize();
                }}
                autoHideButtons={self.props.autoHideButtons}
                />

        );
    }
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
    preventCenterDialog: PropTypes.bool,
    autoHideButtons:    PropTypes.any,
    widgetFontSize:     PropTypes.number,
    mapFloat:           PropTypes.bool

};

export const overlayDialog=(opt_chartName,opt_updateCallback)=>{
    let current=MapHolder.getCurrentMergedOverlayConfig();
    if (! current) return;
    let currentChart=MapHolder.getCurrentChartEntry()||{};
    OverlayDialog.dialog((props)=> {
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
                        MapHolder.loadMap(undefined,true).then(()=>{
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

let DynamicPage=Dynamic(MapPage,{
    storeKeys:LayoutHandler.getStoreKeys({
        widgetFontSize:keys.properties.widgetFontSize,
        mapFloat: keys.properties.mapFloat
    })
});
DynamicPage.PANELS=['left','top','bottomLeft','bottomRight'];
DynamicPage.propertyTypes=MapPage.propertyTypes
export default DynamicPage;