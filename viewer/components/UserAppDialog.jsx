import React from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {dialogHelper,stateHelper} from './OverlayDialog.jsx';
import Toast from './Toast.jsx';
import assign from 'object-assign';
import {Checkbox,Input,InputReadOnly,InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Addons from './Addons.js';
import Helper from '../util/helper.js';
import Requests from '../util/requests.js';
import GuiHelpers from '../util/GuiHelpers.js';

export default  class UserAppDialog extends React.Component{
    constructor(props){
        super(props);
        this.stateHelper=stateHelper(this,assign({},props.addon,props.fixed),'addon');
        this.dialogHelper=dialogHelper(this);
        this.state.iconList=[];
        this.state.userFiles=[];
        this.state.addons=[];
        this.state.internal=true;
        this.state.loaded=(props.fixed||{}).url === undefined || props.addon !== undefined; //addons loaded (for fixed)
        if (this.state.loaded && (props.addon||{}).keepUrl) this.state.internal=false;
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
                            el.value=el.url;
                            iconList.push(el);
                        }
                        if (Helper.getExt(el.name) === 'html'){
                            el.label=el.url;
                            el.value=el.url;
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
                            el.value=el.url;
                            itemList.push(el);
                        }
                    });
                    self.setState({iconList: self.state.iconList.concat(itemList)});
                }
            })
            .catch((error)=>{})
        if (!this.state.loaded) Addons.readAddOns()
            .then((addons)=>{
                let current=Addons.findAddonByUrl(addons,self.props.fixed.url)
                if (current) this.stateHelper.setState(assign({},current,this.props.fixed));
                this.setState({loaded:true})
            })
            .catch((error)=>Toast("unable to load addons: "+error));

    }


    checkOk(){
        let current=this.stateHelper.getValues();
        if (! current.url){
            Toast("you must provide an url");
            return false;
        }
        if (! current.icon){
            Toast("you must provide an icon");
            return false;
        }
        if (! this.state.internal && ! current.url.startsWith("http")){
            Toast("external urls must start with http");
            return false;
        }
        return true;
    }

    render(){
        let self=this;
        let fixed=this.props.fixed||{};
        let canEdit=this.stateHelper.getValue('canDelete',true);
        if (!this.state.loaded) canEdit=false;
        let fixedUrl=fixed.url !== undefined;
        let title="";
        if (canEdit)title=fixed?"Modify ":"Create ";
        return(
            <React.Fragment>
                <div className="userAppDialog">
                    <h3 className="dialogTitle">{title+'User App'}</h3>
                    {(fixedUrl || ! canEdit) ?
                        <InputReadOnly
                            dialogRow={true}
                            className="url"
                            label="url"
                            value={this.stateHelper.getValue('url')}/>
                        :
                        <React.Fragment>
                            {(canEdit && ! fixedUrl) && <Checkbox
                                dialogRow={true}
                                label="internal"
                                value={this.state.internal}
                                onChange={(nv)=>{
                                    this.setState({internal:nv});
                                    this.stateHelper.setState({url:undefined,newWindow:false});
                                    }
                                }/>}
                            {!this.state.internal ?
                                <Input
                                    dialogRow={true}
                                    label="external url"
                                    value={this.stateHelper.getValue('url')}
                                    minSize={50}
                                    maxSize={100}
                                    onChange={(val)=>self.stateHelper.setState({url:val})}/>
                                :
                                <InputSelect
                                    dialogRow={true}
                                    label="internal url"
                                    value={this.stateHelper.getValue('url')}
                                    list={this.state.userFiles}
                                    showDialogFunction={this.dialogHelper.showDialog}
                                    onChange={(selected)=>self.stateHelper.setState({url:selected.url})}/>
                            }
                        </React.Fragment>
                    }
                    {canEdit ?
                        <Input
                            dialogRow={true}
                            label="title"
                            value={this.stateHelper.getValue('title')}
                            minSize={50}
                            maxSize={100}
                            onChange={(value)=>{self.stateHelper.setState({title:value})}}
                            />
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="title"
                            value={this.stateHelper.getValue('title')}
                            />
                    }
                    {canEdit ?
                        <InputSelect
                            dialogRow={true}
                            label="icon"
                            value={this.stateHelper.getValue('icon')}
                            list={this.state.iconList}
                            showDialogFunction={this.dialogHelper.showDialog}
                            onChange={(selected)=>this.stateHelper.setState({
                                    icon:selected.url
                                })}
                            >
                            {this.stateHelper.getValue('icon') && <img className="appIcon" src={this.stateHelper.getValue('icon')}/>}
                        </InputSelect>
                        :
                        <InputReadOnly
                            dialogRow={true}
                            label="icon"
                            value={this.stateHelper.getValue('icon')}
                            >
                            {this.stateHelper.getValue('icon') && <img className="appIcon" src={this.stateHelper.getValue('icon')}/>}
                         </InputReadOnly>
                    }
                    {canEdit && ! this.state.internal &&<Checkbox
                        dialogRow={true}
                        label={'newWindow'}
                        value={this.stateHelper.getValue('newWindow') === 'true'}
                        onChange={(nv)=>{
                            this.stateHelper.setState({newWindow:nv?'true':'false'});
                        }}
                    />}


                    <div className="dialogButtons">
                        {(this.stateHelper.getValue('name') && this.stateHelper.getValue('canDelete') && canEdit) && <DB name="delete" onClick={()=>{
                            self.dialogHelper.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                                ()=>{
                                    this.props.closeCallback();
                                    this.props.removeFunction(this.stateHelper.getValue('name'));
                                }
                            ));
                        }}>Delete</DB>}
                        <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                        <DB name="ok" onClick={()=>{
                            if (! this.checkOk()) return;
                            this.props.closeCallback();
                            this.props.okFunction(assign({},this.stateHelper.getValues(),this.props.fixed))
                            }}
                            disabled={!this.stateHelper.getValue('icon') || ! this.stateHelper.getValue('url')|| !canEdit}
                            >Ok</DB>

                    </div>
                </div>
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

UserAppDialog.showUserAppDialog=(item,fixed,opt_showToasts)=>{
    return new Promise((resolve,reject)=> {
        if (! item && ! (fixed||{}).url){
            let err="either addon or fixed.url required";
            if (opt_showToasts) Toast(err);
            reject(err);
        }
        OverlayDialog.dialog((props)=> {
            return (
                <UserAppDialog
                    {...props}
                    okFunction={(addon)=>{
                        Addons.updateAddon(addon.name,addon.url,addon.icon,addon.title,addon.newWindow)
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
                    fixed={fixed}
                    />
            )
        })
    });
};

