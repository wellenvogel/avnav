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
import MapPage from '../components/MapPage.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import GuiHelpers from '../util/GuiHelpers.js';
import MapHolder from '../map/mapholder.js';
import DirectWidget from '../components/DirectWidget.jsx';
import navobjects from '../nav/navobjects.js';
import AisData from '../nav/aisdata.js';
import WayPointDialog from '../components/WaypointDialog.jsx';
import ButtonList from '../components/ButtonList.jsx';

const RouteHandler=NavHandler.getRoutingHandler();


const DynamicPage=Dynamic(MapPage);
const startWaypointDialog=(item)=>{
    const wpChanged=(newWp,close)=>{
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,(err)=>{
            Toast(Helper.escapeHtml(err));
        },RouteHandler);
        if (changedWp) {
            return true;
        }
        return false;
    };
    let RenderDialog=function(props){
        return <WayPointDialog
            {...props}
            waypoint={item}
            okCallback={wpChanged}/>
    };
    OverlayDialog.dialog(RenderDialog);
};



const widgetClick=(item,data,panel)=>{
    if (item.name == "EditRoute"){
        RouteHandler.startEditingRoute();
        RouteHandler.setRouteForPage();
        history.push("routepage");
        return;
    }
    if (item.name == 'RoutePoints'){
        if (data && data.idx !== undefined){
            setEditingWpIdx(data.idx);
            let last=globalStore.getData(keys.gui.editroutepage.lastCenteredWp);
            MapHolder.setCenter(RouteHandler.getEditingWp());
            globalStore.storeData(keys.gui.editroutepage.lastCenteredWp,data.idx);
            if (data.selected && last == data.idx){
                startWaypointDialog(data);
            }
        }
    }


};

const setEditingWpIdx=(idx)=>{
    RouteHandler.setEditingWpIdx(idx);
    globalStore.storeData(keys.gui.editroutepage.selectedWp,idx);
};

const getPanelList=(panel,opt_isSmall)=>{
    let rt= GuiHelpers.getPanelFromLayout('editroutepage',panel,'small',opt_isSmall).slice(0);
    for (let idx in rt){
        if (rt[idx].name == 'RoutePoints'){
            rt[idx]=assign({},rt[idx],{selectedPoint:globalStore.getData(keys.gui.editroutepage.selectedWp)})
        }
    }
    return rt;
};

const checkRouteWritable=function(){
    if (RouteHandler.isRouteWritable()) return true;
    let ok=OverlayDialog.confirm("you cannot edit this route as you are disconnected. OK to select a new name");
    ok.then(function(){
        RouteHandler.setRouteForPage();
        history.push('routepage');
    });
    return false;
};

const waypointButtons=[
    {
        name:'WpLocate',
        onClick:()=>{
            MapHolder.setCenter(RouteHandler.getEditingWp());
        }
    },
    {
        name:'WpEdit',
        onClick:()=>{
            startWaypointDialog(RouteHandler.getEditingWp());
        }
    },
    {
        name:'WpNext',
        storeKeys:{
            selectedWp: keys.gui.editroutepage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!RouteHandler.getPointAtOffset(RouteHandler.getEditingWp(),1)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.editroutepage.selectedWp);
            setEditingWpIdx((selected||0)+1);
            MapHolder.setCenter(RouteHandler.getEditingWp());

        }
    },
    {
        name:'WpPrevious',
        storeKeys:{
            selectedWp: keys.gui.editroutepage.selectedWp
        },
        updateFunction: (state)=> {
            let rt={visible:false};
            if (!RouteHandler.getPointAtOffset(RouteHandler.getEditingWp(),-1)) return rt;
            return {visible:true}
        },
        onClick:()=>{
            let selected=globalStore.getData(keys.gui.editroutepage.selectedWp);
            setEditingWpIdx((selected||0)-1);
            MapHolder.setCenter(RouteHandler.getEditingWp());
        }
    }
];


class EditRoutePage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        this.mapEvent=this.mapEvent.bind(this);
        RouteHandler.startEditingRoute();
        globalStore.storeData(keys.gui.editroutepage.selectedWp,RouteHandler.getEditingWpIdx());
        globalStore.storeData(keys.gui.editroutepage.lastCenteredWp,undefined);

    }
    mapEvent(evdata,token){
        console.log("mapevent: "+evdata.type);
        RouteHandler.setEditingWp(evdata.wp);
        globalStore.storeData(keys.gui.editroutepage.selectedWp,RouteHandler.getEditingWpIdx())

    }
    componentWillUnmount(){
        MapHolder.setRoutingActive(false);
        MapHolder.setGpsLock(this.lastGpsLock);
    }
    componentDidMount(){
        MapHolder.setRoutingActive(true);
        this.lastGpsLock=MapHolder.getGpsLock();
        MapHolder.setGpsLock(false);
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
                name:"NavAdd",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    let center=MapHolder.getCenter();
                    if (!center) return;
                    let current=RouteHandler.getEditingWp();
                    if (current){
                        let distance=MapHolder.pixelDistance(center,current);
                        if (distance < 8) return;
                    }
                    RouteHandler.addWp(-1,center);
                }
            },
            {
                name:"NavDelete",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    RouteHandler.deleteWp(-1);
                }
            },
            {
                name:"NavToCenter",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    let center=MapHolder.getCenter();
                    if (!center) return;
                    RouteHandler.changeWpByIdx(-1,center);
                }
            },
            {
                name:"NavGoto",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    RouteHandler.wpOn(RouteHandler.getEditingWp());
                    history.pop();
                }
            },
            {
                name:"NavInvert",
                onClick:()=>{
                    if (!checkRouteWritable()) return;
                    RouteHandler.invertRoute();
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
        let url=globalStore.getData(keys.gui.editroutepage.mapurl);
        let chartBase=globalStore.getData(keys.gui.editroutepage.chartbase,url);
        let isSmall=globalStore.getData(keys.gui.global.windowDimensions,{width:0}).width
            < globalStore.getData(keys.properties.smallBreak);
        return (
            <DynamicPage
                className={self.props.className}
                style={self.props.style}
                id="editroutepage"
                mapEventCallback={self.mapEvent}
                onItemClick={widgetClick}
                mapUrl={url}
                chartBase={chartBase}
                panelCreator={getPanelList}
                storeKeys={{
                    selectedWp:keys.gui.editroutepage.selectedWp
                }}
                updateFunction={(state)=>{
                    let rt={
                        buttonList:[],
                        overlayContent:undefined
                    };
                    rt.buttonList=self.getButtons();
                    if (isSmall){
                    rt.overlayContent=<ButtonList
                            itemList={waypointButtons}
                            className="overlayContainer"
                        />;
                    }
                    return rt;
                }}
                />
        );
    }
}

module.exports=EditRoutePage;