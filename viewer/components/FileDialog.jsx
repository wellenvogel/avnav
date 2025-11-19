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
    DBCancel, DBOk,
    DialogButtons,
    DialogFrame,
    DialogRow,
    showPromiseDialog, useDialogContext
} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import ViewPage from "../gui/ViewPage";
import {layoutLoader} from "../util/layouthandler";
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
import {checkName, ItemNameDialog} from "./ItemNameDialog";
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
    let actions=new ItemActions(item);
    return actions.nameForDownload();
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
class Action{
    constructor({label,name,action,visible,close,disabled,itemActions}) {
        this.label=label;
        this.action=action;
        this.visible=visible;
        this.name=name;
        this.close=close;
        this.disabled=disabled;
        this.itemActions=itemActions;
    }
    _check(){
        if (! this.itemActions){
            this.itemActions=new ItemActions('dummy');
        }
        if (! (this.itemActions instanceof ItemActions)){
            throw new Error("invalid itemActions for "+this.name)
        }
    }
    copy(updates){
        const rt=new Action(this);
        if (updates && updates instanceof Object){
            for (let k in updates){
                rt[k]=updates[k];
            }
        }
        rt._check();
        return rt;
    }
    connect(itemActions){
        this.itemActions=itemActions;
        this._check();
    }

    /**
     * helper that calls the action function
     * @param ev
     * @param item the item
     * @param options
     * @returns {Promise<void>} resolves to undefined on success
     * @private
     */
    async _ahelper(ev, options){
        if (typeof this.action !== 'function')return;
        const rs= this.action(this.itemActions.item,options||{});
        if (rs instanceof Promise) {
            return await rs;
        }
        else {
            return rs;
        }
    }
    _fhelper(name,options){
        const target=this[name];
        if (typeof target === 'function'){
            return target(this.itemActions.item,options||{});
        }
        return !!target;
    }
    getButton(options){
        return {
            name: this.name,
            visible: this._fhelper('visible',options),
            label: this.label,
            onClick: async (ev, dialogContext) => {
                const res = await this._ahelper(ev, {...options, dialogContext: dialogContext});
                if (res && dialogContext && Helper.unsetorTrue(this.close)) {
                    dialogContext.closeDialog();
                }
                return;
            },
            close: false,
            disabled: this._fhelper('disabled',options),
        }
    }

}
//-------------------- action helper ---------------------
const SchemeDialog = ({item, resolveFunction}) => {
    const [scheme, setScheme] = useState(item.scheme);
    return <DialogFrame title={`Change scheme for ${item.displayName}`}>
        {item.originalScheme && <DialogRow className="userAction">
                    <span className="inputLabel">
                        original
                    </span>
            <span className="value">
                        {item.originalScheme}
                    </span>

        </DialogRow>
        }
        <Radio
            label="scheme"
            value={scheme}
            onChange={(v) => {
                setScheme(v)
            }}
            itemList={[{label: "xyz", value: "xyz"}, {label: "tms", value: "tms"}]}
            className="mbtilesType"/>
        <DialogButtons
            buttonList={[
                DBCancel(),
                DBOk(() => {
                    resolveFunction(scheme)
                }, {
                    disabled: scheme === item.scheme
                })
            ]}
        />
    </DialogFrame>
}

const deleteItemQuery=async(item,dialogContext)=>{
    try {
        await showPromiseDialog(dialogContext, (dprops) => <ConfirmDialog
                                                                          {...dprops} text={"delete " + (item.displayName || item.name) + "?"}
        />);
        return true
    }catch (pe) {
        return false;
    }
}
const deleteRequest=async(item)=>{
    return await Requests.getJson({
        type: item.type,
        command:'delete',
        name:item.name
    })
}
const renameRequest=async(item,newName)=>{
    await Requests.getJson({
        type: item.type,
        command:'rename',
        name:item.name,
        newName:newName
    })
    return true;
}
const removeItemFromOverlays=async(item)=>{
    if (! item || ! item.name) return;
    await removeItemsFromOverlays(undefined,[item]);
}

export const deleteItem=async (item,dialogContext)=> {
    if (! await deleteItemQuery(item,dialogContext)) return;
    await deleteRequest(item);
    await removeItemFromOverlays(item);
    return true;
};

const renameDialog=async(item,options)=>{
    let fixedPrefix=undefined;
    let dname=item.name;
    if (options.hasScope){
        fixedPrefix=item.checkPrefix;
        if (! fixedPrefix) throw new Error("can only rename user items");
        dname=dname.substr(fixedPrefix.length);
    }
    let itemList=options.list;
    if (! itemList){
        const res=await Requests.getJson({
            type: item.type,
            command:'list'
        });
        itemList=res.items||[];
    }
    const nameForCheck=options.nameForCheck?
        (item)=>options.nameForCheck(item):
        (item)=>item.name;
    try{
        const res=await showPromiseDialog(options.dialogContext,(dprops)=><ItemNameDialog
            title={`Rename ${item.displayName||item.name}`}
            {...dprops}
            iname={dname}
            fixedPrefix={fixedPrefix}
            keepExtension={options.renameKeepExtension}
            checkName={(name)=>{
                const [fn,ext]=Helper.getNameAndExt(name);
                if (! name || (options.renameKeepExtension && ! fn)){
                    return {
                        error: 'must not be empty',
                        proposal: dname
                    }
                }
                return checkName(name,itemList,nameForCheck);
            }}
            mandatory={true}
        />);
        return fixedPrefix?fixedPrefix+res.name:res.name;
    } catch (e){
        console.error(e);
        return;
    }
}
const standardActions={
    delete: new Action({
            label: 'Delete',
            name: 'delete',
            action: async (item,options)=>{
                return await deleteItem(item,options.dialogContext)
            }
        }),
    rename: new Action({
        label: 'Rename',
        name: 'Rename',
        action: async (item,options)=>{
            const newName=await renameDialog(item,options);
            if (! newName)return;
            return await renameRequest(item,newName);
            //TODO: rename item in overlays
    }}),
    view: new Action({
        label: 'View',
        name: 'view',
        action: async (item,options)=>{
            options.history.push('viewpage', {type: item.type, name: item.name, readOnly: true,ext:this.itemActions.getExtensionForView(item)});
            return true;
        },
        visible: (item,options)=>{
            if (! options.history) return false;
            let ext=this.itemActions.getExtensionForView();
            return ViewPage.VIEWABLES.indexOf(ext)>=0;
        }
    })

}
export const USER_PREFIX='user.';
export class ItemActions{
    constructor(item) {
        this.item=item||{};
        this.type=this.item.type;
        this.headline=this.item.type
        this.actions=[]
        this.renameKeepExtension=true;
        this.showEdit=false;
        this.showApp=false;
        this.isApp=false;
        this.showOverlay=false;
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
        this.hasScope=false;
        this.buildExtendedInfo=async ()=>{}
        this.extendedInfoRows=undefined;
        this.infoRows=undefined;
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
         * @returns {*}
         */
        this.nameForDownload=()=>{
            const item=this.item;
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
         * @param item an entry from the list
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
        this.getExtensionForView=()=>{
            if (this.fixedExtension){
                return this.fixedExtension;
            }
            if (this.extForView) {
                return this.extForView;
            }
            const dlname=this.nameForDownload();
            if (dlname){
                return Helper.getExt(dlname);
            }
            return "";
        }
        this.build();
        this.postCreate()
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
        this.actions.forEach(action=>{
            action.connect(this);
        })
    }
    getItemActionDef(name,doneAction,opt_options){
        for (let i in this.actions){
            const action=this.actions[i];
            if (action.name === name)
                return action.getButton(this.item,doneAction,{...this,...opt_options});
        }
    }

    getActionButtons(doneAction,opt_options){
        const rt=[]
        this.actions.forEach(action=>{
            rt.push(action.getButton(doneAction,opt_options));
        })
        return rt;
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
    build(){
        const props=this.item||{};
        const isConnected=globalStore.getData(keys.properties.connectedMode);
        let ext=props.extension||Helper.getExt(props.name);
        let editableSize=props.size !== undefined && props.size < ViewPage.MAXEDITSIZE;
        let allowedOverlay=KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(props.name,true)) >= 0;
        let canEditOverlays=globalStore.getData(keys.gui.capabilities.uploadOverlays) && isConnected;
        if (props.time !== undefined) {
            this.timeText=Formatter.formatDateTime(new Date(props.time*1000));
        }
        this.infoText=props.displayName||props.name;
        if (props.active){
            this.className+=' activeEntry';
        }
        this.extForView=ext;
        let canModify=isConnected && props.canDelete;
        switch (props.type){
            case 'chart':
                this.headline='Charts';
                this.actions.push(standardActions.delete.copy({
                    visible: props.canDelete && isConnected
                }));
                this.actions.push(new Action({
                    name: 'scheme',
                    label: 'Scheme',
                    action: async (item, options) => {
                        let newScheme;
                        try {
                            newScheme = await showPromiseDialog(options.dialogContext,
                                (dprops) => <SchemeDialog
                                    {...dprops}
                                    item={item}
                                />);
                        } catch (e) {
                            return;
                        }
                        if (newScheme) {
                            await Requests.getJson({
                                type: item.type,
                                name: item.name,
                                command: 'scheme',
                                newScheme: newScheme
                            })
                            return true;
                        }
                    },
                    visible: isConnected && props.name && props.name.match(/.*\.mbtiles$/) && props.canDelete
                }))
                this.showOverlay=canEditOverlays;
                this.showScheme=isConnected && props.url && props.url.match(/.*mbtiles.*/);
                this.showImportLog=props.hasImportLog;
                this.showDownload=props.canDownload;
                if (props.originalScheme){
                    this.className+=' userAction';
                }
                this.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadCharts,false)
                this.allowedExtensions=['gemf','mbtiles','xml']; //import extensions separately
                this.hasScope=true;
                if (props.scheme){
                    this.infoRows=[{label:'Scheme',value:'scheme'}]
                }
                break;
            case 'track':
                this.headline='Tracks';
                this.actions.push(standardActions.delete.copy({
                    visible:isConnected,
                    action: async (info,dialogContext)=> {
                        if (await deleteItemQuery(info,dialogContext)){
                            await deleteRequest(info);
                            NavHandler.resetTrack();
                            return true;
                        }
                    }
                    }));
                this.actions.push(standardActions.rename.copy({
                    visible:isConnected,
                }))
                this.actions.push(standardActions.view.copy({}))
                this.showDownload=true;
                this.showConvertFunction=ext === 'gpx'?showConvertFunctions[props.type]:undefined;
                this.showOverlay=allowedOverlay && canEditOverlays;
                this.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadTracks,false)
                this.allowedExtensions=['gpx']
                this.buildExtendedInfo=async (item)=>getTrackInfo(item.name)
                this.extendedInfoRows=TRACK_INFO_ROWS;
                break;
            case 'route': {
                canModify = !props.active && props.canDelete !== false && (!props.isServer || isConnected);
                this.headline = 'Routes';
                this.showIsServer = props.server;
                this.actions.push(standardActions.delete.copy({
                    visible: canModify,
                    action: async (item, options) => {
                        if (!await deleteItemQuery(item, options.dialogContext)) return;
                        if (RouteHandler.isActiveRoute(item.name)) {
                            throw new Error("unable to delete active route")
                        }
                        await RouteHandler.deleteRoutePromise(item.name,
                            item.server //if we think this is a local route - just delete it local only
                        );
                        await removeItemsFromOverlays(item);
                        return true;
                    }
                }));
                this.actions.push(standardActions.rename.copy({
                    visible:canModify,
                    action: async (item, options) => {
                        const newName=await renameDialog(item,options);
                        if (!newName)return;
                        if (RouteHandler.isActiveRoute(item.name)) {
                            throw new Error("unable to rename active route")
                        }
                        return await RouteHandler.renameRoute(item.name,newName);
                    }
                }))
                this.actions.push(standardActions.view.copy({
                    action: async (item, options) => {
                        const route = await RouteHandler.fetchRoutePromise(item.name, !item.server)
                        options.history.push('viewpage', {
                            type: item.type,
                            name: item.name,
                            readOnly: true,
                            ext:options.getExtensionForView(item),
                            data: route.toXml()
                        });
                        return true;
                    }
                }))
                this.showEdit = mapholder.getCurrentChartEntry() !== undefined;
                this.showOverlay = canEditOverlays;
                this.showDownload = true;
                this.fixedExtension = 'gpx';
                this.infoText += "," + Formatter.formatDecimal(props.length, 4, 2) +
                    " nm, " + props.numpoints + " points";
                this.localUploadFunction = (name, data) => {
                    //name is ignored
                    try {
                        let route;
                        if (data instanceof routeobjects.Route) {
                            route = data;
                        } else {
                            route = new routeobjects.Route("");
                            route.fromXml(data);
                        }
                        if (!route.name) {
                            return Promise.reject("route has no name");
                        }
                        return RouteHandler.saveRoute(route);
                    } catch (e) {
                        return Promise.reject(e);
                    }
                }
                this.showUpload = isConnected;
                this.buildExtendedInfo=(item)=>getRouteInfo(item.name)
                this.extendedInfoRows=ROUTE_INFO_ROWS;
            }
                break;
            case 'layout':
                this.headline='Layouts';
                this.actions.push(standardActions.delete.copy({
                    visible: isConnected &&  props.canDelete !== false && ! props.active,
                    action:async (item,options)=>{
                        if (! await deleteItemQuery(item,options.dialogContext))return;
                        await layoutLoader.deleteLayout(item.name)
                        await removeItemsFromOverlays(item);
                        return true;
                    }
                }))
                this.actions.push(standardActions.view.copy({
                    action: async (item,options) => {
                        const layout = await layoutLoader.loadLayout(item.name);
                        options.history.push('viewpage', {
                            type: item.type,
                            name: item.name,
                            readOnly: true,
                            ext:options.getExtensionForView(item),
                            data:JSON.stringify(layout,undefined,"  ")
                        });
                        return true;
                    }
                }))
                this.showEdit = isConnected && editableSize && props.canDelete;
                this.showDownload = true;
                this.fixedExtension='json';
                this.localUploadFunction=(name,data,overwrite)=>{
                    return layoutLoader.uploadLayout(name,data,overwrite);
                }
                this.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadLayout,false)
                this.hasScope=true;
                break;
            case 'settings': {
                canModify= isConnected && props.canDelete !== false && !props.active;
                this.headline = 'Settings';
                this.actions.push(standardActions.delete.copy({
                    visible: canModify,
                }));
                this.actions.push(standardActions.rename.copy({
                    visible:canModify,
                }))
                this.actions.push(standardActions.view.copy({}))
                this.showEdit = isConnected && editableSize && props.canDelete;
                this.showDownload = true;
                this.fixedExtension = 'json';
                this.localUploadFunction = (name, data, overwrite) => {
                    return PropertyHandler.verifySettingsData(data, true, true)
                        .then((res) => PropertyHandler.uploadSettingsData(name, res.data, false, overwrite));
                }
                this.showUpload = isConnected && globalStore.getData(keys.gui.capabilities.uploadOverlays, false)
                this.hasScope = true;
            }
                break;
            case 'user': {
                this.headline = 'User';
                this.actions.push(standardActions.delete.copy({
                    visible: canModify,
                }))
                this.renameKeepExtension=false;
                this.actions.push(standardActions.rename.copy({
                    visible:canModify,
                }))
                this.actions.push(standardActions.view.copy({}))
                this.showEdit = editableSize && ViewPage.EDITABLES.indexOf(ext) >= 0 && props.canDelete && isConnected;
                this.showDownload = true;
                this.showApp = isConnected && ext === 'html' && globalStore.getData(keys.gui.capabilities.addons);
                this.isApp = this.showApp && props.isAddon;

            }   this.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadUser,false)
                break;
            case 'images': {
                this.headline = 'Images';
                this.actions.push(standardActions.delete.copy({
                    visible: canModify,
                }))
                this.actions.push(standardActions.rename.copy({
                    visible:canModify,
                }))
                this.actions.push(standardActions.view.copy({}))
                this.showDownload = true;
                this.showUpload = isConnected && globalStore.getData(keys.gui.capabilities.uploadImages, false)
                this.allowedExtensions = GuiHelpers.IMAGES;
            }
                break;
            case 'overlay': {
                this.headline = 'Overlays';
                this.actions.push(standardActions.delete.copy({
                    visible: isConnected && props.canDelete !== false
                }))
                this.actions.push(standardActions.rename.copy({
                    visible:canModify,
                }))
                this.actions.push(standardActions.view.copy({}))
                this.showDownload = true;
                this.showEdit = editableSize && ViewPage.EDITABLES.indexOf(ext) >= 0 && isConnected;
                this.showOverlay = canEditOverlays && allowedOverlay;
                this.showUpload = isConnected && globalStore.getData(keys.gui.capabilities.uploadOverlays, false)
            }
                break;
            case 'plugins':
                this.headline='Plugins';
                this.actions.push(standardActions.delete.copy({
                    visible: isConnected && props.canDelete !== false
                }))
                this.showRename = false;
                this.showDownload=true;
                this.showEdit= false;
                this.showOverlay = false;
                this.showUpload=isConnected && globalStore.getData(keys.gui.capabilities.uploadPlugins,false)
                this.allowedExtensions=['zip'];
                this.hasScope=true;
                this.prefixForDisplay=()=>'user-';
                break;
        }
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
                const result = await removeItemsFromOverlays(undefined, [props.current]);
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
const infoRowDisplay=(row,data)=>{
    let v=data[row.value];
    if (v === undefined) return null;
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}
export const FileDialog = (props) => {
    const [changed, setChanged] = useState(false);
    const [allowed, setAllowed] = useState(new ItemActions(props.current))
    const [extendedInfo, setExtendedInfo] = useState({});
    const dialogContext = useDialogContext();
    useEffect(() => {
        let f = allowed.buildExtendedInfo;
        if (f) {
            f(props.current).then(
                (info)=>setExtendedInfo(info),
                ()=>{}
            );
        }
    }, [allowed]);

    let extendedInfoRows = allowed.extendedInfoRows;
    const dialogButtons=allowed.getActionButtons({
        history:props.history,
        dialogContext: dialogContext,
    });
    const doneAction=useCallback((res)=>{
        if (res) Toast(res);
        props.okFunction("dummy")
    },[props.okFunction])
    dialogButtons.forEach(button=>{
        const onClick=button.onClick;
        if (onClick){
            button.onClick=async(ev,dialogContext)=>{
                try{
                    const res=await onClick(ev,dialogContext);
                    doneAction(res);
                }catch (e){
                    doneAction(e);
                }
            }
        }
    })
    return (
        <DialogFrame className="fileDialog" title={props.current.displayName||props.current.name}>
            {props.current.info !== undefined ?
                <DialogRow>
                    <span className="itemInfo">{props.current.info}</span>
                </DialogRow>
                :
                null
            }
            {allowed.infoRows && allowed.infoRows.map((row)=>{
                return infoRowDisplay(row,props.current)
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return infoRowDisplay(row, extendedInfo);
            })}
            <DialogButtons buttonList={dialogButtons}>

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


export const FileDialogWithActions=(props)=>{
    const {doneCallback,item,history,checkExists,...forward}=props;
    const dialogContext=useDialogContext();
    const actionFunction=async (action,newItem)=>{
        let doneAction=(pageChanged)=>{
            if (doneCallback){
                doneCallback(action,newItem,pageChanged)
            }
        };
        try {
            if (action === 'edit') {
                if (item.type === 'route') {
                    const route = await RouteHandler.fetchRoutePromise(item.name, !item.server);
                    let editor = new RouteEdit(RouteEdit.MODES.EDIT);
                    editor.setNewRoute(route, 0);
                    doneAction(true);
                    history.push('editroutepage', {center: true});
                } else {
                    doneAction(true);
                    history.push('viewpage', {type: item.type, name: item.name});
                }
                return;
            }
            if (action === 'userapp') {
                if (item.url) {
                    dialogContext.replaceDialog((props) =>
                            <UserAppDialog {...props} fixed={{url: item.url}} resolveFunction={() => {
                            }}/>
                        , () => doneAction())
                }
            }
            if (action === 'overlay') {
                doneAction();
                if (item.type === 'chart') {
                    return EditOverlaysDialog.createDialog(item)
                } else {
                    dialogContext.replaceDialog((props) => {
                        return (
                            <AddRemoveOverlayDialog
                                {...props}
                                current={item}
                            />
                        )
                    });
                    return;
                }
            }
            if (action === 'convert') {
                let convertFunction = showConvertFunctions[newItem.type];
                if (convertFunction) {
                    convertFunction(dialogContext, history, newItem);
                }
                return;
            }
            doneAction();
        }catch (e){
            Toast(e+"");
            doneAction();
        }
    };
    return <FileDialog
        {...forward}
        history={history}
        current={item}
        okFunction={actionFunction}
        checkName={checkExists}/>
}
