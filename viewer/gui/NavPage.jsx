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

const RouteHandler=NavHandler.getRoutingHandler();


const DynamicPage=Dynamic(Page);
const DynamicList=Dynamic(ItemList);

const widgetCreator=(widget,panel)=>{
    return WidgetFactory.createWidget(widget,{mode:panel,className:'',handleVisible:true});
};

const WidgetContainer=(props)=>{
    let {panel,isSmall,...other}=props;
    return <ItemList  {...props}
            className={"widgetContainer "+panel}
            itemCreator={(widget)=>{return widgetCreator(widget,panel)}}
            itemList={getPanelList(panel,isSmall)}
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

    }
    componentWillUnmount(){

    }
    componentDidMount(){
        let self=this;
        let url=globalStore.getData(keys.gui.navpage.mapurl);
        let chartBase=globalStore.getData(keys.gui.navpage.chartbase,url);
        if (! url){
            Toast.Toast("no map selected");
            history.pop();
            return;
        }
        if (!url.match(/^http:/)) {
            if (url.match(/^\//)) {
                url = window.location.href.replace(/^([^\/:]*:\/\/[^\/]*).*/, '$1') + url;
            }
            else {
                url = window.location.href.replace(/[?].*/, '').replace(/[^\/]*$/, '') + "/" + url;
            }
        }
        url = url+"/avnav.xml";
        Requests.getHtmlOrText(url,{useNavUrl:false}).then((data)=>{
            MapHolder.initMap(self.refs.map,data,chartBase);
            MapHolder.setBrightness(globalStore.getData(keys.properties.nightMode)?
                globalStore.getData(keys.properties.nightChartFade,100)/100
            :1)
        }).catch((error)=>{
            Toast.Toast("unable to load map: "+error);
        });
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
                name: "LockMarker", toggle: true
            },
            {
                name: "StopNav", toggle: true
            },
            {
                name: "CourseUp", toggle: true
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