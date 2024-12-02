import React from 'react';
import PropTypes from 'prop-types';
import OverlayDialog, {dialogHelper} from './OverlayDialog.jsx';
import Toast from './Toast.jsx';
import assign from 'object-assign';
import {Checkbox,Input,InputReadOnly,InputSelect} from './Inputs.jsx';
import DB from './DialogButton.jsx';
import Addons from './Addons.js';
import Helper from '../util/helper.js';
import Requests from '../util/requests.js';
import GuiHelpers, {stateHelper} from '../util/GuiHelpers.js';
import UploadHandler from "./UploadHandler";
import {DBCancel, DBOk, DialogButtons, DialogFrame} from "./OverlayDialog";

const contains=(list,url,opt_key)=>{
    if (opt_key === undefined) opt_key="url";
    for (let k=0;k<list.length;k++){
        if (list[k][opt_key] === url) return true;
    }
    return false;
}
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
        this.state.uploadSequence=0;
        this.fillLists();

    }
    readImages(opt_active){
        Requests.getJson("?request=list&type=images")
            .then((data)=>{
                let itemList=[];
                let activeUrl;
                if (data.items) {
                    data.items.forEach((el)=> {
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0) {
                            if (! contains(this.state.iconList,el.url)) {
                                el.label = el.url;
                                el.value = el.url;
                                itemList.push(el);
                            }
                            if (opt_active !== undefined && el.name === opt_active){
                                activeUrl=el.url;
                            }
                        }
                    });
                    this.setState( (prevState)=>{
                        return {iconList: prevState.iconList.concat(itemList)}
                    });
                }
                if (activeUrl !== undefined){
                    this.stateHelper.setState({
                        icon:activeUrl
                    });
                }
            })
            .catch((error)=>{})
    }
    fillLists(){
        Requests.getJson("?request=list&type=user")
            .then((data)=>{
                let iconList=[];
                let userFiles=[];
                if (data.items){
                    data.items.forEach((el)=>{
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(el.name)) >= 0){
                            if (! contains(this.state.iconList,el.url)) {
                                el.label = el.url;
                                el.value = el.url;
                                iconList.push(el);
                            }
                        }
                        if (Helper.getExt(el.name) === 'html'){
                            el.label=el.url;
                            el.value=el.url;
                            userFiles.push(el);
                        }
                    });
                    this.setState( (prevState)=> {
                        return {
                            iconList: prevState.iconList.concat(iconList),
                            userFiles: userFiles
                        }
                    });
                }
            }).catch((error)=>{});
        this.readImages();
        if (!this.state.loaded) Addons.readAddOns()
            .then((addons)=>{
                let current=Addons.findAddonByUrl(addons,this.props.fixed.url)
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
        let fixed=this.props.fixed||{};
        let canEdit=this.stateHelper.getValue('canDelete',true);
        if (!this.state.loaded) canEdit=false;
        let fixedUrl=fixed.url !== undefined;
        let title="";
        if (canEdit)title=fixed.name?"Modify ":"Create ";
        return(
            <DialogFrame className="userAppDialog" flex={true} title={title+'User App'}>
                    {(fixedUrl || ! canEdit) ?
                        <InputReadOnly
                            dialogRow={true}
                            className="url"
                            label="url"
                            value={this.stateHelper.getValue('url','')}/>
                        :
                        <React.Fragment>
                            {(canEdit && ! fixedUrl) && <Checkbox
                                dialogRow={true}
                                label="internal"
                                value={this.state.internal}
                                onChange={(nv)=>{
                                    this.setState({internal:nv});
                                    this.stateHelper.setState({url:'',newWindow:false});
                                    }
                                }/>}
                            {!this.state.internal ?
                                <Input
                                    dialogRow={true}
                                    label="external url"
                                    value={this.stateHelper.getValue('url','')}
                                    minSize={50}
                                    maxSize={100}
                                    className={this.stateHelper.getValue('url')?"":"missing"}
                                    onChange={(val)=>this.stateHelper.setState({url:val})}/>
                                :
                                <InputSelect
                                    dialogRow={true}
                                    label="internal url"
                                    value={this.stateHelper.getValue('url','')}
                                    className={this.stateHelper.getValue('url')?"":"missing"}
                                    list={this.state.userFiles}
                                    showDialogFunction={this.dialogHelper.showDialog}
                                    onChange={(selected)=>this.stateHelper.setState({url:selected.url})}/>
                            }
                            <UploadHandler
                                local={false}
                                type={'images'}
                                doneCallback={(param)=>{
                                    this.readImages(param.param.name);
                                }}
                                errorCallback={(err)=>{if (err) Toast(err);}}
                                uploadSequence={this.state.uploadSequence}
                                checkNameCallback={(name)=>{
                                    return new Promise((resolve,reject)=>{
                                        if (contains(this.state.iconList,name,"name")){
                                            reject(name+" already exists");
                                            return;
                                        }
                                        let ext=Helper.getExt(name);
                                        let rt={name:name};
                                        if (GuiHelpers.IMAGES.indexOf(ext) < 0){
                                            reject("only images of types "+GuiHelpers.IMAGES.join(","));
                                            return;
                                        }
                                        resolve(rt);
                                });}}
                                />
                        </React.Fragment>
                    }
                    {canEdit ?
                        <Input
                            dialogRow={true}
                            label="title"
                            value={this.stateHelper.getValue('title','')}
                            minSize={50}
                            maxSize={100}
                            onChange={(value)=>{this.stateHelper.setState({title:value})}}
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
                            list={[{label:'--upload new--',value:undefined,upload:true}].concat(this.state.iconList)}
                            showDialogFunction={this.dialogHelper.showDialog}
                            className={this.stateHelper.getValue('icon')?"":"missing"}
                            onChange={(selected)=>{
                                if (selected.upload) {
                                    this.setState({uploadSequence: this.state.uploadSequence + 1});
                                    return;
                                }
                                this.stateHelper.setState({
                                    icon:selected.url
                                });
                            }}
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


                    <DialogButtons buttonList={[
                        {name:'delete',
                            label:'Delete',
                            onClick:()=>{
                                this.dialogHelper.showDialog(OverlayDialog.createConfirmDialog("really delete User App?",
                                    ()=>{
                                        this.props.closeCallback();
                                        this.props.removeFunction(this.stateHelper.getValue('name'));
                                    }
                                ));
                            },
                            visible:!!(this.stateHelper.getValue('name') && this.stateHelper.getValue('canDelete') && canEdit)
                        },
                        DBCancel(this.props.closeCallback),
                        DBOk(()=>{
                            if (! this.checkOk()) return;
                            this.props.closeCallback();
                            this.props.okFunction(assign({},this.stateHelper.getValues(),this.props.fixed))
                        },
                            {disabled: !this.stateHelper.getValue('icon') || ! this.stateHelper.getValue('url')|| !canEdit})
                    ]}/>
            </DialogFrame>
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

