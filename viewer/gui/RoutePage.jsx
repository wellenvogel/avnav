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
import MapHolder from '../map/mapholder.js';
import GuiHelpers from './helpers.js';
import WaypointListItem from '../components/WayPointListItem.jsx';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import NavHandler from '../nav/navdata.js';

const DynamicPage=Dynamic(Page);
const RouteHandler=NavHandler.getRoutingHandler();

const Heading = (props)=>{
    if (! props.currentRoute) return null;
    let len=props.currentRoute.computeLength(0);
    return (
        <div className="routeCurrent" onClick={props.onClick}>
            <div className="routeName">{props.currentRoute.name||''}</div>
            <div className="routeInfo">{props.currentRoute.points.length||0}Points,{Formatter.formatDecimal(len,6,2)}nm</div>
            <span className="more"> </span>
        </div>
    );
};

class RoutePage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.buttons=[
            {
                name:'RoutePageOk',
                onClick:()=>{
                    self.storeRouteAndReturn(false);
                }
            },
            {
                name:'NavGoto',
                onClick:()=>{
                    self.storeRouteAndReturn(true);
                }
            },
            {
                name:'NavInvert',
                onClick: ()=>{
                    let current=self.getRouteAndCheck();
                    if (! current) return;
                    RouteHandler.setRouteForPage(current.swap()); //double clone - but otherwise we modify inside store...
                }
            },
            {
                name:'NavDeleteAll',
                onClick: ()=>{
                    let current=self.getRouteAndCheck();
                    if (! current) return;
                    current.points=[];
                    RouteHandler.setRouteForPage(current); //double clone - but otherwise we modify inside store...
                }
            },
            {
                name:'RoutePageDownload'
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.storeRoute=this.storeRoute.bind(this);
        this.storeRouteAndReturn=this.storeRouteAndReturn.bind(this);
        this.getRouteAndCheck=this.getRouteAndCheck.bind(this);
        let current=globalStore.getData(keys.nav.routeHandler.routeForPage);
        globalStore.storeData(keys.gui.routepage.initialName,current?current.name:"");
        let selectedPoint=0;
        if (current && RouteHandler.isEditingRoute(current.name)){
            selectedPoint=RouteHandler.getEditingWpIdx();
        }
        globalStore.storeData(keys.gui.routepage.selectedPoint,selectedPoint);
    }

    getRouteAndCheck(showWarning,allowReadOnly){
        let current=globalStore.getData(keys.nav.routeHandler.routeForPage);
        if (!current) return;
        if (globalStore.getData(keys.properties.connectedMode,false))return current.clone();
        if (! current.server) return current.clone();
        if (allowReadOnly) return current.clone();
        if (showWarning === undefined || showWarning){
            OverlayDialog.confirm("you cannot edit this route as you are disconnected. Please select a new name");
        }
        return ;
    }

    storeRouteAndReturn(startNav){
        let self=this;
        let current=globalStore.getData(keys.nav.routeHandler.routeForPage);
        if (!current) {
            history.pop();
            return;
        }
        if (current.name != globalStore.getData(keys.gui.routepage.initialName,"") ){
            //check if a route with this name already exists
            RouteHandler.fetchRoute(current.name,!current.server,
                function(data){
                    Toast.Toast("route with name "+current.name+" already exists");
                },
                function(er){
                    if(self.storeRoute(current.clone(),startNav)) history.pop();
                });
            return;
        }
        if (self.storeRoute(current.clone(),startNav)) history.pop();
        return true;
    }
    storeRoute(route,startNav){
        if (globalStore.getData(keys.gui.routepage.initialName,"") != route.name){
            route.server=globalStore.getData(keys.properties.connectedMode,false);
        }
        let selectedIdx=globalStore.getData(keys.gui.routepage.selectedPoint,-1);
        RouteHandler.setNewEditingRoute(route,true);
        RouteHandler.setEditingWpIdx(selectedIdx);
        if (startNav){
            let targetWp=route.getPointAtIndex(selectedIdx);
            if (targetWp){
                RouteHandler.wpOn(targetWp,true);
            }
        }
        return true;
    }


    render(){
        let self=this;
        const MainContent=Dynamic((props)=> {
            if (! props.currentRoute) return null;
            return(
            <React.Fragment>
                <Heading
                    onClick={()=>{
                        }
                    }
                    currentRoute={props.currentRoute}
                    />
                <ItemList
                    itemList={props.currentRoute.getFormattedPoints(props.selectedIdx)}
                    itemClass={WaypointListItem}
                    scrollable={true}
                    onItemClick={(item)=>{
                        globalStore.storeData(keys.gui.routepage.selectedPoint,item.idx);
                    }}
                    />

            </React.Fragment>
            );
        });
        return (
            <DynamicPage
                style={this.props.style}
                id="routepage"
                mainContent={
                            <MainContent
                                storeKeys={{
                                    currentRoute: keys.nav.routeHandler.routeForPage,
                                    selectedIdx: keys.gui.routepage.selectedPoint
                                }}
                            />
                        }
                buttonList={self.buttons}
                storeKeys={{
                    isActive:keys.nav.routeHandler.pageRouteIsActive
                }}
                updateFunction={(state)=>{
                    return{
                        title:state.isActive?"Active Route":"Inactive Route",
                        className:state.isActive?"activeRoute":""
                    };
                }}
                />
        );
    }
}

module.exports=RoutePage;