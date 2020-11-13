import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import OverlayDialog,{dialogHelper,stateHelper} from './OverlayDialog.jsx';
import assign from 'object-assign';
import {Input,Checkbox,InputReadOnly,InputSelect,ColorSelector,Radio} from './Inputs.jsx';
import ColorDialog from './ColorDialog.jsx';
import DB from './DialogButton.jsx';
import Button from './Button.jsx';
import ItemList from './ItemList.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import Helper from '../util/helper.js';
import GuiHelpers from '../util/GuiHelpers.js';
import {getKeyFromOverlay} from '../map/mapholder.js';

const filterOverlayItem=(item)=>{
    let rt=undefined;
    if (item.type == 'chart') {
        rt=Helper.filteredAssign({chartKey:true,type:true,opacity:true,enabled:true},item)
    }
    else {
        rt = assign({}, item);
    }
    for (let k in rt){
        if (typeof rt[k] === 'function'){
            delete rt[k];
        }
    }
    delete rt.selected;
    delete rt.index;
    delete rt.isDefault;
    return rt;
};


const ITEM_PROPERTIES={enabled:true};
const KNOWN_OVERLAY_EXTENSIONS=['gpx'];
const KNOWN_ICON_FILE_EXTENSIONS=['zip'];
class OverlayItemDialog extends React.Component{
    constructor(props) {
        super(props);
        this.dialogHelper = dialogHelper(this);
        this.stateHelper = stateHelper(this, props.current || {});
        this.state.itemsFetchCount = 0;
        //we make them only a variable as we consider them to be static
        this.itemLists={icons:[{label:"--none--"}],chart:[],overlays:[],images:[],user:[],knownOverlays:[],iconFiles:[{label:"--none--"}]};
        this.getItemList('chart');
        this.getItemList('overlays');
        this.getItemList('images');
        this.getItemList('user');
    }
    getItemList(type){
        Requests.getJson("",{},{
            request: 'listdir',
            type: type
        })
        .then((data)=>{
                this.itemLists[type]=data.items;
                if (type == 'user' || type == 'images' || type == 'overlays') {
                    data.items.forEach((item)=>{
                        if (GuiHelpers.IMAGES.indexOf(Helper.getExt(item.name)) >= 0) {
                            let el=assign({},item);
                            el.label=el.url;
                            this.itemLists.icons.push(el);
                        }
                    })
                }
                if (type == 'chart'){
                    //prepare select list
                    data.items.forEach((item)=>{
                        item.label=item.name;
                        item.value=item.chartKey;
                    });
                }
                if (type == 'overlays'){
                    data.items.forEach((item)=>{
                        item.label=item.name;
                        item.value=item.url;
                        if (KNOWN_OVERLAY_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0){
                            this.itemLists.knownOverlays.push(item);
                        }
                        if (KNOWN_ICON_FILE_EXTENSIONS.indexOf(Helper.getExt(item.name))>=0){
                            this.itemLists.iconFiles.push(assign({},item,{label:item.url}));
                        }
                    });
                }
                this.setState({itemsFetchCount:this.state.itemsFetchCount+1})
            })
        .catch((error)=>{
                Toast("error fetching list of "+type+": "+error);
            })
    }
    changeType(newType){
        if (newType == this.stateHelper.getValue('type')) return;
        let newState={
            type: newType,
            opacity: 1
        };
        this.stateHelper.setState(newState,true);
    }
    render(){
        let hasChanges=this.stateHelper.isChanged();
        let currentType=this.stateHelper.getValue('type');
        return(
        <React.Fragment>
            <div className="selectDialog editOverlayItemDialog">
                <h3 className="dialogTitle">{this.props.title||'Edit Overlay'}</h3>
                <div className="dialogRow info"><span className="inputLabel">Overlay</span>{this.stateHelper.getValue('name')}</div>
                <Checkbox
                    className="enabled"
                    dialogRow={true}
                    label="enabled"
                    onChange={(nv)=>this.stateHelper.setState({enabled:nv})}
                    value={this.stateHelper.getValue("enabled")||false}/>
                <Radio
                    className="type"
                    dialogRow={true}
                    label="type"
                    value={currentType}
                    itemList={[{label:'overlay',value:'overlay'},{label:'chart',value:'chart'}]}
                    onChange={(nv)=>this.changeType(nv)}
                    />
                <Input
                    className="opacity"
                    dialogRow={true}
                    label="opacity"
                    value={this.stateHelper.getValue('opacity')}
                    onChange={(nv)=>this.stateHelper.setValue('opacity',nv)}
                    type="number"
                    />
                {(currentType=='chart')?
                    <React.Fragment>
                        <InputSelect
                            dialogRow={true}
                            label="chart name"
                            value={{value:this.stateHelper.getValue('chartKey'),label:this.stateHelper.getValue('name')}}
                            list={this.itemLists.chart}
                            fetchCount={this.state.itemsFetchCount}
                            showDialogFunction={this.dialogHelper.showDialog}
                            onChange={(nv)=>{
                                this.stateHelper.setState({chartKey:nv.chartKey,name:nv.name});
                                }}
                            />
                    </React.Fragment>:
                    <React.Fragment>
                        <InputSelect
                            dialogRow={true}
                            label="overlay name"
                            value={this.stateHelper.getValue('name')}
                            list={this.itemLists.knownOverlays}
                            fetchCount={this.state.itemsFetchCount}
                            showDialogFunction={this.dialogHelper.showDialog}
                            onChange={(nv)=>{
                                this.stateHelper.setState({url:nv.url,name:nv.name});
                                }}
                            />
                        <InputSelect
                            dialogRow={true}
                            label="icon file"
                            value={this.stateHelper.getValue('icons')}
                            list={this.itemLists.iconFiles}
                            fetchCount={this.state.itemsFetchCount}
                            showDialogFunction={this.dialogHelper.showDialog}
                            onChange={(nv)=>{
                                this.stateHelper.setState({icons:nv.url});
                                }}
                            />
                        <Input
                            dialogRow={true}
                            type="number"
                            label="min zoom"
                            value={this.stateHelper.getValue('minZoom')||0}
                            onChange={(nv)=>this.stateHelper.setValue('minZoom',nv)}
                            />
                        <Input
                            dialogRow={true}
                            type="number"
                            label="max zoom"
                            value={this.stateHelper.getValue('maxZoom')||0}
                            onChange={(nv)=>this.stateHelper.setValue('maxZoom',nv)}
                            />
                        <Input
                            dialogRow={true}
                            type="number"
                            label="min scale"
                            value={this.stateHelper.getValue('minScale')||0}
                            onChange={(nv)=>this.stateHelper.setValue('minScale',nv)}
                            />
                        <Input
                            dialogRow={true}
                            type="number"
                            label="max scale"
                            value={this.stateHelper.getValue('maxScale')||0}
                            onChange={(nv)=>this.stateHelper.setValue('maxScale',nv)}
                            />
                        <InputSelect
                            dialogRow={true}
                            label="default icon"
                            value={this.stateHelper.getValue('defaultIcon')||'--none--'}
                            list={this.itemLists.icons}
                            fetchCount={this.state.itemsFetchCount}
                            showDialogFunction={this.dialogHelper.showDialog}
                            onChange={(nv)=>{
                                this.stateHelper.setState({defaultIcon:nv.url});
                                }}
                            />
                    </React.Fragment>
                }
                <div className="dialogButtons">
                    {this.props.updateCallback?
                        <DB
                            name="ok"
                            onClick={()=>{
                                let changes=this.stateHelper.getValues(true);
                                if (changes.opacity < 0) changes.opacity=0;
                                if (changes.opacity > 1) changes.opacity=1;
                                this.props.updateCallback(changes);
                                }}
                            disabled={!hasChanges}
                            >Update</DB>
                        :null}
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                    <div className="clear"></div>
                </div>
            </div>
        </React.Fragment>);
    }


}

const OverlayElement=(props)=>{
    return (
        <div className={"listEntry overlayElement "+(props.selected?"activeEntry":"")+(props.enabled?"":" disabled")+(props.isDefault?" defaultOverlay":"")} onClick={()=>props.onClick('select')}>
            <div className="itemInfo">
                <div className="infoRow">
                    <span className="inputLabel">Name</span><span className="valueText">{props.name}</span>
                </div>
                <div className="infoRow">
                    <span className="inputLabel">Type</span><span className="valueText">{props.type+(props.isDefault?"   [default]":"")}</span>
                </div>
            </div>
            <div className="actions">
            <Checkbox
                className="overlayEnabled"
                value={props.enabled||false}
                onChange={(nv)=>{props.onClick(nv?"enable":"disable")}}
                />
            <Button name="Edit"
                    className={"smallButton "+((props.isDefault||props.preventEdit)?"disabled":"")}
                    onClick={(ev)=>{ev.stopPropagation();props.onClick('edit')}}
                />
             </div>
        </div>
    );
};

class EditOverlaysDialog extends React.Component{
    constructor(props){
        super(props);
        this.stateHelper=stateHelper(this,props.current);
        this.state.selectedIndex=0;
        this.dialogHelper=dialogHelper(this);
        this.sizeCount=0;
    }


    showItemDialog(item){
        return new Promise((resolve,reject)=>{
            this.dialogHelper.showDialog((props)=>{
                return <OverlayItemDialog
                    {...props}
                    closeCallback={()=>{
                        props.closeCallback();
                        reject(0);
                    }}
                    updateCallback={(changed)=>{
                        if (!changed.name) reject(0);
                        else resolve(changed);
                        props.closeCallback();
                    }}
                    current={item}
                    title={item?"Edit Overlay":"New Overlay"}
                    />
            })
        })
    }
    insert(before){
        if (this.props.preventEdit) return;
        if (before) {
            if (this.state.selectedIndex === undefined){
                return;
            }
            if (this.state.selectedIndex < 0 || this.state.selectedIndex >= this.getCurrentOverlays().length){
                return;
            }
        }
        let idx=this.state.selectedIndex||0;
        this.showItemDialog({type:'overlay',opacity:1})
            .then((overlay)=>{
                let overlays=this.getCurrentOverlays(true);
                overlays.splice(before?idx:idx+1,0,overlay);
                this.stateHelper.setState({overlays:overlays});
            })
            .catch((reason)=>{if (reason) Toast(reason);});
    }
    editItem(item){
        if (this.props.preventEdit) return;
        this.showItemDialog(item)
            .then((changedItem)=>{
                this.updateItem(changedItem);
            })
            .catch((reason)=>{if (reason) Toast(reason);})
    }
    deleteItem(item){
        if (this.props.preventEdit) return;
        if (item.index < 0 || item.index >= this.getCurrentOverlays().length){
            return;
        }
        let overlays=this.getCurrentOverlays(true);
        overlays.splice(item.index,1);
        this.stateHelper.setValue('overlays',overlays);
    }
    updateItem(item,newValues){
        let overlays=this.getCurrentOverlays(true);
        if (item.index < 0 || item.index >= overlays.length){
            Toast("internal error, index changed");
            return;
        }
        overlays.splice(item.index,1,assign({},item,newValues));
        this.stateHelper.setState({overlays:overlays});
    }
    updateDefault(item,newValue) {
        if (! getKeyFromOverlay(item)) return;
        let current = assign({}, this.stateHelper.getValue('defaultsOverride'));
        current[getKeyFromOverlay(item)]=assign({},current[getKeyFromOverlay(item)],newValue);
        this.stateHelper.setValue('defaultsOverride',current);
    }

    getCurrentOverlays(opt_doCopy){
        let rt=this.stateHelper.getValues().overlays||[];
        if (opt_doCopy){
            return rt.slice();
        }
        return rt;
    }
    getCurrentDefaults(){
        if (!this.stateHelper.getValue('useDefault')) return [];
        let defaults=this.stateHelper.getValues().defaults||[].slice();
        let overrides=this.stateHelper.getValue('defaultsOverride')||{};
        defaults.forEach((def)=>{
            assign(def,overrides[getKeyFromOverlay(def,true)],{isDefault:true});
        });
        return defaults;

    }
    render () {
        let self=this;
        if (! this.props.current){
            this.props.closeCallback();
            return null;
        }
        let hasCurrent=this.props.current.name !== undefined;
        if (this.sizeCount !== this.state.sizeCount && this.props.updateDimensions){
            this.sizeCount=this.state.sizeCount;
            window.setTimeout(self.props.updateDimensions,100);
        }
        let hasOverlays=this.getCurrentOverlays().length> 0;
        let selectedItem=(!this.props.preventEdit && this.state.selectedIndex >=0 && this.state.selectedIndex < this.getCurrentOverlays().length)?
            this.getCurrentOverlays()[this.state.selectedIndex]:undefined;
        if (selectedItem) selectedItem.index=this.state.selectedIndex;
        return (
            <React.Fragment>
            <div className={"selectDialog editOverlaysDialog"+(this.props.preventEdit?" preventEdit":"")}>
                <h3 className="dialogTitle">{this.props.title||'Edit Overlays'}</h3>
                <div className="dialogRow info"><span className="inputLabel">Chart</span>{this.props.chartName}</div>
                {(!this.props.noDefault && ! this.props.preventEdit) && <Checkbox
                    className="useDefault"
                    dialogRow={true}
                    label="use default"
                    onChange={(nv)=>{
                        this.stateHelper.setState({useDefault:nv});
                        this.setState({selectedIndex:0});
                        }}
                    value={this.stateHelper.getValue("useDefault")||false}/>}
                {!this.props.noDefault && <ItemList
                    className="overlayItems"
                    itemClass={OverlayElement}
                    onItemClick={(item,data)=>{
                        if (data == 'disable'){
                            this.updateDefault(item,{enabled:false});
                            return;
                        }
                        if (data == 'enable'){
                            this.updateDefault(item,{enabled:true});
                            return;
                        }
                     }}
                    itemList={this.getCurrentDefaults()}
                    />}
                <ItemList
                    className="overlayItems"
                    itemClass={OverlayElement}
                    selectedIndex={this.props.preventEdit?undefined:this.state.selectedIndex}
                    onItemClick={(item,data)=>{
                        if (data == 'select'){
                            this.setState({selectedIndex:item.index});
                            return;
                        }
                        if (data == 'edit'){
                            this.editItem(item);
                            return;
                        }
                        if (data == 'disable'){
                            this.updateItem(item,{enabled:false});
                            return;
                        }
                        if (data == 'enable'){
                            this.updateItem(item,{enabled:true});
                            return;
                        }
                     }}
                    itemList={this.getCurrentOverlays()}
                    />
                <div className="insertButtons">
                    {selectedItem?<DB name="delete" onClick={()=>this.deleteItem(selectedItem)}>Delete</DB>:null}
                    {selectedItem?<DB name="edit" onClick={()=>this.editItem(selectedItem)}>Edit</DB>:null}
                    {(hasOverlays && ! this.props.preventEdit)?<DB name="before" onClick={()=>this.insert(true)}>Insert Before</DB>:null}
                    {!this.props.preventEdit && <DB name="after" onClick={()=>this.insert(false)}>Insert After</DB>}
                </div>
                <div className="dialogButtons">
                    {this.props.resetCallback &&
                        <DB
                            name="reset"
                            onClick={()=>{
                                this.props.closeCallback();
                                this.props.resetCallback();
                                }}
                            >Reset
                        </DB>
                    }
                    {this.props.updateCallback?
                        <DB
                            name="ok"
                            onClick={()=>{
                                this.props.closeCallback();
                                let changes=this.stateHelper.getValues(true);
                                if (changes.overlays){
                                    let newOverlays=[];
                                    changes.overlays.forEach((overlay)=>{
                                        newOverlays.push(filterOverlayItem(overlay));
                                    });
                                    changes.overlays=newOverlays;
                                }
                                else{
                                    changes.overlays=[];
                                }
                                delete changes.defaults;
                                this.props.updateCallback(changes);
                                }}
                            disabled={!this.stateHelper.isChanged()}
                            >Update</DB>
                    :null}
                    <DB name="cancel" onClick={this.props.closeCallback}>Cancel</DB>
                <div className="clear"></div>
                </div>
            </div>
            </React.Fragment>
        );
    }
}

EditOverlaysDialog.propTypes={
    title: PropTypes.string,
    current:PropTypes.any, //the current config
    updateCallback: PropTypes.func,
    resetCallback: PropTypes.func,
    closeCallback: PropTypes.func.isRequired,
    preventEdit: PropTypes.bool
};


/**
 *
 * @param chartKey
 * @return {boolean}
 */
EditOverlaysDialog.createDialog=(chartItem,opt_noDefault)=>{
    if (! chartItem.chartKey) return;
    let getParameters={
        request: 'api',
        type: 'chart',
        chartKey: chartItem.chartKey,
        command: 'getConfig',
        expandCharts: true,
        mergeDefault: !opt_noDefault
    };
    Requests.getJson("",{},getParameters)
        .then((config)=>{
            if (! config.data) return;
            if (config.data.useDefault === undefined) config.data.useDefault=true;
            OverlayDialog.dialog((props)=> {
                return <EditOverlaysDialog
                    {...props}
                    chartName={chartItem.name}
                    title="Edit Overlays"
                    current={config.data}
                    updateCallback={(newConfig)=>{
                        let postParam={
                            request: 'upload',
                            type: 'chart',
                            name: newConfig.name,
                            overwrite: true
                        };
                        Requests.postPlain("",JSON.stringify(newConfig,undefined,2),{},postParam)
                            .then((res)=>{})
                            .catch((error)=>{Toast("unable to save overlay config: "+error)});
                    }}
                    noDefault={opt_noDefault||false}
                    />
            });
        })
        .catch((error)=>{Toast("unable to get config: "+error);});

    return true;
};

export default  EditOverlaysDialog;