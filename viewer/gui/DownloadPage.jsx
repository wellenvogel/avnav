/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Button from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import history from '../util/history.js';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import routeobjects from '../nav/routeobjects.js';
import Formatter from '../util/formatter.js';
import OverlayDialog, {stateHelper} from '../components/OverlayDialog.jsx';
import Helper from '../util/helper.js';
import Promise from 'promise';
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutNameDialog from '../components/LayoutNameDialog.jsx';
import {Input,InputReadOnly,Checkbox} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import AndroidEventHandler from '../util/androidEventHandler.js';
import Addons from '../components/Addons.js';
import GuiHelpers from '../util/GuiHelpers.js';
import UploadHandler, {UploadForm} from "../components/UploadHandler";
import {
    showFileDialog,
    deleteItem,
    allowedItemActions,
    getDownloadUrl,
    ItemDownloadButton
} from '../components/FileDialog';
import {DEFAULT_OVERLAY_CONFIG} from '../components/EditOverlaysDialog';
import DownloadButton from '../components/DownloadButton';

const MAXUPLOADSIZE=100000;
const RouteHandler=NavHandler.getRoutingHandler();

const headlines={
    track: "Tracks",
    chart: "Charts",
    route: "Routes",
    layout:"Layouts",
    user: "User",
    images: "Images",
    overlays: "Overlays"
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
}

const findAddon=(item)=>{
    if (item.type !== 'user') return;
    let addons=globalStore.getData(keys.gui.downloadpage.addOns);
    return Addons.findAddonByUrl(addons,item.url);
};

const fillDataServer=(type)=>{
    Requests.getJson("?request=listdir&type="+type).then((json)=>{
        let list=[];
        if (type === 'chart'){
            list.push({
                type: type,
                name: 'DefaultOverlays',
                chartKey: DEFAULT_OVERLAY_CONFIG,
                canDelete: false,
                canDownload:false,
                time: (new Date()).getTime()/1000
            });
        }
        for (let i=0;i<json.items.length;i++){
            let fi=new FileInfo();
            assign(fi,json.items[i]);
            if (fi.name === undefined) continue;
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
        if (list[k].name === item.name) return k;
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



const readAddOns = function () {
    Addons.readAddOns(true)
        .then((items)=>{
            globalStore.storeData(keys.gui.downloadpage.addOns, items);
            fillData();
        })
        .catch(()=>{});
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
    let {showView,showEdit,showDelete,showApp,isApp}=allowedItemActions(props);
    let  cls="listEntry";
    if (props.active){
        cls+=" activeEntry";
    }
    if (props.type == "chart" && props.originalScheme){
        cls+=" userAction";
    }
    let dataClass="downloadItemData";
    if (!(showDelete && ! props.active)) dataClass+=" noDelete";
    return(
        <div className={cls} onClick={function(ev){
            props.onClick('select')
        }}>
            {(showDelete && ! props.active) &&<Button name="Delete" className="Delete smallButton" onClick={(ev)=>{
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
            <ItemDownloadButton
                name="Download"
                className="Download smallButton"
                item={props}
            />
        </div>
    );
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
        LayoutNameDialog.createDialog(baseName,userlayoutExists,"Layout exists, select new name")
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

class ImportDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            subdir:props.subdir,
            useSubdir:props.subdir?true:false
        };
    }
    render(){
        return (
            <React.Fragment>
                <div className="importDialog flexInner">
                    <h3 className="dialogTitle">Upload Chart to Importer</h3>
                    <InputReadOnly
                        dialogRow={true}
                        label="name"
                        value={this.props.name}
                        />
                    <Checkbox
                        dialogRow={true}
                        label="use set name"
                        value={this.state.useSubdir}
                        onChange={(nv)=>this.setState({useSubdir:nv})}
                        />
                    {this.state.useSubdir?<Input
                        dialogRow={true}
                        label="set name"
                        value={this.state.subdir}
                        onChange={(nv)=>{this.setState({subdir:nv})}}
                        />
                        :
                        null}

                    <div className="dialogButtons">
                        <DB name="ok"
                            onClick={()=>{
                                this.props.okFunction(this.props,this.state.useSubdir?this.state.subdir:undefined);
                                this.props.closeCallback();
                            }}
                            disabled={this.state.useSubdir && !this.state.subdir}
                            >OK</DB>
                        <DB name="cancel"
                            onClick={()=>{
                                this.props.cancelFunction();
                                this.props.closeCallback();
                                }}
                            >Cancel</DB>
                    </div>
                </div>
             </React.Fragment>
        );
    }
}

const startImportDialog=(file)=>{
    const okFunction=(props,subdir)=>{
        globalStore.storeData(keys.gui.downloadpage.chartImportSubDir,subdir);
        resetUpload();
        directUpload('import',file,{subdir:subdir});
    };
    OverlayDialog.dialog((props)=>{
        return(
            <ImportDialog
                {...props}
                okFunction={okFunction}
                cancelFunction={resetUpload}
                name={file.name}
                subdir={globalStore.getData(keys.gui.downloadpage.chartImportSubDir)}
                />
        );
    });
};
const runUpload=(ev)=>{
    let type=globalStore.getData(keys.gui.downloadpage.type);
    if (! type) return;
    if (type == 'chart'){
        let directExtensions=['gemf','mbtiles','xml'];
        let fileObject=ev.target;
        if (fileObject.files && fileObject.files.length > 0) {
            let file = fileObject.files[0];
            let ext = Helper.getExt(file.name);
            if (directExtensions.indexOf(ext) >= 0) {
                return uploadGeneric(type, ev.target);
            }
            else{
                let importExtensions=globalStore.getData(keys.gui.downloadpage.chartImportExtensions,[]);
                if (importExtensions.indexOf(ext)>=0) {
                    return startImportDialog(file);
                }
            }
            Toast("only files of types: "+directExtensions.join(","));
        }
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
    if (type == 'user' || type == 'overlays'){
        return uploadGeneric(type,ev.target);
    }
    if (type == 'images'){
        return uploadGeneric(type,ev.target,GuiHelpers.IMAGES);
    }
    resetUpload();
};

const entryExists=(name)=>{
    let current=globalStore.getData(keys.gui.downloadpage.currentItems,[]);
    return findInfo(current,{name:name})>=0;
};

const uploadGeneric=(type,fileObject,opt_restrictedExtensions)=>{
    if (fileObject.files && fileObject.files.length > 0) {
        let file = fileObject.files[0];
        if (opt_restrictedExtensions){
            let ext=Helper.getExt(file.name);
            if (opt_restrictedExtensions.indexOf(ext) < 0){
                Toast("only files of types: "+opt_restrictedExtensions.join(","));
                resetUpload();
                return;
            }
        }
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


const directUpload=(type,file,opt_options)=>{
    let url=globalStore.getData(keys.properties.navUrl)+ "?request=upload&type="+type+"&name=" + encodeURIComponent(file.name);
    if (opt_options){
        for (let k in opt_options){
            url+="&"+k+"="+encodeURIComponent(opt_options[k]);
        }
    }
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







const createItem=(type)=>{
    OverlayDialog.valueDialogPromise('enter filename','')
        .then((name)=>{
            if (entryExists(name)) {
                Toast("already exists");
                return;
            }
            let data="";
            Requests.postPlain("?request=upload&type=" + type + "&name=" + encodeURIComponent(name), data)
                .then((res)=>{fillData();})
                .catch((error)=>{
                    Toast("creation failed: "+error);
                    fillData();
                });
        })
        .catch(()=>{})
};

const readImportExtensions=()=>{
    if (!globalStore.getData(keys.gui.capabilities.uploadImport)) return;
    Requests.getJson("?request=api",undefined,{type:'import',command:'extensions'})
        .then((data)=>{globalStore.storeData(keys.gui.downloadpage.chartImportExtensions,data.items)})
        .catch();
};

class DownloadPage extends React.Component{
    constructor(props){
        super(props);
        this.getButtons=this.getButtons.bind(this);
        let type='chart';
        if (props.options && props.options.downloadtype){
            type=props.options.downloadtype;
        }
        if (globalStore.getData(keys.gui.downloadpage.type) === undefined || ! (props.options && props.options.returning)) {
            globalStore.storeData(keys.gui.downloadpage.type, type);
        }
        this.state={
            uploadSequence:0
        };
        GuiHelpers.storeHelperState(this,{type:keys.gui.downloadpage.type});
        globalStore.storeData(keys.gui.downloadpage.downloadParameters,{});
        globalStore.storeData(keys.gui.downloadpage.enableUpload,false);
        globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
        readAddOns();
        fillData();
        readImportExtensions();
        this.androidSubscriptions=[];
        this.androidUploadHandler=this.androidUploadHandler.bind(this);
        this.androidCopyHandler=this.androidCopyHandler.bind(this);
        this.androidProgressHandler=this.androidProgressHandler.bind(this);
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("uploadAvailable",this.androidUploadHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyReady",this.androidCopyHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyPercent",this.androidProgressHandler));
        this.androidSubscriptions.push(AndroidEventHandler.subscribe("fileCopyDone",this.androidProgressHandler));
    }
    androidUploadHandler(eventData){
        if (!avnav.android) return;
        let {id}=eventData;
        let requestedId=globalStore.getData(keys.gui.downloadpage.requestedUploadId);
        if (id != requestedId) return;
        //lets go back to the main thread as we had been called from android...
        window.setTimeout(()=> {
            let type = globalStore.getData(keys.gui.downloadpage.type);
            let filename = avnav.android.getFileName(id);
            if (!filename) return;
            let data=avnav.android.getFileData(id);
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
    }

    /**
     * called from android when the file selection is ready
     * we now have to start the copy - showing the upload progress
     * @param eventData
     */
    androidCopyHandler(eventData){
        if (!avnav.android) return;
        let requestedId=globalStore.getData(keys.gui.downloadpage.requestedUploadId);
        let {id}=eventData;
        if (id != requestedId) return;
        let type=globalStore.getData(keys.gui.downloadpage.type);
        let fileName=avnav.android.getFileName(id);
        if (entryExists(fileName)){
            Toast("file "+fileName+" already exists");
            return;
        }
        if (type == 'images'){
            if (GuiHelpers.IMAGES.indexOf(Helper.getExt(fileName)) < 0){
                Toast("only files of types: "+GuiHelpers.IMAGES.join(","));
                return;
            }
        }
        if (type == 'chart'){
            if (['gemf','mbtiles','xml'].indexOf(Helper.getExt(fileName))<0){
                Toast("only gemf or mbtiles files allowed");
                return;
            }
        }
        let copyInfo={
            xhdr:{
                abort:()=>{
                    avnav.android.interruptCopy(id);
                }
            },
            total:avnav.android.getFileSize(id),
            loaded:0,
            loadedPercent:true
        };
        globalStore.storeData(keys.gui.downloadpage.uploadInfo,copyInfo);
        if (avnav.android.copyFile(id)) {
            //we update the file size as with copyFile it is fetched again
            globalStore.storeData(keys.gui.downloadpage.uploadInfo, assign({}, copyInfo, {total: avnav.android.getFileSize(id)}));
        }
        else{
            Toast("unable to upload");
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
        }

    }
    androidProgressHandler(eventData){
        let {event,id}=eventData;
        if (event == "fileCopyPercent"){
            let old=globalStore.getData(keys.gui.downloadpage.uploadInfo);
            if (!old.total) return; //no upload...
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,
                assign({},old,{
                    loaded: id
                }));
        }
        else{
            //done, error already reported from java side
            globalStore.storeData(keys.gui.downloadpage.uploadInfo,{});
            setTimeout(function(){
                fillData();
            },1500);
        }
    }



    componentWillUnmount(){
        this.androidSubscriptions.forEach((token)=> {
            AndroidEventHandler.unsubscribe(token);
        });
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
                onClick:()=>{changeType('user')},
                overflow:true
            },
            {
                name:'DownloadPageImages',
                toggle: type == 'images',
                visible: (type == 'images'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadImages,false),
                onClick:()=>{changeType('images')},
                overflow: true
            },
            {
                name:'DownloadPageOverlays',
                toggle: type == 'overlays',
                visible: (type == 'overlays'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadOverlays,false),
                onClick:()=>{changeType('overlays')},
                overflow: true
            },
            {
                name:'DownloadPageUpload',
                visible: (type == 'route' || type == 'layout'
                    || (type =='chart' && globalStore.getData(keys.gui.capabilities.uploadCharts,false))
                    || (type == 'user' && globalStore.getData(keys.gui.capabilities.uploadUser,false))
                    || (type == 'images' && globalStore.getData(keys.gui.capabilities.uploadImages,false))
                    || (type == 'overlays' && globalStore.getData(keys.gui.capabilities.uploadOverlays,false))) &&
                    globalStore.getData(keys.properties.connectedMode,true),
                onClick:()=>{
                    if (avnav.android){
                        let nextId=globalStore.getData(keys.gui.downloadpage.requestedUploadId,0)+1;
                        globalStore.storeData(keys.gui.downloadpage.requestedUploadId,nextId);
                        avnav.android.requestFile(type,nextId,(type == 'layout' || type == 'route'));
                        return;
                    }
                    this.setState({uploadSequence:this.state.uploadSequence+1});
                }
            },
            Mob.mobDefinition,
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
                mainContent={<React.Fragment>
                        <DynamicList
                            itemClass={DownloadItem}
                            scrollable={true}
                            storeKeys={{
                                itemList:keys.gui.downloadpage.currentItems,
                                type:keys.gui.downloadpage.type
                            }}
                            onItemClick={(item,data)=>{
                                console.log("click on "+item.name+" type="+data);
                                if (data === 'delete'){
                                    return deleteItem(item,fillData);
                                }
                                if (data === 'download'){
                                    return this.download(item);
                                }
                                if (self.props.options && self.props.options.selectItemCallback){
                                    return self.props.options.selectItemCallback(item);
                                }
                                showFileDialog(item,
                                    (action,item)=>{
                                        if (action === 'userapp') readAddOns()
                                        else fillData();
                                    },
                                    (newName)=>{
                                        //checkExisting
                                        return entryExists(newName);
                                    });
                            }}
                        />
                        <UploadHandler
                            type={this.state.type}
                            doneCallback={fillData}
                            errorCallback={fillData}
                            uploadSequence={this.state.uploadSequence}
                        />
                        {(this.state.type === "user")?
                            <Button
                                className="fab"
                                name="DownloadPageCreate"
                                onClick={()=>{
                                    createItem("user");
                                }}
                            />
                            :
                            null}
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

export default DownloadPage;