import React from 'react';
import PropTypes from 'prop-types';
import Promise from 'promise';
import OverlayDialog,{dialogHelper,stateHelper} from './OverlayDialog.jsx';
import assign from 'object-assign';
import {Input,Checkbox,InputReadOnly,InputSelect,ColorSelector} from './Inputs.jsx';
import ColorDialog from './ColorDialog.jsx';
import DB from './DialogButton.jsx';
import Button from './Button.jsx';
import ItemList from './ItemList.jsx';
import Requests from '../util/requests.js';
import Toast from './Toast.jsx';
import Helper from '../util/helper.js';

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
    return rt;
};

const ITEM_PROPERTIES={enabled:true};
class OverlayItemDialog extends React.Component{
    constructor(props){
        super(props);
        this.dialogHelper=dialogHelper(this);
        this.stateHelper=stateHelper(this,props.current||{});
    }
    render(){
        let hasChanges=this.stateHelper.isChanged();
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
                <div className="dialogButtons">
                    {this.props.updateCallback?
                        <DB
                            name="ok"
                            onClick={()=>{
                                let changes=this.stateHelper.getValues();
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
        <div className={"listEntry overlayElement "+(props.selected?"activeEntry":"")+(props.enabled?"":" disabled")} onClick={()=>props.onClick('select')}>
            <div className="itemInfo">
                <div className="infoRow">
                    <span className="inputLabel">Name</span><span className="valueText">{props.name}</span>
                </div>
                <div className="infoRow">
                    <span className="inputLabel">Type</span><span className="valueText">{props.type}</span>
                </div>
            </div>
            <Checkbox
                className="overlayEnabled"
                value={props.enabled||false}
                onChange={(nv)=>{props.onClick(nv?"enable":"disable")}}
                />
            <Button name="Edit"
                    className="smallButton"
                    onClick={(ev)=>{ev.stopPropagation();props.onClick('edit')}}
                />
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
        if (before) {
            if (this.state.selectedIndex === undefined){
                return;
            }
            if (this.state.selectedIndex < 0 || this.state.selectedIndex >= this.state.overlays.length){
                return;
            }
        }
        let idx=this.state.selectedIndex||0;
        this.showItemDialog(undefined)
            .then((overlay)=>{
                let overlays=(this.state.overlays||[]).slice();
                overlays.splice(before?idx:idx+1,0,overlay);
                this.stateHelper.setState({overlays:overlays});
            })
            .catch((reason)=>{if (reason) Toast(reason);});
    }
    editItem(item){
        this.showItemDialog(item)
            .then((changedItem)=>{
                this.updateItem(changedItem);
            })
            .catch((reason)=>{if (reason) Toast(reason);})
    }
    updateItem(item,newValues){
        let overlays=(this.stateHelper.getValues().overlays||[]).slice();
        if (item.index < 0 || item.index >= overlays.length){
            Toast("internal error, index changed");
            return;
        }
        overlays.splice(item.index,1,assign({},item,newValues));
        this.stateHelper.setState({overlays:overlays});
    }
    getCurrentOverlays(opt_doCopy){
        return this.stateHelper.getValues(opt_doCopy).overlays||[];
    }
    render () {
        let self=this;
        let hasCurrent=this.props.current.name !== undefined;
        if (this.sizeCount !== this.state.sizeCount && this.props.updateDimensions){
            this.sizeCount=this.state.sizeCount;
            window.setTimeout(self.props.updateDimensions,100);
        }
        let hasOverlays=this.getCurrentOverlays().length> 0;
        let selectedItem=(this.state.selectedIndex >=0 && this.state.selectedIndex < this.getCurrentOverlays().length)?
            this.getCurrentOverlays()[this.state.selectedIndex]:undefined;
        return (
            <React.Fragment>
            <div className="selectDialog editOverlaysDialog">
                <h3 className="dialogTitle">{this.props.title||'Edit Overlays'}</h3>
                <div className="dialogRow info"><span className="inputLabel">Chart</span>{this.props.chartName}</div>
                <Checkbox
                    className="useDefault"
                    dialogRow={true}
                    label="use default"
                    onChange={(nv)=>this.stateHelper.setState({useDefault:true})}
                    value={this.stateHelper.getValue("useDefault")||false}/>
                <ItemList
                    className="overlayItems"
                    itemClass={OverlayElement}
                    selectedIndex={this.state.selectedIndex}
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
                    scrollable={true}
                    itemList={this.getCurrentOverlays()}
                    />
                <div className="insertButtons">
                    {selectedItem?<DB name="edit" onClick={()=>this.editItem(selectedItem)}>Edit</DB>:null}
                    {hasOverlays?<DB name="before" onClick={()=>this.insert(true)}>Insert Before</DB>:null}
                    <DB name="after" onClick={()=>this.insert(false)}>Insert After</DB>
                </div>
                <div className="dialogButtons">
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
    closeCallback: PropTypes.func.isRequired
};


/**
 *
 * @param chartKey
 * @return {boolean}
 */
EditOverlaysDialog.createDialog=(chartItem)=>{
    let getParameters={
        request: 'api',
        type: 'chart',
        chartKey: chartItem.chartKey,
        command: 'getConfig',
        expandCharts: true
    };
    Requests.getJson("",{},getParameters)
        .then((config)=>{
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
                    />
            });
        })
        .catch((error)=>{Toast("unable to get config: "+error);});

    return true;
};

export default  EditOverlaysDialog;