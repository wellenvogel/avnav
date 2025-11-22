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
import UploadHandler  from "../components/UploadHandler";
import {
    FileDialogWithActions, createItemActions, listItems, FileDialog
} from '../components/FileDialog';
import EditOverlaysDialog, {DEFAULT_OVERLAY_CHARTENTRY} from '../components/EditOverlaysDialog';
import PropertyHandler from '../util/propertyhandler';
import ImportDialog, {checkExt, readImportExtensions} from "../components/ImportDialog";
import {checkName, ItemNameDialog, safeName} from "../components/ItemNameDialog";
import routeobjects from "../nav/routeobjects";
import {EditDialogWithSave, getTemplate} from "../components/EditDialog";
import {BlobReader, ZipReader} from "@zip.js/zip.js";
import {ConfirmDialog} from "../components/BasicDialogs";
import {DEFAULT_OVERLAY_CONFIG} from "../map/overlayconfig";
NavHandler.getRoutingHandler();
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

    let actions=createItemActions(props);
    let  cls=Helper.concatsp("listEntry",actions.getClassName(props));
    let dataClass="downloadItemData";
    return(
        <div className={cls} onClick={function(ev){
            props.onClick(setav(ev,{action:'select'}));
        }}>
            {(props.icon)?
                <span className="icon" style={{backgroundImage:"url('"+(props.icon)+"')"}}/>
                :
                <span className={Helper.concatsp('icon',actions.getIconClass(props))}/>
            }
            <div className="itemMain">
                <div className={dataClass}>
                    <div className="date">{actions.getTimeText(props)}</div>
                    <div className="info">{actions.getInfoText(props)}</div>
                </div>
                <div className="infoImages">
                    { actions.canModify(props) && <span className="icon edit"></span>}
                    { actions.showIsServer(props) && <span className="icon server"></span>}
                    { actions.canView(props) && <span className="icon view"></span>}
                </div>
            </div>
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
        if (this.state.type !== 'plugins') {
            newItems.sort(itemSort);
        }
        this.setState({items:newItems});
    };

    fillData(){
        let type=this.state.type;
        listItems(type)
            .then((items) => {
                if (type === 'chart'){
                    items.push({...DEFAULT_OVERLAY_CHARTENTRY});
                }
                if (type === 'user'){
                    let addons = this.state.addOns;
                    items.forEach((item) => {
                        if (! item.url) return;
                        if (Addons.findAddonByUrl(addons, item.url)) {
                            item.isAddon = true;
                        }
                    });
                }
                this.addItems(items,true);
            })
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
        const itemActions=createItemActions({type: this.state.type})
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
            this.getButtonParam('DownloadPagePlugins','plugins',true,keys.gui.capabilities.uploadPlugins),
            {
                name:'DownloadPageUpload',
                visible: itemActions.showUpload(),
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
    createItem(){
        const actions=createItemActions({type:this.state.type});
        const accessor=(data)=>actions.nameForCheck(data);
        const checker=(name)=>checkName(name,this.state.items,accessor);
        showPromiseDialog(undefined,(dprops)=><ItemNameDialog
            {...dprops}
            title={'enter filename'}
            checkName={checker}
            mandatory={true}
        />)
            .then((res)=>{
                const name=(res||{}).name;
                if (! name) return;
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
        const actions=createItemActions({type:this.state.type});
        const uploadAction=actions.getUploadAction();
        return (
            <Page
                {...self.props}
                id="downloadpage"
                mainContent={<React.Fragment>
                        <ItemList
                            itemClass={DownloadItem}
                            scrollable={true}
                            itemList={this.state.items}
                            onItemClick={async (ev)=>{
                                const item=avitem(ev);
                                if (self.props.options && self.props.options.selectItemCallback){
                                    return self.props.options.selectItemCallback(item);
                                }
                                showDialog(undefined,()=>
                                 <FileDialog
                                     current={item}
                                 />,()=>{
                                    this.fillData();
                                    this.readAddOns();
                                });
                            }}
                        />
                        <UploadHandler
                            local={uploadAction.hasLocalAction()}
                            type={this.state.type}
                            doneCallback={async (param)=>{
                                const rs=await uploadAction.afterUpload()
                                if (rs) return;
                                this.fillData()
                            }}
                            errorCallback={(err)=>{if (err) Toast(err);this.fillData();}}
                            uploadSequence={this.state.uploadSequence}
                            checkNameCallback={(file,dialogContext)=>uploadAction.checkFile(file,dialogContext)}
                            fixedPrefix={actions.prefixForDisplay()}
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