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
import ViewPage from './ViewPage.jsx';
import {Input,InputSelect,InputReadOnly} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import DialogContainer from '../components/OverlayDialogDisplay.jsx';

const MAXUPLOADSIZE=100000;
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

const findAddon=(item)=>{
    if (item.type !== 'user') return;
    let addons=globalStore.getData(keys.gui.downloadpage.addOns);
    if (! addons || !(addons instanceof Array)) return;
    for (let i in addons){
        let addon=addons[i];
        if (addon.key == item.name){
            return addon;
        }
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
            let addon=findAddon(fi);
            if (addon){
                fi.isAddon=true;
            }
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

const getExt=(name)=>{
    return name.replace(/.*\./,'').toLocaleLowerCase();
};
const allowedItemActions=(props)=>{
    let ext=getExt(props.name);
    let showView=(props.type == 'user' || props.type=='images' || props.type == 'route' || props.type == 'track') && ViewPage.VIEWABLES.indexOf(ext)>=0;
    let showEdit=(props.type == 'user' && props.size !== undefined && props.size < ViewPage.MAXEDITSIZE && ViewPage.EDITABLES.indexOf(ext) >=0);
    let showDownload=false;
    if (props.type === "track"
        || props.type === "route"
        || props.type == 'layout'
        || props.type == 'user'
        || props.type == 'images'
        || (props.url && props.url.match("^/gemf") && ! avnav.android) ) {
        showDownload=true;
    }
    let showDelete=!props.active;
    if (props.canDelete !== undefined){
        showDelete=props.canDelete && ! props.active;
    }
    let showRename=(props.type == 'user' || props.type == 'images');
    let showApp=(props.type == 'user' && ext == 'html');
    let isApp=(props.type == 'user' && ext == 'html' && props.isAddon);
    return {
        showEdit:showEdit,
        showView:showView,
        showDownload:showDownload,
        showDelete:showDelete,
        showRename:showRename,
        showApp:showApp,
        isApp:isApp
    };
};

const readAddOns = function () {
    if (globalStore.getData(keys.gui.global.onAndroid, false)) return;
    if (!globalStore.getData(keys.gui.capabilities.addons)) return;
    Requests.getJson("?request=list&type=addon").then((json)=>{
            let items = [];
            for (let e in json.items) {
                let button = json.items[e];
                let entry = {
                    key: button.key,
                    url: button.url,
                    icon: button.icon,
                    title: button.title
                };
                if (entry.key) {
                    items.push(entry);
                }
            }
            globalStore.storeData(keys.gui.downloadpage.addOns, items);
            fillData();
        },
        (error)=>{
            Toast("reading addons failed: " + error);
        });
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
    let {showView,showEdit,showDownload,showDelete,showApp,isApp}=allowedItemActions(props);
    let  cls="listEntry";
    if (props.active){
        cls+=" activeEntry";
    }
    let dataClass="downloadItemData";
    if (!(showDelete && ! props.active)) dataClass+=" noDelete";
    return(
        <div className={cls} onClick={function(ev){
            props.onClick('select')
        }}>
            {(showDelete && ! props.active) &&<Button className="Delete smallButton" onClick={(ev)=>{
                ev.preventDefault();
                ev.stopPropagation();
                props.onClick('delete');
            }}/>}
            <div className="itemMain">
                <div className={dataClass}>
                    <div className="date">{dp.timeText}</div>
                    <div className="info">{dp.infoText}</div>
                </div>
                <div className="infoImages">
                    { showView && <div className="viewimage"></div>}
                    { showEdit && <div className="editimage"></div>}
                    {showRas && <div className="listrasimage"></div>}
                    {isApp && <div className="appimage"></div>}
                </div>
            </div>
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
    let ok = OverlayDialog.confirm("delete " + info.name + "?");
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
            Toast("upload failed: " + err);
            setTimeout(function(){
                fillData();
            },1500);
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

class UserAppDialog extends React.Component{
    constructor(props){
        super(props);
        this.state=props.addon||{};
        this.state.userFile=props.current.name;
        if (! this.state.name) this.state.name=props.current.name;
        this.state.dialog=undefined;
        this.state.iconList=[];
        this.showDialog=this.showDialog.bind(this);
        this.fillIconList();

    }
    fillIconList(){
        let self=this;
        Requests.getJson("?request=list&type=user")
            .then((data)=>{
                let itemList=[];
                if (data.items){
                    data.items.forEach((el)=>{
                        if (ViewPage.IMAGES.indexOf(getExt(el.name)) >= 1){
                            el.label=el.name;
                            itemList.push(el);
                        }
                    });
                    self.setState({iconList:self.state.iconList.concat(itemList)});
                }
            }).catch((error)=>{});
        Requests.getJson("?request=list&type=images")
            .then((data)=>{
                let itemList=[];
                if (data.items) {
                    data.items.forEach((el)=> {
                        if (ViewPage.IMAGES.indexOf(getExt(el.name)) >= 1) {
                            el.label=el.name;
                            itemList.push(el);
                        }
                    });
                    self.setState({iconList: self.state.iconList.concat(itemList)});
                }
            })
            .catch((error)=>{})
    }
    showDialog(Dialog){
        let self=this;
        this.setState({
            dialog: (props)=>{
                return(
                    <Dialog
                        {...props}
                        closeCallback={()=>self.setState({dialog:undefined})}
                        />
                )
            }
        });
    }

    render(){
        let self=this;
        let Dialog=this.state.dialog;
        return(
        <React.Fragment>
        <div className="userAppDialog">
            <h3 className="dialogTitle">{this.props.current.isAddon?'Modify User App':'Create User App'}</h3>
            <div className="dialogRow">
                <InputReadOnly
                    label="fileName"
                    value={this.props.current.name}/>
            </div>
            <div className="dialogRow">
                <Input
                    label="title"
                    value={this.state.title}
                    onChange={(value)=>{self.setState({title:value})}}
                    />
            </div>
            <div className="dialogRow">
                <InputSelect
                    label="icon"
                    value={this.state.iconFile}
                    list={this.state.iconList}
                    showDialogFunction={this.showDialog}
                    onChange={(selected)=>{this.setState({
                        iconFile:selected.name,
                        iconType:selected.type,
                        icon:selected.url
                    })}}
                    />
                {this.state.icon && <img className="appIcon" src={this.state.icon}/>}
            </div>
            <div className="dialogButtons dialogLine">
                <DB name="ok" onClick={()=>{
                    this.props.closeCallback();
                    this.props.okFunction(this.state)
                    }}
                    disabled={!this.state.icon}
                >Ok</DB>
                <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                {this.props.current.isAddon && <DB name="delete" onClick={()=>{
                        this.props.closeCallback();
                        this.props.removeFunction(this.state);
                    }}>Delete</DB>}
            </div>
        </div>
            {Dialog?
                <DialogContainer
                    className="nested"
                    content={Dialog}
                    onClick={()=>{this.setState({dialog:undefined})}}
                    />:
                null}
        </React.Fragment>
        );
    }
}

const showUserAppDialog=(item)=>{
    OverlayDialog.dialog((props)=>{
        return(
            <UserAppDialog
                {...props}
                okFunction={(addon)=>{
                   Requests.getJson("?request=api&type=addon&command=update",{},{
                      userFile:addon.userFile,
                      iconType:addon.iconType,
                      title: addon.title,
                      iconFile:addon.iconFile,
                      name:addon.name
                   })
                   .then((data)=>{
                        readAddOns();
                   })
                   .catch((error)=>{
                    Toast("unable to create app entry: "+error);
                    readAddOns();
                    })
                }}
                removeFunction={(addon)=>{
                    Requests.getJson("?request=api&type=addon&command=delete",{},{
                      name:addon.name
                   })
                   .then((data)=>{
                        readAddOns();
                   })
                   .catch((error)=>{
                   Toast("unable to delete app entry: "+error);
                   readAddOns();
                   })
                }}
                addon={findAddon(item)}
                current={item}
                />
        )
    })
};

class FileDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            changed:false,
            existingName:false,
            name:props.current.name,
            allowed:allowedItemActions(props.current)
        };
        this.onChange=this.onChange.bind(this);
    }
    onChange(newName){
        if (newName == this.state.name) return;
        if (newName == this.props.current.name){
            this.setState({
                changed:false,
                existingName:false,
                name:newName
            });
            return;
        }
        let newState={name:newName,changed:true};
        if (this.props.checkName){
            newState.existingName=this.props.checkName(newName);
        }
        this.setState(newState)
    }
    render(){
        let self=this;
        let cn=this.state.existingName?"existing":"";
        let rename=this.state.changed && ! this.state.existingName;
        let Dialog=this.state.dialog;
        return(
            <React.Fragment>
            <div className="fileDialog flexInner">
                <h3 className="dialogTitle">{this.props.current.name}</h3>
                {this.state.allowed.showRename ?
                    <div className="dialogLine">
                        <Input
                            label={this.state.existingName?"existing":"new name"}
                            className={cn}
                            value={this.state.name}
                            onChange={this.onChange}
                            />
                    </div>
                    : null
                }
                <div className="dialogButtons dialogLine">
                    {this.state.allowed.showRename ?
                        <DB name="rename"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('rename',this.props.current.name,this.state.name);
                                }}
                                disabled={!rename}
                            >
                            Rename
                        </DB>
                        :
                        null
                    }
                    {this.state.allowed.showDelete?
                        <DB name="delete"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('delete',this.props.current.name);
                                }}
                                disabled={this.state.changed}
                            >
                            Delete
                        </DB>
                        :
                        null
                    }
                </div>
                <div className="dialogButtons dialogLine">
                    <DB name="cancel"
                            onClick={self.props.closeCallback}FileDia
                        >
                        Cancel
                    </DB>
                    {(this.state.allowed.showView )?
                        <DB name="view"
                                onClick={()=>{
                                    self.props.closeCallback();app
                                    self.props.okFunction('view',this.props.current.name);
                                }}
                                disabled={this.state.changed}
                            >
                            View
                        </DB>
                        :
                        null}
                    {(this.state.allowed.showEdit)?
                        <DB name="edit"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('edit',this.props.current.name);
                                }}
                                disabled={this.state.changed}
                            >
                            Edit
                        </DB>
                        :
                        null
                    }
                    {(this.state.allowed.showDownload) ?
                        <DB name="download"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('download',this.props.current.name);
                                }}
                                disabled={this.state.changed}
                            >
                            Download
                        </DB>
                        :
                        null
                    }
                    {(this.state.allowed.showApp) &&
                    <DB name="userApp"
                        onClick={()=>{
                                    this.props.closeCallback();
                                    showUserAppDialog(this.props.current);
                                }}
                        disabled={this.state.changed}
                        >
                        App
                    </DB>

                    }
                </div>
            </div>
                {Dialog?
                    <DialogContainer
                        className="nested"
                        content={Dialog}
                        onClick={()=>{this.setState({dialog:undefined})}}
                        />:
                    null}
            </React.Fragment>
        );
    }
}

const showFileDialog=(item)=>{
    let rename=(oldName,newName)=>{
        Requests.getJson('?request=api&type='+encodeURIComponent(item.type)+
            "&command=rename&name="+encodeURIComponent(oldName)+
            "&newName="+encodeURIComponent(newName))
            .then(()=>{})
            .catch((error)=>{Toast("rename failed: "+error)});
    };
    let actionFunction=(action,name,opt_new)=>{
        if (action == 'rename'){
            Requests.getJson('?request=api&type='+encodeURIComponent(item.type)+
                "&command=rename&name="+encodeURIComponent(name)+
                "&newName="+encodeURIComponent(opt_new))
                .then(()=>{ fillData();})
                .catch((error)=>{
                    Toast("rename failed: "+error);
                    fillData();
                });
            return;
        }
        if (action == 'view'){
            history.push('viewpage',{type:item.type,name:name,readOnly:true});
            return;
        }
        if (action == 'edit'){
            history.push('viewpage',{type:item.type,name:name});
            return;
        }
        if (action == 'download'){
            return download(item);
        }
        if (action == 'delete'){
            return deleteItem(item);
        }
    };
    let {showView,showEdit}=allowedItemActions(item);
    OverlayDialog.dialog((props)=>{
       return(
           <FileDialog
               {...props}
               okFunction={actionFunction}
               current={item}
               checkName={entryExists}
               />
       );
    });
};

const createItem=(type)=>{
    OverlayDialog.valueDialogPromise('enter filename','')
        .then((name)=>{
            if (entryExists(name)) {
                Toast("already exists");
                return;
            }
            let data="";
            Requests.postJson("?request=upload&type=" + type + "&filename=" + encodeURIComponent(name), data)
                .then((res)=>{fillData();})
                .catch((error)=>{
                    Toast("creation failed: "+error);
                    fillData();
                });
        })
        .catch(()=>{})
};

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
        readAddOns();
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
                visible: (type == 'images'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadImages,false),
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
                storeKeys={{
                    type:keys.gui.downloadpage.type,
                    reloadSequence:keys.gui.global.reloadSequence
                }}
                updateFunction={(state)=>{
                    let rt={};
                    rt.title=headlines[state.type];
                    rt.buttonList=self.getButtons(state.type);
                    rt.type=state.type;
                    rt.mainContent=(
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
                                            if (self.props.options && self.props.options.selectItemCallback){
                                                return self.props.options.selectItemCallback(item);
                                            }
                                            showFileDialog(item);
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
                            {(rt.type == "user")?
                                <Button
                                    className="fab"
                                    name="DownloadPageCreate"
                                    onClick={()=>{
                                                createItem(rt.type);
                                            }}
                                    />
                                :
                                null}
                        </React.Fragment>);

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