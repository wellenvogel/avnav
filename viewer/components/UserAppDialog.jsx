import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import OverlayDialog from './OverlayDialog.jsx';
import DialogContainer from './OverlayDialogDisplay.jsx';
import Toast from './Toast.jsx';
import assign from 'object-assign';
import {Checkbox,Input,InputReadOnly,InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Addons from './Addons.js';
import Helper from '../util/helper.js';
import Requests from '../util/requests.js';
import GuiHelpers from '../util/GuiHelpers.js';

export default class UserAppDialog extends React.Component{
    constructor(props){
        super(props);
        this.state=assign({},props.addon,props.fixed);
        this.state.dialog=undefined;
        this.state.iconList=[];
        this.state.userFiles=[];
        this.state.internal=true;
        let fixed=props.fixed||{};
        if (! fixed.url && this.state.keepUrl) this.state.internal=false;
        this.showDialog=this.showDialog.bind(this);
        this.fillLists();

    }
    fillLists(){
        let self=this;
        Requests.getJson("?request=list&type=user")
            .then((data)=>{
                let iconList=[];
                let userFiles=[];
                if (data.items){
                    data.items.forEach((el)=>{
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0){
                            el.label=el.url;
                            iconList.push(el);
                        }
                        if (Helper.getExt(el.name) == 'html'){
                            el.label=el.url;
                            userFiles.push(el);
                        }
                    });
                    self.setState({
                        iconList:self.state.iconList.concat(iconList),
                        userFiles:userFiles
                    });
                }
            }).catch((error)=>{});
        Requests.getJson("?request=list&type=images")
            .then((data)=>{
                let itemList=[];
                if (data.items) {
                    data.items.forEach((el)=> {
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0) {
                            el.label=el.url;
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

    checkOk(){
        if (! this.state.url){
            Toast("you must provide an url");
            return false;
        }
        if (! this.state.icon){
            Toast("you must provide an icon");
            return false;
        }
        if (! this.state.internal && ! this.state.url.startsWith("http")){
            Toast("external urls must start with http");
            return false;
        }
        return true;
    }

    render(){
        let self=this;
        let Dialog=this.state.dialog;
        let fixed=this.props.fixed||{};
        let canEdit=this.state.canDelete;
        if (canEdit === undefined) canEdit=true;
        let title="";
        if (canEdit)title=fixed.name?"Modify ":"Create ";
        return(
            <React.Fragment>
                <div className="userAppDialog">
                    <h3 className="dialogTitle">{title+'User App'}</h3>
                    {(fixed.url || ! canEdit) ?
                        <InputReadOnly
                            dialogRow={true}
                            className="url"
                            label="url"
                            value={this.state.url}/>
                        :
                        <React.Fragment>
                            {(canEdit && ! fixed.url) && <Checkbox
                                dialogRow={true}
                                label="internal"
                                value={this.state.internal}
                                onChange={(nv)=>{
                                    this.setState({internal:nv,url:undefined})
                                    }
                                }/>}
                            {!this.state.internal ?
                                <Input
                                    label="external url"
                                    value={this.state.url}
                                    minSize={30}
                                    maxSize={100}
                                    onChange={(val)=>self.setState({url:val})}/>
                                :
                                <InputSelect
                                    label="internal url"
                                    value={this.state.url}
                                    list={this.state.userFiles}
                                    showDialogFunction={this.showDialog}
                                    onChange={(selected)=>self.setState({url:selected.url})}/>
                            }
                        </React.Fragment>
                    }
                    {canEdit ?
                        <Input
                            dialogRow={true}
                            label="title"
                            value={this.state.title}
                            minSize={30}
                            maxSize={100}
                            onChange={(value)=>{self.setState({title:value})}}
                            />
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="title"
                            value={this.state.title}
                            />
                    }
                    {canEdit ?
                        <InputSelect
                            dialogRow={true}
                            label="icon"
                            value={this.state.icon}
                            list={this.state.iconList}
                            showDialogFunction={this.showDialog}
                            onChange={(selected)=>this.setState({
                                    icon:selected.url
                                })}
                            >
                            {this.state.icon && <img className="appIcon" src={this.state.icon}/>}
                        </InputSelect>
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="icon"
                            value={this.state.icon}
                            >
                            {this.state.icon && <img className="appIcon" src={this.state.icon}/>}
                         </InputReadOnly>
                    }

                    <div className="dialogButtons">
                        <DB name="ok" onClick={()=>{
                            if (! this.checkOk()) return;
                            this.props.closeCallback();
                            this.props.okFunction(assign({},this.state,fixed))
                            }}
                            disabled={!this.state.icon || ! this.state.url || !canEdit}
                            >Ok</DB>
                        <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                        {(fixed.name && this.state.canDelete && canEdit) && <DB name="delete" onClick={()=>{
                            self.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                                ()=>{
                                    this.props.closeCallback();
                                    this.props.removeFunction(fixed.name);
                                }
                                ));
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

UserAppDialog.propTypes={
    fixed: PropTypes.object.isRequired,
    addon: PropTypes.object,
    closeCallback: PropTypes.func.isRequired,
    okFunction: PropTypes.func.isRequired,
    removeFunction: PropTypes.func.isRequired
};

UserAppDialog.showUserAppDialog=(item,fixedValues,opt_showToasts)=>{
    return new Promise((resolve,reject)=> {
        OverlayDialog.dialog((props)=> {
            return (
                <UserAppDialog
                    {...props}
                    okFunction={(addon)=>{
                        Addons.updateAddon(addon.name,addon.url,addon.icon,addon.title)
                            .then((data)=>{resolve(data)})
                            .catch((error)=>{
                                if (opt_showToasts) Toast("unable to add/update: "+error);
                                reject(error);
                            });
                    }}
                    removeFunction={(name)=>{
                        Addons.removeAddon(name)
                            .then((data)=>resolve(data))
                            .catch((error)=>{
                                if (opt_showToasts) Toast("unable to remove: "+error);
                                reject(error);
                            });
                    }}
                    //TODO: item vs addon
                    addon={item}
                    fixed={fixedValues}
                    />
            )
        })
    });
};

