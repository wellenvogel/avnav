/**
 * Created by andreas on 02.05.14.
 * a page component that displays a map
 * and widget containers
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Visible from '../hoc/Visible.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropTypes from 'prop-types';
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
import MapHolder from '../map/mapholder.js';
import DirectWidget from '../components/DirectWidget.jsx';
import navobjects from '../nav/navobjects.js';






const widgetCreator=(widget,panel)=>{
    let rt=WidgetFactory.createWidget(widget,{mode:panel,className:'',handleVisible:true});
    if (widget.name=='CenterDisplay'){
        rt=Dynamic(Visible(rt),{
            storeKeys:{locked:keys.map.lockPosition},
            updateFunction:(state)=>{return {visible:!state.locked}}
        })
    }
    return rt;
};

class MapPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.mapEvent=this.mapEvent.bind(this);
        this.subscribeToken=undefined;

    }
    mapEvent(evdata,token){
        this.props.mapEventCallback(evdata,token);
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
        NavHandler.setAisCenterMode(navobjects.AisCenterMode.MAP);
        this.subscribeToken=MapHolder.subscribe(this.mapEvent);
        MapHolder.loadMap(this.refs.map).
            then((result)=>{}).
            catch((error)=>{Toast.Toast(error)});
    }
    render(){
        let self=this;
        let isSmall=globalStore.getData(keys.gui.global.windowDimensions,{width:0}).width
            < globalStore.getData(keys.properties.smallBreak);
        const WidgetContainer=(props)=>{
            let {panel,...other}=props;
            return <ItemList  {...props}
                className={"widgetContainer "+panel}
                itemCreator={(widget)=>{return widgetCreator(widget,panel)}}
                itemList={self.props.panelCreator(panel,isSmall)}
                onItemClick={(item,data)=>{self.props.onItemClick(item,data,panel)}}
                />
        };
        return (
            <Page
                className={self.props.className?self.props.className+" mapPage":"mapPage"}
                style={self.props.style}
                id={self.props.id}
                mainContent={
                            <React.Fragment>
                            <div className="leftSection">
                                <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel="left"
                                />
                                 <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel="top"
                                />

                                <div className="map" ref="map"/>
                                {self.props.overlayContent?self.props.overlayContent:null}
                            </div>
                            <div className={"bottomSection" + (globalStore.getData(keys.properties.allowTwoWidgetRows)?" twoRows":"")}>
                                <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel='bottomLeft'
                                    />
                                <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel="bottomRight"
                                    />
                             </div>
                            </React.Fragment>
                        }
                buttonList={self.props.buttonList}

                />

        );
    }
}

MapPage.propertyTypes={
    buttonList:         PropTypes.array,
    className:          PropTypes.string,
    panelCreator:       PropTypes.func.isRequired,  //will be called with the panel name + isSmall
                                                    //and must return the widget list
    onItemClick:        PropTypes.func.isRequired,  //like ItemList
    mapEventCallback:   PropTypes.func,
    id:                 PropTypes.string,
    overlayContent:     PropTypes.any               //overlay in the map container
};

module.exports=Dynamic(MapPage,{
    storeKeys:{
        widgetFontSize:keys.properties.widgetFontSize
    }
});