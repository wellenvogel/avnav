/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys,{KeyHelper} from '../util/keys.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import MapHolder from '../map/mapholder.js';
import GuiHelpers from '../util/GuiHelpers.js';
import Helper from '../util/helper.js';
import WaypointListItem from '../components/WayPointListItem.jsx';
import WayPointDialog from '../components/WaypointDialog.jsx';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import NavHandler from '../nav/navdata.js';
import assign from 'object-assign';
import RouteEdit,{StateHelper} from '../nav/routeeditor.js';
import navobjects from '../nav/navobjects.js';
import DB from '../components/DialogButton.jsx';
import {Input,Checkbox} from '../components/Inputs.jsx';
import Mob from '../components/Mob.js';
import {stopAnchorWithConfirm} from "../components/AnchorWatchDialog";

const PAGENAME="routepage";
const editor=new RouteEdit(RouteEdit.MODES.PAGE);
const activeRoute=new RouteEdit(RouteEdit.MODES.ACTIVE);

const isActiveRoute=()=>{
    let activeName=activeRoute.getRouteName();
    if (activeName && activeName == editor.getRouteName()) return true;
    return false;
};

const DynamicPage=Dynamic(Page);
const RouteHandler=NavHandler.getRoutingHandler();

const Heading = (props)=>{
    if (! props.currentRoute) return null;
    let len=props.currentRoute.computeLength(0,props.useRhumbLine);
    return (
        <div className="routeCurrent" onClick={props.onClick}>
            <div className="routeName">{props.currentRoute.name||''}</div>
            <div className="routeInfo">{props.currentRoute.points.length||0}Points,{Formatter.formatDistance(len)}nm</div>
            <span className="more"> </span>
        </div>
    );
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
            this.okFunction=this.okFunction.bind(this);
            this.cancelFunction=this.cancelFunction.bind(this);
        }
        nameChanged(value) {
            this.setState({name: value});
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
                <div className="editRouteName inner">
                    <h3 className="dialogTitle">Save as New</h3>
                    <div>
                        <div className="dialogRow">
                            <Input
                                label="Name"
                                value={this.state.name}
                                onChange={this.nameChanged}/>
                        </div>
                        <div className="dialogRow">
                            <Checkbox
                                onChange={function (newVal) {
                                    self.setState({copyPoints:newVal});
                                }}
                                label="Copy Points"
                                value={self.state.copyPoints}/>
                        </div>
                    </div>
                    <div className="dialogButtons">
                        <DB name="cancel" onClick={this.cancelFunction}>Cancel</DB>
                        <DB name="ok" onClick={this.okFunction}>Ok</DB>
                    </div>
                </div>
            );
            return html;
        }
    };
    return Dialog;
};


const checkWritable=()=>{
     if (!editor.isRouteWritable()){
         OverlayDialog.confirm("you cannot edit this route as you are disconnected. Please select a new name");
         return false;
     }
    return true;
};

const onHeadingClick=()=> {
    if (!editor.hasRoute()) return;
    const okCallback = (values, closeFunction)=> {
        if (! editor.hasRoute()) return;
        let name = values.name || "";
        if (name == editor.getRouteName()) return true;
        if (name != globalStore.getData(keys.gui.routepage.initialName)) {
            //check if a route with this name already exists
            RouteHandler.fetchRoute(name, false,
                (data)=> {
                    Toast("route with name " + name + " already exists");
                },
                (er)=> {
                    let newRoute = editor.getRoute().clone();
                    newRoute.setName(name);
                    if (!values.copyPoints) {
                        newRoute.points = [];
                    }
                    if (!globalStore.getData(keys.properties.connectedMode, false)) newRoute.server = false;
                    editor.setRouteAndIndex(newRoute,-1);
                    closeFunction();
                });
            return false;
        }
        return true;
    };
    OverlayDialog.dialog(createNewRouteDialog(editor.getRouteName(),
        okCallback));
};


const startWaypointDialog=(rawitem,index)=>{
    if (! rawitem) return;
    let item=new navobjects.WayPoint();
    assign(item,rawitem);
    const wpChanged=(newWp,close)=>{
        if (! checkWritable()) return;
        let changedWp=WayPointDialog.updateWaypoint(item,newWp,function(err){
            Toast(Helper.escapeHtml(err));
        });
        if (changedWp) {
            if (! editor.checkChangePossible(changedWp,index)){
                Toast("unable to set waypoint, already exists");
                return false;
            }
            editor.changeSelectedWaypoint(changedWp,index);
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

    let current=editor.getPointAt();
    if (current) MapHolder.setCenter(current);
    editor.setNewRoute(route); //potentially we changed the server flag - so write it again
    editor.setNewIndex(editor.getIndexFromPoint(current,true));
    editor.syncTo(RouteEdit.MODES.EDIT);
    if (isActiveRoute()){
        activeRoute.setNewRoute(route);
    }
    if (startNav && current){
            RouteHandler.wpOn(current,true);
    }
    return true;
};

class RoutePage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.listRef=undefined;
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
                    stopAnchorWithConfirm(true)
                        .then(()=>self.storeRouteAndReturn(true))
                        .catch(()=>{})
                }
            },
            {
                name:'NavInvert',
                onClick: ()=>{
                    if (! checkWritable())return;
                    editor.invertRoute();
                }
            },
            {
                name:'NavDeleteAll',
                onClick: ()=>{
                    if (! checkWritable()) return;
                    editor.emptyRoute();
                }
            },
            {
                name:'RoutePageDownload',
                onClick:()=>{
                    this.props.history.push("downloadpage",{
                        downloadtype:'route',
                        allowChange: false,
                        selectItemCallback: (item)=>{
                            RouteHandler.fetchRoute(item.name,!item.server,
                                (route)=>{
                                    editor.setRouteAndIndex(route,0);
                                    globalStore.storeData(keys.gui.routepage.initialName,route.name);
                                    this.props.history.pop();
                                },
                                function(err){
                                    Toast("unable to load route");
                                }
                            );
                        }
                    });
                }
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
            }
        ];
        this.storeRouteAndReturn=this.storeRouteAndReturn.bind(this);
        globalStore.storeData(keys.gui.routepage.initialName,editor.getRouteName());
        RouteHandler.setCurrentRoutePage(PAGENAME);
    }

    componentDidMount(){
        if (this.listRef){
            let el=this.listRef.querySelector('.activeEntry');
            if (el){
                let mode=GuiHelpers.scrollInContainer(this.listRef,el);
                if (mode >= 1 || mode <= 2) el.scrollIntoView(mode==1);
            }
        }
    }
    componentWillUnmount(){
        RouteHandler.unsetCurrentRoutePage(PAGENAME);
    }


    storeRouteAndReturn(startNav){
        if (!editor.hasRoute()){
            this.props.history.pop();
            return;
        }
        let currentName=editor.getRouteName();
        let current=editor.getRoute();
        if (currentName != globalStore.getData(keys.gui.routepage.initialName,"") ){
            //check if a route with this name already exists
            RouteHandler.fetchRoute(currentName,!current.server,
                (data)=>{
                    Toast("route with name "+currentName+" already exists");
                },
                (er)=>{
                    if(storeRoute(current.clone(),startNav)) this.props.history.pop();
                });
            return;
        }
        if (storeRoute(current.clone(),startNav)) this.props.history.pop();
        return true;
    }


    render(){
        let self=this;
        const MainContent=Dynamic((props)=> {
            let [route,index,isActive]=StateHelper.getRouteIndexFlag(props);
            if (! route) return null;
            return(
            <React.Fragment>
                <Heading
                    onClick={onHeadingClick}
                    currentRoute={route}
                    useRhumbLine={props.useRhumbLine}
                    />
                <ItemList
                    itemList={route.getRoutePoints(index,props.useRhumbLine)}
                    itemClass={WaypointListItem}
                    scrollable={true}
                    onItemClick={(item,data)=>{
                        if (data=='btnDelete'){
                            if (!checkWritable()) return;
                            editor.setNewIndex(item.idx);
                            editor.deleteWaypoint();
                            return;
                        }
                        if (item.idx == editor.getIndex()){
                            startWaypointDialog(item,item.idx);
                            return;
                        }
                        editor.setNewIndex(item.idx);
                    }}
                    listRef={(el)=>{self.listRef=el;}}
                    />

            </React.Fragment>
            );
        });
        return (
            <DynamicPage
                {...this.props}
                id={PAGENAME}
                mainContent={
                            <MainContent
                                storeKeys={editor.getStoreKeys({
                                    useRhumbLine:keys.nav.routeHandler.useRhumbLine
                                })}
                            />
                        }
                buttonList={self.buttons}
                storeKeys={KeyHelper.flattenedKeys(editor.getStoreKeys())
                                    .concat(KeyHelper.flattenedKeys(activeRoute.getStoreKeys()))}
                updateFunction={(state)=>{
                    let isActive=isActiveRoute();
                    return{
                        title:isActive?"Active Route":"Inactive Route",
                        className:isActive?"activeRoute":""
                    };
                }}
                />
        );
    }
}

export default RoutePage;