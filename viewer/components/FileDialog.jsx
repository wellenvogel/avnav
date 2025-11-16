/**
 *###############################################################################
 # Copyright (c) 2012-2020 Andreas Vogel andreas@wellenvogel.net
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 ###############################################################################
 */
import React, {useCallback, useEffect, useState} from "react";
import keys from '../util/keys.jsx';
import {InputReadOnly, InputSelect, Radio} from "./Inputs";
import DB from "./DialogButton";
import Requests, {prepareUrl} from "../util/requests";
import Toast from "./Toast";
import EditOverlaysDialog, {KNOWN_OVERLAY_EXTENSIONS,DEFAULT_OVERLAY_CHARTENTRY} from "./EditOverlaysDialog";
import {
    DialogButtons,
    DialogFrame,
    DialogRow,
    showPromiseDialog, useDialogContext
} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import ViewPage from "../gui/ViewPage";
import {layoutLoader} from "../util/layouthandler";
import base from "../base";
import NavHandler from "../nav/navdata";
import Helper from '../util/helper';
import UserAppDialog from "./UserAppDialog";
import DownloadButton from "./DownloadButton";
import {TrackConvertDialog} from "./TrackConvertDialog";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackConvertDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoHelper";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";
import LogDialog from "./LogDialog";
import Formatter from '../util/formatter';
import routeobjects from "../nav/routeobjects";
import PropertyHandler from "../util/propertyhandler";
import {ConfirmDialog, InfoItem} from "./BasicDialogs";
import {ItemNameDialog} from "./ItemNameDialog";
import GuiHelpers from "../util/GuiHelpers";
import {removeItemsFromOverlays} from "../map/overlayconfig";

const RouteHandler=NavHandler.getRoutingHandler();
/**
 * additional parameters that should be included in server requests
 * if they are set at the item
 * @type {{url: boolean, chartKey: boolean}}
 */
export const additionalUrlParameters={
    url:true
}

export const ItemDownloadButton=(props)=>{
    let {item,...forwards}=props;
    if (item.canDownload === false) return null;
    let localData=props.localData||getLocalDataFunction(item);
    return <DownloadButton
        {...forwards}
        url={localData?undefined:getDownloadUrl(item)}
        fileName={getDownloadFileName(item)}
        localData={localData}
        type={item.type}
        />
}
const getLocalDataFunction=(item)=>{
    if (item.type === 'route' && ! item.server){
        return ()=>{ return RouteHandler.getLocalRouteXml(item.name)}
    }
    if (item.type === 'layout'){
        return layoutLoader.getLocalDownload(item.name);
    }
}
export const getDownloadFileName=(item)=>{
    let actions=ItemActions.create(item,globalStore.getData(keys.properties.connectedMode));
    return actions.nameForDownload(item);
}
const getDownloadUrl=(item)=>{
    let name=item.name;
    if (item.type==='route') {
        if (item.server === false) return;
        if (! name.match(/\.gpx$/)) name+=".gpx";
    }
    let url= prepareUrl(buildRequestParameters('download',item,{
        filename:getDownloadFileName(item),
    }));
    return url;
}

const showConvertFunctions = {
    track: (dialogContext,history,item) => {
        dialogContext.replaceDialog(()=><TrackConvertDialog history={history} name={item.name}/>);
    }
}
const buildRequestParameters=(command,item,opt_additional)=>{
    return {...Helper.filteredAssign(additionalUrlParameters,item),
            ...opt_additional,
            request: 'api',
            command: command,
            type: item.type,
            name:item.name
        }
}
export const USER_PREFIX='user.';
export class ItemActions{
    constructor(type) {
        this.type=type;
        this.headline=type
        this.showEdit=false;
        this.showView=false;
        this.showDelete=false;
        this.showRename=false;
        this.showApp=false;
        this.isApp=false;
        this.showOverlay=false;
        this.showScheme=false;
        this.showConvertFunction=undefined;
        this.showImportLog=false;
        this.showIsServer=false;
        this.showUpload=false;
        this.timeText='';
        this.infoText='';
        this.className='';
        this.extForView=undefined;
        this.fixedExtension=undefined; //if set we always remove this from names before sending to the server and expect files to have this
        this.allowedExtensions=undefined; //allowed file extensions for upload, cen be left empty if fixed extension is set or if all are allowed
        /**
         * if this is set call this function to upload a new item
         * instead of the normal server upload
         * the function must expect name and data and optonally an overwrite flag
         * as parameters and return a promise
         * the resolves true when the upload succeeds
         * @type {undefined}
         */
        this.localUploadFunction=undefined;
        /**
         * convert an entity name as received from the server to a name we offer when downloading
         * @param item from list or info
         * @returns {*}
         */
        this.nameForDownload=(item)=>{
            if (item.downloadName) return item.downloadName;
            let name=item.name||item.type||"download";
            if (item.checkPrefix) name=name.substring(item.checkPrefix.length);
            if (this.fixedExtension) name=name+"."+this.fixedExtension;
            return name;
        }
        /**
         * convert a local file name into an entity name as the server would accept in upload
         * @param name
         * @returns {*}
         */
        this.nameForUpload=(name)=>{
            if (! name) return name;
            if (! this.fixedExtension) return name;
            if (Helper.endsWith(name.toLowerCase(),"."+this.fixedExtension)){
                return name.substr(0,name.length-this.fixedExtension.length-1);
            }
            return name;
        }
        /**
         * get a name from a list entry to compare against a local file name
         * @param item
         * @param opt_ext - if true add an fixed extension
         */
        this.nameForCheck=(item,opt_ext)=>{
            if (this.hasScope && ! item.checkPrefix) return;
            if (! item.name) return;
            let name=item.name;
            if (this.hasScope){
                name=name.substring(item.checkPrefix.length);
            }
            if (opt_ext && this.fixedExtension){
                name+="."+this.fixedExtension;
            }
            return name;
        }
        this.hasScope=undefined;
        /**
         * get a prefix to be shown in upload/rename dialogs
         * @returns {string|undefined}
         */
        this.prefixForDisplay=()=>{
            return this.hasScope?'user.':undefined;
        }
        this.nameToBaseName=(name)=>{
            if (! name) return name;
            if (this.hasScope) {
                name = name.replace(/^user\./, '').replace(/^system\./, '').replace(/^plugin\.[^.]*[.]*/, '');
            }
            if (this.fixedExtension && Helper.endsWith(name.toLowerCase(),"."+this.fixedExtension)){
                name=name.substring(0,name.length-this.fixedExtension.length-1);
            }
            return name;
        }
        this.getExtensionForView=(item)=>{
            if (this.fixedExtension){
                return this.fixedExtension;
            }
            if (this.extForView) {
                return this.extForView;
            }
            const dlname=this.nameForDownload(item);
            if (dlname){
                return Helper.getExt(dlname);
            }
            return "";
        }
    }
    postCreate(){
        this.nameForDownload=this.nameForDownload.bind(this);
        this.nameForUpload=this.nameForUpload.bind(this);
        this.nameForCheck=this.nameForCheck.bind(this);
        this.nameToBaseName=this.nameToBaseName.bind(this);
        this.prefixForDisplay=this.prefixForDisplay.bind(this);
        this.getExtensionForView=this.getExtensionForView.bind(this);
        if (! this.allowedExtensions){
            if (this.fixedExtension){
                this.allowedExtensions=[this.fixedExtension];
            }
        }
        if (this.hasScope === undefined && this.fixedExtension){
            this.hasScope=true;
        }
    }

    /**
     * check or allowed extensions, return an error text if not allowed
     * @param ext
     * @param opt_title
     */
    checkExtension(ext,opt_title){
        if (! ext || ! this.allowedExtensions) return ;
        if (this.allowedExtensions.indexOf(ext) >=0) return;
        const title=opt_title?opt_title+": ":"";
        return title+`extension ${ext} not allowed, only `+this.allowedExtensions.join(",");

    }
    static create(props,isConnected){
        if (typeof(props) === 'string') props={type:props};
        if (! props || ! props.type){
            return new ItemActions();
        }
        let rt=new ItemActions(props.type);
        let ext=props.extension||Helper.getExt(props.name);
        let viewable=ViewPage.VIEWABLES.indexOf(ext)>=0;
        let editableSize=props.size !== undefined && props.size < ViewPage.MAXEDITSIZE;
        let allowedOverlay=KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(props.name,true)) >= 0;
        let canEditOverlays=globalStore.getData(keys.gui.capabilities.uploadOverlays) && isConnected;
        if (props.time !== undefined) {
            rt.timeText=Formatter.formatDateTime(new Date(props.time*1000));
        }
        rt.infoText=props.displayName||props.name;
        if (props.active){
            rt.className+=' activeEntry';
        }
        rt.extForView=ext;
        switch (props.type){
            case 'chart':
                rt.headline='Charts';
                rt.showDelete=props.canDelete && isConnected;
                rt.showOverlay=canEditOverlays;
                rt.showScheme=isConnected && props.url && props.url.match(/.*mbtiles.*/);
                rt.showImportLog=props.hasImportLog;
                rt.showDownload=props.canDownload;
                if (props.originalScheme){
                    rt.className+=' userAction';
                }
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadCharts,false)
                rt.allowedExtensions=['gemf','mbtiles','xml']; //import extensions separately
                rt.hasScope=true;
                break;
            case 'track':
                rt.headline='Tracks';
                rt.showDelete=true;
                rt.showDownload=true;
                rt.showView=viewable;
                rt.showConvertFunction=ext === 'gpx'?showConvertFunctions[props.type]:undefined;
                rt.showOverlay=allowedOverlay && canEditOverlays;
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadTracks,false)
                rt.allowedExtensions=['gpx']
                break;
            case 'route':
                rt.headline='Routes';
                rt.showIsServer=props.server;
                rt.showDelete= ! props.active &&  props.canDelete !== false  && ( ! props.isServer || isConnected);
                rt.showView=async (item)=>{
                    return new Promise((resolve,reject)=> {
                        RouteHandler.fetchRoute(item.name, !item.server, (route) => {
                            resolve({
                                    name: item.name,
                                    data: route.toXml()
                                },
                                (err) => {
                                    reject(err)
                                })
                        })
                    });
                };
                rt.showEdit=mapholder.getCurrentChartEntry() !== undefined;
                rt.showOverlay=canEditOverlays;
                rt.showDownload=true;
                rt.fixedExtension='gpx';
                rt.infoText+=","+Formatter.formatDecimal(props.length,4,2)+
                    " nm, "+props.numpoints+" points";
                rt.localUploadFunction=(name,data)=>{
                    //name is ignored
                    try{
                        let route;
                        if (data instanceof routeobjects.Route){
                            route=data;
                        }
                        else {
                            route = new routeobjects.Route("");
                            route.fromXml(data);
                        }
                        if (! route.name){
                            return Promise.reject("route has no name");
                        }
                        return RouteHandler.saveRoute(route);
                    } catch(e){
                        return Promise.reject(e);
                    }
                }
                rt.showUpload=isConnected;
                break;
            case 'layout':
                rt.headline='Layouts';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = async (item)=>{
                    const layout = await layoutLoader.loadLayout(item.name);
                    return {
                        name:item.name+".json",
                        data: JSON.stringify(layout,undefined,"  ")
                    }
                };
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.fixedExtension='json';
                rt.localUploadFunction=(name,data,overwrite)=>{
                    return layoutLoader.uploadLayout(name,data,overwrite);
                }
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadLayout,false)
                rt.hasScope=true;
                break;
            case 'settings':
                rt.headline='Settings';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = true;
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.showRename=isConnected && props.canDelete;
                rt.fixedExtension='json';
                rt.localUploadFunction=(name,data,overwrite)=>{
                   return PropertyHandler.verifySettingsData(data, true,true)
                       .then((res) => PropertyHandler.uploadSettingsData(name,res.data,false,overwrite));
                }
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadOverlays,false)
                rt.hasScope=true;
                break;
            case 'user':
                rt.headline='User';
                rt.showDelete=isConnected && props.canDelete;
                rt.showRename=isConnected && props.canDelete;
                rt.showView=viewable;
                rt.showEdit=editableSize && ViewPage.EDITABLES.indexOf(ext) >=0 && props.canDelete && isConnected;
                rt.showDownload=true;
                rt.showApp=isConnected && ext === 'html' && globalStore.getData(keys.gui.capabilities.addons);
                rt.isApp=rt.showApp && props.isAddon;
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadUser,false)
                break;
            case 'images':
                rt.headline='Images';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadImages,false)
                rt.allowedExtensions=GuiHelpers.IMAGES;
                break;
            case 'overlay':
                rt.headline='Overlays';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                rt.showEdit= editableSize && ViewPage.EDITABLES.indexOf(ext) >=0 && isConnected;
                rt.showOverlay = canEditOverlays && allowedOverlay;
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadOverlays,false)
                break;
            case 'plugin':
                rt.headline='Plugins';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = false;
                rt.showRename = false;
                rt.showDownload=true;
                rt.showEdit= false;
                rt.showOverlay = false;
                rt.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadPlugins,false)
                rt.allowedExtensions=['zip'];
                rt.hasScope=true;
                rt.prefixForDisplay=()=>'user-';
                break;
        }
        rt.postCreate();
        return rt;
    }
}

export const itemListToSelectList=(itemList,opt_selected)=>{
    const rt=[];
    if (! itemList) return rt;
    itemList.forEach(item=>{
        const sitem={
            value:item.name,
            key:item.name,
            label:item.displayName||item.name,
        };
        if (opt_selected && item.name === opt_selected){
            sitem.selected=true;
        }
        rt.push(sitem);
    });
    return rt;
}

const getImportLogUrl=(name)=>{
    return prepareUrl({
        type:'import',
        command:'getlog',
        name:name
    });
}

const ALLCHARTS={label:'AllCharts',value: ''};
const AddRemoveOverlayDialog = (props) => {
    const dialogContext=useDialogContext();
    const [chartList, setChartList] = useState([DEFAULT_OVERLAY_CHARTENTRY]);
    const [chart, setChart] = useState(DEFAULT_OVERLAY_CHARTENTRY.name);
    const [action, setAction] = useState('add');
    const [changed, setChanged] = useState(false);
    const [running,setRunning] = useState(false);
    let titles = {add: "Add to Charts", remove: "Remove from Charts"}
    useEffect(() => {
        Requests.getJson({
            request:'api',
            command: 'list',
            type: 'chart'
        })
            .then((data) => {
                setChartList(
                    chartList.concat(data.items)
                )
            })
            .catch((error) => Toast("unable to read chart list: " + error));

    }, []);
    const findChart = useCallback((chartKey) => {
        for (let i = 0; i < chartList.length; i++) {
            if (chartList[i].name === chartKey) return chartList[i];
        }
    }, [chartList]);
    const execute = useCallback(async () => {
        if (action === 'add') {
            let chartInfo = findChart(chart);
            if (!chartInfo) return;
            dialogContext.closeDialog();
            EditOverlaysDialog.createDialog(chartInfo,
                undefined,
                props.current
            );
            return;
        }
        if (action === "remove") {
            setRunning(true);
            try {
                const result = await removeItemsFromOverlays(chartList.concat({}), [props.current]);
                if (result.status !== 'OK') {
                    throw new Error(result.status);
                }
                Toast(result.info);
                dialogContext.closeDialog();
            } catch (error) {
                setRunning(false);
                Toast("Error:" + error);
            }
        }
    }, [action,chart]);
    const getChartSelectionList = useCallback(() => {
        if (action === 'remove'){
            return [ALLCHARTS]
        }
        let rt = [];
        chartList.forEach((chart) => {
            if (!chart.name) return;
            rt.push({label: chart.displayName||chart.name, value: chart.name});
        })
        return rt;
    }, [action, chartList]);
    const getCurrentChartValue = useCallback(() => {
        const chartForDisplay=findChart(chart) || {};
        return (
            {
                label: chartForDisplay.displayName||chartForDisplay.name,
                value: chart
            })
    }, [action, chart]);
    return (
        <DialogFrame className="AddRemoveOverlayDialog" title={"On Charts"}>
            {running && <DialogRow><span className={"spinner"}/></DialogRow>}
            <DialogRow>
                <span className="itemInfo">{props.current.name}</span>
            </DialogRow>
            <Radio
                dialogRow={true}
                label={"Action"}
                value={action}
                onChange={(v) => {
                    setChanged(true);
                    setAction(v);
                }}
                itemList={[{label: titles.add, value: "add"}, {label: titles.remove, value: "remove"}]}
            />
            {action === 'add'?
            <InputSelect
                dialogRow={true}
                label="Chart"
                value={getCurrentChartValue()}
                onChange={(v) => {
                    setChanged(true);
                    setChart(v);
                }}
                changeOnlyValue={true}
                itemList={getChartSelectionList()}
            />:
                <InputReadOnly
                    dialogRow={true}
                    label="Chart"
                    value={ALLCHARTS.label}
                />}
            <DialogButtons>
                <DB name="cancel"
                    disabled={running}
                >Cancel</DB>
                <DB name="ok"
                    onClick={() => {
                        execute();
                    }}
                    close={false}
                    disabled={running}
                >Ok</DB>
            </DialogButtons>
        </DialogFrame>
    )
}
const INFO_ROWS=[

];
const TYPE_INFO_ROWS={
    track: TRACK_INFO_ROWS,
    route: ROUTE_INFO_ROWS
}
const INFO_FUNCTIONS={
    track: getTrackInfo,
    route: getRouteInfo
};
const infoRowDisplay=(row,data)=>{
    let v=data[row.value];
    if (v === undefined) return null;
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}
export const FileDialog = (props) => {
    const [changed, setChanged] = useState(false);
    const [existingName, setExistingName] = useState(true);
    const [name, setName] = useState(props.current.name);
    const [scheme, setScheme] = useState(props.current.scheme);
    const [allowed, setAllowed] = useState(ItemActions.create(props.current, globalStore.getData(keys.properties.connectedMode, true)))
    const [extendedInfo, setExtendedInfo] = useState({});
    const dialogContext = useDialogContext();
    useEffect(() => {
        let f = INFO_FUNCTIONS[props.current.type];
        if (f) {
            f(props.current.name).then((info) => {
                setExtendedInfo(info);
            }).catch(() => {
            });
        }
    }, []);

    const onRename = (newName) => {
        if (newName === name) return;
        if (newName === props.current.name) {
            setChanged(false);
            setExistingName(true);
            setName(newName);
            return;
        }
        setExistingName(false);
        setName(newName);
        setChanged(true);
    }
    let cn = existingName ? "existing" : "";
    let rename = changed && !existingName && (name !== props.current.name);
    let schemeChanged = allowed.showScheme && (((props.current.scheme || "tms") !== scheme) || props.current.originalScheme);
    let extendedInfoRows = TYPE_INFO_ROWS[props.current.type];
    //if we have a scoped item we can (currently) only rename user items
    //and user items must always have a checkPrefix. By using this we do not need to knoew the user prefix here
    //in the code but can lease this to the server
    const allowRename=allowed.showRename && ( ! allowed.hasScope || props.current.checkPrefix);
    return (
        <DialogFrame className="fileDialog" title={props.current.displayName||props.current.name}>
            {props.current.info !== undefined ?
                <DialogRow>
                    <span className="itemInfo">{props.current.info}</span>
                </DialogRow>
                :
                null
            }
            {INFO_ROWS.map((row) => {
                return infoRowDisplay(row, props);
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return infoRowDisplay(row, extendedInfo);
            })}
            {(allowed.showScheme && props.current.originalScheme) &&
                <DialogRow className="userAction">
                    <span className="inputLabel">
                        original DB scheme
                    </span>
                    <span className="value">
                        {props.current.originalScheme}
                    </span>

                </DialogRow>
            }
            {allowed.showScheme &&
                <Radio
                    label="scheme"
                    value={scheme}
                    onChange={(v) => {
                        setChanged(true);
                        setScheme(v)
                    }}
                    itemList={[{label: "xyz", value: "xyz"}, {label: "tms", value: "tms"}]}
                    className="mbtilesType"/>

            }
            {(allowRename && ! existingName) &&
                    <InputReadOnly
                        dialogRow={true}
                        label={"new name"}
                        className={cn}
                        value={name}
                    />
            }
            <DialogButtons>
                {allowRename && <DB
                    name={"Rename"}
                    onClick={()=>{
                        let fixedPrefix=undefined;
                        let dname=name;
                        if (allowed.hasScope){
                            fixedPrefix=props.current.checkPrefix;
                            dname=name.substr(fixedPrefix.length);
                        }
                        showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
                            title={`Rename ${name}`}
                            {...dprops}
                            iname={dname}
                            fixedPrefix={fixedPrefix}
                            keepExtension={true}
                            checkName={(name)=>{
                                if (! name){
                                    return {
                                        error: 'must not be empty',
                                        proposal: dname
                                    }
                                }
                                return props.checkName?props.checkName(name):undefined
                            }}
                        />)
                            .then((res)=>{
                                onRename(fixedPrefix?fixedPrefix+res.name:res.name)
                            })
                            .catch(()=>{})
                    }}
                    close={false}
                >Rename</DB>}
                {(allowRename || allowed.showScheme) ?
                    <DB name="ok"
                        onClick={() => {
                            let action = "";
                            if (rename) action += "rename";
                            if (schemeChanged) {
                                if (props.current.scheme !== scheme) {
                                    if (action === "") action = "scheme";
                                    else action += ",scheme";
                                }
                            }
                            props.okFunction(action,
                                {...props.current, name: name, scheme: scheme});
                        }}
                        disabled={!rename && !schemeChanged}
                    >
                        Save
                    </DB>
                    :
                    null
                }
                {allowed.showDelete ?
                    <DB name="delete"
                        onClick={() => {
                            props.okFunction('delete', props.current.name);
                        }}
                        disabled={changed}
                    >
                        Delete
                    </DB>
                    :
                    null
                }
            </DialogButtons>
            <DialogButtons>
                {allowed.showImportLog &&
                    <DB name={'log'}
                        onClick={() => {
                            dialogContext.replaceDialog((dprops) => {
                                return <LogDialog {...dprops}
                                                  baseUrl={getImportLogUrl(props.current.name)}
                                                  title={'Import Log'}
                                />
                            })
                        }}
                    >Log</DB>
                }
                {allowed.showConvertFunction &&
                    <DB name="toroute"
                        onClick={() => {
                            props.okFunction('convert', props.current);
                        }}
                    >Convert</DB>
                }
                {(allowed.showView) ?
                    <DB name="view"
                        onClick={() => {
                            if (typeof (allowed.showView) === 'function' ) {
                                const rs=allowed.showView(props.current);
                                if (rs instanceof Promise) {
                                    rs
                                        .then((res)=>props.okFunction('view',{...props.current,...res}))
                                        .catch((err)=>Toast(err));
                                    return;
                                }
                                props.okFunction('view',{...props.current,...rs});
                                return;
                            }
                            props.okFunction('view', props.current);
                        }}
                        disabled={changed}
                    >
                        View
                    </DB>
                    :
                    null}
                {(allowed.showEdit) ?
                    <DB name="edit"
                        onClick={() => {
                            props.okFunction('edit', props.current);
                        }}
                        disabled={changed}
                    >
                        Edit
                    </DB>
                    :
                    null
                }
                {(allowed.showOverlay) ?
                    <DB name="overlays"
                        onClick={() => {
                            props.okFunction('overlay', props.current);
                        }}
                        disabled={changed}
                    >
                        Overlays
                    </DB>
                    :
                    null
                }
                <ItemDownloadButton
                    name="download"
                    disabled={changed}
                    item={props.current || {}}
                    useDialogButton={true}
                >
                    Download
                </ItemDownloadButton>
                {(allowed.showApp) &&
                    <DB name="userApp"
                        onClick={() => {
                            props.okFunction('userapp', props.current);
                        }}
                        disabled={changed}
                    >
                        App
                    </DB>

                }
                <DB name="cancel"
                >
                    Cancel
                </DB>
            </DialogButtons>
        </DialogFrame>
    );

}
export const deleteItem=(info,opt_resultCallback)=> {
    let doneAction=()=> {
        if (opt_resultCallback) opt_resultCallback(info);
    };
    let ok = showPromiseDialog(undefined,(dprops)=><ConfirmDialog {...dprops} text={"delete " + (info.displayName||info.name) + "?"}/>);
    ok.then(function () {
        if (info.type === 'layout') {
            layoutLoader.deleteLayout(info.name)
                .then((res)=> {
                    doneAction();
                })
                .catch((err)=>{
                    Toast("unable to delete layout "+info.name+": "+err);
                    doneAction();
                });
            return;
        }
        if (info.type !== "route") {
            Requests.getJson( buildRequestParameters('delete',info))
                .then(() => {
                    if (info.type === 'track') {
                        NavHandler.resetTrack();
                    }
                    doneAction();
                })
                .catch((error) => {
                    Toast("unable to delete " + info.name + ": " + error);
                    doneAction();
                })
        } else {
            if (RouteHandler.isActiveRoute(info.name)) {
                Toast("unable to delete active route");
                doneAction();
            }
            RouteHandler.deleteRoute(info.name,
                () => {
                    doneAction();
                },
                (rinfo) => {
                    Toast("unable to delete route: " + rinfo);
                    doneAction();
                },
                !info.server //if we think this is a local route - just delete it local only
            );
        }
    });
    ok.catch(function () {
        base.log("delete canceled");
        doneAction();
    });
};

export const FileDialogWithActions=(props)=>{
    const {doneCallback,item,history,checkExists,...forward}=props;
    const dialogContext=useDialogContext();
    const actionFunction=(action,newItem)=>{
        let doneAction=(pageChanged)=>{
            if (doneCallback){
                doneCallback(action,newItem,pageChanged)
            }
        };
        const schemeAction=(newScheme)=>{
            return Requests.getJson(
                buildRequestParameters('scheme',item,
                    {newScheme:newScheme}));
        };
        let renameAction=(name,newName)=>{
            Requests.getJson( buildRequestParameters('rename',item,
                    {newName:newName}))
                .then(()=>{
                    doneAction();
                })
                .catch((error)=>{
                    Toast("rename failed: "+error);
                    doneAction();
                });
        };
        if (action.match(/scheme/)){
            schemeAction(newItem.scheme)
                .then(()=>{
                    if (action.match(/rename/)) renameAction(item.name,newItem.name);
                    doneAction();
                })
                .catch((error)=>{
                    Toast("change scheme failed: "+error);
                    if (action.match(/rename/)) renameAction(item.name,newItem.name);
                    doneAction();
                });
            return;
        }
        if (action === 'rename'){
            return renameAction(item.name,newItem.name);
        }
        if (action === 'view'){
            doneAction(true);
            history.push('viewpage',{type:item.type,name:newItem.name,readOnly:true,data:newItem.data});
            return;
        }
        if (action === 'edit'){
            if (item.type === 'route'){
                RouteHandler.fetchRoute(item.name,!item.server,
                    (route)=>{
                        let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                        editor.setNewRoute(route,0);
                        doneAction(true);
                        history.push('editroutepage',{center:true});
                    },
                    (error)=>{
                        Toast(error);
                        doneAction();
                    });
                return;
            }
            doneAction(true);
            history.push('viewpage',{type:item.type,name:item.name});
            return;
        }
        if (action === 'userapp'){
            if (item.url) {
                dialogContext.replaceDialog((props) =>
                    <UserAppDialog {...props} fixed={{url: item.url}} resolveFunction={()=>{}}/>
                ,()=>doneAction())
            }
        }
        if (action === 'delete'){
            return deleteItem(item,()=>doneAction());
        }
        if (action === 'overlay'){
            doneAction();
            if (item.type === 'chart') {
                return EditOverlaysDialog.createDialog(item )
            }
            else{
                dialogContext.replaceDialog((props)=>{
                    return(
                        <AddRemoveOverlayDialog
                            {...props}
                            current={item}
                        />
                    )
                });
                return;
            }
        }
        if ( action === 'convert'){
            let convertFunction=showConvertFunctions[newItem.type];
            if (convertFunction){
                convertFunction(dialogContext,history,newItem);
            }
            return;
        }
    };
    return <FileDialog
        {...forward}
        current={item}
        okFunction={actionFunction}
        checkName={checkExists}/>
}
