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
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';

const RouteHandler=NavHandler.getRoutingHandler();

const headlines={
    track: "Tracks",
    chart: "Charts",
    route: "Routes"
};
const DynamicPage=Dynamic(Page);
const DynamicList=Dynamic(ItemList);

class FileInfo{
    constructor(name,type,time) {
        /**
         * @type {String}
         */
        this.name = name;

        /**
         * @type {String} track,chart
         */
        this.type = type || "track";
        /**
         * @type {number} ms timestamp
         */
        this.time = time || 0;
        /**
         *
         * @type {boolean}
         */
        this.canDelete = true;
    }
};

const fillDataServer=(type)=>{
    addItems([],true);
    Requests.getJson("?request=listdir&type="+type).then((json)=>{
        let list=[];
        for (let i=0;i<json.items.length;i++){
            let fi=new FileInfo();
            assign(fi,json.items[i]);
            fi.type=type;
            list.push(fi);
        }
        addItems(list);
    }).catch((error)=>{
        Toast.Toast("unable to load list of "+type+" from server: "+error);
    });
};

const findInfo=(list,item)=>{
    for (let k=0;k < list.length;k++){
        if (list[k].name == item.name) return k;
    }
    return -1;
};
const addItems=(items,opt_empty)=>{
    let current=opt_empty?[]:globalStore.getData(keys.gui.downloadpage.currentItems,[]);
    let newItems=[];
    for (let i in current){
        newItems.push(current[i]);
    }
    for (let i in items){
        let existingIdx=findInfo(newItems,items[i]);
        if (existingIdx >= 0){
            //update
            newItems[existingIdx]=items[i];
        }
        else{
            newItems.push(items[i]);
        }
    }
    globalStore.storeData(keys.gui.downloadpage.currentItems,newItems);
};

const fillDataRoutes=()=>{
    let localRoutes=RouteHandler.listRoutesLocal();
    addItems(localRoutes,true);
    if (globalStore.getData(keys.properties.connectedMode)) {
        RouteHandler.listRoutesServer(
             (routingInfos)=> {
                addItems(routingInfos);
            },
            (err)=> {
                Toast.Toast("unable to load routes from server: " + err);
            }
        );
    }
};

const fillData=()=>{
    let type=globalStore.getData(keys.gui.downloadpage.type,'chart');
    if (type != 'route') return fillDataServer(type);
    fillDataRoutes();
};

const changeType=(newType)=>{
    if (newType != globalStore.getData(keys.gui.downloadpage.type)) {
        globalStore.storeData(keys.gui.downloadpage.type, newType);
        fillData();
    }
};

const DownloadItem=(props)=>{
    let dp={};
    if (props.type == "route"){
        dp.timeText=Formatter.formatDateTime(new Date(props.time));
    }
    else{
        dp.timeText=Formatter.formatDateTime(new Date(props.time*1000));
    }
    dp.infoText=props.name;
    let showRas=false;
    if (props.type == "route"){
        dp.infoText+=","+Formatter.formatDecimal(props.length,4,2)+
            " nm, "+props.numpoints+" points";
        if (props.server) showRas=true;
    }
    let showDownload=false;
    if (props.type === "track" || props.type === "route" || (props.url && props.url.match("^/gemf") && ! avnav.android) ) {
        showDownload=true;
    }
    let  cls="avn_download_list_entry";
    if (props.active){
        cls+=" avn_download_active_entry";
    }
    let showDelete=!props.active;
    if (props.canDelete !== undefined){
        showDelete=props.canDelete && ! props.active;
    }
    return(
        <div className={cls} onClick={function(ev){
            props.onClick('select')
        }}>
            {(showDelete && ! props.active) &&<button className="avn_download_btnDelete avn_smallButton" onClick={(ev)=>{
                ev.preventDefault();
                ev.stopPropagation();
                props.onClick('delete');
            }}/>}
            <div className="avn_download_itemwrapper">
                <div className="avn_download_listdate">{dp.timeText}</div>
                <div className="avn_download_listinfo">{dp.infoText}</div>
            </div>
            {showRas && <div className="avn_download_listrasimage"></div>}
            { showDownload && <button className="avn_download_btnDownload avn_smallButton" onClick={
                (ev)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    props.onClick('download');
                }
            }/>}
        </div>
    );
};

const sendDelete=(info)=>{
    let url = "?request=delete&type="+info.type;
    url+="&name="+encodeURIComponent(info.name);
    if (info.type == "chart"){
        url+="&url="+encodeURIComponent(info.url);
    }
    Requests.getJson(url).then((json)=>{
        if (info.type == 'track'){
            NavHandler.resetTrack();
        }
        fillData();
    }).catch((error)=>{
        Toast.Toast("unable to delete "+info.name+": "+error);
        fillData();
    });
};

const deleteItem=(info)=>{
    let ok = OverlayDialog.confirm("delete " + info.type + " " + info.name + "?");
    ok.then(function() {
        if (info.type != "route") {
            sendDelete(info);
        }
        else{
            if (RouteHandler.isActiveRoute(info.name)){
                Toast.Toast("unable to delete active route");
                return false;
            }
            RouteHandler.deleteRoute(info.name,
                (data)=>{fillData();},
                (rinfo)=>{
                    Toast.Toast("unable to delete route: "+rinfo);
                    fillData();
                },
                !info.server //if we think this is a local route - just delete it local only
            );
        }
    });
    ok.catch(function(err){
        avnav.log("delete canceled");
    });
};

const startServerDownload=(type,name,opt_url,opt_json)=>{
    let filename=name;
    if (type == 'route') filename+=".gpx";
    let action=PropertyHandler.getProperties().navUrl+"/"+filename;
    let old=globalStore.getData(keys.gui.downloadpage.downloadParameters,{count:1}).count||0;
    globalStore.storeData(keys.gui.downloadpage.downloadParameters,{
        name:name,
        url:opt_url,
        type: type,
        action:action,
        count:old+1, //have a count to always trigger an update
        json:opt_json
    });
};

const download=(info)=>{
    if (info) {
        if (avnav.android) {
            if (info.type == "track") {
                avnav.android.downloadTrack(info.name);
                return;
            }
            if (info.type == "route") {
                RouteHandler.fetchRoute(info.name, !info.server, (data)=> {
                        avnav.android.downloadRoute(data.toJsonString());
                    },
                    (err)=> {
                        Toast.Toast("unable to get route " + info.name);
                    });
            }
            return;
        }
        else {
            if (info.type == "track") startServerDownload(info.type,info.url ? info.url : info.name);
            else {
                if (info.type == "route") {
                    if (info.server) startServerDownload(info.type,info.name);
                    else {
                        RouteHandler.fetchRoute(info.name, true, (data)=> {
                                startServerDownload(info.type,info.name, undefined, data.toJsonString());
                            },
                            (err)=> {
                                Toast.Toast("unable to get route " + info.name);
                            });
                    }
                }
                else startServerDownload(info.type,info.name + ".gemf", info.url);
            }
        }
    }
};

class DownloadForm extends React.Component {
    constructor(props) {
        super(props);
    }
    componentDidMount(){
        if (this.refs.form) this.refs.form.submit();
    }
    componentDidUpdate(){
        if (this.refs.form) this.refs.form.submit();
    }

    render() {
        let props=this.props.downloadParameters||{};
        if (! props.action) return null;
        return (
            <form
                className="hidden downloadForm"
                action={props.action}
                ref="form"
                method="get"
                >
                <input type="hidden" name="request" value="download"/>
                <input type="hidden" name="name" value={props.json?"":props.name}/>
                <input type="hidden" name="url" value={props.url}/>
                <input type="hidden" name="type" value={props.type}/>
                {props.json ? <input type = "hidden" name="_json" value={props.json}/>:null}
            </form>
        );
    }
}
const DynamicForm=Dynamic(DownloadForm,{
    storeKeys:{
        downloadParameters:keys.gui.downloadpage.downloadParameters
    }
});

class DownloadPage extends React.Component{
    constructor(props){
        super(props);
        let self=this;
        this.getButtons=this.getButtons.bind(this);
        let type='chart';
        if (props.options && props.options.downloadtype){
            type=props.options.downloadtype;
        }
        globalStore.storeData(keys.gui.downloadpage.type,type);
        globalStore.storeData(keys.gui.downloadpage.downloadParameters,{});
        fillData();
    }
    getButtons(type){
        let allowTypeChange=! (this.props.options && this.props.options.allowChange === false);
        let rt=[
            {
                name:'DownloadPageCharts',
                toggle: type=='chart',
                visible: type=='chart'|| allowTypeChange,
                onClick:()=>{changeType('chart')}
            },
            {
                name:'DownloadPageTracks',
                toggle: type =='track',
                visible: type == 'track' || allowTypeChange,
                onClick:()=>{changeType('track')}
            },
            {
                name:'DownloadPageRoutes',
                toggle: type == 'route',
                visible: type == 'route'|| allowTypeChange,
                onClick:()=>{changeType('route')}
            },
            {
                name:'DownloadPageUpload',
                visible: type == 'route' || type =='chart',
                onClick:()=>{}
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
        return (
            <DynamicPage
                className={self.props.className}
                style={self.props.style}
                id="downloadpage"
                mainContent={
                            <React.Fragment>
                            <DynamicList
                                itemClass={DownloadItem}
                                scrollable={true}
                                storeKeys={{
                                    itemList:keys.gui.downloadpage.currentItems,
                                    type:keys.gui.downloadpage.type
                                    }}
                                onItemClick={(item,data)=>{
                                    console.log("click on "+item.name+" type="+data);
                                    if (data == 'delete'){
                                        return deleteItem(item);
                                    }
                                    if (data == 'download'){
                                        return download(item);
                                    }
                                }}
                            />
                            <DynamicForm/>
                            </React.Fragment>
                        }
                buttonList={self.buttons}
                storeKeys={{
                    type:keys.gui.downloadpage.type,
                }}
                updateFunction={(state)=>{
                    let rt={};
                    rt.title=headlines[state.type];
                    rt.buttonList=self.getButtons(state.type);
                    rt.type=state.type;
                    return rt;
                }}
                />
        );
    }
}

module.exports=DownloadPage;