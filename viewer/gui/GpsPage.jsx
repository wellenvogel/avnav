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
import PropTypes from 'prop-types';
import PropertyHandler from '../util/propertyhandler.js';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Requests from '../util/requests.js';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import WidgetFactory from '../components/WidgetFactory.jsx';
import EditWidgetDialog from '../components/EditWidgetDialog.jsx';
import EditPageDialog from '../components/EditPageDialog.jsx';
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';
import LayoutHandler from '../util/layouthandler.js';
import anchorWatch from '../components/AnchorWatchDialog.jsx';

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

const getPanelList=(panel,pageNum)=>{
    let basename="gpspage"+pageNum;
    let rt=LayoutHandler.getPanelData(basename,panel,LayoutHandler.getOptionValues([LayoutHandler.OPTIONS.ANCHOR]));
    rt.page=basename;
    return rt;

};

const hasPageEntries=(pageNum)=>{
    let basename="gpspage"+pageNum;
    let page=LayoutHandler.getPageData(basename);
    if (! page) return false;
    let panels=PANEL_LIST;
    for (let p in panels){
        let panel=panels[p];
        let panelData=LayoutHandler.getPanelData(basename,panel,LayoutHandler.getAllOptions());
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

const layoutBase="gpspage";
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
        let self=this;
        this.buttons=[
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.state={};

        this.onItemClick=this.onItemClick.bind(this);
        if (props.options && props.options.widget && ! props.options.returning) {
            let pagenNum = findPageWithWidget(props.options.widget);
            if (pagenNum !== undefined){
                globalStore.storeData(keys.gui.gpspage.pageNumber,pagenNum);
            }
        }
        let oldNum=globalStore.getData(keys.gui.gpspage.pageNumber);
        if (oldNum === undefined || ! hasPageEntries(oldNum)){
            globalStore.storeData(keys.gui.gpspage.pageNumber,1);
        }
    }
    getButtons(){
        let self=this;
        return[
            {
                name:'GpsCenter',
                onClick:()=>{
                    MapHolder.centerToGps();
                    history.pop();
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
                    globalStore.storeData(keys.gui.gpspage.pageNumber,1);
                }
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
                    globalStore.storeData(keys.gui.gpspage.pageNumber,2);
                }
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
                    globalStore.storeData(keys.gui.gpspage.pageNumber,3);
                }
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
                    globalStore.storeData(keys.gui.gpspage.pageNumber,4);
                }
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
                    globalStore.storeData(keys.gui.gpspage.pageNumber,5);
                }
            },
            anchorWatch(),
            GuiHelpers.mobDefinition,
            EditPageDialog.getButtonDef('gpspage'+globalStore.getData(keys.gui.gpspage.pageNumber,0),
                PANEL_LIST,
                [LayoutHandler.OPTIONS.ANCHOR]),
            LayoutFinishedDialog.getButtonDef(),
            {
                name:'Cancel',
                onClick:()=>{history.pop();}
            }
        ];
    }
    onItemClick(item,data,panelInfo){
        if (EditWidgetDialog.createDialog(item,panelInfo.page,panelInfo.name,false,true)) return;
        if (item && item.name=== "AisTarget"){
            let mmsi=(data && data.mmsi)?data.mmsi:item.mmsi;
            history.push("aisinfopage",{mmsi:mmsi});
            return;
        }
        history.pop();
    }

    componentDidMount(){
        let self=this;
        resizeFont();

    }
    componentDidUpdate(){
        resizeFont();
    }
    render(){
        let self=this;
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
                let panelData = getPanelList(panelName, self.props.pageNum || 1);
                if (! panelData.list) return;
                let sum = getWeightSum(panelData.list);
                let prop={
                    className: 'widgetContainer',
                    itemCreator: (widget)=>{ return widgetCreator(widget,sum);},
                    itemList: panelData.list,
                    fontSize: fontSize,
                    onItemClick: (item,data) => {self.onItemClick(item,data,panelData);},
                    onClick: ()=>{EditWidgetDialog.createDialog(undefined,panelData.page,panelData.name,false,true);},
                    dragdrop: LayoutHandler.isEditing(),
                    onSortEnd: (oldIndex,newIndex)=>LayoutHandler.moveItem(panelData.page,panelData.name,oldIndex,newIndex)
                };
                panelList.push(prop);
            });
            let panelWidth=100;
            if (panelList.length){
                panelWidth=panelWidth/panelList.length;
            }
            return(
            <React.Fragment>
                {panelList.map((panelProps)=>{
                    return(
                        <div className="hfield" style={{width:panelWidth+"%"}}>
                            <ItemList {...panelProps}/>
                        </div>
                    )
                })}
            </React.Fragment>);
        };

        return <Page
                className={self.props.className}
                style={self.props.style}
                id="gpspage"
                mainContent={
                            <MainContent/>
                        }
                buttonList={self.getButtons()}
                />;

    }
}

GpsPage.propTypes={
    pageNum: PropTypes.number
};

module.exports=Dynamic(GpsPage,{
    storeKeys:LayoutHandler.getStoreKeys({
        pageNum: keys.gui.gpspage.pageNumber,
    })
});