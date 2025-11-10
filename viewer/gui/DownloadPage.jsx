/**
 * Created by andreas on 02.05.14.
 */

import Dynamic from '../hoc/Dynamic.jsx';
import Button, {DynamicButton} from '../components/Button.jsx';
import ItemList from '../components/ItemList.jsx';
import globalStore from '../util/globalstore.jsx';
import keys from '../util/keys.jsx';
import React from 'react';
import Page from '../components/Page.jsx';
import Toast from '../components/Toast.jsx';
import Requests from '../util/requests.js';
import assign from 'object-assign';
import NavHandler from '../nav/navdata.js';
import {showDialog, showPromiseDialog} from '../components/OverlayDialog.jsx';
import Helper, {avitem, setav} from '../util/helper.js';
import {layoutLoader} from '../util/layouthandler.js';
import Mob from '../components/Mob.js';
import Addons from '../components/Addons.js';
import GuiHelpers from '../util/GuiHelpers.js';
import UploadHandler  from "../components/UploadHandler";
import chartImage from '../images/Chart60.png';
import {
    deleteItem,
    ItemDownloadButton, ItemActions, FileDialogWithActions
} from '../components/FileDialog';
import EditOverlaysDialog, {DEFAULT_OVERLAY_CHARTENTRY} from '../components/EditOverlaysDialog';
import PropertyHandler from '../util/propertyhandler';
import ImportDialog, {checkExt, readImportExtensions} from "../components/ImportDialog";
import {checkName, ItemNameDialog, safeName} from "../components/ItemNameDialog";
import routeobjects from "../nav/routeobjects";
import {EditDialogWithSave, getTemplate} from "../components/EditDialog";
import {BlobReader, ZipReader} from "@zip.js/zip.js";
import {indexOf} from "core-js/internals/array-includes";
import {ConfirmDialog} from "../components/BasicDialogs";
import {DEFAULT_OVERLAY_CONFIG} from "../map/overlayconfig";

const RouteHandler=NavHandler.getRoutingHandler();

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


const fillDataServer=(type)=>{
    return Requests.getJson({
        request:'api',
        command:'list',
        type: type
    }).then((json)=>{
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
            if (! fi.icon && type === 'chart'){
                fi.icon=chartImage;
            }
            if (fi.canDelete === undefined) fi.canDelete=false;
            list.push(fi);
        }
        return(list);
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






const DownloadItem=(props)=>{

    let actions=ItemActions.create(props,globalStore.getData(keys.properties.connectedMode,false));
    let  cls="listEntry "+actions.className;
    let dataClass="downloadItemData";
    if (! actions.showDelete ) dataClass+=" noDelete";
    return(
        <div className={cls} onClick={function(ev){
            props.onClick(setav(ev,{action:'select'}));
        }}>
            {(props.icon) &&
            <span className="icon" style={{backgroundImage:"url('"+(props.icon)+"')"}}/>
            }
            {actions.showDelete &&<Button name="Delete" className="Delete smallButton" onClick={(ev)=>{
                ev.preventDefault();
                ev.stopPropagation();
                props.onClick(setav(ev,{action:'delete'}));
            }}/>}
            <div className="itemMain">
                <div className={dataClass}>
                    <div className="date">{actions.timeText}</div>
                    <div className="info">{actions.infoText}</div>
                </div>
                <div className="infoImages">
                    { actions.showView && <div className="viewimage"></div>}
                    { actions.showEdit && <div className="editimage"></div>}
                    { actions.showIsServer && <div className="listrasimage"></div>}
                    { actions.isApp && <div className="appimage"></div>}
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


class DownloadPage extends React.Component{
    constructor(props){
        super(props);
        this.getButtons=this.getButtons.bind(this);
        let type='chart';
        if (props.options && props.options.downloadtype){
            type=props.options.downloadtype;
        }
        this.state={
            uploadSequence:0,
            type:type,
            items:[],
            addOns:[],
            chartImportExtensions:[],
            importSubDir:''
        };
        this.checkNameForUpload=this.checkNameForUpload.bind(this);
        this.changeType=this.changeType.bind(this);
        this.entryExists=this.entryExists.bind(this);
        this.fillData=this.fillData.bind(this);
        this.readAddOns();
        this.fillData();
    }
    componentDidMount() {
        readImportExtensions()
            .then((extList)=>{this.setState({chartImportExtensions:extList})});
    }

    componentDidUpdate(prevProps, prevState, snapshot) {
        if (prevState.type !== this.state.type || prevProps.reloadSequence !== this.props.reloadSequence){
            this.fillData();
        }
    }

    readAddOns () {
        Addons.readAddOns(true)
            .then((items)=>{
                this.setState({addOns:items});
                this.fillData();
            })
            .catch(()=>{});
    };

    addItems(items,opt_empty){
        let current=opt_empty?[]:this.state.items||[];
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
        //keep plugins sorted as they arrive from the server
        //sort others by date
        if (this.state.type !== 'plugin') {
            newItems.sort(itemSort);
        }
        this.setState({items:newItems});
    };

    fillData(){
        let type=this.state.type;
        const loadFunction=()=> {
            if (type === 'route') {
                return RouteHandler.listRoutes(true);
            }
            if (type === 'layout') {
                return layoutLoader.listLayouts()
            }
            if (type === 'settings'){
                return PropertyHandler.listSettings();
            }
            return fillDataServer(type)
                .then((items) => {
                    let addons = this.state.addOns;
                    items.forEach((item) => {
                        if (item.type !== 'user') return;
                        if (Addons.findAddonByUrl(addons, item.url)) {
                            item.isAddon = true;
                        }
                    });
                    return items;
                });
        };
        loadFunction()
            .then((items)=>this.addItems(items,true))
            .catch((error)=>{
                Toast("unable to load "+type+": "+error);
                this.addItems([],true);
            })
    };


    changeType(newType){
        if (newType === this.state.type) return;
        this.setState({
            type:newType,
            items: []
        });
        //store the new type to have this available if we come back
        this.props.history.replace(
            this.props.history.currentLocation(),
            {
                downloadtype:newType
            }
        )
    }
    entryExists(name,opt_idxfct){
        let current=this.state.items;
        return checkName(name,current,opt_idxfct);
    };

    getButtonParam(bName,bType,overflow, opt_capability){
        let visible=this.state.type === bType || ! (this.props.options && this.props.options.allowChange === false);
        if (opt_capability){
            visible = visible && globalStore.getData(opt_capability,false);
        }
        return {
            name: bName,
            toggle:  this.state.type === bType,
            visible:  visible,
            onClick: () => this.changeType(bType),
            overflow: overflow === true
        };
    }
    getButtons(){
        const itemActions=ItemActions.create({type: this.state.type},globalStore.getData(keys.properties.connectedMode,true))
        let rt=[
            this.getButtonParam('DownloadPageCharts','chart'),
            {
                name: 'DownloadPageImporter',
                onClick: ()=>this.props.history.push('importerpage'),
                storeKeys: {
                    visible: keys.gui.capabilities.uploadImport
                }
            },
            this.getButtonParam('DownloadPageTracks','track'),
            this.getButtonParam('DownloadPageRoutes','route'),
            this.getButtonParam('DownloadPageLayouts','layout'),
            this.getButtonParam('DownloadPageSettings','settings',true,keys.gui.capabilities.uploadSettings),
            this.getButtonParam('DownloadPageUser','user',true),
            this.getButtonParam('DownloadPageImages','images',true),
            this.getButtonParam('DownloadPageOverlays','overlay',true),
            this.getButtonParam('DownloadPagePlugins','plugin',true,keys.gui.capabilities.uploadPlugins),
            {
                name:'DownloadPageUpload',
                visible: itemActions.showUpload,
                onClick:()=>{
                    this.setState({uploadSequence:this.state.uploadSequence+1});
                }
            },
            Mob.mobDefinition(this.props.history),
            {
                name: 'Cancel',
                onClick: ()=>{this.props.history.pop()}
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
     * @param file the file object
     * @returns {Promise}
     */
    checkNameForUpload(name,file){
            let actions=ItemActions.create({type:this.state.type},false);
            let ext=Helper.getExt(name);
            let serverName=actions.nameForUpload(name);
            const accessor=this.createAccessor(actions);
            let rt={name:serverName};
            if (this.state.type === 'route'){
                if (ext !== "gpx") {
                    return Promise.reject("only gpx for routes");
                }
                return Promise.resolve(rt);
            }
            if (this.state.type === 'track'){
                if (ext !== "gpx") {
                    return Promise.reject("only gpx for tracks");
                }
            }
            if (this.state.type === 'images'){
                if (GuiHelpers.IMAGES.indexOf(ext) < 0){
                    return Promise.reject("only images of types "+GuiHelpers.IMAGES.join(","));
                }
            }
            if (this.state.type === 'settings'){
                if (ext !== 'json'){
                    return Promise.reject("only .json files allowed for settings");
                }
            }
            if (this.state.type === 'layout') {
                if (ext !== 'json') {
                    return Promise.reject("only .json files allowed for layouts");
                }
            }
            if (this.state.type === 'chart'){
                let directExtensions=['gemf','mbtiles','xml'];
                if (directExtensions.indexOf(ext) < 0) {
                    //check for import
                    let importConfig=checkExt(ext,this.state.chartImportExtensions);
                    if (importConfig.allow) {
                        let resolved=false;
                        return showPromiseDialog(undefined,(dprops)=>{
                            return(
                                <ImportDialog
                                    {...dprops}
                                    allowNameChange={true}
                                    allowSubDir={importConfig.subdir}
                                    resolveFunction={(props,subdir)=>{
                                        resolved=true;
                                        if (subdir !== this.state.importSubDir){
                                            this.setState({importSubDir: subdir});
                                        }
                                        dprops.resolveFunction({name:props.name,type:'import',uploadParameters:{subdir:subdir},showImportPage:true});
                                    }}
                                    name={name}
                                    subdir={this.state.importSubDir}
                                />
                            );
                        });
                    }
                    else{
                        return Promise.reject("unknown chart type \""+ext+'"');
                    }
                }
                //fallthrough to check existing...
            }
            if (this.state.type === 'plugin'){
                if (ext !== 'zip'){
                    return Promise.reject("only .zip files allowed for plugins");
                }
                if (file){
                    let foundName;
                    const check=(foundName)=>{
                        const existing = this.entryExists(foundName,accessor);
                        if (existing) {
                            return showPromiseDialog(undefined, (dprops) => <ConfirmDialog
                                {...dprops}
                                title={`plugin ${foundName} already exists`}
                                text={'Update the existing plugin?'}
                            />)
                                .then(() => {
                                    return {
                                        name: foundName,
                                        uploadParameters: {overwrite: true}
                                    }
                                })
                        }
                        return Promise.resolve({name: foundName});
                    }

                    if (typeof TransformStream == "undefined") {
                        foundName = name.replace(/\.zip$/, '');
                        return showPromiseDialog(undefined, (dprops) => <ConfirmDialog
                            {...dprops}
                            title={"Old browser"}
                            text={"Your browser seems to be too old to check the zip file.\n" +
                                "If the plugin directory is equal to the name of the zip we can import any way.\n" +
                                "Try the import?"
                            }
                            className={'pre'}
                        />)
                            .then(() => {
                                return check(foundName)
                            })
                    } else {
                        const pluginfiles = ['plugin.py', 'plugin.js', 'plugin.css', 'plugin.json'];
                        const forbiddenBaseChars = new RegExp('[^0-9a-zA-Z_-]');
                        const zipFileReader = new BlobReader(file);
                        const zipReader = new ZipReader(zipFileReader);
                        return zipReader.getEntries()
                            .then((entries) => {
                                let hasFiles = false;
                                entries.forEach(entry => {
                                    if (!entry.filename) {
                                        throw {error: "invalid entry in zip without filename"}
                                    }
                                    const parts = entry.filename.split("/");
                                    if (parts.length < 1) {
                                        throw {error: "invalid entry in zip without filename"}
                                    }
                                    if (!entry.directory && parts.length < 2) {
                                        throw {error: `files must be located in a sub directory in the zip: ${entry.filename}`}
                                    }
                                    parts.forEach(part => {
                                        if (part === '') return;
                                        const sname = safeName(part);
                                        if (sname !== part || part === '.' || part === '..') {
                                            throw {error: `invalid characters in file name ${entry.filename} (${part})`}
                                        }
                                    })
                                    if (foundName) {
                                        if (parts[0] !== foundName) {
                                            throw {error: `all files in zip must be under one sub directory ${foundName} : ${entry.filename}`}
                                        }
                                    } else {
                                        foundName = parts[0];
                                        if (forbiddenBaseChars.test(foundName)) {
                                            throw {error: `the plugin directory contains forbidden characters ${foundName}`}
                                        }
                                    }
                                    if (!entry.directory) {
                                        if (pluginfiles.indexOf(parts[parts.length - 1]) >= 0) {
                                            hasFiles = true;
                                        }
                                    }
                                })
                                if (!hasFiles) {
                                    throw {error: "no plugin files in zip"}
                                }
                                return check(foundName);
                            },
                                (err) => {
                                    throw {error:err}
                                });
                    }
                }

            }
            const existing=this.entryExists(name,accessor);
            if (existing){
                existing.dialog=true;
                existing.fixedPrefix=actions.fixedPrefix;
                existing.fixedExt=ext;
                return Promise.reject(existing);
            }
            else{
                return Promise.resolve(rt);
            }
    }

    /**
     * return a function that will receive the result of a local upload
     * as an object with name and data
     * @returns {function(*): void}
     *          if no function is returned, the upload will go to the server
     */
    getLocalUploadFunction(){
        let actions=ItemActions.create(this.state.type);
        if (actions.localUploadFunction){
            return (obj)=> {
                if (!obj) {
                    Toast("no data available after upload");
                    return;
                }
                let data= obj.data;
                let name=obj.name;
                if (this.state.type === 'route'){
                    try{
                        let route=new routeobjects.Route();
                        route.fromXml(data)
                        if (! route.name) route.name=actions.nameForUpload(name);
                        const existing=this.entryExists(actions.nameForDownload(route.name));
                        if (existing){
                            showPromiseDialog(undefined,(dprops)=><ItemNameDialog
                                {...dprops}
                                checkName={(name)=>this.entryExists(name)}
                                fixedExt={'gpx'}
                                iname={route.name}
                                title={`route ${route.name} already exists`}
                                />)
                                .then((res)=>{
                                    route.name=actions.nameForUpload(res.name);
                                    actions.localUploadFunction(name,route)
                                        .then(()=>this.fillData(),(e)=>{Toast(e);this.fillData()})
                                })
                            return;
                        }
                        data=route;
                    }catch(e){}
                }
                actions.localUploadFunction(name, data)
                    .then((ok) => this.fillData())
                    .catch((e)=>{
                        Toast(e);
                        this.fillData();
                    })
            }
        }
    }
    createAccessor(opt_actions){
        if (! opt_actions) opt_actions=ItemActions.create({type:this.state.type},false);
        return (data)=>data?opt_actions.serverNameToClientName(data.name):data;
    }
    createItem(){
        const accessor=this.createAccessor();
        showPromiseDialog(undefined,(dprops)=><ItemNameDialog
            {...dprops}
            title={'enter filename'}
            checkName={(name)=>this.entryExists(name,accessor)}
            mandatory={true}
        />)
            .then((res)=>{
                const name=(res||{}).name;
                if (! name) return;
                if (this.entryExists(name,accessor)) {
                    Toast("already exists");
                    return;
                }
                const template=getTemplate(name);
                if (template){
                    showPromiseDialog(undefined,(dprops)=><EditDialogWithSave
                        {...dprops}
                        type={'user'}
                        fileName={name}
                        data={template}
                    />)
                        .then(()=>this.fillData())
                        .catch((e)=>{
                            if (e) Toast(e);
                            this.fillData();
                        })
                }
                else {
                    let data = "";
                    Requests.postPlain({
                        request:'api',
                        command: 'upload',
                        type: this.state.type,
                        name: name
                    }, data)
                        .then((res) => {
                            this.fillData();
                        })
                        .catch((error) => {
                            Toast("creation failed: " + error);
                            this.fillData();
                        });
                }
            })
            .catch(()=>{})
    };
    render(){
        let self=this;
        const actions=ItemActions.create({type:this.state.type});
        let localDoneFunction=this.getLocalUploadFunction();
        return (
            <Page
                {...self.props}
                id="downloadpage"
                mainContent={<React.Fragment>
                        <ItemList
                            itemClass={DownloadItem}
                            scrollable={true}
                            itemList={this.state.items}
                            onItemClick={(ev)=>{
                                const item=avitem(ev);
                                const action=avitem(ev,'action');
                                if (action === 'delete'){
                                    return deleteItem(item,this.fillData);
                                }
                                if (self.props.options && self.props.options.selectItemCallback){
                                    return self.props.options.selectItemCallback(item);
                                }
                                if (item.type === 'chart' && item.name === DEFAULT_OVERLAY_CONFIG){
                                    EditOverlaysDialog.createDialog(undefined,()=>this.fillData());
                                    return;
                                }
                                const accessor=this.createAccessor();
                                showDialog(undefined,()=>
                                 <FileDialogWithActions
                                     item={item}
                                     history={this.props.history}
                                     doneCallback={(action,item,pageChanged)=>{
                                         if (pageChanged) return;
                                         if (action === 'userapp') this.readAddOns()
                                         else this.fillData();
                                     }}
                                     checkExists={(newName)=>{
                                         //checkExisting
                                         return this.entryExists(newName,accessor);
                                     }}
                                 />);
                            }}
                        />
                        <UploadHandler
                            local={localDoneFunction !== undefined}
                            type={this.state.type}
                            doneCallback={(param)=>{
                                if (param.param && param.param.showImportPage){
                                    let options={};
                                    if (param.param.uploadParameters && param.param.uploadParameters.subdir) {
                                        options.subdir=param.param.uploadParameters.subdir;
                                    }
                                    this.props.history.push('importerpage',options);
                                }
                                localDoneFunction?localDoneFunction(param):this.fillData(param)
                            }}
                            errorCallback={(err)=>{if (err) Toast(err);this.fillData();}}
                            uploadSequence={this.state.uploadSequence}
                            checkNameCallback={this.checkNameForUpload}
                            fixedPrefix={actions.fixedPrefix}
                        />
                        {(this.state.type === "user")?
                            <DynamicButton
                                className="fab"
                                name="DownloadPageCreate"
                                onClick={()=>{
                                    this.createItem();
                                }}
                                storeKeys={{visible:keys.properties.connectedMode}}
                            />
                            :
                            null}
                    </React.Fragment>
                }
                title={actions.headline}
                buttonList={this.getButtons()}
                />
        );
    }
}

export default Dynamic(DownloadPage,{storeKeys:{
        reloadSequence:keys.gui.global.reloadSequence
    }});