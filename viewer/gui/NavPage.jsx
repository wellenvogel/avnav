/**
 * Created by andreas on 02.05.14.
 */

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
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import GuiHelpers from './helpers.js';
import MapHolder from '../map/mapholder.js';
import DirectWidget from '../components/DirectWidget.jsx';
import navobjects from '../nav/navobjects.js';

const RouteHandler=NavHandler.getRoutingHandler();


const DynamicPage=Dynamic(Page);
const DynamicList=Dynamic(ItemList);

const widgetCreator=(widget,panel)=>{
    let rt=WidgetFactory.createWidget(widget,{mode:panel,className:'',handleVisible:true});
    if (widget.name=='CenterDisplay'){
        rt=Dynamic(Visible(rt),{
            storeKeys:{visible:keys.nav.routeHandler.isRouting},
            updateFunction:(state)=>{return {visible:!state.visible}}
        })
    }
    return rt;
};

const widgetClick=(item,data,panel)=>{
    if (item.name == "AisTarget"){
        let mmsi=(data && data.mmsi)?data.mmsi:widget.mmsi;
        if (! mmsi) return;
        history.push("aisinfopage",{mmsi:mmsi});
        return;
    }
    if (item.name == "ActiveRoute"){
        RouteHandler.startEditingRoute();
        RouteHandler.setRouteForPage();
        history.push("routepage");
        return;
    }
    if (item.name == "Zoom"){
        MapHolder.checkAutoZoom(true);
        return;
    }
    if (item.name == 'WindDisplay' || item.name == 'DepthDisplay'){
        history.push("gpspage",{secondPage:true});
        return;
    }
    if (item.name =='COG' || item.name == 'SOG'|| item.name == 'TimeStatus'||item.name == 'Position'){
        history.push('gpspage');
        return;
    }

};
const WidgetContainer=(props)=>{
    let {panel,isSmall,...other}=props;
    return <ItemList  {...props}
            className={"widgetContainer "+panel}
            itemCreator={(widget)=>{return widgetCreator(widget,panel)}}
            itemList={getPanelList(panel,isSmall)}
            onItemClick={(item,data)=>{widgetClick(item,data,panel)}}
            />
};

const getPanelList=(panel,opt_isSmall)=>{
    let page=GuiHelpers.getPageFromLayout('navpage');
    if (! page) return [];
    let panelName=panel;
    panelName+=opt_isSmall?"_small":"_not_small";
    let rt=page[panelName];
    if (rt) return rt;
    rt=page[panel];
    if (rt) return rt;
    return [];
};


class NavPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
        if (props.options && props.options.url ){
            globalStore.storeMultiple(
                {
                    url: props.options.url,
                    chartbase: props.options.chartbase
                },
                {
                    url:keys.gui.navpage.mapurl,
                    chartbase: keys.gui.navpage.chartbase}
                ,this);
        }
        this.subscribeToken=undefined;

    }
    mapEvent(evdata,token){
        console.log("mapevent: "+evdata.type);
    }
    componentWillUnmount(){
        NavHandler.setAisCenterMode(navobjects.AisCenterMode.GPS);
        MapHolder.renderTo();
        if (this.subscribeToken !== undefined){
            MapHolder.unsubscribe(this.subscribeToken);
            this.subscribeToken=undefined;
        }
    }
    componentDidMount(){
        let self=this;
        let url=globalStore.getData(keys.gui.navpage.mapurl);
        let chartBase=globalStore.getData(keys.gui.navpage.chartbase,url);
        NavHandler.setAisCenterMode(navobjects.AisCenterMode.MAP);
        this.subscribeToken=MapHolder.subscribe(this.mapEvent);
        MapHolder.loadMap(this.refs.map,url,chartBase).
            then((result)=>{}).
            catch((error)=>{Toast.Toast(error)});
    }
    getButtons(type){
        let rt=[
            {
                name: "ZoomIn",
                onClick:()=>{MapHolder.changeZoom(1)}
            },
            {
                name: "ZoomOut",
                onClick:()=>{MapHolder.changeZoom(-1)}
            },
            {
                name: "LockPos",
                storeKeys:{
                    toggle: keys.map.lockPosition
                },
                onClick:()=>{
                    let old=globalStore.getData(keys.map.lockPosition);
                    MapHolder.setGpsLock(!old);
                }
            },
            {
                name: "LockMarker",
                storeKeys: {
                    visible: keys.nav.routeHandler.isRouting
                },
                updateFunction:(state)=>{return {visible:!state.visible}},
                onClick:()=>{
                    let center = NavHandler.getMapCenter();
                    let currentLeg=RouteHandler.getCurrentLeg();
                    let wp=new navobjects.WayPoint();
                    //take over the wp name if this was a normal wp with a name
                    //but do not take over if this was part of a route
                    if (currentLeg && currentLeg.to && currentLeg.to.name && ! currentLeg.to.routeName){
                        wp.name=currentLeg.to.name;
                    }
                    else{
                        wp.name = 'Marker';
                    }
                    center.assign(wp);
                    RouteHandler.wpOn(wp);
                }
            },
            {
                name: "StopNav",
                storeKeys:{
                    visible:keys.nav.routeHandler.isRouting
                },
                toggle:true,
                onClick:()=>{
                    RouteHandler.routeOff();
                    MapHolder.triggerRender();
                }
            },
            {
                name: "CourseUp",
                storeKeys:{
                    toggle: keys.map.courseUp
                },
                onClick:()=>{
                    MapHolder.setCourseUp(!globalStore.getData(keys.map.courseUp,false))
                }
            },
            {
                name: "ShowRoutePanel"
            },
            {
                name: "AnchorWatch",
                storeKeys: {
                    watchDistance: keys.nav.anchor.watchDistance
                },
                updateFunction:(state)=>{
                    return {
                        toggle: state.watchDistance !== undefined
                    }
                },
                onClick:()=>{
                    GuiHelpers.anchorWatchDialog(undefined);
                }
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        return rt;
    }
    render(){
        let self=this;
        let isSmall=globalStore.getData(keys.gui.global.windowDimensions,{width:0}).width
            < globalStore.getData(keys.properties.smallBreak);
        return (
            <DynamicPage
                className={self.props.className}
                style={self.props.style}
                id="navpage"
                mainContent={
                            <React.Fragment>
                            <div className="leftSection">
                                <WidgetContainer
                                    panel="left"
                                    isSmall={isSmall}
                                    onItemClick={self.widgetClick}
                                />
                                 <WidgetContainer
                                    panel="top"
                                    isSmall={isSmall}
                                    onItemClick={self.widgetClick}
                                />

                                <div className="map" ref="map"/>
                            </div>
                            <div className={"bottomSection" + (globalStore.getData(keys.properties.allowTwoWidgetRows)?" twoRows":"")}>
                                <WidgetContainer
                                    panel='bottomLeft'
                                    isSmall={isSmall}
                                    onItemClick={self.widgetClick}
                                    />
                                <WidgetContainer
                                    panel="bottomRight"
                                    isSmall={isSmall}
                                    onItemClick={self.widgetClick}
                                    />
                             </div>
                            </React.Fragment>
                        }
                storeKeys={{
                    dummy:"xx"
                }}
                updateFunction={(state)=>{
                    let rt={};
                    rt.buttonList=self.getButtons();
                    return rt;
                }}
                />
        );
    }
}

module.exports=NavPage;