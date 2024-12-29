/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import PropTypes from 'prop-types';
import Page from '../components/Page.jsx';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import anchorWatch from '../components/AnchorWatchDialog.jsx';
import Mob from '../components/Mob.js';
import Dimmer from '../util/dimhandler.js';
import FullScreen from '../components/Fullscreen';
import remotechannel, {COMMANDS} from "../util/remotechannel";
import RemoteChannelDialog from "../components/RemoteChannelDialog";
import {DynamicTitleIcons} from "../components/TitleIcons";
import layouthandler from "../util/layouthandler.js";

const PANEL_LIST=['left','m1','m2','m3','right'];
//from https://stackoverflow.com/questions/16056591/font-scaling-based-on-width-of-container
function resizeFont() {
    GuiHelpers.resizeByQuerySelector('#gpspage .resize');
}
const widgetCreator=(widget,weightSum)=>{
    let {weight,...widgetProps}=widget;
    if (weight === undefined) weight=1;
    let height=weight/weightSum*100;
    return WidgetFactory.createWidget(widget,{style:{height:height+"%"},mode:'gps'});
};

const getLayoutPage=(opt_pageNum)=>{
    let pageNum=(opt_pageNum !== undefined)?opt_pageNum:globalStore.getData(keys.gui.gpspage.pageNumber,1);
    const base="gpspage";
    return{
        location: base,
        layoutPage: base+pageNum,
        options: {pageNumber: pageNum}
    }
}

const getPanelList=(panel,pageNum)=>{
    let page=getLayoutPage(pageNum);
    let rt=LayoutHandler.getPanelData(page,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.ANCHOR]));
    rt.page=page;
    return rt;

};

const hasPageEntries=(pageNum)=>{
    let layoutPage=getLayoutPage(pageNum);
    let page=LayoutHandler.getPageData(layoutPage);
    if (! page) return false;
    let panels=PANEL_LIST;
    for (let p in panels){
        let panel=panels[p];
        let panelData=LayoutHandler.getPanelData(layoutPage,panel,LayoutHandler.getAllOptions());
        if (panelData.list && panelData.list.length > 0) return true;
    }
    return false;
};

const getWeightSum=(list)=>{
    let sum=0;
    if (! list ) return sum;
    list.forEach((el)=>{
        if (el.weight !== undefined) sum+=parseFloat(el.weight||0);
        else sum+=1;
    });
    return sum;
};
const findPageWithWidget=(name)=>{
    let pnums=[1,2,3,4,5];
    let panels=PANEL_LIST;
    if (! name) return ;
    for (let pidx in pnums){
        for (let idx in panels){
            let list=getPanelList(panels[idx],pnums[pidx]);
            if (! list || ! list.list) continue;
            for (let li in list.list){
                if (! list.list[li]) continue;
                if (list.list[li].name == name){
                    return pnums[pidx];
                }
            }
        }
    }
};


const layoutBaseParam={
    layoutWidth: 600, //the widgets are prepared for this width, others will scale the font
    layoutHeight: 600,
    baseWidgetFontSize: 21, //font size for 600x600
};

class GpsPage extends React.Component{
    constructor(props){
        super(props);
        this.buttons=[
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.state={
            update:1
        };

        this.onItemClick=this.onItemClick.bind(this);
        if (props.options && props.options.widget && ! props.options.returning) {
            let pagenNum = findPageWithWidget(props.options.widget);
            if (pagenNum !== undefined){
                globalStore.storeData(keys.gui.gpspage.pageNumber,pagenNum);
            }
        }
        if (props.options && props.options.pageNumber !== undefined){
            globalStore.storeData(keys.gui.gpspage.pageNumber,props.options.pageNumber);
        }
        let oldNum=globalStore.getData(keys.gui.gpspage.pageNumber);
        if (oldNum === undefined || ! hasPageEntries(oldNum)){
            globalStore.storeData(keys.gui.gpspage.pageNumber,1);
        }
        this.remoteToken=remotechannel.subscribe(COMMANDS.gpsNum,(number)=>{
            let pn=parseInt(number);
            if (pn < 1 || pn > 5) return;
            if (! hasPageEntries(pn)) return;
            this.setPageNumber(pn,true);
        })
    }
    componentWillUnmount() {
        remotechannel.unsubscribe(this.remoteToken);
    }

    getButtons(){
        return[
            {
                name:'GpsCenter',
                onClick:()=>{
                    MapHolder.centerToGps();
                    this.props.history.pop();
                },
                editDisable: true
            },
            {
                name: "Gps1",
                storeKeys:{
                    pageNumber:keys.gui.gpspage.pageNumber,
                    layoutSequence:keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing},
                updateFunction:(state)=>{return {
                    toggle:state.pageNumber == 1 || state.pageNumber === undefined,
                    visible: hasPageEntries(1) || state.isEditing
                }},
                onClick:()=>{
                    this.setPageNumber(1);
                },
                overflow: true
            },
            {
                name: "Gps2",
                storeKeys:{
                    pageNumber:keys.gui.gpspage.pageNumber,
                    layoutSequence:keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing},
                updateFunction:(state)=>{return {
                    toggle:state.pageNumber == 2,
                    visible: hasPageEntries(2) || state.isEditing
                }},
                onClick:()=>{
                    this.setPageNumber(2);
                },
                overflow: true
            },
            {
                name: "Gps3",
                storeKeys:{
                    pageNumber:keys.gui.gpspage.pageNumber,
                    layoutSequence:keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing},
                updateFunction:(state)=>{return {
                    toggle:state.pageNumber == 3,
                    visible: hasPageEntries(3) || state.isEditing
                }},
                onClick:()=>{
                    this.setPageNumber(3);
                },
                overflow: true
            },
            {
                name: "Gps4",
                storeKeys:{
                    pageNumber:keys.gui.gpspage.pageNumber,
                    layoutSequence:keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing},
                updateFunction:(state)=>{return {
                    toggle:state.pageNumber == 4,
                    visible: hasPageEntries(4) || state.isEditing
                }},
                onClick:()=>{
                    this.setPageNumber(4);
                },
                overflow: true
            },
            {
                name: "Gps5",
                storeKeys:{
                    pageNumber:keys.gui.gpspage.pageNumber,
                    layoutSequence:keys.gui.global.layoutSequence,
                    isEditing: keys.gui.global.layoutEditing},
                updateFunction:(state)=>{return {
                    toggle:state.pageNumber == 5,
                    visible: hasPageEntries(5) || state.isEditing
                }},
                onClick:()=>{
                    this.setPageNumber(5);
                },
                overflow: true
            },
            anchorWatch(),
            RemoteChannelDialog({overflow:true}),
            Mob.mobDefinition(this.props.history),
            EditPageDialog.getButtonDef(getLayoutPage().layoutPage,
                PANEL_LIST,
                [LayoutHandler.OPTIONS.ANCHOR]),
            LayoutFinishedDialog.getButtonDef(),
            LayoutHandler.revertButtonDef((pageWithOptions)=>{
                let current=getLayoutPage();
                if (pageWithOptions.location !== current.location){
                    this.props.history.replace(pageWithOptions.location,pageWithOptions.options);
                    return;
                }
                if (current.layoutPage !== pageWithOptions.layoutPage){
                    if (pageWithOptions.options && pageWithOptions.options.pageNumber !== undefined){
                        this.setPageNumber(pageWithOptions.options.pageNumber);
                    }
                }
            }),
            FullScreen.fullScreenDefinition,
            Dimmer.buttonDef(),
            {
                name:'Cancel',
                onClick:()=>{this.props.history.pop();}
            }
        ];
    }
    onItemClick(item,data,panelInfo){
        if (EditWidgetDialog.createDialog(item,getLayoutPage(),panelInfo.name,{beginning:false,weight:true,types:["!map"]})) return;
        if (item && item.name=== "AisTarget"){
            let mmsi=(data && data.mmsi)?data.mmsi:item.mmsi;
            this.props.history.push("aisinfopage",{mmsi:mmsi});
            return;
        }
        this.props.history.pop();
    }

    componentDidMount(){
        resizeFont();

    }
    componentDidUpdate(){
        resizeFont();
    }
    setPageNumber(num,opt_noRemote){
        globalStore.storeData(keys.gui.gpspage.pageNumber,num);
        if (! opt_noRemote){
            remotechannel.sendMessage(COMMANDS.gpsNum,num);
        }
    }
    render(){
        let autohide=undefined;
        if (globalStore.getData(keys.properties.autoHideGpsPage)){
            autohide=globalStore.getData(keys.properties.hideButtonTime,30)*1000;
        }
        let MainContent=(props)=> {
            let fontSize = layoutBaseParam.baseWidgetFontSize;
            let dimensions = globalStore.getData(keys.gui.global.windowDimensions);
            if (dimensions) {
                let width = dimensions.width - 60; //TODO: correct button dimensions...
                if (width > 0 && dimensions.height > 0) {
                    let fw = width / layoutBaseParam.layoutWidth || 0;
                    let fh = dimensions.height / layoutBaseParam.layoutHeight || 0;
                    if (fw > 0 && fh > 0) {
                        fontSize = fontSize * Math.min(fh, fw);
                    }
                }
            }
            let panelList=[];
            PANEL_LIST.forEach((panelName)=> {
                let panelData = getPanelList(panelName, this.props.pageNum || 1);
                if (! panelData.list) return;
                let sum = getWeightSum(panelData.list);
                let prop={
                    name: panelData.name,
                    dragFrame: panelData.name,
                    allowOther: true,
                    className: 'widgetContainer',
                    itemCreator: (widget)=>{ return widgetCreator(widget,sum);},
                    itemList: panelData.list,
                    fontSize: fontSize,
                    onItemClick: (item,data) => {this.onItemClick(item,data,panelData);},
                    onClick: ()=>{EditWidgetDialog.createDialog(undefined,getLayoutPage(),panelData.name,{beginning:false,weight:true,types:["!map"]});},
                    dragdrop: LayoutHandler.isEditing(),
                    onSortEnd: (oldIndex,newIndex,frameId,targetFrameId)=>{
                        LayoutHandler.withTransaction(getLayoutPage(),
                        (handler)=>handler.moveItem(panelData.page,frameId,oldIndex,newIndex,targetFrameId));
                    }
                };
                panelList.push(prop);
            });
            let panelWidth=100;
            if (panelList.length){
                panelWidth=panelWidth/panelList.length;
            }
            let titleIcons=globalStore.getData(keys.properties.titleIconsGps);
            return(
            <React.Fragment>
                { titleIcons && <DynamicTitleIcons/>}
                {panelList.map((panelProps)=>{
                    return(
                        <div className="hfield" style={{width:panelWidth+"%"}} key={panelProps.name}>
                            <ItemList {...panelProps}/>
                        </div>
                    )
                })}
            </React.Fragment>);
        };

        return <Page
                {...this.props}
                id="gpspage"
                mainContent={
                            <MainContent/>
                        }
                buttonList={this.getButtons()}
                autoHideButtons={autohide}
                buttonWidthChanged={()=>{
                    resizeFont();
                }}
                />;

    }
}

GpsPage.propTypes={
    ...Page.pageProperties,
    pageNum: PropTypes.number
};

export default Dynamic(GpsPage,{
    storeKeys:LayoutHandler.getStoreKeys({
        pageNum: keys.gui.gpspage.pageNumber,
    })
});