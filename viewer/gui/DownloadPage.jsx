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
import LayoutHandler from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import LayoutNameDialog from '../components/LayoutNameDialog.jsx';
import {Input,InputReadOnly,Checkbox} from '../components/Inputs.jsx';
import DB from '../components/DialogButton.jsx';
import Addons from '../components/Addons.js';
import GuiHelpers from '../util/GuiHelpers.js';
import UploadHandler  from "../components/UploadHandler";
import chartImage from '../images/Chart60.png';
import {
    showFileDialog,
    deleteItem,
    allowedItemActions,
    ItemDownloadButton
} from '../components/FileDialog';
import EditOverlaysDialog, {DEFAULT_OVERLAY_CHARTENTRY} from '../components/EditOverlaysDialog';
import {getOverlayConfigName} from "../map/chartsourcebase";

const RouteHandler=NavHandler.getRoutingHandler();

const headlines={
    track: "Tracks",
    chart: "Charts",
    route: "Routes",
    layout:"Layouts",
    user: "User",
    images: "Images",
    overlay: "Overlays"
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
            list.push(assign({},DEFAULT_OVERLAY_CHARTENTRY));
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
    RouteHandler.listRoutes(true)
        .then((items)=>{
            addItems(items,true);
        }).catch((error)=>{
            Toast(error);
    });
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
    dp.timeText=Formatter.formatDateTime(new Date(props.time*1000));
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
            {(props.icon || props.type === 'chart') &&
            <span className="icon" style={{backgroundImage:"url('"+(props.icon||chartImage)+"')"}}/>
            }
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
    if (entryExists(route.name) || entryExists(route.name+".gpx")) {
        Toast("route with name " + route.name + " already exists");
        return false;
    }
    if (globalStore.getData(keys.properties.connectedMode, false)) route.server = true;
    RouteHandler.saveRoute(route)
        .then(()=> {
            fillData();
            return true;})
        .catch((error)=>Toast(error));
};


const userlayoutExists=(name)=>{
    let itemName=LayoutHandler.fileNameToServerName(name);
    return entryExists(itemName);
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
                        <DB name="cancel"
                            onClick={()=>{
                                this.props.cancelFunction();
                                this.props.closeCallback();
                            }}
                        >Cancel</DB>
                        <DB name="ok"
                            onClick={()=>{
                                this.props.okFunction(this.props,this.state.useSubdir?this.state.subdir:undefined);
                                this.props.closeCallback();
                            }}
                            disabled={this.state.useSubdir && !this.state.subdir}
                            >OK</DB>
                    </div>
                </div>
             </React.Fragment>
        );
    }
}


const entryExists=(name)=>{
    let current=globalStore.getData(keys.gui.downloadpage.currentItems,[]);
    return findInfo(current,{name:name})>=0;
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
        this.checkNameForUpload=this.checkNameForUpload.bind(this);
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
                toggle: type == 'overlay',
                visible: (type == 'overlay'|| allowTypeChange) && globalStore.getData(keys.gui.capabilities.uploadOverlays,false),
                onClick:()=>{changeType('overlay')},
                overflow: true
            },
            {
                name:'DownloadPageUpload',
                visible: (type === 'route' || type === 'layout'
                    || (type ==='chart' && globalStore.getData(keys.gui.capabilities.uploadCharts,false))
                    || (type === 'user' && globalStore.getData(keys.gui.capabilities.uploadUser,false))
                    || (type === 'images' && globalStore.getData(keys.gui.capabilities.uploadImages,false))
                    || (type === 'overlay' && globalStore.getData(keys.gui.capabilities.uploadOverlays,false))
                    || (type === 'track' && globalStore.getData(keys.gui.capabilities.uploadTracks,false))) &&
                    globalStore.getData(keys.properties.connectedMode,true),
                onClick:()=>{
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

    /**
     * will be called once the user has selected a file
     * the returned promise should resolve to an object with:
     *   name: the new (potentially changed) name
     *   type: if set, use this type for the upload instead of the original type
     *   uploadParameters: an object containing parameters that will be added tp the upload url
     * @param name
     * @returns {ThenPromise<unknown>}
     */
    checkNameForUpload(name){
        return new Promise((resolve,reject)=>{
            let ext=Helper.getExt(name);
            let rt={name:name};
            if (this.state.type === 'route'){
                if (ext !== "gpx") {
                    reject("only gpx for routes");
                    return;
                }
            }
            if (this.state.type === 'track'){
                if (ext !== "gpx") {
                    reject("only gpx for tracks");
                    return;
                }
            }
            if (this.state.type === 'images'){
                if (GuiHelpers.IMAGES.indexOf(ext) < 0){
                    reject("only images of types "+GuiHelpers.IMAGES.join(","));
                    return;
                }
            }
            if (this.state.type === 'layout'){
                if (userlayoutExists(name)) {
                    let baseName=LayoutHandler.nameToBaseName(name);
                    LayoutNameDialog.createDialog(baseName,userlayoutExists,"Layout exists, select new name")
                        .then((newName)=>{
                            resolve({name:newName});
                        })
                        .catch((error)=>{reject(error)})
                }
                else{
                    resolve(rt);
                }
                return;
            }
            if (this.state.type === 'chart'){
                let directExtensions=['gemf','mbtiles','xml'];
                if (directExtensions.indexOf(ext) < 0) {
                    //check for import
                    let importExtensions=globalStore.getData(keys.gui.downloadpage.chartImportExtensions,[]);
                    if (importExtensions.indexOf(ext)>=0 && ! avnav.android) {
                        OverlayDialog.dialog((props)=>{
                            return(
                                <ImportDialog
                                    {...props}
                                    okFunction={(props,subdir)=>{
                                        globalStore.storeData(keys.gui.downloadpage.chartImportSubDir,subdir);
                                        resolve({name:name,type:'import',uploadParameters:{subdir:subdir}});
                                    }}
                                    cancelFunction={()=>reject("canceled")}
                                    name={name}
                                    subdir={globalStore.getData(keys.gui.downloadpage.chartImportSubDir)}
                                />
                            );
                        });
                        return;
                    }
                    else{
                        reject("unknown chart type \""+ext+'"');
                        return;
                    }
                }
                //fallthrough to check existing...
            }
            if (entryExists(name)){
                reject("already exists");
            }
            else{
                resolve(rt);
            }
        })
    }

    /**
     * return a function that will receive the result of a local upload
     * as an object with name and data
     * @returns {function(*): void}
     *          if no function is returned, the upload will go to the server
     */
    getLocalUploadFunction(){
        if (this.state.type === 'route'){
            return (obj)=>{
                if (!obj) {
                    Toast("no data available after upload");
                    return;
                }
                uploadRouteData(obj.name,obj.data);
                fillData();
            }
        }
        if (this.state.type === 'layout'){
            return (obj)=>{
                if (!obj) {
                    Toast("no data available after upload");
                    return;
                }
                LayoutHandler.uploadLayout(obj.name, obj.data, true)
                    .then(
                        (result)=> {
                            fillData();
                        }
                    ).catch(
                    (error)=> {
                        Toast("unable to upload layout: " + error);
                    }
                )
            }
        }
    }
    render(){
        let self=this;
        let localDoneFunction=this.getLocalUploadFunction();
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
                                if (item.type === 'chart' && getOverlayConfigName(item) === getOverlayConfigName(DEFAULT_OVERLAY_CHARTENTRY)){
                                    EditOverlaysDialog.createDialog(item,()=>fillData());
                                    return;
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
                            local={localDoneFunction||false}
                            type={this.state.type}
                            doneCallback={localDoneFunction?localDoneFunction:fillData}
                            errorCallback={(err)=>{if (err) Toast(err);fillData();}}
                            uploadSequence={this.state.uploadSequence}
                            checkNameCallback={this.checkNameForUpload}
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