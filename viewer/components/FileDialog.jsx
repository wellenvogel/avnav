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
import {Input, Radio} from "./Inputs";
import DB from "./DialogButton";
import Requests from "../util/requests";
import Toast from "./Toast";
import EditOverlaysDialog,{DEFAULT_OVERLAY_CONFIG} from "./EditOverlaysDialog";
import OverlayDialog from "./OverlayDialog";
import globalStore from "../util/globalstore";
import ViewPage from "../gui/ViewPage";
import assign from 'object-assign';
import history from "../util/history";
import LayoutHandler from "../util/layouthandler";
import base from "../base";
import NavHandler from "../nav/navdata";
import UserAppDialog from "./UserAppDialog";

const RouteHandler=NavHandler.getRoutingHandler();

export const getExt=(name)=>{
    if (!name) return;
    return name.replace(/.*\./,'').toLocaleLowerCase();
};
export const allowedItemActions=(props)=>{
    if (! props) return {};
    let isConnected=globalStore.getData(keys.properties.connectedMode,true);
    let ext=getExt(props.name);
    if (props.type === 'route') ext="gpx";
    if (props.type === 'layout') ext="json";
    let showView=(props.type === 'overlays' || props.type === 'user' || props.type==='images' || (props.type === 'route' && props.server) || props.type === 'track' || props.type === 'layout') && ViewPage.VIEWABLES.indexOf(ext)>=0;
    let showEdit=(isConnected && (((props.type === 'overlays' || props.type === 'user') && props.size !== undefined && props.size < ViewPage.MAXEDITSIZE)|| (props.type === 'layout' && props.canDelete)  ) && ViewPage.EDITABLES.indexOf(ext) >=0);
    let showDownload=false;
    if (props.canDownload || props.type === "track"
        || props.type === "route"
        || props.type === 'layout'){
        showDownload=true;
    }
    let showDelete=!props.active;
    if (props.canDelete !== undefined){
        showDelete=props.canDelete && ! props.active;
    }
    if (! isConnected && (props.type !== 'route' || props.isServer)) showDelete=false;
    let showRename=isConnected && (props.type === 'user' || props.type === 'images' || props.type === 'overlays' );
    let showApp=isConnected && (props.type === 'user' && ext === 'html' && globalStore.getData(keys.gui.capabilities.addons));
    let isApp=(showApp && props.isAddon);
    let showOverlay=(isConnected && props.type === 'chart' && globalStore.getData(keys.gui.capabilities.uploadOverlays));
    let showScheme=(props.type === 'chart' && props.url && props.url.match(/.*mbtiles.*/));
    return {
        showEdit:showEdit,
        showView:showView,
        showDownload:showDownload,
        showDelete:showDelete,
        showRename:showRename,
        showApp:showApp,
        isApp:isApp,
        showOverlay: showOverlay,
        showScheme: showScheme,
    };
};

export default  class FileDialog extends React.Component{
    constructor(props){
        super(props);
        this.state={
            changed:false,
            existingName:false,
            name:props.current.name,
            scheme:props.current.scheme,
            allowed:allowedItemActions(props.current)
        };
        this.onChange=this.onChange.bind(this);
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
                        <DB name="cancel"
                            onClick={self.props.closeCallback}
                        >
                            Cancel
                        </DB>
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
                                    self.props.okFunction('overlays',this.props.current);
                                }}
                                disabled={this.state.changed}
                            >
                                Overlays
                            </DB>
                            :
                            null
                        }
                        {(this.state.allowed.showDownload && ! this.props.noDownload) ?
                            <DB name="download"
                                onClick={()=>{
                                    self.props.closeCallback();
                                    self.props.okFunction('download',this.props.current);
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
                                this.props.okFunction('userapp',this.props.current);
                            }}
                            disabled={this.state.changed}
                        >
                            App
                        </DB>

                        }
                    </div>
                </div>
            </React.Fragment>
        );
    }
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
            Requests.getJson('', {}, {
                request: 'delete',
                type: info.type,
                name: info.name
            })
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

export const showFileDialog=(item,opt_downloadCallback,opt_doneCallback,opt_checkExists)=>{
    let actionFunction=(action,newItem)=>{
        let doneAction=()=>{
            if (opt_doneCallback){
                opt_doneCallback(action,newItem)
            }
        };
        let schemeAction=(newScheme)=>{
            return Requests.getJson('?request=api&type='+encodeURIComponent(item.type)+
                "&command=scheme&name="+encodeURIComponent(item.name)+"&url="+encodeURIComponent(item.url)+
                "&newScheme="+encodeURIComponent(newScheme));
        };
        let renameAction=(name,newName)=>{
            Requests.getJson('?request=api&type='+encodeURIComponent(item.type)+
                "&command=rename&name="+encodeURIComponent(name)+
                "&newName="+encodeURIComponent(newName))
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
            doneAction()
            history.push('viewpage',{type:item.type,name:item.name});
            return;
        }
        if (action === 'userapp'){
            UserAppDialog.showUserAppDialog(undefined, {url:item.url})
                .then((data)=>doneAction())
                .catch((error)=>doneAction());
        }
        if (action === 'download'){
            if (opt_downloadCallback){
                opt_downloadCallback(item);
            }
            return;
        }
        if (action === 'delete'){
            return deleteItem(item,doneAction);
        }
        if (action === 'overlays'){
            doneAction();
            return EditOverlaysDialog.createDialog(item, item.chartKey === DEFAULT_OVERLAY_CONFIG)
        }
    };
    OverlayDialog.dialog((props)=>{
        return(
            <FileDialog
                {...props}
                noDownload={!opt_downloadCallback}
                okFunction={actionFunction}
                current={item}
                checkName={opt_checkExists}
            />
        );
    });
};
