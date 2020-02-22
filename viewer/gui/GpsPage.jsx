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
import LayoutFinishedDialog from '../components/LayoutFinishedDialog.jsx';

//from https://stackoverflow.com/questions/16056591/font-scaling-based-on-width-of-container
function resizeFont() {
    GuiHelpers.resizeByQuerySelector('#gpspage .resize');
}
const widgetCreator=(widget,weightSum)=>{
    let {weight,...widgetProps}=widget;
    if (weight === undefined) weight=1;
    let height=weight/weightSum*100;
    return WidgetFactory.createWidget(widget,{style:{height:height+"%"},mode:'gps',className:''});
};

const getPanelList=(panelType,anchor,pageNum)=>{
    let basename="gpspage"+pageNum;
    let page=GuiHelpers.getPageFromLayout(basename);
    if (! page && ! globalStore.getData(keys.gui.global.layoutEditing)){
        //fallback to page 1
        basename="gpspage1";
        page=GuiHelpers.getPageFromLayout(basename);
    }
    if (! page) return {name:panelType,page:basename,list:[]};
    let name=panelType;
    name+=anchor!==undefined?"_anchor":"_not_anchor";
    if (page[name]) return {name:name,page:basename,list:page[name]};
    //fallback to panel without suffix
    return {name:panelType,page:basename,list:page[panelType]||[]};

};

const hasPageEntries=(pageNum,anchor)=>{
    let basename="gpspage"+pageNum;
    let page=GuiHelpers.getPageFromLayout(basename);
    if (! page) return false;
    let panels=['left','right'];
    for (let p in panels){
        let panel=panels[p];
        if (page[panel] && page[panel].length > 0) return true;
        panel+=anchor?"_anchor":"_not_anchor";
        if (page[panel] && page[panel].length > 0) return true;
    }
    return false;
};

const getWeightSum=(list)=>{
    let sum=0;
    if (! list ) return sum;
    list.forEach((el)=>{
        if (el.weight !== undefined) sum+=el.weight;
        else sum+=1;
    });
    return sum;
};

const layoutBase="gpspage";
const findPageWithWidget=(name,anchor)=>{
    let pnums=[1,2,3,4,5];
    let panels=['left','right'];
    if (! name) return ;
    for (let pidx in pnums){
        for (let idx in panels){
            let list=getPanelList(panels[idx],anchor,pnums[pidx]);
            if (! list) continue;
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
        this.buttons=[
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
                    visible: hasPageEntries(1,self.props.anchor) || state.isEditing
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
                    visible: hasPageEntries(2,self.props.anchor) || state.isEditing
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
                    visible: hasPageEntries(3,self.props.anchor) || state.isEditing
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
                    visible: hasPageEntries(4,self.props.anchor) || state.isEditing
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
                    visible: hasPageEntries(5,self.props.anchor) || state.isEditing
                }},
                onClick:()=>{
                    globalStore.storeData(keys.gui.gpspage.pageNumber,5);
                }
            },
            {
                name: "AnchorWatch",
                storeKeys: {watchDistance:keys.nav.anchor.watchDistance},
                updateFunction:(state)=>{
                    return {toggle:state.watchDistance !== undefined}
                },
                onClick: ()=>{
                    GuiHelpers.anchorWatchDialog(undefined);
                },
                editDisable:true
            },
            GuiHelpers.mobDefinition,
            LayoutFinishedDialog.getButtonDef(),
            {
                name:'Cancel',
                onClick:()=>{history.pop();}
            }
        ];
        this.onItemClick=this.onItemClick.bind(this);
        if (props.options && props.options.widget && ! props.options.returning) {
            let pagenNum = findPageWithWidget(props.options.widget, props.anchor);
            if (pagenNum !== undefined){
                globalStore.storeData(keys.gui.gpspage.pageNumber,pagenNum);
            }
        }
        let oldNum=globalStore.getData(keys.gui.gpspage.pageNumber);
        if (oldNum === undefined || ! hasPageEntries(oldNum,props.anchor)){
            globalStore.storeData(keys.gui.gpspage.pageNumber,1);
        }
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
            let leftPanel=getPanelList('left',self.props.anchor,self.props.pageNum||1);
            let rightPanel=getPanelList('right',self.props.anchor,self.props.pageNum||1);
            let leftSum=getWeightSum(leftPanel.list);
            let rightSum=getWeightSum(rightPanel.list);
            let dimensions=globalStore.getData(keys.gui.global.windowDimensions);
            let fontSize=layoutBaseParam.baseWidgetFontSize;
            if (dimensions){
                let width=dimensions.width-60; //TODO: correct button dimensions...
                if (width > 0 && dimensions.height > 0){
                    let fw=width/layoutBaseParam.layoutWidth||0;
                    let fh=dimensions.height/layoutBaseParam.layoutHeight||0;
                    if (fw > 0 && fh > 0){
                        fontSize=fontSize*Math.min(fh,fw);
                    }
                }
            }
            let p1leftProp={
                className: 'widgetContainer',
                itemCreator: (widget)=>{ return widgetCreator(widget,leftSum);},
                itemList: leftPanel.list,
                fontSize: fontSize,
                onItemClick: (item,data) => {self.onItemClick(item,data,leftPanel);},
                onClick: ()=>{EditWidgetDialog.createDialog(undefined,leftPanel.page,leftPanel.name,false,true);}
            };
            let p1RightProp={
                className: 'widgetContainer',
                itemCreator: (widget)=>{ return widgetCreator(widget,rightSum);},
                itemList: rightPanel.list,
                fontSize: fontSize,
                onItemClick: (item,data) => {self.onItemClick(item,data,rightPanel);},
                onClick: ()=>{EditWidgetDialog.createDialog(undefined,rightPanel.page,rightPanel.name,false,true);}
            };
            return(
            <React.Fragment>
                <div className="hfield">
                    <ItemList {...p1leftProp}/>
                </div>
                <div className="hfield">
                    <ItemList {...p1RightProp}/>
                </div>
            </React.Fragment>);
        };

        return <Page
                className={self.props.className}
                style={self.props.style}
                id="gpspage"
                mainContent={
                            <MainContent/>
                        }
                buttonList={self.buttons}
                />;

    }
}

GpsPage.propTypes={
    anchor: PropTypes.number,
    pageNum: PropTypes.number
};

module.exports=Dynamic(GpsPage,{
    storeKeys:{
        pageNum:keys.gui.gpspage.pageNumber,
        anchor: keys.nav.anchor.watchDistance,
        layoutSequence: keys.gui.global.layoutSequence
    }
});