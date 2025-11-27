/**
 *###############################################################################
 # Copyright (c) 2012-2025 Andreas Vogel andreas@wellenvogel.net
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
import EditOverlaysDialog, {DEFAULT_OVERLAY_CHARTENTRY, KNOWN_OVERLAY_EXTENSIONS} from "./EditOverlaysDialog";
import {
    DBCancel,
    DBOk,
    DialogButtons,
    DialogFrame,
    DialogRow,
    showPromiseDialog,
    useDialogContext
} from "./OverlayDialog";
import ViewPage from "../gui/ViewPage";
import {layoutLoader} from "../util/layouthandler";
import NavHandler from "../nav/navdata";
import Helper from '../util/helper';
import UserAppDialog from "./UserAppDialog";
import DownloadButton from "./DownloadButton";
import {getTrackInfo, INFO_ROWS as TRACK_INFO_ROWS, TrackConvertDialog} from "./TrackConvertDialog";
import {getRouteInfo, INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoHelper";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";
import LogDialog from "./LogDialog";
import Formatter from '../util/formatter';
import PropertyHandler from "../util/propertyhandler";
import {ConfirmDialog, InfoItem} from "./BasicDialogs";
import {checkName, ItemNameDialog, safeName} from "./ItemNameDialog";
import GuiHelpers from "../util/GuiHelpers";
import {DEFAULT_OVERLAY_CONFIG, removeItemsFromOverlays, renameItemInOverlays} from "../map/overlayconfig";
import {useHistory} from "./HistoryProvider";
import globalStore from '../util/globalstore';
import {readTextFile} from "./UploadHandler";
import routeobjects from "../nav/routeobjects";
import ImportDialog, {checkExt, readImportExtensions} from "./ImportDialog";
import PropTypes from "prop-types";
import {BlobReader, ZipReader} from "@zip.js/zip.js";
import {listItems} from "../util/itemFunctions";


const RouteHandler=NavHandler.getRoutingHandler();

const getExtensionForView=(item)=>{
    if (item.extension) return item.extension.replace(/^\./,'');
    return Helper.getExt(item.name);
}

const plainNameForCheck=(item)=>{
    if (! item) return;
    return item.name;
}
const scopedNameForCheck=(item)=>{
    if (! item || ! item.name) return;
    if (! item.checkPrefix) return;
    return item.name.substring(item.checkPrefix.length);
}
/**
 * handler for uploads based on file type
 */
class UploadAction{
    constructor({type,accessor}){
        this.type=type;
        this.checkAccessor=accessor||((item)=>item.name);
        this.preCheck=undefined; //a function that returns an object with name and potentially error, final
                                 //leaving name unset will cancel
        this.postCheck=undefined;//same as pre check
        this.withDialog=true;
        this.localAction=undefined;//if set you can consume the file. Return undefined
        this.doneAction=undefined; //called when the upload is finished
        this.userData=undefined;
        this.fixedPrefix=false;
    }
    copy(updates){
        const rt=new this.constructor(this);
        for (let k of Object.keys(this)){
            rt[k]=this[k];
        }
        if (updates && updates instanceof Object){
            for (let k in updates){
                rt[k]=updates[k];
            }
        }
        rt.userData=undefined;
        return rt;
    }

    /**
     * check a file name
     * @param file
     * @param dialogContext
     * @returns {Promise<{proposal: *, error: string}|*>}
     */
    async _check(file,dialogContext){
        const checkRes=(res,completeResult)=>{
            if (! res) return true;
            if (res.error){
                throw new Error(rs.error)
            }
            Object.assign(completeResult,res);
            if (! res.name){
                delete completeResult.name;
            }
            if (res.final){
                return true;
            }
            return false;
        }
        let rs={name:file.name};
        this.userData={};
        if (this.preCheck){
            if (checkRes(await Helper.awaitHelper(this.preCheck(this.userData,file.name,file,dialogContext)),rs)) return rs;
        }
        const existing = await listItems(rs.type||this.type);
        const accessor=(data)=>this.checkAccessor(data);
        if (this.withDialog){
            if (checkRes(await uploadCheckNameDialog({
                dialogContext,
                name:rs.name,
                keepExtension: true,
                nameForCheck: accessor,
                itemList:existing,
                checkFirst:true,
                fixedPrefix: this.fixedPrefix
            }),rs)) return rs;
        }
        else {
                const oname=rs.name;
                let crs = checkName(rs.name, existing, accessor);
                if (! crs){
                    crs={name:oname}
                }
                if (checkRes(crs,rs)) return rs;
        }
        if (this.postCheck) {
            if (checkRes(await Helper.awaitHelper(this.postCheck(this.userData, rs.name, file, dialogContext,existing, accessor)),rs)) return rs;
        }
        if (this.localAction){
            return await Helper.awaitHelper(this.localAction(this.userData,rs.name,file))
        }
        return rs;
    }
    /**
     * check a file when being opened by a file input
     * will reject if it does not match
     * @param file
     * @param dialogContext
     * @returns {{}}
     */
    async checkFile(file,dialogContext){
        const nameCheck=await this._check(file,dialogContext);
        if (! nameCheck || ! nameCheck.name){
            return ;
        }
        if (nameCheck.error){
            return Promise.reject(nameCheck.error);
        }
        return {
            ...nameCheck,
            file:file
        }
    }
    hasLocalAction(){
        return !!this.localAction;
    }
    async afterUpload(){
        if (this.doneAction){
            return await Helper.awaitHelper(this.doneAction(this.userData));
        }
        return false;
    }
}
class Action{
    constructor({label,name,action,visible,close,disabled,fixedExtension,hasScope}) {
        this.label=label;
        this.action=action;
        this.visible=visible;
        this.name=name;
        this.close=close;
        this.disabled=disabled;
        this.fixedExtension=fixedExtension;
        this.hasScope=hasScope||false;
        this.runAction=this.runAction.bind(this);
    }
    copy(updates){
        const rt=new this.constructor({});
        for (let k of Object.keys(this)){
            rt[k]=this[k];
        }
        if (updates && updates instanceof Object){
            for (let k in updates){
                rt[k]=updates[k];
            }
        }
        return rt;
    }

    /**
     * helper that calls the action function
     * @param ev
     * @param item the item
     * @returns {Promise<void>} resolves to undefined on success
     * @private
     */
    async _ahelper(ev, item,dialogContext,history){
        if (typeof this.action === 'function') {
            let rs = this.action(this,item,dialogContext,history);
            if (rs instanceof Promise) {
                rs=await rs;
            }
            if (rs && dialogContext && Helper.unsetorTrue(this.close)) {
                dialogContext.closeDialog();
            }
        }
    }
    _fhelper(name,item){
        const target=this[name];
        if (typeof target === 'function'){
            return target(this,item);
        }
        return !!target;
    }
    async runAction(item,dialogContext,history){
        return this._ahelper({},item,dialogContext,history);

    }
    isVisible(item){
       return  this._fhelper('visible',item)
    }
    getButton(item){
        if (! this.isVisible(item)) return null;
        return this.getButtonImpl(item);
    }
    getButtonImpl(item){
        return (props)=> {
            const history=useHistory();
            return <DB
            name={this.name}
            visible={ this._fhelper('visible',item)}
            label={this.label}
            onClick={ async (ev, dialogContext) => {
                try {
                    await this._ahelper(ev, item, dialogContext, history);
                }catch (e){
                    if (e) Toast(e+"");
                }
            }}
            close= {false}
            disabled={this._fhelper('disabled',item)}
            >{this.label}</DB>}
    }

}

class DownloadAction extends Action{
    constructor({url,localData,fileName,...values}) {
        super(values);
        this.url=url;
        this.localData=localData;
        this.fileName=fileName;
    }

    getButtonImpl(item) {
        // eslint-disable-next-line react/display-name
        return (props)=>{
            return <DownloadButton
                {...props}
                fileName={this._fhelper('fileName',item)}
                url={this._fhelper('url',item)}
                localData={this.localData}
                name={this.name}
                useDialogButton={true}
            >{this.label}</DownloadButton>;
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

export const uploadCheckNameDialog=async ({dialogContext, type,name,keepExtension,nameForCheck,itemList,checkFirst,fixedPrefix})=>{
    if (! itemList){
        if (type) {
            itemList = await listItems(type);
        }
        else{
            itemList=[];
        }
    }
    if (! nameForCheck) nameForCheck=(item)=>item.name;
    if (checkFirst){
        let rf=checkName(name); //check for allowed name
        if (rf.error){
            return Promise.reject(rf.error);
        }
        rf=checkName(name,itemList,nameForCheck);
        if (! rf.error){
            return {name:name};
        }
    }
    try{
        const res=await showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
            title={`${name} already exists, select new name`}
            {...dprops}
            iname={name}
            keepExtension={keepExtension}
            fixedPrefix={fixedPrefix}
            checkName={(name)=>{
                const [fn,ext]=Helper.getNameAndExt(name);
                if (! name || (keepExtension && ! fn)){
                    return {
                        error: 'must not be empty',
                        proposal: name
                    }
                }
                return checkName(name,itemList,nameForCheck);
            }}
        />);
        return {name:res.name}
    } catch (e){
        return;
    }
}

const renameDialog=async({item,dialogContext,hasScope,nameForCheck,keepExtension,list})=>{
    let fixedPrefix=undefined;
    let dname=item.name;
    if (hasScope){
        fixedPrefix=item.checkPrefix;
        if (! fixedPrefix) throw new Error("can only rename user items");
        dname=dname.substr(fixedPrefix.length);
    }
    let itemList=list;
    if (! itemList){
        itemList=await listItems(item.type);
    }
    if (! nameForCheck) nameForCheck=hasScope?scopedNameForCheck:plainNameForCheck;
    try{
        const res=await showPromiseDialog(dialogContext,(dprops)=><ItemNameDialog
            title={`Rename ${item.displayName||item.name}`}
            {...dprops}
            iname={dname}
            fixedPrefix={fixedPrefix}
            keepExtension={keepExtension}
            checkName={(name)=>{
                const [fn,ext]=Helper.getNameAndExt(name);
                if (! name || (keepExtension && ! fn)){
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
            action: async (action,item,dialogContext)=>{
                return await deleteItem(item,dialogContext)
            }
        }),
    rename: new Action({
        label: 'Rename',
        name: 'Rename',
        action: async (action, item, dialogContext) => {
            let newName = await renameDialog({
                item,
                dialogContext,
                hasScope: action.hasScope,
                keepExtension: action.keepExtension,
                nameForCheck: action.nameForCheck
            });
            if (!newName) return;
            const rs=await action.execute(item, newName);
            if (action.hasScope && item.checkPrefix){
                //the overlay rename handling will just take the newName as is
                //and for scoped items the names will contain the prefix
                //fortunately we only can rename items that have the checkPrefix set
                //this way we can safely construct the new name from checkPrefix and name
                //in general currently scoped items (layouts,settings) cannot be part of overlays
                //but to be prepared for the future we should be clean here
                newName=item.checkPrefix+newName;
            }
            await renameItemInOverlays(undefined,item,newName)
            return rs;
        }
    }).copy({
        execute: async (item, newName) => {
            await renameRequest(item, newName);
            return true;
        }
    }),
    view: new Action({
        label: 'View',
        name: 'view',
        action: async (action,item,dialogContext,history)=>{
            history.push('viewpage', {type: item.type, name: item.name, readOnly: true,ext:action.fixedExtension||getExtensionForView(item)});
            return true;
        },
        visible: (action,item)=>{
            let ext=action.fixedExtension||getExtensionForView(item);
            return ViewPage.VIEWABLES.indexOf(ext)>=0;
        }
    }),
    download:new DownloadAction({
       label:'Download',
       name: 'download',
       visible:  (action,item)=>{
           return item.canDownload
       },
       fileName:(action,item)=>action.downloadName||item.downloadName,
       url:(action,item)=>{
           return prepareUrl({
               type:item.type,
               command:'download',
               name:item.name,
               filename: action.downloadName||item.downloadName
           })
       }

    }),
    edit: new Action({
        label: 'Edit',
        name: 'edit',
        action: async (action,item,dialogContext,history)=>{
            history.push('viewpage', {type: item.type, name: item.name, ext:action.fixedExtension||getExtensionForView(item)});
            return true;
        },
        visible: false,
        close: true
    }),
    overlays: new Action({
        label: 'Overlays',
        name: 'overlays',
        action: async (action,item,dialogContext,history)=>{
            dialogContext.replaceDialog((props) => {
                return (
                    <AddRemoveOverlayDialog
                        {...props}
                        current={item}
                    />
                )
            });
        },
        visible: false
    })

}
export class ItemActions{
    constructor(type) {
        this.type=type;
        this.headline=type
        this.fixedExtension=undefined; //if set we always remove this from names before sending to the server and expect files to have this
        this.allowedExtensions=undefined; //allowed file extensions for upload, cen be left empty if fixed extension is set or if all are allowed
        this.hasScope=false;
        /**
         * if this is set call this function to upload a new item
         * instead of the normal server upload
         * the function must expect name and data and optonally an overwrite flag
         * as parameters and return a promise
         * the resolves true when the upload succeeds
         * @type {undefined}
         */
        this.localUploadFunction=undefined;

        this.build();
        this.postCreate()
    }
    postCreate(){
        this.nameForCheck=this.nameForCheck.bind(this);
        this.prefixForDisplay=this.prefixForDisplay.bind(this);
        this.getExtensionForView=this.getExtensionForView.bind(this);
        if (! this.allowedExtensions){
            if (this.fixedExtension){
                this.allowedExtensions=[this.fixedExtension];
            }
        }
    }
    getExtensionForView(item){
        if (this.fixedExtension){
            return this.fixedExtension;
        }
        return getExtensionForView(item);
    }

    /**
     * convert an item.name into a base name that can be used
     * to upload a new item
     * this will strip the prefix (and if a fixedExtension is there it will also strip this)
     * @param name
     * @returns {*}
     */
    nameToBaseName(name){
        if (! name) return name;
        if (this.hasScope) {
            name = name.replace(/^user\./, '').replace(/^system\./, '').replace(/^plugin\.[^.]*[.]*/, '');
        }
        if (this.fixedExtension && Helper.endsWith(name.toLowerCase(),"."+this.fixedExtension)){
            name=name.substring(0,name.length-this.fixedExtension.length-1);
        }
        return name;
    }
    /**
     * get a name from a list entry to compare against a local file name
     * @param item an entry from the list
     * @param opt_ext - if true add an fixed extension
     */
    nameForCheck(item,opt_ext){
        const res=this.hasScope?scopedNameForCheck(item):plainNameForCheck(item);
        if (! opt_ext || ! res || ! this.fixedExtension) return res;
        return res+"."+this.fixedExtension;
    }
    /**
     * get a prefix to be shown in upload/rename dialogs
     * @returns {string|undefined}
     */
    prefixForDisplay(){
        return this.hasScope?'user.':undefined;
    }
    /**
     * convert an entity name as received from the server to a name we offer when downloading
     * @returns {*}
     */
    nameForDownload(item){
        if (item.downloadName) return item.downloadName;
        let name=item.name||item.type||"download";
        if (item.checkPrefix) name=name.substring(item.checkPrefix.length);
        if (this.fixedExtension) name=name+"."+this.fixedExtension;
        return name;
    }
    canModify(item) {
        return item.canDelete && (! item.server || this.isConnected());
    }
    canView(item) {
        return false;
    }
    showIsServer(item){
        return false;
    }
    getIconClass(item){
        if (item.isDirectory) return 'directory';
        return this.type;
    }
    showUpload(){
        return this.isConnected();
    }
    async buildExtendedInfo(item){
        return {}
    }
    getExtendedInfoRows(item){
        return  [];
    }
    fillActions(item,actions){

    }
    getUploadAction(){
        let rt=new UploadAction({type:this.type,accessor:(data)=>this.nameForCheck(data)});
        if (! this.fixedExtension && (! this.allowedExtensions || this.allowedExtensions.length < 1)){
            return rt;
        }
        const nameChecker=(userData,name)=> {
            const [fn, ext] = Helper.getNameAndExt(name);
            const err=this.checkExtension(ext);
            if (err) throw new Error(err);
            if (this.fixedExtension){
                return {name:fn};
            }
            return {name:name};
        }
        return rt.copy({
            preCheck:nameChecker,
            fixedPrefix: this.prefixForDisplay(),
        })
    }
    getActionButtons(item){
        const actions= [];
        this.fillActions(item,actions);
        const rt=[];
        actions.forEach(action=>{
            if (action.isVisible(item)){
                rt.push(action.getButton(item));
            }
        })
        return rt;
    }
    getActions(item,filter){
        class ActionList extends Array{
            constructor(filter) {
                super();
                this.filter=filter;
                if (this.filter && ! (this.filter instanceof Array)){
                    this.filter = [this.filter]
                }
            }

            push(...items) {
                let l=this.length;
                for (let item of items) {
                    if (! this.filter || this.filter.indexOf(item.name) >= 0){
                        l=super.push(item);
                    }
                }
                return l;
            }
        }
        const actions=new ActionList(filter);
        this.fillActions(item,actions);
        actions.filter=undefined;
        return actions;
    }

    /**
     * check for allowed extensions, return an error text if not allowed
     * @param ext
     * @param opt_title
     */
    checkExtension(ext,opt_title){
        if (! ext || ! this.allowedExtensions) return ;
        if (this.allowedExtensions.indexOf(ext) >=0) return;
        const title=opt_title?opt_title+": ":"";
        return title+`extension ${ext} not allowed, only `+this.allowedExtensions.join(",");

    }
    isConnected(){
        return globalStore.getData(keys.properties.connectedMode);
    }
    canEditOverlays(){
        return globalStore.getData(keys.gui.capabilities.uploadOverlays) && this.isConnected();
    }
    getInfoRows(item){
        return [
            {label:'Time',value:'time',formatter:(v,item)=>this.getTimeText(item)},
            {label:'Size',value:'size',formatter:(v)=>{
                if (v === 0) return undefined;
                if (v < 10*1024) return v;
                if (v < 10*1024*1024) return (v/1024).toFixed(1)+" k";
                return (v/(1024*1024)).toFixed(1)+ " M";
                }}
        ]
    }
    getTimeText(item){
        if (item.time !== undefined) {
            return Formatter.formatDateTime(new Date(item.time*1000));
        }
    }
    getInfoText(item){
        return item.displayName||item.name
    }
    getClassName(item){
        return item.isActive?"activeEntry":undefined;
    }
    build(){
    }
}

let lastChartImportSubDir=undefined;
class ChartItemActions extends ItemActions{
    constructor() {
        super('chart');
    }
    build(){
        this.headline='Charts';
        this.allowedExtensions=['gemf','mbtiles','xml']; //import extensions separately
        this.hasScope=true;

    }
    getInfoRows(item) {
        let rows=super.getInfoRows(item);
        if (item.scheme){
            rows=rows.concat([{label:'Scheme',value:'scheme'}] );
        }
        return rows;
    }
    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadCharts,false);
    }
    fillActions(item,actions) {
        actions.push(new Action({
            label: 'Open',
            name: 'openchart',
            action: (action,item,dialogContext,history)=>{
                mapholder.setChartEntry(item);
                history.push('navpage');
            },
            visible: item.name !== DEFAULT_OVERLAY_CONFIG
        }))
        actions.push(standardActions.delete.copy({
            visible: this.canModify(item)
        }));
        actions.push(new Action({
            name: 'scheme',
            label: 'Scheme',
            action: async (action,item, dialogContext) => {
                let newScheme;
                try {
                    newScheme = await showPromiseDialog(dialogContext,
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
            visible: this.canModify(item) && item.name && item.name.match(/.*\.mbtiles$/)
        }))
        actions.push(standardActions.download.copy({}))
        actions.push(new Action({
            name: 'overlays',
            label: 'Overlays',
            action: async (action,item, dialogContext) => {
                EditOverlaysDialog.createDialog(item,()=>dialogContext.closeDialog());
            },
            visible: this.canEditOverlays(),
            close: false
        }))
        actions.push(new Action({
            name:'log',
            label: 'Log',
            action: async (action,item,dialogContext) => {
                dialogContext.replaceDialog((dprops) => {
                    return <LogDialog {...dprops}
                                      baseUrl={prepareUrl({
                                          type:'import',
                                          command:'getlog',
                                          name:item.name
                                      })}
                                      title={'Import Log'}
                    />
                })
            },
            close: false,
            visible:item.hasImportLog
        }))
    }

    getUploadAction() {
        const action=super.getUploadAction();
        return action.copy({
            preCheck:async (userData, name, file, dialogContext)=>{
                const [fn, ext] = Helper.getNameAndExt(name);
                const err=this.checkExtension(ext);
                if (! err){
                    return {name:name}
                }
                const importExtensions=(await readImportExtensions())||[];
                const importConfig=checkExt(ext,importExtensions);
                if (!importConfig.allow){
                    throw new Error(err);
                }
                const impres=await showPromiseDialog(dialogContext,
                    (dprops)=> {
                        userData.history=useHistory();
                        return <ImportDialog
                            {...dprops}
                            allowNameChange={true}
                            allowSubDir={importConfig.subdir}
                            name={name}
                            subdir={lastChartImportSubDir}
                        />
                    }
                    )
                if (impres){
                    if (impres.subdir) {
                        lastChartImportSubDir = impres.subdir;
                        impres.options={subdir:impres.subdir};
                        userData.subdir=impres.subdir;
                        delete impres.subdir;
                    }
                    userData.importer=true;
                    impres.final=true;
                }
                return impres;
            },
            doneAction:(userData)=>{
                if (userData.importer && userData.history){
                    userData.history.push('importerpage',{subdir:userData.subdir});
                }
            }
        })
    }
}

class RouteItemActions extends ItemActions{
    constructor() {
        super('route');
    }
    build(){
        this.headline = 'Routes';
        this.fixedExtension='gpx';
    }

    showUpload() {
        return super.showUpload();
    }

    async buildExtendedInfo(item) {
        return getRouteInfo(item.name);
    }

    getExtendedInfoRows(item) {
        return ROUTE_INFO_ROWS;
    }

    canModify(item) {
        return !item.active && item.canDelete !== false &&
            (!item.server || this.isConnected()) &&
            ! RouteHandler.isActiveRoute(item.name)
    }

    canView(item) {
        return true;
    }

    showIsServer(item) {
        return item.server;
    }

    fillActions(item, actions) {
        const canModify = this.canModify(item);
        actions.push(standardActions.delete.copy({
            visible: canModify,
            action: async (action,item, dialogContext) => {
                if (!await deleteItemQuery(item, dialogContext)) return;
                if (RouteHandler.isActiveRoute(item.name)) {
                    throw new Error("unable to delete active route")
                }
                await RouteHandler.deleteRoutePromise(item.name,
                    !item.server //if we think this is a local route - just delete it local only
                );
                await removeItemsFromOverlays(item);
                return true;
            }
        }));
        actions.push(standardActions.rename.copy({
            visible:canModify,
            action: async (action,item, dialogContext) => {
                const newName=await renameDialog({
                    item,
                    dialogContext,
                    keepExtension:false});
                if (!newName)return;
                if (RouteHandler.isActiveRoute(item.name)) {
                    throw new Error("unable to rename active route")
                }
                const rs= await RouteHandler.renameRoute(item.name,newName);
                await renameItemInOverlays(undefined,item,newName);
                return rs;
            }
        }))
        actions.push(standardActions.view.copy({
            action: async (action,item, dialogContext,history) => {
                const route = await RouteHandler.fetchRoutePromise(item.name, !item.server)
                history.push('viewpage', {
                    type: item.type,
                    name: item.name,
                    readOnly: true,
                    ext:this.getExtensionForView(),
                    data: route.toXml()
                });
                return true;
            }
        }))
        actions.push(standardActions.edit.copy({
            visible:canModify && mapholder.getCurrentChartEntry() !== undefined,
            action: async (action,item, dialogContext,history) => {
                const route = await RouteHandler.fetchRoutePromise(item.name, !item.server);
                let editor = new RouteEdit(RouteEdit.MODES.EDIT);
                editor.setNewRoute(route, 0);
                history.push('editroutepage', {center: true});
                return true;
            }
        }))
        actions.push(standardActions.download.copy({
            localData: item.server?undefined:
                ()=>RouteHandler.getLocalRouteXml(item.name),
            downloadName: this.nameForDownload(item)
        }))
        actions.push(standardActions.overlays.copy({
            visible: this.canEditOverlays()
        }))
    }

    getUploadAction() {
        let action=super.getUploadAction();
        return action.copy({
            preCheck: async (userData, name, file)=>{
                const [fn, ext] = Helper.getNameAndExt(name);
                if (ext !== this.fixedExtension) throw new Error(`only ${this.fixedExtension} for routes`);
                const data=readTextFile(file);
                userData.nroute=new routeobjects.Route();
                userData.nroute.fromXml(data);
                if (!userData.nroute.name) {
                    userData.nroute.name = fn;
                }
                return {
                    name:userData.nroute.name
                }
            },
            withDialog: true,
            localAction: async (userData,name,file)=>{
                if (!userData.nroute) throw new Error("no route after upload");
                userData.nroute.name=name;
                await RouteHandler.saveRoute(userData.nroute);
            }
        })
    }
}

class TrackItemActions extends ItemActions{
    constructor() {
        super('track');
    }


    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadTracks,false);
    }

    async buildExtendedInfo(item) {
        return getTrackInfo(item.name)
    }

    getExtendedInfoRows(item) {
        return TRACK_INFO_ROWS;
    }

    canModify(item) {
        return this.isConnected();
    }

    canView(item) {
        return Helper.getExt(item.name) === 'gpx';
    }

    fillActions(item, actions) {
        actions.push(standardActions.delete.copy({
            visible:this.isConnected(),
            action: async (action,info,dialogContext)=> {
                if (await deleteItemQuery(info,dialogContext)){
                    await deleteRequest(info);
                    NavHandler.resetTrack();
                    return true;
                }
            }
        }));
        actions.push(standardActions.rename.copy({
            visible:this.isConnected(),
        }))
        actions.push(standardActions.view.copy({
            visible:Helper.getExt(item.name)==='gpx'
        }))
        actions.push(standardActions.download.copy({}))
        actions.push(standardActions.overlays.copy({
            visible:this.canEditOverlays() && KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0,
        }))
        actions.push(new Action({
            name:'toroute',
            label: 'ToRoute',
            action:(action,info,dialogContext)=>{
                dialogContext.replaceDialog(()=><TrackConvertDialog name={item.name}/>);
            },
            visible: Helper.getExt(item.name)==='gpx'
        }))

    }
    build() {
        this.allowedExtensions=['gpx'];
        this.headline='Tracks';
    }

    getIconClass(item) {
        const [fn,ext]=Helper.getNameAndExt(item.name);
        if (ext === 'gpx') return this.type;
        return "user other";
    }
}
class LayoutItemActions extends ItemActions{
    constructor() {
        super('layout');
    }


    canModify(item) {
        return super.canModify(item) && ! item.active;
    }

    canView(item) {
        return true;
    }

    fillActions(item, actions) {
        actions.push(standardActions.delete.copy({
            visible: this.canModify(item) ,
            action:async (action,item,dialogContext)=>{
                if (! await deleteItemQuery(item,dialogContext))return;
                await layoutLoader.deleteLayout(item.name)
                await removeItemsFromOverlays(item);
                return true;
            }
        }))
        actions.push(standardActions.view.copy({
            action: async (action,item,dialogContext,history) => {
                const layout = await layoutLoader.loadLayout(item.name);
                history.push('viewpage', {
                    type: item.type,
                    name: item.name,
                    readOnly: true,
                    ext:this.getExtensionForView(),
                    data:JSON.stringify(layout,undefined,"  ")
                });
                return true;
            }
        }))
        actions.push(standardActions.edit.copy({
            visible: this.isConnected() && item.size !== undefined && item.size < ViewPage.MAXEDITSIZE && item.canDelete
        }))
        actions.push(standardActions.download.copy({
            localData: ()=>layoutLoader.getLocalDownload(item.name)
        }))
    }

    build() {
        this.headline='Layouts';
        this.hasScope=true;
        this.fixedExtension='json';
    }
    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadLayout,false);
    }
}

class SettingsItemActions extends ItemActions{
    constructor() {
        super('settings');
    }

    canModify(item) {
        return this.isConnected() && item.canDelete !== false && !item.active;
    }

    canView(item) {
        return true;
    }

    fillActions(item, actions) {
        const canModify= this.isConnected() && item.canDelete !== false && !item.active;
        actions.push(standardActions.delete.copy({
            visible: canModify,
        }));
        actions.push(standardActions.rename.copy({
            visible:canModify,
            keepExtension:false,
            hasScope: true
        }))
        actions.push(standardActions.view.copy({}))
        actions.push(standardActions.edit.copy({
            visible: canModify && item.size !== undefined && item.size < ViewPage.MAXEDITSIZE
        }))
        actions.push(standardActions.download.copy({}))
    }

    build() {
        this.headline='Settings';
        this.hasScope=true;
        this.fixedExtension='json';
    }
    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadSettings,false);
    }

    getUploadAction() {
        return super.getUploadAction().copy({
            localAction: async (userData,name,file)=>{
                const data=await readTextFile(file);
                const verified=await PropertyHandler.verifySettingsData(data, true,true)
                await PropertyHandler.uploadSettingsData(name,verified.data,false,false);
            }
        });
    }
}
class UserItemActions extends ItemActions{
    constructor() {
        super('user');
    }

    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadUser,false);
    }
    canView(item) {
        return standardActions.view.isVisible(item);
    }
    fillActions(item, actions) {
        const canModify= this.canModify(item);
        actions.push(standardActions.delete.copy({
            visible: canModify,
        }))
        actions.push(standardActions.rename.copy({
            visible:canModify,
        }))
        actions.push(standardActions.view.copy({}))
        actions.push(standardActions.edit.copy({
            visible: canModify && item.size !== undefined && item.size < ViewPage.MAXEDITSIZE
                && ViewPage.EDITABLES.indexOf(Helper.getExt(item.name)) >= 0
        }))
        actions.push(standardActions.download.copy({}))
        actions.push(new Action({
            name: 'userApp',
            label: 'App',
            action: async (action,item,dialogContext,history)=>{
                dialogContext.replaceDialog((props) =>
                    <UserAppDialog {...props} fixed={{url: item.url}} resolveFunction={() => {
                    }}/>)
            },
            visible:this.isConnected() && Helper.getExt(item.name)==='html'
        }))
    }

    build() {
        this.headline='User';
    }

    getIconClass(item) {
        const specialNames=['user.js','user.css','keys.json','splitkeys.json','images.json'];
        if (specialNames.indexOf(item.name) >= 0){
            return 'user special';
        }
        const [fn,ext]=Helper.getNameAndExt(item.name);
        if (GuiHelpers.IMAGES.indexOf(ext)>= 0){
            return 'images';
        }
        if (ext === 'html'){
            return 'user html'
        }
        if (ext === 'txt'){
            return 'text';
        }
        return 'user other';
    }
}
class ImageItemActions extends ItemActions{
    constructor() {
        super('images');
    }
    canView(item) {
        return standardActions.view.isVisible(item);
    }
    fillActions(item, actions) {
        let canModify=this.canModify(item);
        actions.push(standardActions.delete.copy({
            visible: canModify,
        }))
        actions.push(standardActions.rename.copy({
            visible:canModify,
            keepExtension:true,
        }))
        actions.push(standardActions.view.copy({}))
        actions.push(standardActions.download.copy({}))
    }

    build() {
       this.headline = 'Images';
       this.allowedExtensions = GuiHelpers.IMAGES;
    }
}

class OverlayItemActions extends ItemActions{
    constructor() {
        super('overlay');
    }
    canView(item) {
        return standardActions.view.isVisible(item);
    }
    fillActions(item, actions) {
        let canModify=this.canModify(item);
        actions.push(standardActions.delete.copy({
            visible: canModify,
        }))
        actions.push(standardActions.rename.copy({
            visible:canModify,
            keepExtension:false,
        }))
        actions.push(standardActions.view.copy({}))
        actions.push(standardActions.edit.copy({
            visible: item.size !== undefined && item.size < ViewPage.MAXEDITSIZE &&
                ViewPage.EDITABLES.indexOf(Helper.getExt(item.name)) >= 0
                && canModify
        }))
        actions.push(standardActions.download.copy({}))
        actions.push(standardActions.overlays.copy({
            visible:this.canEditOverlays() && KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0,
        }))
    }

    build() {
       this.headline = 'Overlays';
    }
    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadOverlays, false);
    }

    getIconClass(item) {
        const [fn,ext]=Helper.getNameAndExt(item.name);
        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(ext) >= 0) return this.type;
        return "user other"
    }
}
class PluginItemActions extends ItemActions{
    constructor() {
        super('plugins');
    }

    showUpload() {
        return super.showUpload() && globalStore.getData(keys.gui.capabilities.uploadPlugins, false);
    }

    fillActions(item, actions) {
        actions.push(standardActions.delete.copy({
            visible: this.canModify(item),
        }))
        actions.push(standardActions.download.copy({}))
    }

    build() {
        this.headline='Plugins';
        this.hasScope=true;
        this.allowedExtensions=['zip'];
    }

    prefixForDisplay() {
        return 'user-';
    }

    getIconClass(item) {
        return this.type;
    }

    getUploadAction() {
        return super.getUploadAction().copy({
            preCheck: async (userData, name, file, dialogContext)=> {
                const [fn, ext] = Helper.getNameAndExt(name);
                const accessor = (data) => this.nameForCheck(data);
                if (ext !== 'zip') throw new Error("only zip files for plugins");
                const existingItems = await listItems(this.type);
                const check = async (foundName) => {
                    let existing = checkName(foundName);
                    if (existing && existing.error) {
                        throw new Error(`the found plugin ${foundName} has an invalid name: ${existing.error}`);
                    }
                    existing = checkName(foundName, existingItems, accessor);
                    if (existing && existing.error) {
                        const res = await showPromiseDialog(dialogContext, (dprops) => <ConfirmDialog
                            {...dprops}
                            title={`plugin ${foundName} already exists`}
                            text={'Update the existing plugin?'}
                        />);
                        if (res) {
                            return {
                                name: foundName,
                                final: true,
                                options: {overwrite: true}
                            }
                        }
                        return;
                    }
                    return {name: foundName,final:true};
                }
                if (typeof TransformStream == "undefined") {
                    const foundName = fn;
                    const res = await showPromiseDialog(dialogContext, (dprops) => <ConfirmDialog
                        {...dprops}
                        title={"Old browser"}
                        text={"Your browser seems to be too old to check the zip file.\n" +
                            "If the plugin directory is equal to the name of the zip we can import any way.\n" +
                            "Try the import?"
                        }
                        className={'pre'}
                    />)
                    if (res) {
                        return check(foundName);
                    }
                    return;
                }
                const pluginfiles = ['plugin.py', 'plugin.js', 'plugin.css', 'plugin.json'];
                const forbiddenBaseChars = new RegExp('[^0-9a-zA-Z_-]');
                const zipFileReader = new BlobReader(file);
                const zipReader = new ZipReader(zipFileReader);
                let foundName;
                const entries = await zipReader.getEntries()
                let hasFiles = false;
                entries.forEach(entry => {
                    if (!entry.filename) {
                        throw new Error("invalid entry in zip without filename")
                    }
                    const parts = entry.filename.split("/");
                    if (parts.length < 1) {
                        throw new Error( "invalid entry in zip without filename")
                    }
                    if (!entry.directory && parts.length < 2) {
                        throw new Error(`files must be located in a sub directory in the zip: ${entry.filename}`)
                    }
                    if (!parts[0]){
                        throw new Error(`first part in a filename must not be empty: ${entry.filename}`);
                    }
                    parts.forEach(part => {
                        if (part === '') return;
                        const sname = safeName(part);
                        if (sname !== part || part === '.' || part === '..') {
                            throw new Error( `invalid characters in file name ${entry.filename} (${part})`)
                        }
                    })
                    if (foundName) {
                        if (parts[0] !== foundName) {
                            throw new Error(`all files in zip must be under one sub directory ${foundName} : ${entry.filename}`)
                        }
                    } else {
                        foundName = parts[0];
                        if (forbiddenBaseChars.test(foundName)) {
                            throw new Error(`the plugin directory contains forbidden characters ${foundName}`)
                        }
                    }
                    if (!entry.directory) {
                        if (parts.length === 2 && pluginfiles.indexOf(parts[1]) >= 0) {
                            hasFiles = true;
                        }
                    }
                })
                if (!hasFiles) {
                    throw new Error( "no plugin files in zip")
                }
                return check(foundName);
            }
        })
    }
}
const ITEM_TYPE_ACTIONS={
    chart: new ChartItemActions(),
    route: new RouteItemActions(),
    track: new TrackItemActions(),
    layout: new LayoutItemActions(),
    settings: new SettingsItemActions(),
    user: new UserItemActions(),
    images: new ImageItemActions(),
    overlay: new OverlayItemActions(),
    plugins: new PluginItemActions(),
}

export const createItemActions=(type)=>{
    if (type instanceof Object) {
        type=type.type
    }
    if (type){
        const rt=ITEM_TYPE_ACTIONS[type];
        if (rt) return rt;
    }
    return new ItemActions(type||'dummy');
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
        listItems('chart')
            .then((data) => {
                setChartList(
                    chartList.concat(data)
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
AddRemoveOverlayDialog.propTypes = {
    current: PropTypes.object.isRequired,
}
const infoRowDisplay=(row,data)=>{
    let v=data[row.value];
    if (v === undefined) return null;
    if (row.formatter) v=row.formatter(v,data);
    if (v === undefined) return null;
    return <InfoItem label={row.label} value={v}/>
}
export const FileDialog = (props) => {
    const allowed=createItemActions(props.current.type);
    const [extendedInfo, setExtendedInfo] = useState({});
    useEffect(() => {
        allowed.buildExtendedInfo(props.current)
        .then(
                (info)=>setExtendedInfo(info),
                ()=>{}
            );
    }, [props.current.type]);

    let extendedInfoRows = allowed.getExtendedInfoRows(props.current);
    const dialogButtons=allowed.getActionButtons(props.current);
    const doneAction=useCallback((res)=>{
        if (res) Toast(res);
        if (props.okFunction)props.okFunction()
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
            {allowed.getInfoRows(props.current).map((row)=>{
                return infoRowDisplay(row,props.current)
            })}
            {extendedInfoRows && extendedInfoRows.map((row) => {
                return infoRowDisplay(row, extendedInfo);
            })}
            <DialogButtons buttonList={dialogButtons}>
                <DB name="cancel"
                >
                    Cancel
                </DB>
            </DialogButtons>
        </DialogFrame>
    );

}

FileDialog.propTypes = {
    current: PropTypes.object.isRequired,
    okFunction: PropTypes.func
}
