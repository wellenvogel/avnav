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
import Toast from '../components/Toast.jsx';
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
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';






const widgetCreator=(widget,mode)=>{
    let rt=WidgetFactory.createWidget(widget,{mode:mode,className:'',handleVisible:!globalStore.getData(keys.gui.global.layoutEditing)});
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
    constructor(props){
        super(props);
        let self=this;
        this.mapEvent=this.mapEvent.bind(this);
        this.subscribeToken=undefined;

    }
    mapEvent(evdata,token){
        if (globalStore.getData(keys.gui.global.layoutEditing)) return;
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
            then((result)=>{
                globalStore.storeData(keys.gui.global.hasSelectedChart,true);
            }).
            catch((error)=>{Toast(error)});
    }
    render(){
        let self=this;
        const WidgetContainer=(props)=>{
            let {panel,mode,...other}=props;
            let panelItems=self.props.panelCreator(panel);
            let invertEditDirection=mode==='vertical'||panel === 'bottomLeft';
            return <ItemList  {...props}
                className={"widgetContainer "+mode+" "+panel}
                itemCreator={(widget)=>{return widgetCreator(widget,mode)}}
                itemList={panelItems.list}
                onItemClick={(item,data)=>{
                    self.props.onItemClick(item,data,panelItems.name,invertEditDirection)
                    }}
                onClick={()=>{
                    EditWidgetDialog.createDialog(undefined,self.props.id,panelItems.name,invertEditDirection);
                }}
                dragdrop={globalStore.getData(keys.gui.global.layoutEditing)}
                horizontal={mode === 'horizontal'}
                onSortEnd={(oldIndex,newIndex)=>LayoutHandler.moveItem(self.props.id,panelItems.name,oldIndex,newIndex)}
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
                                    mode="vertical"
                                />
                                 <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel="top"
                                    mode="horizontal"
                                />

                                <div className="map" ref="map"/>
                                {self.props.overlayContent?self.props.overlayContent:null}
                            </div>
                            <div className={"bottomSection" + (globalStore.getData(keys.properties.allowTwoWidgetRows)?" twoRows":"")}>
                                <WidgetContainer
                                    reverse={true}
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel='bottomLeft'
                                    mode="horizontal"
                                    />
                                <WidgetContainer
                                    fontSize={self.props.widgetFontSize+"px"}
                                    panel="bottomRight"
                                    mode="horizontal"
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
    panelCreator:       PropTypes.func.isRequired,  //will be called with the panel name
                                                    //and must return {name: panelName, list:widget list}
    onItemClick:        PropTypes.func.isRequired,  //like ItemList
    mapEventCallback:   PropTypes.func,
    id:                 PropTypes.string,
    overlayContent:     PropTypes.any               //overlay in the map container
};

module.exports=Dynamic(MapPage,{
    storeKeys:LayoutHandler.getStoreKeys({
        widgetFontSize:keys.properties.widgetFontSize
    })
});