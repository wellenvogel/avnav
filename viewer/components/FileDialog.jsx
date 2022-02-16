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
import React from "react";
import keys from '../util/keys.jsx';
import {Input, InputSelect, Radio} from "./Inputs";
import DB from "./DialogButton";
import Requests from "../util/requests";
import Toast from "./Toast";
import EditOverlaysDialog, {KNOWN_OVERLAY_EXTENSIONS,DEFAULT_OVERLAY_CHARTENTRY} from "./EditOverlaysDialog";
import OverlayDialog, {dialogHelper, InfoItem} from "./OverlayDialog";
import globalStore from "../util/globalstore";
import ViewPage from "../gui/ViewPage";
import assign from 'object-assign';
import LayoutHandler from "../util/layouthandler";
import base from "../base";
import NavHandler from "../nav/navdata";
import Helper from '../util/helper';
import UserAppDialog from "./UserAppDialog";
import DownloadButton from "./DownloadButton";
import TrackInfoDialog, {TrackConvertDialog} from "./TrackInfoDialog";
import {getTrackInfo,INFO_ROWS as TRACK_INFO_ROWS} from "./TrackInfoDialog";
import {getRouteInfo,INFO_ROWS as ROUTE_INFO_ROWS} from "./RouteInfoDialog";
import RouteEdit from "../nav/routeeditor";
import mapholder from "../map/mapholder";
import LogDialog from "./LogDialog";
import {stateHelper} from "../util/GuiHelpers";
import Formatter from '../util/formatter';
import routeobjects from "../nav/routeobjects";
import PropertyHandler from "../util/propertyhandler";

const RouteHandler=NavHandler.getRoutingHandler();
/**
 * additional parameters that should be included in server requests
 * if they are set at the item
 * @type {{url: boolean, chartKey: boolean}}
 */
export const additionalUrlParameters={
    url:true,
    chartKey:true
}

export const ItemDownloadButton=(props)=>{
    let {item,...forwards}=props;
    if (item.canDownload === false) return null;
    let localData=getLocalDataFunction(item);
    return <DownloadButton
        {...forwards}
        url={localData?undefined:getDownloadUrl(item)}
        fileName={getDownloadFileName(item)}
        localData={localData}
        type={item.type}
        androidUrl={item.url}
        />
}
const getLocalDataFunction=(item)=>{
    if (item.type === 'route' && ! item.server){
        return ()=>{ return RouteHandler.getLocalRouteXml(item.name)}
    }
    if (item.type === 'layout'){
        return LayoutHandler.getLocalDownload(item.name);
    }
}
const getDownloadFileName=(item)=>{
    let actions=ItemActions.create(item,false);
    return actions.nameForDownload(item.name);
}
const getDownloadUrl=(item)=>{
    let name=item.name;
    if (item.type==='route') {
        if (item.server === false) return;
        if (! name.match(/\.gpx$/)) name+=".gpx";
    }
    let url=globalStore.getData(keys.properties.navUrl)+"?request=download&type="+
        encodeURIComponent(item.type)+"&name="+
        encodeURIComponent(name)+"&filename="+encodeURIComponent(getDownloadFileName(item));
    for (let k in additionalUrlParameters){
        if (item[k] !== undefined){
            url+="&"+k+"="+encodeURIComponent(item[k])
        }
    }
    return url;
}

const showConvertFunctions = {
    track: (history,item) => {
        TrackConvertDialog.showDialog(history,item.name);
    }
}

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
        this.showDownload=false;
        this.showIsServer=false;
        this.timeText='';
        this.infoText='';
        this.className='';
        this.extForView='';
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
         * @param name
         * @returns {*}
         */
        this.nameForDownload=(name)=>name;
        /**
         * convert a local file name into an entity name as the server would create
         * @param name
         * @returns {*}
         */
        this.nameForUpload=(name)=>name;
    }
    static create(props,isConnected){
        if (typeof(props) === 'string') props={type:props};
        if (! props || ! props.type){
            return new ItemActions();
        }
        let rt=new ItemActions(props.type);
        let ext=Helper.getExt(props.name);
        let viewable=ViewPage.VIEWABLES.indexOf(ext)>=0;
        let editableSize=props.size !== undefined && props.size < ViewPage.MAXEDITSIZE;
        let allowedOverlay=KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(props.name,true)) >= 0;
        let canEditOverlays=globalStore.getData(keys.gui.capabilities.uploadOverlays) && isConnected;
        if (props.time !== undefined) {
            rt.timeText=Formatter.formatDateTime(new Date(props.time*1000));
        }
        rt.infoText=props.name;
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
                rt.showDownload=props.canDelete;
                if (props.originalScheme){
                    rt.className+=' userAction';
                }
                break;
            case 'track':
                rt.headline='Tracks';
                rt.showDelete=true;
                rt.showDownload=true;
                rt.showView=viewable;
                rt.showConvertFunction=ext === 'gpx'?showConvertFunctions[props.type]:undefined;
                rt.showOverlay=allowedOverlay && canEditOverlays;
                break;
            case 'route':
                rt.headline='Routes';
                rt.showIsServer=props.isServer;
                rt.showDelete= ! props.active &&  props.canDelete !== false  && ( ! props.isServer || isConnected);
                rt.showView=viewable;
                rt.showEdit=mapholder.getCurrentChartEntry() !== undefined;
                rt.showOverlay=canEditOverlays;
                rt.showDownload=true;
                rt.extForView='gpx';
                rt.infoText+=","+Formatter.formatDecimal(props.length,4,2)+
                    " nm, "+props.numpoints+" points";
                rt.nameForDownload=(name)=>{
                    if (! name.match(/\.gpx$/)) name+=".gpx";
                    return name;
                }
                rt.nameForUpload=(name)=>{
                    return name.replace(/\.gpx$/,'');
                }
                rt.localUploadFunction=(name,data)=>{
                    //name is ignored
                    try{
                        let route=new routeobjects.Route("");
                        route.fromXml(data);
                        if (! route.name){
                            return Promise.reject("route has no name");
                        }
                        return RouteHandler.saveRoute(route);
                    } catch(e){
                        return Promise.reject(e);
                    }
                }
                break;
            case 'layout':
                rt.headline='Layouts';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = true;
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.extForView='json';
                rt.nameForDownload=(name)=>{
                    return LayoutHandler.nameToBaseName(name)+".json";
                }
                rt.nameForUpload=(name)=>{
                    return LayoutHandler.fileNameToServerName(name);
                }
                rt.localUploadFunction=(name,data,overwrite)=>{
                    return LayoutHandler.uploadLayout(name,data,overwrite);
                }
                break;
            case 'settings':
                rt.headline='Settings';
                rt.showDelete=isConnected && props.canDelete !== false && ! props.active;
                rt.showView = true;
                rt.showEdit = isConnected && editableSize && props.canDelete;
                rt.showDownload = true;
                rt.showRename=isConnected && props.canDelete;
                rt.extForView='json';
                rt.nameForDownload=(name)=>{
                    return name.replace(/^user\./,'').replace(/^system\./,'').replace(/^plugin/,'')+".json";
                }
                rt.nameForUpload=(name)=>{
                    let serverName=name;
                    ['user','system','plugin'].forEach((prefix)=>{
                        if (serverName.indexOf(prefix+".") === 0){
                            serverName=serverName.substr(prefix.length+1);
                        }
                    });
                    return 'user.'+serverName.replace(/\.json$/,'');
                }
                rt.localUploadFunction=(name,data,overwrite)=>{
                   return PropertyHandler.verifySettingsData(data, true,true)
                       .then((res) => PropertyHandler.uploadSettingsData(name,res.data,false,overwrite));
                }
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
                break;
            case 'images':
                rt.headline='Images';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                break;
            case 'overlay':
                rt.headline='Overlays';
                rt.showDelete = isConnected && props.canDelete !== false;
                rt.showView = viewable;
                rt.showRename = isConnected && props.canDelete !== false;
                rt.showDownload=true;
                rt.showEdit= editableSize && ViewPage.EDITABLES.indexOf(ext) >=0 && isConnected;
                rt.showOverlay = canEditOverlays && allowedOverlay;
                break;
        }
        return rt;
    }
}

const getImportLogUrl=(name)=>{
    return globalStore.getData(keys.properties.navUrl)+
        "?request=api&type=import&command=getlog&name="+encodeURIComponent(name);
}


class AddRemoveOverlayDialog extends React.Component{
    constructor(props) {
        super(props);
        this.state={};
        this.state.chartList=[DEFAULT_OVERLAY_CHARTENTRY];
        this.state.chart=DEFAULT_OVERLAY_CHARTENTRY.chartKey
        this.state.action='add';
        this.state.changed=false;
        this.titles={add:"Add to Charts",remove:"Remove from Charts"}
        this.dialogHelper=dialogHelper(this);
    }
    componentDidMount() {
        Requests.getJson('',{},{
            request:'list',
            type:'chart'
        })
            .then((data)=>{
                this.setState({
                    chartList:this.state.chartList.concat(data.items)
                })
            })
            .catch((error)=>Toast("unable to read chart list: "+error));
    }

    action(){
        if (this.state.action === 'remove'){
            Requests.getJson('',{},{
                request: 'api',
                type:'chart',
                command:'deleteFromOverlays',
                name:this.props.current.name,
                itemType:this.props.current.type
            })
                .then(()=>{})
                .catch((error)=>{Toast(error)})
            return;
        }
        if (this.state.action === 'add'){
            let chart=this.findChart(this.state.chart);
            if (! chart) return;
            EditOverlaysDialog.createDialog(chart,
                undefined,
                this.props.current
                );
            return;
        }
    }
    findChart(chartKey){
        for (let i=0;i<this.state.chartList.length;i++){
            if (this.state.chartList[i].chartKey === chartKey) return this.state.chartList[i];
        }
    }
    getChartSelectionList(){
        if (this.state.action === 'remove'){
            return {label:DEFAULT_OVERLAY_CHARTENTRY.name,value:DEFAULT_OVERLAY_CHARTENTRY.chartKey};
        }
        let rt=[];
        this.state.chartList.forEach((chart)=>{
            if (! chart.chartKey) return;
            rt.push({label:chart.name,value:chart.chartKey});
        })
        return rt;
    }
    getCurrentChartValue(){
        if (this.state.action === 'remove'){
            return {label:'All Charts',value:undefined};
        }
        return(
            {
                label:(this.findChart(this.state.chart) || {}).name,
                value:this.state.chart
            })
    }
    render(){
        return (
            <div className="AddRemoveOverlayDialog flexInner">
                <h3 className="dialogTitle">On Charts</h3>
                <div className={"dialogRow"}>
                    <span className="itemInfo">{this.props.current.name}</span>
                </div>
                <Radio
                    dialogRow={true}
                    label={"Action"}
                    value={this.state.action}
                    onChange={(v)=>{this.setState({changed:true,action:v})}}
                    itemList={[{label:this.titles.add,value:"add"},{label:this.titles.remove,value:"remove"}]}
                    />
                <InputSelect
                    dialogRow={true}
                    label="Chart"
                    value={this.getCurrentChartValue()}
                    onChange={(v) => {
                        this.setState({changed: true, chart: v})
                    }}
                    changeOnlyValue={true}
                    showDialogFunction={this.dialogHelper.showDialog}
                    itemList={this.getChartSelectionList()}
                />
                <div className="dialogButtons">
                    <DB name="cancel"
                        onClick={()=>{
                            this.props.closeCallback();
                        }}
                        >Cancel</DB>
                    <DB name="ok"
                        onClick={()=>{
                            this.action();
                            this.props.closeCallback()
                        }}>Ok</DB>
                </div>
            </div>
        )
    }
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
export default  class FileDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            changed:false,
            existingName:false,
            name:props.current.name,
            scheme:props.current.scheme,
            allowed:ItemActions.create(props.current,globalStore.getData(keys.properties.connectedMode,true))
        };
        this.onChange=this.onChange.bind(this);
        this.extendedInfo=stateHelper(this,{},'extendedInfo');
    }
    componentDidMount() {
        let f=INFO_FUNCTIONS[this.props.current.type];
        if (f){
            f(this.props.current.name).then((info)=>{
                this.extendedInfo.setState(info,true);
            }).catch(()=>{});
        }
    }

    infoRowDisplay(row,data){
        let v=data[row.value];
        if (v === undefined) return null;
        if (row.formatter) v=row.formatter(v,data);
        if (v === undefined) return null;
        return <InfoItem label={row.label} value={v}/>
    }
    onChange(newName){
        if (newName === this.state.name) return;
        if (newName === this.props.current.name){
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
        let rename=this.state.changed && ! this.state.existingName && (this.state.name !== this.props.current.name);
        let schemeChanged=this.state.allowed.showScheme && (((this.props.current.scheme||"tms") !== this.state.scheme)|| this.props.current.originalScheme);
        let extendedInfoRows=TYPE_INFO_ROWS[this.props.current.type];
        return(
            <React.Fragment>
                <div className="fileDialog flexInner">
                    <h3 className="dialogTitle">{this.props.current.name}</h3>
                    {this.props.current.info !== undefined?
                        <div className="dialogRow">
                            <span className="itemInfo">{this.props.current.info}</span>
                        </div>
                        :
                        null
                    }
                    {INFO_ROWS.map((row)=>{
                        return this.infoRowDisplay(row,this.props);
                    })}
                    {extendedInfoRows && extendedInfoRows.map((row)=>{
                        return this.infoRowDisplay(row,this.extendedInfo.getState());
                    })}
                    {(this.state.allowed.showScheme && this.props.current.originalScheme) &&
                    <div className="dialogRow userAction">
                    <span className="inputLabel">
                        original DB scheme
                    </span>
                        <span className="value">
                        {this.props.current.originalScheme}
                    </span>

                    </div>
                    }
                    {this.state.allowed.showScheme &&
                    <Radio
                        label="scheme"
                        value={this.state.scheme}
                        onChange={(v)=>{this.setState({changed:true,scheme:v})}}
                        itemList={[{label:"xyz",value:"xyz"},{label:"tms",value:"tms"}]}
                        className="mbtilesType"/>

                    }
                    {this.state.allowed.showRename ?
                        <div className="dialogRow">
                            <Input
                                label={this.state.existingName?"existing":"new name"}
                                className={cn}
                                value={this.state.name}
                                onChange={this.onChange}
                            />
                        </div>
                        : null
                    }
                    <div className="dialogButtons">
                        {(this.state.allowed.showRename || this.state.allowed.showScheme)?
                            <DB name="ok"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    let action="";
                                    if (rename) action+="rename";
                                    if (schemeChanged){
                                        if (this.props.current.scheme !== this.state.scheme) {
                                            if (action === "") action = "scheme";
                                            else action += ",scheme";
                                        }
                                    }
                                    self.props.okFunction(action,
                                        assign({},this.props.current,{name:this.state.name,scheme:this.state.scheme}));
                                }}
                                disabled={!rename && ! schemeChanged}
                            >
                                Change
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
                    <div className="dialogButtons">
                        {this.state.allowed.showImportLog &&
                            <DB name={'log'}
                                onClick={()=>{
                                    this.props.closeCallback();
                                    OverlayDialog.dialog((dprops)=>{
                                        return <LogDialog {...dprops}
                                                          baseUrl={getImportLogUrl(this.props.current.name)}
                                                          title={'Import Log'}
                                        />
                                    })
                                }}
                                >Log</DB>
                        }
                        {this.state.allowed.showConvert &&
                            <DB name="toroute"
                                onClick={()=>{
                                    this.props.closeCallback()
                                    this.props.okFunction('convert',this.props.current);
                                }}
                                >Convert</DB>
                        }
                        {(this.state.allowed.showView )?
                            <DB name="view"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('view',this.props.current);
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
                                    self.props.okFunction('edit',this.props.current);
                                }}
                                disabled={this.state.changed}
                            >
                                Edit
                            </DB>
                            :
                            null
                        }
                        {(this.state.allowed.showOverlay)?
                            <DB name="overlays"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('overlay',this.props.current);
                                }}
                                disabled={this.state.changed}
                            >
                                Overlays
                            </DB>
                            :
                            null
                        }
                        <ItemDownloadButton
                            name="download"
                            disabled={this.state.changed}
                            item={this.props.current || {}}
                            useDialogButton={true}
                            onClick={this.props.closeCallback}
                        >
                            Download
                        </ItemDownloadButton>
                        {(this.state.allowed.showApp) &&
                        <DB name="userApp"
                            onClick={()=>{
                                this.props.closeCallback();
                                this.props.okFunction('userapp',this.props.current);
                            }}
                            disabled={this.state.changed}
                        >
                            App
                        </DB>

                        }
                        <DB name="cancel"
                            onClick={self.props.closeCallback}
                        >
                            Cancel
                        </DB>
                    </div>
                </div>
            </React.Fragment>
        );
    }
}
const buildRequestParameters=(request,item,opt_additional)=>{
    return assign({},Helper.filteredAssign(additionalUrlParameters,item),
        opt_additional,
        {
            request: request,
            type: item.type,
            name:item.name
        })
}
export const deleteItem=(info,opt_resultCallback)=> {
    let doneAction=()=> {
        if (opt_resultCallback) opt_resultCallback(info);
    };
    let ok = OverlayDialog.confirm("delete " + info.name + "?");
    ok.then(function () {
        if (info.type === 'layout') {
            if (LayoutHandler.deleteItem(info.name)) {
                doneAction();
                return;
            }
            doneAction();
        }
        if (info.type !== "route") {
            Requests.getJson('', {}, buildRequestParameters('delete',info))
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

export const showFileDialog=(history,item,opt_doneCallback,opt_checkExists)=>{
    let actionFunction=(action,newItem)=>{
        let doneAction=()=>{
            if (opt_doneCallback){
                opt_doneCallback(action,newItem)
            }
        };
        let schemeAction=(newScheme)=>{
            return Requests.getJson('',{},
                buildRequestParameters('api',item,
                    {command:'scheme',newScheme:newScheme}));
        };
        let renameAction=(name,newName)=>{
            Requests.getJson('',{},
                buildRequestParameters('api',item,
                    {command:'rename',newName:newName}))
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
            doneAction();
            history.push('viewpage',{type:item.type,name:item.name,readOnly:true});
            return;
        }
        if (action === 'edit'){
            doneAction();
            if (item.type === 'route'){
                RouteHandler.fetchRoute(item.name,false,
                    (route)=>{
                        let editor=new RouteEdit(RouteEdit.MODES.EDIT);
                        editor.setNewRoute(route,0);
                        history.push('editroutepage',{center:true});
                    },
                    (error)=>Toast(error));
                return;
            }
            history.push('viewpage',{type:item.type,name:item.name});
            return;
        }
        if (action === 'userapp'){
            UserAppDialog.showUserAppDialog(undefined, {url:item.url})
                .then((data)=>doneAction())
                .catch((error)=>doneAction());
        }
        if (action === 'delete'){
            return deleteItem(item,doneAction);
        }
        if (action === 'overlay'){
            doneAction();
            if (item.type === 'chart') {
                return EditOverlaysDialog.createDialog(item )
            }
            else{
                OverlayDialog.dialog((props)=>{
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
            let convertFunction=showConvertFunctions[newItem];
            if (convertFunction){
                convertFunction(history,newItem);
            }
            return;
        }
    };
    OverlayDialog.dialog((props)=>{
        return(
            <FileDialog
                {...props}
                okFunction={actionFunction}
                current={item}
                checkName={opt_checkExists}
            />
        );
    });
};
