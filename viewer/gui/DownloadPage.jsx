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
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import Formatter from '../util/formatter.js';
import OverlayDialog from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import base from '../base.js';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import jsdownload from 'downloadjs';
import GuiHelpers from '../util/GuiHelpers.js';
import LeaveHandler from '../util/leavehandler.js';
import LayoutNameDialog from '../components/LayoutNameDialog.jsx';

const MAXUPLOADSIZE=100000;
const MAXEDITSIZE=MAXUPLOADSIZE;
const RouteHandler=NavHandler.getRoutingHandler();


const headlines={
    track: "Tracks",
    chart: "Charts",
    route: "Routes",
    layout:"Layouts",
    user: "User",
    images: "Images"
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
    Requests.getJson("?request=listdir&type="+type).then((json)=>{
        let list=[];
        for (let i=0;i<json.items.length;i++){
            let fi=new FileInfo();
            assign(fi,json.items[i]);
            fi.type=type;
            fi.server=true;
            if (fi.canDelete === undefined) fi.canDelete=false;
            list.push(fi);
        }
        addItems(list,true);
    }).catch((error)=>{
        addItems([],true);
        Toast("unable to load list of "+type+" from server: "+error);
    });
};

const findInfo=(list,item)=>{
    for (let k=0;k < list.length;k++){
        if (list[k].name == item.name) return k;
    }
    return -1;
};

const itemSort=(a,b)=>{
    if (a.time !== undefined && b.time !== undefined){
        return b.time - a.time;
    }
    if (a.name > b.name) return 1;
    if (a.name < b.name) return -1;
    return 0;
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
    newItems.sort(itemSort);
    globalStore.storeData(keys.gui.downloadpage.currentItems,newItems);
};


const fillDataRoutes = ()=> {
    let localRoutes = RouteHandler.listRoutesLocal();
    addItems(localRoutes, true);
    RouteHandler.listRoutesServer(
        (routingInfos)=> {
            addItems(routingInfos);
        },
        (err)=> {
            Toast("unable to load routes from server: " + err);
        }
    );
};

const fillData=()=>{
    let type=globalStore.getData(keys.gui.downloadpage.type,'chart');
    if (type == 'route') return fillDataRoutes();
    if (type == 'layout') {
        LayoutHandler.listLayouts()
            .then((list)=>{
               addItems(list,true);
            })
            .catch((error)=>{
            Toast("unable to load layouts "+error);
            });
        return;
    }
    return fillDataServer(type);
};

const changeType=(newType)=>{
    globalStore.storeData(keys.gui.downloadpage.type, newType);
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
    if (props.type === "track"
        || props.type === "route"
        || props.type == 'layout'
        || props.type == 'user'
        || props.type == 'images'
        || (props.url && props.url.match("^/gemf") && ! avnav.android) ) {
        showDownload=true;
    }
    let  cls="listEntry";
    if (props.active){
        cls+=" activeEntry";
    }
    let showDelete=!props.active;
    if (props.canDelete !== undefined){
        showDelete=props.canDelete && ! props.active;
    }
    let dataClass="downloadItemData";
    if (!(showDelete && ! props.active)) dataClass+=" noDelete";
    let showView=(props.type == 'user' || props.type=='images');
    let showEdit=(props.type == 'user' && props.size !== undefined && props.size < MAXEDITSIZE);
    return(
        <div className={cls} onClick={function(ev){
            props.onClick('select')
        }}>
            {(showDelete && ! props.active) &&<Button className="Delete smallButton" onClick={(ev)=>{
                ev.preventDefault();
                ev.stopPropagation();
                props.onClick('delete');
            }}/>}
            <div className={dataClass}>
                <div className="date">{dp.timeText}</div>
                <div className="info">{dp.infoText}</div>
            </div>
            { showView && <Button className="View smallButton" onClick={
                (ev)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    props.onClick('view');
                }
            }/>}
            { showEdit && <Button className="DownloadEdit smallButton" onClick={
                (ev)=>{
                    ev.stopPropagation();
                    ev.preventDefault();
                    props.onClick('edit');
                }
            }/>}
            {showRas && <div className="listrasimage"></div>}
            { showDownload && <Button className="Download smallButton" onClick={
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
        Toast("unable to delete "+info.name+": "+error);
        fillData();
    });
};

const deleteItem=(info)=>{
    let ok = OverlayDialog.confirm("delete " + info.type + " " + info.name + "?");
    ok.then(function() {
        if (info.type == 'layout'){
            if (LayoutHandler.deleteItem(info.name)) {
                fillData();
                return;
            }
        }
        if (info.type != "route") {
            sendDelete(info);
        }
        else{
            if (RouteHandler.isActiveRoute(info.name)){
                Toast("unable to delete active route");
                return false;
            }
            RouteHandler.deleteRoute(info.name,
                (data)=>{fillData();},
                (rinfo)=>{
                    Toast("unable to delete route: "+rinfo);
                    fillData();
                },
                !info.server //if we think this is a local route - just delete it local only
            );
        }
    });
    ok.catch(function(err){
        base.log("delete canceled");
    });
};

const startServerDownload=(type,name,opt_url,opt_json)=>{
    let action=undefined;
    let filename=name;
    if (filename) {
        if (type == 'route') filename += ".gpx";
        if (type == 'layout') filename=filename.replace(/^[^.]*\./,'')+".json";
        action = globalStore.getData(keys.properties.navUrl) + "/" + filename;
    }
    if (avnav.android){
        //we cannot handle the special case with local routes on android
        //but this will not happen anyway...
        if (type == 'route') name+=".gpx";
        if (type == "layout") name+=".json";
        return avnav.android.downloadFile(name,type);
    }

    globalStore.storeData(keys.gui.downloadpage.downloadParameters,{
        name:name,
        url:opt_url,
        type: type,
        action:action,
        count:(new Date()).getTime(), //have a count to always trigger an update
        json:opt_json
    });
};

const download = (info)=> {
    if (info) {
        if (info.type == 'layout'){
            if (LayoutHandler.download(info.name)) return;
        }
        if (info.type == "track"
            || info.type == 'layout'
            || info.type == 'user'
            || info.type == 'images'
        )
            startServerDownload(info.type, info.url ? info.url : info.name);
        else {
            if (info.type == "route") {
                if (info.server) startServerDownload(info.type, info.name);
                else {
                    RouteHandler.fetchRoute(info.name, true, (data)=> {
                            jsdownload(data.toXml(),info.name+".gpx","application/gpx+xml");
                        },
                        (err)=> {
                            Toast("unable to get route " + info.name);
                        });
                }
            }
            else startServerDownload(info.type, info.name + ".gemf", info.url);
        }

    }
};


const resetUpload=()=>{
    globalStore.storeData(keys.gui.downloadpage.enableUpload,false);
};

const uploadRouteData=(filename,data)=>{
    let route = undefined;
    try {
        route = new routeobjects.Route("");
        route.fromXml(data);
    } catch (e) {
        Toast("unable to parse route , error: " + e);
        return;
    }
    if (!route.name || route.name == "") {
        Toast("route has no route name");
        return;
    }
    if (entryExists(route.name)) {
        Toast("route with name " + route.name + " already exists");
        return false;
    }
    if (globalStore.getData(keys.properties.connectedMode, false)) route.server = true;
    RouteHandler.saveRoute(route, function () {
        fillData();
        return true;
    });
};


const userlayoutExists=(name)=>{
    let itemName=LayoutHandler.fileNameToServerName(name);
    return entryExists(itemName);
};

const uploadLayoutData = (fileName, data)=> {
    if (userlayoutExists(fileName)) {
        let baseName=LayoutHandler.nameToBaseName(fileName);
        LayoutNameDialog.createDialog(baseName,userlayoutExists)
            .then((newName)=>{
                LayoutHandler.uploadLayout(newName,data,true)
                    .then((result)=>{fillData();})
                    .catch((error)=>{Toast("unable to upload layout: "+error);})
                })
            .catch((error)=>{});
        return;
    }
    LayoutHandler.uploadLayout(fileName, data, true)
        .then(
        (result)=> {
            fillData();
        }
    ).catch(
        (error)=> {
            Toast("unable to upload layout: " + error);
        }
    )
};
const runUpload=(ev)=>{
    let type=globalStore.getData(keys.gui.downloadpage.type);
    if (! type) return;
    if (type == 'chart'){
        return uploadChart(ev.target);
    }
    if (type == 'route'){
        uploadFileReader(ev.target,".gpx").then((content)=> {
                return uploadRouteData(content.name, content.content);
            }
        ).catch((error)=>{
                Toast(error);
            })
    }
    if (type == 'layout'){
        uploadFileReader(ev.target,".json").then(
            (content)=>{
                return uploadLayoutData(content.name,content.content)
            }
        ).catch(
            (error)=>{Toast(error)}
        )
    }
    if (type == 'user' || type == 'images'){
        return uploadGeneric(type,ev.target);
    }
    resetUpload();
};

const entryExists=(name)=>{
    let current=globalStore.getData(keys.gui.downloadpage.currentItems,[]);
    return findInfo(current,{name:name})>=0;
};

const uploadChart=(fileObject)=>{
    if (fileObject.files && fileObject.files.length > 0) {
        let file = fileObject.files[0];
        if (! Helper.endsWith(file.name,".gemf")){
            Toast("upload only for .gemf files");
            resetUpload();
            return;
        }
        let current=globalStore.getData(keys.gui.downloadpage.currentItems,[]);
        for (let i=0;i<current.length;i++){
            let fname=current[i].name+".gemf";
            if (current[i].url && Helper.startsWith(current[i].url,"/gemf") && fname==file.name){
                Toast("file "+file.name+" already exists");
                resetUpload();
                return;
            }
        }
        resetUpload();
        directUpload('chart',file);
    }
};

const uploadGeneric=(type,fileObject)=>{
    if (fileObject.files && fileObject.files.length > 0) {
        let file = fileObject.files[0];
        let current=globalStore.getData(keys.gui.downloadpage.currentItems,[]);
        for (let i=0;i<current.length;i++){
            if (current[i].name ==file.name){
                Toast("file "+file.name+" already exists");
                resetUpload();
                return;
            }
        }
        resetUpload();
        directUpload(type,file);
    }
};

const UploadIndicator = Dynamic((info)=> {
    let props=info.uploadInfo;
    if (! props || !props.xhdr) return null;
    let percentComplete = props.total ? 100 * props.loaded / props.total : 0;
    let doneStyle = {
        width: percentComplete + "%"
    };
    return (
        <div className="downloadProgress">
            <div className="progressContainer">
                <div className="progressInfo">{props.loaded||0 + "/" + props.total||0}</div>
                <div className="progressDisplay">
                    <div className="progressDone" style={doneStyle}></div>
                </div>
            </div>
            <Button className="DownloadPageUploadCancel button" onClick={()=>{
                if (props.xhdr) props.xhdr.abort();
                globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
                }}
                />
        </div>
    );
}, {
   storeKeys:{uploadInfo: keys.gui.downloadpage.uploadInfo}
});
const directUpload=(type,file)=>{
    let url=globalStore.getData(keys.properties.navUrl)+ "?request=upload&type="+type+"&filename=" + encodeURIComponent(file.name);
    Requests.uploadFile(url, file, {
        self: self,
        starthandler: function(param,xhdr){
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,{
                xhdr:xhdr
            });
        },
        errorhandler: function (param, err) {
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
            Toast("upload failed: " + err.statusText);
        },
        progresshandler: function (param, ev) {
            if (ev.lengthComputable) {
                let old=globalStore.getData(keys.gui.downloadpage.uploadInfo);
                globalStore.storeData(keys.gui.downloadpage.uploadInfo,
                    assign({},old,{
                    total:ev.total,
                    loaded: ev.loaded
                }));
            }
        },
        okhandler: function (param, data) {
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
            setTimeout(function(){
                fillData();
            },1500);
        }
    });
};

const uploadFileReader=(fileObject,allowedExtension)=> {
    return new Promise((resolve,reject)=> {
        if (fileObject.files && fileObject.files.length > 0) {
            let file = fileObject.files[0];
            resetUpload();
            if (!Helper.endsWith(file.name, allowedExtension)) {
                reject("only "+allowedExtension+" files");
                return false;
            }
            let rname = file.name;
            if (file.size) {
                if (file.size > MAXUPLOADSIZE) {
                    reject("file is to big, max allowed: " + MAXUPLOADSIZE);
                    return;
                }
            }
            if (!window.FileReader) {
                reject("your browser does not support FileReader, cannot upload");
                return;
            }
            let reader = new FileReader();
            reader.onloadend = ()=> {
                let content = reader.result;
                if (!content) {
                    reject("unable to load file " + file.name);
                    return;
                }
                resolve({content:content,name:rname});


            };
            reader.readAsText(file);
        }
        else {
            reject("no file selected");
        }
    });
};


class DownloadForm extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount(){
        if (this.refs.form) {
            LeaveHandler.stop();
            this.refs.form.submit();
            LeaveHandler.activate();
            globalStore.storeData(keys.gui.downloadpage.downloadParameters,{});
        }
    }
    componentDidUpdate(){
        if (this.refs.form) {
            LeaveHandler.stop();
            this.refs.form.submit();
            LeaveHandler.activate();
            globalStore.storeData(keys.gui.downloadpage.downloadParameters,{});
        }
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

class UploadForm extends React.Component{
    constructor(props){
        super(props);
    }
    shouldComponentUpdate(nextProps,nextState){
        //ensure that we only trigger again if at least the keys has changed
        if (nextProps.fileInputKey != this.props.fileInputKey) return true;
        if (nextProps.enableUpload != this.props.enableUpload) return true;
        return false;
    }
    componentDidMount(){
        if (this.refs.form) this.refs.form.reset();
        if (this.refs.fileInput) this.refs.fileInput.click();
    }
    componentDidUpdate(){
        if (this.refs.form) this.refs.form.reset();
        if (this.refs.fileInput) this.refs.fileInput.click();
    }
    render(){
        if (!this.props.enableUpload) return null;
        return(
        <form className="hidden" method="post" ref="form">
            <input type="file" ref="fileInput" name="file" key={this.props.fileInputKey} onChange={this.props.startUpload}/>
        </form>
        );
    }
}

const DynamicUploadForm=Dynamic(UploadForm);

class Callback{
    constructor(callback){
        this.callback=callback;
    }
    dataChanged(keys){
        this.callback(keys);
    }
}
const androidUploadHandler=new Callback(()=>{
    if (!avnav.android) return;
    let requestedId=globalStore.getData(keys.gui.downloadpage.requestedUploadId);
    let current=globalStore.getData(keys.gui.downloadpage.androidUploadId);
    if (current != requestedId) return;
    //lets go back to the main thread as we had been called from android...
    window.setTimeout(()=> {
        let type = globalStore.getData(keys.gui.downloadpage.type);
        let filename = avnav.android.getFileName(current);
        if (!filename) return;
        let data=avnav.android.getFileData(current);
        if (type == 'route') {
            if (!filename.match(/\.gpx$/)) {
                Toast("only gpx files for routes");
                return;
            }
            uploadRouteData(filename,data);
        }
        if (type == 'layout') {
            uploadLayoutData(filename,data);
        }
    },0);
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
        if (globalStore.getData(keys.gui.downloadpage.type) === undefined || ! (props.options && props.options.returning)) {
            globalStore.storeData(keys.gui.downloadpage.type, type);
        }
        globalStore.storeData(keys.gui.downloadpage.downloadParameters,{});
        globalStore.storeData(keys.gui.downloadpage.enableUpload,false);
        globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
        fillData();
        globalStore.register(androidUploadHandler,keys.gui.downloadpage.androidUploadId);
    }
    componentWillUnmount(){
        globalStore.deregister(androidUploadHandler);
        let uploadInfo=globalStore.getData(keys.gui.downloadpage.uploadInfo,{});
        if (uploadInfo.xhdr) uploadInfo.xhdr.abort();
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
                name:'DownloadPageLayouts',
                toggle: type == 'layout',
                visible: type == 'layout'|| allowTypeChange ,
                onClick:()=>{changeType('layout')}
            },
            {
                name:'DownloadPageUser',
                toggle: type == 'user',
                visible: (type == 'user'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadUser,false),
                onClick:()=>{changeType('user')}
            },
            {
                name:'DownloadPageImages',
                toggle: type == 'images',
                visible: type == ('images'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadImages,false),
                onClick:()=>{changeType('images')}
            },
            {
                name:'DownloadPageUpload',
                visible: type == 'route' || type == 'layout'
                    || (type =='chart' && globalStore.getData(keys.gui.capabilities.uploadCharts,false))
                    || (type == 'user' && globalStore.getData(keys.gui.capabilities.uploadUser,false))
                    || (type == 'images' && globalStore.getData(keys.gui.capabilities.uploadImages,false)),
                onClick:()=>{
                    if ((type == 'layout' || type == 'route')  && avnav.android){
                        let nextId=globalStore.getData(keys.gui.downloadpage.requestedUploadId,0)+1;
                        globalStore.storeData(keys.gui.downloadpage.requestedUploadId,nextId);
                        avnav.android.requestFile(type,nextId);
                        return;
                    }
                    globalStore.storeMultiple({key:(new Date()).getTime(),enable:true},{
                        key: keys.gui.downloadpage.fileInputKey,
                        enable: keys.gui.downloadpage.enableUpload
                    });
                }
            },
            GuiHelpers.mobDefinition,
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
                                    if (data == 'view'){
                                        history.push('viewpage',{type:item.type,name:item.name,readOnly:true});
                                    }
                                    if (data == 'edit'){
                                        history.push('viewpage',{type:item.type,name:item.name});
                                    }
                                    if (self.props.options && self.props.options.selectItemCallback){
                                        return self.props.options.selectItemCallback(item);
                                    }
                                }}
                            />
                            <DynamicForm/>
                            <DynamicUploadForm
                                storeKeys={{
                                    fileInputKey: keys.gui.downloadpage.fileInputKey,
                                    enableUpload: keys.gui.downloadpage.enableUpload
                                }}
                                startUpload={runUpload}
                            />
                            <UploadIndicator/>
                            </React.Fragment>
                        }
                storeKeys={{
                    type:keys.gui.downloadpage.type,
                    reloadSequence:keys.gui.global.reloadSequence
                }}
                updateFunction={(state)=>{
                    let rt={};
                    rt.title=headlines[state.type];
                    rt.buttonList=self.getButtons(state.type);
                    rt.type=state.type;
                    //as we will only be called if the type really changes - we can fill the display...
                    addItems([],true);
                    fillData();
                    return rt;
                }}
                />
        );
    }
}

module.exports=DownloadPage;