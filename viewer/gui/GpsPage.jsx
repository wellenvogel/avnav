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
import MapHolder from '../map/mapholder.js';
import GuiHelpers from './helpers.js';
import WidgetFactory from '../components/WidgetFactory.jsx';


const widgetCreator=(widget,weightSum)=>{
    let {weight,...widgetProps}=widget;
    if (weight === undefined) weight=1;
    let height=weight/weightSum*100;
    return WidgetFactory.createWidget(widget,{style:{height:height+"%"},mode:'gps'});
};

const getPanelList=(panelType)=>{
    //TODO: some fallback handling...
    let layout=globalStore.getData(keys.gui.global.layout);
    if (! layout) return;
    let basename="gpspage"+globalStore.getData(keys.gui.gpspage.pageNumber,1);
    let name=panelType;
    name+=globalStore.getData(keys.nav.anchor.watchDistance)!==undefined?"_anchor":"_no_anchor";
    if (! layout[basename]) return;
    return layout[basename][name];
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
                }
            },
            {
                name: "Gps2",
                storeKeys:{pageNumber:keys.gui.gpspage.pageNumber},
                updateFunction:(state)=>{return {toggle:state.pageNumber != 1 && state.pageNumber !== undefined}},
                onClick:()=>{
                    let page=globalStore.getData(keys.gui.gpspage.pageNumber,1);
                    if (page == 1) page=2;
                    else page=1;
                    globalStore.storeData(keys.gui.gpspage.pageNumber,page);
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
                }
            },
            {
                name:'Cancel',
                onClick:()=>{history.pop();}
            }
        ];
        this.onItemClick=this.onItemClick.bind(this);
    }
    onItemClick(item){
        if (item && item.name=== "AisTarget"){
            history.push("aisinfopage");
            return;
        }
        history.pop();
    }

    componentDidMount(){
        let self=this;

    }
    render(){
        let self=this;
        let MainContent=(props)=> {
            let leftPanel=getPanelList('left');
            let rightPanel=getPanelList('right');
            let leftSum=getWeightSum(leftPanel);
            let rightSum=getWeightSum(rightPanel);
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
                itemList: leftPanel,
                fontSize: fontSize,
                onItemClick: (item) => {self.onItemClick(item);}
            };
            let p1RightProp={
                className: 'widgetContainer',
                itemCreator: (widget)=>{ return widgetCreator(widget,rightSum);},
                itemList: rightPanel,
                fontSize: fontSize,
                onItemClick: (item) => {self.onItemClick(item);}
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

        let MainRender=Dynamic(MainContent);

        return (
            <Page
                className={this.props.className}
                style={this.props.style}
                id="gpspage"
                mainContent={
                            <MainRender
                                storeKeys={{
                                    pageNum:keys.gui.gpspage.pageNumber,
                                    anchor: keys.nav.anchor.watchDistance
                                }}
                            />
                        }
                buttonList={self.buttons}/>
        );
    }
}

module.exports=GpsPage;