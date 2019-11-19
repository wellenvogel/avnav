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
import GuiHelpers from '../util/GuiHelpers.js';
import Helper from '../util/helper.js';
import WaypointListItem from '../components/WayPointListItem.jsx';
import WayPointDialog from '../components/WaypointDialog.jsx';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import NavHandler from '../nav/navdata.js';
import assign from 'object-assign';
import RouteObjects from '../nav/routeobjects.js';

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

const WaypointForList=(props)=>{
    let formattedProps=RouteObjects.formatRoutePoint(props);
    return <WaypointListItem {...formattedProps}/>
};

const createNewRouteDialog=(name,okCallback)=> {
    class Dialog extends React.Component{
        constructor(props){
            super(props);
            this.state={
                name: name,
                copyPoints: true
            };
            this.nameChanged=this.nameChanged.bind(this);
            this.changeValue=this.changeValue.bind(this);
            this.okFunction=this.okFunction.bind(this);
            this.cancelFunction=this.cancelFunction.bind(this);
        }
        nameChanged(event) {
            this.setState({name: event.target.value});
        }
        changeValue(name,newValue) {
            let ns={};
            ns[name]=newValue;
            this.setState(ns);
        }
        okFunction(event) {
            let rt = okCallback(this.state,this.props.closeCallback);
            if (rt ) this.props.closeCallback();
        }
        cancelFunction(event) {
            this.props.closeCallback();
        }
        render () {
            let self=this;
            let html = (
                <div className="editRouteName">
                    <h3 className="dialogTitle">Save as New</h3>
                    <div>
                        <div className="row">
                            <input type="text" name="value" value={this.state.name} onChange={this.nameChanged}/>
                        </div>
                        <div className="row" onClick={function () {
                                self.changeValue('copyPoints', !self.state.copyPoints);
                            }} >
                            <label>
                                Copy Points
                            </label>
                            <span className={'avnCheckbox' + (this.state.copyPoints ? ' checked' : '')}/>
                        </div>
                    </div>
                    <button name="ok" onClick={this.okFunction}>Ok</button>
                    <button name="cancel" onClick={this.cancelFunction}>Cancel</button>
                    <div className="clear"></div>
                </div>
            );
            return html;
        }
    };
    return Dialog;
};

const getRouteAndCheck=(showWarning,allowReadOnly)=>{
    let current=globalStore.getData(keys.nav.routeHandler.routeForPage);
    if (!current) return;
    if (globalStore.getData(keys.properties.connectedMode,false))return current.clone();
    if (! current.server) return current.clone();
    if (allowReadOnly) return current.clone();
    if (showWarning === undefined || showWarning){
        OverlayDialog.confirm("you cannot edit this route as you are disconnected. Please select a new name");
    }
};

const onHeadingClick=()=> {
    let current = globalStore.getData(keys.nav.routeHandler.routeForPage);
    const okCallback = (values, closeFunction)=> {
        if (!current) {
            return true;
        }
        let name = values.name || "";
        if (name == current.name) return true;
        if (name != globalStore.getData(keys.gui.routepage.initialName)) {
            //check if a route with this name already exists
            RouteHandler.fetchRoute(name, false,
                (data)=> {
                    Toast.Toast("route with name " + name + " already exists");
                },
                (er)=> {
                    let newRoute = current.clone();
                    newRoute.setName(name);
                    if (!values.copyPoints) {
                        newRoute.points = [];
                        globalStore.storeData(keys.gui.routepage.selectedPoint, -1);
                    }
                    if (!globalStore.getData(keys.properties.connectedMode, false)) newRoute.server = false;
                    RouteHandler.setRouteForPage(newRoute);
                    closeFunction();
                });
            return false;
        }
        return true;
    };
    OverlayDialog.dialog(createNewRouteDialog(current.name,
        okCallback));
};


const startWaypointDialog=(item)=>{
    const wpChanged=(newWp,close)=>{
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,function(err){
            Toast.Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            let current=getRouteAndCheck(true);
            if (!current.changePoint(item,changedWp)){
                Toast.Toast("unable to set waypoint, already exists");
                return false;
            }
            RouteHandler.setRouteForPage(current);
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

const storeRoute=(route,startNav)=>{
    if (globalStore.getData(keys.gui.routepage.initialName,"") != route.name){
        route.server=globalStore.getData(keys.properties.connectedMode,false);
    }
    let selectedIdx=globalStore.getData(keys.gui.routepage.selectedPoint,-1);
    RouteHandler.setNewEditingRoute(route);
    RouteHandler.setEditingWpIdx(selectedIdx);
    if (startNav){
        let targetWp=route.getPointAtIndex(selectedIdx);
        if (targetWp){
            RouteHandler.wpOn(targetWp,true);
        }
    }
    return true;
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
                    let current=getRouteAndCheck();
                    if (! current) return;
                    RouteHandler.setRouteForPage(current.swap()); //double clone - but otherwise we modify inside store...
                }
            },
            {
                name:'NavDeleteAll',
                onClick: ()=>{
                    let current=getRouteAndCheck();
                    if (! current) return;
                    current.points=[];
                    RouteHandler.setRouteForPage(current); //double clone - but otherwise we modify inside store...
                }
            },
            {
                name:'RoutePageDownload',
                onClick:()=>{
                    history.push("downloadpage",{
                        downloadtype:'route',
                        allowChange: false,
                        selectItemCallback: (item)=>{
                            RouteHandler.fetchRoute(item.name,!item.server,
                                (route)=>{
                                    RouteHandler.setRouteForPage(route);
                                    history.pop();
                                },
                                function(err){
                                    Toast.Toast("unable to load route");
                                }
                            );
                        }
                    });
                }
            },
            {
                name: 'Cancel',
                onClick: ()=>{history.pop()}
            }
        ];
        this.storeRouteAndReturn=this.storeRouteAndReturn.bind(this);
        let current=globalStore.getData(keys.nav.routeHandler.routeForPage);
        globalStore.storeData(keys.gui.routepage.initialName,current?current.name:"");
        let selectedPoint=0;
        if (current && RouteHandler.isEditingRoute(current.name)){
            selectedPoint=RouteHandler.getEditingWpIdx();
        }
        globalStore.storeData(keys.gui.routepage.selectedPoint,selectedPoint);
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
                    if(storeRoute(current.clone(),startNav)) history.pop();
                });
            return;
        }
        if (storeRoute(current.clone(),startNav)) history.pop();
        return true;
    }


    render(){
        let self=this;
        const MainContent=Dynamic((props)=> {
            if (! props.currentRoute) return null;
            return(
            <React.Fragment>
                <Heading
                    onClick={onHeadingClick}
                    currentRoute={props.currentRoute}
                    />
                <ItemList
                    itemList={props.currentRoute.getRoutePoints(props.selectedIdx)}
                    itemClass={WaypointForList}
                    scrollable={true}
                    onItemClick={(item,data)=>{
                        if (data=='btnDelete'){
                            let current=getRouteAndCheck(true);
                            if (! current) return;
                            current.deletePoint(item.idx);
                            RouteHandler.setRouteForPage(current);
                            return;
                        }
                        if (item.selected){
                            startWaypointDialog(item);
                            return;
                        }
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